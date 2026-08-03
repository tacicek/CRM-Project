import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ABLAUF_PUFFER_SEKUNDEN,
  KEINE_URLS,
  SIGNED_URL_TTL_SECONDS,
  darfUebernehmen,
  sichtbareUrls,
  signPhotoBatch,
  signPhotoUrls,
  verbleibendeGueltigkeitMs,
  type PhotoRef,
  type PhotoUrlBatch,
} from "../besichtigungPhotoUrls";

const foto = (id: string, pfad = `tok/raum/${id}.jpg`): PhotoRef => ({ id, storage_path: pfad });
const gelingt = (url: string) => ({ data: { signedUrl: url }, error: null });

const batch = (ueber: Partial<PhotoUrlBatch> = {}): PhotoUrlBatch => ({
  lauf: 1,
  sessionId: "s1",
  erzeugtUm: 1_000_000,
  urls: { a: "https://s/a" },
  ...ueber,
});

describe("signPhotoUrls", () => {
  it("signiert jedes Foto und gibt die Adressen zurueck", async () => {
    const sign = vi.fn(async (p: string) => gelingt(`https://s/${p}?sig=x`));
    const urls = await signPhotoUrls([foto("a"), foto("b")], sign);

    expect(urls).toEqual({
      a: "https://s/tok/raum/a.jpg?sig=x",
      b: "https://s/tok/raum/b.jpg?sig=x",
    });
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("signiert bei jedem Aufruf neu — es gibt keinen Zwischenspeicher", async () => {
    // Der Kern der Ablaufregel: wuerde eine schon bekannte Adresse
    // wiederverwendet, waere genau sie die, die inzwischen tot sein kann.
    const sign = vi.fn(async (p: string) => gelingt(`https://s/${p}`));
    const fotos = [foto("a"), foto("b")];

    await signPhotoUrls(fotos, sign);
    await signPhotoUrls(fotos, sign);

    expect(sign).toHaveBeenCalledTimes(4);
  });

  it("ruft ohne Fotos gar nicht an", async () => {
    const sign = vi.fn(async () => gelingt("https://s/x"));
    expect(await signPhotoUrls([], sign)).toEqual({});
    expect(sign).not.toHaveBeenCalled();
  });

  it("reicht immer die vereinbarte Lebensdauer durch", async () => {
    const sign = vi.fn(async (_pfad: string, _ttl: number) => gelingt("https://s/x"));
    await signPhotoUrls([foto("a")], sign);
    expect(sign.mock.calls[0][1]).toBe(SIGNED_URL_TTL_SECONDS);
  });

  it("haelt die Lebensdauer in einem Rahmen, der beides erfuellt", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60);
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600);
    // Der Puffer muss echt kleiner sein, sonst waere jede Adresse sofort tot.
    expect(ABLAUF_PUFFER_SEKUNDEN).toBeGreaterThan(0);
    expect(ABLAUF_PUFFER_SEKUNDEN).toBeLessThan(SIGNED_URL_TTL_SECONDS);
  });
});

describe("signPhotoUrls — fail-closed", () => {
  it("laesst ein Foto aus, wenn die Signatur einen Fehler meldet", async () => {
    expect(await signPhotoUrls([foto("a")], async () => ({ data: null, error: new Error("nein") }))).toEqual({});
  });

  it("laesst ein Foto aus, wenn die Signatur leer zurueckkommt", async () => {
    for (const antwort of [
      { data: null, error: null },
      { data: { signedUrl: "" }, error: null },
    ]) {
      expect(await signPhotoUrls([foto("a")], async () => antwort)).toEqual({});
    }
  });

  it("laesst ein Foto aus, wenn das Signieren wirft", async () => {
    await expect(
      signPhotoUrls([foto("a")], async () => {
        throw new Error("Netz weg");
      }),
    ).resolves.toEqual({});
  });

  it("ein Fehlschlag nimmt die uebrigen Fotos nicht mit", async () => {
    const sign = async (p: string) =>
      p.includes("b") ? { data: null, error: new Error("nein") } : gelingt(`https://s/${p}`);

    expect(Object.keys(await signPhotoUrls([foto("a"), foto("b"), foto("c")], sign)).sort()).toEqual(["a", "c"]);
  });

  it("ueberspringt Fotos ohne Pfad, statt einen leeren zu signieren", async () => {
    const sign = vi.fn(async () => gelingt("https://s/x"));
    expect(await signPhotoUrls([{ id: "a", storage_path: "" }], sign)).toEqual({});
    expect(sign).not.toHaveBeenCalled();
  });

  it("erfindet bei einem Fehlschlag keinen Ersatz", async () => {
    const urls = await signPhotoUrls([foto("a")], async () => ({ data: null, error: new Error("nein") }));
    expect(Object.prototype.hasOwnProperty.call(urls, "a")).toBe(false);
  });
});

// ── Der Zeitstempel ─────────────────────────────────────────────────────────

