import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES, SPACING } from "../styles/constants";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";

const styles = StyleSheet.create({
  wrapper: {
    marginTop: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "#D97706",
    borderRadius: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: "#B45309",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  text: {
    fontSize: FONT_SIZES.sm,
    color: "#92400E",
    lineHeight: 1.5,
  },
});

interface BlindOfferteDisclaimerProps {
  locale: Locale;
}

// Same wording as the dashboard constants (BLIND_DISCLAIMER_* in offerPricing) — both
// resolve doc.offer.blind.label / doc.offer.blind.text, here in the customer's language.
export const BlindOfferteDisclaimer = ({ locale }: BlindOfferteDisclaimerProps) => {
  const { t } = documentI18nFor(locale);
  return (
    <View style={styles.wrapper} wrap={false}>
      <Text style={styles.label}>{t("doc.offer.blind.label")}</Text>
      <Text style={styles.text}>{t("doc.offer.blind.text")}</Text>
    </View>
  );
};
