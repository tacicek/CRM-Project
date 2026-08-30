import { describe, expect, it, vi } from "vitest";
import {
  bearbeitePaidApiAnfrage,
  type EndpunktVertrag,
  type PaidApiUmgebung,
} from "../paidApiHttp.ts";

const USER = "11111111-1111-1111-1111-111111111111";
const FIRMA = "aaaaaaaa-0000-0000-0000-00000000000a";
const TOKEN = "eyJgueltig";

/** Sentinel-Werte: taucht einer davon im Protokoll auf, ist es ein PII-Leck. */
const SENTINEL = {
  origin: "SENTINEL-HERKUNFT-Bahnhofstrasse-1",
  destination: "SENTINEL-ZIEL-Seestrasse-9",
  input: "SENTINEL-SUCHTEXT",
  placeId: "SENTINEL-PLACE-ID",
  /** Traegt Kundeninhalt UND faellt durch die Pruefung — sonst wird der
   *  Ungueltig-Zweig nie mit einem Sentinel betreten. */
  ungueltig: "SENTINEL-UNGUELTIG-Bahnhofstrasse-1",
};

interface Aufzeichnung {
  umg: PaidApiUmgebung;
  google: ReturnType<typeof vi.fn>;
  budget: ReturnType<typeof vi.fn>;
  logs: Array<{ ereignis: string; felder?: Record<string, unknown> }>;
}

/**
 * Fuer JEDE Anfrage ein frisches Buendel — wie der Edge-Router je Anfrage einen
 * eigenen Worker erzeugt. Geteilt wird nur, was absichtlich dauerhaft ist.
 */
const umgebung = (o: Partial<PaidApiUmgebung> = {}): Aufzeichnung => {
  const logs: Aufzeichnung["logs"] = [];
  const google = vi.fn(async () =>
    new Response(JSON.stringify({ status: "OK", predictions: [], rows: [{ elements: [{ status: "OK", distance: { value: 1000, text: "1 km" }, duration: { value: 600, text: "10 Min." } }] }], result: { formatted_address: "x", address_components: [], geometry: { location: { lat: 1, lng: 2 } } } }), { status: 200 }),
  );
  const budget = vi.fn(async () => ({ allowed: true, retry_after: 0 }));

  const umg = {
    verifyToken: async (t: string) => (t === TOKEN ? USER : null),
    consumeBudget: budget,
    fetchGoogle: google,
    log: (ereignis, felder) => logs.push({ ereignis, felder }),
    ...o,
  } satisfies PaidApiUmgebung;

  return { umg, google, budget, logs };
};

const vertrag: EndpunktVertrag<{ input: string }, { ok: true }> = {
  name: "test-endpunkt",
  bucket: "google-places",
  pruefeNutzlast: (roh) => {
    const r = roh as { input?: unknown };
    if (typeof r?.input !== "string" || r.input.length < 3) return null;
    // Damit ein Sentinel auch den Ungueltig-Zweig erreichen kann.
    if (r.input.includes("UNGUELTIG")) return null;
    return { input: r.input };
  },
  baueUrl: () => "https://maps.googleapis.com/x",
  werteAus: () => ({ ok: true }),
};

const anfrage = (o: {
  method?: string;
  auth?: string | null;
  body?: unknown;
  rawBody?: string;
} = {}): Request =>
  new Request("https://edge.test/fn", {
    method: o.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(o.auth === null ? {} : { Authorization: o.auth ?? `Bearer ${TOKEN}` }),
    },
    ...(o.method === "GET" || o.method === "OPTIONS"
      ? {}
      : { body: o.rawBody ?? JSON.stringify(o.body ?? { company_id: FIRMA, input: "abc" }) }),
  });

