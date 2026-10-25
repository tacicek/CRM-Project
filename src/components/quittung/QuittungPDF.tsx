import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Quittung } from "@/types/quittung.types";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";
import { formatAmount, formatCurrency, formatPercent } from "@/i18n/format";
import { buildReceiptPdfRows, formatReceiptDate, formatReceiptTimestamp } from "@/lib/quittungPresentation";
import { RECEIPT_PDF_FONT } from "@/components/quittung/quittungPdfFont";

export interface QuittungPdfCompany {
  company_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  email: string;
  phone?: string | null;
  street?: string | null;
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
const GRAY = { light: "#F8FAFC", border: "#E2E8F0", muted: "#64748B", ink: "#0F172A" };
const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  bank: "doc.receipt.payment.bank", qr: "doc.receipt.payment.qr",
  cash: "doc.receipt.payment.cash", card: "doc.receipt.payment.card",
  twint: "doc.receipt.payment.twint", other: "doc.receipt.payment.other",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 82, paddingHorizontal: 28, paddingBottom: 44,
    fontSize: 8, fontFamily: RECEIPT_PDF_FONT, color: GRAY.ink,
  },
  runningHeader: {
    position: "absolute", top: 22, left: 28, right: 28,
    flexDirection: "row", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: GRAY.border, paddingBottom: 7,
  },
  runningTitle: { fontSize: 9, fontWeight: 700 },
  runningMode: { fontSize: 7, color: GRAY.muted, maxWidth: 300, textAlign: "right" },
  continuationHeader: { position: "absolute", top: 52, left: 28, right: 28 },
  pageFooter: {
    position: "absolute", bottom: 20, left: 28, right: 28,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: GRAY.border, paddingTop: 6,
    fontSize: 7, color: GRAY.muted,
  },
  header: { flexDirection: "row", gap: 16, marginBottom: 12 },
  logoBox: { width: 130, justifyContent: "flex-start" },
  logo: { width: 130, height: 58, objectFit: "contain" },
  headerRight: { flex: 1, alignItems: "flex-end" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  companyName: { fontSize: 9, fontWeight: 700, textAlign: "right", marginBottom: 3 },
  companyText: { fontSize: 7.5, color: GRAY.muted, textAlign: "right", lineHeight: 1.4 },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 12 },
  infoBox: { flex: 1, padding: 8, borderRadius: 5, backgroundColor: GRAY.light, borderWidth: 0.5, borderColor: GRAY.border },
  label: { fontSize: 7, fontWeight: 700, color: GRAY.muted, marginBottom: 4 },
  infoText: { fontSize: 8, lineHeight: 1.45 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderRadius: 3 },
  tableHeaderText: { fontSize: 7, fontWeight: 700, color: "#FFFFFF" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  rowAlt: { backgroundColor: GRAY.light },
  rowDisabled: { color: GRAY.muted },
  description: { width: "48%", paddingRight: 8, fontSize: 8, lineHeight: 1.4 },
  rate: { width: "34%", paddingRight: 8, fontSize: 8, lineHeight: 1.4, color: GRAY.muted },
  amount: { width: "18%", textAlign: "right", fontSize: 8, lineHeight: 1.4 },
  continuationLabel: { fontSize: 7, color: GRAY.muted, marginBottom: 3 },
  worksheetHeading: { marginTop: 10, padding: 6, backgroundColor: "#FFF7ED", fontSize: 7, fontWeight: 700 },
  blankRow: { height: 26, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  totals: { alignSelf: "flex-end", width: 240, marginTop: 12, marginBottom: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 8 },
  totalsLabel: { color: GRAY.muted, flex: 1 },
  totalsValue: { textAlign: "right" },
  finalTotal: { backgroundColor: GRAY.light, borderTopWidth: 1, borderTopColor: GRAY.border, padding: 7, marginTop: 3 },
  finalText: { fontSize: 10, fontWeight: 700 },
  blankValue: { width: 100, borderBottomWidth: 0.5, borderBottomColor: GRAY.border },
  payment: { marginTop: 7, padding: 9, borderWidth: 0.5, borderColor: GRAY.border, borderRadius: 5 },
  paymentStatus: { fontWeight: 700, fontSize: 9, marginBottom: 4 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 3 },
  paymentInfo: { fontSize: 7.5, color: GRAY.muted, lineHeight: 1.5, marginTop: 4 },
  worksheetPayment: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 5 },
  paymentOption: { flexDirection: "row", gap: 4, alignItems: "center" },
  checkbox: { width: 9, height: 9, borderWidth: 0.5, borderColor: GRAY.muted },
  signatures: { flexDirection: "row", gap: 10, marginTop: 12 },
  signature: { flex: 1, padding: 7, borderWidth: 0.5, borderColor: GRAY.border, borderRadius: 5 },
  signatureImage: { width: "100%", height: 40, objectFit: "contain" },
  signatureBlank: { height: 40, backgroundColor: GRAY.light },
  signatureDate: { fontSize: 6.5, color: GRAY.muted, marginTop: 4 },
  closing: { marginTop: 10, paddingTop: 6, fontSize: 7, color: GRAY.muted, textAlign: "center", lineHeight: 1.5 },
});

