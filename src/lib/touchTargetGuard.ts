/**
 * Schutz gegen eine Fehlerart, die am Rechner unsichtbar ist.
 *
 * `index.css` vergibt auf Touch-Geraeten Mindestgroessen fuer Bedienelemente und
 * nimmt Fliesstext-Links davon wieder aus — ein Link mitten im Satz ist kein
 * Ziel, das man mit dem Daumen sucht. Diese Ausnahme ist ein Elementselektor
 * mit mehreren `:not()` und waegt damit (0,2,1); eine Utility-Klasse waegt
 * (0,1,0). Ohne ausdruecklichen Schutz gewinnt die Ausnahme gegen jedes
 * `min-h-*`, und auf dem Telefon verliert JEDER `<a>` seine Hoehe: Menuezeilen
 * fallen auf Texthoehe zusammen, die Ziele der unteren Leiste ebenso.
 *
 * Wer am Rechner entwickelt, bemerkt das nie — `pointer: coarse` trifft dort
 * nicht zu, auch nicht im verkleinerten Fenster. Genau deshalb prueft ein Test
 * die Regel, statt sich auf Sichtpruefung zu verlassen.
 *
 * Richtig ist, die Ausnahme um die Faelle zu verengen, die sie nie meinte:
 * `a:not(…):not([class*="min-h-"])` laesst einen Link, der seine Hoehe selbst
 * angibt, in Ruhe.
 */

/** Welche Eigenschaft zurueckgesetzt wird und welcher Schutz dazugehoert. */
const RESETS = [
  { property: "min-height", guard: "min-h-" },
  { property: "min-width", guard: "min-w-" },
] as const;

export type TouchResetHit = {
  /** Der Selektor, der ohne Schutz zuruecksetzt. */
  selector: string;
  /** Die Eigenschaft, die er zuruecksetzt. */
  property: (typeof RESETS)[number]["property"];
};

/**
 * Den Rumpf eines `@media (pointer: coarse)`-Blocks herausschneiden.
 *
 * Ueber Klammernzaehlung und nicht per regulaerem Ausdruck: der Block enthaelt
 * verschachtelte Regeln, und ein nicht-gieriges `{…}` bricht an der ersten
 * inneren schliessenden Klammer ab.
 */
const coarseBloecke = (css: string): string[] => {
  const bloecke: string[] = [];
  const start = /@media[^{]*\(\s*pointer\s*:\s*coarse\s*\)[^{]*\{/g;

  let treffer: RegExpExecArray | null;
  while ((treffer = start.exec(css)) !== null) {
    let tiefe = 1;
    let i = treffer.index + treffer[0].length;
    const von = i;
    while (i < css.length && tiefe > 0) {
      if (css[i] === "{") tiefe += 1;
      else if (css[i] === "}") tiefe -= 1;
      i += 1;
    }
    bloecke.push(css.slice(von, i - 1));
  }
  return bloecke;
};

/** Eine Regel, wie sie in einem Block steht. */
type Regel = { selector: string; body: string };

const regeln = (block: string): Regel[] => {
  const gefunden: Regel[] = [];
  const muster = /([^{}]+)\{([^{}]*)\}/g;

  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(block)) !== null) {
    gefunden.push({ selector: treffer[1].trim(), body: treffer[2] });
  }
  return gefunden;
};

/** Zielt der Selektor auf Links? */
const trifftLinks = (selector: string) =>
  selector.split(",").some((teil) => /(^|[\s>+~])a(?![\w-])/.test(teil.trim()));

/**
 * Regeln, die auf Touch-Geraeten die Mindestgroesse von Links aufheben, ohne
 * Links auszunehmen, die sie selbst angeben.
 *
 * Leeres Ergebnis heisst: eine `min-h-*`-Klasse an einem `<a>` wirkt auf dem
 * Telefon so, wie sie dasteht.
 */
export const findUnguardedTouchResets = (css: string): TouchResetHit[] => {
  const treffer: TouchResetHit[] = [];

  for (const block of coarseBloecke(css)) {
    for (const regel of regeln(block)) {
      if (!trifftLinks(regel.selector)) continue;

      for (const { property, guard } of RESETS) {
        // Nur das Aufheben ist gefaehrlich. `min-height: 44px` vergroessert und
        // kann keine Zeile flachdruecken.
        const hebtAuf = new RegExp(`${property}\\s*:\\s*(auto|0)\\b`).test(regel.body);
        if (!hebtAuf) continue;

        if (!regel.selector.includes(`[class*="${guard}"]`) && !regel.selector.includes(`[class*=${guard}]`)) {
          treffer.push({ selector: regel.selector, property });
        }
      }
    }
  }

  return treffer;
};