describe("bezahlter Endpunkt · Reihenfolge und Fehlerklassen", () => {
  it("OPTIONS: kein Auth, kein Budget, kein Google", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ method: "OPTIONS" }), vertrag, a.umg);
    expect(r.status).toBe(200);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it.each(["GET", "PUT", "DELETE"])("%s → 405 mit Allow, nichts angefasst", async (m) => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ method: m }), vertrag, a.umg);
    expect(r.status).toBe(405);
    expect(r.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("zu grosser Rumpf → 413, kein Budget, kein Google", async () => {
    const a = umgebung({ grenzeBytes: 64 });
    const r = await bearbeitePaidApiAnfrage(
      anfrage({ rawBody: JSON.stringify({ company_id: FIRMA, input: "x".repeat(500) }) }),
      vertrag,
      a.umg,
    );
    expect(r.status).toBe(413);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("mehrbytige Zeichen zaehlen als BYTES, nicht als Zeichen", async () => {
    // 40 Emoji = 160 Bytes, aber nur 80 UTF-16-Einheiten.
    const a = umgebung({ grenzeBytes: 120 });
    const r = await bearbeitePaidApiAnfrage(
      anfrage({ rawBody: JSON.stringify({ company_id: FIRMA, input: "🙂".repeat(40) }) }),
      vertrag,
      a.umg,
    );
    expect(r.status).toBe(413);
  });

  it("unlesbares JSON → 400, kein Budget, kein Google", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ rawBody: "{kaputt" }), vertrag, a.umg);
    expect(r.status).toBe(400);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("kein Bearer → 401", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ auth: null }), vertrag, a.umg);
    expect(r.status).toBe(401);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("blosses Wort Bearer ist kein Token → 401", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ auth: "Bearer" }), vertrag, a.umg);
    expect(r.status).toBe(401);
  });

  it("ungueltiges Token → 401", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage({ auth: "Bearer falsch" }), vertrag, a.umg);
    expect(r.status).toBe(401);
    expect(a.google).not.toHaveBeenCalled();
  });

  it("gestoerte Tokenpruefung → 503, NICHT 'ungueltige Sitzung'", async () => {
    const a = umgebung({ verifyToken: async () => { throw new Error("netz"); } });
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("auth_unavailable");
    expect(a.budget).not.toHaveBeenCalled();
  });

  it("fehlende oder unfoermige company_id → 400", async () => {
    for (const c of [undefined, "keine-uuid", 42]) {
      const a = umgebung();
      const r = await bearbeitePaidApiAnfrage(
        anfrage({ body: { company_id: c, input: "abc" } }), vertrag, a.umg,
      );
      expect(r.status).toBe(400);
      expect(a.budget).not.toHaveBeenCalled();
    }
  });

  it("unfoermige Nutzlast → 400 und VERBRAUCHT KEIN BUDGET", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(
      anfrage({ body: { company_id: FIRMA, input: "ab" } }), vertrag, a.umg,
    );
    expect(r.status).toBe(400);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("fehlende Google-Konfiguration → 503 VOR dem Budget", async () => {
    const a = umgebung();
    const ohneSchluessel = { ...vertrag, baueUrl: () => null };
    const r = await bearbeitePaidApiAnfrage(anfrage(), ohneSchluessel, a.umg);
    expect(r.status).toBe(503);
    expect(a.budget).not.toHaveBeenCalled();
    expect(a.google).not.toHaveBeenCalled();
  });

  it("fremde Firma → 403, allgemeine Antwort, kein Google", async () => {
    const a = umgebung({
      consumeBudget: async () => {
        throw { code: "R2403", details: "r2_membership_denied", message: "Keine Mitgliedschaft" };
      },
    });
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(403);
    const rumpf = await r.json();
    expect(rumpf.code).toBe("forbidden");
    // Verraet nicht, ob die Firma existiert.
    expect(JSON.stringify(rumpf)).not.toContain(FIRMA);
    expect(a.google).not.toHaveBeenCalled();
  });

  it("echter Rechteschwund (42501) → 503, NICHT 403", async () => {
    const a = umgebung({
      consumeBudget: async () => {
        throw { code: "42501", message: "permission denied for function" };
      },
    });
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(503);
    expect(a.google).not.toHaveBeenCalled();
  });

  it("Budget erschoepft → 429 mit Retry-After, kein Google", async () => {
    const a = umgebung({ consumeBudget: async () => ({ allowed: false, retry_after: 42 }) });
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("42");
    expect(a.google).not.toHaveBeenCalled();
  });

  it("gestoerter Budgetdienst → 503, kein Google", async () => {
    const a = umgebung({ consumeBudget: async () => { throw new Error("db weg"); } });
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(503);
    expect(a.google).not.toHaveBeenCalled();
  });

  it("Google nicht erreichbar → 503", async () => {
    const a = umgebung({ fetchGoogle: async () => { throw new Error("timeout"); } });
    expect((await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg)).status).toBe(503);
  });

  it("Google antwortet mit Fehler → 502", async () => {
    const a = umgebung({ fetchGoogle: async () => new Response("nope", { status: 500 }) });
    expect((await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg)).status).toBe(502);
  });

  it("Google fachlich abgelehnt → 502", async () => {
    const a = umgebung();
    const abgelehnt = { ...vertrag, werteAus: () => null };
    expect((await bearbeitePaidApiAnfrage(anfrage(), abgelehnt, a.umg)).status).toBe(502);
  });

  it("gueltige Anfrage → Google GENAU EINMAL", async () => {
    const a = umgebung();
    const r = await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
    expect(r.status).toBe(200);
    expect(a.google).toHaveBeenCalledTimes(1);
    expect(a.budget).toHaveBeenCalledTimes(1);
  });

  it("der Budgetaufruf bekommt Topf, geprueften Benutzer und GENAU die Firma aus dem Rumpf", () => {
    // Ohne diese Zusicherung bleibt eine vertauschte oder fest verdrahtete
    // company_id unbemerkt — der Mandantenbezug waere dann nur behauptet.
    return (async () => {
      const a = umgebung();
      await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg);
      expect(a.budget).toHaveBeenCalledWith("google-places", USER, FIRMA);
    })();
  });

  it("eine andere Firma im Rumpf erreicht auch den Budgetaufruf", () => {
    return (async () => {
      const andere = "bbbbbbbb-0000-0000-0000-00000000000b";
      const a = umgebung();
      await bearbeitePaidApiAnfrage(
        anfrage({ body: { company_id: andere, input: "abc" } }), vertrag, a.umg,
      );
      expect(a.budget).toHaveBeenCalledWith("google-places", USER, andere);
    })();
  });
});

