import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";

const AMBER = {
  50:  "#FFFBEB",
  200: "#FDE68A",
  700: "#B45309",
  800: "#92400E",
} as const;

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.base,
  },
  estimateBox: {
    borderWidth: 1,
    borderColor: AMBER[200],
    borderRadius: 4,
    backgroundColor: AMBER[50],
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.base,
    fontFamily: "Helvetica-Bold",
    color: AMBER[800],
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    color: AMBER[700],
    width: 160,
  },
  value: {
    fontSize: FONT_SIZES.sm,
    fontFamily: "Helvetica-Bold",
    color: AMBER[800],
    flex: 1,
  },
  rangeRow: {
    flexDirection: "row",
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 0.5,
    borderTopColor: AMBER[200],
  },
  rangeLabel: {
    fontSize: FONT_SIZES.base,
    color: AMBER[700],
    width: 160,
  },
  rangeValue: {
    fontSize: FONT_SIZES.base,
    fontFamily: "Helvetica-Bold",
    color: AMBER[800],
    flex: 1,
  },
  disclaimerBox: {
    borderWidth: 0.5,
    borderColor: COLORS.gray[300],
    borderRadius: 4,
    backgroundColor: COLORS.gray[50],
    padding: SPACING.sm,
  },
  disclaimerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 1.4,
  },
});


interface Props {
  data: OfferData;
}

export const TimeEstimateBlock = ({ data }: Props) => {
  // Show the blind offerte disclaimer if this is a blind offer with any item having a time estimate
  const hasItemTimeEstimate = data.items.some(item => item.timeEstimate && item.timeEstimate.minHours > 0);
  if (data.offerteType !== "blind" || !hasItemTimeEstimate) return null;

  return (
    <View style={styles.container} wrap={false}>
      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung.
          {" "}Preise sind Schätzungen und können nach Besichtigung angepasst werden.
          {" "}Die Zeitschätzungen pro Position sind als Rahmen zu verstehen.
        </Text>
      </View>
    </View>
  );
};
