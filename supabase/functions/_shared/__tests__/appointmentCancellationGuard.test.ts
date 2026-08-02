import { describe, expect, it } from "vitest";
import {
  ALLOWED_FIELDS,
  MAX_BODY_BYTES,
  MAX_REASON_LENGTH,
  REJECTED_LEGACY_FIELDS,
  bodyByteLength,
  handleAppointmentCancellation,
  parseCancellationRequest,
  readBoundedUtf8,
  type AppointmentCancellationDeps,
  type AppointmentRow,
  type CancelResultRow,
  type CompanySecretsLike,
  type CompanyRow,
  type EmailLogEntry,
  type SendArgs,
} from "../appointmentCancellationGuard.ts";

const TERMIN_ID = "11111111-2222-3333-4444-555555555555";
const FIRMA_ID = "99999999-8888-7777-6666-555555555555";
const TOKEN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const koerper = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ appointmentId: TERMIN_ID, actionToken: TOKEN, ...over });

/**
 * Ein Datenstrom, der mitzaehlt. Ohne Zaehler laesst sich nicht pruefen, ob der
 * Koerper WIRKLICH ungelesen bleibt — ein Test, der nur das Ergebnis ansieht,
 * uebersieht genau den Fehler, um den es hier geht.
 */
const zaehlenderStrom = (stuecke: Uint8Array[]) => {
  const zaehler = { pulls: 0, cancels: 0 };
  let i = 0;
  // highWaterMark: 0 ist hier keine Feinheit, sondern Voraussetzung. Mit der
  // Voreinstellung 1 ruft ReadableStream `pull` schon beim Anlegen auf, um die
  // interne Warteschlange zu fuellen — der Zaehler stuende dann auf 1, ohne
  // dass jemand gelesen haette, und der Test wuerde etwas anderes messen als
  // gemeint.
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
    { highWaterMark: 0 },
  );
  return { stream, zaehler };
};

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const fuellStueck = (n: number): Uint8Array => new Uint8Array(n).fill(0x78); // "x"

/** POST mit ehrlichem Content-Length und dem Text als einem Stueck. */
const post = (rawBody: string) => ({
  method: "POST",
  contentLength: String(bodyByteLength(rawBody)),
  body: zaehlenderStrom([bytes(rawBody)]).stream,
});

/** POST, bei dem der Test den Datenstrom selbst in der Hand behaelt. */
const postStrom = (stuecke: Uint8Array[], contentLength: string | null) => {
  const { stream, zaehler } = zaehlenderStrom(stuecke);
  return { req: { method: "POST", contentLength, body: stream }, zaehler };
};

const terminZeile = (over: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id: TERMIN_ID,
  company_id: FIRMA_ID,
  title: "Besichtigung Zürich",
  appointment_date: "2026-09-10",
  start_time: "09:00:00",
  customer_first_name: "Anna",
  customer_last_name: "Beispiel",
  customer_email: "kundin@example.test",
  language: "fr",
  ...over,
});

const firmaZeile = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  id: FIRMA_ID,
  company_name: "Muster Umzug AG",
  email: "info@example.test",
  notification_email: null,
  default_language: "de",
  resend_enabled: false,
  resend_from_email: null,
  resend_from_name: null,
  ...over,
});

const treffer = (over: Partial<CancelResultRow> = {}): CancelResultRow => ({
  result_code: "cancelled_now",
  appointment_id: TERMIN_ID,
  company_id: FIRMA_ID,
  status: "cancelled",
  cancelled_at: "2026-08-02T10:00:00.000Z",
  cancellation_reason: "Kunde verhindert",
  ...over,
});

interface Aufzeichnung {
  spur: string[];
  rpcAufrufe: Array<{ appointmentId: string; token: string; reason: string | null }>;
  mails: SendArgs[];
  mailLogs: EmailLogEntry[];
  notifications: Array<Record<string, unknown>>;
  protokoll: Array<{ step: string; details?: Record<string, unknown> }>;
}

interface DoubleOptionen {
  rpc?: { rows: CancelResultRow[] | null; error: unknown };
  appointment?: AppointmentRow | null;
  company?: CompanyRow | null;
  secrets?: CompanySecretsLike;
  sendErgebnis?: (args: SendArgs) => { id?: string; error?: unknown };
  sendWirft?: (args: SendArgs) => boolean;
  notificationWirft?: boolean;
  defaultKey?: string | undefined;
}

/**
 * Aufzeichnende Doubles. Sie merken sich nicht nur, WAS aufgerufen wurde,
 * sondern in welcher REIHENFOLGE — die Ordnungszusicherungen dieses Endpunkts
 * lassen sich sonst nicht pruefen.
 */
