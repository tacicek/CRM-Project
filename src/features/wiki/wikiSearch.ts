/**
 * Wiki search: small, dependency-free, and deliberately forgiving.
 *
 * The people this manual is written for do not know the app's vocabulary. Someone
 * looking for "Offerte" will type "Angebot"; someone looking for "Wiedervorlage" will
 * type "Aufgabe". Searching only the exact words the UI uses would fail precisely the
 * reader who needs help most, so titles, summaries, keywords and a synonym table are
 * all searched.
 */
import type { Locale } from "@/i18n/locale";
import type { WikiSlug } from "@/features/wiki/wikiSlugs";
import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";

/**
 * Fold a string to a comparable form.
 *
 * German needs *both* folds and they disagree: Unicode decomposition turns "Rückgabe"
 * into "Ruckgabe", while a German typist expects "Rueckgabe" to match too. So the
 * transliteration runs first (ü→ue, ß→ss), then NFD strips whatever accents remain —
 * which is what covers French "créé" → "cree". Doing only one of the two loses half
 * the matches.
 */
export const normalizeForSearch = (input: string): string =>
  input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Split a query into normalized terms, dropping single characters as noise. */
export const tokenize = (input: string): readonly string[] =>
  normalizeForSearch(input)
    .split(" ")
    .filter((term) => term.length > 1);

/**
 * Words that mean the same thing to an operator, grouped.
 *
 * A hit through a synonym scores lower than a direct hit (see SYNONYM_PENALTY): the
 * article that literally says "Offerte" should still outrank one that only mentions
 * "Angebot" in passing.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["offerte", "angebot", "offre", "offer", "quote", "kostenvoranschlag"],
  ["auftrag", "job", "mandat", "order", "auftraege"],
  ["nachtrag", "zusatz", "avenant", "amendment", "supplement"],
  ["rechnung", "invoice", "facture", "faktura"],
  ["quittung", "beleg", "recu", "receipt", "quittance"],
  ["zahlung", "payment", "paiement", "geld", "bezahlen"],
  ["mahnung", "erinnerung", "rappel", "reminder", "dunning"],
  ["kunde", "customer", "client", "kontakt", "contact", "kunden"],
  ["anfrage", "lead", "demande", "request", "interessent"],
  ["aufgabe", "wiedervorlage", "task", "tache", "todo", "erinnerung"],
  ["termin", "appointment", "rendez vous", "kalender", "calendar", "calendrier"],
  ["besichtigung", "inspection", "visite", "vorbesichtigung"],
  ["fall", "faelle", "reklamation", "schaden", "complaint", "case", "reclamation"],
  ["posteingang", "inbox", "nachricht", "message", "email", "e mail", "courriel"],
  ["kennzahl", "kennzahlen", "kpi", "statistik", "auswertung", "report", "rapport"],
  ["einstellung", "einstellungen", "settings", "parametres", "konfiguration"],
  ["sprache", "language", "langue", "uebersetzung", "translation"],
  ["anmelden", "login", "einloggen", "connexion", "sign in", "passwort", "password"],
  ["rolle", "rollen", "recht", "rechte", "permission", "role", "berechtigung"],
  ["archiv", "export", "loeschen", "datenschutz", "archive", "purge"],
  ["portal", "kundenportal", "kundenbereich", "espace client"],
  ["checkliste", "checklist", "liste de controle"],
  ["team", "mitarbeiter", "equipe", "personal", "fahrzeug"],
  ["preis", "preise", "preisgestaltung", "tarif", "pricing", "prix"],
  ["leistung", "leistungen", "katalog", "service", "prestation"],
  ["uebersicht", "dashboard", "startseite", "home", "accueil", "overview"],
];

/** term → the group's other members, precomputed once. */
const SYNONYM_LOOKUP: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      const key = normalizeForSearch(word);
      const others = group.map(normalizeForSearch).filter((w) => w !== key);
      map.set(key, [...(map.get(key) ?? []), ...others]);
    }
  }
  return map;
})();

export const synonymsFor = (term: string): readonly string[] =>
  SYNONYM_LOOKUP.get(normalizeForSearch(term)) ?? [];

// --- scoring ---------------------------------------------------------------------

const SCORE_TITLE_EXACT = 100;
const SCORE_TITLE_PREFIX = 60;
const SCORE_TITLE_PARTIAL = 30;
const SCORE_KEYWORD_EXACT = 45;
const SCORE_KEYWORD_PARTIAL = 18;
const SCORE_SUMMARY_PARTIAL = 12;
/** Every extra query term that also matched. Rewards "rechnung stornieren" over "rechnung". */
const SCORE_ALL_TERMS_BONUS = 25;
/** A synonym hit is worth 80% of the direct hit it stands in for. */
const SYNONYM_PENALTY = 0.8;

export interface WikiSearchResult {
  slug: WikiSlug;
  score: number;
  /** Short context line shown under the title in the result list. */
  excerpt: string;
}

interface ScoredField {
  title: string;
  summary: string;
  keywords: readonly string[];
}

/** Score one article against one already-normalized term. */
const scoreTerm = (fields: ScoredField, term: string): number => {
  const title = normalizeForSearch(fields.title);
  const summary = normalizeForSearch(fields.summary);

  let best = 0;
  if (title === term) best = SCORE_TITLE_EXACT;
  else if (title.startsWith(term)) best = SCORE_TITLE_PREFIX;
  else if (title.includes(term)) best = SCORE_TITLE_PARTIAL;

  for (const keyword of fields.keywords) {
    const normalized = normalizeForSearch(keyword);
    if (normalized === term) best = Math.max(best, SCORE_KEYWORD_EXACT);
    else if (normalized.includes(term)) best = Math.max(best, SCORE_KEYWORD_PARTIAL);
  }

  if (best === 0 && summary.includes(term)) best = SCORE_SUMMARY_PARTIAL;
  return best;
};

/**
 * Rank articles for a query.
 *
 * `allowed` is the set of slugs the operator may see (module filtering), passed in
 * rather than read from `MODULES` so the function stays pure and testable.
 */
export const searchWiki = (
  query: string,
  index: WikiSearchIndex,
  allowed: readonly WikiSlug[],
  limit = 12,
): readonly WikiSearchResult[] => {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const results: WikiSearchResult[] = [];

  for (const slug of allowed) {
    const entry = index[slug];
    if (!entry) continue;

    let total = 0;
    let matchedTerms = 0;

    for (const term of terms) {
      const direct = scoreTerm(entry, term);
      let termScore = direct;

      if (direct === 0) {
        for (const synonym of synonymsFor(term)) {
          const viaSynonym = scoreTerm(entry, synonym) * SYNONYM_PENALTY;
          if (viaSynonym > termScore) termScore = viaSynonym;
        }
      }

      if (termScore > 0) matchedTerms += 1;
      total += termScore;
    }

    if (total === 0) continue;
    if (matchedTerms === terms.length && terms.length > 1) total += SCORE_ALL_TERMS_BONUS;

    results.push({ slug, score: Math.round(total), excerpt: entry.summary });
  }

  // Ties break on slug so the order is stable across renders and across machines.
  return results
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, limit);
};

/** Locale is not used for ranking today; the parameter documents that the index is per-locale. */
export type WikiSearchLocale = Locale;
