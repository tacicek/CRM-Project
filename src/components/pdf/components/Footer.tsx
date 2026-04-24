import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";

/** Space reserved above bottom edge; keep in sync with Page paddingBottom */
const FOOTER_BOTTOM_PT = 28;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: FOOTER_BOTTOM_PT,
    left: 24,
    right: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[300],
  },
  line: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: "center",
    marginBottom: 2,
    lineHeight: 1.35,
  },
  pageNumber: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: "right",
    marginTop: 4,
  },
});

interface FooterProps {
  data: OfferData;
}

export const Footer = ({ data }: FooterProps) => {
  const { company } = data;
  const line1 = `${company.name} | ${company.email}${company.phone ? ` | ${company.phone}` : ""}`;
  const line2 = `${company.address ? `${company.address}, ` : ""}${company.zip} ${company.city}`;
  const line3 = company.mwstNr ? `MwSt-Nr: ${company.mwstNr}` : "";

  return (
    <View style={styles.container} fixed>
      <Text style={styles.line}>{line1}</Text>
      <Text style={styles.line}>{line2}</Text>
      {line3 ? <Text style={styles.line}>{line3}</Text> : null}
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
      />
    </View>
  );
};

export const PDF_FOOTER_RESERVE_PT = FOOTER_BOTTOM_PT + 52;
