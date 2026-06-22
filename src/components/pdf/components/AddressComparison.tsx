import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData, AddressDetails } from "../types/offer.types";
import { getServiceLayout } from "../utils/serviceLayout";
import { formatDate } from "../utils/formatters";

const ORANGE = "#F97316";
const GREEN = "#059669";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  // Top row: addresses + optional meta cells
  topRow: {
    flexDirection: "row",
    minHeight: 70,
  },
  // Address columns
  addrCol: {
    flex: 1,
  },
  addrHeader: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  addrHeaderText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  addrBody: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  addrStreet: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    marginBottom: 1,
  },
  addrCity: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  addrMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  // Arrow divider
  arrowDivider: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 22, // align with body text area (below header)
  },
  arrowText: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.gray[300], // inline'da accent ile override
  },
  // Vertical divider between address section and meta section
  verticalDivider: {
    width: 1,
    backgroundColor: COLORS.gray[200],
  },
  // Meta cells row (TERMIN, FLÄCHE etc.)
  metaSection: {
    flexDirection: "column",
    width: 130,
  },
  metaCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  metaCellLast: {
    borderBottomWidth: 0,
  },
  metaLabel: {
    fontSize: 7,
    color: COLORS.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: "center",
  },
  metaValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    textAlign: "center",
  },
  metaUnit: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 1,
  },
});

const formatAddressLines = (addr?: AddressDetails) => {
  if (!addr) return { street: "", city: "", meta: [] as string[] };
  const street = addr.street || "";
  const city = [addr.plz, addr.city].filter(Boolean).join(" ");
  const meta: string[] = [];
  if (typeof addr.rooms === "number") meta.push(`${addr.rooms} Zi.`);
  if (typeof addr.floor === "number") meta.push(`${addr.floor}. OG`);
  if (addr.hasLift === true) meta.push("Lift");
  if (addr.buildingType) meta.push(addr.buildingType);
  return { street, city, meta };
};

interface AddressComparisonProps {
  data: OfferData;
}

export const AddressComparison = ({ data }: AddressComparisonProps) => {
  const from = data.addresses?.from;
  const to = data.addresses?.to;

  if (!from && !to) return null;

  const layout = getServiceLayout(data.service.type);
  const accent = data.company.primaryColor || ORANGE;
  const showRoute = Boolean(from && to);

  const fromFmt = formatAddressLines(from);
  const toFmt = formatAddressLines(to);

  // Meta cells — only numeric/defined values (rooms: use == null, NOT !== null to catch undefined too)
  const metaCells: { label: string; value: string; unit?: string }[] = [];

  if (data.executionDate) {
    metaCells.push({ label: "TERMIN", value: formatDate(data.executionDate) });
  }

  // typeof-Guard deckt null UND undefined bereits ab (typeof null === "object"),
  // ein zusätzlicher Null-Check ist daher überflüssig.
  const rooms = from?.rooms ?? to?.rooms;
  if (typeof rooms === "number") {
    metaCells.push({ label: "FLÄCHE", value: String(rooms), unit: "Zi." });
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* FROM address */}
        <View style={styles.addrCol}>
          <View style={[styles.addrHeader, { backgroundColor: accent }]}>
            <Text style={styles.addrHeaderText}>
              {layout.primaryAddressLabel.toUpperCase()}
            </Text>
          </View>
          <View style={styles.addrBody}>
            {fromFmt.street ? <Text style={styles.addrStreet}>{fromFmt.street}</Text> : null}
            {fromFmt.city ? <Text style={styles.addrCity}>{fromFmt.city}</Text> : null}
            {fromFmt.meta.length > 0 ? (
              <Text style={styles.addrMeta}>{fromFmt.meta.join(" · ")}</Text>
            ) : null}
          </View>
        </View>

        {/* Arrow — only when both addresses exist */}
        {showRoute ? (
          <View style={styles.arrowDivider}>
            <Text style={[styles.arrowText, { color: accent }]}>→</Text>
          </View>
        ) : null}

        {/* TO address — only when both exist */}
        {showRoute ? (
          <View style={styles.addrCol}>
            <View style={[styles.addrHeader, { backgroundColor: GREEN }]}>
              <Text style={styles.addrHeaderText}>
                {layout.secondaryAddressLabel.toUpperCase()}
              </Text>
            </View>
            <View style={styles.addrBody}>
              {toFmt.street ? <Text style={styles.addrStreet}>{toFmt.street}</Text> : null}
              {toFmt.city ? <Text style={styles.addrCity}>{toFmt.city}</Text> : null}
              {toFmt.meta.length > 0 ? (
                <Text style={styles.addrMeta}>{toFmt.meta.join(" · ")}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Meta cells — TERMIN, FLÄCHE */}
        {metaCells.length > 0 ? (
          <>
            <View style={styles.verticalDivider} />
            <View style={styles.metaSection}>
              {metaCells.map((cell, i) => (
                <View
                  key={cell.label}
                  style={[
                    styles.metaCell,
                    i === metaCells.length - 1 ? styles.metaCellLast : {},
                  ]}
                >
                  <Text style={styles.metaLabel}>{cell.label}</Text>
                  <Text style={styles.metaValue}>{cell.value}</Text>
                  {cell.unit ? <Text style={styles.metaUnit}>{cell.unit}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
};
