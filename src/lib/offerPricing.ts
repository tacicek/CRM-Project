// Shared pure helpers for the offer pricing model.
// Single source: PDF (ServiceTable) + public OfferView derive the same logic from here — no inline copies.
//
// NOTE: mapOfferData (maxHours guard) and OfferteItemRow (min&&max guard) still use their own inline
// guards; guard consolidation = scope of 3b (CLAUDE.md root-cause: not a patch, to be merged in a
// separate, deliberate step).

import { round2 } from "@/lib/offerSurcharges";
import { createTranslator } from "@/i18n/translator";

export interface TimeEstimate {
  minHours: number;
  maxHours: number;
  hourlyRate: number;
}

/**
 * Returns the price range of a blind/stundenbasiert (hourly) item.
 *
 * Guard is IDENTICAL to ServiceTable (ItemRow): if `te` is missing or
 * `!(minHours > 0 && hourlyRate > 0)` then null (PDF behaviour is preserved).
 *
 * DEFENSIVE: DB jsonb may carry an unexpected shape and the caller uses `as Offer`/`as OfferItem`
 * casts (TS does not warn). So we trust the VALUE, not the TYPE — if the fields are not real
 * numbers it returns null instead of blowing up.
 */
export const hourlyRange = (
  te: TimeEstimate | null | undefined,
): { min: number; max: number } | null => {
  if (
    !te ||
    typeof te.minHours !== "number" ||
    typeof te.maxHours !== "number" ||
    typeof te.hourlyRate !== "number"
  ) {
    return null;
  }
  if (!(te.minHours > 0 && te.hourlyRate > 0)) return null;
  return {
    min: te.minHours * te.hourlyRate,
    max: te.maxHours * te.hourlyRate,
  };
};

// ---------------------------------------------------------------------------
// Offer subtotal — SINGLE SOURCE (create + edit derive the same formula from here).
//
// Lesson #8 (reference): if subtotal/VAT is computed in multiple places it diverges.
// Previous state: create excluded by price_type (optional+inkl excluded), edit excluded by the
// unit==="inkl." string (which missed optional) → after edit+save the DB total drifted.
// Solution: a single pure fn; exclusion by SEMANTIC price_type, not by the unit string.
// ---------------------------------------------------------------------------

// Betrags-Achse (orthogonal zu price_type = Einheit/frei und offers.price_model = offer-level).
// - fixed: bestimmter Betrag → zählt zur Summe (heutiges Standardverhalten).
// - rate:  nur Einheitspreis, Menge/Dauer unbestimmt → NIE in der Summe (nur "CHF X / Einheit").
// - range: bestimmte Min/Max-Spanne → als Spanne in der Summe (Min im 'min'-, Max im 'max'-Modus).
export type AmountBasis = "fixed" | "rate" | "range";

/**
 * Normalisiert einen (DB-)String auf AmountBasis. Unbekannt/leer/null → null (→ Legacy-Ableitung
 * in resolveAmountBasis). Defensiv gegen unerwartete DB-Werte, ohne Cast (Switch-Narrowing).
 */
export const toAmountBasis = (value: string | null | undefined): AmountBasis | null => {
  switch (value) {
    case "fixed":
    case "rate":
    case "range":
      return value;
    default:
      return null;
  }
};

/**
 * Default-amount_basis bei der ITEM-ERSTELLUNG (Katalog/Rechner/Stundenansatz-Anwendung).
 * per_hour = Stundenansatz → 'rate' (unbestimmte Dauer, nicht in der Summe); sonst 'fixed'.
 * NUR fuer neue Items — die Ableitung (resolveAmountBasis) bleibt unberuehrt, damit Bestands-
 * items nicht rueckwirkend umklassifiziert werden.
 */
export const defaultAmountBasisForPriceType = (priceType: string | null | undefined): AmountBasis =>
  priceType === "per_hour" ? "rate" : "fixed";

