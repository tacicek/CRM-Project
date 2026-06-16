import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";

/** Space reserved above bottom edge; keep in sync with Page paddingBottom */
const FOOTER_BOTTOM_PT = 24;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: FOOTER_BOTTOM_PT,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  line: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginBottom: 2,
    lineHeight: 1.35,
  },
  pageNumber: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    textAlign: "right",
    marginTop: 2,
  },
});

interface FooterProps {
  data: OfferData;
}

export const Footer = ({ data }: FooterProps) => {
  const { company } = data;
  const companyLine = `${company.name}${company.phone ? ` · ${company.phone}` : ""}`;
  const addressLine = [
    company.address,
    [company.zip, company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.container} fixed>
      {/* Left: company name + address */}
      <View style={styles.leftCol}>
        <Text style={styles.line}>{companyLine}</Text>
        {addressLine ? <Text style={styles.line}>{addressLine}</Text> : null}
      </View>

      {/* Right: IBAN + email + page number */}
      <View style={styles.rightCol}>
        {company.iban ? <Text style={styles.line}>{`IBAN ${company.iban}`}</Text> : null}
        <Text style={styles.line}>{company.email}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`}
        />
      </View>
    </View>
  );
};

export const PDF_FOOTER_RESERVE_PT = FOOTER_BOTTOM_PT + 42;
