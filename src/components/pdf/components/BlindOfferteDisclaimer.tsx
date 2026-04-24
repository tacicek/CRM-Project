import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES, SPACING } from "../styles/constants";

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
    <Text style={styles.label}>Wichtiger Hinweis</Text>
    <Text style={styles.text}>
      Diese Offerte wurde ohne persönliche Besichtigung erstellt und basiert ausschliesslich auf den
      Angaben des Kunden. Die aufgeführten Preise sind Schätzungen. Allfällige Anpassungen werden vor
      Auftragserteilung in Absprache mit dem Kunden vorgenommen.
    </Text>
  </View>
);