export interface SubtotalItem {
  priceType: string; // 'pauschale' | 'per_unit' | 'per_hour' | 'optional' | 'inkl'
  quantity: number;
  unitPrice: number;
  timeEstimate: TimeEstimate | null;
  // Optional: fehlt sie, wird der Modus abgeleitet (siehe resolveAmountBasis) — dadurch bleibt
  // das Verhalten vor der DB-Spalte (Phase 2) identisch zu heute.
  amountBasis?: AmountBasis | null;
}

// ---------------------------------------------------------------------------
// Preistyp-Wechsel — SINGLE SOURCE (F1).
//
// BEFUND: das Preistyp-Dropdown synchronisierte NUR die Einheit. amount_basis, Menge und das
// Positions-Kostendach blieben stehen. Zwei sichtbar identische Positionen verhielten sich
// dadurch in der Summe verschieden — eine aus dem Katalog stammende `per_hour`-Position trägt
// 'rate' (zählt nicht zur Summe), eine von Hand auf „Pro Stunde" gestellte blieb 'fixed'
// (zählt). Und eine von 'rate' auf 'fixed' gedrehte Position schleppte ihr Kostendach mit auf
// den Beleg.
//
// Diese Funktion beantwortet an EINER Stelle, wie eine Position nach einem Preistyp-Wechsel
// aussieht. Erstellen, Bearbeiten und der Speicherpfad leiten davon ab — keine Kopien.
// ---------------------------------------------------------------------------

/** Einheiten, die der Preistyp VORGIBT (der Bediener wählt sie nicht). */
const FIXED_UNIT_BY_PRICE_TYPE: Record<string, string> = {
  pauschale: "Pauschal",
  per_hour: "Stunden",
  inkl: "",
};

/** Preistypen, bei denen der Bediener die Einheit selbst wählt. Default beim Wechsel. */
const CHOSEN_UNIT_DEFAULT = "Stk.";

/**
 * Gibt der Preistyp die Einheit vor (Einheiten-Auswahl ausgeblendet)?
 *
 * Dieselbe Tabelle wie `priceTypeShape` — das Formular hatte dafür bis F1 eine eigene
 * `fixedUnit`-Spalte in seiner Optionsliste, also eine zweite Wahrheit über dieselbe Frage.
 */
export const priceTypeFixesUnit = (priceType: string | null | undefined): boolean =>
  FIXED_UNIT_BY_PRICE_TYPE[priceType ?? ""] !== undefined;

export interface PriceTypeShape {
  unit: string;
  amountBasis: AmountBasis;
  quantity: number;
  /** Nur bei amountBasis 'rate' sinnvoll — sonst immer null. */
  kostendachMax: number | null;
}

export interface PriceTypeShapeInput {
  /** Die bisherige Einheit; bleibt erhalten, wenn der neue Typ die Wahl freilässt. */
  unit?: string | null;
  /** Die bisherige Menge; bleibt erhalten, wo eine Menge überhaupt Sinn ergibt. */
  quantity?: number | null;
  /** Das bisherige Positions-Kostendach. */
  kostendachMax?: number | null;
  /**
   * Trägt die Position eine rechenbare Zeitschätzung?
   *
   * Entscheidet bei `per_hour` zwischen 'range' (Min–Max × Ansatz, zählt als Spanne zur Summe)
   * und 'rate' (nur der Ansatz, Dauer offen). Dieselbe Regel wie in `resolveAmountBasis` —
   * ein Wechsel des Preistyps darf eine vorhandene, gültige Spanne nicht stillschweigend
   * wegwerfen.
   */
  hasValidTimeEstimate?: boolean;
}

/**
 * Wie eine Position nach dem Wechsel auf `priceType` aussieht — rein, ohne Seiteneffekt.
 *
 * Die Betrags-Achse folgt dem Preistyp (`per_hour` → 'rate' bzw. 'range' mit Zeitschätzung,
 * sonst 'fixed'). Der Bediener kann sie danach im Betragsbasis-Wähler weiter verfeinern; das
 * bleibt seine Entscheidung. Was diese Funktion verhindert, ist der Zustand, in dem NIEMAND
 * entschieden hat und die Position stumm anders rechnet, als sie aussieht.
 */
