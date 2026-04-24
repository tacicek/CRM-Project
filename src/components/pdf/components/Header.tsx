import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatDate } from "../utils/formatters";

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gray[900],
    paddingBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.base,
  },
  leftCol: { flex: 1 },
  rightCol: { width: 220, alignItems: "flex-end" },
  logo: { width: 140, height: 36, objectFit: "contain", marginBottom: SPACING.xs },
  mutedLabel: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, marginBottom: 1 },
  subLabel: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },
  value: { fontSize: FONT_SIZES.sm, marginBottom: 1 },
  address: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginBottom: 1 },
  offerNumber: { fontSize: FONT_SIZES.base, fontWeight: 700, marginTop: SPACING.base },
  cityDate: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginTop: 1 },
  blindBadge: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: "#D97706",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: "flex-end",
  },
  blindBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: "#D97706",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
});

interface HeaderProps {
  data: OfferData;
}

export const Header = ({ data }: HeaderProps) => {
  const { company, createdDate, offerNumber, validUntil } = data;
  const customerAddress = data.customer.address;

  const hasValidLogo = company.logo && (
    company.logo.startsWith("data:image") ||
    company.logo.startsWith("http://") ||
    company.logo.startsWith("https://")
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        {/* LEFT — firm info only */}
        <View style={styles.leftCol}>
          {hasValidLogo ? (
            <Image
              style={styles.logo}
              src={company.logo}
              cache={false}
            />
          ) : null}
          <Text style={styles.mutedLabel}>Unsere Referenz:</Text>
          <Text style={styles.value}>{company.name}</Text>
          {company.phone ? (
            <Text style={styles.subLabel}>{`Tel. ${company.phone}`}</Text>
          ) : null}
          <Text style={styles.subLabel}>{company.email}</Text>
          {company.mwstNr ? (
            <Text style={[styles.value, { marginTop: 4 }]}>{`MwSt: ${company.mwstNr}`}</Text>
          ) : null}
        </View>

        {/* RIGHT — customer info + document metadata */}
        <View style={styles.rightCol}>
          <Text style={styles.value}>{data.customer.name}</Text>
          {customerAddress ? (
            <Text style={styles.address}>{customerAddress}</Text>
          ) : null}
          {data.customer.phone?.trim() ? (
            <Text style={styles.address}>{`Telefon: ${data.customer.phone.trim()}`}</Text>
          ) : null}
          {data.customer.email?.trim() ? (
            <Text style={styles.address}>{`E-Mail: ${data.customer.email.trim()}`}</Text>
          ) : null}
          <Text style={styles.offerNumber}>{`Offerte Nr. ${offerNumber}`}</Text>
          <Text style={styles.cityDate}>{formatDate(createdDate)}</Text>
          {validUntil ? (
            <Text style={styles.cityDate}>{`Gültig bis: ${formatDate(validUntil)}`}</Text>
          ) : null}
          {data.offerteType === 'blind' ? (
            <View style={styles.blindBadge}>
              <Text style={styles.blindBadgeText}>BLIND OFFERTE — Ohne Besichtigung</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};
