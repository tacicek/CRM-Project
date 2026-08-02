import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RETIRED_ADMIN_FUNCTIONS, retiredAdminResponse } from "../retiredAdminEndpoint.ts";

// ── Das ausgefuehrte Verhalten ──────────────────────────────────────────────

describe("retiredAdminResponse", () => {
  it("beantwortet OPTIONS mit 200 und ohne Koerper", () => {
    const r = retiredAdminResponse("OPTIONS");
    expect(r.status).toBe(200);
    expect(r.body).toBeNull();
    expect(r.headers["Allow"]).toBeUndefined();
  });

  it("beantwortet POST mit 410 und festem Koerper", () => {
    const r = retiredAdminResponse("POST");
    expect(r.status).toBe(410);
    expect(r.body).toEqual({ error: "endpoint_retired" });
    expect(Object.keys(r.body ?? {})).toEqual(["error"]);
  });

  it.each(["GET", "PUT", "PATCH", "DELETE", "HEAD", "TRACE", "", " "])(
    "beantwortet %s mit 405 und Allow",
    (m) => {
      const r = retiredAdminResponse(m);
      expect(r.status).toBe(405);
      expect(r.body).toEqual({ error: "method_not_allowed" });
      expect(r.headers["Allow"]).toBe("POST, OPTIONS");
    },
  );

  it.each(["post", "Post", "options", "get"])("normalisiert die Schreibweise nicht (%s)", (m) => {
    expect(retiredAdminResponse(m).status).toBe(405);
  });

  it("spiegelt nichts aus der Anfrage zurueck", () => {
    const SENTINEL = "SENTINEL-admin-9f8e7d";
    const r = retiredAdminResponse(SENTINEL);
    expect(JSON.stringify(r)).not.toContain(SENTINEL);
  });

  it("gibt bei jedem Aufruf eigene Kopfzeilen zurueck", () => {
    retiredAdminResponse("POST").headers["X-Fremd"] = "eingeschmuggelt";
    expect(retiredAdminResponse("POST").headers["X-Fremd"]).toBeUndefined();
  });

  it("setzt no-store und kennt genau drei Ergebnisformen", () => {
    for (const m of ["OPTIONS", "POST", "GET"]) {
      expect(retiredAdminResponse(m).headers["Cache-Control"]).toBe("no-store");
    }
    const formen = new Set(
      ["OPTIONS", "POST", "GET", "PUT", "post"].map((m) => JSON.stringify(retiredAdminResponse(m))),
    );
    expect(formen.size).toBe(3);
  });
});

// ── Die sechs Adapter als Quelltext ─────────────────────────────────────────
//
// Die Dateien laden hier nicht (Deno-Globals, `https://`-Importe). Geprueft
// wird an Import- und Aufrufmustern, nachdem die Kommentare entfernt wurden —
// sonst pruefte man Prosa.

describe("admin-* Adapter — nichts mehr da", () => {
  /** Entfernt `//`-Kommentare, aber nicht das `//` in `https://`. */
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

  const nurCode = (quelle: string): string => {
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
  };

  const code = (name: string): string =>
    nurCode(readFileSync(new URL(`../../${name}/index.ts`, import.meta.url), "utf8"));

  it("kennt genau sechs stillgelegte Endpunkte", () => {
    expect([...RETIRED_ADMIN_FUNCTIONS]).toEqual([
      "admin-add-company-member",
      "admin-create-user",
      "admin-delete-user",
      "admin-remove-company-member",
      "admin-reset-password",
      "admin-update-user-email",
    ]);
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s importiert nur Server und Grabstein", (name) => {
    const importe = [...code(name).matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]).sort();
    expect(importe).toEqual([
      "../_shared/retiredAdminEndpoint.ts",
      "https://deno.land/std@0.190.0/http/server.ts",
    ]);
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s baut keinen Client und liest keine Umgebung", (name) => {
    const c = code(name);
    expect(c).not.toContain("createClient");
    expect(c).not.toContain("Deno.env");
    expect(c).not.toContain("SERVICE_ROLE");
    expect(c).not.toContain("auth.admin");
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s beruehrt keine Tabelle", (name) => {
    const c = code(name);
    for (const muster of [".from(", ".select(", ".insert(", ".update(", ".delete(", "company_members", "user_roles"]) {
      expect(c, `${name}: ${muster}`).not.toContain(muster);
    }
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s liest weder Koerper noch Kopfzeilen", (name) => {
    const c = code(name);
    expect(c).not.toContain("req.json()");
    expect(c).not.toContain("req.text()");
    expect(c).not.toContain("req.body");
    expect(c).not.toContain("req.headers");
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s protokolliert nichts und faengt nichts ab", (name) => {
    const c = code(name);
    expect(c).not.toContain("console.");
    expect(c).not.toContain("catch");
  });

  it.each(RETIRED_ADMIN_FUNCTIONS)("%s reicht genau die Methode weiter", (name) => {
    const c = code(name);
    expect(c).toContain("retiredAdminResponse(req.method)");
    const zugriffe = [...c.matchAll(/req\.(\w+)/g)].map((m) => m[1]);
    expect([...new Set(zugriffe)]).toEqual(["method"]);
  });

  it("laesst alle sechs dieselbe Entscheidung benutzen", () => {
    const rumpfe = new Set(
      RETIRED_ADMIN_FUNCTIONS.map((n) => code(n).replace(new RegExp(n, "g"), "<name>")),
    );
    // Bis auf den Namen im Kommentar — der hier ohnehin entfernt ist — sind alle
    // sechs Adapter identisch. Eine Abweichung waere ein vergessener Rest.
    expect(rumpfe.size).toBe(1);
  });
});
