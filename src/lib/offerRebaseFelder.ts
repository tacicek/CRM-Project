import { documentI18nFor } from "@/i18n/documentLocale";
import { resolveLocalizedField } from "@/i18n/localizedField";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";
import { buildOfferTitle, type OfferTitleQuelle } from "@/lib/offerTitle";
import type { RebaseFeldEingabe } from "@/lib/offerLanguageRebase";

/**
 * Sammelt die Felder, die ein Sprachwechsel betrifft — und ihre Quellen.
 *
 * `buildOfferLanguageRebasePlan` STUFT EIN, diese Datei TRÄGT ZUSAMMEN. Die
 * Trennung ist Absicht: der Einstufer bleibt frei von Katalogwissen und damit
 * prüfbar, und die Oberfläche bekommt eine einzige Stelle, an der steht, welche
 * Felder es überhaupt gibt.
 *
 * WAS „QUELLE" HEISST
 *
 * Für jedes Feld wird gefragt: was WÜRDE hier stehen, wenn es aus seiner Quelle
 * in Sprache X käme? Zwei Arten von Quellen:
 *
 *   Katalogschlüssel  — ein Eintrag im typisierten DE/FR/EN-Katalog. Für jede
 *                       Sprache erzeugbar, nie fehlend (der Compiler erzwingt
 *                       Vollständigkeit).
 *   Datenbankzeile    — eine Zeile mit `translations`-JSONB. Kann für die
 *                       Zielsprache leer sein; dann meldet der Plan
 *                       TRANSLATION_MISSING statt still deutsch zu bleiben.
 *
 * WAS SIE NICHT WEISS
 *
 * `offer_items` trägt keine Herkunftsspalte. Für Positionen, die in DIESER
 * Sitzung aus dem Katalog übernommen wurden, kann die Seite die Herkunft
 * mitgeben; für alles aus der Datenbank Geladene bleibt sie `unknown` — und der
 * Plan behandelt `unknown` konservativ als „vom Bediener geschrieben".
 * Eine Herkunftsspalte ist eine Migration und damit eine eigene, freizugebende
 * Arbeit.
 */

/**
 * Eine Zeile mit deutschem Basiswert und `translations`-JSONB.
 *
 * Bewusst als Index-Signatur ueber `unknown` und NICHT ueber
 * `Record<string, unknown>`: eine konkret typisierte Zeile (z. B. `ServiceItem`)
 * ist zu einem `Record<string, unknown>` nicht zuweisbar, weil ihr die
 * Index-Signatur fehlt. Der Aufrufer soll seine echten Typen uebergeben duerfen,
 * ohne sie vorher zu einem `any` zu verflachen.
 */
export interface UebersetzbareZeile {
  translations?: unknown;
}

export interface KatalogHerkunft {
  zeile: UebersetzbareZeile;
  /**
   * Die Spalten, aus denen der Positionstext zusammengesetzt ist — in dieser
   * Reihenfolge, mit Zeilenumbruch verbunden. `OfferteErstellen` schreibt
   * `name + "\n" + description`; ein Text aus zwei Spalten braucht auch zwei
   * Übersetzungen.
   */
  felder: string[];
}

/**
 * Der zusammengesetzte Quelltext in einer Sprache — oder `null`.
 *
 * `null`, sobald AUCH NUR EINE der beteiligten Spalten in der Zielsprache fehlt,
 * obwohl sie auf Deutsch gefüllt ist. Sonst entstünde ein französischer Name mit
 * deutscher Beschreibung darunter: halb übersetzt sieht aus wie übersetzt, und
 * genau das soll der Plan als TRANSLATION_MISSING melden.
 */
const ausZeile = (
  zeile: UebersetzbareZeile,
  felder: string[],
  locale: Locale,
): string | null => {
  const teile: string[] = [];
  for (const feld of felder) {
    const auf = resolveLocalizedField(
      zeile as UebersetzbareZeile & Record<string, string | null | undefined>,
      feld,
      locale,
    );
    if (auf.value === null || auf.value.trim() === "") continue; // auf Deutsch leer → zählt nicht
    if (locale !== "de" && auf.source !== "translation") return null;
    teile.push(auf.value);
  }
  return teile.length > 0 ? teile.join("\n") : null;
};

export type Textquelle =
  | { art: "katalogschluessel"; key: MessageKey }
  | { art: "zeile"; zeile: UebersetzbareZeile; feld: string }
  | null;

