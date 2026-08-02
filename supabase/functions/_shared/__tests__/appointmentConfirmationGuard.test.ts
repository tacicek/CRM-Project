import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_FIELDS,
  REJECTED_LEGACY_FIELDS,
  SKIP_TYPES,
  extractBearerToken,
  handleAppointmentConfirmation,
  parseConfirmationRequest,
  type AppointmentRow,
  type CompanyRow,
  type CompanySecretsLike,
  type ConfirmationDeps,
  type EmailLogEntry,
  type LookupResult,
  type MembershipResult,
  type SendArgs,
} from "../appointmentConfirmationGuard.ts";

const TERMIN = "11111111-2222-3333-4444-555555555555";
const FIRMA = "99999999-8888-7777-6666-555555555555";
const FREMDE_FIRMA = "12121212-3434-5656-7878-909090909090";
const BENUTZER = "aaaaaaaa-1111-2222-3333-444444444444";
const JWT = "ey.GEHEIMES-JWT.signatur";
const FIRMEN_KEY = "re_firmenschluessel";
const GLOBAL_KEY = "re_globalschluessel";

const termin = (over: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id: TERMIN,
  company_id: FIRMA,
  lead_id: null,
  appointment_type: "besichtigung",
  appointment_date: "2026-09-10",
  start_time: "09:00:00",
  end_time: "10:30:00",
  all_day: false,
  title: "Besichtigung Zürich",
  description: null,
  location_address: "Bahnhofstrasse 1",
  location_plz: "8001",
  location_city: "Zürich",
  customer_first_name: "Anna",
  customer_last_name: "Beispiel",
  customer_email: "kundin@example.test",
  customer_phone: "+41 00 000 00 00",
  language: "fr",
  ...over,
});

const firma = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  id: FIRMA,
  company_name: "Muster Umzug AG",
  email: "info@example.test",
  phone: null,
  resend_enabled: false,
  resend_from_email: null,
  resend_from_name: null,
  ...over,
});

// ── Datenstroeme, die mitzaehlen ────────────────────────────────────────────

const zaehlenderStrom = (stuecke: Uint8Array[]) => {
  const zaehler = { pulls: 0, cancels: 0 };
  let i = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        zaehler.pulls += 1;
        if (i >= stuecke.length) {
          controller.close();
          return;
        }
        controller.enqueue(stuecke[i]);
        i += 1;
      },
      cancel() {
        zaehler.cancels += 1;
      },
    },
    // Ohne highWaterMark 0 zieht ReadableStream schon beim Anlegen ein Stueck
    // und der Zaehler stuende auf 1, ohne dass jemand gelesen haette.
    { highWaterMark: 0 },
  );
  return { stream, zaehler };
};

const bytes = (t: string) => new TextEncoder().encode(t);
const fuell = (n: number) => new Uint8Array(n).fill(0x78);

const koerper = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ appointmentId: TERMIN, ...over });

const post = (text: string, authorization: string | null = `Bearer ${JWT}`) => ({
  method: "POST",
  authorization,
  contentLength: String(bytes(text).length),
  body: zaehlenderStrom([bytes(text)]).stream,
});

interface Aufzeichnung {
  spur: string[];
  mails: SendArgs[];
  logs: EmailLogEntry[];
  protokoll: Array<{ step: string; details?: Record<string, unknown> }>;
  tokens: string[];
}

interface Optionen {
  user?: { userId: string } | null;
  authWirft?: boolean;
  appointment?: AppointmentRow | null;
  appointmentLookup?: LookupResult<AppointmentRow>;
  membership?: MembershipResult;
  company?: CompanyRow | null;
  companyLookup?: LookupResult<CompanyRow>;
  secrets?: CompanySecretsLike;
  secretsLookup?: LookupResult<CompanySecretsLike>;
  /** Name der Abhaengigkeit, die werfen soll. */
  wirftIn?: string;
  globalKey?: string | undefined;
  sendErgebnis?: (a: SendArgs) => { id?: string; error?: unknown };
  sendWirft?: (a: SendArgs) => boolean;
  logWirft?: boolean;
}