export const QuittungPDF = ({ quittung, company, locale, mode = "receipt" }: QuittungPDFProps) => {
  const { t } = documentI18nFor(locale);
  const brand = company.primary_color || BRAND;
  const worksheet = mode === "worksheet";
  const rows = buildReceiptPdfRows(quittung.positionen, worksheet, locale);
  const number = quittung.quittung_nr || t("doc.receipt.draft");
  const paidAmount = quittung.paid_amount ?? 0;
  // Invoice balances include credits and may belong to a different invoice total.
  // Only the server's payment snapshot can supply that balance.
  const outstanding = quittung.payment_open_amount ?? (quittung.rechnung_id ? null
    : Math.max(0, Math.round((quittung.gesamttotal - paidAmount) * 100) / 100));
  const paymentStatus = quittung.payment_status;
  const paymentMethod = quittung.payment_method ? PAYMENT_METHOD_KEYS[quittung.payment_method] : undefined;
  const statusKey: MessageKey = paymentStatus === "paid"
    ? "doc.receipt.payment.paid"
    : paymentStatus === "partial" ? "doc.receipt.payment.partial" : "doc.receipt.payment.open";

  const tableHeader = (
    <View style={[styles.tableHeader, { backgroundColor: brand }]} wrap={false}>
      <Text style={[styles.description, styles.tableHeaderText]}>{t("doc.receipt.col.description")}</Text>
      <Text style={[styles.rate, styles.tableHeaderText]}>{t("doc.receipt.col.rate")}</Text>
      <Text style={[styles.amount, styles.tableHeaderText]}>{t("doc.receipt.col.amount")}</Text>
    </View>
  );

  return (
    <Document title={t("doc.receipt.numbered", { number })} language={locale}>
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.runningHeader}>
          <Text style={[styles.runningTitle, { color: brand }]}>{t("doc.receipt.numbered", { number })}</Text>
          <Text style={styles.runningMode}>
            {worksheet ? t("doc.receipt.worksheet") : quittung.status === "draft" ? t("doc.receipt.draft") : ""}
          </Text>
        </View>
        <View fixed style={styles.continuationHeader} render={({ pageNumber }) => pageNumber > 1 ? tableHeader : null} />
        <View fixed style={styles.pageFooter}>
          <Text>{number}</Text>
          <Text render={({ pageNumber, totalPages }) => t("doc.receipt.page", { page: pageNumber, pages: totalPages })} />
        </View>

        <View style={styles.header} wrap={false}>
          <View style={styles.logoBox}>
            {company.logo_url && <Image src={company.logo_url} style={styles.logo} />}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.title, { color: brand }]}>{t("doc.receipt.title")}</Text>
            <Text style={styles.companyName}>{company.company_name}</Text>
            <Text style={styles.companyText}>
              {[company.street, `${company.plz ?? ""} ${company.city ?? ""}`.trim(), company.phone, company.email].filter(Boolean).join("\n")}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.infoBox}>
            <Text style={styles.label}>{t("doc.receipt.customer")}</Text>
            <Text style={styles.infoText}>
              {[quittung.customer_name, quittung.customer_address,
                quittung.customer_destination ? `→ ${quittung.customer_destination}` : null,
                quittung.customer_phone, quittung.customer_email].filter(Boolean).join("\n")}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.label}>{t("doc.receipt.details")}</Text>
            <Text style={styles.infoText}>
              {[
                t("doc.receipt.date") + formatReceiptDate(quittung.datum, locale),
                t("doc.receipt.number") + number,
                quittung.issued_at ? t("doc.receipt.issuedAt") + formatReceiptTimestamp(quittung.issued_at, locale) : null,
                company.mwst_number ? t("doc.receipt.vatNumber") + company.mwst_number : null,
                company.iban ? t("doc.receipt.iban") + company.iban : null,
                company.bank_name,
              ].filter(Boolean).join("\n")}
            </Text>
          </View>
        </View>

        {tableHeader}
        {rows.map((row, index) => (
          <View key={row.key} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}, !row.checked ? styles.rowDisabled : {}]} wrap={false}>
            <View style={styles.description}>
              {row.continuation && <Text style={styles.continuationLabel}>{t("doc.receipt.continuation", { number: row.number })}</Text>}
              <Text>{row.description}</Text>
            </View>
            <Text style={styles.rate}>{row.rate}</Text>
            <Text style={styles.amount}>{row.amount === null ? "–" : formatAmount(row.amount, locale)}</Text>
          </View>
        ))}

        {worksheet && (
          <View wrap={false}>
            <Text style={styles.worksheetHeading}>{t("doc.receipt.onSiteExtras")}</Text>
            {[0, 1, 2].map(index => <View key={index} style={styles.blankRow} />)}
          </View>
        )}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("doc.receipt.subtotal")}</Text>
            {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>{formatCurrency(quittung.zwischensumme, locale)}</Text>}
          </View>
          {(quittung.rabatt > 0 || worksheet) && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t("doc.receipt.discount")}</Text>
              {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>-{formatCurrency(quittung.rabatt, locale)}</Text>}
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("doc.receipt.vat", { rate: formatPercent(quittung.mwst_satz, locale) })}</Text>
            {worksheet ? <View style={styles.blankValue} /> : <Text style={styles.totalsValue}>{formatCurrency(quittung.mwst_betrag, locale)}</Text>}
          </View>
          <View style={[styles.totalsRow, styles.finalTotal]}>
            <Text style={[styles.finalText, { color: brand }]}>{t("doc.receipt.total")}</Text>
            {worksheet ? <View style={styles.blankValue} /> : <Text style={[styles.finalText, { color: brand }]}>{formatCurrency(quittung.gesamttotal, locale)}</Text>}
          </View>
        </View>

        <View style={styles.payment} wrap={false}>
          <Text style={styles.label}>{t(worksheet ? "doc.receipt.paymentMethod" : "doc.receipt.paymentStatus")}</Text>
          {worksheet ? (
            <View style={styles.worksheetPayment}>
              {(["doc.receipt.payment.cash", "doc.receipt.payment.card", "doc.receipt.payment.twint", "doc.receipt.payment.bank"] as const).map(key => (
                <View key={key} style={styles.paymentOption}><View style={styles.checkbox} /><Text>{t(key)}</Text></View>
              ))}
            </View>
          ) : (
            <>
              <Text style={styles.paymentStatus}>{t(statusKey)}</Text>
              <Text style={styles.paymentInfo}>{t(quittung.rechnung_id ? "doc.receipt.invoicePayment" : "doc.receipt.directPayment")}</Text>
              {paidAmount > 0 ? (
                <>
                  <View style={styles.paymentRow}><Text>{t(quittung.rechnung_id ? "doc.receipt.invoicePaidAmount" : "doc.receipt.paidAmount")}</Text><Text>{formatCurrency(paidAmount, locale)}</Text></View>
                  {quittung.payment_date && <View style={styles.paymentRow}><Text>{t("doc.receipt.paymentDate")}</Text><Text>{formatReceiptDate(quittung.payment_date, locale)}</Text></View>}
                  {paymentMethod && <View style={styles.paymentRow}><Text>{t("doc.receipt.paymentMethod")}</Text><Text>{t(paymentMethod)}</Text></View>}
                  {quittung.payment_reference && <Text style={styles.paymentInfo}>{t("doc.receipt.paymentReference")} {quittung.payment_reference}</Text>}
                </>
              ) : <Text style={styles.paymentInfo}>{t("doc.receipt.noPayment")}</Text>}
              {outstanding !== null && <View style={styles.paymentRow}><Text>{t(quittung.rechnung_id ? "doc.receipt.invoiceBalance" : "doc.receipt.balance")}</Text><Text>{formatCurrency(outstanding, locale)}</Text></View>}
            </>
          )}
        </View>

        <View wrap={false}>
          <View style={styles.signatures}>
            {[
              { label: t("doc.receipt.signature.customer"), image: quittung.kunde_unterschrift, at: quittung.kunde_signed_at },
              { label: t("doc.receipt.signature.teamLead"), image: quittung.teamchef_unterschrift, at: quittung.teamchef_signed_at },
            ].map((signature, index) => (
              <View key={index} style={styles.signature}>
                <Text style={styles.label}>{signature.label}</Text>
                {!worksheet && signature.image ? <Image src={signature.image} style={styles.signatureImage} /> : <View style={styles.signatureBlank} />}
                {!worksheet && signature.at && <Text style={styles.signatureDate}>{formatReceiptTimestamp(signature.at, locale)}</Text>}
              </View>
            ))}
          </View>
          <View style={styles.closing}>
            <Text>{t("doc.receipt.thanks")}</Text>
            {company.bewertungs_url && <Text>{t("doc.receipt.review", { url: company.bewertungs_url })}</Text>}
          </View>
        </View>
      </Page>
    </Document>
  );
};
