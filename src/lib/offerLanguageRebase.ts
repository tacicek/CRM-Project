import type { Locale } from "@/i18n/locale";

/**
 * Was ein Sprachwechsel an einer Offerte WIRKLICH tut — und was nicht.
 *
 * DER BEFUND
 *
 * Der Sprachwähler auf `OfferteErstellen`/`OfferteBearbeiten` setzte
 * `offers.language` und sonst nichts. Titel, Positionstexte,
 * Zahlungskonditionen und AGB blieben in der vorigen Sprache stehen. Die
 * Oberfläche sagte „Französisch", das Dokument war deutsch, und beides war
 * gleichzeitig wahr — auf verschiedenen Ebenen.
 *
 * DIE ANTWORT IST KEIN AUTOMATISMUS
 *
 * Der naheliegende Reflex — beim Wechsel alles neu erzeugen — wäre schlimmer.
 * Er überschriebe den von Hand geschriebenen Satz des Bedieners mit einer
 * Katalogfassung, und zwar wortlos. Deshalb erzeugt diese Datei einen PLAN
 * statt einer Wirkung: sie sagt für jedes Feld, was möglich ist und warum,
 * und überlässt die Entscheidung dem, der sie verantwortet.
 *
 * WAS SIE NICHT TUT
 *
 * Sie übersetzt nicht. Sie kennt keine Sprachmodelle und keine Wörterbücher.
 * Sie liest ausschliesslich, was jemand vorher als Übersetzung HINTERLEGT hat
 * (`translations`-JSONB) oder was aus einem Katalogschlüssel deterministisch
 * erzeugt werden kann. Fehlt beides, sagt sie das — sie erfindet nichts.
 *
 * Sie fasst ausserdem nie Geld, Mengen, Steuern, Einheiten, Kennungen oder
 * Daten an. Diese Felder tragen die Kategorie `NON_LOCALIZED` und erscheinen
 * niemals in der Anwendungsliste.
 *
 * Rein und deterministisch: gleiche Eingabe, gleicher Plan. Kein Datum, kein
 * Zufall, kein Netz, kein React.
 */

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export const REBASE_KATEGORIEN = [
  /** Eine hinterlegte Übersetzung existiert und darf auf den Entwurf angewendet werden. */
  "REBASE_AVAILABLE",
  /** Der Inhalt entspricht bereits der gewählten Dokumentsprache. */
  "ALREADY_CORRECT",
  /** Weicht von der hinterlegten Quelle ab — von Hand geändert, nicht still überschreiben. */
  "USER_EDITED_CONFLICT",
  /** Für die Zielsprache ist nichts hinterlegt. */
  "TRANSLATION_MISSING",
  /** Sprachneutral: Beträge, Mengen, Steuern, Einheiten, Kennungen, Daten. */
  "NON_LOCALIZED",
  /** Die Offerte ist versendet/angenommen/abgelehnt/abgelöst — eingefroren. */
  "IMMUTABLE",
] as const;

export type RebaseKategorie = (typeof REBASE_KATEGORIEN)[number];

/**
 * Woher der aktuelle Wert stammt, soweit der Aufrufer es weiss.
 *
 * `unknown` ist ausdrücklich erlaubt und wird konservativ behandelt: ohne
 * bekannte Quelle kann niemand sagen, ob der Text erzeugt oder getippt wurde,
 * also gilt er als getippt.
 */
export type Feldherkunft =
  | "generated"
  | "catalog"
  | "template"
  | "manual"
  | "non-localized"
  | "unknown";

export interface RebaseFeldEingabe {
  /** Stabiler Pfad, z. B. `title`, `payment_terms`, `items[2].description`. */
  feld: string;
  entity: "offer" | "offer_item";
  entityId?: string | null;
  herkunft: Feldherkunft;
  /** Der Wert, wie er JETZT im Entwurf steht. */
  aktuellerWert: string | null;
  /** Was die Quelle in der AKTUELLEN Sprache liefern würde (`null` = unbekannt). */
  quelleInAktuellerSprache?: string | null;
  /** Was die Quelle in der ZIELSPRACHE liefern würde (`null` = nichts hinterlegt). */
  quelleInZielsprache?: string | null;
  /** Menschlich lesbare Herkunft für die Fehlmeldung, z. B. `company_service_items:<id>.description`. */
  quelleBezeichnung?: string;
}

export interface RebaseFeldBefund extends RebaseFeldEingabe {
  kategorie: RebaseKategorie;
  /** Nur gesetzt, wenn ein hinterlegter Zielwert existiert. Ein VORSCHLAG, keine Wirkung. */
  vorschlag?: string;
  /** Warum diese Kategorie — für Oberfläche und Fehlersuche. */
  begruendung: string;
}

