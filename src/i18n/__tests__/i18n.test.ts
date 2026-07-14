import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES, toLocale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";
import { resolveDocumentLocale } from "@/i18n/documentLocale";
import { formatCurrency, formatDate } from "@/i18n/format";
import {
  getAddressLabels,
  getLetterSalutation,
  getServiceLabel,
  normalizeServiceKey,
} from "@/i18n/domain";
import { de } from "@/i18n/catalog/de";
import { fr } from "@/i18n/catalog/fr";
import { en } from "@/i18n/catalog/en";

describe("locale", () => {
  it("narrows untrusted values and never throws", () => {
    expect(toLocale("fr")).toBe("fr");
    expect(toLocale("tr")).toBe(DEFAULT_LOCALE);
    expect(toLocale(null)).toBe(DEFAULT_LOCALE);
    expect(toLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(toLocale(42)).toBe(DEFAULT_LOCALE);
  });

  it("guards the Locale type", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("it")).toBe(false);
  });
});

describe("catalog completeness", () => {
  it("every locale carries the exact German key set", () => {
    const deKeys = Object.keys(de).sort();
    expect(Object.keys(fr).sort()).toEqual(deKeys);
    expect(Object.keys(en).sort()).toEqual(deKeys);
  });

  it("has no empty translations — an empty string would render a blank field to a customer", () => {
    for (const [locale, catalog] of [
      ["fr", fr],
      ["en", en],
    ] as const) {
      const empty = Object.entries(catalog)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty, `empty ${locale} values`).toEqual([]);
    }
  });

  it("keeps every {placeholder} token identical across locales", () => {
    const tokens = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(de) as Array<keyof typeof de>) {
      expect(tokens(fr[key]), `fr placeholders for ${key}`).toEqual(tokens(de[key]));
      expect(tokens(en[key]), `en placeholders for ${key}`).toEqual(tokens(de[key]));
    }
  });
});

describe("translator", () => {
  it("interpolates named placeholders", () => {
    const t = createTranslator("de");
    expect(t("doc.offer.numbered", { number: "2026-001" })).toBe("Offerte Nr. 2026-001");
  });

  it("leaves an unknown placeholder untouched rather than printing 'undefined'", () => {
    const t = createTranslator("de");
    expect(t("doc.offer.numbered")).toBe("Offerte Nr. {number}");
  });

  it("selects plurals with the target locale's own rules", () => {
    // French treats 0 as singular; German and English treat it as plural.
    // A naive `count === 1` check would silently produce wrong French.
    const tFr = createTranslator("fr");
    const tDe = createTranslator("de");
    expect(tFr("catalog.translation.missing", { count: 0 })).toBe("0 champ encore manquant");
    expect(tFr("catalog.translation.missing", { count: 1 })).toBe("1 champ encore manquant");
    expect(tFr("catalog.translation.missing", { count: 3 })).toBe("3 champs encore manquants");
    expect(tDe("catalog.translation.missing", { count: 0 })).toBe("0 Felder fehlen noch");
    expect(tDe("catalog.translation.missing", { count: 1 })).toBe("1 Feld fehlt noch");
  });

  it("translates the same key differently per locale", () => {
    expect(createTranslator("de")("doc.invoice.title")).toBe("Rechnung");
    expect(createTranslator("fr")("doc.invoice.title")).toBe("Facture");
    expect(createTranslator("en")("doc.invoice.title")).toBe("Invoice");
  });
});

describe("document locale — the customer axis", () => {
  it("prefers the document's own language over the company default", () => {
    // The whole point: a German-speaking company sends a French customer a French
    // offer. The document wins; the operator's language must not leak in.
    expect(resolveDocumentLocale({ language: "fr" }, { default_language: "de" })).toBe("fr");
  });

  it("falls back to the company default when the row predates the column", () => {
    expect(resolveDocumentLocale({ language: null }, { default_language: "fr" })).toBe("fr");
    expect(resolveDocumentLocale(null, { default_language: "en" })).toBe("en");
  });

  it("falls back to German when nothing is known", () => {
    expect(resolveDocumentLocale(null, null)).toBe("de");
    expect(resolveDocumentLocale({ language: "tr" }, null)).toBe("de");
  });
});

describe("domain labels", () => {
  it("normalises historic German service spellings to one key", () => {
    expect(normalizeServiceKey("möbellift")).toBe("moebellift");
    expect(normalizeServiceKey("moebellift")).toBe("moebellift");
    expect(normalizeServiceKey("Privatumzug")).toBe("umzug_privat");
    expect(normalizeServiceKey("Klaviertransport")).toBe("klaviertransport");
    expect(normalizeServiceKey(null)).toBe("allgemein");
  });

  it("labels a service in each locale", () => {
    expect(getServiceLabel("reinigung", "de")).toBe("Reinigung");
    expect(getServiceLabel("reinigung", "fr")).not.toBe("Reinigung");
    expect(getServiceLabel("reinigung", "en")).not.toBe("Reinigung");
  });

  it("gives removal-specific address headers, not the generic fallback", () => {
    const de = getAddressLabels("umzug", "de");
    expect(de.primary).toBe("Auszugsadresse");
    expect(de.secondary).toBe("Einzugsadresse");
    const fr = getAddressLabels("umzug", "fr");
    expect(fr.primary).not.toBe(fr.secondary);
  });

  it("uses the neutral salutation instead of guessing gender", () => {
    // The old code guessed gender from the first name's last letter. An unknown
    // salutation must degrade to the neutral form, never to a guess.
    expect(getLetterSalutation(null, "Müller", "de")).toBe("Sehr geehrte Damen und Herren,");
    expect(getLetterSalutation("Herr", "Müller", "de")).toBe("Sehr geehrter Herr Müller,");
    expect(getLetterSalutation("Frau", "Müller", "de")).toBe("Sehr geehrte Frau Müller,");
  });
});

describe("formatting", () => {
  it("always bills in CHF, whatever the locale", () => {
    for (const locale of LOCALES) {
      expect(formatCurrency(1234.5, locale)).toContain("CHF");
    }
  });

  it("formats dates per locale", () => {
    const d = new Date("2026-01-15T10:00:00Z");
    expect(formatDate(d, "de")).toBe("15.01.2026");
    expect(formatDate(d, "en")).toBe("15/01/2026");
  });
});