export const priceTypeShape = (
  priceType: string | null | undefined,
  current: PriceTypeShapeInput = {},
): PriceTypeShape => {
  const typ = priceType ?? "";
  const vorgegebeneEinheit = FIXED_UNIT_BY_PRICE_TYPE[typ];

  const unit =
    vorgegebeneEinheit !== undefined
      ? vorgegebeneEinheit
      : // Freie Wahl: die bisherige Einheit behalten — es sei denn, sie stammt von einem
        // Typ, der sie vorgegeben hatte ("Pauschal"/"Stunden" wären nach dem Wechsel falsch).
        (() => {
          const bisher = (current.unit ?? "").trim();
          const warVorgegeben = Object.values(FIXED_UNIT_BY_PRICE_TYPE).includes(bisher);
          return bisher !== "" && !warVorgegeben ? bisher : CHOSEN_UNIT_DEFAULT;
        })();

  const amountBasis: AmountBasis =
    typ === "per_hour" ? (current.hasValidTimeEstimate ? "range" : "rate") : "fixed";

  // Menge nur dort, wo das Formular sie auch zeigt und sie etwas bedeutet.
  // - pauschale: die Menge ist begrifflich 1 (das Feld ist ausgeblendet). Bliebe die alte 3
  //   stehen, ergäbe der eingetippte Pauschalpreis 400 in der Summe 1200 — ohne sichtbaren Grund.
  // - inkl: keine Berechnung.
  // - per_hour: die Dauer steckt im Ansatz bzw. in der Zeitschätzung, nicht in der Menge.
  const behaeltMenge = typ === "per_unit" || typ === "optional";
  const rohMenge = Number(current.quantity);
  const quantity = behaeltMenge && Number.isFinite(rohMenge) && rohMenge > 0 ? rohMenge : 1;

  // Ein Kostendach beschreibt die Obergrenze eines OFFENEN Betrags. Sobald der Betrag
  // bestimmt ist, hat es keinen Gegenstand mehr und darf nicht auf dem Beleg landen (F3).
  const kostendachMax =
    amountBasis === "rate" &&
    current.kostendachMax !== null &&
    current.kostendachMax !== undefined &&
    Number.isFinite(current.kostendachMax)
      ? current.kostendachMax
      : null;

  return { unit, amountBasis, quantity, kostendachMax };
};

// Item types not included in the subtotal (shown but not summed): optional, inkl.
const EXCLUDED_FROM_SUBTOTAL = new Set(["optional", "inkl"]);

/**
 * Is an item "free" (not in the subtotal → chip in the UI)? priceType ∈ {inkl, optional} → true.
 * Paid (pauschale/per_unit/per_hour → box) → false.
 *
 * ⚠️ SINGLE SOURCE: derives from the same constant EXCLUDED_FROM_SUBTOTAL that determines
 * subtotal/VAT — the "free = not in the subtotal" semantics are not split (Lesson #8). No separate
 * {inkl,optional} list is defined; the chip/box distinction and the financial distinction always stay in sync.
 */
export const isFreeItem = (priceType: string | null | undefined): boolean =>
  EXCLUDED_FROM_SUBTOTAL.has(priceType ?? "");

// Same set as OfferItem.priceType (OfferteItemRow). For the catalog → offer item bridge.
export type OfferPriceType = "pauschale" | "per_unit" | "per_hour" | "inkl" | "optional";

/**
 * A catalog item's price type, derived from its semantic flags — SINGLE SOURCE for both
 * catalog-add paths in OfferteErstellen (no inline copies that can diverge).
 *
 * Priority (semantic flags first, unit only as fallback):
 *   1. is_default_included → "inkl"      (included → chip)
 *   2. is_optional         → "optional"  (on request → chip)
 *   3. unit "Inklusiv"     → "inkl"      (legacy, still honoured)
 *   4. unit-based paid type → per_hour / per_unit / pauschale (→ box)
 *
 * NOTE: default_price is intentionally NOT consulted — a CHF 0 optional item must stay
 * "optional", not silently become "inkl". The flags decide, never the price.
 */
