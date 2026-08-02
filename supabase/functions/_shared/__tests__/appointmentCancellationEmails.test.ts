import { describe, expect, it } from "vitest";
import {
  renderCompanyCancellationEmail,
  renderCustomerCancellationEmail,
  sanitizeSubject,
} from "../appointmentCancellationEmails.ts";
import type {
  AppointmentRow,
  CancellationRenderContext,
  CompanyRow,
} from "../appointmentCancellationGuard.ts";
import type { Locale } from "../i18n/index.ts";

const TERMIN_ID = "11111111-2222-3333-4444-555555555555";
const FIRMA_ID = "99999999-8888-7777-6666-555555555555";

/** Werte, die in rohem HTML etwas anrichten wuerden. */
const BOESE_NAME = '<img src=x onerror="alert(1)">Anna';
const BOESE_TITEL = "<script>fetch('//evil.test')</script>Umzug";
const BOESE_GRUND = 'Zu teuer & "unfair" <b>wirklich</b>';
const BOESE_FIRMA = "<iframe src='//evil.test'></iframe>Muster AG";
const CRLF_TITEL = "Umzug\r\nBcc: opfer@example.test";

const termin = (over: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id: TERMIN_ID,
  company_id: FIRMA_ID,
  title: "Besichtigung Zürich",
  appointment_date: "2026-09-10",
  start_time: "09:30:00",
  customer_first_name: "Anna",
  customer_last_name: "Beispiel",
  customer_email: "kundin@example.test",
  language: "de",
  ...over,
});

