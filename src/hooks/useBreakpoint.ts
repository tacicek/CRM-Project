import { useEffect, useState } from "react";
import { resolveBreakpoint, type Breakpoint } from "@/lib/breakpoints";

const readWidth = (): number => (typeof window === "undefined" ? 0 : window.innerWidth);

/**
 * Liefert den aktuellen Shell-Bereich für VERHALTEN — welches Sheet sich
 * öffnet, ob eine Wischgeste aktiv ist.
 *
 * Nicht für Layout benutzen: Breiten und Spalten laufen über
 * CSS-Media-Queries. Würde das Layout an diesem Hook hängen, flackerte die
 * Shell beim ersten Render und bräche beim Vorab-Rendern
 * (scripts/prerender.mjs), wo es kein `window` gibt.
 */
export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => resolveBreakpoint(readWidth()));

  useEffect(() => {
    const onResize = () => setBreakpoint(resolveBreakpoint(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return breakpoint;
};