export const derivePriceTypeFromCatalog = (item: {
  is_default_included?: boolean;
  is_optional?: boolean;
  unit?: string | null;
}): OfferPriceType => {
  if (item.is_default_included) return "inkl";
  if (item.is_optional) return "optional";
  if (item.unit === "Inklusiv") return "inkl";
  const u = (item.unit ?? "").trim().toLowerCase();
  if (u.includes("stunde") || u.includes("std")) return "per_hour";
  if (["stück", "stk", "stk.", "m3", "m³", "m2", "m²", "kg", "lfm", "tag", "fahrt", "person", "stockwerk"].includes(u))
    return "per_unit";
  return "pauschale";
};

/**
 * Löst den effektiven Betrags-Modus eines Items auf — SINGLE SOURCE für Summe und Anzeige.
 *
 * Explizit gesetzte amountBasis gewinnt immer. Fehlt sie (Zustand vor der DB-Spalte, Phase 2),
 * wird das heutige Verhalten exakt reproduziert: gültiges timeEstimate → 'range', sonst 'fixed'.
 * 'rate' entsteht NIE aus der Ableitung — es ist der neue, ausschliesslich explizite Zustand.
 */
export const resolveAmountBasis = (item: {
  amountBasis?: AmountBasis | null;
  timeEstimate: TimeEstimate | null;
}): AmountBasis => {
  if (item.amountBasis) return item.amountBasis;
  return hourlyRange(item.timeEstimate) ? "range" : "fixed";
};

/**
 * Computes the subtotal of an item list (pure — does not parse, expects numbers).
 * - priceType ∈ {optional, inkl} → skipped (isFreeItem).
 * - amountBasis 'rate' → skipped (Menge/Dauer unbestimmt, kein bestimmter Betrag — NIE in der Summe,
 *   auch nicht mit item-level Kostendach: eine Offerte mit rate-Posten zeigt gar keine Aggregatsumme,
 *   siehe offerHasRateItem / RATE_AGGREGATE_NOTE).
 * - amountBasis 'range' (bzw. gültiges timeEstimate) → mode 'min' lower bound, 'max' upper bound.
 * - otherwise (fixed) quantity * unitPrice.
 *
 * Rückwärtskompatibilität: solange amountBasis nirgends gesetzt ist, ist das Ergebnis identisch
 * zum vorherigen Stand (range bei gültigem timeEstimate, sonst quantity * unitPrice).
 */
export const computeItemsSubtotal = (
  items: SubtotalItem[],
  mode: "min" | "max" = "min",
): number =>
  items.reduce((sum, item) => {
    if (isFreeItem(item.priceType)) return sum;
    const basis = resolveAmountBasis(item);
    if (basis === "rate") return sum;
    if (basis === "range") {
      const r = hourlyRange(item.timeEstimate);
      if (r) return sum + (mode === "min" ? r.min : r.max);
    }
    return sum + item.quantity * item.unitPrice;
  }, 0);

// ---------------------------------------------------------------------------
// Offer-level Rabatt (offers.discount_percent, Katman 4) — P3a.
//
// Decision (Option A): the DISCOUNTED taxable base is written to offers.subtotal, so the
// GENERATED vat_amount/total stay correct untouched. The pre-discount Zwischensumme is always
// recomputed from the items (computeItemsSubtotal) — never derived back from offers.subtotal.
//
// Both fns are pure and mode-agnostic: for a blind range the caller applies them separately
// to the min and the max value with the same percent.
// ---------------------------------------------------------------------------

/** Applies the offer-level discount to an amount. null/0/negative percent → no-op. */
export function applyDiscount(amount: number, discountPercent: number | null | undefined): number {
  if (!discountPercent || discountPercent <= 0) return amount;
  return round2(amount * (1 - discountPercent / 100));
}

