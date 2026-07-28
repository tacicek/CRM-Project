/**
 * Die drei Bereiche der Shell. Die Grenzen stammen aus der Mobil-Vorlage und
 * gelten für Verhalten (Sheets, Gesten). Das Layout selbst läuft über
 * CSS-Media-Queries — dieselben Zahlen, andere Stelle.
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

/** Ab hier weicht die Seitenleiste einer Icon-Leiste. */
export const BREAKPOINT_TABLET_MIN = 820;

/** Ab hier steht die volle Seitenleiste. */
export const BREAKPOINT_DESKTOP_MIN = 1100;

export const resolveBreakpoint = (width: number): Breakpoint => {
  if (width >= BREAKPOINT_DESKTOP_MIN) return "desktop";
  if (width >= BREAKPOINT_TABLET_MIN) return "tablet";
  return "mobile";
};