const macheDeps = (o: DoubleOptionen = {}): { deps: AppointmentCancellationDeps; auf: Aufzeichnung } => {
  const auf: Aufzeichnung = {
    spur: [],
    rpcAufrufe: [],
    mails: [],
    mailLogs: [],
    notifications: [],
    protokoll: [],
  };

  const deps: AppointmentCancellationDeps = {
    cancelByToken: async (args) => {
      auf.spur.push("cancelByToken");
      auf.rpcAufrufe.push(args);
      return o.rpc ?? { rows: [treffer()], error: null };
    },
    loadAppointment: async (id) => {
      auf.spur.push(`loadAppointment:${id}`);
      return o.appointment === undefined ? terminZeile() : o.appointment;
    },
    loadCompany: async (id) => {
      auf.spur.push(`loadCompany:${id}`);
      return o.company === undefined ? firmaZeile() : o.company;
    },
    loadSecrets: async (id) => {
      auf.spur.push(`loadSecrets:${id}`);
      return o.secrets ?? { resend_api_key: null };
    },
    sendEmail: async (args) => {
      auf.spur.push(`sendEmail:${args.to}`);
      auf.mails.push(args);
      if (o.sendWirft?.(args)) throw new Error("network");
      return o.sendErgebnis ? o.sendErgebnis(args) : { id: "provider-id-999" };
    },
    logEmail: async (entry) => {
      auf.spur.push(`logEmail:${entry.emailType}:${entry.status}`);
      auf.mailLogs.push(entry);
    },
    insertNotification: async (entry) => {
      auf.spur.push("insertNotification");
      auf.notifications.push(entry);
      if (o.notificationWirft) throw new Error("insert failed");
    },
    renderCompanyEmail: () => ({ subject: "Firma-Betreff", html: "<p>firma</p>" }),
    renderCustomerEmail: () => ({ subject: "Kunde-Betreff", html: "<p>kunde</p>" }),
    toLocale: (v) => (v === "fr" ? "fr" : v === "en" ? "en" : "de"),
    defaultResendApiKey: () => ("defaultKey" in o ? o.defaultKey : "re_default"),
    defaultFrom: () => "Kalender <kalender@example.test>",
    appName: () => "Offerio",
    log: (step, details) => {
      auf.protokoll.push({ step, details });
    },
  };

  return { deps, auf };
};

/** Alles, was der Handler nach aussen gegeben oder abgelegt hat, als ein Text. */
const alleSpuren = (auf: Aufzeichnung, antwort?: unknown): string =>
  JSON.stringify({
    spur: auf.spur,
    mails: auf.mails,
    mailLogs: auf.mailLogs,
    notifications: auf.notifications,
    protokoll: auf.protokoll,
    antwort,
  });

// ── Form des Koerpers ───────────────────────────────────────────────────────

