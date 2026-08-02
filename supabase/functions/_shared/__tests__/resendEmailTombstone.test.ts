import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tombstoneResponse } from "../resendEmailTombstone.ts";

// ── Das ausgefuehrte Verhalten ──────────────────────────────────────────────

describe("tombstoneResponse", () => {
  it("beantwortet OPTIONS mit 200 und ohne Koerper", () => {
    const r = tombstoneResponse("OPTIONS");
    expect(r.status).toBe(200);
    expect(r.body).toBeNull();
    expect(r.headers["Allow"]).toBeUndefined();
  });

  it("beantwortet POST mit 410 und genau einem festen Koerper", () => {
    const r = tombstoneResponse("POST");
    expect(r.status).toBe(410);
    expect(r.body).toEqual({ error: "endpoint_retired" });
    expect(Object.keys(r.body ?? {})).toEqual(["error"]);
    expect(r.headers["Content-Type"]).toBe("application/json");
  });

  it.each(["GET", "PUT", "PATCH", "DELETE", "HEAD"])("beantwortet %s mit 405 und Allow", (m) => {
    const r = tombstoneResponse(m);
    expect(r.status).toBe(405);
    expect(r.body).toEqual({ error: "method_not_allowed" });
    expect(r.headers["Allow"]).toBe("POST, OPTIONS");
  });

  it.each(["TRACE", "CONNECT", "PROPFIND", "BREW", "", " ", "POST ", "OPTIONS\n"])(
    "beantwortet die unbekannte Methode %s mit 405",
    (m) => {
      const r = tombstoneResponse(m);
      expect(r.status).toBe(405);
      expect(r.body).toEqual({ error: "method_not_allowed" });
    },
  );

  it.each(["post", "Post", "options", "Options", "get"])(
    "normalisiert die Schreibweise NICHT — %s ist keine Methode",
    (m) => {
      expect(tombstoneResponse(m).status).toBe(405);
    },
  );

  it("liefert bei Wiederholung dasselbe Ergebnis", () => {
    for (const m of ["OPTIONS", "POST", "GET"]) {
      expect(tombstoneResponse(m)).toEqual(tombstoneResponse(m));
    }
  });

  it("gibt bei jedem Aufruf eigene Kopfzeilen zurueck — kein geteilter Zustand", () => {
    const a = tombstoneResponse("POST");
    a.headers["X-Fremd"] = "eingeschmuggelt";
    expect(tombstoneResponse("POST").headers["X-Fremd"]).toBeUndefined();
  });

  it("spiegelt nichts aus der Anfrage zurueck", () => {
    const SENTINEL = "SENTINEL-a1b2c3-AUS-DER-ANFRAGE";
    for (const m of ["POST", "GET", "OPTIONS", SENTINEL]) {
      const r = tombstoneResponse(m);
      expect(JSON.stringify(r)).not.toContain(SENTINEL);
      // Auch die Methode selbst steht in keiner Antwort.
      if (m !== SENTINEL) expect(JSON.stringify(r.body)).not.toContain(m);
    }
  });

  it("traegt in jeder Antwort nur feste Kopfzeilen", () => {
    for (const m of ["OPTIONS", "POST", "GET"]) {
      const r = tombstoneResponse(m);
      const erlaubt = [
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Headers",
        "Cache-Control",
        "Content-Type",
        "Allow",
      ];
      for (const k of Object.keys(r.headers)) expect(erlaubt, `${m}: ${k}`).toContain(k);
      expect(r.headers["Cache-Control"]).toBe("no-store");
    }
  });

  it("kennt genau drei Ergebnisformen", () => {
    const formen = new Set(
      ["OPTIONS", "POST", "GET", "PUT", "TRACE", "post"].map((m) =>
        JSON.stringify(tombstoneResponse(m)),
      ),
    );
    expect(formen.size).toBe(3);
  });
});

