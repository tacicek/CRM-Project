import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";

const ACCENT = "#F97316"; // orange — overridden by company.primaryColor if set

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#FFFFFF",
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: ACCENT, // overridden inline with the company accent
  },
  leftCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 34,
    height: 34,
    objectFit: "contain",
    objectPositionX: "left",
    marginRight: 9,
    borderRadius: 6,
  },
  companyName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 700,
    color: "#111827",
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
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: 2,
  },
  titleAccent: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 2,
  },
  offerNumber: {
    fontSize: FONT_SIZES.sm,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 4,
  },
  offerNumberValue: {
    fontWeight: 700,
    color: "#111827",
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
      {/* LEFT — logo (if any) next to company name + address */}
      <View style={styles.leftCol}>
        {hasValidLogo ? <Image style={styles.logo} src={company.logo} cache={false} /> : null}
        <View>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.address || company.city ? (
            <Text style={styles.tagline}>
              {[company.address, company.zip && company.city ? `${company.zip} ${company.city}` : company.city]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      {/* RIGHT — title + number */}
      <View style={styles.rightCol}>
        <View style={styles.titleRow}>
          <Text style={styles.titleMain}>{titleBase}</Text>
          <Text style={[styles.titleAccent, { color: accent }]}>{titleEnd}</Text>
        </View>
        <Text style={styles.offerNumber}>
          {"Nr. "}
          <Text style={styles.offerNumberValue}>{offerNumber}</Text>
          {`  ·  ${formatShortDate(createdDate)}`}
        </Text>
      </View>
    </View>
  );
};
