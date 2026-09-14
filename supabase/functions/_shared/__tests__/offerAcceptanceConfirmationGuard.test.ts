import { describe, expect, it } from "vitest";
import {
  EMAIL_TYPE,
  handleAcceptanceConfirmation,
  parseAcceptanceConfirmationRequest,
  tokensEqual,
  type AcceptanceConfirmationDeps,
  type AcceptanceRenderContext,
  type CompanyRow,
  type CompanySecretsLike,
  type EmailLogEntry,
  type LookupResult,
  type MembershipResult,
  type OfferRow,
  type SendArgs,
} from "../offerAcceptanceConfirmationGuard.ts";
import type { AcceptanceItemRow } from "../acceptanceTermine.ts";

const OFFERTE = "11111111-2222-3333-4444-555555555555";
const FIRMA = "99999999-8888-7777-6666-555555555555";
const BENUTZER = "aaaaaaaa-1111-2222-3333-444444444444";
const TOKEN = "tok_0123456789abcdef0123456789abcdef";
const JWT = "ey.GEHEIMES-JWT.signatur";
const GLOBAL_KEY = "re_globalschluessel";
const FIRMEN_KEY = "re_firmenschluessel";

const offerte = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: OFFERTE,
  company_id: FIRMA,
  lead_id: null,
  status: "accepted",
  access_token: TOKEN,
  offer_number: 10090,
  title: "Umzug Zürich",
  language: "fr",
  accepted_via: "manual",
  customer_first_name: "Anna",
  customer_last_name: "Beispiel",
  customer_email: "kundin@example.test",
  service_date: "2026-10-02",
  service_start_time: null,
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

const bytes = (t: string) => new TextEncoder().encode(t);

const post = (body: Record<string, unknown>, authorization: string | null = null) => {
  const text = JSON.stringify(body);
  return {
    method: "POST",
    authorization,
    contentLength: String(bytes(text).length),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes(text));
        controller.close();
      },
    }),
  };
};

interface Optionen {
  user?: { userId: string } | null;
  offer?: OfferRow | null;
  offerLookup?: LookupResult<OfferRow>;
  membership?: MembershipResult;
  alreadySent?: LookupResult<boolean>;
  items?: AcceptanceItemRow[];
  company?: CompanyRow | null;
  secrets?: CompanySecretsLike;
  globalKey?: string | undefined;
  sendFehler?: (a: SendArgs) => boolean;
  wirftIn?: string;
}

interface Aufzeichnung {
  spur: string[];
  mails: SendArgs[];
  logs: EmailLogEntry[];
  renders: AcceptanceRenderContext[];
}

const macheDeps = (o: Optionen = {}) => {
  const auf: Aufzeichnung = { spur: [], mails: [], logs: [], renders: [] };
  const wirf = (name: string) => {
    if (o.wirftIn === name) throw new Error(`WURF-SENTINEL:${name}:${JWT}:${TOKEN}`);
  };
  const deps: AcceptanceConfirmationDeps = {
    authenticate: async () => {
      auf.spur.push("authenticate");
      return o.user === undefined ? { userId: BENUTZER } : o.user;
    },
    loadOffer: async (id) => {
      auf.spur.push(`loadOffer:${id}`);
      wirf("loadOffer");
      if (o.offerLookup) return o.offerLookup;
      return { ok: true, value: o.offer === undefined ? offerte() : o.offer };
    },
    isCompanyMember: async (userId, companyId) => {
      auf.spur.push(`isCompanyMember:${userId}:${companyId}`);
      return o.membership ?? { ok: true, isMember: true };
    },
    hasSentConfirmation: async (id) => {
      auf.spur.push(`hasSentConfirmation:${id}`);
      return o.alreadySent ?? { ok: true, value: false };
    },
    loadOfferItems: async (id) => {
      auf.spur.push(`loadOfferItems:${id}`);
      return { ok: true, value: o.items ?? [] };
    },
    loadCompany: async (id) => {
      auf.spur.push(`loadCompany:${id}`);
      return { ok: true, value: o.company === undefined ? firma() : o.company };
    },
    loadSecrets: async (id) => {
      auf.spur.push(`loadSecrets:${id}`);
      return { ok: true, value: o.secrets ?? { resend_api_key: null } };
    },
    renderEmail: (ctx) => {
      auf.spur.push(`renderEmail:${ctx.locale}:${ctx.isCompanyEmail}`);
      auf.renders.push(ctx);
      wirf("renderEmail");
      return { subject: `Betreff ${ctx.locale}`, html: "<p>x</p>" };
    },
    sendEmail: async (args) => {
      auf.spur.push(`sendEmail:${args.to}:${args.apiKey}`);
      auf.mails.push(args);
      return o.sendFehler?.(args) ? { error: { message: "nope" } } : { id: "provider-id" };
    },
    logEmail: async (entry) => {
      auf.spur.push(`logEmail:${entry.status}`);
      auf.logs.push(entry);
    },
    toLocale: (v) => (v === "fr" ? "fr" : v === "en" ? "en" : "de"),
    defaultResendApiKey: () => ("globalKey" in o ? o.globalKey : GLOBAL_KEY),
    defaultFrom: () => "System <no-reply@example.test>",
    log: () => {},
  };
  return { deps, auf };
};

