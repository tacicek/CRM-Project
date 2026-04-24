import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData, AddressDetails } from "../types/offer.types";
import { getServiceLayout } from "../utils/serviceLayout";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
  },
  row: {
    flexDirection: "row",
    gap: SPACING.base,
  },
  col: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  colTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    paddingBottom: 4,
    marginBottom: 4,
  },
  line: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
});

const renderLines = (address?: AddressDetails) => {
  if (!address) return [];
  return [
    address.street ? `Strasse: ${address.street}` : null,
    address.plz || address.city ? `PLZ/Ort: ${[address.plz, address.city].filter(Boolean).join(" ")}` : null,
    address.buildingType ? `Gebäude: ${address.buildingType}` : null,
    typeof address.floor === "number" ? `Etage: ${address.floor}` : null,
    typeof address.rooms === "number" ? `Zimmer: ${address.rooms}` : null,
    typeof address.hasLift === "boolean" ? `Lift: ${address.hasLift ? "Ja" : "Nein"}` : null,
    typeof address.hasParking === "boolean" ? `Parkplatz: ${address.hasParking ? "Ja" : "Nein"}` : null,
  ].filter(Boolean) as string[];
};

interface AddressComparisonProps {
  data: OfferData;
}

export const AddressComparison = ({ data }: AddressComparisonProps) => {
  const from = data.addresses?.from;
  const to = data.addresses?.to;

  if (!from && !to) return null;

  const layout = getServiceLayout(data.service.type);

  const primaryAddress = from || to;
  const secondaryAddress = from && to ? to : undefined;

  const primaryTitle = layout.primaryAddressLabel;
  const secondaryTitle = layout.secondaryAddressLabel;
  const showSecondary = layout.showSecondaryByDefault || !!secondaryAddress;

  const primaryLines = renderLines(primaryAddress);
  const secondaryLines = renderLines(secondaryAddress);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.colTitle}>{primaryTitle}</Text>
          {primaryLines.length ? primaryLines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          )) : <Text style={styles.line}>-</Text>}
        </View>
        {showSecondary && (
          <View style={styles.col}>
            <Text style={styles.colTitle}>{secondaryTitle}</Text>
            {secondaryLines.length ? secondaryLines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            )) : <Text style={styles.line}>-</Text>}
          </View>
        )}
      </View>
    </View>
  );
};