describe("signPhotoBatch — gestempelt wird vor dem Signieren", () => {
  /** Uhr, die bei jedem Ablesen um `schritt` ms weiterspringt. */
  const uhr = (start: number, schritt: number) => {
    let t = start;
    return () => {
      const jetzt = t;
      t += schritt;
      return jetzt;
    };
  };

  it("nimmt den Zeitpunkt VOR dem Signieren, nicht danach", async () => {
    // Langsames Signieren: die Uhr laeuft waehrenddessen um 5 Sekunden weiter.
    const takt = uhr(1_000_000, 5000);
    const langsam = async (p: string) => {
      takt(); // die Zeit vergeht waehrend des Wartens
      return gelingt(`https://s/${p}`);
    };

    const satz = await signPhotoBatch([foto("a")], langsam, 1, "s1", takt);
    expect(satz?.erzeugtUm).toBe(1_000_000);
  });

  it("rechnet die Gueltigkeit dadurch eher zu kurz als zu lang", async () => {
    // Der Kern des Befunds: wuerde nach dem Warten gestempelt, gaebe die
    // Oberflaeche der zuerst ausgestellten Adresse mehr Leben, als sie hat.
    const VERZOEGERUNG = 30_000;
    let t = 1_000_000;
    const takt = () => t;
    const langsam = async (p: string) => {
      t += VERZOEGERUNG; // Signieren dauert
      return gelingt(`https://s/${p}`);
    };

    const satz = await signPhotoBatch([foto("a")], langsam, 1, "s1", takt);
    expect(satz).not.toBeNull();
    // Gestempelt auf den Beginn — nicht auf 1_030_000.
    expect(satz!.erzeugtUm).toBe(1_000_000);
    // Und damit ist der Satz zum Zeitpunkt des Eintreffens bereits um die
    // Wartezeit gealtert, statt wieder bei null zu beginnen.
    expect(verbleibendeGueltigkeitMs(satz!, t)).toBe(
      (SIGNED_URL_TTL_SECONDS - ABLAUF_PUFFER_SEKUNDEN) * 1000 - VERZOEGERUNG,
    );
  });

  it("liest die Uhr genau einmal", async () => {
    const takt = vi.fn(() => 1_000_000);
    await signPhotoBatch([foto("a"), foto("b")], async (p) => gelingt(`https://s/${p}`), 1, "s1", takt);
    expect(takt).toHaveBeenCalledTimes(1);
  });

  it("reicht Lauf und Besichtigung unveraendert durch", async () => {
    const satz = await signPhotoBatch(
      [foto("a")],
      async (p) => gelingt(`https://s/${p}`),
      7,
      "s42",
      () => 1_000_000,
    );
    expect(satz).toEqual({
      lauf: 7,
      sessionId: "s42",
      erzeugtUm: 1_000_000,
      urls: { a: "https://s/tok/raum/a.jpg" },
    });
  });

  it("gibt null zurueck, wenn keine einzige Adresse zustande kam", async () => {
    const satz = await signPhotoBatch(
      [foto("a")],
      async () => ({ data: null, error: new Error("nein") }),
      1,
      "s1",
      () => 1_000_000,
    );
    // Ein leerer Satz ist kein Satz — sonst zeigte der Dialog eine leere
    // Galerie an, die nach zehn Minuten "ablaeuft".
    expect(satz).toBeNull();
  });

  it("gibt null zurueck, wenn es gar keine Fotos gab", async () => {
    expect(await signPhotoBatch([], async () => gelingt("x"), 1, "s1", () => 1)).toBeNull();
  });
});

// ── Ablauf ──────────────────────────────────────────────────────────────────

describe("verbleibendeGueltigkeitMs", () => {
  const b = batch();
  const gilt_bis = (SIGNED_URL_TTL_SECONDS - ABLAUF_PUFFER_SEKUNDEN) * 1000;

  it("zaehlt vom Erzeugungszeitpunkt herunter", () => {
    expect(verbleibendeGueltigkeitMs(b, b.erzeugtUm)).toBe(gilt_bis);
    expect(verbleibendeGueltigkeitMs(b, b.erzeugtUm + 1000)).toBe(gilt_bis - 1000);
  });

  it("endet den Puffer FRUEHER als die echte Frist", () => {
    // Genau der Sinn des Puffers: in den letzten Sekunden wird nichts mehr
    // herausgereicht, was beim Anklicken schon abgelaufen waere.
    const echtesEnde = b.erzeugtUm + SIGNED_URL_TTL_SECONDS * 1000;
    expect(verbleibendeGueltigkeitMs(b, echtesEnde - ABLAUF_PUFFER_SEKUNDEN * 1000)).toBe(0);
  });

  it("wird nie negativ", () => {
    expect(verbleibendeGueltigkeitMs(b, b.erzeugtUm + 10_000_000)).toBe(0);
  });
});

