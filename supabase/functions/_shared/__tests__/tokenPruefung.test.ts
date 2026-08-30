import { describe, expect, it } from "vitest";
import {
  type AuthDienst,
  erstelleTokenPruefung,
  istAbgelehntesToken,
} from "../paidApiGuard.ts";

/**
 * Der PRODUKTIONS-Adapter, nicht die Testattrappe.
 *
 * Bis 2026-08-30 pruefte die Testreihe `verifyToken` nur gegen eine Attrappe,
 * die bei einem schlechten Token `null` lieferte. Kein ausgelieferter Adapter
 * tat das: alle drei warfen den `AuthApiError` weiter, und der gemeinsame
 * Ablauf stuft jeden Wurf als 503 ein. Die 401-Klasse war damit in der
 * Produktion unerreichbar — gepruefte Zusage, ungeprueftes Verhalten.
 *
 * Diese Datei prueft deshalb die Form, die wirklich ausgeliefert wird.
 */

/** So sieht ein `AuthApiError` aus supabase-js aus. */
const authApiError = (status: number, message = "invalid claim") =>
  Object.assign(new Error(message), { name: "AuthApiError", status, __isAuthError: true });

const dienst = (antwort: {
  user?: { id: string } | null;
  error?: unknown;
}): AuthDienst => ({
  auth: {
    getUser: async () => ({ data: { user: antwort.user ?? null }, error: antwort.error ?? null }),
  },
});

describe("istAbgelehntesToken", () => {
  it.each([
    ["AuthApiError 401", authApiError(401)],
    ["AuthApiError 403", authApiError(403)],
    ["AuthApiError 400 (unfoermiges JWT)", authApiError(400, "bad_jwt")],
    ["GoTrue-Code bad_jwt ohne Status", { code: "bad_jwt" }],
    ["GoTrue-Code session_expired", { error_code: "session_expired", status: 401 }],
  ])("erkennt eine Ablehnung: %s", (_n, fehler) => {
    expect(istAbgelehntesToken(fehler)).toBe(true);
  });

  it.each([
    ["Netzfehler", new Error("fetch failed")],
    ["AuthApiError 500", authApiError(500, "internal")],
    ["AuthApiError 503", authApiError(503, "unavailable")],
    ["Zeitueberschreitung ohne Status", { name: "TypeError", message: "timeout" }],
    ["null", null],
    ["Zeichenkette", "kaputt"],
    // Die drei, die die Durchsicht als gefaehrlich falsch eingestuft hat:
    ["GoTrue 429 Drosselung", authApiError(429, "over_request_rate_limit")],
    ["408 Zeitueberschreitung", authApiError(408, "timeout")],
    ["Gateway-401 ohne Auth-Kennzeichen (rotierter Schluessel)", { status: 401, message: "Invalid authentication credentials" }],
  ])("haelt eine Stoerung NICHT fuer eine Ablehnung: %s", (_n, fehler) => {
    // Im Zweifel Ausfall, nicht Ablehnung: eine faelschlich als 401 gemeldete
    // Stoerung schickt den Bedienenden in eine endlose Neuanmeldung.
    expect(istAbgelehntesToken(fehler)).toBe(false);
  });
});

describe("erstelleTokenPruefung · der ausgelieferte Adapter", () => {
  it("gueltiges Token → Benutzer-ID", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ user: { id: "u-1" } }));
    await expect(pruefe("t")).resolves.toBe("u-1");
  });

  it("abgelaufenes Token → null, NICHT geworfen (sonst waere es 503 statt 401)", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: authApiError(401, "token expired") }));
    await expect(pruefe("t")).resolves.toBeNull();
  });

  it("unfoermiges JWT → null", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: authApiError(400, "bad_jwt") }));
    await expect(pruefe("t")).resolves.toBeNull();
  });

  it("Anmeldedienst gestoert → wirft, damit der Ablauf 503 daraus macht", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: authApiError(503, "unavailable") }));
    await expect(pruefe("t")).rejects.toBeTruthy();
  });

  it("Drosselung (429) wirft — sonst meldet sich der Bedienende neu an und erhoeht die Last", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: authApiError(429, "over_request_rate_limit") }));
    await expect(pruefe("t")).rejects.toBeTruthy();
  });

  it("Gateway-401 ohne Auth-Kennzeichen wirft — eine Fehlkonfiguration ist kein Sitzungsende", async () => {
    const pruefe = erstelleTokenPruefung(
      dienst({ error: { status: 401, message: "Invalid authentication credentials" } }),
    );
    await expect(pruefe("t")).rejects.toBeTruthy();
  });

  it("GoTrue-Code entscheidet auch ohne Status", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: { code: "bad_jwt" } }));
    await expect(pruefe("t")).resolves.toBeNull();
  });

  it("Netzfehler → wirft", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ error: new Error("fetch failed") }));
    await expect(pruefe("t")).rejects.toBeTruthy();
  });

  it("kein Fehler, aber auch kein Benutzer → null", async () => {
    const pruefe = erstelleTokenPruefung(dienst({ user: null }));
    await expect(pruefe("t")).resolves.toBeNull();
  });
});

describe("der Adapter im vollen Ablauf", () => {
  it("ein abgelaufenes Token ergibt 401 — nicht 503", async () => {
    const { bearbeitePaidApiAnfrage } = await import("../paidApiHttp.ts");
    const google = { aufrufe: 0 };
    const antwort = await bearbeitePaidApiAnfrage(
      new Request("https://edge.test/fn", {
        method: "POST",
        headers: { Authorization: "Bearer abgelaufen", "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: "aaaaaaaa-0000-0000-0000-00000000000a", input: "abc" }),
      }),
      {
        name: "probe",
        bucket: "google-places",
        pruefeNutzlast: (r) => r as { input: string },
        baueUrl: () => "https://maps.googleapis.com/x",
        werteAus: () => ({ ok: true }),
      },
      {
        verifyToken: erstelleTokenPruefung(dienst({ error: authApiError(401, "expired") })),
        consumeBudget: async () => ({ allowed: true, retry_after: 0 }),
        fetchGoogle: async () => {
          google.aufrufe += 1;
          return new Response("{}", { status: 200 });
        },
        log: () => {},
      },
    );
    expect(antwort.status).toBe(401);
    expect(await antwort.json()).toMatchObject({ code: "invalid_token" });
    expect(google.aufrufe).toBe(0);
  });

  it("ein gestoerter Anmeldedienst ergibt 503", async () => {
    const { bearbeitePaidApiAnfrage } = await import("../paidApiHttp.ts");
    const antwort = await bearbeitePaidApiAnfrage(
      new Request("https://edge.test/fn", {
        method: "POST",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: "aaaaaaaa-0000-0000-0000-00000000000a", input: "abc" }),
      }),
      {
        name: "probe",
        bucket: "google-places",
        pruefeNutzlast: (r) => r as { input: string },
        baueUrl: () => "https://maps.googleapis.com/x",
        werteAus: () => ({ ok: true }),
      },
      {
        verifyToken: erstelleTokenPruefung(dienst({ error: authApiError(503, "down") })),
        consumeBudget: async () => ({ allowed: true, retry_after: 0 }),
        fetchGoogle: async () => new Response("{}", { status: 200 }),
        log: () => {},
      },
    );
    expect(antwort.status).toBe(503);
    expect(await antwort.json()).toMatchObject({ code: "auth_unavailable" });
  });
});
