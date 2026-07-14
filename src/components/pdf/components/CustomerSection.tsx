import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatDate } from "../utils/formatters";
import { documentI18nFor } from "@/i18n/documentLocale";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginTop: SPACING.lg,
    gap: SPACING["2xl"],
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: COLORS.text.secondary,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: SPACING.xs,
  },
  customerName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 700,
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  infoLine: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  detailsTable: {
    flexDirection: "column",
    gap: 3,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    fontWeight: 700,
    flex: 1.4,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: 3,
  },
});

interface CustomerSectionProps {
  data: OfferData;
}

export const CustomerSection = ({ data }: CustomerSectionProps) => {
  const { customer, offerNumber, createdDate, validUntil, company, locale } = data;
  const { t } = documentI18nFor(locale);

  const details: { label: string; value: string }[] = [
    { label: t("doc.offer.number"), value: offerNumber },
    { label: t("doc.offer.date"), value: formatDate(createdDate, locale) },
    ...(validUntil
      ? [{ label: t("doc.offer.validUntil"), value: formatDate(validUntil, locale) }]
      : []),
    ...(company.mwstNr ? [{ label: t("doc.offer.vatNumber"), value: company.mwstNr }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* LEFT — Auftraggeber */}
      <View style={styles.leftCol}>
        <Text style={styles.sectionLabel}>{t("doc.offer.customer")}</Text>
        <Text style={styles.customerName}>{customer.name}</Text>
        {customer.address ? <Text style={styles.infoLine}>{customer.address}</Text> : null}
        {customer.phone?.trim() ? <Text style={styles.infoLine}>{customer.phone.trim()}</Text> : null}
        {customer.email?.trim() ? <Text style={styles.infoLine}>{customer.email.trim()}</Text> : null}
      </View>

      {/* RIGHT — Offerte-Details */}
      <View style={styles.rightCol}>
        <Text style={styles.sectionLabel}>{t("doc.offer.details")}</Text>
        <View style={styles.detailsTable}>
          {details.map(({ label, value }, i) => (
            <View key={label}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
              {i < details.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
