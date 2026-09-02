import { describe, it, expect } from "vitest";
import {
  parseNotifyBesichtigungRequest,
  evaluateOfferEligibility,
  handleNotifyBesichtigung,
  MAX_NOTE_LENGTH,
  type NotifyBesichtigungDeps,
  type OfferRow,
  type CompanyRow,
} from "../notifyBesichtigungGuard.ts";

const OFFER_ID = "11111111-2222-3333-4444-555555555555";
const TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const FREMD_TOKEN = "ffffffffffffffffffffffffffffffff";
const HEUTE = Date.UTC(2026, 7, 2); // 2026-08-02

const gueltigerBody = (over: Record<string, unknown> = {}) => ({
  offerId: OFFER_ID,
  accessToken: TOKEN,
  besichtigungDate: "2026-08-20",
  besichtigungTime: "14:30",
  customerNote: "Bitte klingeln.",
  ...over,
});

const offer = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: OFFER_ID,
  company_id: "99999999-8888-7777-6666-555555555555",
  status: "sent",
  superseded_at: null,
  valid_until: null,
  service_date: null,
  language: "de",
  title: "Umzug Zürich",
  total: 1980,
  customer_first_name: "Anna",
  customer_last_name: "Beispiel",
  customer_email: "kundin@example.test",
  customer_phone: "+41 00 000 00 00",
  ...over,
});

const company = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  id: "99999999-8888-7777-6666-555555555555",
  company_name: "Test Umzug AG",
  email: "firma@example.test",
  notification_email: "meldungen@example.test",
  default_language: "de",
  resend_enabled: false,
  resend_from_email: null,
  resend_from_name: null,
  ...over,
});

/** Recording doubles. Every call is appended to `spuren` so ORDER can be asserted. */
const bauDeps = (over: Partial<NotifyBesichtigungDeps> = {}) => {
  const spuren: string[] = [];
  const gesendet: { to: string; subject: string }[] = [];
  const geloggt: Record<string, unknown>[] = [];
  const meldungen: Record<string, unknown>[] = [];

  const deps: NotifyBesichtigungDeps = {
    loadOffer: async (id, token) => {
      spuren.push("loadOffer");
      return id === OFFER_ID && token === TOKEN ? offer() : null;
    },
    loadCompany: async () => { spuren.push("loadCompany"); return company(); },
    countRecentBesichtigungEmails: async () => {
      spuren.push("countRecent");
      return { count: 0, error: null };
    },
    loadSecrets: async () => { spuren.push("loadSecrets"); return {}; },
    sendEmail: async (args) => {
      spuren.push("sendEmail");
      gesendet.push({ to: args.to, subject: args.subject });
      return { id: "mail-1" };
    },
    logEmail: async (entry) => { spuren.push("logEmail"); geloggt.push(entry); },
    insertNotification: async (entry) => { spuren.push("insertNotification"); meldungen.push(entry); },
    renderCompanyEmail: () => ({ subject: "Firma", html: "<p>Firma</p>" }),
    renderCustomerEmail: () => ({ subject: "Kunde", html: "<p>Kunde</p>" }),
    toLocale: (v) => (typeof v === "string" ? v : "de"),
    defaultResendApiKey: () => "re_test_key",
    defaultFrom: () => "Test <noreply@example.test>",
    now: () => HEUTE,
    log: () => {},
    ...over,
  };
  return { deps, spuren, gesendet, geloggt, meldungen };
};