const macheDeps = (o: Optionen = {}): { deps: ConfirmationDeps; auf: Aufzeichnung } => {
  const auf: Aufzeichnung = { spur: [], mails: [], logs: [], protokoll: [], tokens: [] };

  // Wirft mit einer Meldung, die ein Kennzeichen traegt: taucht sie irgendwo
  // auf, ist die Ausnahme durchgereicht worden.
  const wirf = (name: string) => {
    if (o.wirftIn === name) throw new Error(`WURF-SENTINEL:${name}:${JWT}`);
  };

  const deps: ConfirmationDeps = {
    authenticate: async (token) => {
      auf.spur.push("authenticate");
      auf.tokens.push(token);
      if (o.authWirft) throw new Error("network");
      return o.user === undefined ? { userId: BENUTZER } : o.user;
    },
    loadAppointment: async (id) => {
      auf.spur.push(`loadAppointment:${id}`);
      wirf("loadAppointment");
      if (o.appointmentLookup) return o.appointmentLookup;
      return { ok: true, value: o.appointment === undefined ? termin() : o.appointment };
    },
    isCompanyMember: async (userId, companyId) => {
      auf.spur.push(`isCompanyMember:${userId}:${companyId}`);
      wirf("isCompanyMember");
      return o.membership ?? { ok: true, isMember: true };
    },
    loadCompany: async (id) => {
      auf.spur.push(`loadCompany:${id}`);
      wirf("loadCompany");
      if (o.companyLookup) return o.companyLookup;
      return { ok: true, value: o.company === undefined ? firma() : o.company };
    },
    loadSecrets: async (id) => {
      auf.spur.push(`loadSecrets:${id}`);
      wirf("loadSecrets");
      if (o.secretsLookup) return o.secretsLookup;
      return { ok: true, value: o.secrets ?? { resend_api_key: null } };
    },
    renderEmail: (ctx) => {
      auf.spur.push(`renderEmail:${ctx.locale}:${ctx.isCompanyEmail}`);
      wirf("renderEmail");
      return { subject: `Betreff ${ctx.locale}`, html: `<p>${ctx.company.company_name}</p>` };
    },
    sendEmail: async (args) => {
      auf.spur.push(`sendEmail:${args.to}:${args.apiKey}`);
      auf.mails.push(args);
      if (o.sendWirft?.(args)) throw new Error("provider down");
      return o.sendErgebnis ? o.sendErgebnis(args) : { id: "provider-id-999" };
    },
    logEmail: async (entry) => {
      auf.spur.push(`logEmail:${entry.status}`);
      auf.logs.push(entry);
      if (o.logWirft) throw new Error(`WURF-SENTINEL:logEmail:${JWT}`);
    },
    toLocale: (v) => {
      wirf("toLocale");
      return v === "fr" ? "fr" : v === "en" ? "en" : "de";
    },
    defaultResendApiKey: () => {
      wirf("defaultResendApiKey");
      return "globalKey" in o ? o.globalKey : GLOBAL_KEY;
    },
    defaultFrom: () => {
      wirf("defaultFrom");
      return "Offerio <no-reply@example.test>";
    },
    log: (step, details) => auf.protokoll.push({ step, details }),
  };

  return { deps, auf };
};

const alleSpuren = (auf: Aufzeichnung, antwort?: unknown) =>
  JSON.stringify({
    spur: auf.spur,
    mails: auf.mails,
    logs: auf.logs,
    protokoll: auf.protokoll,
    antwort,
  });

// ── Form ────────────────────────────────────────────────────────────────────

