import type { FirmaNavItem } from "@/config/firmaNav";

/**
 * Die Einträge der Tab-Leiste — abgeleitet, nie von Hand gelistet.
 *
 * `modules` wird hereingereicht statt importiert, damit die Funktion rein
 * bleibt und ein abgeschaltetes Modul testbar ist.
 */
export const selectTabItems = (
  quickLinks: readonly FirmaNavItem[],
  modules: Record<string, boolean>,
): FirmaNavItem[] =>
  quickLinks.filter(
    (item) =>
      item.mobileTab === true &&
      (item.moduleKey === null || modules[item.moduleKey] === true),
  );

/**
 * Welcher Tab ist zur aktuellen Route aktiv?
 *
 * Zwei Fallen, die hier bewusst abgefangen werden:
 *
 *  1. `/firma` ist Präfix jeder anderen Route — es zählt nur bei exakter
 *     Gleichheit, sonst wäre immer die Übersicht markiert.
 *  2. Ein Präfixvergleich auf Zeichenebene würde `/firma/offerten-archiv` dem
 *     Tab `/firma/offerten` zuschlagen. Der Treffer muss an einer
 *     Segmentgrenze enden.
 *
 * Bei mehreren Treffern gewinnt der längste — der spezifischere Tab.
 */
export const findActiveTabUrl = (
  pathname: string,
  tabUrls: readonly string[],
): string | null => {
  const matches = tabUrls.filter((url) =>
    url === "/firma"
      ? pathname === "/firma"
      : pathname === url || pathname.startsWith(`${url}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, url) => (url.length > longest.length ? url : longest));
};