/** CHF value of the discount (pre-discount amount − discounted amount). */
export function computeDiscountAmount(
  amount: number,
  discountPercent: number | null | undefined,
): number {
  if (!discountPercent || discountPercent <= 0) return 0;
  return round2(amount - applyDiscount(amount, discountPercent));
}

/**
 * itemsSubtotal + (fixed) surcharge sum → taxableBase → VAT → total.
 * For the UPPER bound of the blind range, the PDF (mapOfferData) and OfferView use the same chain.
 * surchargesSum is FIXED (stored amounts) — percent is not recomputed (offers.surcharges already
 * carries a computed amount). The min side comes from the DB's GENERATED values; this fn is only
 * for the upper bound (max). vatRate 0 → vatAmount 0.
 */
export const computeTotalsFromSubtotal = (
  itemsSubtotal: number,
  surchargesSum: number,
  vatRate: number,
): { taxableBase: number; vatAmount: number; total: number } => {
  const taxableBase = itemsSubtotal + surchargesSum;
  const vatAmount = (taxableBase * (vatRate > 0 ? vatRate : 0)) / 100;
  return { taxableBase, vatAmount, total: taxableBase + vatAmount };
};

/**
 * Consolidated READ-surface totals (Detail / OfferView / PDF mapOfferData) — P3b-2a.
 *
 * Snapshot semantics: `surchargesSum` is the STORED surcharge amount sum
 * (sumSurchargeAmounts) — percent/per_km surcharges are NOT recomputed here (unlike the
 * save-side computeOfferTotals in offerSurcharges.ts, which recomputes from type/value).
 *
 * `subtotal` is the RAW items sum (Zwischensumme) — the discount is NEVER applied to it
 * (rule P3b: the Zwischensumme is always derived from the items, never back from
 * offers.subtotal, which stores the DISCOUNTED base since P3b-1). The discount enters
 * between the raw base and the VAT, exactly mirroring what the save flow writes.
 */
export interface DisplayTotals {
  /** RAW items subtotal (Zwischensumme) — no discount applied. */
  subtotal: number;
  /** CHF discount on the raw base (0 when no discount). */
  discountAmount: number;
  /** Discounted base = what offers.subtotal stores (min mode). */
  taxableBase: number;
  vatAmount: number;
  total: number;
}

export function computeDisplayTotals(
  items: SubtotalItem[],
  surchargesSum: number,
  vatRate: number,
  discountPercent: number | null | undefined,
  mode: "min" | "max",
): DisplayTotals {
  const itemsSubtotal = computeItemsSubtotal(items, mode);
  const rawBase = itemsSubtotal + surchargesSum;
  const discountAmount = computeDiscountAmount(rawBase, discountPercent);
  const taxableBase = applyDiscount(rawBase, discountPercent);
  const vatAmount = round2((taxableBase * (vatRate > 0 ? vatRate : 0)) / 100);
  return {
    subtotal: itemsSubtotal,
    discountAmount,
    taxableBase,
    vatAmount,
    total: round2(taxableBase + vatAmount),
  };
}

/**
 * Hat die Offerte mindestens einen 'rate'-Posten (Stunden-/m³-Ansatz, Menge/Dauer unbestimmt)?
 * SINGLE SOURCE für die Frage, OB überhaupt eine Aggregatsumme angezeigt wird.
 *
 * Regel (bewusst einfach, Kostendach IRRELEVANT): sobald EIN Posten 'rate' ist, ergibt eine
 * Gesamtbetrag-/Zwischensumme-Box keinen Sinn (sie würde einen Endpreis suggerieren, den es
 * nicht gibt) — alle Read-Flächen blenden die Box dann komplett aus und zeigen stattdessen
 * RATE_AGGREGATE_NOTE. Nur fixed+range → normale Summe/Spanne (unverändert, Blind-Logik intakt).
 */
export const offerHasRateItem = (items: SubtotalItem[]): boolean =>
  items.some((item) => !isFreeItem(item.priceType) && resolveAmountBasis(item) === "rate");