describe("parseConfirmationRequest", () => {
  it("nimmt genau ein Feld", () => {
    expect(ALLOWED_FIELDS).toEqual(["appointmentId"]);
    expect(parseConfirmationRequest({ appointmentId: TERMIN })).toEqual({ ok: true, appointmentId: TERMIN });
  });

  it.each([null, [], "text", 42, true])("weist den Nicht-Objekt-Koerper %s ab", (v) => {
    expect(parseConfirmationRequest(v)).toMatchObject({ ok: false, reason: "body_not_object" });
  });

  it.each(["", "kaputt", 42, null, undefined, TERMIN.slice(0, -1)])(
    "weist die unformatierte id %s ab",
    (id) => {
      expect(parseConfirmationRequest({ appointmentId: id })).toMatchObject({
        ok: false,
        reason: "appointmentId_invalid",
      });
    },
  );

  it.each(REJECTED_LEGACY_FIELDS)("weist das Zusatzfeld %s einzeln ab", (feld) => {
    const r = parseConfirmationRequest({ appointmentId: TERMIN, [feld]: "beliebig" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(feld);
  });
});

describe("extractBearerToken", () => {
  it("nimmt genau das erwartete Format", () => {
    expect(extractBearerToken(`Bearer ${JWT}`)).toBe(JWT);
  });

  it.each([
    null,
    undefined,
    "",
    "Bearer",
    "Bearer ",
    "bearer abc",
    "BEARER abc",
    "Basic abc",
    `Bearer ${JWT} extra`,
    `  Bearer ${JWT}`,
    42,
  ])("weist %s ab", (h) => {
    expect(extractBearerToken(h as string | null)).toBeNull();
  });
});

// ── Methode und Nachweis ────────────────────────────────────────────────────

describe("Methode und Nachweis", () => {
  it("beantwortet OPTIONS, ohne den Koerper zu lesen", async () => {
    const { deps, auf } = macheDeps();
    const { stream, zaehler } = zaehlenderStrom([fuell(4096)]);
    const r = await handleAppointmentConfirmation(deps, {
      method: "OPTIONS",
      authorization: null,
      contentLength: "4096",
      body: stream,
    });
    expect(r.status).toBe(200);
    expect(r.body).toBeNull();
    expect(zaehler.pulls).toBe(0);
    expect(auf.spur).toEqual([]);
  });

  it.each(["GET", "PUT", "PATCH", "DELETE", "HEAD"])(
    "lehnt %s ab, ohne ein Byte zu lesen",
    async (m) => {
      const { deps, auf } = macheDeps();
      const { stream, zaehler } = zaehlenderStrom([fuell(4096), fuell(4096)]);
      const r = await handleAppointmentConfirmation(deps, {
        method: m,
        authorization: `Bearer ${JWT}`,
        contentLength: null,
        body: stream,
      });
      expect(r.status).toBe(405);
      expect(r.headers?.Allow).toBe("POST, OPTIONS");
      expect(zaehler.pulls).toBe(0);
      expect(auf.spur).toEqual([]);
    },
  );

  it.each([null, "", "Bearer", "Bearer ", "Basic abc", `Bearer ${JWT} extra`])(
    "antwortet auf den Kopf %s mit 401, ohne den Koerper zu lesen",
    async (h) => {
      const { deps, auf } = macheDeps();
      const { stream, zaehler } = zaehlenderStrom([bytes(koerper())]);
      const r = await handleAppointmentConfirmation(deps, {
        method: "POST",
        authorization: h,
        contentLength: null,
        body: stream,
      });
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: "unauthorized" });
      expect(zaehler.pulls).toBe(0);
      expect(auf.spur).toEqual([]);
    },
  );

  it.each([
    ["ungueltiges Token", { user: null }],
    ["Benutzer ohne id", { user: { userId: "" } as { userId: string } }],
    ["Auth wirft", { authWirft: true }],
  ])("antwortet bei %s mit 401 und fasst die Datenbank nicht an", async (_was, o) => {
    const { deps, auf } = macheDeps(o as Optionen);
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(401);
    expect(auf.spur.filter((s) => s.startsWith("loadAppointment"))).toEqual([]);
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });
});

// ── Koerper ─────────────────────────────────────────────────────────────────

