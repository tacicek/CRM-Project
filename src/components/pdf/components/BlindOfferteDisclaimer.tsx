import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES, SPACING } from "../styles/constants";
import { BLIND_DISCLAIMER_LABEL, BLIND_DISCLAIMER_TEXT } from "@/lib/offerPricing";

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

export const BlindOfferteDisclaimer = () => (
  <View style={styles.wrapper} wrap={false}>
    <Text style={styles.label}>{BLIND_DISCLAIMER_LABEL}</Text>
    <Text style={styles.text}>{BLIND_DISCLAIMER_TEXT}</Text>
  </View>
);
