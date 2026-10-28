import { describe, expect, it } from "vitest";
import { buildInvoiceEmailHtml } from "../../_shared/invoiceEmailTemplate";
import { receiptEmailLines, receiptEmailPaymentHtml } from "../presentation";

describe("receipt email content", () => {
  it("uses the invoice balance after credits without inventing received cash", () => {
    const html = receiptEmailPaymentHtml({
      rechnung_id: "invoice", payment_status: "paid", paid_amount: 40, payment_open_amount: 0,
      payment_date: "2026-10-26", payment_method: "bank", payment_reference: "<img src=x>",
    }, "en");
    expect(html).toContain("Paid");
    expect(html).toContain("Payment through the linked invoice");
    expect(html).toMatch(/Payments recorded on invoice:.*40\.00/);
    expect(html).toMatch(/Invoice balance:.*0\.00/);
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toContain("<img");
  });

  it("includes structured rates while distinguishing free and unselected items", () => {
    const lines = receiptEmailLines([
      { beschreibung: "Transport", satz: "", betrag: 100, checked: true, menge: 2, einzelpreis: 50, einheit: "h" },
      { beschreibung: "Boxes", satz: "", betrag: 0, checked: true, menge: 5, einzelpreis: 10, price_type: "inkl" },
      { beschreibung: "Optional", satz: "", betrag: 70, checked: false },
    ], "en");
    expect(lines).toHaveLength(2);
    expect(lines[0].detail).toMatch(/2 h ×.*50\.00/);
    expect(lines[1]).toMatchObject({ detail: "Included", betrag: 0 });
  });

  it.each(["de", "fr", "en"] as const)("escapes customer-controlled HTML and retains original characters (%s)", locale => {
    const html = buildInvoiceEmailHtml({
      kind: "quittung", locale, companyName: "Firma <img src=x onerror=alert(1)>",
      brand: "#123456", documentNumber: "QU-2026-0001", datum: "2026-10-26",
      customerName: "Çağrı Şimşek <script>alert(1)</script>",
      lines: [{ beschreibung: 'Transport <svg onload="x">', detail: "A&B", betrag: 0 }],
      zwischensumme: 0, mwstSatz: 8.1, mwstBetrag: 0, total: 0,
      footerParts: ["Bank <b>ungeprüft</b>"],
    });
    expect(html).toContain("Çağrı Şimşek &lt;script&gt;");
    expect(html).toContain("Firma &lt;img");
    expect(html).toContain("Transport &lt;svg onload=&quot;x&quot;&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("Bank &lt;b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<svg");
  });

  it("rejects a brand color that attempts to inject HTML/CSS", () => {
    expect(() => buildInvoiceEmailHtml({
      kind: "quittung", locale: "de", companyName: "Firma", brand: '\" onclick=\"bad',
      documentNumber: "Q1", datum: "2026-10-26", customerName: "Kunde", lines: [],
      zwischensumme: 0, mwstSatz: 0, mwstBetrag: 0, total: 0, footerParts: [],
    })).toThrow();
  });
});