// ---------------------------------------------------------------------------
// Preismodell — ABGELEITET, nicht gesetzt (ADR_offerte_preismodell, Entscheidung 1).
//
// `offers.price_model` war ein Offerte-Feld, das die Summe nicht beeinflusst hat: das
// Kästchen sagte „Kostendach", und gerechnet wurde pauschal. Zwei Wahrheiten nebeneinander.
//
// Seit F1 gibt es nur noch eine: die Positionen. Diese Funktion liest sie und beantwortet,
// WELCHES Etikett der Beleg trägt. Sie ist die einzige Stelle dafür — PDF, Kunden-E-Mail,
// Live-Vorschau und Offerten-Liste leiten alle hierher ab.
//
// Die Spalten `offers.price_model` / `hourly_rate` / `kostendach_max` werden nicht mehr
// geschrieben. Bestandszeilen behalten ihre Werte, aber gelesen wird die Ableitung: wo die
// alte Beklebung den Positionen widersprach, hat sie den Positionen schon immer
// widersprochen — der Betrag kam von dort.
// ---------------------------------------------------------------------------

export interface PriceModelItem extends SubtotalItem {
  /** Positions-Kostendach (offer_items.kostendach_max) — nur bei 'rate' gesetzt. */
  kostendachMax?: number | null;
  /**
   * Der Ansatz aus den Service-Details (effort_meta.hourly_rate / volume_meta.rate), falls
   * erfasst. Hat Vorrang vor `unitPrice`, weil der Beleg ihn ebenfalls zuerst liest
   * (ServiceTable, OfferPDFModern).
   */
  metaRate?: number | null;
}

export interface DerivedPriceModel {
  model: "pauschal" | "stundenansatz" | "kostendach";
  /** Nur gesetzt, wenn ALLE rate-Positionen denselben Ansatz tragen — sonst null. */
  hourlyRate: number | null;
  /** Summe der Positions-Obergrenzen; null, wenn keine Position eine trägt. */
  kostendachMax: number | null;
}

/**
 * Das Preismodell einer Offerte aus ihren Positionen.
 *
 *   mindestens eine 'rate'-Position + Positions-Kostendach → kostendach
 *   mindestens eine 'rate'-Position                        → stundenansatz
 *   sonst                                                   → pauschal
 *
 * `hourlyRate` bleibt null, sobald die rate-Positionen VERSCHIEDENE Ansätze tragen — ein
 * einzelner Satz im Kästchen wäre dann falsch, und die Positionszeilen nennen ohnehin jede
 * für sich. Lieber kein Kästchen als ein Kästchen mit einer von drei Zahlen.
 */
export const deriveOfferPriceModel = (items: PriceModelItem[]): DerivedPriceModel => {
  const rateItems = items.filter(
    (item) => !isFreeItem(item.priceType) && resolveAmountBasis(item) === "rate",
  );

  if (rateItems.length === 0) {
    return { model: "pauschal", hourlyRate: null, kostendachMax: null };
  }

  const saetze = new Set(
    rateItems
      .map((item) => Number(item.metaRate ?? item.unitPrice))
      .filter((wert) => Number.isFinite(wert) && wert > 0),
  );
  const hourlyRate = saetze.size === 1 ? [...saetze][0] : null;

  const deckel = rateItems
    .map((item) => Number(item.kostendachMax))
    .filter((wert) => Number.isFinite(wert) && wert > 0);

  return deckel.length > 0
    ? { model: "kostendach", hourlyRate, kostendachMax: deckel.reduce((a, b) => a + b, 0) }
    : { model: "stundenansatz", hourlyRate, kostendachMax: null };
};

