import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Quittung } from "@/types/quittung.types";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";
import { formatAmount, formatCurrency, formatPercent } from "@/i18n/format";
import { buildReceiptPdfRows, formatReceiptDate, formatReceiptTimestamp } from "@/lib/quittungPresentation";
import { RECEIPT_PDF_FONT } from "@/components/quittung/quittungPdfFont";
import { formatReceiptStreet } from "@/lib/receiptAddress";

export interface QuittungPdfCompany {
  company_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  email: string;
  phone?: string | null;
  street?: string | null;
  house_number?: string | null;
  plz?: string | null;
  city?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  bewertungs_url?: string | null;
}

export type QuittungPdfMode = "receipt" | "worksheet";

export interface QuittungPDFProps {
  quittung: Quittung;
  /** The frozen issuer snapshot for a finalized receipt; live company for a draft. */
  company: QuittungPdfCompany;
  /** Customer document language, independent of the dashboard language. */
  locale: Locale;
  /** Blank handwriting fields are an explicit output choice, never a lifecycle status. */
  mode?: QuittungPdfMode;
}

const BRAND = "#10B981";
const GRAY = { light: "#F5F7F9", border: "#DCE2E7", muted: "#526170", ink: "#172B3A" };
const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  bank: "doc.receipt.payment.bank", qr: "doc.receipt.payment.qr",
  cash: "doc.receipt.payment.cash", card: "doc.receipt.payment.card",
  twint: "doc.receipt.payment.twint", other: "doc.receipt.payment.other",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 62, paddingHorizontal: 42, paddingBottom: 52,
    fontSize: 9, fontFamily: RECEIPT_PDF_FONT, color: GRAY.ink,
  },
  runningHeader: {
    position: "absolute", top: 24, left: 42, right: 42,
    flexDirection: "row", justifyContent: "space-between", gap: 16,
    fontSize: 8, color: GRAY.muted,
  },
  runningTitle: { fontWeight: 700 },
  runningMode: { maxWidth: 280, textAlign: "right" },
  pageFooter: {
    position: "absolute", bottom: 24, left: 42, right: 42,
    flexDirection: "row", justifyContent: "space-between", gap: 20,
    borderTopWidth: 0.5, borderTopColor: GRAY.border, paddingTop: 7,
    fontSize: 7, color: GRAY.muted,
  },
  // The first-page masthead starts at the 42 pt print margin; later pages reserve
  // space above their content for the compact running document identity.
  header: { flexDirection: "row", gap: 26, marginTop: -20, marginBottom: 18 },
  issuer: { flex: 1 },
  logo: { width: 144, height: 48, objectFit: "contain", objectPositionX: "left", marginBottom: 10 },
  companyName: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  companyText: { fontSize: 8, color: GRAY.muted, lineHeight: 1.5 },
  documentHeading: { width: 225, alignItems: "flex-end" },
  title: { fontSize: 27, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 },
  documentNumber: { fontSize: 10, fontWeight: 700, marginBottom: 7 },
  documentMeta: { fontSize: 8, color: GRAY.muted, textAlign: "right", marginTop: 3 },
  mode: { fontSize: 8, fontWeight: 700, textAlign: "right", marginTop: 8, color: GRAY.muted },
  addressRow: {
    flexDirection: "row", gap: 30, marginBottom: 16, paddingTop: 16,
    borderTopWidth: 0.5, borderTopColor: GRAY.border,
  },
  address: { flex: 1 },
  label: { fontSize: 7.5, fontWeight: 700, color: GRAY.muted, marginBottom: 6, letterSpacing: 0.3 },
  customerName: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  addressText: { fontSize: 9, lineHeight: 1.5 },
  customerContact: { fontSize: 8, color: GRAY.muted, lineHeight: 1.5, marginTop: 6 },
  tableHeader: {
    flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8,
    backgroundColor: GRAY.light, borderTopWidth: 2, borderTopColor: GRAY.ink,
    borderBottomWidth: 0.5, borderBottomColor: GRAY.border,
  },
  tableHeaderText: { fontSize: 7.5, fontWeight: 700, color: GRAY.ink },
  row: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  rowDisabled: { color: GRAY.muted },
  description: { width: "49%", paddingRight: 12, fontSize: 9, lineHeight: 1.45 },
  rate: { width: "31%", paddingRight: 8, fontSize: 8, lineHeight: 1.5, color: GRAY.muted },
  amount: { width: "20%", textAlign: "right", fontSize: 9, lineHeight: 1.45 },
  continuationLabel: { fontSize: 7, color: GRAY.muted, marginBottom: 3 },
  worksheetHeading: { marginTop: 12, paddingVertical: 6, fontSize: 8, fontWeight: 700 },
  blankRow: { height: 28, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  summary: { flexDirection: "row", gap: 28, marginTop: 16, marginBottom: 12 },
  payment: { flex: 1, paddingRight: 4 },
  paymentStatus: { fontWeight: 700, fontSize: 11, marginBottom: 5 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 8 },
  paymentRowLabel: { flex: 1, color: GRAY.muted },
  paymentRowValue: { maxWidth: "50%", textAlign: "right" },
  paymentInfo: { fontSize: 7.5, color: GRAY.muted, lineHeight: 1.5, marginTop: 4 },
  totals: { width: 225 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  totalsLabel: { color: GRAY.muted, flex: 1, fontSize: 8.5 },
  totalsValue: { textAlign: "right", fontSize: 8.5 },
  finalTotal: { borderTopWidth: 1.5, borderTopColor: GRAY.ink, paddingTop: 10, marginTop: 7 },
  finalLabel: { fontSize: 10, fontWeight: 700, flex: 1 },
  finalAmount: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  blankValue: { width: 90, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  worksheetPayment: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 8, marginTop: 5 },
  paymentOption: { flexDirection: "row", gap: 5, alignItems: "center", fontSize: 8 },
  checkbox: { width: 9, height: 9, borderWidth: 0.5, borderColor: GRAY.muted },
  bankDetails: { borderTopWidth: 0.5, borderTopColor: GRAY.border, paddingTop: 10, marginBottom: 10 },
  bankText: { fontSize: 8, color: GRAY.muted, lineHeight: 1.5 },
  signatures: { flexDirection: "row", gap: 32, marginTop: 12 },
  signature: { width: "46.8%" },
  signatureImage: { width: "100%", height: 44, objectFit: "contain" },
  signatureBlank: { height: 44 },
  signatureLabel: { borderTopWidth: 0.5, borderTopColor: GRAY.muted, paddingTop: 6, fontSize: 7.5, color: GRAY.muted },
  signatureDate: { fontSize: 7, color: GRAY.muted, marginTop: 3 },
  closing: { marginTop: 18, fontSize: 8, lineHeight: 1.6 },
  review: { fontSize: 7, color: GRAY.muted, marginTop: 3 },
});

