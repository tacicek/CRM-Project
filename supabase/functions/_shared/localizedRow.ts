/**
 * Wo ein Wert herkommt, wenn eine Zeile ihre Übersetzungen im `translations`-
 * JSONB trägt.
 *
 * EIN VERTRAG, ZWEI LAUFZEITEN
 *
 * Diese Datei liegt unter `_shared/`, wird aber auch vom Frontend benutzt:
 * `src/i18n/localizedField.ts` reicht sie durch. Zwei Kopien derselben
 * Auflösungsregel wären zwei Sprachverträge, und der zweite wäre der, den
 * niemand pflegt — genau der Fehler, den dieses Programm beseitigt.
 *
 * WARUM DIE HERKUNFT ZÄHLT
 *
 * Die bequeme Fassung (`localizedField`) liefert bei fehlender Übersetzung die
 * deutsche Basisspalte. Für die VORSCHAU ist das richtig: eine Leerstelle im
 * Dokument wäre schlimmer als deutscher Text. Beim SENDEN ist genau dieser
 * Rückfall der Fehler — der französische Kunde bekommt Deutsch, und niemand
 * erfährt davon.
 *
 * Deshalb gibt diese Fassung nicht nur den Wert zurück, sondern auch, WOHER er
 * kommt. Der Sendeweg behandelt `base-fallback` als Blocker, die Vorschau
 * markiert ihn.
 */

/** Die Basissprache: ihre Werte stehen in den Spalten selbst, nicht im JSONB. */
export const BASIS_SPRACHE = "de";

export type LocalizedFieldSource = "translation" | "base" | "base-fallback" | "absent";

export interface ResolvedLocalizedField {
  value: string | null;
  source: LocalizedFieldSource;
}

export interface TranslatableRow {
  translations?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nichtLeer = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export const resolveLocalizedRowField = (
  row: TranslatableRow & Record<string, unknown>,
  field: string,
  locale: string,
): ResolvedLocalizedField => {
  const rohBasis = row[field];
  const basis = nichtLeer(rohBasis) ? rohBasis : null;

  if (locale === BASIS_SPRACHE) {
    return basis === null ? { value: null, source: "absent" } : { value: basis, source: "base" };
  }

  const bundle = row.translations;
  if (isRecord(bundle)) {
    const fuerSprache = bundle[locale];
    if (isRecord(fuerSprache)) {
      const uebersetzt = fuerSprache[field];
      // Eine leere Übersetzung ist keine Übersetzung — sie ist ein leeres Feld
      // im Übersetzungswerkzeug, und der Kunde bekäme trotzdem Deutsch.
      if (nichtLeer(uebersetzt)) return { value: uebersetzt, source: "translation" };
    }
  }

  return basis === null ? { value: null, source: "absent" } : { value: basis, source: "base-fallback" };
};
