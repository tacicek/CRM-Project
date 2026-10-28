import { escapeHtml } from "../_shared/htmlEscape.ts";
import { createTranslator, formatCurrency, LOCALE_TAGS, type Locale, type MessageKey } from "../_shared/i18n/index.ts";

export interface ReceiptEmailPosition {
  beschreibung: string; satz: string; betrag: number; checked: boolean;
  menge?: number | null; einheit?: string | null; einzelpreis?: number | null; price_type?: string | null;
}

export const receiptEmailLines = (positions: ReceiptEmailPosition[], locale: Locale) => {
  const t = createTranslator(locale);
  return positions.filter(p => p.checked).map(p => ({
    beschreibung: p.beschreibung,
    detail: p.price_type === "inkl" ? t("email.quittung.included") : [
      typeof p.menge === "number" && typeof p.einzelpreis === "number"
        ? `${new Intl.NumberFormat(LOCALE_TAGS[locale]).format(p.menge)}${p.einheit ? ` ${p.einheit}` : ""} × ${formatCurrency(p.einzelpreis, locale)}` : "",
      p.satz,
    ].filter(Boolean).join(" · "),
    betrag: p.betrag,
  }));
};

export interface ReceiptEmailPayment {
  rechnung_id: string | null; payment_status: string; paid_amount: number; payment_open_amount: number;
  payment_date: string | null; payment_method: string | null; payment_reference: string | null;
}
const methods: Record<string, MessageKey> = {
  cash: "email.quittung.method.cash", bank: "email.quittung.method.bank", qr: "email.quittung.method.qr",
  twint: "email.quittung.method.twint", card: "email.quittung.method.card", other: "email.quittung.method.other",
};

/** Invoice balances include credits; never infer them by subtracting cash from receipt total. */
export const receiptEmailPaymentHtml = (receipt: ReceiptEmailPayment, locale: Locale): string => {
  const t = createTranslator(locale);
  const status = t(receipt.payment_status === "paid" ? "email.quittung.paid" : receipt.payment_status === "partial" ? "email.quittung.partial" : "email.quittung.open");
  const rows: Array<[string, string]> = [
    [t(receipt.rechnung_id ? "email.quittung.invoicePaidAmount" : "email.quittung.paidAmount"), formatCurrency(receipt.paid_amount, locale)],
    [t(receipt.rechnung_id ? "email.quittung.invoiceOpenAmount" : "email.quittung.openAmount"), formatCurrency(receipt.payment_open_amount, locale)],
  ];
  if (receipt.payment_date) rows.push([t("email.quittung.paymentDate"), new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC",
  }).format(new Date(`${receipt.payment_date}T12:00:00Z`))]);
  if (receipt.payment_method) rows.push([t("email.quittung.paymentMethod"), methods[receipt.payment_method] ? t(methods[receipt.payment_method]) : receipt.payment_method]);
  if (receipt.payment_reference) rows.push([t("email.quittung.paymentReference"), receipt.payment_reference]);
  return `<section><p><strong>${escapeHtml(status)}</strong>${receipt.rechnung_id ? ` · ${escapeHtml(t("email.quittung.paymentSource"))}` : ""}</p>${rows.map(([label, value]) => `<p>${escapeHtml(label)}: ${escapeHtml(value)}</p>`).join("")}</section>`;
};
