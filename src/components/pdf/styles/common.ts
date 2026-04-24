import { StyleSheet } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "./constants";

export const commonStyles = StyleSheet.create({
  page: {
    padding: SPACING["2xl"],
    fontSize: FONT_SIZES.base,
    color: COLORS.text.primary,
    fontFamily: "Helvetica",
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  mutedText: {
    color: COLORS.text.secondary,
  },
  smallText: {
    fontSize: FONT_SIZES.sm,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    marginVertical: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  column: {
    flexDirection: "column",
  },
  rightAlign: {
    textAlign: "right",
  },
  centerAlign: {
    textAlign: "center",
  },
});