// Hinweis anstelle der ausgeblendeten Gesamtbetrag-/Zwischensumme-Box — SINGLE SOURCE,
// damit alle Flächen (PDF, OfferView, Detail, Email, LivePreview, Erstellen/Bearbeiten) wörtlich gleich sind.
//
// i18n: die Texte leben jetzt im Katalog (doc.offer.rateAggregateNote, doc.offer.blind.*).
// Die Konstanten unten sind die GERMAN-ONLY-Auflösung derselben Keys — sie bedienen die
// Dashboard-Flächen, die noch direkt auf Deutsch rendern. Kundenseitige Renderer (PDF,
// öffentliche Offerte, E-Mail) dürfen sie NICHT verwenden; die lösen die Keys mit der
// Sprache des Kunden auf (documentI18nFor(locale)).
const germanDocumentText = createTranslator("de");

export const RATE_AGGREGATE_NOTE = germanDocumentText("doc.offer.rateAggregateNote");

// Kompakt-Variante für enge Flächen (Offerten-Liste Betrag-Spalte) — statt eines irreführenden
// Fix-Summen-Betrags bei Offerten mit rate-Posten. Gleiche Semantik wie RATE_AGGREGATE_NOTE.
export const RATE_AGGREGATE_SHORT = germanDocumentText("domain.priceModel.byEffort");

// ---------------------------------------------------------------------------
// Zeilen-Anzeige — SINGLE SOURCE für die Betragsdarstellung einer Position.
//
// Alle Render-Flächen (PDF ServiceTable, OfferView, OfferteDetail, OfferteLivePreview,
// OfferteItemRow) leiten die Zeilen-Darstellung aus DIESER Funktion ab, statt sie je selbst zu
// bilden (Lesson #8: doppelte Ableitung driftet auseinander). Gibt strukturierte Zahlen zurück,
// KEINE fertigen Strings — Formatierung (formatCurrency, Farben, "bis"/"/Std") bleibt pro Fläche.
// ---------------------------------------------------------------------------

export interface AmountDisplayItem {
  priceType: string;
  quantity: number;
  unitPrice: number;
  timeEstimate: TimeEstimate | null;
  amountBasis?: AmountBasis | null;
  unit?: string | null;
  // Gespeicherter Zeilenbetrag (z. B. rabattierter Positionswert); für 'fixed' bevorzugt vor
  // quantity * unitPrice, damit die Zeilenanzeige der Read-Flächen unverändert bleibt.
  total?: number | null;
}

export type AmountDisplay =
  | { kind: "free"; priceType: string }
  | { kind: "fixed"; amount: number }
  | { kind: "rate"; unitPrice: number; unit: string }
  | { kind: "range"; min: number; max: number };

/**
 * Bestimmt, WIE der Betrag einer Position angezeigt wird:
 * - free  (inkl/optional): kein Betrag (Chip/Leistungsumfang) — priceType zur Label-Wahl.
 * - rate:  Einheitspreis "CHF unitPrice / unit" (nicht summiert).
 * - range: Spanne min–max (aus timeEstimate).
 * - fixed: einzelner Betrag (total ?? quantity * unitPrice).
 *
 * Konsistent mit computeItemsSubtotal: ein als 'range' markiertes Item ohne berechenbare Spanne
 * fällt auf 'fixed' zurück (identischer Fallback wie in der Summe).
 */
export const itemAmountDisplay = (item: AmountDisplayItem): AmountDisplay => {
  if (isFreeItem(item.priceType)) return { kind: "free", priceType: item.priceType ?? "" };
  const basis = resolveAmountBasis(item);
  if (basis === "rate") {
    return { kind: "rate", unitPrice: item.unitPrice, unit: (item.unit ?? "").trim() };
  }
  if (basis === "range") {
    const r = hourlyRange(item.timeEstimate);
    if (r) return { kind: "range", min: r.min, max: r.max };
  }
  return { kind: "fixed", amount: item.total ?? item.quantity * item.unitPrice };
};

// Blind offer disclaimer — German resolution of doc.offer.blind.label / doc.offer.blind.text
// for the dashboard surfaces. The PDF resolves the same keys in the customer's language.
export const BLIND_DISCLAIMER_LABEL = germanDocumentText("doc.offer.blind.label");
export const BLIND_DISCLAIMER_TEXT = germanDocumentText("doc.offer.blind.text");
