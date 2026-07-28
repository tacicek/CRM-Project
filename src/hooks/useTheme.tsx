import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  /** Was der Benutzer gewählt hat — inklusive "system". */
  theme: ThemePreference;
  /**
   * Was tatsächlich gilt. **Nur dieser Wert darf verglichen werden.**
   * `theme === "dark"` ist bei der Wahl "system" immer falsch und liefert auf
   * einem dunkel eingestellten Gerät die helle Darstellung.
   */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Grundfarben für die Statusleiste — dieselben Werte wie --folk-bg. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#FBFAF7",
  dark: "#121110",
};

const readStoredPreference = (): ThemePreference => {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // localStorage kann gesperrt sein (privater Modus, Richtlinie).
    return "system";
  }
};

const readSystemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;

/**
 * Hält das Erscheinungsbild der Operator-Oberfläche.
 *
 * Sitzt bewusst INNERHALB von FirmaRouteWrapper — genau wie I18nProvider und
 * aus demselben Grund: kundenseitige Seiten (/offerte/:token, /portal,
 * /termin/*) liegen ausserhalb und dürfen sich nicht nach einer Einstellung
 * des Operators richten. Beim Verlassen von /firma wird das Attribut entfernt.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(readSystemPrefersDark);

  // Nur horchen, solange die Wahl "system" ist — sonst ist die Media Query egal.
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    query.addEventListener("change", onChange);
    setSystemPrefersDark(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const resolvedTheme = resolveTheme(theme, systemPrefersDark);

  // `color-scheme` wird NICHT hier gesetzt, sondern in index.css am
  // :root-Block je Theme — sonst gäbe es zwei Quellen für denselben Wert,
  // und die Inline-Variante würde das Stylesheet stumm überstimmen.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);

    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", THEME_COLOR[resolvedTheme]);

    return () => {
      root.removeAttribute("data-theme");
      meta?.setAttribute("content", THEME_COLOR.light);
    };
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Gesperrter Speicher darf das Umschalten nicht verhindern —
      // die Wahl gilt dann nur für diese Sitzung.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme muss innerhalb von ThemeProvider stehen");
  return context;
};
