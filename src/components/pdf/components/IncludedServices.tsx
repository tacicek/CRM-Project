import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
    backgroundColor: COLORS.gray[50],
    borderRadius: 4,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  block: {
    marginBottom: SPACING.base,
  },
  blockLast: {
    marginBottom: 0,
  },
  title: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    marginBottom: SPACING.xs,
    color: COLORS.text.primary,
  },
  text: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    marginBottom: 3,
    lineHeight: 1.45,
  },
  hint: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 1.35,
  },
});

const DEFAULT_INCLUDED = [
  "Transport- und Betriebshaftpflichtversicherung",
  "Umzugsfachkräfte (inkl. Spesen)",
  "Fahrzeuge und Treibstoff",
  "An- und Abfahrt",
  "Befestigungsgurte, Schutzmaterial, Werkzeuge",
];

const DEFAULT_EXCLUDED = [
  "Sonderentsorgung (z. B. Chemikalien, Asbest, Gefahrgut)",
  "Parkbewilligungen, externe Lift-/Kranmiete",
  "Zusatzaufwand bei abweichendem Leistungsumfang",
];

interface IncludedServicesProps {
  data: OfferData;
}

export const IncludedServices = ({ data }: IncludedServicesProps) => {
  const services = data.includedServices?.length ? data.includedServices : DEFAULT_INCLUDED;

  return (
    <View style={styles.container} wrap={false}>
      <View style={styles.block}>
        <Text style={styles.title}>Im Preis inbegriffen</Text>
        {services.map((service, index) => (
          <Text key={`${service}-${index}`} style={styles.text}>
            • {service}
          </Text>
        ))}
      </View>

      <View style={styles.blockLast}>
        <Text style={styles.title}>Nicht enthalten / Zusatzkosten</Text>
        {DEFAULT_EXCLUDED.map((service, index) => (
          <Text key={`${service}-${index}`} style={styles.text}>
            • {service}
          </Text>
        ))}
        <Text style={styles.hint}>
          Endgültige Zusatzkosten werden nur nach vorgängiger Rücksprache verrechnet.
        </Text>
      </View>
    </View>
  );
};
