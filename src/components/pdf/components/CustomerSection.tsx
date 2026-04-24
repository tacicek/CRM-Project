import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
    marginBottom: SPACING.sm,
  },
  greeting: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 3,
  },
  intro: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 1.4,
  },
});

interface CustomerSectionProps {
  data: OfferData;
}

export const CustomerSection = ({ data }: CustomerSectionProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{`Guten Tag ${data.customer.name},`}</Text>
      <Text style={styles.intro}>
        Vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen heute die folgende Offerte unterbreiten zu dürfen.
      </Text>
    </View>
  );
};
