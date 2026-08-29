import { describe, expect, it } from "vitest";
import {
  findeBedienerspracheInKundenrenderern,
  kundenflaechen,
  vorhandeneKundenflaechen,
} from "../kundenrenderer-sprache";

describe("Kundengerichtete Renderer", () => {
  it("lesen die Sprache des Bedieners nicht", () => {
    const funde = findeBedienerspracheInKundenrenderern();
    expect(
      funde.map((f) => `${f.datei}:${f.zeile} — ${f.erklaerung}\n    ${f.text}`),
    ).toEqual([]);
  });

  it("die geschützte Liste zeigt nicht ins Leere", () => {
    // Ein Tor, dessen Pfade nicht mehr existieren, ist gruen und wertlos.
    expect(vorhandeneKundenflaechen()).toEqual(kundenflaechen());
  });
});
