import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SIGNED_URL_TTL_SECONDS, signPhotoUrls, type PhotoRef } from "../besichtigungPhotoUrls";

const foto = (id: string, pfad = `tok/raum/${id}.jpg`): PhotoRef => ({ id, storage_path: pfad });
const gelingt = (url: string) => ({ data: { signedUrl: url }, error: null });

describe("signPhotoUrls", () => {
  it("signiert jedes noch unbekannte Foto und gibt nur die neuen zurueck", async () => {
    const sign = vi.fn(async (p: string) => gelingt(`https://s/${p}?sig=x`));
    const urls = await signPhotoUrls([foto("a"), foto("b")], {}, sign);

    expect(urls).toEqual({
      a: "https://s/tok/raum/a.jpg?sig=x",
      b: "https://s/tok/raum/b.jpg?sig=x",
    });
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("fragt bereits bekannte Fotos nicht erneut an", async () => {
    const sign = vi.fn(async (p: string) => gelingt(`https://s/${p}`));
    const urls = await signPhotoUrls([foto("a"), foto("b")], { a: "https://alt/a" }, sign);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith("tok/raum/b.jpg", SIGNED_URL_TTL_SECONDS);
    // Die bekannte Adresse wird nicht mitgeliefert — der Aufrufer fuehrt sie schon.
    expect(Object.keys(urls)).toEqual(["b"]);
  });

  it("ruft ohne offene Fotos gar nicht an", async () => {
    const sign = vi.fn(async () => gelingt("https://s/x"));
    expect(await signPhotoUrls([], {}, sign)).toEqual({});
    expect(await signPhotoUrls([foto("a")], { a: "da" }, sign)).toEqual({});
    expect(sign).not.toHaveBeenCalled();
  });

  it("reicht immer die vereinbarte Lebensdauer durch", async () => {
    const sign = vi.fn(async (_pfad: string, _ttl: number) => gelingt("https://s/x"));
    await signPhotoUrls([foto("a")], {}, sign);
    expect(sign.mock.calls[0][1]).toBe(SIGNED_URL_TTL_SECONDS);
  });

  it("haelt die Lebensdauer in einem Rahmen, der beides erfuellt", () => {
    // Lang genug zum Durchsehen, kurz genug, dass ein weitergereichter Link
    // kein Dauerzugang wird. Der Test haelt die Absicht fest, nicht die Zahl.
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60);
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });
});

describe("signPhotoUrls — fail-closed", () => {
  it("laesst ein Foto aus, wenn die Signatur einen Fehler meldet", async () => {
    const sign = async () => ({ data: null, error: new Error("nicht erlaubt") });
    expect(await signPhotoUrls([foto("a")], {}, sign)).toEqual({});
  });

  it("laesst ein Foto aus, wenn die Signatur leer zurueckkommt", async () => {
    for (const antwort of [
      { data: null, error: null },
      { data: { signedUrl: "" }, error: null },
    ]) {
      expect(await signPhotoUrls([foto("a")], {}, async () => antwort)).toEqual({});
    }
  });

  it("laesst ein Foto aus, wenn das Signieren wirft", async () => {
    const sign = async () => {
      throw new Error("Netz weg");
    };
    await expect(signPhotoUrls([foto("a")], {}, sign)).resolves.toEqual({});
  });

  it("ein Fehlschlag nimmt die uebrigen Fotos nicht mit", async () => {
    const sign = async (p: string) =>
      p.includes("b") ? { data: null, error: new Error("nein") } : gelingt(`https://s/${p}`);

    const urls = await signPhotoUrls([foto("a"), foto("b"), foto("c")], {}, sign);
    expect(Object.keys(urls).sort()).toEqual(["a", "c"]);
  });

  it("ueberspringt Fotos ohne Pfad, statt einen leeren zu signieren", async () => {
    const sign = vi.fn(async () => gelingt("https://s/x"));
    const urls = await signPhotoUrls([{ id: "a", storage_path: "" }], {}, sign);

    expect(sign).not.toHaveBeenCalled();
    expect(urls).toEqual({});
  });

  it("erfindet bei einem Fehlschlag keinen Ersatz", async () => {
    const urls = await signPhotoUrls([foto("a")], {}, async () => ({
      data: null,
      error: new Error("nein"),
    }));
    // Kein Platzhalter, kein leerer String, kein Schluessel mit undefined:
    // ein Foto ohne Adresse existiert fuer die Oberflaeche nicht.
    expect(Object.prototype.hasOwnProperty.call(urls, "a")).toBe(false);
  });
});

// ── Die Aufrufstellen ───────────────────────────────────────────────────────
//
// Der private Bucket nuetzt nichts, wenn irgendwo noch eine dauerhaft
// oeffentliche Adresse erzeugt wird. Geprueft wird am Quelltext beider Leser.

describe("besichtigung-uploads — kein Leser erzeugt mehr dauerhafte Adressen", () => {
  const lies = (p: string): string => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

  const LESER = [
    "src/pages/firma/Besichtigungen.tsx",
    "supabase/functions/analyze-besichtigung/index.ts",
  ];

  it.each(LESER)("%s signiert und veroeffentlicht nicht", (pfad) => {
    const quelle = lies(pfad);
    expect(quelle).toContain("createSignedUrl");
    // Das Wort steht in keinem der beiden Kommentare — ein Treffer waere also
    // echter Programmtext.
    expect(quelle).not.toContain("getPublicUrl");
  });

  it("die Oberflaeche geht ueber den gepruesten Helfer", () => {
    expect(lies(LESER[0])).toContain("signPhotoUrls(");
  });

  it("kein weiterer Leser im Baum", () => {
    // Die uebrigen Stellen, die den Bucket nennen, sind Schreiber auf
    // service_role (hochladen, loeschen, aufraeumen). Faellt hier etwas auf,
    // ist ein Leser dazugekommen, den niemand umgestellt hat.
    for (const pfad of [
      "supabase/functions/upload-besichtigung-photo/index.ts",
      "supabase/functions/delete-besichtigung-photo/index.ts",
      "supabase/functions/cleanup-besichtigung/index.ts",
    ]) {
      expect(lies(pfad), pfad).not.toContain("getPublicUrl");
    }
  });
});