describe("parseCancellationRequest", () => {
  it("nimmt genau die drei erlaubten Felder", () => {
    const r = parseCancellationRequest({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: "krank" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toEqual({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: "krank" });
    expect(ALLOWED_FIELDS).toEqual(["appointmentId", "actionToken", "reason"]);
  });

  it("laesst reason weg oder null zu", () => {
    for (const v of [undefined, null]) {
      const body: Record<string, unknown> = { appointmentId: TERMIN_ID, actionToken: TOKEN };
      if (v !== undefined) body.reason = v;
      const r = parseCancellationRequest(body);
      expect(r.ok).toBe(true);
      expect(r.ok && r.value.reason).toBeNull();
    }
  });

  it("weist Nicht-Objekte ab", () => {
    for (const v of [null, [], [1, 2], "text", 42, true]) {
      expect(parseCancellationRequest(v)).toMatchObject({ ok: false, reason: "body_not_object" });
    }
  });

  it("weist eine unformatierte appointmentId ab", () => {
    for (const v of ["", "nicht-uuid", 42, null, TERMIN_ID.slice(0, -1)]) {
      expect(parseCancellationRequest({ appointmentId: v, actionToken: TOKEN })).toMatchObject({
        ok: false,
        reason: "appointmentId_invalid",
      });
    }
  });

  it("weist ein unformatiertes actionToken ab, ohne den Wert zu nennen", () => {
    const r = parseCancellationRequest({ appointmentId: TERMIN_ID, actionToken: "geheim-aber-kaputt" });
    expect(r).toMatchObject({ ok: false, reason: "actionToken_invalid" });
    expect(r.reason).not.toContain("geheim");
  });

  it("weist reason mit falschem Typ ab", () => {
    for (const v of [42, {}, [], true]) {
      expect(parseCancellationRequest({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: v })).toMatchObject({
        ok: false,
        reason: "reason_not_string",
      });
    }
  });

  it("nimmt 2000 Zeichen an und weist 2001 ab", () => {
    expect(
      parseCancellationRequest({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: "x".repeat(MAX_REASON_LENGTH) }).ok,
    ).toBe(true);
    expect(
      parseCancellationRequest({
        appointmentId: TERMIN_ID,
        actionToken: TOKEN,
        reason: "x".repeat(MAX_REASON_LENGTH + 1),
      }),
    ).toMatchObject({ ok: false, reason: "reason_too_long" });
  });

  it.each(REJECTED_LEGACY_FIELDS)("weist das alte Feld %s einzeln ab", (feld) => {
    const r = parseCancellationRequest({ appointmentId: TERMIN_ID, actionToken: TOKEN, [feld]: "beliebig" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(feld);
  });

  it("weist alle alten Felder auch gemeinsam ab", () => {
    const body: Record<string, unknown> = { appointmentId: TERMIN_ID, actionToken: TOKEN };
    for (const f of REJECTED_LEGACY_FIELDS) body[f] = "beliebig";
    expect(parseCancellationRequest(body).ok).toBe(false);
  });
});

// ── HTTP-Vertrag ────────────────────────────────────────────────────────────

describe("handleAppointmentCancellation — HTTP", () => {
  it("beantwortet OPTIONS ohne jeden Seiteneffekt und ohne den Koerper zu lesen", async () => {
    const { deps, auf } = macheDeps();
    const ohneLesen = postStrom([fuellStueck(4096)], "4096");
    const r = await handleAppointmentCancellation(deps, { ...ohneLesen.req, method: "OPTIONS" });
    expect(r.status).toBe(200);
    expect(r.body).toBeNull();
    expect(auf.spur).toEqual([]);
    expect(ohneLesen.zaehler.pulls).toBe(0);
  });

  it("lehnt GET mit 405 und Allow-Kopf ab, ohne den Koerper zu lesen", async () => {
    const { deps, auf } = macheDeps();
    const ohneLesen = postStrom([fuellStueck(4096)], "4096");
    const r = await handleAppointmentCancellation(deps, { ...ohneLesen.req, method: "GET" });
    expect(r.status).toBe(405);
    expect(r.headers?.Allow).toBe("POST, OPTIONS");
    expect(auf.spur).toEqual([]);
    expect(ohneLesen.zaehler.pulls).toBe(0);
  });

  it.each(["PUT", "PATCH", "DELETE", "HEAD"])("lehnt %s ab, ohne ein Byte zu lesen", async (m) => {
    const { deps, auf } = macheDeps();
    const ohneLesen = postStrom([fuellStueck(4096), fuellStueck(4096)], null);
    const r = await handleAppointmentCancellation(deps, { ...ohneLesen.req, method: m });
    expect(r.status).toBe(405);
    expect(r.headers?.Allow).toBe("POST, OPTIONS");
    expect(auf.spur).toEqual([]);
    expect(ohneLesen.zaehler.pulls).toBe(0);
  });

  it("lehnt einen Koerper ueber 8 KiB ab, ohne irgendetwas aufzurufen", async () => {
    const { deps, auf } = macheDeps();
    const gross = JSON.stringify({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: "x".repeat(MAX_BODY_BYTES) });
    expect(bodyByteLength(gross)).toBeGreaterThan(MAX_BODY_BYTES);
    const r = await handleAppointmentCancellation(deps, post(gross));
    expect(r.status).toBe(413);
    expect(auf.spur).toEqual([]);
  });

  it("misst die Grenze in Bytes, nicht in Zeichen", async () => {
    // 3000 Emoji sind 3000 Zeichen, aber 12000 Bytes.
    const { deps, auf } = macheDeps();
    const emoji = JSON.stringify({ appointmentId: TERMIN_ID, actionToken: TOKEN, reason: "🙂".repeat(3000) });
    expect(emoji.length).toBeLessThan(MAX_BODY_BYTES * 2);
    const r = await handleAppointmentCancellation(deps, post(emoji));
    expect(r.status).toBe(413);
    expect(auf.spur).toEqual([]);
  });

  it("lehnt kaputtes JSON mit 400 ab", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentCancellation(deps, post("{ das ist kein json"));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid_request" });
    expect(auf.spur).toEqual([]);
  });

  it.each(["[]", "null", '"text"', "42"])("lehnt den Nicht-Objekt-Koerper %s ab", async (roh) => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentCancellation(deps, post(roh));
    expect(r.status).toBe(400);
    expect(auf.spur).toEqual([]);
  });

  it("beruehrt bei ungueltiger Anfrage die Datenbank nicht", async () => {
    const faelle = [
      koerper({ appointmentId: "kaputt" }),
      koerper({ actionToken: "kaputt" }),
      koerper({ reason: 42 }),
      koerper({ reason: "x".repeat(MAX_REASON_LENGTH + 1) }),
      koerper({ companyEmail: "angreifer@example.test" }),
    ];
    for (const b of faelle) {
      const { deps, auf } = macheDeps();
      const r = await handleAppointmentCancellation(deps, post(b));
      expect(r.status).toBe(400);
      expect(auf.rpcAufrufe).toHaveLength(0);
      expect(auf.spur).toEqual([]);
    }
  });
});

// ── Ergebnis der RPC ────────────────────────────────────────────────────────

describe("handleAppointmentCancellation — RPC-Ergebnisse", () => {
  it("reicht Koerperfelder unveraendert an die RPC weiter", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper({ reason: "krank" })));
    expect(auf.rpcAufrufe).toEqual([{ appointmentId: TERMIN_ID, token: TOKEN, reason: "krank" }]);
  });

  it("schickt ohne reason ein null weiter", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.rpcAufrufe[0].reason).toBeNull();
  });

  it("antwortet auf einen RPC-Fehler mit 503 und ohne Folgeschritte", async () => {
    const { deps, auf } = macheDeps({ rpc: { rows: null, error: { message: "boom", token: TOKEN } } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: "service_unavailable" });
    expect(auf.spur).toEqual(["cancelByToken"]);
    expect(alleSpuren(auf, r.body)).not.toContain(TOKEN);
  });

  it("antwortet ohne Treffer mit 403 und einer nichtssagenden Begruendung", async () => {
    const { deps, auf } = macheDeps({ rpc: { rows: [], error: null } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ error: "invalid_or_expired" });
    expect(auf.spur).toEqual(["cancelByToken"]);
  });

  it("antwortet auf not_cancellable mit 409 und verraet den Status nicht", async () => {
    const { deps, auf } = macheDeps({
      rpc: { rows: [treffer({ result_code: "not_cancellable", status: "no_show" })], error: null },
    });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: "not_cancellable" });
    expect(JSON.stringify(r.body)).not.toContain("no_show");
    expect(auf.spur).toEqual(["cancelByToken"]);
    expect(auf.mails).toHaveLength(0);
    expect(auf.notifications).toHaveLength(0);
    expect(auf.mailLogs).toHaveLength(0);
  });

  it("antwortet auf already_cancelled mit 200 und laedt nichts nach", async () => {
    const { deps, auf } = macheDeps({
      rpc: { rows: [treffer({ result_code: "already_cancelled" })], error: null },
    });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, result: "already_cancelled" });
    // Weder Firma noch Geheimnisse noch Mail noch Notification.
    expect(auf.spur).toEqual(["cancelByToken"]);
  });

  it.each(["", "vielleicht", "CANCELLED_NOW", "cancelled", "ok"])(
    "antwortet auf den unbekannten Ergebniscode %s mit 503",
    async (code) => {
      const { deps, auf } = macheDeps({ rpc: { rows: [treffer({ result_code: code })], error: null } });
      const r = await handleAppointmentCancellation(deps, post(koerper()));
      expect(r.status).toBe(503);
      expect(auf.spur).toEqual(["cancelByToken"]);
    },
  );

  it("antwortet auf mehr als eine Ergebniszeile mit 503", async () => {
    const { deps, auf } = macheDeps({ rpc: { rows: [treffer(), treffer()], error: null } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(auf.spur).toEqual(["cancelByToken"]);
  });

  it.each([null, undefined, {}, "text"])("antwortet auf die unbrauchbare Ergebnisform %s mit 503", async (rows) => {
    const { deps, auf } = macheDeps({ rpc: { rows: rows as never, error: null } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(503);
    expect(auf.spur).toEqual(["cancelByToken"]);
  });

  it("antwortet auf eine Zeile ohne Ergebniscode mit 503", async () => {
    const { deps } = macheDeps({ rpc: { rows: [{ appointment_id: TERMIN_ID } as never], error: null } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(503);
  });
});

// ── cancelled_now: Reihenfolge und Herkunft der Daten ───────────────────────

describe("handleAppointmentCancellation — cancelled_now", () => {
  it("ruft die RPC als ALLERERSTEN Seiteneffekt", async () => {
    const { deps, auf } = macheDeps({ secrets: { resend_api_key: null } });
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.spur[0]).toBe("cancelByToken");
  });

  it("holt Termin und Firma ausschliesslich mit den ids aus dem RPC-Ergebnis", async () => {
    const ANDERE = "12121212-3434-5656-7878-909090909090";
    const { deps, auf } = macheDeps({
      rpc: { rows: [treffer({ appointment_id: TERMIN_ID, company_id: ANDERE })], error: null },
      appointment: terminZeile({ company_id: ANDERE }),
      company: firmaZeile({ id: ANDERE }),
    });
    await handleAppointmentCancellation(deps, post(koerper({ reason: null })));
    expect(auf.spur).toContain(`loadAppointment:${TERMIN_ID}`);
    expect(auf.spur).toContain(`loadCompany:${ANDERE}`);
  });

  it("bricht die Benachrichtigung ab, wenn Zeile und RPC-Ergebnis auseinanderlaufen", async () => {
    const { deps, auf } = macheDeps({ appointment: terminZeile({ company_id: "00000000-0000-0000-0000-000000000000" }) });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.notifications).toHaveLength(0);
    expect(auf.mails).toHaveLength(0);
  });

  it("bleibt bei 200, wenn die Terminzeile nicht mehr auffindbar ist", async () => {
    const { deps, auf } = macheDeps({ appointment: null });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, result: "cancelled_now" });
    expect(auf.mails).toHaveLength(0);
  });

  it("schreibt genau eine Benachrichtigung, ohne Token, Grund oder Adresse", async () => {
    const { deps, auf } = macheDeps({ secrets: { resend_api_key: null }, defaultKey: undefined });
    await handleAppointmentCancellation(deps, post(koerper({ reason: "Kunde verhindert" })));
    expect(auf.notifications).toHaveLength(1);
    const n = auf.notifications[0];
    expect(n.company_id).toBe(FIRMA_ID);
    expect(n.type).toBe("appointment_cancelled");
    expect((n.metadata as Record<string, unknown>).appointment_id).toBe(TERMIN_ID);
    expect((n.metadata as Record<string, unknown>).route).toBe("/firma/kalender");
    expect((n.metadata as Record<string, unknown>).priority).toBe("high");
    const text = JSON.stringify(n);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("Kunde verhindert");
    expect(text).not.toContain("kundin@example.test");
  });

  it("bleibt bei 200, wenn die Benachrichtigung nicht geschrieben werden kann", async () => {
    const { deps, auf } = macheDeps({ notificationWirft: true, secrets: { resend_api_key: "re_firma" } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, result: "cancelled_now" });
    // Und der Versand laeuft trotzdem weiter.
    expect(auf.mails.length).toBeGreaterThan(0);
  });
});