describe("bezahlter Endpunkt · kein Kundeninhalt im Protokoll", () => {
  it.each([
    ["gueltig", { company_id: FIRMA, input: SENTINEL.input }],
    ["unfoermig mit Kundeninhalt", { company_id: FIRMA, input: SENTINEL.ungueltig }],
    ["unlesbarer Rumpf", { company_id: FIRMA, origin: SENTINEL.origin, destination: SENTINEL.destination, input: "ab" }],
    ["ohne Firma", { input: SENTINEL.input }],
  ])("%s: kein Sentinel, keine Kennung im Protokoll", async (_n, body) => {
    const a = umgebung();
    await bearbeitePaidApiAnfrage(anfrage({ body }), vertrag, a.umg);
    const alles = JSON.stringify(a.logs);
    for (const s of Object.values(SENTINEL)) expect(alles).not.toContain(s);
    expect(alles).not.toContain(USER);
    expect(alles).not.toContain(FIRMA);
    expect(alles).not.toContain(TOKEN);
  });
});

describe("frischer Worker je Anfrage", () => {
  it("61 Anfragen mit je frischem Buendel erreichen trotzdem 429", async () => {
    let verbraucht = 0;
    const status: number[] = [];
    for (let i = 0; i < 61; i++) {
      const a = umgebung({
        consumeBudget: async () => {
          verbraucht += 1;
          return verbraucht <= 60
            ? { allowed: true, retry_after: 0 }
            : { allowed: false, retry_after: 30 };
        },
      });
      status.push((await bearbeitePaidApiAnfrage(anfrage(), vertrag, a.umg)).status);
    }
    expect(status.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(status[60]).toBe(429);
  });
});
