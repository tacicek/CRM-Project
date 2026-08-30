import { describe, expect, it } from "vitest";
import {
  BEZAHLTE_ENDPUNKTE,
  GEMEINSAME_DATEIEN,
  gemeinsameQuelle,
  pruefeAlleEndpunkte,
  pruefeEndpunkt,
  quelle,
} from "../paid-endpoint-guard";

describe("Tor fuer die bezahlten Google-Endpunkte", () => {
  it("die drei echten Endpunkte sind sauber", () => {
    expect(
      pruefeAlleEndpunkte().map((v) => `${v.endpunkt} · ${v.art}\n    ${v.detail}`).join("\n"),
    ).toBe("");
  });

  it("die gemeinsame Ablaufdatei wird mitgeprueft", () => {
    // Sie traegt alle Protokollaufrufe und den einzigen Google-fetch.
    expect(GEMEINSAME_DATEIEN).toContain("_shared/paidApiHttp.ts");
    expect(gemeinsameQuelle("_shared/paidApiHttp.ts").length).toBeGreaterThan(500);
  });

  it("es prueft ueberhaupt drei Dateien", () => {
    expect(BEZAHLTE_ENDPUNKTE).toHaveLength(3);
    for (const e of BEZAHLTE_ENDPUNKTE) expect(quelle(e).length).toBeGreaterThan(500);
  });

  const basis = `
import { bearbeitePaidApiAnfrage } from "../_shared/paidApiHttp.ts";
serve((req) => bearbeitePaidApiAnfrage(req, vertrag, umgebung()));
`;

  it.each([
    ["Modulzaehler als Drossel", `const zaehler = new Map();\n${basis}`, "modulzaehler-als-drossel"],
    ["console.log", `console.log("x");\n${basis}`, "console-log"],
    ["Kundeninhalt im Protokoll", `${basis}\nlog("x", { origin: o });`, "kundeninhalt-im-protokoll"],
    ["direkter Google-fetch", `${basis}\nawait fetch("https://maps.googleapis.com/x");`, "google-fetch-ausserhalb-des-ablaufs"],
    ["ohne gemeinsamen Ablauf", `serve((req) => new Response("x"));`, "kein-gemeinsamer-ablauf"],
  ])("weist ab: %s", (_n, code, art) => {
    expect(pruefeEndpunkt("probe", code).map((v) => v.art)).toContain(art);
  });

  it("ein Kommentar, der den alten Fehler beschreibt, ist kein Verstoss", () => {
    const mitErklaerung = `
// Frueher stand hier eine \`new Map()\` als Drossel und ein console.log mit origin.
${basis}`;
    expect(pruefeEndpunkt("probe", mitErklaerung)).toEqual([]);
  });
});
