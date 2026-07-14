import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT_SIZES } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatDateLong } from "../utils/formatters";
import { documentI18nFor } from "@/i18n/documentLocale";

const ACCENT = "#F97316"; // orange — overridden by company.primaryColor if set

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: ACCENT, // overridden inline with the company accent
  },
  leftCol: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  logo: {
    width: 240,
    height: 72,
    objectFit: "contain",
    objectPositionX: "left",
    marginBottom: 6,
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

interface HeaderProps {
  data: OfferData;
}

export const Header = ({ data }: HeaderProps) => {
  const { company, offerNumber, createdDate, locale } = data;
  const { t } = documentI18nFor(locale);
  const accent = company.primaryColor || ACCENT;

  const hasValidLogo =
    company.logo &&
    (company.logo.startsWith("data:image") ||
      company.logo.startsWith("http://") ||
      company.logo.startsWith("https://"));

  // The wordmark is painted in two tones, so it is split into two catalog keys — the split
  // point differs per language and cannot be a substring operation on one word.
  const titleBase = t("doc.offer.wordmark.head");
  const titleEnd = t("doc.offer.wordmark.tail");

  return (
    <View style={[styles.wrapper, { borderBottomColor: accent }]}>
      {/* LEFT — grosses Logo; Firmenname klein in der Adresszeile darunter
          (gleiche Schriftgrösse wie Adresse). Kein grosser Firmenname mehr. */}
      <View style={styles.leftCol}>
        {hasValidLogo && (
          <Image style={styles.logo} src={company.logo} cache={false} />
        )}
        <Text style={styles.tagline}>
          {[
            company.name,
            company.address,
            company.zip && company.city ? `${company.zip} ${company.city}` : company.city,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>

      {/* RIGHT — title + number */}
      <View style={styles.rightCol}>
        <View style={styles.titleRow}>
          <Text style={styles.titleMain}>{titleBase}</Text>
          <Text style={[styles.titleAccent, { color: accent }]}>{titleEnd}</Text>
        </View>
        <Text style={styles.offerNumber}>
          {`${t("doc.offer.numberShort")} `}
          <Text style={styles.offerNumberValue}>{offerNumber}</Text>
          {`  ·  ${formatDateLong(createdDate, locale)}`}
        </Text>
      </View>
    </View>
  );
};