// ── Empfaenger und Zugangsdaten ─────────────────────────────────────────────

describe("handleAppointmentCancellation — Empfaenger", () => {
  it("bevorzugt notification_email vor email", async () => {
    const { deps, auf } = macheDeps({
      company: firmaZeile({ notification_email: "meldungen@example.test", email: "info@example.test" }),
    });
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mails.map((m) => m.to)).toContain("meldungen@example.test");
    expect(auf.mails.map((m) => m.to)).not.toContain("info@example.test");
  });

  it("faellt auf email zurueck, wenn notification_email fehlt", async () => {
    const { deps, auf } = macheDeps({ company: firmaZeile({ notification_email: null }) });
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mails.map((m) => m.to)).toContain("info@example.test");
  });

  it("schickt der Firma nichts, wenn sie gar keine Adresse hat", async () => {
    const { deps, auf } = macheDeps({ company: firmaZeile({ notification_email: null, email: null }) });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mails.map((m) => m.to)).toEqual(["kundin@example.test"]);
  });

  it("nimmt die Kundenadresse nur aus der Terminzeile", async () => {
    const { deps, auf } = macheDeps({ appointment: terminZeile({ customer_email: "echt@example.test" }) });
    await handleAppointmentCancellation(
      deps,
      post(JSON.stringify({ appointmentId: TERMIN_ID, actionToken: TOKEN })),
    );
    expect(auf.mails.map((m) => m.to)).toContain("echt@example.test");
  });

  it("laesst die Kundenmail aus, wenn keine Adresse hinterlegt ist", async () => {
    const { deps, auf } = macheDeps({ appointment: terminZeile({ customer_email: null }) });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mails).toHaveLength(1);
    expect(auf.mails[0].to).toBe("info@example.test");
    expect(auf.mailLogs.map((l) => l.emailType)).toEqual(["appointment_cancelled"]);
  });

  it("benutzt den eigenen Resend-Zugang der Firma, wenn er vollstaendig ist", async () => {
    const { deps, auf } = macheDeps({
      company: firmaZeile({ resend_enabled: true, resend_from_email: "info@firma.test", resend_from_name: "Muster" }),
      secrets: { resend_api_key: "re_firma" },
    });
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mails[0].apiKey).toBe("re_firma");
    expect(auf.mails[0].from).toBe("Muster <info@firma.test>");
    expect(auf.mailLogs.every((l) => (l.metadata as Record<string, unknown>).isCompanyEmail === true)).toBe(true);
  });

  it("faellt auf den allgemeinen Zugang zurueck, wenn die Firma unvollstaendig konfiguriert ist", async () => {
    const faelle: Array<Partial<CompanyRow>> = [
      { resend_enabled: false, resend_from_email: "info@firma.test" },
      { resend_enabled: true, resend_from_email: null },
    ];
    for (const c of faelle) {
      const { deps, auf } = macheDeps({ company: firmaZeile(c), secrets: { resend_api_key: "re_firma" } });
      await handleAppointmentCancellation(deps, post(koerper()));
      expect(auf.mails[0].apiKey).toBe("re_default");
      expect(auf.mails[0].from).toBe("Kalender <kalender@example.test>");
    }
  });

  it("faellt auch dann auf den allgemeinen Zugang zurueck, wenn das Geheimnis fehlt", async () => {
    const { deps, auf } = macheDeps({
      company: firmaZeile({ resend_enabled: true, resend_from_email: "info@firma.test" }),
      secrets: { resend_api_key: null },
    });
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mails[0].apiKey).toBe("re_default");
  });

  it("verschickt ohne jeden Schluessel gar nichts, bleibt aber erfolgreich", async () => {
    const { deps, auf } = macheDeps({ defaultKey: undefined, secrets: { resend_api_key: null } });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, result: "cancelled_now" });
    expect(auf.mails).toHaveLength(0);
    expect(auf.mailLogs).toHaveLength(0);
    // Die Firma sieht die Absage trotzdem im Dashboard.
    expect(auf.notifications).toHaveLength(1);
  });
});