export const QuittungPDF = ({ quittung, company, locale, mode = "receipt" }: QuittungPDFProps) => {
  const { t } = documentI18nFor(locale);
  const brand = /^#[\da-f]{6}$/i.test(company.primary_color ?? "") ? company.primary_color! : BRAND;
  const worksheet = mode === "worksheet";
  const rows = buildReceiptPdfRows(quittung.positionen, worksheet, locale);
  const number = quittung.quittung_nr || t("doc.receipt.draft");
  const paidAmount = quittung.paid_amount ?? 0;
  // Invoice balances include credits and may belong to a different invoice total.
  // Only the server's payment snapshot can supply that balance.
  const outstanding = quittung.payment_open_amount ?? (quittung.rechnung_id ? null
    : Math.max(0, Math.round((quittung.gesamttotal - paidAmount) * 100) / 100));
  const paymentMethod = quittung.payment_method ? PAYMENT_METHOD_KEYS[quittung.payment_method] : undefined;
  const statusKey: MessageKey = quittung.payment_status === "paid"
    ? "doc.receipt.payment.paid"
    : quittung.payment_status === "partial" ? "doc.receipt.payment.partial" : "doc.receipt.payment.open";
  const signatures = [
    { label: t("doc.receipt.signature.customer"), image: quittung.kunde_unterschrift, at: quittung.kunde_signed_at },
    { label: t("doc.receipt.signature.teamLead"), image: quittung.teamchef_unterschrift, at: quittung.teamchef_signed_at },
  ].filter(signature => worksheet || signature.image);
  const companyStreet = formatReceiptStreet(company.street, company.house_number);

  const tableHeader = (
    <View fixed style={[styles.tableHeader, { borderTopColor: brand }]} wrap={false}>
      <Text style={[styles.description, styles.tableHeaderText]}>{t("doc.receipt.col.description")}</Text>
      <Text style={[styles.rate, styles.tableHeaderText]}>{t("doc.receipt.col.rate")}</Text>
      <Text style={[styles.amount, styles.tableHeaderText]}>{t("doc.receipt.col.amount")}</Text>
    </View>
  );
  const paymentRow = (label: string, value: string) => (
    <View style={styles.paymentRow}>
      <Text style={styles.paymentRowLabel}>{label}</Text>
      <Text style={styles.paymentRowValue}>{value}</Text>
    </View>
  );

  return (
    <Document title={t("doc.receipt.numbered", { number })} language={locale}>
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.runningHeader} render={({ pageNumber }) => pageNumber > 1 ? (
          <>
            <Text style={styles.runningTitle}>{t("doc.receipt.numbered", { number })}</Text>
            <Text style={styles.runningMode}>{worksheet ? t("doc.receipt.worksheet") : formatReceiptDate(quittung.datum, locale)}</Text>
          </>
        ) : null} />
        <View fixed style={styles.pageFooter}>
          <Text>{t("doc.receipt.numbered", { number })}</Text>
          <Text render={({ pageNumber, totalPages }) => t("doc.receipt.page", { page: pageNumber, pages: totalPages })} />
        </View>

        <View style={styles.header} wrap={false}>
          <View style={styles.issuer}>
            {company.logo_url && <Image src={company.logo_url} style={[styles.logo, worksheet ? { height: 32, marginBottom: 8 } : {}]} />}
            <Text style={styles.companyName}>{company.company_name}</Text>
            <Text style={styles.companyText}>
              {[companyStreet, `${company.plz ?? ""} ${company.city ?? ""}`.trim(), company.phone, company.email,
                company.mwst_number ? t("doc.receipt.vatNumber") + company.mwst_number : null].filter(Boolean).join("\n")}
            </Text>
          </View>
          <View style={styles.documentHeading}>
            <Text style={styles.title}>{t("doc.receipt.title")}</Text>
            <Text style={styles.documentNumber}>{number}</Text>
            <Text style={styles.documentMeta}>{t("doc.receipt.date")}{formatReceiptDate(quittung.datum, locale)}</Text>
            {quittung.issued_at && <Text style={styles.documentMeta}>{t("doc.receipt.issuedAt")}{formatReceiptTimestamp(quittung.issued_at, locale)}</Text>}
            {(worksheet || quittung.status === "draft") && <Text style={styles.mode}>{t(worksheet ? "doc.receipt.worksheet" : "doc.receipt.draft")}</Text>}
          </View>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.address}>
            <Text style={styles.label}>{t("doc.receipt.customer")}</Text>
            <Text style={styles.customerName}>{quittung.customer_name}</Text>
            {quittung.customer_address && <Text style={styles.addressText}>{quittung.customer_address}</Text>}
            {(quittung.customer_phone || quittung.customer_email) && <Text style={styles.customerContact}>
              {[quittung.customer_phone, quittung.customer_email].filter(Boolean).join("\n")}
            </Text>}
          </View>
          {quittung.customer_destination && <View style={styles.address}>
            <Text style={styles.label}>{t("doc.receipt.destination")}</Text>
            <Text style={styles.addressText}>{quittung.customer_destination}</Text>
          </View>}
        </View>

        {/* Repetition is scoped to the wrapping item table. Summary-only pages
            must not inherit empty description/rate/amount column headings. */}
        <View>
          {tableHeader}
          {rows.map(row => (
          <View key={row.key} style={[styles.row, worksheet ? { paddingVertical: 6 } : {}, !row.checked ? styles.rowDisabled : {}]} wrap={false}>
            <View style={styles.description}>
              {row.continuation && <Text style={styles.continuationLabel}>{t("doc.receipt.continuation", { number: row.number })}</Text>}
              <Text>{row.description}</Text>
            </View>
            <Text style={styles.rate}>{row.rate}</Text>
            <Text style={styles.amount}>{row.amount === null ? "–" : formatAmount(row.amount, locale)}</Text>
          </View>
          ))}
        </View>

        {worksheet && <View wrap={false}>
          <Text style={styles.worksheetHeading}>{t("doc.receipt.onSiteExtras")}</Text>
          {[0, 1, 2].map(index => <View key={index} style={styles.blankRow} />)}
        </View>}

        <View style={styles.summary} wrap={false}>
          <View style={styles.payment}>
            <Text style={styles.label}>{t(worksheet ? "doc.receipt.paymentMethod" : "doc.receipt.paymentStatus")}</Text>
            {worksheet ? (
              <View style={styles.worksheetPayment}>
                {(["doc.receipt.payment.cash", "doc.receipt.payment.card", "doc.receipt.payment.twint", "doc.receipt.payment.bank"] as const).map(key => (
                  <View key={key} style={styles.paymentOption}><View style={styles.checkbox} /><Text>{t(key)}</Text></View>
                ))}
              </View>
            ) : <>
              <Text style={styles.paymentStatus}>{t(statusKey)}</Text>
              <Text style={styles.paymentInfo}>{t(quittung.rechnung_id ? "doc.receipt.invoicePayment" : "doc.receipt.directPayment")}</Text>
              {paidAmount > 0 ? <>
                {paymentRow(t(quittung.rechnung_id ? "doc.receipt.invoicePaidAmount" : "doc.receipt.paidAmount"), formatCurrency(paidAmount, locale))}
                {quittung.payment_date && paymentRow(t("doc.receipt.paymentDate"), formatReceiptDate(quittung.payment_date, locale))}
                {paymentMethod && paymentRow(t("doc.receipt.paymentMethod"), t(paymentMethod))}
                {quittung.payment_reference && <Text style={styles.paymentInfo}>{t("doc.receipt.paymentReference")} {quittung.payment_reference}</Text>}
              </> : <Text style={styles.paymentInfo}>{t("doc.receipt.noPayment")}</Text>}
              {outstanding !== null && paymentRow(t(quittung.rechnung_id ? "doc.receipt.invoiceBalance" : "doc.receipt.balance"), formatCurrency(outstanding, locale))}
            </>}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t("doc.receipt.subtotal")}</Text>
              {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>{formatCurrency(quittung.zwischensumme, locale)}</Text>}
            </View>
            {(quittung.rabatt > 0 || worksheet) && <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t("doc.receipt.discount")}</Text>
              {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>-{formatCurrency(quittung.rabatt, locale)}</Text>}
            </View>}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t("doc.receipt.vat", { rate: formatPercent(quittung.mwst_satz, locale) })}</Text>
              {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>{formatCurrency(quittung.mwst_betrag, locale)}</Text>}
            </View>
            <View style={[styles.totalsRow, styles.finalTotal]}>
              <Text style={styles.finalLabel}>{t("doc.receipt.total")}</Text>
              {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.finalAmount}>{formatCurrency(quittung.gesamttotal, locale)}</Text>}
            </View>
          </View>
        </View>

        {!worksheet && (company.iban || company.bank_name) && <View style={styles.bankDetails} wrap={false}>
          <Text style={styles.bankText}>{[company.bank_name, company.iban ? t("doc.receipt.iban") + company.iban : null].filter(Boolean).join("  ·  ")}</Text>
        </View>}
        <View wrap={false}>
          {signatures.length > 0 && <View style={styles.signatures}>
            {signatures.map((signature, index) => <View key={index} style={styles.signature}>
              {!worksheet && signature.image ? <Image src={signature.image} style={styles.signatureImage} /> : <View style={styles.signatureBlank} />}
              <Text style={styles.signatureLabel}>{signature.label}</Text>
              {!worksheet && signature.at && <Text style={styles.signatureDate}>{formatReceiptTimestamp(signature.at, locale)}</Text>}
            </View>)}
          </View>}
          {!worksheet && <View style={styles.closing}>
            <Text>{t("doc.receipt.thanks")}</Text>
            {company.bewertungs_url && <Text style={styles.review}>{t("doc.receipt.review", { url: company.bewertungs_url })}</Text>}
          </View>}
        </View>
      </Page>
    </Document>
  );
};
