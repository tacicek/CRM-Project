// Shared invoice/receipt email body (send-quittung + send-rechnung-email).
// Uses the wrapEmailDocument shell; function-specific parts via parameter/extraSection.
import { wrapEmailDocument, EMAIL_FONT_STACK } from "./emailLayout.ts";

export function fmtChf(amount: number): string {
  return "CHF " + amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface InvoiceEmailLine {
  beschreibung: string;
  /** Middle column text — Quittung: rate ("3 Std. × CHF 50"), Rechnung: "6 Std". */
  detail: string;
  betrag: number;
}

export interface InvoiceEmailData {
  companyName: string;
  /** Brand color (primary_color), e.g. "#10B981". */
  brand: string;
  /** Header label: "Quittung" | "Rechnung". */
  documentLabel: string;
  /** Document number: QU-2026-0001 | RE-2026-0001. */
  documentNumber: string;
  /** ISO date. */
  datum: string;
  customerName: string;
  /** Body intro sentence (document-specific). */
  intro: string;
  /** Middle column heading: "Satz" | "Menge". */
  detailLabel: string;
  lines: InvoiceEmailLine[];
  zwischensumme: number;
  /** Optional — if > 0 a Rabatt row is shown (Quittung). */
  rabatt?: number;
  mwstSatz: number;
  mwstBetrag: number;
  /** Total row label: "Gesamttotal" | "Total". */
  totalLabel: string;
  total: number;
  /** Raw HTML appended after the totals (Quittung: outstanding notice | Rechnung: payment box). */
  extraSection?: string;
  /** Footer parts (IBAN/bank/MwSt/phone) — empty ones are dropped. */
  footerParts: string[];
}

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const rows = data.lines.map((l) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;">${l.beschreibung}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#71717a;">${l.detail}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;text-align:right;">${fmtChf(l.betrag)}</td>
    </tr>`).join("");

  const rabattRow = data.rabatt && data.rabatt > 0 ? `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">Rabatt:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">-${fmtChf(data.rabatt)}</td>
        </tr>` : "";

  const inner = `
    <!-- Header -->
    <div style="background:${data.brand};padding:24px 20px 20px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-family:${EMAIL_FONT_STACK}">
        ${data.documentLabel}
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;font-family:${EMAIL_FONT_STACK}">
        ${data.companyName}
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-family:${EMAIL_FONT_STACK}">
        ${data.documentNumber} · ${fmtDate(data.datum)}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:24px 20px;background:#fafafa;">
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;font-family:${EMAIL_FONT_STACK}">
        Guten Tag ${data.customerName},
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        ${data.intro}
      </p>

      <!-- Positionen -->
      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;background:#fff;margin-bottom:16px;">
        <thead>
          <tr style="background:${data.brand};">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">Beschreibung</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">${data.detailLabel}</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#fff;font-weight:600;font-family:${EMAIL_FONT_STACK}">Betrag</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Totals -->
      <table width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:280px;margin-left:auto;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">Zwischensumme:</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${fmtChf(data.zwischensumme)}</td>
        </tr>${rabattRow}
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#71717a;font-family:${EMAIL_FONT_STACK}">MwSt. (${data.mwstSatz}%):</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;font-family:${EMAIL_FONT_STACK}">${fmtChf(data.mwstBetrag)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${data.brand}22;border-radius:4px 0 0 4px;color:${data.brand};font-family:${EMAIL_FONT_STACK}">${data.totalLabel}:</td>
          <td style="padding:10px 12px;font-size:16px;font-weight:700;background:${data.brand}22;border-radius:0 4px 4px 0;text-align:right;color:${data.brand};font-family:${EMAIL_FONT_STACK}">${fmtChf(data.total)}</td>
        </tr>
      </table>

      ${data.extraSection ?? ""}

      <p style="margin:16px 0 4px;font-size:13px;color:#3f3f46;font-family:${EMAIL_FONT_STACK}">
        Mit freundlichen Grüssen,<br>
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

  return wrapEmailDocument(inner);
}

/** Customer email subject line: "Ihre {Quittung|Rechnung} von {Firma} – {Nr}". */
export function buildInvoiceEmailSubject(params: {
  documentTitle: string;
  documentNumber: string;
  companyName: string;
}): string {
  return `Ihre ${params.documentTitle} von ${params.companyName} – ${params.documentNumber}`;
}