describe("Koerper", () => {
  it("lehnt eine angekuendigte Ueberlaenge ab, ohne zu lesen", async () => {
    const { deps, auf } = macheDeps();
    const { stream, zaehler } = zaehlenderStrom([fuell(8193)]);
    const r = await handleAppointmentConfirmation(deps, {
      method: "POST",
      authorization: `Bearer ${JWT}`,
      contentLength: "8193",
      body: stream,
    });
    expect(r.status).toBe(413);
    expect(zaehler.pulls).toBe(0);
    expect(auf.spur).toEqual(["authenticate"]);
  });

  it("bricht einen zu grossen Datenstrom ab", async () => {
    const { deps, auf } = macheDeps();
    const { stream, zaehler } = zaehlenderStrom([fuell(4096), fuell(4096), fuell(1)]);
    const r = await handleAppointmentConfirmation(deps, {
      method: "POST",
      authorization: `Bearer ${JWT}`,
      contentLength: null,
      body: stream,
    });
    expect(r.status).toBe(413);
    expect(zaehler.pulls).toBe(3);
    expect(zaehler.cancels).toBe(1);
    expect(auf.spur).toEqual(["authenticate"]);
  });

  it.each(["{ kein json", "[]", "null", '"text"', "42"])(
    "lehnt den Koerper %s mit 400 ab",
    async (roh) => {
      const { deps, auf } = macheDeps();
      const r = await handleAppointmentConfirmation(deps, post(roh));
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: "invalid_request" });
      expect(auf.spur).toEqual(["authenticate"]);
    },
  );

  it.each(REJECTED_LEGACY_FIELDS)("lehnt das Zusatzfeld %s ab, ohne die Zeile zu laden", async (feld) => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentConfirmation(deps, post(koerper({ [feld]: "angreifer@example.test" })));
    expect(r.status).toBe(400);
    expect(auf.spur).toEqual(["authenticate"]);
  });
});

// ── Autorisierung ───────────────────────────────────────────────────────────

describe("Autorisierung", () => {
  it("antwortet bei unbekanntem Termin mit einem generischen 404", async () => {
    const { deps, auf } = macheDeps({ appointment: null });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "not_found" });
    expect(auf.spur).toEqual(["authenticate", `loadAppointment:${TERMIN}`]);
  });

  it("antwortet bei fremder Firma EXAKT gleich — kein Orakel", async () => {
    const fremd = macheDeps({
      appointment: termin({ company_id: FREMDE_FIRMA }),
      membership: { ok: true, isMember: false },
    });
    const unbekannt = macheDeps({ appointment: null });
    const a = await handleAppointmentConfirmation(fremd.deps, post(koerper()));
    const b = await handleAppointmentConfirmation(unbekannt.deps, post(koerper()));
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
    expect(a.headers).toEqual(b.headers);
  });

  it("liest bei fremder Firma kein Geheimnis und schickt nichts", async () => {
    const { deps, auf } = macheDeps({
      appointment: termin({ company_id: FREMDE_FIRMA }),
      membership: { ok: true, isMember: false },
    });
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(auf.spur).toEqual([
      "authenticate",
      `loadAppointment:${TERMIN}`,
      `isCompanyMember:${BENUTZER}:${FREMDE_FIRMA}`,
    ]);
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });

  it("verraet bei fremder Firma auch keinen skipped-Grund", async () => {
    for (const over of [
      { appointment_type: "blocked" },
      { customer_email: null },
    ] as Array<Partial<AppointmentRow>>) {
      const { deps } = macheDeps({
        appointment: termin({ ...over, company_id: FREMDE_FIRMA }),
        membership: { ok: true, isMember: false },
      });
      const r = await handleAppointmentConfirmation(deps, post(koerper()));
      expect(r.body).toEqual({ error: "not_found" });
    }
  });

  it("meldet einen Fehler der Mitgliedschaftsabfrage als Stoerung, nicht als Absage", async () => {
    const { deps, auf } = macheDeps({ membership: { ok: false } });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: "service_unavailable" });
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });

  it("prueft die Zugehoerigkeit gegen die Firma AUS DER ZEILE", async () => {
    const { deps, auf } = macheDeps({ appointment: termin({ company_id: FREMDE_FIRMA }) });
    await handleAppointmentConfirmation(deps, post(koerper({})));
    expect(auf.spur).toContain(`isCompanyMember:${BENUTZER}:${FREMDE_FIRMA}`);
  });

  it("verlangt keine Rolle — jedes Mitglied genuegt", async () => {
    const { deps } = macheDeps({ membership: { ok: true, isMember: true } });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(200);
  });
});

// ── Nach der Autorisierung ──────────────────────────────────────────────────

