import {
  Document, Page, View, Text, Image, StyleSheet,
} from "@react-pdf/renderer";
import { Quittung } from "@/types/quittung.types";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import { formatAmount, formatCurrency, formatDate, formatDateTime } from "@/i18n/format";

interface CompanyInfo {
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

interface QuittungPDFProps {
  quittung: Quittung;
  company: CompanyInfo;
  /**
   * The CUSTOMER's language — resolve it from the receipt row with
   * `resolveDocumentLocale(quittung, company)`. Never from the dashboard context:
   * a German operator must still be able to hand a French customer a French receipt.
   */
  locale: Locale;
}

const BRAND = "#10B981"; // fallback emerald
const GRAY = { 50: "#F9FAFB", 100: "#F3F4F6", 200: "#E5E7EB", 500: "#6B7280", 900: "#111827" };

// Number of blank handwriting rows shown on draft/signed PDFs
const HANDWRITE_ROWS = 3;

const styles = StyleSheet.create({
  page: {
    paddingTop: 22, paddingHorizontal: 24, paddingBottom: 28,
    fontSize: 9, fontFamily: "Helvetica", color: GRAY[900],
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 18,
  },
  headerLeft: { flexDirection: "column", alignItems: "flex-start" },
  logo: { width: 130, height: 65, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  title: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  companyName: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right", marginBottom: 2 },
  firma: { fontSize: 8, color: GRAY[500], textAlign: "right", lineHeight: 1.5, marginBottom: 4 },
  quittungNr: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right" },
  accentLine: { height: 2, borderRadius: 1, marginBottom: 14 },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 14 },
  infoBox: { flex: 1, padding: 8, borderRadius: 6, backgroundColor: GRAY[50], borderWidth: 1, borderColor: GRAY[200] },
  infoLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: GRAY[500], marginBottom: 3 },
  infoText: { fontSize: 8.5, lineHeight: 1.5 },
  tableHeader: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderRadius: 4, marginBottom: 1 },
  tableHeaderText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#fff" },
  tableRow: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: GRAY[100],
  },
  tableRowAlt: { backgroundColor: GRAY[50] },
  tableRowDisabled: { opacity: 0.45 },
  tableRowBlank: {
    flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: GRAY[200],
  },
  colBeschreibung: { flex: 3 },
  colSatz: { flex: 3 },
  colBetrag: { flex: 1.2, textAlign: "right" },
  customSeparator: {
    marginTop: 4, marginBottom: 2, paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: GRAY[100],
  },
  customLabel: { fontSize: 7, color: GRAY[500], fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  handwriteSeparator: {
    marginTop: 6, marginBottom: 2, paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: "#FFF7ED", borderTopWidth: 1, borderTopColor: "#FED7AA",
  },
  handwriteLabel: { fontSize: 7, color: "#92400E", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  totalsBlock: { alignSelf: "flex-end", width: 210, marginTop: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalsLabel: { fontSize: 8.5, color: GRAY[500] },
  totalsValue: { fontSize: 8.5 },
  totalFinalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 6,
    borderRadius: 4, marginTop: 3,
  },
  totalFinalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalFinalValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalDraftRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 6,
    borderRadius: 4, marginTop: 3,
    borderWidth: 0.5, borderColor: GRAY[200], borderStyle: "dashed",
  },
  totalDraftLabel: { fontSize: 9, color: GRAY[500] },
  paymentBlock: {
    marginTop: 10, padding: 8,
    borderWidth: 0.5, borderColor: GRAY[200], borderRadius: 6,
    backgroundColor: GRAY[50],
  },
  paymentLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: GRAY[500], marginBottom: 5 },
  paymentRow: { flexDirection: "row", gap: 14 },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 4 },
  paymentCheckbox: { width: 10, height: 10, borderWidth: 0.75, borderColor: GRAY[500], borderRadius: 2 },
  paymentText: { fontSize: 8.5, color: GRAY[900] },
  signaturesBlock: { flexDirection: "row", gap: 10, marginTop: 12 },
  sigBlock: { flex: 1, borderWidth: 1, borderColor: GRAY[200], borderRadius: 6, padding: 7 },
  sigLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: GRAY[500], marginBottom: 3 },
  sigImage: { width: "100%", height: 44, objectFit: "contain" },
  sigPlaceholder: { height: 44, backgroundColor: GRAY[50], borderRadius: 4 },
  sigDate: { fontSize: 7, color: GRAY[500], marginTop: 3 },
  footer: {
    marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: GRAY[200], alignItems: "center",
  },
  footerText: { fontSize: 8, color: GRAY[500], textAlign: "center", lineHeight: 1.6 },
  betragOffenBadge: {
    marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A",
    alignSelf: "flex-start",
  },
  betragOffenText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#92400E" },
});

