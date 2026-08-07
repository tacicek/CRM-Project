import type { MessageKey } from "@/i18n/translator";

/**
 * Die Preistypen, wie sie im Formular zur Auswahl stehen — EINE Liste für Erstellen und
 * Bearbeiten.
 *
 * `value` ist das gespeicherte Token (`offer_items.price_type`) und bleibt unverändert; nur
 * `labelKey` wird zur Laufzeit in der Sprache des BEDIENERS aufgelöst. Auf dem Beleg wird
 * dasselbe Token in der Sprache des KUNDEN neu aufgelöst.
 *
 * Was hier bewusst NICHT mehr steht: Standardeinheit und „gibt der Typ die Einheit vor?".
 * Beides beantwortet `priceTypeShape` / `priceTypeFixesUnit` in src/lib/offerPricing.ts.
 * Bis F1 trug diese Liste eigene `defaultUnit`/`fixedUnit`-Spalten und war damit eine zweite
 * Wahrheit über dieselbe Frage.
 *
 * Eigene Datei und kein Export aus OfferteItemRow: eine Komponentendatei, die zusätzlich
 * Konstanten exportiert, bricht Fast Refresh (react-refresh/only-export-components).
 */
export const priceTypeOptions = [
  { value: "pauschale", labelKey: "offer.item.priceType.pauschale" as MessageKey },
  { value: "per_unit", labelKey: "offer.item.priceType.perUnit" as MessageKey },
  { value: "per_hour", labelKey: "offer.item.priceType.perHour" as MessageKey },
  { value: "inkl", labelKey: "offer.item.priceType.inkl" as MessageKey },
  { value: "optional", labelKey: "common.optional" as MessageKey },
] as const;