describe("sichtbareUrls", () => {
  const b = batch();
  const frisch = b.erzeugtUm + 1000;

  it("zeigt die Adressen der aktuellen Besichtigung, solange sie gelten", () => {
    expect(sichtbareUrls(b, "s1", frisch)).toEqual({ a: "https://s/a" });
  });

  it("zeigt nichts, wenn es keinen Satz gibt", () => {
    expect(sichtbareUrls(null, "s1", frisch)).toBe(KEINE_URLS);
  });

  it("zeigt nichts fuer eine andere Besichtigung", () => {
    // Sonst blitzten beim Umschalten kurz die Fotos der vorigen Besichtigung auf.
    expect(sichtbareUrls(b, "s2", frisch)).toBe(KEINE_URLS);
    expect(sichtbareUrls(b, null, frisch)).toBe(KEINE_URLS);
  });

  it("zeigt nichts mehr, sobald der Satz abgelaufen ist", () => {
    const abgelaufen = b.erzeugtUm + SIGNED_URL_TTL_SECONDS * 1000;
    expect(sichtbareUrls(b, "s1", abgelaufen)).toBe(KEINE_URLS);
  });

  it("zeigt genau bis zur Puffergrenze und keine Millisekunde laenger", () => {
    const grenze = b.erzeugtUm + (SIGNED_URL_TTL_SECONDS - ABLAUF_PUFFER_SEKUNDEN) * 1000;
    expect(sichtbareUrls(b, "s1", grenze - 1)).toEqual({ a: "https://s/a" });
    expect(sichtbareUrls(b, "s1", grenze)).toBe(KEINE_URLS);
  });

  it("gibt bei jedem Nein dieselbe leere Menge zurueck", () => {
    // Eine jedes Mal neu gebaute `{}` liesse React unnoetig neu zeichnen.
    expect(sichtbareUrls(null, "s1", frisch)).toBe(sichtbareUrls(b, "s2", frisch));
  });
});

// ── Nachzuegler ─────────────────────────────────────────────────────────────

describe("darfUebernehmen", () => {
  it("nimmt das Ergebnis des laufenden Durchgangs an", () => {
    expect(darfUebernehmen(3, 3, "s1", "s1")).toBe(true);
  });

  it("verwirft ein Ergebnis, dessen Lauf ueberholt ist", () => {
    // Der Nutzer hat den Dialog geschlossen und einen anderen geoeffnet,
    // bevor die Signaturen zurueckkamen.
    expect(darfUebernehmen(2, 3, "s1", "s1")).toBe(false);
  });

  it("verwirft ein Ergebnis fuer eine andere Besichtigung", () => {
    expect(darfUebernehmen(3, 3, "s1", "s2")).toBe(false);
  });

  it("verwirft, wenn gar nichts mehr angezeigt wird", () => {
    expect(darfUebernehmen(3, 3, "s1", null)).toBe(false);
  });

  it("verlangt beide Bedingungen, nicht eine davon", () => {
    expect(darfUebernehmen(2, 3, "s1", "s2")).toBe(false);
  });
});

// ── Die Aufrufstellen ───────────────────────────────────────────────────────

describe("besichtigung-uploads — kein Leser erzeugt mehr dauerhafte Adressen", () => {
  const lies = (p: string): string => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

  const LESER = [
    "src/pages/firma/Besichtigungen.tsx",
    "supabase/functions/analyze-besichtigung/index.ts",
  ];

  it.each(LESER)("%s signiert und veroeffentlicht nicht", (pfad) => {
    const quelle = lies(pfad);
    expect(quelle).toContain("createSignedUrl");
    expect(quelle).not.toContain("getPublicUrl");
  });

  it("die Oberflaeche geht ueber den geprueften Helfer", () => {
    const quelle = lies(LESER[0]);
    expect(quelle).toContain("signPhotoBatch(");
    // Und sie zeigt nur, was der Helfer freigibt — nicht den Rohsatz.
    expect(quelle).toContain("sichtbareUrls(");
    expect(quelle).toContain("sichtbarePhotoUrls[photo.id]");
  });

  it("die Oberflaeche verwirft ueberholte Laeufe und raeumt beim Ablauf", () => {
    const quelle = lies(LESER[0]);
    expect(quelle).toContain("laufRef");
    expect(quelle).toContain("verbleibendeGueltigkeitMs(");
    // Der Stempel entsteht in signPhotoBatch, nicht im Then-Zweig: nach dem
    // Warten darf die Zeit nicht erneut abgelesen werden.
    const nachDemWarten = quelle.slice(quelle.indexOf(").then(satz =>"));
    expect(nachDemWarten.slice(0, 400)).not.toContain("Date.now()");
    // Kein angesammelter Dauerzustand mehr.
    expect(quelle).not.toContain("setPhotoUrls");
  });

  it("kein weiterer Leser im Baum", () => {
    for (const pfad of [
      "supabase/functions/upload-besichtigung-photo/index.ts",
      "supabase/functions/delete-besichtigung-photo/index.ts",
      "supabase/functions/cleanup-besichtigung/index.ts",
    ]) {
      expect(lies(pfad), pfad).not.toContain("getPublicUrl");
    }
  });
});
