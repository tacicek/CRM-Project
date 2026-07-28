/**
 * Schutz gegen eine Fehlerart, die im Hellen unsichtbar ist.
 *
 * Die `folk`-Neutraltöne kehren sich im Dunkelmodus um: `folk-ink` ist hell
 * #18181A und dunkel #EDEBE6. Eine feste Vordergrundfarbe tut das nicht.
 * `bg-folk-ink text-white` liest sich hell mit 17:1 und dunkel mit **1.2:1** —
 * die Schaltfläche verschwindet.
 *
 * Wer im Hellen entwickelt, bemerkt das nie. Deshalb prüft ein Test diese
 * Paarung über den gesamten Quelltext, statt sich auf Sichtprüfung zu verlassen.
 *
 * Richtig ist die Gegenfarbe aus derselben Palette: `text-folk-bg` kippt
 * zusammen mit `folk-ink` und hält in beiden Themes über 15:1.
 */

/** Tokens, deren Helligkeit sich zwischen den Themes umkehrt. */
const INVERTING_BACKGROUNDS = [
  "folk-ink",
  "folk-ink2",
  "folk-ink3",
  "folk-ink4",
  "folk-ink5",
  "folk-bg",
  "folk-bg-warm",
  "folk-card",
  "folk-sidebar",
] as const;

/** Vordergrundfarben, die sich NICHT mit dem Theme ändern. */
const FIXED_FOREGROUNDS = /\btext-(white|black)\b/;

const BACKGROUND_TOKEN = /\bbg-(folk-[a-z0-9-]+)\b/g;

export type ThemeGuardHit = {
  /** 1-basierte Zeilennummer. */
  line: number;
  /** Die invertierenden Hintergrund-Tokens dieser Zeile. */
  backgrounds: string[];
};

/**
 * Findet Zeilen, die eine feste Vordergrundfarbe mit einem invertierenden
 * Hintergrund kombinieren.
 *
 * Rein: nimmt Quelltext, gibt Treffer zurück. Der Test reicht die Dateien herein.
 */
export const findFixedForegroundOnInvertingBackground = (source: string): ThemeGuardHit[] => {
  const hits: ThemeGuardHit[] = [];

  source.split("\n").forEach((line, index) => {
    if (!FIXED_FOREGROUNDS.test(line)) return;

    const backgrounds = [...line.matchAll(BACKGROUND_TOKEN)]
      .map((match) => match[1])
      .filter((token) => (INVERTING_BACKGROUNDS as readonly string[]).includes(token));

    if (backgrounds.length > 0) hits.push({ line: index + 1, backgrounds });
  });

  return hits;
};