// ── Versand und Protokoll ───────────────────────────────────────────────────

describe("handleAppointmentCancellation — Versand", () => {
  it("protokolliert je einen Versand als sent", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mailLogs.map((l) => [l.emailType, l.status])).toEqual([
      ["appointment_cancelled", "sent"],
      ["appointment_cancelled_customer", "sent"],
    ]);
    expect(auf.mailLogs.every((l) => l.errorMessage === undefined)).toBe(true);
  });

  it("wertet ein zurueckgegebenes { error } als echten Fehlschlag", async () => {
    const { deps, auf } = macheDeps({
      sendErgebnis: (a) => (a.to === "info@example.test" ? { error: { name: "rate_limit" } } : { id: "x" }),
    });
    await handleAppointmentCancellation(deps, post(koerper()));
    const firma = auf.mailLogs.find((l) => l.emailType === "appointment_cancelled");
    expect(firma?.status).toBe("failed");
    expect(firma?.errorMessage).toBe("resend_error");
    expect(JSON.stringify(auf.mailLogs)).not.toContain("rate_limit");
  });

  it("versucht die Kundenmail auch dann, wenn die Firmenmail scheitert", async () => {
    const { deps, auf } = macheDeps({
      sendErgebnis: (a) => (a.to === "info@example.test" ? { error: { name: "boom" } } : { id: "x" }),
    });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mails.map((m) => m.to)).toEqual(["info@example.test", "kundin@example.test"]);
    expect(auf.mailLogs.map((l) => l.status)).toEqual(["failed", "sent"]);
  });

  it("laesst ein Scheitern der Kundenmail das Firmenergebnis unberuehrt", async () => {
    const { deps, auf } = macheDeps({
      sendErgebnis: (a) => (a.to === "kundin@example.test" ? { error: { name: "boom" } } : { id: "x" }),
    });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mailLogs.map((l) => l.status)).toEqual(["sent", "failed"]);
  });

  it("verkraftet einen geworfenen Fehler des Anbieters", async () => {
    const { deps, auf } = macheDeps({ sendWirft: (a) => a.to === "info@example.test" });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(r.status).toBe(200);
    expect(auf.mailLogs.map((l) => l.status)).toEqual(["failed", "sent"]);
  });

  it("gibt die Kennung des Anbieters nicht heraus", async () => {
    const { deps, auf } = macheDeps({ sendErgebnis: () => ({ id: "provider-id-999" }) });
    const r = await handleAppointmentCancellation(deps, post(koerper()));
    expect(JSON.stringify(r.body)).not.toContain("provider-id-999");
    expect(r.body).toEqual({ success: true, result: "cancelled_now" });
    expect(JSON.stringify(auf.mailLogs)).not.toContain("provider-id-999");
  });

  it("legt in den Mail-Metadaten nur Technisches ab", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper({ reason: "Kunde verhindert" })));
    for (const l of auf.mailLogs) {
      expect(Object.keys(l.metadata ?? {}).sort()).toEqual(["appointmentId", "isCompanyEmail"]);
      expect(JSON.stringify(l.metadata)).not.toContain(TOKEN);
      expect(JSON.stringify(l.metadata)).not.toContain("Kunde verhindert");
    }
  });

  it("protokolliert die Sprache je Empfaenger getrennt", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper()));
    expect(auf.mailLogs.find((l) => l.emailType === "appointment_cancelled")?.language).toBe("de");
    expect(auf.mailLogs.find((l) => l.emailType === "appointment_cancelled_customer")?.language).toBe("fr");
  });
});

// ── Die Reihenfolge als Ganzes ──────────────────────────────────────────────