export interface RebasePlan {
  von: Locale;
  nach: Locale;
  /** Die Offerte ist eingefroren; der Plan enthält dann ausschliesslich `IMMUTABLE`. */
  eingefroren: boolean;
  felder: RebaseFeldBefund[];
  zusammenfassung: Record<RebaseKategorie, number>;
  /**
   * Felder, die OHNE Rückfrage angewendet werden dürfen. Ein Feld mit
   * `USER_EDITED_CONFLICT` steht hier NICHT — dafür braucht `applyOfferLanguageRebase`
   * eine feldgenaue Zustimmung.
   */
  anwendbar: RebaseFeldBefund[];
  /** Für die Fehlanzeige: was für welche Sprache fehlt. */
  fehlendeUebersetzungen: Array<{
    feld: string;
    entity: RebaseFeldEingabe["entity"];
    entityId?: string | null;
    quelleBezeichnung?: string;
    zielsprache: Locale;
  }>;
}

export interface RebasePlanEingabe {
  von: Locale;
  nach: Locale;
  /**
   * Versendet, angenommen, abgelehnt, abgelaufen, abgelöst — oder sonst
   * gesperrt. Fail closed: der Aufrufer muss `false` ausdrücklich übergeben.
   */
  eingefroren: boolean;
  felder: ReadonlyArray<RebaseFeldEingabe>;
}

// ---------------------------------------------------------------------------
// Vergleich
// ---------------------------------------------------------------------------

/**
 * Textvergleich für „ist das noch der Quelltext?".
 *
 * Randleerzeichen und Zeilenenden zählen nicht: ein Textfeld, das beim
 * Speichern ein `\r\n` bekommen hat, ist nicht „vom Bediener geändert". Alles
 * andere zählt — auch ein einzelnes geändertes Wort, denn genau das ist der
 * Fall, den niemand überschreiben darf.
 */
const gleich = (a: string | null | undefined, b: string | null | undefined): boolean =>
  norm(a) === norm(b);

const norm = (v: string | null | undefined): string =>
  (v ?? "").replace(/\r\n/g, "\n").trim();

const leer = (v: string | null | undefined): boolean => norm(v) === "";

/**
 * Feldpfade, die eine Sprachumstellung baulich nicht anfassen darf.
 *
 * Bis zur Durchsicht am 2026-08-28 hing die Zusage „ein Sprachwechsel ändert
 * keinen Betrag" allein daran, dass der Sammler drei Felder von Hand als
 * `non-localized` etikettiert. Ein falsch etikettiertes `unit_price` wäre
 * durchgelaufen — die Durchsicht hat das mit einer Sonde gezeigt.
 *
 * Jetzt entscheidet der PFAD mit, nicht nur das Etikett. Ein Etikett kann man
 * falsch setzen; ein Pfad, der auf `.unit_price` endet, ist ein Betrag.
 */
const SPRACHNEUTRALE_PFADE =
  /(^|\.)(unit_price|quantity|unit|price_type|amount_basis|kostendach_max|mwst_satz|mwst_betrag|rabatt|discount_percent|total|zwischensumme|gesamttotal|betrag|offer_number|id|created_at|updated_at|scheduled_date|scheduled_start|scheduled_end)$/;

export const istSprachneutralerPfad = (feld: string): boolean =>
  SPRACHNEUTRALE_PFADE.test(feld);

// ---------------------------------------------------------------------------
// Einstufung
// ---------------------------------------------------------------------------