// ══ 1-6: Anfrageform ═════════════════════════════════════════════════════════
describe("parseNotifyBesichtigungRequest", () => {
  it("nimmt genau die fünf erlaubten Felder an", () => {
    const r = parseNotifyBesichtigungRequest(gueltigerBody());
    expect(r.ok).toBe(true);
  });

  it("1. fehlender oder formwidriger Token → Ablehnung", () => {
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ accessToken: undefined })))
      .toEqual({ ok: false, reason: "accessToken_invalid" });
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ accessToken: "kurz" })))
      .toEqual({ ok: false, reason: "accessToken_invalid" });
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ accessToken: "hat leerzeichen und !" })))
      .toEqual({ ok: false, reason: "accessToken_invalid" });
  });

  it("2. offerId muss eine UUID sein", () => {
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ offerId: "nicht-uuid" })))
      .toEqual({ ok: false, reason: "offerId_invalid" });
  });

  it("4. ungültiges Datum oder ungültige Zeit → Ablehnung", () => {
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ besichtigungDate: "20.08.2026" })))
      .toEqual({ ok: false, reason: "besichtigungDate_invalid" });
    // Formal richtig, als Datum nicht existent.
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ besichtigungDate: "2026-02-30" })))
      .toEqual({ ok: false, reason: "besichtigungDate_invalid" });
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ besichtigungTime: "25:00" })))
      .toEqual({ ok: false, reason: "besichtigungTime_invalid" });
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ besichtigungTime: "14:30:00" })))
      .toEqual({ ok: false, reason: "besichtigungTime_invalid" });
  });

  it("erlaubt eine fehlende Zeit und eine fehlende Notiz", () => {
    const r = parseNotifyBesichtigungRequest({
      offerId: OFFER_ID, accessToken: TOKEN, besichtigungDate: "2026-08-20",
      besichtigungTime: null, customerNote: null,
    });
    expect(r.ok && r.value.besichtigungTime).toBeNull();
  });

  it("5. zu lange Notiz → Ablehnung statt Kürzung", () => {
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ customerNote: "x".repeat(MAX_NOTE_LENGTH + 1) })))
      .toEqual({ ok: false, reason: "customerNote_too_long" });
    expect(parseNotifyBesichtigungRequest(gueltigerBody({ customerNote: "x".repeat(MAX_NOTE_LENGTH) })).ok)
      .toBe(true);
  });

  // Der Kern der ganzen Umstellung: die alten Felder sind keine ignorierten Extras,
  // sondern ein Grund, die Anfrage abzulehnen.
  it("6. mitgeschickte Empfänger-/Firmenfelder werden NICHT akzeptiert", () => {
    for (const feld of ["companyEmail", "customerEmail", "companyId", "companyName",
                        "customerName", "customerPhone", "offerTitle", "offerTotal"]) {
      const r = parseNotifyBesichtigungRequest(gueltigerBody({ [feld]: "beliebig" }));
      expect(r.ok, `${feld} hätte abgelehnt werden müssen`).toBe(false);
      expect(r.ok === false && r.reason).toContain("unknown_fields");
    }
  });

  it("lehnt Nicht-Objekte ab", () => {
    expect(parseNotifyBesichtigungRequest(null).ok).toBe(false);
    expect(parseNotifyBesichtigungRequest([]).ok).toBe(false);
    expect(parseNotifyBesichtigungRequest("{}").ok).toBe(false);
  });
});

// ══ 9: Zustand der Offerte ═══════════════════════════════════════════════════
describe("evaluateOfferEligibility", () => {
  it("lässt offene Offerten zu", () => {
    expect(evaluateOfferEligibility(offer({ status: "sent" }), "2026-08-02").ok).toBe(true);
    expect(evaluateOfferEligibility(offer({ status: "viewed" }), "2026-08-02").ok).toBe(true);
  });

  it("9. accepted/rejected/draft → Ablehnung", () => {
    for (const s of ["accepted", "rejected", "draft", "expired"]) {
      expect(evaluateOfferEligibility(offer({ status: s }), "2026-08-02"))
        .toEqual({ ok: false, reason: "status_not_open" });
    }
  });

  it("9. überholte Fassung → Ablehnung", () => {
    expect(evaluateOfferEligibility(offer({ superseded_at: "2026-07-01T10:00:00Z" }), "2026-08-02"))
      .toEqual({ ok: false, reason: "superseded" });
  });

  it("9. abgelaufene Annahmefrist → Ablehnung", () => {
    expect(evaluateOfferEligibility(offer({ valid_until: "2026-08-01" }), "2026-08-02"))
      .toEqual({ ok: false, reason: "expired" });
    expect(evaluateOfferEligibility(offer({ valid_until: "2026-08-02" }), "2026-08-02").ok).toBe(true);
  });

  it("das Ausführungsdatum schliesst die Frist mit, nicht nur valid_until", () => {
    // Die Rechnung selbst steht in offerAcceptanceWindow.test.ts; hier zählt,
    // dass diese Funktion sie benutzt.
    expect(evaluateOfferEligibility(offer({ valid_until: "2026-08-20", service_date: "2026-08-02" }), "2026-08-02"))
      .toEqual({ ok: false, reason: "expired" });
  });
});

