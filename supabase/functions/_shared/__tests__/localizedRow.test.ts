import { describe, expect, it } from "vitest";
import { BASIS_SPRACHE, resolveLocalizedRowField } from "../localizedRow";
import { DEFAULT_LOCALE } from "../../../../src/i18n/locale";

describe("Die Basissprache ist an beiden Enden dieselbe", () => {
  it("_shared und src/i18n sagen dasselbe", () => {
    // „Ein Vertrag, zwei Laufzeiten" — dann darf es auch nur EINE Antwort auf
    // „welche Sprache steht in den Spalten selbst" geben.
    expect(BASIS_SPRACHE).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveLocalizedRowField", () => {
  const zeile = { title: "Deutscher Titel", translations: { fr: { title: "Titre français" } } };

  it("nennt eine Übersetzung eine Übersetzung", () => {
    expect(resolveLocalizedRowField(zeile, "title", "fr")).toEqual({
      value: "Titre français", source: "translation",
    });
  });

  it("nennt den deutschen Rückfall einen Rückfall", () => {
    expect(resolveLocalizedRowField(zeile, "title", "en")).toEqual({
      value: "Deutscher Titel", source: "base-fallback",
    });
  });

  it("nennt die Basisspalte bei Deutsch die Basis", () => {
    expect(resolveLocalizedRowField(zeile, "title", "de")).toEqual({
      value: "Deutscher Titel", source: "base",
    });
  });

  it("eine leere oder nur aus Leerzeichen bestehende Übersetzung zählt nicht", () => {
    for (const leer of ["", "   ", "\n\t "]) {
      expect(
        resolveLocalizedRowField({ title: "Deutsch", translations: { fr: { title: leer } } }, "title", "fr").source,
      ).toBe("base-fallback");
    }
  });

  it("ohne Basiswert und ohne Übersetzung: absent", () => {
    expect(resolveLocalizedRowField({ title: "  " }, "title", "fr")).toEqual({
      value: null, source: "absent",
    });
  });

  it("KANN eine wörtlich kopierte deutsche Übersetzung nicht erkennen", () => {
    // Bewusst festgehalten, damit niemand mehr verspricht, als hier geprüft wird:
    // die Herkunft stimmt, der Inhalt ist deutsch. Das ist die häufigste reale
    // Form einer nicht übersetzten AGB.
    const kopiert = { content: "Zahlbar innert 30 Tagen.", translations: { fr: { content: "Zahlbar innert 30 Tagen." } } };
    expect(resolveLocalizedRowField(kopiert, "content", "fr").source).toBe("translation");
  });
});
