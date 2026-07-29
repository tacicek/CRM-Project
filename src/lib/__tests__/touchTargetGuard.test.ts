import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findUnguardedTouchResets } from "@/lib/touchTargetGuard";

/** Die Fassung, mit der die Zeilen auf dem Telefon flachgedrueckt wurden. */
const VORHER = `
@media (pointer: coarse) {
  button, a { min-height: 44px; min-width: 44px; }
  a:not(.btn):not([class*="button"]) { min-height: auto; min-width: auto; }
}`;

/** Die Fassung, die eine ausdrueckliche Angabe stehen laesst. */
const NACHHER = `
@media (pointer: coarse) {
  button, a { min-height: 44px; min-width: 44px; }
  a:not(.btn):not([class*="button"]):not([class*="min-h-"]) { min-height: auto; }
  a:not(.btn):not([class*="button"]):not([class*="min-w-"]) { min-width: auto; }
}`;

describe("findUnguardedTouchResets", () => {
  it("meldet die Fassung, die jedes min-h an einem Link aufhob", () => {
    const treffer = findUnguardedTouchResets(VORHER);

    expect(treffer.map((t) => t.property).sort()).toEqual(["min-height", "min-width"]);
  });

  it("laesst die verengte Ausnahme durchgehen", () => {
    expect(findUnguardedTouchResets(NACHHER)).toEqual([]);
  });

  it("stoert sich nicht an Regeln, die vergroessern", () => {
    expect(
      findUnguardedTouchResets("@media (pointer: coarse) { a { min-height: 44px; } }"),
    ).toEqual([]);
  });

  it("sieht nur in den Touch-Block — am Rechner gilt die Regel nicht", () => {
    expect(
      findUnguardedTouchResets("@media (pointer: fine) { a:not(.btn) { min-height: auto; } }"),
    ).toEqual([]);
  });

  it("findet den Block auch mit verschachtelten Regeln darin", () => {
    const css = `
      @media (pointer: coarse) {
        .karte { padding: 1rem; }
        a:not(.btn) { min-height: auto; }
        .fuss { margin: 0; }
      }
      a { color: red; }`;

    expect(findUnguardedTouchResets(css)).toHaveLength(1);
  });

  it("erkennt auch ein Zuruecksetzen auf 0", () => {
    expect(
      findUnguardedTouchResets("@media (pointer: coarse) { a.link { min-height: 0; } }"),
    ).toHaveLength(1);
  });

  it("laesst Regeln in Ruhe, die keine Links treffen", () => {
    expect(
      findUnguardedTouchResets("@media (pointer: coarse) { .avatar { min-height: auto; } }"),
    ).toEqual([]);
  });
});

describe("index.css", () => {
  it("hebt die Mindesthoehe von Links nicht ohne Schutz auf", () => {
    const css = readFileSync("src/index.css", "utf8");

    // Bei einem Treffer verlieren auf dem Telefon alle `<a>` mit `min-h-*` ihre
    // Hoehe — die Zeilen des Mehr-Sheets und die Ziele der unteren Leiste.
    expect(findUnguardedTouchResets(css)).toEqual([]);
  });
});
