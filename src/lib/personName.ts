/**
 * Zusammengesetzte Personennamen trennen und wieder zusammensetzen.
 *
 * Dieser Rueckfall faellt NUR bei Datensaetzen an, die den Namen in EINEM Feld
 * fuehren — `auftraege.customer_name` bei Zeilen von vor dem 2026-07-28 und
 * `besichtigung`-Sitzungen. Neue Schreibwege tragen Vor- und Nachname getrennt
 * (Migration 20260728120000), dort wird hier nichts geraten.
 *
 * Warum das ueberhaupt eine eigene Datei ist: bis 2026-07-28 stand die Trennung
 * dreimal im Code, jedes Mal als `split(" ")[0]`. Damit wurde aus
 * "Anna Maria von Gunten" der Vorname "Anna" und der Nachname
 * "Maria von Gunten". Der Fehler war nicht die Regel, sondern dass es drei
 * verschiedene gab.
 */

/**
 * Namenszusaetze, die zum Nachnamen gehoeren. Bewusst kurz gehalten und auf den
 * schweizerischen Alltag zugeschnitten (de/fr/it + nl-Formen, die hier vorkommen).
 */
const NAMENSZUSAETZE = new Set([
  "von", "van", "de", "del", "della", "der", "den", "des", "du", "da", "di",
  "le", "la", "ten", "ter", "zu", "zum", "zur", "vom", "of", "af", "dos", "das",
]);

export type PersonName = { first: string; last: string };

/**
 * "Mueller, Anna Maria"    → { first: "Anna Maria", last: "Mueller" }
 * "Anna Maria von Gunten"  → { first: "Anna Maria", last: "von Gunten" }
 * "Anna Mueller"           → { first: "Anna",       last: "Mueller" }
 * "Mueller"                → { first: "",           last: "Mueller" }
 * ""                       → { first: "",           last: "" }
 *
 * Ein einzelnes Wort gilt als NACHNAME, nicht als Vorname: in Belegen steht
 * dort im Zweifel der Familien- oder Firmenname.
 */
export const splitPersonName = (full: string | null | undefined): PersonName => {
  const text = (full ?? "").trim().replace(/\s+/g, " ");
  if (!text) return { first: "", last: "" };

  // "Nachname, Vorname" — die eindeutige Form, sie hat Vorrang.
  const komma = text.indexOf(",");
  if (komma > 0) {
    return {
      first: text.slice(komma + 1).trim(),
      last: text.slice(0, komma).trim(),
    };
  }

  const teile = text.split(" ");
  if (teile.length === 1) return { first: "", last: teile[0] };

  // Der Nachname beginnt beim ersten Namenszusatz — "von Gunten" bleibt zusammen.
  // Steht der Zusatz ganz vorne ("Von Allmen"), ist das kein Zusatz, sondern der
  // Name selbst; deshalb erst ab Position 1 suchen.
  const zusatz = teile.findIndex((t, i) => i > 0 && NAMENSZUSAETZE.has(t.toLowerCase()));
  const schnitt = zusatz > 0 ? zusatz : teile.length - 1;

  return {
    first: teile.slice(0, schnitt).join(" "),
    last: teile.slice(schnitt).join(" "),
  };
};

/**
 * Anzeigename aus getrennten Feldern. Leere Teile erzeugen KEIN doppeltes
 * Leerzeichen und keinen fuehrenden/nachfolgenden Rand.
 */
export const joinPersonName = (
  first?: string | null,
  last?: string | null,
): string =>
  [first, last]
    .map((teil) => (teil ?? "").trim())
    .filter(Boolean)
    .join(" ");