describe("Uebersprungene Faelle", () => {
  it.each(SKIP_TYPES)("ueberspringt den Typ %s", async (typ) => {
    const { deps, auf } = macheDeps({ appointment: termin({ appointment_type: typ }) });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, skipped: true, reason: "type" });
    expect(auf.spur.some((s) => s.startsWith("loadSecrets"))).toBe(false);
    expect(auf.mails).toHaveLength(0);
  });

  it("ueberspringt ohne Kundenadresse", async () => {
    const { deps, auf } = macheDeps({ appointment: termin({ customer_email: null }) });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.body).toEqual({ success: true, skipped: true, reason: "no_email" });
    expect(auf.spur.some((s) => s.startsWith("loadCompany"))).toBe(false);
  });

  it("ueberspringt ohne jeden Resend-Schluessel", async () => {
    const { deps, auf } = macheDeps({ globalKey: undefined, secrets: { resend_api_key: null } });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.body).toEqual({ success: true, skipped: true, reason: "no_api_key" });
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });

  it("meldet eine fehlende Firmenzeile als 404", async () => {
    const { deps } = macheDeps({ company: null });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "not_found" });
  });
});

// ── Versand ─────────────────────────────────────────────────────────────────

describe("Versand", () => {
  it("schickt an die Adresse AUS DER ZEILE, in deren Sprache", async () => {
    const { deps, auf } = macheDeps({ appointment: termin({ customer_email: "echt@example.test", language: "fr" }) });
    const r = await handleAppointmentConfirmation(
      deps,
      post(koerper()),
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
    expect(auf.mails[0].to).toBe("echt@example.test");
    expect(auf.spur).toContain("renderEmail:fr:false");
    expect(auf.logs[0].language).toBe("fr");
  });

  it("benutzt den eigenen Zugang der Firma, wenn er vollstaendig ist", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test", resend_from_name: "Muster" }),
      secrets: { resend_api_key: FIRMEN_KEY },
    });
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(auf.mails[0].apiKey).toBe(FIRMEN_KEY);
    expect(auf.mails[0].from).toBe("Muster <info@firma.test>");
    expect(auf.logs[0].metadata?.isCompanyEmail).toBe(true);
  });

  it("faellt bei einem Fehler des Firmenzugangs auf den allgemeinen zurueck", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
      sendErgebnis: (a) => (a.apiKey === FIRMEN_KEY ? { error: { name: "domain_not_verified" } } : { id: "x" }),
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mails.map((m) => m.apiKey)).toEqual([FIRMEN_KEY, GLOBAL_KEY]);
    expect(auf.logs).toHaveLength(1);
    expect(auf.logs[0].status).toBe("sent");
    expect(auf.logs[0].metadata?.isCompanyEmail).toBe(false);
  });

  it("meldet einen Fehlschlag, wenn auch der allgemeine Zugang versagt", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
      sendErgebnis: () => ({ error: { name: "rate_limit" } }),
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ error: "email_send_failed" });
    expect(auf.logs[0].status).toBe("failed");
    expect(auf.logs[0].errorMessage).toBe("resend_error");
  });

  it("wertet einen geworfenen Anbieterfehler ebenfalls als Fehlschlag", async () => {
    const { deps, auf } = macheDeps({ sendWirft: () => true });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(502);
    expect(auf.logs[0].status).toBe("failed");
  });

  it("wiederholt ohne eigenen Firmenzugang nicht", async () => {
    const { deps, auf } = macheDeps({ sendErgebnis: () => ({ error: { name: "x" } }) });
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(auf.mails).toHaveLength(1);
  });

  it("bleibt bei einem Protokollfehler beim richtigen Ergebnis", async () => {
    const { deps } = macheDeps({ logWirft: true });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });
});

// ── Ordnung und Verschwiegenheit ────────────────────────────────────────────