export function QuittungPDF({ quittung, company, locale }: QuittungPDFProps) {
  const { t } = documentI18nFor(locale);
  const brand = company.primary_color || BRAND;
  const predefined = quittung.positionen.filter(p => !p.is_custom);
  const custom = quittung.positionen.filter(p => p.is_custom && (p.beschreibung || p.betrag));
  const isDraft = quittung.status === "draft";
  const isPaid = quittung.status === "paid";
  // Show blank handwriting rows on draft and signed (on-site use)
  const showHandwriteRows = isDraft || quittung.status === "signed";

  return (
    <Document title={t("doc.receipt.numbered", { number: quittung.quittung_nr })}>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          {/* Left: logo only */}
          <View style={styles.headerLeft}>
            {company.logo_url && (
              <Image src={company.logo_url} style={styles.logo} cache={false} />
            )}
          </View>
          {/* Right: title → company name → address → QU number */}
          <View style={styles.headerRight}>
            <Text style={[styles.title, { color: brand }]}>{t("doc.receipt.title")}</Text>
            <Text style={[styles.companyName, { color: brand }]}>
              {company.company_name}
            </Text>
            <Text style={styles.firma}>
              {[company.street, `${company.plz ?? ""} ${company.city ?? ""}`.trim()].filter(Boolean).join("\n")}
              {company.phone ? "\n" + company.phone : ""}
              {"\n"}{company.email}
            </Text>
            {quittung.quittung_nr ? (
              <Text style={[styles.quittungNr, { color: brand }]}>
                {quittung.quittung_nr}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Accent line */}
        <View style={[styles.accentLine, { backgroundColor: brand }]} />

        {/* Customer + Details two-column */}
        <View style={styles.twoCol}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{t("doc.receipt.customer")}</Text>
            <Text style={styles.infoText}>
              {quittung.customer_name}
              {quittung.customer_address ? "\n" + quittung.customer_address : ""}
              {quittung.customer_destination ? "\n→ " + quittung.customer_destination : ""}
              {quittung.customer_phone ? "\n" + quittung.customer_phone : ""}
              {quittung.customer_email ? "\n" + quittung.customer_email : ""}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{t("doc.receipt.details")}</Text>
            <Text style={styles.infoText}>
              {t("doc.receipt.date") + formatDate(quittung.datum, locale)}
              {"\n" + t("doc.receipt.number") + quittung.quittung_nr}
              {company.mwst_number ? "\n" + t("doc.receipt.vatNumber") + company.mwst_number : ""}
              {company.iban ? "\n" + t("doc.receipt.iban") + company.iban : ""}
              {company.bank_name ? "\n" + company.bank_name : ""}
            </Text>
          </View>
        </View>

        {/* Table */}
        <View>
          {/* Table header */}
          <View style={[styles.tableHeader, { backgroundColor: brand }]}>
            <Text style={[styles.tableHeaderText, styles.colBeschreibung]}>{t("doc.receipt.col.description")}</Text>
            <Text style={[styles.tableHeaderText, styles.colSatz]}>{t("doc.receipt.col.rate")}</Text>
            <Text style={[styles.tableHeaderText, styles.colBetrag]}>{t("doc.receipt.col.amount")}</Text>
          </View>

          {/* Predefined */}
          {predefined.map((pos, i) => (
            <View key={pos.id} style={[
              styles.tableRow,
              i % 2 === 1 ? styles.tableRowAlt : {},
              !pos.checked ? styles.tableRowDisabled : {},
            ]}>
              <Text style={[{ fontSize: 8.5 }, styles.colBeschreibung]}>{pos.beschreibung}</Text>
              <Text style={[{ fontSize: 8.5, color: GRAY[500] }, styles.colSatz]}>{pos.satz || ""}</Text>
              <Text style={[{ fontSize: 8.5 }, styles.colBetrag]}>
                {pos.checked && pos.betrag ? formatAmount(pos.betrag, locale) : "–"}
              </Text>
            </View>
          ))}

          {/* Custom rows */}
          {custom.length > 0 && (
            <>
              <View style={styles.customSeparator}>
                <Text style={styles.customLabel}>{t("doc.receipt.extras")}</Text>
              </View>
              {custom.map((pos, i) => (
                <View key={pos.id} style={[
                  styles.tableRow,
                  i % 2 === 1 ? styles.tableRowAlt : {},
                  !pos.checked ? styles.tableRowDisabled : {},
                ]}>
                  <Text style={[{ fontSize: 8.5 }, styles.colBeschreibung]}>{pos.beschreibung}</Text>
                  <Text style={[{ fontSize: 8.5, color: GRAY[500] }, styles.colSatz]}>{pos.satz || ""}</Text>
                  <Text style={[{ fontSize: 8.5 }, styles.colBetrag]}>
                    {pos.checked && pos.betrag ? formatAmount(pos.betrag, locale) : "–"}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* Blank handwriting rows — for on-site manual additions */}
          {showHandwriteRows && (
            <>
              <View style={styles.handwriteSeparator}>
                <Text style={styles.handwriteLabel}>{t("doc.receipt.onSiteExtras")}</Text>
              </View>
              {Array.from({ length: HANDWRITE_ROWS }).map((_, i) => (
                <View key={`blank-${i}`} style={styles.tableRowBlank}>
                  <Text style={[{ fontSize: 8.5 }, styles.colBeschreibung]}> </Text>
                  <Text style={[{ fontSize: 8.5 }, styles.colSatz]}> </Text>
                  <Text style={[{ fontSize: 8.5 }, styles.colBetrag]}> </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Totals block */}
        <View style={styles.totalsBlock} wrap={false}>
          {isPaid ? (
            // Paid: show all computed values
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{t("doc.receipt.subtotal")}</Text>
                <Text style={styles.totalsValue}>{formatCurrency(quittung.zwischensumme, locale)}</Text>
              </View>
              {quittung.rabatt > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>{t("doc.receipt.discount")}</Text>
                  <Text style={styles.totalsValue}>-{formatCurrency(quittung.rabatt, locale)}</Text>
                </View>
              )}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{t("doc.receipt.vat", { rate: quittung.mwst_satz })}</Text>
                <Text style={styles.totalsValue}>{formatCurrency(quittung.mwst_betrag, locale)}</Text>
              </View>
              <View style={[styles.totalFinalRow, { backgroundColor: brand + "22" }]}>
                <Text style={[styles.totalFinalLabel, { color: brand }]}>{t("doc.receipt.total")}</Text>
                <Text style={[styles.totalFinalValue, { color: brand }]}>{formatCurrency(quittung.gesamttotal, locale)}</Text>
              </View>
            </>
          ) : (
            // Draft / Signed / Sent: all fields blank so worker can fill by hand
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{t("doc.receipt.subtotal")}</Text>
                <Text style={[styles.totalsLabel, { flex: 1, borderBottomWidth: 0.5, borderBottomColor: GRAY[300], marginLeft: 8 }]}> </Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{t("doc.receipt.vat", { rate: quittung.mwst_satz })}</Text>
                <Text style={[styles.totalsLabel, { flex: 1, borderBottomWidth: 0.5, borderBottomColor: GRAY[300], marginLeft: 8 }]}> </Text>
              </View>
              <View style={styles.totalDraftRow}>
                <Text style={styles.totalDraftLabel}>{t("doc.receipt.total")}</Text>
                <Text style={[styles.totalDraftLabel, { flex: 1, borderBottomWidth: 0.5, borderBottomColor: GRAY[300], marginLeft: 8 }]}> </Text>
              </View>
            </>
          )}

          {quittung.betrag_noch_offen && (
            <View style={styles.betragOffenBadge}>
              <Text style={styles.betragOffenText}>{t("doc.receipt.outstanding")}</Text>
            </View>
          )}
        </View>

        {/* Payment method checkboxes */}
        <View style={styles.paymentBlock} wrap={false}>
          <Text style={styles.paymentLabel}>{t("doc.receipt.paymentMethod")}</Text>
          <View style={styles.paymentRow}>
            {([
              "doc.receipt.payment.open",
              "doc.receipt.payment.cash",
              "doc.receipt.payment.card",
              "doc.receipt.payment.twint",
            ] as const).map((key) => (
              <View key={key} style={styles.paymentOption}>
                <View style={styles.paymentCheckbox} />
                <Text style={styles.paymentText}>{t(key)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Signatures + Footer — wrapped together so they never split across pages */}
        <View wrap={false}>
          <View style={styles.signaturesBlock}>
            {([
              { label: t("doc.receipt.signature.customer"), sig: quittung.kunde_unterschrift, at: quittung.kunde_signed_at },
              { label: t("doc.receipt.signature.teamLead"), sig: quittung.teamchef_unterschrift, at: quittung.teamchef_signed_at },
            ] as const).map((s, i) => (
              <View key={i} style={styles.sigBlock}>
                <Text style={styles.sigLabel}>{s.label}</Text>
                {s.sig ? (
                  <Image src={s.sig} style={styles.sigImage} cache={false} />
                ) : (
                  <View style={styles.sigPlaceholder} />
                )}
                {s.at && (
                  <Text style={styles.sigDate}>{formatDateTime(s.at, locale)}</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { fontFamily: "Helvetica-Bold", color: GRAY[900] }]}>
              {t("doc.receipt.thanks")}
            </Text>
            {company.bewertungs_url && (
              <Text style={styles.footerText}>
                {t("doc.receipt.review", { url: company.bewertungs_url })}
              </Text>
            )}
            <Text style={[styles.footerText, { marginTop: 3 }]}>
              {[
                company.iban ? t("doc.receipt.iban") + company.iban : "",
                company.bank_name || "",
                company.mwst_number ? t("doc.receipt.vatNumber") + company.mwst_number : "",
              ].filter(Boolean).join("   |   ")}
            </Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
