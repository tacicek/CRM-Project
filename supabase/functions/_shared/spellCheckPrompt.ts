/**
 * Rechtschreibpruefung: welche Regeln fuer welche Dokumentsprache.
 *
 * WARUM DIESE DATEI EXISTIERT
 *
 * Bis 2026-08-28 trug `spell-check-ai/index.ts` genau EINEN fest verdrahteten
 * Prompt: "You are a German spell checker for Swiss business documents",
 * inklusive `ß → ss` und "German nouns must be capitalized". Der Aufrufer
 * (`src/lib/spellCheckService.ts`) schickte `{ fields }` — ohne Sprache.
 *
 * Aufgerufen wurde er aus `OfferteErstellen` und `OfferteBearbeiten`, also fuer
 * JEDE Dokumentsprache. Eine franzoesische Offerte lief damit durch deutsche
 * Orthografieregeln: "Nous déménageons" bekommt keine Substantivgrossschreibung
 * geschenkt, aber ein Modell, dem man sagt "German nouns must be capitalized",
 * findet auch in franzoesischem Text Substantive.
 *
 * Der Prompt ist damit ein Teil des Vertrags, nicht Beiwerk. Er liegt hier als
 * reine Funktion, damit die Zusagen — deutsche Regeln nur fuer `de`, niemals
 * uebersetzen — pruefbar sind statt behauptet.
 */

export const SPELL_CHECK_LOCALES = ["de", "fr", "en"] as const;

export type SpellCheckLocale = (typeof SPELL_CHECK_LOCALES)[number];

export const isSpellCheckLocale = (wert: unknown): wert is SpellCheckLocale =>
  typeof wert === "string" && (SPELL_CHECK_LOCALES as readonly string[]).includes(wert);

/**
 * Gilt fuer JEDE Sprache. Steht bewusst getrennt von den sprachabhaengigen
 * Regeln: wer eine Sprache ergaenzt, kann diese Zusagen nicht vergessen.
 *
 * Das Ausgabeformat ist Teil des Vertrags — der Aufrufer parst es.
 */
const GEMEINSAM = [
  "Correct spelling, capitalization and punctuation errors in the provided text.",
  "Do NOT translate anything. The text stays in its own language.",
  "Do NOT change the meaning, do NOT rewrite sentences, do NOT restyle.",
  "Do NOT change proper nouns (person names, street names, cities, company names).",
  "Return ONLY a JSON object, no explanation, no markdown:",
  '  { "fields": { "fieldName": "corrected text", ... }, "hasCorrections": true/false }',
];

/**
 * Sprachabhaengige Regeln. `ß → ss` und die Substantivgrossschreibung gehoeren
 * ausschliesslich zu `de` — im Franzoesischen und Englischen waeren beide
 * schlicht falsch.
 */
const JE_SPRACHE: Record<SpellCheckLocale, { rolle: string; regeln: string[] }> = {
  de: {
    rolle: "You are a German spell checker for Swiss business documents.",
    regeln: [
      "Swiss German standard: replace ß with ss.",
      "German nouns are capitalized — fix missing capitalization.",
      'Fix time format (e.g. "08 uhr" -> "08:00 Uhr").',
    ],
  },
  fr: {
    rolle: "Tu es un correcteur orthographique français pour des documents commerciaux suisses.",
    regeln: [
      // Kein `ß`, keine Substantivgrossschreibung — beides waere hier ein Fehler.
      "Restore missing accents (é, è, ê, à, ù, ç) — they are spelling, not decoration.",
      "French capitalization: only proper nouns and sentence starts. Do NOT capitalize common nouns.",
      "Keep the French spacing convention before : ; ! ? as a non-breaking space.",
      'Fix time format (e.g. "08 h" -> "08h00").',
    ],
  },
  en: {
    rolle: "You are an English spell checker for Swiss business documents.",
    regeln: [
      "British English spelling (organisation, colour, -ise).",
      "English capitalization: only proper nouns and sentence starts. Do NOT capitalize common nouns.",
      'Fix time format (e.g. "08 oclock" -> "08:00").',
    ],
  },
};

export const buildSpellCheckSystemPrompt = (locale: SpellCheckLocale): string => {
  const { rolle, regeln } = JE_SPRACHE[locale];
  return [rolle, "Rules:", ...[...regeln, ...GEMEINSAM].map((r) => `- ${r}`)].join("\n");
};