describe("Ordnung und Verschwiegenheit", () => {
  it("haelt die vorgeschriebene Reihenfolge ein", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
    });
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(auf.spur).toEqual([
      "authenticate",
      `loadAppointment:${TERMIN}`,
      `isCompanyMember:${BENUTZER}:${FIRMA}`,
      `loadCompany:${FIRMA}`,
      `loadSecrets:${FIRMA}`,
      "renderEmail:fr:true",
      `sendEmail:kundin@example.test:${FIRMEN_KEY}`,
      "logEmail:sent",
    ]);
  });

  it("liest in keinem Abbruchzweig ein Geheimnis", async () => {
    const faelle: Optionen[] = [
      { user: null },
      { appointment: null },
      { membership: { ok: true, isMember: false } },
      { membership: { ok: false } },
      { appointment: termin({ appointment_type: "blocked" }) },
      { appointment: termin({ customer_email: null }) },
    ];
    for (const o of faelle) {
      const { deps, auf } = macheDeps(o);
      await handleAppointmentConfirmation(deps, post(koerper()));
      expect(auf.spur.filter((s) => s.startsWith("loadSecrets"))).toEqual([]);
    }
  });

  it("laesst das JWT nirgends austreten", async () => {
    const faelle: Optionen[] = [
      {},
      { user: null },
      { appointment: null },
      { membership: { ok: false } },
      { sendErgebnis: () => ({ error: { name: "x", token: JWT } }) },
    ];
    for (const o of faelle) {
      const { deps, auf } = macheDeps(o);
      const r = await handleAppointmentConfirmation(deps, post(koerper()));
      // Der einzige erlaubte Ort ist das Argument von `authenticate`.
      expect(auf.tokens.every((t) => t === JWT)).toBe(true);
      expect(alleSpuren(auf, r.body)).not.toContain(JWT);
    }
  });

  it("gibt weder Schluessel noch Anbieterobjekt heraus", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
      sendErgebnis: () => ({ error: { name: "domain_not_verified", message: "SEHR-INTERN" } }),
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    const sichtbar = JSON.stringify({ antwort: r.body, logs: auf.logs, protokoll: auf.protokoll });
    expect(sichtbar).not.toContain(FIRMEN_KEY);
    expect(sichtbar).not.toContain(GLOBAL_KEY);
    expect(sichtbar).not.toContain("SEHR-INTERN");
    expect(sichtbar).not.toContain("domain_not_verified");
  });

  it("nennt die Kundenadresse nur dort, wo sie hingehoert", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    // In der Protokollzeile und in der Antwort: nein.
    expect(JSON.stringify(auf.protokoll)).not.toContain("kundin@example.test");
    expect(JSON.stringify(r.body)).not.toContain("kundin@example.test");
    // In der Empfaengerspalte des Protokolleintrags: ja, dafuer ist sie da.
    expect(auf.logs[0].recipientEmail).toBe("kundin@example.test");
    expect(JSON.stringify(auf.logs[0].metadata)).not.toContain("kundin@example.test");
  });

  it("legt in den Metadaten nur Technisches ab", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(Object.keys(auf.logs[0].metadata ?? {}).sort()).toEqual([
      "appointmentId",
      "appointmentType",
      "isCompanyEmail",
    ]);
  });

  it("gibt die Kennung des Anbieters nicht zurueck", async () => {
    const { deps } = macheDeps({ sendErgebnis: () => ({ id: "provider-id-999" }) });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(JSON.stringify(r.body)).not.toContain("provider-id-999");
  });

  it("laesst kein Koerperfeld einen Empfaenger bestimmen", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentConfirmation(
      deps,
      post(koerper({ to: "angreifer@example.test", customerEmail: "angreifer@example.test" })),
    );
    expect(r.status).toBe(400);
    expect(auf.mails).toHaveLength(0);
  });
});

// ── Was diese Stufe NICHT verspricht ────────────────────────────────────────

describe("Keine Einmaligkeit", () => {
  it("schickt bei zwei berechtigten Aufrufen ZWEI Mails", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentConfirmation(deps, post(koerper()));
    await handleAppointmentConfirmation(deps, post(koerper()));
    // Festgehalten, nicht beklagt: diese Stufe macht Autorisierung, keine
    // Einmaligkeit. Es gibt keine Sperre und keine eindeutige Nebenbedingung,
    // und `email_logs` wird vor dem Senden nicht befragt.
    expect(auf.mails).toHaveLength(2);
    expect(auf.logs).toHaveLength(2);
  });

  it("schickt auch bei verschraenkten Aufrufen zwei Mails", async () => {
    const { deps, auf } = macheDeps();
    await Promise.all([
      handleAppointmentConfirmation(deps, post(koerper())),
      handleAppointmentConfirmation(deps, post(koerper())),
    ]);
    expect(auf.mails).toHaveLength(2);
  });
});

// ── Abfragefehler sind Stoerungen, keine Absagen ────────────────────────────

