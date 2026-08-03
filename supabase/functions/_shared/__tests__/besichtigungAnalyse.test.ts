import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bereiteAnalyseVor, type SignaturErgebnis } from "../besichtigungAnalyse.ts";

const RAEUME = { kueche: "Küche", bad: "Badezimmer", sonstiges: "Sonstiges" };

const ok = (id: string, raum: string | null = "kueche"): SignaturErgebnis => ({
  photoId: id,
  roomType: raum,
  signedUrl: `https://s/${id}?sig=x`,
});
const fehlt = (id: string, raum: string | null = "kueche"): SignaturErgebnis => ({
  photoId: id,
  roomType: raum,
  signedUrl: null,
});

describe("bereiteAnalyseVor — die Entscheidung", () => {
  it("gibt frei, sobald ein einziges Foto signiert ist", () => {
    const e = bereiteAnalyseVor([fehlt("a"), ok("b"), fehlt("c")], RAEUME, "Sonstiges");
    expect(e.darfAnalyseBeginnen).toBe(true);
    expect(e.bilder).toHaveLength(1);
  });

  it("gibt NICHT frei, wenn keine einzige Signatur gelang", () => {
    // Der eigentliche Befund: frueher sprang die Sitzung hier schon auf
    // 'analyzing' und blieb dort fuer immer stehen.
    const e = bereiteAnalyseVor([fehlt("a"), fehlt("b")], RAEUME, "Sonstiges");
    expect(e.darfAnalyseBeginnen).toBe(false);
    expect(e.bilder).toEqual([]);
    expect(e.uebersprungen).toEqual(["a", "b"]);
  });

  it("gibt NICHT frei, wenn es gar keine Fotos gab", () => {
    const e = bereiteAnalyseVor([], RAEUME, "Sonstiges");
    expect(e.darfAnalyseBeginnen).toBe(false);
    expect(e.bilder).toEqual([]);
    expect(e.raeume).toEqual([]);
  });
});

describe("bereiteAnalyseVor — Bilder und Raeume", () => {
  it("baut die Bildstruktur, die die API erwartet", () => {
    expect(bereiteAnalyseVor([ok("a")], RAEUME, "Sonstiges").bilder).toEqual([
      { type: "image", source: { type: "url", url: "https://s/a?sig=x" } },
    ]);
  });

  it("haelt Raumnamen streng parallel zur Bildliste", () => {
    // Wuerden die Listen getrennt gefuehrt, verschoebe ein ausgelassenes Foto
    // alle folgenden Zuordnungen — die Kueche kaeme als Bad beim Modell an.
    const e = bereiteAnalyseVor(
      [ok("a", "kueche"), fehlt("b", "bad"), ok("c", "bad")],
      RAEUME,
      "Sonstiges",
    );
    expect(e.bilder).toHaveLength(2);
    expect(e.raeume).toEqual(["Küche", "Badezimmer"]);
    expect(e.bilder.map((b) => b.source.url)).toEqual(["https://s/a?sig=x", "https://s/c?sig=x"]);
  });

  it("faellt auf den Standardraum zurueck, wenn der Typ unbekannt oder leer ist", () => {
    const e = bereiteAnalyseVor([ok("a", "dachterrasse"), ok("b", null)], RAEUME, "Sonstiges");
    expect(e.raeume).toEqual(["Sonstiges", "Sonstiges"]);
  });

  it("meldet die ausgelassenen Fotos namentlich", () => {
    const e = bereiteAnalyseVor([ok("a"), fehlt("b"), fehlt("c")], RAEUME, "Sonstiges");
    expect(e.uebersprungen).toEqual(["b", "c"]);
  });

  it("aendert am geglueckten Fall nichts", () => {
    const e = bereiteAnalyseVor([ok("a", "kueche"), ok("b", "bad")], RAEUME, "Sonstiges");
    expect(e).toEqual({
      bilder: [
        { type: "image", source: { type: "url", url: "https://s/a?sig=x" } },
        { type: "image", source: { type: "url", url: "https://s/b?sig=x" } },
      ],
      raeume: ["Küche", "Badezimmer"],
      uebersprungen: [],
      darfAnalyseBeginnen: true,
    });
  });
});

// ── Die Reihenfolge im Aufrufer ─────────────────────────────────────────────
//
// Die Datei laedt hier nicht (Deno-Globals, `https://`-Importe). Geprueft wird
// an der Reihenfolge der Textstellen — sie ist der ganze Punkt dieser Runde.

describe("analyze-besichtigung — Status erst nach geglueckter Signatur", () => {
  const quelle = readFileSync(
    new URL("../../analyze-besichtigung/index.ts", import.meta.url),
    "utf8",
  );

  it("setzt den Status NACH dem Signieren", () => {
    const signieren = quelle.indexOf("createSignedUrl");
    const status = quelle.indexOf('p_status: "analyzing"');
    expect(signieren).toBeGreaterThan(-1);
    expect(status).toBeGreaterThan(-1);
    expect(status).toBeGreaterThan(signieren);
  });

  it("setzt den Status NACH der Freigabeentscheidung", () => {
    const entscheidung = quelle.indexOf("if (!darfAnalyseBeginnen)");
    const status = quelle.indexOf('p_status: "analyzing"');
    expect(entscheidung).toBeGreaterThan(-1);
    expect(status).toBeGreaterThan(entscheidung);
  });

  it("prueft den Fehler des Status-RPC", () => {
    expect(quelle).toContain("error: statusError");
    expect(quelle).toContain("if (statusError)");
  });

  it("faengt einen geworfenen Signaturfehler ab, statt den Lauf abzubrechen", () => {
    const signieren = quelle.indexOf("createSignedUrl");
    expect(quelle.slice(0, signieren)).toContain("try {");
  });

  it("benutzt den geprueften Entscheidungskern statt einer eigenen Zaehlung", () => {
    expect(quelle).toContain("bereiteAnalyseVor(");
  });
});