describe("handleAppointmentCancellation — Ordnung und Verschwiegenheit", () => {
  it("haelt die vorgeschriebene Reihenfolge ein", async () => {
    const { deps, auf } = macheDeps();
    await handleAppointmentCancellation(deps, post(koerper({ reason: "krank" })));
    expect(auf.spur).toEqual([
      "cancelByToken",
      `loadAppointment:${TERMIN_ID}`,
      `loadCompany:${FIRMA_ID}`,
      "insertNotification",
      `loadSecrets:${FIRMA_ID}`,
      "sendEmail:info@example.test",
      "logEmail:appointment_cancelled:sent",
      "sendEmail:kundin@example.test",
      "logEmail:appointment_cancelled_customer:sent",
    ]);
  });

  it("liest kein Geheimnis, bevor das Token gestimmt hat", async () => {
    for (const rpc of [
      { rows: [], error: null },
      { rows: null, error: { message: "x" } },
      { rows: [treffer({ result_code: "not_cancellable" })], error: null },
      { rows: [treffer({ result_code: "already_cancelled" })], error: null },
    ]) {
      const { deps, auf } = macheDeps({ rpc });
      await handleAppointmentCancellation(deps, post(koerper()));
      expect(auf.spur.filter((s) => s.startsWith("loadSecrets"))).toEqual([]);
    }
  });

  it("laesst das Token nirgends austreten", async () => {
    const faelle: Array<{ rpc?: DoubleOptionen["rpc"]; body: string }> = [
      { body: koerper({ reason: "krank" }) },
      { body: koerper(), rpc: { rows: [], error: null } },
      { body: koerper(), rpc: { rows: null, error: { message: "boom", details: TOKEN } } },
      { body: koerper(), rpc: { rows: [treffer({ result_code: "already_cancelled" })], error: null } },
      { body: koerper(), rpc: { rows: [treffer({ result_code: "not_cancellable" })], error: null } },
      { body: koerper({ actionToken: "kaputt" }) },
    ];
    for (const f of faelle) {
      const { deps, auf } = macheDeps(f.rpc ? { rpc: f.rpc } : {});
      const r = await handleAppointmentCancellation(deps, post(f.body));
      // Der einzige erlaubte Ort ist das Argument der RPC selbst.
      const spuren = alleSpuren(auf, r.body);
      expect(spuren).not.toContain(TOKEN);
    }
  });

  it("nennt den Absagegrund weder im Protokoll noch in den Metadaten", async () => {
    const GRUND = "Ich habe einen anderen Anbieter gefunden";
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentCancellation(deps, post(koerper({ reason: GRUND })));
    expect(JSON.stringify(auf.protokoll)).not.toContain(GRUND);
    expect(JSON.stringify(auf.mailLogs.map((l) => l.metadata))).not.toContain(GRUND);
    expect(JSON.stringify(auf.notifications)).not.toContain(GRUND);
    expect(JSON.stringify(r.body)).not.toContain(GRUND);
    // Der Grund, der die Renderer erreicht, ist der von der DB gepruefte Wert.
    expect(auf.rpcAufrufe[0].reason).toBe(GRUND);
  });

  it("laesst kein altes Koerperfeld mehr auf einen Empfaenger durchschlagen", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAppointmentCancellation(
      deps,
      post(koerper({ companyEmail: "angreifer@example.test", customerEmail: "angreifer@example.test" })),
    );
    expect(r.status).toBe(400);
    expect(auf.mails).toHaveLength(0);
  });
});

// ── Begrenzter Eingang ──────────────────────────────────────────────────────
//
// Diese Gruppe misst mit echten `ReadableStream`s und Zaehlern. Ein Test, der
// dem Guard eine fertige Zeichenkette gibt, koennte gar nicht bemerken, dass
// der Koerper vorher komplett im Speicher gelandet ist — und genau das war der
// Fehler.