describe("Dreiwertige Nachschlagevorgaenge", () => {
  it("meldet einen Fehler der Terminabfrage als 503, nicht als 404", async () => {
    const { deps, auf } = macheDeps({ appointmentLookup: { ok: false } });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: "service_unavailable" });
    expect(auf.spur).toEqual(["authenticate", `loadAppointment:${TERMIN}`]);
  });

  it("meldet einen Fehler der Firmenabfrage als 503", async () => {
    const { deps, auf } = macheDeps({ companyLookup: { ok: false } });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(auf.spur.some((s) => s.startsWith("loadSecrets"))).toBe(false);
    expect(auf.mails).toHaveLength(0);
  });

  it("weicht bei einem Fehler der Geheimnisabfrage NICHT still auf den allgemeinen Zugang aus", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secretsLookup: { ok: false },
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(503);
    // Genau das ist der Punkt: keine Mail unter fremder Absenderidentitaet,
    // nur weil die Datenbank klemmte.
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });

  it("behandelt eine fehlende Geheimniszeile weiterhin als 'kein Schluessel'", async () => {
    const { deps, auf } = macheDeps({
      secretsLookup: { ok: true, value: null },
      globalKey: undefined,
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.body).toEqual({ success: true, skipped: true, reason: "no_api_key" });
    expect(auf.mails).toHaveLength(0);
  });

  it("haelt die Gleichheit von 'gibt es nicht' und 'fremde Firma' aufrecht", async () => {
    const fremd = macheDeps({
      appointment: termin({ company_id: FREMDE_FIRMA }),
      membership: { ok: true, isMember: false },
    });
    const fehlt = macheDeps({ appointment: null });
    const a = await handleAppointmentConfirmation(fremd.deps, post(koerper()));
    const b = await handleAppointmentConfirmation(fehlt.deps, post(koerper()));
    expect(a).toEqual(b);
    // Und beide unterscheiden sich von der Stoerung.
    const gestoert = macheDeps({ appointmentLookup: { ok: false } });
    const c = await handleAppointmentConfirmation(gestoert.deps, post(koerper()));
    expect(c.status).not.toBe(a.status);
  });
});

// ── Kein Wurf entkommt ──────────────────────────────────────────────────────

describe("Unerwartete Ausnahmen", () => {
  const WERFENDE = [
    "loadAppointment",
    "isCompanyMember",
    "loadCompany",
    "loadSecrets",
    "toLocale",
    "renderEmail",
    "defaultResendApiKey",
    "defaultFrom",
  ];

  it.each(WERFENDE)("faengt einen Wurf in %s ab und antwortet generisch", async (name) => {
    const { deps, auf } = macheDeps({
      wirftIn: name,
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
    });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: "service_unavailable" });
    // Weder das Kennzeichen der Ausnahme noch das JWT treten aus.
    const sichtbar = alleSpuren(auf, r.body);
    expect(sichtbar).not.toContain("WURF-SENTINEL");
    expect(sichtbar).not.toContain(JWT);
  });

  it.each(WERFENDE)("verschickt bei einem Wurf in %s nichts und protokolliert nichts", async (name) => {
    const { deps, auf } = macheDeps({
      wirftIn: name,
      company: firma({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
    });
    await handleAppointmentConfirmation(deps, post(koerper()));
    expect(auf.mails).toHaveLength(0);
    expect(auf.logs).toHaveLength(0);
  });

  it("faengt auch einen Wurf beim Anmelden ab", async () => {
    const { deps, auf } = macheDeps({ authWirft: true });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    // Hier bleibt es beim 401: „kein Nachweis" ist die richtige Auskunft.
    expect(r.status).toBe(401);
    expect(alleSpuren(auf, r.body)).not.toContain(JWT);
  });

  it("dreht ein erfolgreiches Ergebnis nicht um, wenn nur das Protokoll scheitert", async () => {
    const { deps, auf } = macheDeps({ logWirft: true });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
    expect(auf.mails).toHaveLength(1);
    expect(alleSpuren(auf, r.body)).not.toContain("WURF-SENTINEL");
  });

  it("bleibt beim 502, wenn Versand UND Protokoll scheitern", async () => {
    const { deps } = macheDeps({ sendErgebnis: () => ({ error: { name: "x" } }), logWirft: true });
    const r = await handleAppointmentConfirmation(deps, post(koerper()));
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ error: "email_send_failed" });
  });

  it("antwortet auf einen unlesbaren Datenstrom mit 400", async () => {
    const { deps, auf } = macheDeps();
    const gesperrt = zaehlenderStrom([bytes(koerper())]).stream;
    gesperrt.getReader(); // Sperre halten — ein zweiter getReader() wirft.
    const r = await handleAppointmentConfirmation(deps, {
      method: "POST",
      authorization: `Bearer ${JWT}`,
      contentLength: null,
      body: gesperrt,
    });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid_request" });
    expect(auf.spur).toEqual(["authenticate"]);
  });

  it("nennt im Protokoll nur ein Kennzeichen, nie die Ausnahme", async () => {
    const { deps, auf } = macheDeps({ wirftIn: "loadCompany" });
    await handleAppointmentConfirmation(deps, post(koerper()));
    const zeile = auf.protokoll.find((p) => p.step === "Unhandled dependency failure");
    expect(zeile).toBeDefined();
    expect(zeile?.details).toBeUndefined();
    expect(JSON.stringify(auf.protokoll)).not.toContain("WURF-SENTINEL");
  });
});