describe("parseAcceptanceConfirmationRequest", () => {
  it("nimmt offerId und optional accessToken, sonst nichts", () => {
    expect(parseAcceptanceConfirmationRequest({ offerId: OFFERTE })).toEqual({
      ok: true,
      offerId: OFFERTE,
      accessToken: null,
    });
    expect(parseAcceptanceConfirmationRequest({ offerId: OFFERTE, accessToken: TOKEN })).toEqual({
      ok: true,
      offerId: OFFERTE,
      accessToken: TOKEN,
    });
    expect(parseAcceptanceConfirmationRequest({ offerId: OFFERTE, customerEmail: "x@y.z" }).ok).toBe(false);
    expect(parseAcceptanceConfirmationRequest({ offerId: "nope" }).ok).toBe(false);
    expect(parseAcceptanceConfirmationRequest({ offerId: OFFERTE, accessToken: "kurz" }).ok).toBe(false);
    expect(parseAcceptanceConfirmationRequest([OFFERTE]).ok).toBe(false);
  });
});

describe("tokensEqual", () => {
  it("vergleicht exakt", () => {
    expect(tokensEqual(TOKEN, TOKEN)).toBe(true);
    expect(tokensEqual(TOKEN, `${TOKEN.slice(0, -1)}X`)).toBe(false);
    expect(tokensEqual(TOKEN, TOKEN.slice(1))).toBe(false);
  });
});

describe("Nachweis", () => {
  it("JWT-Weg: ohne Bearer 401, und die Datenbank wird nicht beruehrt", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE }, null));
    expect(r.status).toBe(401);
    expect(auf.spur).toEqual([]);
  });

  it("JWT-Weg: ungueltiger Benutzer 401, bevor die Offerte geladen wird", async () => {
    const { deps, auf } = macheDeps({ user: null });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE }, `Bearer ${JWT}`));
    expect(r.status).toBe(401);
    expect(auf.spur).toEqual(["authenticate"]);
  });

  it("JWT-Weg: prueft die Firma AUS DER ZEILE", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE }, `Bearer ${JWT}`));
    expect(r.status).toBe(200);
    expect(auf.spur).toContain(`isCompanyMember:${BENUTZER}:${FIRMA}`);
  });

  it("Token-Weg: meldet sich nicht an, auch wenn ein Bearer mitkommt", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAcceptanceConfirmation(
      deps,
      post({ offerId: OFFERTE, accessToken: TOKEN }, "Bearer anon-schluessel"),
    );
    expect(r.status).toBe(200);
    expect(auf.spur).not.toContain("authenticate");
    expect(auf.spur.some((s) => s.startsWith("isCompanyMember"))).toBe(false);
  });

  it("unbekannte Offerte, falsches Token und fremde Firma antworten gleich — kein Orakel", async () => {
    const unbekannt = macheDeps({ offer: null });
    const falsch = macheDeps();
    const fremd = macheDeps({ membership: { ok: true, isMember: false } });

    const a = await handleAcceptanceConfirmation(unbekannt.deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    const b = await handleAcceptanceConfirmation(
      falsch.deps,
      post({ offerId: OFFERTE, accessToken: `${TOKEN.slice(0, -1)}X` }),
    );
    const c = await handleAcceptanceConfirmation(fremd.deps, post({ offerId: OFFERTE }, `Bearer ${JWT}`));

    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.status).toBe(404);
    for (const { auf } of [unbekannt, falsch, fremd]) {
      expect(auf.mails).toEqual([]);
      expect(auf.spur.some((s) => s.startsWith("loadSecrets") || s.startsWith("hasSentConfirmation"))).toBe(false);
    }
  });

  it("ein Fehler der Offertenabfrage ist eine Stoerung, keine geloeschte Zeile", async () => {
    const { deps } = macheDeps({ offerLookup: { ok: false } });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.status).toBe(503);
  });
});