describe("readBoundedUtf8", () => {
  it("lehnt bei glaubhaft zu grossem Content-Length ab, ohne den Strom anzufassen", async () => {
    const { stream, zaehler } = zaehlenderStrom([fuellStueck(MAX_BODY_BYTES + 1)]);
    const r = await readBoundedUtf8({ contentLength: String(MAX_BODY_BYTES + 1), stream });
    expect(r).toEqual({ ok: false, reason: "too_large" });
    expect(zaehler.pulls).toBe(0);
    expect(zaehler.cancels).toBe(0);
  });

  it("zaehlt ohne Content-Length waehrend des Lesens mit und hoert frueh auf", async () => {
    // 4096 + 4096 = 8192 (noch erlaubt), das dritte Stueck sprengt die Grenze.
    const { stream, zaehler } = zaehlenderStrom([fuellStueck(4096), fuellStueck(4096), fuellStueck(4096)]);
    const r = await readBoundedUtf8({ contentLength: null, stream });
    expect(r).toEqual({ ok: false, reason: "too_large" });
    expect(zaehler.pulls).toBe(3);
    expect(zaehler.cancels).toBe(1);
  });

  it("laesst sich von einem zu kleinen Content-Length nicht taeuschen", async () => {
    const { stream, zaehler } = zaehlenderStrom([fuellStueck(4096), fuellStueck(4096), fuellStueck(4096)]);
    const r = await readBoundedUtf8({ contentLength: "10", stream });
    expect(r).toEqual({ ok: false, reason: "too_large" });
    expect(zaehler.cancels).toBe(1);
  });

  it.each(["", "   ", "abc", "-1", "1e9", "+8193", "8193.0", " 8193x", "0x2001"])(
    "haelt den Content-Length %s fuer unbrauchbar und misst selbst",
    async (cl) => {
      const { stream } = zaehlenderStrom([fuellStueck(100)]);
      const r = await readBoundedUtf8({ contentLength: cl, stream });
      expect(r.ok).toBe(true);
      expect(r.ok && r.bytes).toBe(100);
    },
  );

  it("nimmt genau 8192 Byte an und weist 8193 ab", async () => {
    const genau = zaehlenderStrom([fuellStueck(MAX_BODY_BYTES)]);
    const a = await readBoundedUtf8({ contentLength: null, stream: genau.stream });
    expect(a.ok).toBe(true);
    expect(a.ok && a.bytes).toBe(MAX_BODY_BYTES);

    const einsZuviel = zaehlenderStrom([fuellStueck(MAX_BODY_BYTES), fuellStueck(1)]);
    const b = await readBoundedUtf8({ contentLength: null, stream: einsZuviel.stream });
    expect(b).toEqual({ ok: false, reason: "too_large" });
  });

  it("misst Mehrbyte-Zeichen in Bytes, nicht in Zeichen", async () => {
    // 2048 Emoji = 8192 Byte = erlaubt; 2049 Emoji = 8196 Byte = zu viel.
    const passt = zaehlenderStrom([bytes("🙂".repeat(2048))]);
    const a = await readBoundedUtf8({ contentLength: null, stream: passt.stream });
    expect(a.ok).toBe(true);
    expect(a.ok && a.bytes).toBe(MAX_BODY_BYTES);
    expect(a.ok && a.text.length).toBe(4096); // Zeichen, nicht Bytes

    const zuViel = zaehlenderStrom([bytes("🙂".repeat(2049))]);
    expect(await readBoundedUtf8({ contentLength: null, stream: zuViel.stream })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("setzt ein Mehrbyte-Zeichen ueber eine Stueckgrenze hinweg zusammen", async () => {
    const roh = bytes("Zürich 🙂");
    const mitte = Math.floor(roh.length / 2);
    const { stream } = zaehlenderStrom([roh.slice(0, mitte), roh.slice(mitte)]);
    const r = await readBoundedUtf8({ contentLength: null, stream });
    expect(r.ok).toBe(true);
    expect(r.ok && r.text).toBe("Zürich 🙂");
  });

  it("erkennt ungueltiges UTF-8, statt Ersatzzeichen einzusetzen", async () => {
    const { stream } = zaehlenderStrom([new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])]);
    expect(await readBoundedUtf8({ contentLength: null, stream })).toEqual({
      ok: false,
      reason: "invalid_encoding",
    });
  });

  it("meldet einen Lesefehler als solchen", async () => {
    let cancels = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          throw new Error("stream kaputt");
        },
        cancel() {
          cancels += 1;
        },
      },
      { highWaterMark: 0 },
    );
    expect(await readBoundedUtf8({ contentLength: null, stream })).toEqual({ ok: false, reason: "read_error" });
    expect(cancels).toBeLessThanOrEqual(1);
  });

  it("lehnt eine beliebig grosse Ziffernfolge frueh ab, ohne zu rechnen", async () => {
    // Jenseits von Number.MAX_SAFE_INTEGER. Frueher galt so eine Angabe als
    // unbrauchbar, und der Strom wurde trotzdem angefasst — obwohl der Absender
    // selbst ein Vielfaches der Grenze ankuendigt.
    for (const cl of ["9007199254740993", "99999999999999999999999999", "1".repeat(200)]) {
      const { stream, zaehler } = zaehlenderStrom([fuellStueck(10)]);
      expect(await readBoundedUtf8({ contentLength: cl, stream }), cl).toEqual({
        ok: false,
        reason: "too_large",
      });
      expect(zaehler.pulls, cl).toBe(0);
      expect(stream.locked, cl).toBe(false);
    }
  });

  it("rechnet fuehrende Nullen heraus", async () => {
    const zuGross = zaehlenderStrom([fuellStueck(10)]);
    expect(await readBoundedUtf8({ contentLength: "00008193", stream: zuGross.stream })).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(zuGross.zaehler.pulls).toBe(0);

    // Genau an der Grenze: nicht zu gross, also wird wirklich gemessen.
    const genau = zaehlenderStrom([fuellStueck(10)]);
    const r = await readBoundedUtf8({ contentLength: "00008192", stream: genau.stream });
    expect(r.ok).toBe(true);
    expect(r.ok && r.bytes).toBe(10);
    expect(genau.zaehler.pulls).toBeGreaterThan(0);
  });

  it("laesst eine unbrauchbare Angabe die Grenze nicht umgehen", async () => {
    for (const cl of ["", "   ", "abc", "-1", "1e9", "+9999999", "8193.0", null]) {
      const { stream } = zaehlenderStrom([fuellStueck(4096), fuellStueck(4096), fuellStueck(1)]);
      expect(await readBoundedUtf8({ contentLength: cl, stream }), String(cl)).toEqual({
        ok: false,
        reason: "too_large",
      });
    }
  });

  it.each([
    ["erfolgreiches Lesen", [new Uint8Array([0x61])], null],
    ["zu grossen Koerper", [new Uint8Array(MAX_BODY_BYTES + 1)], null],
    ["ungueltiges UTF-8", [new Uint8Array([0xff, 0xfe])], null],
    ["frueh abgelehnte Ankuendigung", [new Uint8Array([0x61])], "99999"],
  ])("gibt die Sperre nach %s wieder frei", async (_was, stuecke, cl) => {
    const { stream } = zaehlenderStrom(stuecke as Uint8Array[]);
    await readBoundedUtf8({ contentLength: cl as string | null, stream });
    expect(stream.locked).toBe(false);
  });

  it("gibt die Sperre auch nach einem Lesefehler frei", async () => {
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          throw new Error("stream kaputt");
        },
      },
      { highWaterMark: 0 },
    );
    expect(await readBoundedUtf8({ contentLength: null, stream })).toEqual({ ok: false, reason: "read_error" });
    expect(stream.locked).toBe(false);
  });

  it("bleibt sicher, wenn das Abbestellen selbst wirft", async () => {
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1));
        },
        cancel() {
          throw new Error("cancel kaputt");
        },
      },
      { highWaterMark: 0 },
    );
    expect(await readBoundedUtf8({ contentLength: null, stream })).toEqual({ ok: false, reason: "too_large" });
    expect(stream.locked).toBe(false);
  });

  it("puffert hoechstens die erlaubte Menge, egal wie die Stuecke fallen", async () => {
    // Ein grosses Stueck, viele kleine, und ein Zeichen ueber der Grenze —
    // alle drei Wege muessen dieselbe Grenze sehen.
    const einStueck = zaehlenderStrom([fuellStueck(MAX_BODY_BYTES)]);
    expect((await readBoundedUtf8({ contentLength: null, stream: einStueck.stream })).ok).toBe(true);

    const viele = zaehlenderStrom(Array.from({ length: 8 }, () => fuellStueck(1024)));
    const r = await readBoundedUtf8({ contentLength: null, stream: viele.stream });
    expect(r.ok).toBe(true);
    expect(r.ok && r.bytes).toBe(MAX_BODY_BYTES);

    const einsZuviel = zaehlenderStrom([...Array.from({ length: 8 }, () => fuellStueck(1024)), fuellStueck(1)]);
    expect(await readBoundedUtf8({ contentLength: null, stream: einsZuviel.stream })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("kommt mit fehlendem Koerper zurecht", async () => {
    expect(await readBoundedUtf8({ contentLength: null, stream: null })).toEqual({ ok: true, text: "", bytes: 0 });
  });
});

describe("Der Handler am begrenzten Eingang", () => {
  it("antwortet auf angekuendigte 8193 Byte mit 413, ohne zu lesen", async () => {
    const { deps, auf } = macheDeps();
    const { req, zaehler } = postStrom([fuellStueck(MAX_BODY_BYTES + 1)], String(MAX_BODY_BYTES + 1));
    const r = await handleAppointmentCancellation(deps, req);
    expect(r.status).toBe(413);
    expect(r.body).toEqual({ error: "payload_too_large" });
    expect(zaehler.pulls).toBe(0);
    expect(auf.spur).toEqual([]);
  });

  it("antwortet auf 8193 Byte in Stuecken ohne Content-Length mit 413", async () => {
    const { deps, auf } = macheDeps();
    const { req, zaehler } = postStrom([fuellStueck(4096), fuellStueck(4096), fuellStueck(1)], null);
    const r = await handleAppointmentCancellation(deps, req);
    expect(r.status).toBe(413);
    expect(zaehler.pulls).toBe(3);
    expect(zaehler.cancels).toBe(1);
    expect(auf.spur).toEqual([]);
  });

  it("antwortet auf ungueltiges UTF-8 mit einem nichtssagenden 400", async () => {
    const { deps, auf } = macheDeps();
    const { req } = postStrom([new Uint8Array([0x7b, 0xff, 0x7d])], null);
    const r = await handleAppointmentCancellation(deps, req);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid_request" });
    expect(auf.spur).toEqual([]);
  });

  it("antwortet auf einen Lesefehler mit 400 und verraet ihn nicht", async () => {
    const { deps, auf } = macheDeps();
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          throw new Error(`kaputt mit ${TOKEN}`);
        },
      },
      { highWaterMark: 0 },
    );
    const r = await handleAppointmentCancellation(deps, { method: "POST", contentLength: null, body: stream });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid_request" });
    expect(alleSpuren(auf, r.body)).not.toContain(TOKEN);
    expect(auf.spur).toEqual([]);
  });

  it("laesst genau 8192 Byte durch den Eingang und lehnt erst 8193 ab", async () => {
    // Ein gueltiger Koerper kann die 8 KiB gar nicht ausschoepfen — `reason` ist
    // bei 2000 Zeichen gedeckelt. Geprueft wird deshalb der Eingang selbst:
    // 8192 Byte kommen bis zur Formpruefung durch (400 wegen zu langem Grund,
    // NICHT 413), 8193 Byte werden schon davor abgewiesen.
    const fuellung = (n: number) => koerper({ reason: "y".repeat(n) });
    const grundlaenge = bodyByteLength(fuellung(0));
    const genau = fuellung(MAX_BODY_BYTES - grundlaenge);
    expect(bodyByteLength(genau)).toBe(MAX_BODY_BYTES);

    const a = macheDeps();
    const rA = await handleAppointmentCancellation(a.deps, postStrom([bytes(genau)], null).req);
    expect(rA.status).toBe(400);
    expect(rA.body).toEqual({ error: "invalid_request" });

    const einsMehr = fuellung(MAX_BODY_BYTES - grundlaenge + 1);
    expect(bodyByteLength(einsMehr)).toBe(MAX_BODY_BYTES + 1);
    const b = macheDeps();
    const rB = await handleAppointmentCancellation(b.deps, postStrom([bytes(einsMehr)], null).req);
    expect(rB.status).toBe(413);
  });

  it("nimmt den groessten gueltigen Koerper an", async () => {
    const { deps } = macheDeps();
    const text = koerper({ reason: "y".repeat(MAX_REASON_LENGTH) });
    expect(bodyByteLength(text)).toBeLessThan(MAX_BODY_BYTES);
    const r = await handleAppointmentCancellation(deps, postStrom([bytes(text)], String(bodyByteLength(text))).req);
    expect(r.status).toBe(200);
  });
});

describe("Der Endpunkt selbst", () => {
  it("benutzt keinen der Sammel-Leser des Request-Objekts", async () => {
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync(
      new URL("../../notify-appointment-cancelled/index.ts", import.meta.url),
      "utf8",
    );
    expect(quelle).not.toContain("req.text()");
    expect(quelle).not.toContain("req.json()");
    // Und er reicht wirklich den Strom weiter.
    expect(quelle).toContain("body: req.body");
    expect(quelle).toContain('contentLength: req.headers.get("content-length")');
  });
});