// ── Der Edge-Adapter als Quelltext ──────────────────────────────────────────
//
// `index.ts` laesst sich hier nicht laden (Deno-Globals, `https://`-Importe).
// Geprueft wird deshalb, dass die Wirkung wirklich fort ist — und zwar an
// Aufruf- und Importmustern, nicht an einzelnen Woertern, die auch in einem
// Kommentar stehen koennten.

describe("resend-email/index.ts — nichts mehr da", () => {
  const quelle = readFileSync(new URL("../../resend-email/index.ts", import.meta.url), "utf8");

  /**
   * Entfernt einen `//`-Kommentar am Zeilenende — aber nur ausserhalb von
   * Anfuehrungszeichen. Ein einfaches `replace(/\/\/.*$/)` schneidet sonst
   * mitten in `https://…` ab und macht aus einem Import eine halbe Zeile.
   */
  const ohneZeilenkommentar = (zeile: string): string => {
    let inZeichenkette: string | null = null;
    for (let i = 0; i < zeile.length; i += 1) {
      const c = zeile[i];
      if (inZeichenkette) {
        if (c === "\\") i += 1;
        else if (c === inZeichenkette) inZeichenkette = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        inZeichenkette = c;
        continue;
      }
      if (c === "/" && zeile[i + 1] === "/") return zeile.slice(0, i).trimEnd();
    }
    return zeile;
  };

  /** Nur die Anweisungen, ohne Kommentare: sonst prueft man Prosa. */
  const code = (() => {
    const zeilen: string[] = [];
    let block = false;
    for (const roh of quelle.split("\n")) {
      const z = roh.trim();
      if (block) {
        if (z.includes("*/")) block = false;
        continue;
      }
      if (z.startsWith("/*")) {
        if (!z.includes("*/")) block = true;
        continue;
      }
      if (z.startsWith("//") || z.startsWith("*")) continue;
      zeilen.push(ohneZeilenkommentar(roh));
    }
    return zeilen.join("\n");
  })();

  it("importiert nur den HTTP-Server und den reinen Grabstein", () => {
    const importe = [...code.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]).sort();
    expect(importe).toEqual([
      "../_shared/resendEmailTombstone.ts",
      "https://deno.land/std@0.190.0/http/server.ts",
    ]);
  });

  it("baut keinen Supabase-Client", () => {
    expect(code).not.toContain("createClient");
    expect(code).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("baut keinen Mailversender", () => {
    expect(code).not.toContain("new Resend");
    expect(code).not.toContain("emails.send");
    expect(code).not.toContain("RESEND_API_KEY");
  });

  it("liest die Umgebung nicht", () => {
    expect(code).not.toContain("Deno.env");
    expect(code).not.toContain("envConfig");
  });

  it("beruehrt keine Tabelle", () => {
    expect(code).not.toContain("email_logs");
    expect(code).not.toContain(".from(");
    expect(code).not.toContain(".select(");
    expect(code).not.toContain(".insert(");
    expect(code).not.toContain(".update(");
  });

  it("liest weder Koerper noch Kopfzeilen der Anfrage", () => {
    expect(code).not.toContain("req.json()");
    expect(code).not.toContain("req.text()");
    expect(code).not.toContain("req.body");
    expect(code).not.toContain("req.headers");
    expect(code).not.toContain("emailLogId");
  });

  it("protokolliert nichts", () => {
    expect(code).not.toContain("console.");
  });

  it("gibt keine Ausnahme und keinen Anfragewert heraus", () => {
    expect(code).not.toContain("catch");
    expect(code).not.toContain("error.message");
    expect(code).not.toContain("instanceof Error");
  });

  it("reicht genau die Methode an die Entscheidung weiter", () => {
    expect(code).toContain("tombstoneResponse(req.method)");
    // Und benutzt sonst nichts aus der Anfrage.
    const zugriffe = [...code.matchAll(/req\.(\w+)/g)].map((m) => m[1]);
    expect([...new Set(zugriffe)]).toEqual(["method"]);
  });

  it("baut die Antwort aus dem Ergebnis, nicht aus der Anfrage", () => {
    expect(code).toContain("new Response");
    expect(code).toMatch(/ergebnis\.status|result\.status/);
  });
});