const stufeEin = (
  feld: RebaseFeldEingabe,
  von: Locale,
  nach: Locale,
  eingefroren: boolean,
): RebaseFeldBefund => {
  const mit = (
    kategorie: RebaseKategorie,
    begruendung: string,
    vorschlag?: string,
  ): RebaseFeldBefund => ({ ...feld, kategorie, begruendung, ...(vorschlag !== undefined ? { vorschlag } : {}) });

  // 1. Eingefroren schlägt alles. Ein versendetes Dokument wird nicht
  //    umgeschrieben — es bekommt einen Nachfolger.
  if (eingefroren) {
    return mit("IMMUTABLE", "Die Offerte ist versendet oder anderweitig gesperrt; eine Sprachumstellung erzeugt eine neue Fassung, sie ändert diese nicht.");
  }

  // 2. Sprachneutrale Felder werden nie angefasst. Steht vor allen anderen
  //    Regeln, damit kein Zahlenfeld je in der Anwendungsliste landet.
  //
  //    Zwei Gründe genügen einzeln: das Etikett des Sammlers ODER der Feldpfad.
  //    Ein Etikett kann man falsch setzen — ein Pfad, der auf `.unit_price`
  //    endet, ist ein Betrag, egal was danebensteht.
  if (feld.herkunft === "non-localized" || istSprachneutralerPfad(feld.feld)) {
    return mit("NON_LOCALIZED", "Betrag, Menge, Steuer, Einheit, Kennung oder Datum — sprachneutral.");
  }

  // 3. Dieselbe Sprache: ein Wechsel auf sich selbst ändert nichts.
  if (von === nach) {
    return mit("ALREADY_CORRECT", "Die Zielsprache ist die aktuelle Sprache.");
  }

  const zielQuelle = feld.quelleInZielsprache ?? null;

  // 4. Steht der Zielwert schon da, ist nichts zu tun — unabhängig davon,
  //    wie er dorthin kam.
  if (!leer(zielQuelle) && gleich(feld.aktuellerWert, zielQuelle)) {
    return mit("ALREADY_CORRECT", "Der Inhalt entspricht bereits der hinterlegten Fassung in der Zielsprache.");
  }

  // 5. Von Hand geschrieben. Es gibt keine Quelle, an der man messen könnte, ob
  //    der Bediener sie verändert hat — also gilt der Text als seiner.
  if (feld.herkunft === "manual") {
    if (leer(feld.aktuellerWert)) {
      return mit("ALREADY_CORRECT", "Freitextfeld ohne Inhalt — es gibt nichts umzustellen.");
    }
    return mit(
      "USER_EDITED_CONFLICT",
      "Freier Text des Bedieners. Er wird nicht übersetzt und nicht ersetzt; die Entscheidung liegt bei der Person, die ihn geschrieben hat.",
      !leer(zielQuelle) ? (zielQuelle as string) : undefined,
    );
  }

  // 6. Ohne messbare Quelle in der AKTUELLEN Sprache lässt sich nicht sagen, ob
  //    der Text noch der Katalogtext ist. Dann gilt er als der des Bedieners.
  //
  //    Die erste Fassung prüfte hier `quelleInAktuellerSprache !== null` und
  //    fiel bei `null` durch bis zu Regel 9 — REBASE_AVAILABLE, ohne Zustimmung
  //    angewendet. Genau der Fall trat ein, wenn die Katalogzeile für die
  //    AUSGANGSsprache keine Übersetzung hat: eine französische Offerte, deren
  //    Position der Bediener von Hand geschrieben hat, wurde beim Wechsel nach
  //    Deutsch wortlos durch den Katalogtext ersetzt. Gefunden von der
  //    unabhängigen Durchsicht am 2026-08-28.
  //
  //    Nicht messbar heisst jetzt: nicht anfassen.
  const quelleMessbar =
    feld.quelleInAktuellerSprache !== undefined && feld.quelleInAktuellerSprache !== null;

  if (!leer(feld.aktuellerWert)) {
    if (!quelleMessbar) {
      return mit(
        "USER_EDITED_CONFLICT",
        "Für die Ausgangssprache ist keine Quelle hinterlegt — ob dieser Text aus dem Katalog stammt oder von Hand geschrieben wurde, lässt sich nicht belegen. Ohne Beleg wird er nicht ersetzt.",
        !leer(zielQuelle) ? (zielQuelle as string) : undefined,
      );
    }

    if (!gleich(feld.aktuellerWert, feld.quelleInAktuellerSprache)) {
      return mit(
        "USER_EDITED_CONFLICT",
        "Weicht von der hinterlegten Quelle ab — von Hand geändert. Ein stilles Überschreiben würde die Änderung verlieren.",
        !leer(zielQuelle) ? (zielQuelle as string) : undefined,
      );
    }
  }

  // 7. Unbekannte Herkunft: konservativ wie „von Hand", solange Inhalt da ist.
  //    (Regel 6 fängt das inzwischen mit ab; die Regel bleibt stehen, weil sie
  //    einen eigenen, deutlicheren Grund nennt.)
  if (feld.herkunft === "unknown" && !leer(feld.aktuellerWert)) {
    return mit(
      "USER_EDITED_CONFLICT",
      "Die Herkunft dieses Textes ist nicht belegt. Ohne Beleg gilt er als vom Bediener geschrieben.",
      !leer(zielQuelle) ? (zielQuelle as string) : undefined,
    );
  }

  // 8. Quelle vorhanden, unverändert — aber für die Zielsprache ist nichts hinterlegt.
  if (leer(zielQuelle)) {
    return mit(
      "TRANSLATION_MISSING",
      "Für die Zielsprache ist nichts hinterlegt. Erfunden wird hier nichts — die Übersetzung muss in der Quelle gepflegt werden.",
    );
  }

  // 9. Übrig bleibt der Fall, für den es diese Datei gibt.
  return mit(
    "REBASE_AVAILABLE",
    "Eine hinterlegte Übersetzung liegt vor und der Text wurde nicht von Hand geändert.",
    zielQuelle as string,
  );
};

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