// ══ Ablauf ═══════════════════════════════════════════════════════════════════
describe("handleNotifyBesichtigung", () => {
  it("2. falsche offerId bei formal gültigem Token → 403", async () => {
    const { deps, spuren } = bauDeps();
    const r = await handleNotifyBesichtigung(deps, gueltigerBody({
      offerId: "00000000-0000-4000-8000-000000000000",
    }));
    expect(r.status).toBe(403);
    expect(spuren).toEqual(["loadOffer"]);
  });

  it("3. Token einer ANDEREN Offerte → 403", async () => {
    const { deps, spuren } = bauDeps();
    const r = await handleNotifyBesichtigung(deps, gueltigerBody({ accessToken: FREMD_TOKEN }));
    expect(r.status).toBe(403);
    expect(spuren).toEqual(["loadOffer"]);
  });

  // 7 — die Ordnungseigenschaft, um die es geht.
  it("7. ohne gültigen Token: kein Secret-Loader, kein Resend, keine Meldung, kein Log", async () => {
    const { deps, spuren } = bauDeps();
    await handleNotifyBesichtigung(deps, gueltigerBody({ accessToken: FREMD_TOKEN }));
    for (const verboten of ["loadSecrets", "sendEmail", "logEmail", "insertNotification", "loadCompany"]) {
      expect(spuren, `${verboten} lief trotz ungültigem Token`).not.toContain(verboten);
    }
  });

  it("7b. bei formwidrigem Body wird nicht einmal die Offerte geladen", async () => {
    const { deps, spuren } = bauDeps();
    const r = await handleNotifyBesichtigung(deps, gueltigerBody({ companyEmail: "angreifer@example.test" }));
    expect(r.status).toBe(400);
    expect(spuren).toEqual([]);
  });

  it("8. Empfänger stammen ausschliesslich aus den geprüften DB-Zeilen", async () => {
    const { deps, gesendet } = bauDeps();
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(200);
    // Firma: notification_email gewinnt gegen email. Kunde: Adresse der Offerte.
    expect(gesendet.map((g) => g.to)).toEqual(["meldungen@example.test", "kundin@example.test"]);
  });

  it("8b. ohne notification_email fällt die Firma auf companies.email zurück", async () => {
    const { deps, gesendet } = bauDeps({
      loadCompany: async () => company({ notification_email: null }),
    });
    await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(gesendet[0].to).toBe("firma@example.test");
  });

  it("9. nicht mehr offene Offerte → 409, keine E-Mail", async () => {
    const { deps, spuren } = bauDeps({ loadOffer: async () => offer({ status: "accepted" }) });
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(409);
    expect(spuren).not.toContain("sendEmail");
  });

  it("10. Cooldown → 429, keine E-Mail", async () => {
    const { deps, spuren } = bauDeps({
      countRecentBesichtigungEmails: async () => ({ count: 1, error: null }),
    });
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(429);
    expect(spuren).not.toContain("sendEmail");
    expect(spuren).not.toContain("loadSecrets");
  });

  it("11. Fehler in der Cooldown-Abfrage → fail-closed, keine E-Mail", async () => {
    const { deps, spuren } = bauDeps({
      countRecentBesichtigungEmails: async () => ({ count: null, error: new Error("db weg") }),
    });
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(503);
    expect(spuren).not.toContain("sendEmail");
  });

  it("12. gültiger Ablauf erhält Firmenmail, Kundenmail und In-App-Meldung", async () => {
    const { deps, spuren, gesendet, meldungen, geloggt } = bauDeps();
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(200);
    expect(gesendet).toHaveLength(2);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0].company_id).toBe("99999999-8888-7777-6666-555555555555");
    expect(geloggt.filter((l) => l.status === "sent")).toHaveLength(2);
    // Reihenfolge: erst prüfen, dann handeln.
    expect(spuren.indexOf("loadOffer")).toBeLessThan(spuren.indexOf("loadSecrets"));
    expect(spuren.indexOf("countRecent")).toBeLessThan(spuren.indexOf("sendEmail"));
  });

  it("13. Resend meldet {error} für die Firmenmail → kein 'sent'-Log, 502", async () => {
    const { deps, geloggt } = bauDeps({
      sendEmail: async () => ({ error: { message: "domain not verified" } }),
    });
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(502);
    expect(geloggt).toHaveLength(1);
    expect(geloggt[0].status).toBe("failed");
    expect(geloggt.some((l) => l.status === "sent")).toBe(false);
  });

  it("13b. scheitert nur die Kundenmail, bleibt die Firmenmail 'sent' und der Lauf erfolgreich", async () => {
    let n = 0;
    const { deps, geloggt } = bauDeps({
      sendEmail: async () => (++n === 1 ? { id: "m1" } : { error: { message: "bounce" } }),
    });
    const r = await handleNotifyBesichtigung(deps, gueltigerBody());
    expect(r.status).toBe(200);
    expect(r.body.customerEmailSent).toBe(false);
    expect(geloggt.map((l) => l.status)).toEqual(["sent", "failed"]);
  });

  // 14 — der Token darf in keiner Rückgabe und in keinem Protokollfeld auftauchen.
  it("14. der Token erscheint in keiner Antwort und in keinem Log", async () => {
    const gesehen: unknown[] = [];
    const { deps, geloggt, meldungen } = bauDeps({
      log: (step, details) => gesehen.push(step, details),
    });
    const ergebnisse = [
      await handleNotifyBesichtigung(deps, gueltigerBody({ accessToken: FREMD_TOKEN })),
      await handleNotifyBesichtigung(deps, gueltigerBody()),
    ];
    const alles = JSON.stringify({ ergebnisse, gesehen, geloggt, meldungen });
    expect(alles).not.toContain(TOKEN);
    expect(alles).not.toContain(FREMD_TOKEN);
  });
});
