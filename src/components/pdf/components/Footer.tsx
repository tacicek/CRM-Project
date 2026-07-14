import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { documentI18nFor } from "@/i18n/documentLocale";

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
  const { company, locale } = data;
  const { t } = documentI18nFor(locale);
  const addressLine = [
    company.address,
    [company.zip, company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  // design v2: kompakte Einzeiler — links Firma · Tel · Adresse, rechts IBAN · E-Mail
  const leftLine = [company.name, company.phone, addressLine].filter(Boolean).join(" · ");
  const rightLine = [
    company.iban ? `${t("doc.footer.iban")}${company.iban}` : null,
    company.email,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.container} fixed>
      {/* Left: company name · phone · address */}
      <View style={styles.leftCol}>
        <Text style={styles.line}>{leftLine}</Text>
      </View>

      {/* Right: IBAN · email + page number */}
      <View style={styles.rightCol}>
        <Text style={styles.line}>{rightLine}</Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            t("doc.footer.page", { page: pageNumber, total: totalPages })
          }
        />
      </View>
    </View>
  );
};

export const PDF_FOOTER_RESERVE_PT = FOOTER_BOTTOM_PT + 42;