const LEERE_ZUSAMMENFASSUNG = (): Record<RebaseKategorie, number> =>
  Object.fromEntries(REBASE_KATEGORIEN.map((k) => [k, 0])) as Record<RebaseKategorie, number>;

export const buildOfferLanguageRebasePlan = (eingabe: RebasePlanEingabe): RebasePlan => {
  const felder = eingabe.felder.map((f) =>
    stufeEin(f, eingabe.von, eingabe.nach, eingabe.eingefroren),
  );

  const zusammenfassung = LEERE_ZUSAMMENFASSUNG();
  for (const f of felder) zusammenfassung[f.kategorie] += 1;

  return {
    von: eingabe.von,
    nach: eingabe.nach,
    eingefroren: eingabe.eingefroren,
    felder,
    zusammenfassung,
    anwendbar: felder.filter((f) => f.kategorie === "REBASE_AVAILABLE"),
    fehlendeUebersetzungen: felder
      .filter((f) => f.kategorie === "TRANSLATION_MISSING")
      .map((f) => ({
        feld: f.feld,
        entity: f.entity,
        entityId: f.entityId ?? null,
        quelleBezeichnung: f.quelleBezeichnung,
        zielsprache: eingabe.nach,
      })),
  };
};

// ---------------------------------------------------------------------------
// Anwenden
// ---------------------------------------------------------------------------

export interface RebaseAnwendung {
  /** Feldpfad → neuer Wert. Nur Textfelder; sprachneutrale Felder sind nie dabei. */
  aenderungen: Record<string, string>;
  /** Die neue Dokumentsprache. Wird auch bei leerer Änderungsliste gesetzt. */
  nach: Locale;
  /** Übernommene Konfliktfelder — für das Protokoll. */
  uebernommeneKonflikte: string[];
  /** Nicht angewendet und warum. */
  ausgelassen: Array<{ feld: string; kategorie: RebaseKategorie }>;
}

/**
 * Wendet einen zuvor erzeugten Plan an.
 *
 * Nimmt den PLAN entgegen, nicht die Offerte. Die Oberfläche darf die Felder
 * nicht ein zweites Mal selbst zusammensuchen — sonst gäbe es zwei
 * Sprachverträge, und der zweite wäre der, den niemand testet.
 *
 * `konfliktZustimmung` ist die feldgenaue Zustimmung des Bedieners. Ohne sie
 * bleibt ein `USER_EDITED_CONFLICT` unangetastet. Eine pauschale
 * „alles übernehmen"-Zustimmung gibt es hier bewusst nicht.
 *
 * Eine eingefrorene Offerte liefert eine leere Änderungsliste UND behält ihre
 * Sprache: an ihr wird nichts geändert, auch nicht der Sprachcode.
 */
export const applyOfferLanguageRebase = (
  plan: RebasePlan,
  konfliktZustimmung: ReadonlyArray<string> = [],
): RebaseAnwendung => {
  if (plan.eingefroren) {
    return {
      aenderungen: {},
      nach: plan.von,
      uebernommeneKonflikte: [],
      ausgelassen: plan.felder.map((f) => ({ feld: f.feld, kategorie: f.kategorie })),
    };
  }

  const zugestimmt = new Set(konfliktZustimmung);
  const aenderungen: Record<string, string> = {};
  const uebernommeneKonflikte: string[] = [];
  const ausgelassen: Array<{ feld: string; kategorie: RebaseKategorie }> = [];

  for (const f of plan.felder) {
    // Zweiter Riegel am Ausgang. Selbst ein von Hand gebauter Plan, der einen
    // Betrag als REBASE_AVAILABLE führte, kommt hier nicht durch.
    if (istSprachneutralerPfad(f.feld)) {
      ausgelassen.push({ feld: f.feld, kategorie: f.kategorie });
      continue;
    }
    if (f.kategorie === "REBASE_AVAILABLE" && f.vorschlag !== undefined) {
      aenderungen[f.feld] = f.vorschlag;
      continue;
    }
    if (
      f.kategorie === "USER_EDITED_CONFLICT" &&
      zugestimmt.has(f.feld) &&
      f.vorschlag !== undefined
    ) {
      aenderungen[f.feld] = f.vorschlag;
      uebernommeneKonflikte.push(f.feld);
      continue;
    }
    ausgelassen.push({ feld: f.feld, kategorie: f.kategorie });
  }

  return { aenderungen, nach: plan.nach, uebernommeneKonflikte, ausgelassen };
};
