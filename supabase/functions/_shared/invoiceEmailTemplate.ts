// Shared invoice/receipt email body (send-quittung + send-rechnung-email).
// Uses the wrapEmailDocument shell; function-specific parts via parameter/extraSection.
//
// LOCALE: every label is resolved from the i18n catalog against the DOCUMENT locale
// (quittungen.language / rechnungen.language) — nothing is passed in as a German string
// any more. fmtChf/fmtDate follow the same locale instead of hardcoding de-CH.
import { wrapEmailDocument, EMAIL_FONT_STACK } from "./emailLayout.ts";
import {
  createTranslator,
  formatCurrency,
  formatDate,
  type Locale,
} from "./i18n/index.ts";

/** "CHF 1'250.00" (de) · "1 250.00 CHF" (fr) · "CHF 1,250.00" (en) — currency is always CHF. */
export function fmtChf(amount: number, locale: Locale): string {
  return formatCurrency(amount, locale);
}

/** Numeric date in the document's locale. */
export function fmtDate(isoDate: string, locale: Locale): string {
  return formatDate(isoDate, locale);
}

export interface InvoiceEmailLine {
  beschreibung: string;
  /** Middle column text — Quittung: rate ("3 Std. × CHF 50"), Rechnung: "6 Std". */
  detail: string;
  betrag: number;
}

/** Which document is being rendered — drives the header label and the two column headings. */
export type InvoiceDocumentKind = "quittung" | "rechnung";

export interface InvoiceEmailData {
  companyName: string;
  /** Brand color (primary_color), e.g. "#10B981". */
  brand: string;
  /** Document locale (quittungen.language | rechnungen.language). */
  locale: Locale;
  /** Selects header label, intro sentence, detail column heading and total row label. */
  kind: InvoiceDocumentKind;
  /** Document number: QU-2026-0001 | RE-2026-0001. */
  documentNumber: string;
  /** ISO date. */
  datum: string;
  customerName: string;
  lines: InvoiceEmailLine[];
  zwischensumme: number;
  /** Optional — if > 0 a discount row is shown (Quittung). */
  rabatt?: number;
  mwstSatz: number;
  mwstBetrag: number;
  total: number;
  /** Raw HTML appended after the totals (Quittung: outstanding notice | Rechnung: payment box). */
  extraSection?: string;
  /** Footer parts (IBAN/bank/MwSt/phone) — empty ones are dropped. */
  footerParts: string[];
}

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const t = createTranslator(data.locale);
  const money = (n: number) => fmtChf(n, data.locale);

  const documentLabel =
    data.kind === "quittung"
      ? t("email.quittung.documentLabel")
      : t("email.rechnung.documentLabel");
  const intro =
    data.kind === "quittung" ? t("email.quittung.intro") : t("email.rechnung.intro");
  const detailLabel =
    data.kind === "quittung"
      ? t("email.quittung.detailLabel")
      : t("email.rechnung.detailLabel");
  const totalLabel =
    data.kind === "quittung"
      ? t("email.quittung.totalLabel")
      : t("email.rechnung.totalLabel");

  const rows = data.lines.map((l) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;">${l.beschreibung}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#71717a;">${l.detail}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;text-align:right;">${money(l.betrag)}</td>
    </tr>`).join("");

  const rabattRow = data.rabatt && data.rabatt > 0 ? `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">${t("email.invoice.discount")}:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">-${money(data.rabatt)}</td>
        </tr>` : "";

  const inner = `
    <!-- Header -->
    <div style="background:${data.brand};padding:24px 20px 20px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-family:${EMAIL_FONT_STACK}">
        ${documentLabel}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;font-family:${EMAIL_FONT_STACK}">
        ${data.companyName}
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-family:${EMAIL_FONT_STACK}">
        ${data.documentNumber} · ${fmtDate(data.datum, data.locale)}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:24px 20px;background:#fafafa;">
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;font-family:${EMAIL_FONT_STACK}">
        ${t("common.greeting", { name: data.customerName })}
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        ${intro}
      </p>

      <!-- Positionen -->
      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;background:#fff;margin-bottom:16px;">
        <thead>
          <tr style="background:${data.brand};">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">${t("email.invoice.colDescription")}</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">${detailLabel}</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">${t("email.invoice.colAmount")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Totals -->
      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:280px;margin-left:auto;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">${t("email.invoice.subtotal")}:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${money(data.zwischensumme)}</td>
        </tr>${rabattRow}
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">${t("email.invoice.vat", { rate: data.mwstSatz })}:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${money(data.mwstBetrag)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${data.brand}22;border-radius:4px 0 0 4px;color:${data.brand};font-family:${EMAIL_FONT_STACK}">${totalLabel}:</td>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${data.brand}22;border-radius:0 4px 4px 0;text-align:right;color:${data.brand};font-family:${EMAIL_FONT_STACK}">${money(data.total)}</td>
        </tr>
      </table>

      ${data.extraSection ?? ""}

      <p style="margin:16px 0 4px;font-size:13px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        ${t("common.regards")},<br>
        <strong>${data.companyName}</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:14px 20px;background:#f4f4f5;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;font-family:${EMAIL_FONT_STACK}">
        ${data.footerParts.filter(Boolean).join("  ·  ")}
      </p>
    </div>
  `;

  return wrapEmailDocument(inner, data.locale);
}

/** Customer email subject line — rendered in the document's locale. */
export function buildInvoiceEmailSubject(params: {
  kind: InvoiceDocumentKind;
  locale: Locale;
  documentNumber: string;
  companyName: string;
}): string {
  const t = createTranslator(params.locale);
  const documentTitle =
    params.kind === "quittung"
      ? t("email.quittung.documentLabel")
      : t("email.rechnung.documentLabel");
  return t("email.invoice.subject", {
    documentTitle,
    companyName: params.companyName,
    documentNumber: params.documentNumber,
  });
}
