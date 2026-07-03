import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";

const ACCENT = "#F97316"; // orange — overridden by company.primaryColor if set

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#FFFFFF",
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: -24, // bleed to page edges
    borderBottomWidth: 3,
    borderBottomColor: ACCENT, // overridden inline with the company accent
  },
  leftCol: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  logo: {
    width: 130,
    height: 34,
    objectFit: "contain",
    objectPositionX: "left",
    marginBottom: 4,
  },
  companyName: {
    fontSize: FONT_SIZES["2xl"],
    fontWeight: 700,
    color: "#111827",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FONT_SIZES.xs,
    color: "#6B7280",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  rightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  titleMain: {
    fontSize: 30,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: 3,
  },
  titleAccent: {
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: 3,
  },
  offerNumber: {
    fontSize: FONT_SIZES.sm,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 4,
  },
  dateText: {
    fontSize: FONT_SIZES.xs,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 1,
  },
});

const formatShortDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });
};

interface HeaderProps {
  data: OfferData;
}

export const Header = ({ data }: HeaderProps) => {
  const { company, offerNumber, createdDate } = data;
  const accent = company.primaryColor || ACCENT;

  const hasValidLogo =
    company.logo &&
    (company.logo.startsWith("data:image") ||
      company.logo.startsWith("http://") ||
      company.logo.startsWith("https://"));

  // Split "OFFERTE" so last 2 chars can be coloured with accent
  const titleBase = "OFFER";
  const titleEnd = "TE";

  return (
    <View style={[styles.wrapper, { borderBottomColor: accent }]}>
      {/* LEFT — logo or company name */}
      <View style={styles.leftCol}>
        {hasValidLogo ? (
          <Image style={styles.logo} src={company.logo} cache={false} />
        ) : (
          <Text style={styles.companyName}>{company.name.toUpperCase()}</Text>
        )}
        {company.phone || company.address ? (
          <Text style={styles.tagline}>
            {[company.address, company.zip && company.city ? `${company.zip} ${company.city}` : company.city]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>

      {/* RIGHT — title + number */}
      <View style={styles.rightCol}>
        <View style={styles.titleRow}>
          <Text style={styles.titleMain}>{titleBase}</Text>
          <Text style={[styles.titleAccent, { color: accent }]}>{titleEnd}</Text>
        </View>
        <Text style={styles.offerNumber}>{`Nr. ${offerNumber}  ·  ${formatShortDate(createdDate)}`}</Text>
      </View>
    </View>
  );
};
