import { LOCALE_TAGS, type Locale } from "@/i18n/locale";
import { createTranslator, type MessageKey } from "@/i18n/translator";

/**
 * Quantity + unit for a PDF line ("3 Stunden", "1 Person", "2 Paletten").
 *
 * `offer_items.unit` is FREE TEXT authored by the operator, so it cannot be translated
 * wholesale — a unit the company invented ("Paletten", "Fahrten à 2 Mann") stays verbatim.
 * Only the KNOWN units — the ones the app itself writes and that exist in the catalog as
 * domain.unit.* — are resolved into the customer's language. Everything else is printed
 * exactly as it was authored.
 */

interface UnitKeys {
  one: MessageKey;
  other: MessageKey;
}

/** German DB spellings (lowercased) → catalog keys. Singular and plural share an entry. */
const KNOWN_UNITS: Record<string, UnitKeys> = {
  "std": { one: "domain.unit.hour", other: "domain.unit.hour" },
  "std.": { one: "domain.unit.hour", other: "domain.unit.hour" },
  "stunde": { one: "domain.unit.hour.long", other: "domain.unit.hour.plural" },
  "stunden": { one: "domain.unit.hour.long", other: "domain.unit.hour.plural" },
  "tag": { one: "domain.unit.day", other: "domain.unit.day.plural" },
  "tage": { one: "domain.unit.day", other: "domain.unit.day.plural" },
  "monat": { one: "domain.unit.month", other: "domain.unit.month" },
  "person": { one: "domain.unit.person", other: "domain.unit.person.plural" },
  "personen": { one: "domain.unit.person", other: "domain.unit.person.plural" },
  "stück": { one: "domain.unit.piece", other: "domain.unit.piece" },
  "stk": { one: "domain.unit.piece", other: "domain.unit.piece" },
  "stk.": { one: "domain.unit.piece", other: "domain.unit.piece" },
  "pauschale": { one: "domain.unit.flatRate", other: "domain.unit.flatRate" },
};

export const formatQuantityUnit = (
  quantity: number,
  unitRaw: string,
  locale: Locale
): string => {
  const unit = (unitRaw || "").trim();
  if (!unit) return String(quantity);

  const keys = KNOWN_UNITS[unit.toLowerCase()];
  // Unknown = operator-authored free text → keep it exactly as stored.
  if (!keys) return `${quantity} ${unit}`;

  // Plural category per locale: French counts 0 as singular, German and English do not.
  const category = new Intl.PluralRules(LOCALE_TAGS[locale]).select(quantity);
  const t = createTranslator(locale);
  return `${quantity} ${t(category === "one" ? keys.one : keys.other)}`;
};
