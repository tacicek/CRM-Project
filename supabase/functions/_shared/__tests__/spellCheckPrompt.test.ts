import { describe, expect, it } from "vitest";
import {
  SPELL_CHECK_LOCALES,
  buildSpellCheckSystemPrompt,
  isSpellCheckLocale,
  type SpellCheckLocale,
} from "../spellCheckPrompt";

describe("isSpellCheckLocale", () => {
  it("nimmt genau die drei Dokumentsprachen an", () => {
    expect(SPELL_CHECK_LOCALES).toEqual(["de", "fr", "en"]);
    for (const l of SPELL_CHECK_LOCALES) expect(isSpellCheckLocale(l)).toBe(true);
  });

  it("weist alles andere ab — es faellt NICHT auf Deutsch zurueck", () => {
    // Genau das war der Fehler: keine Sprache bedeutete "dann eben Deutsch",
    // und deutsche Regeln liefen ueber franzoesischen Text.
    for (const wert of [undefined, null, "", "DE", "de-CH", "it", 42, {}, ["de"]]) {
      expect(isSpellCheckLocale(wert)).toBe(false);
    }
  });
});

describe("buildSpellCheckSystemPrompt", () => {
  const alle = SPELL_CHECK_LOCALES as readonly SpellCheckLocale[];

  it("verbietet in JEDER Sprache das Uebersetzen", () => {
    // Eine Rechtschreibpruefung, die uebersetzt, macht aus einer franzoesischen
    // Offerte stillschweigend eine deutsche.
    for (const l of alle) {
      expect(buildSpellCheckSystemPrompt(l)).toContain("Do NOT translate anything");
    }
  });

  it("verbietet in JEDER Sprache das Umschreiben und das Aendern von Eigennamen", () => {
    for (const l of alle) {
      const p = buildSpellCheckSystemPrompt(l);
      expect(p).toContain("Do NOT change the meaning");
      expect(p).toContain("Do NOT change proper nouns");
    }
  });

  it("haelt das Ausgabeformat in jeder Sprache fest", () => {
    for (const l of alle) {
      const p = buildSpellCheckSystemPrompt(l);
      expect(p).toContain('"hasCorrections"');
      expect(p).toContain("Return ONLY a JSON object");
    }
  });

  it("gibt die deutschen Regeln NUR fuer de", () => {
    const de = buildSpellCheckSystemPrompt("de");
    expect(de).toContain("replace ß with ss");
    expect(de).toContain("German nouns are capitalized");

    for (const l of ["fr", "en"] as const) {
      const p = buildSpellCheckSystemPrompt(l);
      // Das ist der Kern des Befunds: die Schweizer ß-Regel und die deutsche
      // Substantivgrossschreibung duerfen franzoesischen/englischen Text nicht
      // beruehren.
      expect(p).not.toContain("ß");
      expect(p).not.toContain("German nouns are capitalized");
      expect(p).not.toContain("German spell checker");
    }
  });

  it("verbietet in fr und en ausdruecklich die Grossschreibung gewoehnlicher Substantive", () => {
    for (const l of ["fr", "en"] as const) {
      expect(buildSpellCheckSystemPrompt(l)).toContain("Do NOT capitalize common nouns");
    }
  });

  it("kennt fuer Franzoesisch die Akzente als Rechtschreibung", () => {
    expect(buildSpellCheckSystemPrompt("fr")).toContain("Restore missing accents");
  });

  it("nennt in jeder Sprache eine eigene Rolle", () => {
    const rollen = alle.map((l) => buildSpellCheckSystemPrompt(l).split("\n")[0]);
    expect(new Set(rollen).size).toBe(alle.length);
  });
});