describe("Nur fuer eine angenommene Offerte, nur einmal", () => {
  it("lehnt eine nicht angenommene Offerte ab und schickt nichts", async () => {
    const { deps, auf } = macheDeps({ offer: offerte({ status: "viewed" }) });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.status).toBe(409);
    expect(auf.mails).toEqual([]);
  });

  it("ueberspringt, wenn schon eine Bestaetigung gesendet wurde", async () => {
    const { deps, auf } = macheDeps({ alreadySent: { ok: true, value: true } });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r).toEqual({ status: 200, body: { success: true, skipped: true, reason: "already_sent" } });
    expect(auf.mails).toEqual([]);
    expect(auf.logs).toEqual([]);
  });

  it("schickt nicht blind, wenn das Protokoll nicht lesbar ist", async () => {
    const { deps, auf } = macheDeps({ alreadySent: { ok: false } });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.status).toBe(503);
    expect(auf.mails).toEqual([]);
  });

  it("ueberspringt ohne Kundenadresse", async () => {
    const { deps, auf } = macheDeps({ offer: offerte({ customer_email: null }) });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.body).toMatchObject({ skipped: true, reason: "no_email" });
    expect(auf.mails).toEqual([]);
  });
});

describe("Versand", () => {
  it("an die Adresse und in der Sprache DER ZEILE, mit den Terminen der Offerte", async () => {
    const { deps, auf } = macheDeps({
      items: [
        { service_type: "umzug", scheduled_date: "2026-10-02", scheduled_start_time: "07:30:00", position: 1 },
        { service_type: "reinigung", scheduled_date: "2026-10-05", scheduled_start_time: null, position: 2 },
      ],
    });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(auf.mails).toHaveLength(1);
    expect(auf.mails[0].to).toBe("kundin@example.test");
    expect(auf.renders[0].locale).toBe("fr");
    expect(auf.renders[0].termine).toEqual([
      { serviceType: "umzug", date: "2026-10-02", startTime: "07:30" },
      { serviceType: "reinigung", date: "2026-10-05", startTime: null },
    ]);
    expect(auf.logs[0]).toMatchObject({
      emailType: EMAIL_TYPE,
      status: "sent",
      language: "fr",
      metadata: { offer_id: OFFERTE, accepted_via: "manual", isCompanyEmail: false },
    });
  });

  it("benutzt den Firmenzugang und faellt bei dessen Fehler auf den allgemeinen zurueck", async () => {
    const { deps, auf } = macheDeps({
      company: firma({ resend_enabled: true, resend_from_email: "offerte@muster.test" }),
      secrets: { resend_api_key: FIRMEN_KEY },
      sendFehler: (a) => a.apiKey === FIRMEN_KEY,
    });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.status).toBe(200);
    expect(auf.mails.map((m) => m.apiKey)).toEqual([FIRMEN_KEY, GLOBAL_KEY]);
    // Die zweite Fassung nennt nicht mehr die Firma als Absender.
    expect(auf.renders.map((c) => c.isCompanyEmail)).toEqual([true, false]);
    expect(auf.logs[0]).toMatchObject({ status: "sent", metadata: { isCompanyEmail: false } });
  });

  it("protokolliert einen Fehlschlag, damit ein spaeterer Versuch nicht blockiert ist", async () => {
    const { deps, auf } = macheDeps({ sendFehler: () => true });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r).toEqual({ status: 502, body: { error: "email_send_failed" } });
    expect(auf.logs[0].status).toBe("failed");
  });

  it("ueberspringt ohne jeden Resend-Schluessel", async () => {
    const { deps, auf } = macheDeps({ globalKey: undefined });
    const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
    expect(r.body).toMatchObject({ skipped: true, reason: "no_api_key" });
    expect(auf.mails).toEqual([]);
  });
});

describe("Unerwartete Ausnahmen", () => {
  it("geben eine feste Antwort ohne Fehlerinhalt heraus", async () => {
    for (const ort of ["loadOffer", "renderEmail"]) {
      const { deps } = macheDeps({ wirftIn: ort });
      const r = await handleAcceptanceConfirmation(deps, post({ offerId: OFFERTE, accessToken: TOKEN }));
      expect(r).toEqual({ status: 503, body: { error: "service_unavailable" } });
      expect(JSON.stringify(r)).not.toContain("WURF-SENTINEL");
    }
  });

  it("lehnt andere Methoden ab", async () => {
    const { deps, auf } = macheDeps();
    const r = await handleAcceptanceConfirmation(deps, { method: "GET", authorization: null });
    expect(r.status).toBe(405);
    expect(auf.spur).toEqual([]);
  });
});