const firma = (over: Partial<CompanyRow> = {}): CompanyRow => ({
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

const ctx = (over: Partial<CancellationRenderContext> = {}): CancellationRenderContext => ({
  appointment: termin(),
  company: firma(),
  cancellationReason: "Kunde verhindert",
  isCompanyEmail: false,
  locale: "de",
  appName: "Offerio",
  ...over,
});

const LOCALES: Locale[] = ["de", "fr", "en"];

describe("sanitizeSubject", () => {
  it("entfernt Zeilenumbrueche und Tabulatoren", () => {
    expect(sanitizeSubject("A\r\nB")).toBe("A B");
    expect(sanitizeSubject("A\nB\tC")).toBe("A B C");
    expect(sanitizeSubject("A\r\n\r\nBcc: opfer@example.test")).toBe("A Bcc: opfer@example.test");
  });

  it("entfernt auch die selteneren Zeilentrenner", () => {
    // U+2028/U+2029 sind in JavaScript-Quelltext selbst Zeilenenden und werden
    // von `\s` zwar erfasst, U+0085 aber nicht.
    expect(sanitizeSubject("A\u0085B")).toBe("A B");
    expect(sanitizeSubject("A\u2028B\u2029C")).toBe("A B C");
    expect(sanitizeSubject("A\u0000B")).toBe("A B");
  });

  it("zieht Leerraum zusammen und schneidet die Raender", () => {
    expect(sanitizeSubject("  viel    Luft  ")).toBe("viel Luft");
  });
});

describe("Firmen-Absagemail", () => {
  it.each(LOCALES)("rendert in %s", (locale) => {
    const { subject, html } = renderCompanyCancellationEmail(ctx({ locale }));
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain("Termin abgesagt");
    expect(html).toContain("Besichtigung Zürich");
    expect(html).toContain("09:30");
  });

  it("maskiert Kundenname, Titel, Grund und Firmenname", () => {
    const { html } = renderCompanyCancellationEmail(
      ctx({
        appointment: termin({ customer_first_name: BOESE_NAME, customer_last_name: "", title: BOESE_TITEL }),
        company: firma({ company_name: BOESE_FIRMA }),
        cancellationReason: BOESE_GRUND,
        isCompanyEmail: true,
      }),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;iframe");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;unfair&quot;");
  });

  it("laesst kein CR/LF in den Betreff", () => {
    const { subject } = renderCompanyCancellationEmail(
      ctx({ appointment: termin({ title: CRLF_TITEL, customer_first_name: "A\r\nB", customer_last_name: "" }) }),
    );
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Bcc: opfer@example.test"); // als Text, nicht als Kopfzeile
  });

  it("zeigt den Grundblock nur, wenn es einen Grund gibt", () => {
    expect(renderCompanyCancellationEmail(ctx({ cancellationReason: null })).html).not.toContain("Absagegrund");
    expect(renderCompanyCancellationEmail(ctx({ cancellationReason: "krank" })).html).toContain("Absagegrund");
  });

  it("zeigt den Kundenkontakt nur bei hinterlegter Adresse", () => {
    expect(
      renderCompanyCancellationEmail(ctx({ appointment: termin({ customer_email: null }) })).html,
    ).not.toContain("Kundenkontakt");
    expect(renderCompanyCancellationEmail(ctx()).html).toContain("Kundenkontakt");
  });

  it("nennt bei fehlendem Namen Unbekannt statt einer leeren Stelle", () => {
    const { html } = renderCompanyCancellationEmail(
      ctx({ appointment: termin({ customer_first_name: null, customer_last_name: null }) }),
    );
    expect(html).toContain("Unbekannt");
  });
});

describe("Kunden-Absagemail", () => {
  it.each(LOCALES)("rendert in %s und setzt lang=%s", (locale) => {
    const { subject, html } = renderCustomerCancellationEmail(ctx({ locale }));
    expect(html).toContain(`<html lang="${locale}">`);
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain("Besichtigung Zürich");
  });

  it("unterscheidet die drei Sprachen wirklich", () => {
    const betreffe = LOCALES.map((locale) => renderCustomerCancellationEmail(ctx({ locale })).subject);
    expect(new Set(betreffe).size).toBe(3);
  });

  it("maskiert Kundenname, Titel und Firmenname", () => {
    const { html } = renderCustomerCancellationEmail(
      ctx({
        appointment: termin({ customer_first_name: BOESE_NAME, customer_last_name: "", title: BOESE_TITEL }),
        company: firma({ company_name: BOESE_FIRMA }),
      }),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;iframe");
  });

  it("behaelt die gewollte Auszeichnung des Katalogs", () => {
    // Der Firmenname steht fett im Intro. Wuerde die Katalogausgabe selbst
    // maskiert, stuende dort &lt;strong&gt; — der Test haelt beides auseinander.
    const { html } = renderCustomerCancellationEmail(ctx());
    expect(html).toContain("<strong>Muster Umzug AG</strong>");
    expect(html).not.toContain("&lt;strong&gt;");
  });

  it("laesst kein CR/LF in den Betreff", () => {
    const { subject } = renderCustomerCancellationEmail(ctx({ appointment: termin({ title: CRLF_TITEL }) }));
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("Beide Mails", () => {
  const alle = (c: CancellationRenderContext) => [
    renderCompanyCancellationEmail(c),
    renderCustomerCancellationEmail(c),
  ];

  it("kennen kein Token — es gibt kein Feld dafuer", () => {
    const c = ctx();
    // Der Zusammenhang traegt bewusst keine Capability. Waere hier ein Feld,
    // koennte es in Betreff oder HTML geraten.
    expect(Object.keys(c).sort()).toEqual([
      "appName",
      "appointment",
      "cancellationReason",
      "company",
      "isCompanyEmail",
      "locale",
    ]);
    const TOKENARTIG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    for (const { subject, html } of alle(c)) {
      expect(subject).not.toContain(TOKENARTIG);
      expect(html).not.toContain(TOKENARTIG);
    }
  });

  it("bringen bei boesartigen Werten in keiner Sprache rohes HTML durch", () => {
    for (const locale of LOCALES) {
      const c = ctx({
        locale,
        appointment: termin({ customer_first_name: BOESE_NAME, customer_last_name: "", title: BOESE_TITEL }),
        company: firma({ company_name: BOESE_FIRMA }),
        cancellationReason: BOESE_GRUND,
      });
      for (const { subject, html } of alle(c)) {
        expect(html).not.toContain("<img src=x");
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<iframe");
        expect(html).not.toContain("onerror=\"alert(1)\"");
        expect(subject).not.toMatch(/[\r\n]/);
      }
    }
  });

  it("nennen den Absagegrund nur in der Firmenmail", () => {
    const c = ctx({ cancellationReason: "Ich ziehe doch nicht um" });
    expect(renderCompanyCancellationEmail(c).html).toContain("Ich ziehe doch nicht um");
    expect(renderCustomerCancellationEmail(c).html).not.toContain("Ich ziehe doch nicht um");
  });

  it("setzen den Absender je nach Herkunft des Zugangs", () => {
    const eigen = ctx({ isCompanyEmail: true });
    expect(renderCompanyCancellationEmail(eigen).html).toContain("Muster Umzug AG");
    const fremd = ctx({ isCompanyEmail: false });
    expect(renderCustomerCancellationEmail(fremd).html).toContain("Offerio");
  });
});

// ── Genau einmal maskieren ──────────────────────────────────────────────────
//
// Der erste Anlauf maskierte den Absendernamen zweimal: einmal in der
// Hilfsfunktion, einmal an der Einsetzstelle. Aus `Müller & Söhne` wurde
// `Müller &amp;amp; Söhne`, in der Mail sichtbar als `Müller &amp; Söhne`.
// Kein Loch, aber falscher Text — und ein Fehler, den man nur bemerkt, wenn
// man ausdruecklich danach sucht.

describe("Einfache Maskierung", () => {
  const AMPERSAND_FIRMA = "Müller & Söhne";
  const AMPERSAND_APP = "A & B";

  const beide = (c: CancellationRenderContext) => [
    ["firma", renderCompanyCancellationEmail(c)] as const,
    ["kunde", renderCustomerCancellationEmail(c)] as const,
  ];

  it("maskiert den Firmennamen beim eigenen Zugang genau einmal", () => {
    const c = ctx({ company: firma({ company_name: AMPERSAND_FIRMA }), isCompanyEmail: true });
    for (const [wer, { html }] of beide(c)) {
      expect(html, wer).toContain("Müller &amp; Söhne");
      expect(html, wer).not.toContain("&amp;amp;");
    }
  });

  it("maskiert den allgemeinen App-Namen genau einmal", () => {
    const c = ctx({ company: firma({ company_name: "Muster AG" }), isCompanyEmail: false, appName: AMPERSAND_APP });
    for (const [wer, { html }] of beide(c)) {
      expect(html, wer).not.toContain("&amp;amp;");
      expect(html, wer).toContain("A &amp; B");
    }
  });

  it("maskiert auch den Firmennamen im Fliesstext des Kunden genau einmal", () => {
    const c = ctx({ company: firma({ company_name: AMPERSAND_FIRMA }) });
    const { html } = renderCustomerCancellationEmail(c);
    expect(html).toContain("<strong>Müller &amp; Söhne</strong>");
    expect(html).not.toContain("&amp;amp;");
  });

  it("maskiert Titel und Grund genau einmal", () => {
    const c = ctx({
      appointment: termin({ title: "Umzug & Reinigung" }),
      cancellationReason: "Zu teuer & zu spät",
    });
    const { html } = renderCompanyCancellationEmail(c);
    expect(html).toContain("Umzug &amp; Reinigung");
    expect(html).toContain("Zu teuer &amp; zu spät");
    expect(html).not.toContain("&amp;amp;");
  });

  it("laesst in keiner Sprache und auf keinem Zugangsweg eine Doppelmaskierung zu", () => {
    for (const locale of LOCALES) {
      for (const isCompanyEmail of [true, false]) {
        const c = ctx({
          locale,
          isCompanyEmail,
          appName: AMPERSAND_APP,
          company: firma({ company_name: AMPERSAND_FIRMA }),
          appointment: termin({ title: "A & B", customer_first_name: "Ann & Ida", customer_last_name: "" }),
          cancellationReason: "X & Y",
        });
        for (const [wer, { html }] of beide(c)) {
          expect(html, `${locale}/${isCompanyEmail}/${wer}`).not.toContain("&amp;amp;");
          expect(html, `${locale}/${isCompanyEmail}/${wer}`).not.toContain("&amp;lt;");
        }
      }
    }
  });

  it("schuetzt weiterhin gegen rohes HTML — die Maskierung wurde nicht geschwaecht", () => {
    for (const locale of LOCALES) {
      for (const isCompanyEmail of [true, false]) {
        const c = ctx({
          locale,
          isCompanyEmail,
          appName: BOESE_NAME,
          company: firma({ company_name: BOESE_FIRMA }),
          appointment: termin({ title: BOESE_TITEL, customer_first_name: BOESE_NAME, customer_last_name: "" }),
          cancellationReason: BOESE_GRUND,
        });
        for (const [wer, { html, subject }] of beide(c)) {
          const kennung = `${locale}/${isCompanyEmail}/${wer}`;
          expect(html, kennung).not.toContain("<img src=x");
          expect(html, kennung).not.toContain("<script>");
          expect(html, kennung).not.toContain("<iframe");
          expect(subject, kennung).not.toMatch(/[\r\n]/);
        }
      }
    }
  });
});