// ── Wo das Fangnetz beginnt ─────────────────────────────────────────────────
//
// Der Guard faengt alles ab, was aus den Abhaengigkeiten kommt. Er kann aber
// nichts abfangen, was passiert, BEVOR er aufgerufen wird — und der Aufbau der
// Anbindung gehoert dazu: `Deno.env.get` liefert `undefined`, wenn eine
// Variable fehlt, und `createClient(undefined, undefined)` wirft dann
// `supabaseUrl is required`. Diese Ausnahme traegt ihre Meldung bis in die
// Antwort der Laufzeit.
//
// Die Datei laesst sich hier nicht laden (Deno-Globals, `https://`-Importe),
// deshalb wird die REIHENFOLGE im Quelltext gemessen — nicht ein Wort in einem
// Kommentar gesucht.

describe("send-appointment-confirmation — Aufbau innerhalb des Fangnetzes", () => {
  const quelle = readFileSync(
    new URL("../../send-appointment-confirmation/index.ts", import.meta.url),
    "utf8",
  );
  const rumpf = quelle.slice(quelle.indexOf("serve(async (req"));

  /** Position des ersten Vorkommens im Rumpf des Callbacks. */
  const stelle = (was: string): number => {
    const i = rumpf.indexOf(was);
    expect(i, `nicht gefunden: ${was}`).toBeGreaterThan(-1);
    return i;
  };

  it("beantwortet OPTIONS vor allem anderen", () => {
    expect(stelle('req.method === "OPTIONS"')).toBeLessThan(stelle("const supabase = createClient("));
  });

  it("beginnt das schuetzende try VOR dem Auflesen der Umgebung", () => {
    expect(stelle("try {")).toBeLessThan(stelle("Deno.env.get("));
  });

  it("beginnt das schuetzende try VOR dem Anlegen des Clients", () => {
    // Auf die Zuweisung verankert, nicht auf den blossen Aufrufnamen: ein
    // Kommentar, der den Aufruf erwaehnt, soll die Messung nicht verschieben.
    expect(stelle("try {")).toBeLessThan(stelle("const supabase = createClient("));
  });

  it("beginnt das schuetzende try VOR dem Aufbau der Abhaengigkeiten", () => {
    expect(stelle("try {")).toBeLessThan(stelle("const deps"));
  });

  it("umschliesst auch Aufruf und Antwortbau", () => {
    const schutz = stelle("try {");
    expect(schutz).toBeLessThan(stelle("handleAppointmentConfirmation(deps"));
    expect(schutz).toBeLessThan(stelle("new Response(JSON.stringify(ergebnis.body)"));
  });

  it("antwortet im Fangnetz generisch und ohne Inhalt", () => {
    const fang = rumpf.slice(rumpf.lastIndexOf("} catch {"));
    expect(fang).toContain('"service_unavailable"');
    expect(fang).toContain("503");
    // Kein Fehlerobjekt, keine Meldung, kein Stapel.
    expect(fang).not.toContain("error.message");
    expect(fang).not.toContain("String(error)");
    expect(fang).not.toContain("JSON.stringify(error");
    expect(fang).not.toMatch(/catch\s*\(/);
  });
});