const ausQuelle = (quelle: Textquelle, locale: Locale): string | null => {
  if (!quelle) return null;
  if (quelle.art === "katalogschluessel") return documentI18nFor(locale).t(quelle.key);
  const aufgeloest = resolveLocalizedField(
    quelle.zeile as UebersetzbareZeile & Record<string, string | null | undefined>,
    quelle.feld,
    locale,
  );
  // `base-fallback` ist für die Zielsprache KEINE Übersetzung — genau diese
  // Unterscheidung macht `resolveLocalizedField` und `localizedField` nicht.
  if (locale !== "de" && aufgeloest.source !== "translation") return null;
  return aufgeloest.value;
};

const bezeichnung = (quelle: Textquelle): string | undefined => {
  if (!quelle) return undefined;
  if (quelle.art === "katalogschluessel") return `i18n:${quelle.key}`;
  return `translations.${quelle.feld}`;
};

export interface RebasePositionEingabe {
  id: string;
  position: number;
  description: string;
  /** Sprachneutrale Begleitwerte — sie erscheinen im Plan, damit sichtbar ist, dass sie NICHT angefasst werden. */
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface SammelEingabe {
  von: Locale;
  nach: Locale;
  /** Grundlage des erzeugten Titels. `null` = kein Lead, Titel gilt als frei geschrieben. */
  titelQuelle: OfferTitleQuelle | null;
  titel: string;
  positionen: ReadonlyArray<RebasePositionEingabe>;
  /** Positions-Id → Katalogzeile, soweit in dieser Sitzung bekannt. */
  positionsherkunft?: ReadonlyMap<string, KatalogHerkunft>;
  zahlungskondition: { wert: string; quelle: Textquelle };
  agb: { wert: string; quelle: Textquelle };
}

export const sammleOfferteRebaseFelder = (e: SammelEingabe): RebaseFeldEingabe[] => {
  const felder: RebaseFeldEingabe[] = [];

  // --- Titel ---------------------------------------------------------------
  felder.push({
    feld: "title",
    entity: "offer",
    herkunft: e.titelQuelle ? "generated" : "manual",
    aktuellerWert: e.titel,
    quelleInAktuellerSprache: e.titelQuelle ? buildOfferTitle(e.von, e.titelQuelle) : null,
    quelleInZielsprache: e.titelQuelle ? buildOfferTitle(e.nach, e.titelQuelle) : null,
    quelleBezeichnung: e.titelQuelle ? "offer.doc.title.*" : undefined,
  });

  // --- Positionen ----------------------------------------------------------
  for (const p of e.positionen) {
    const herkunft = e.positionsherkunft?.get(p.id) ?? null;
    felder.push({
      feld: `items[${p.position}].description`,
      entity: "offer_item",
      entityId: p.id,
      herkunft: herkunft ? "catalog" : "unknown",
      aktuellerWert: p.description,
      quelleInAktuellerSprache: herkunft ? ausZeile(herkunft.zeile, herkunft.felder, e.von) : null,
      quelleInZielsprache: herkunft ? ausZeile(herkunft.zeile, herkunft.felder, e.nach) : null,
      quelleBezeichnung: herkunft
        ? `company_service_items.${herkunft.felder.join("+")}`
        : undefined,
    });

    // Bewusst mit im Plan: so steht schwarz auf weiss, dass Menge, Einheit und
    // Preis eine Sprachumstellung nicht überleben müssen — sie werden nie angefasst.
    felder.push(
      { feld: `items[${p.position}].quantity`,   entity: "offer_item", entityId: p.id, herkunft: "non-localized", aktuellerWert: String(p.quantity) },
      { feld: `items[${p.position}].unit`,       entity: "offer_item", entityId: p.id, herkunft: "non-localized", aktuellerWert: p.unit },
      { feld: `items[${p.position}].unit_price`, entity: "offer_item", entityId: p.id, herkunft: "non-localized", aktuellerWert: String(p.unit_price) },
    );
  }

  // --- Zahlungskondition ---------------------------------------------------
  felder.push({
    feld: "payment_terms",
    entity: "offer",
    herkunft: e.zahlungskondition.quelle ? "template" : "manual",
    aktuellerWert: e.zahlungskondition.wert,
    quelleInAktuellerSprache: ausQuelle(e.zahlungskondition.quelle, e.von),
    quelleInZielsprache: ausQuelle(e.zahlungskondition.quelle, e.nach),
    quelleBezeichnung: bezeichnung(e.zahlungskondition.quelle),
  });

  // --- AGB / Bedingungen ---------------------------------------------------
  felder.push({
    feld: "terms_and_conditions",
    entity: "offer",
    herkunft: e.agb.quelle ? "template" : "manual",
    aktuellerWert: e.agb.wert,
    quelleInAktuellerSprache: ausQuelle(e.agb.quelle, e.von),
    quelleInZielsprache: ausQuelle(e.agb.quelle, e.nach),
    quelleBezeichnung: bezeichnung(e.agb.quelle),
  });

  return felder;
};
