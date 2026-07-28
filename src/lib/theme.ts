/**
 * Reine Theme-Logik — ohne React und ohne DOM, damit sie nach Projektregel
 * (CLAUDE.md §9) testbar bleibt. Der Provider in `@/hooks/useTheme` ist nur
 * die Hülle, die diese Funktionen an React und `localStorage` anbindet.
 */

/** Was der Benutzer gewählt hat. */
export type ThemePreference = "light" | "dark" | "system";

/** Was tatsächlich gilt — nur das darf eine Komponente zum Vergleich benutzen. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "crm:theme";

const PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

/**
 * Liest einen gespeicherten Wert. Alles Unbekannte wird zu "system" — ein
 * beschädigter localStorage-Eintrag darf die Oberfläche nicht blockieren.
 */
export const parseThemePreference = (raw: string | null): ThemePreference =>
  PREFERENCES.find((candidate) => candidate === raw) ?? "system";

/**
 * `systemPrefersDark` kommt vom Aufrufer (Media Query), nicht von hier —
 * sonst wäre die Funktion nicht mehr rein.
 */
export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme => {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
};
