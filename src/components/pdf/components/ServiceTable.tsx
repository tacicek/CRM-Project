import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatCurrency, formatTime } from "../utils/formatters";
import { formatQuantityUnit } from "../utils/formatQuantityUnit";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: COLORS.gray[900],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  headerCell: {
    color: COLORS.text.white,
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
  },
  position: {
    flex: 0.45,
    fontSize: FONT_SIZES.base,
  },
  description: {
    flex: 2.2,
    fontSize: FONT_SIZES.base,
  },
  quantity: {
    flex: 0.7,
    textAlign: "center",
    fontSize: FONT_SIZES.base,
  },
  price: {
    flex: 0.8,
    textAlign: "right",
    fontSize: FONT_SIZES.base,
  },
  total: {
    flex: 0.8,
    textAlign: "right",
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
  },
  details: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    marginTop: 2,
    marginLeft: 8,
  },
  totalsContainer: {
    marginTop: SPACING.base,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 4,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray[50],
  },
  totalRow: {
    flexDirection: "row",
    width: 230,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: FONT_SIZES.base,
    color: COLORS.text.secondary,
  },
  totalValue: {
    fontSize: FONT_SIZES.base,
  },
  totalDivider: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray[300],
    marginVertical: 4,
    width: 230,
  },
  grandTotalRow: {
    flexDirection: "row",
    width: 230,
    justifyContent: "space-between",
  },
  grandTotalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
    color: COLORS.primary,
  },
  grandTotalValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
    color: COLORS.primary,
  },
  breakdownBox: {
    marginTop: SPACING.base,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 4,
    backgroundColor: COLORS.gray[50],
  },
  breakdownTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    marginBottom: SPACING.xs,
  },
  breakdownLine: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  priceModelBox: {
    marginTop: SPACING.base,
    padding: SPACING.base,
    borderRadius: 4,
    borderWidth: 1,
  },
  priceModelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  priceModelLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    marginRight: 6,
  },
  priceModelValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
  },
  priceModelNote: {
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
    lineHeight: 1.4,
  },
});

interface ServiceTableProps {
  data: OfferData;
  /** If set, render only this slice (multi-page tables). */
  itemsOverride?: OfferData["items"];
  /** Zwischensumme / MwSt / Total — only on last table page */
  showTotalsBlock?: boolean;
  /** Global Pos. offset when table is split across pages */
  positionOffset?: number;
}

const buildBreakdownLines = (data: OfferData) => {
  const b = data.breakdown;
  if (!b) return [];
  return [
    b.volume ? `Volumen: ${b.volume} m³` : null,
    b.estimatedTime ? `Geschätzte Arbeitszeit: ${formatTime(b.estimatedTime)}` : null,
    b.carryTime ? `Tragezeit: ${formatTime(b.carryTime)}` : null,
    b.assemblyTime ? `Montage/Demontage: ${formatTime(b.assemblyTime)}` : null,
    b.driveTime ? `Fahrzeit: ${formatTime(b.driveTime)}` : null,
    b.bufferTime ? `Pufferzeit: ${formatTime(b.bufferTime)}` : null,
    b.truckType ? `LKW Typ: ${b.truckType}` : null,
    b.workers ? `Anzahl Mitarbeiter: ${b.workers}` : null,
  ].filter(Boolean) as string[];
};

export const ServiceTable = ({
  data,
  itemsOverride,
  showTotalsBlock = true,
  positionOffset = 0,
}: ServiceTableProps) => {
  const items = itemsOverride ?? data.items;
  const breakdownLines = buildBreakdownLines(data);
  const primary = data.company.primaryColor || COLORS.primary;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow} wrap={false}>
        <Text style={[styles.headerCell, styles.position]}>Pos.</Text>
        <Text style={[styles.headerCell, styles.description]}>Beschreibung</Text>
        <Text style={[styles.headerCell, styles.quantity]}>Menge</Text>
        <Text style={[styles.headerCell, styles.price]}>Preis</Text>
        <Text style={[styles.headerCell, styles.total]}>Total (CHF)</Text>
      </View>

      {items.map((item, index) => {
        const te = item.timeEstimate;
        const hasTE = te && te.minHours > 0 && te.hourlyRate > 0;
        return (
          <View key={`${item.description}-${positionOffset + index}`} style={styles.row} wrap={false}>
            <Text style={styles.position}>{positionOffset + index + 1}</Text>
            <View style={styles.description}>
              <Text>{item.description}</Text>
              {item.details?.map((detail, detailIndex) => {
                const cleanDetail = detail.replace(/^[•·-]\s*/, "").trim();
                return (
                  <Text key={`${cleanDetail}-${detailIndex}`} style={styles.details}>
                    • {cleanDetail}
                  </Text>
                );
              })}
            </View>
            {hasTE ? (
              <>
                <Text style={styles.quantity}>{te!.minHours} – {te!.maxHours} Std.</Text>
                <Text style={styles.price}>{formatCurrency(te!.hourlyRate)}/Std.</Text>
                <View style={[styles.total, { alignItems: "flex-end" }]}>
                  <Text style={{ fontSize: FONT_SIZES.base, fontWeight: 700, color: "#B45309" }}>
                    {formatCurrency(te!.minHours * te!.hourlyRate)}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                    {"\u2013"} {formatCurrency(te!.maxHours * te!.hourlyRate)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.quantity}>{formatQuantityUnit(item.quantity, item.unit)}</Text>
                <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                <Text style={styles.total}>{formatCurrency(item.total)}</Text>
              </>
            )}
          </View>
        );
      })}

      {showTotalsBlock ? (
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Zwischensumme:</Text>
            {data.pricing.maxSubtotal !== null && data.pricing.maxSubtotal !== undefined ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.totalValue, { color: "#B45309", fontWeight: 700 }]}>
                  {formatCurrency(data.pricing.subtotal)}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                  {"\u2013"} {formatCurrency(data.pricing.maxSubtotal)}
                </Text>
              </View>
            ) : (
              <Text style={styles.totalValue}>{formatCurrency(data.pricing.subtotal)}</Text>
            )}
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>MwSt. ({data.pricing.mwstRate}%):</Text>
            {data.pricing.maxMwstAmount !== null && data.pricing.maxMwstAmount !== undefined ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.totalValue, { color: "#B45309" }]}>
                  {formatCurrency(data.pricing.mwstAmount)}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                  {"\u2013"} {formatCurrency(data.pricing.maxMwstAmount)}
                </Text>
              </View>
            ) : (
              <Text style={styles.totalValue}>{formatCurrency(data.pricing.mwstAmount)}</Text>
            )}
          </View>
          <View style={[styles.totalDivider, { borderBottomColor: primary }]} />
          <View style={styles.grandTotalRow}>
            <Text style={[styles.grandTotalLabel, { color: primary }]}>Total:</Text>
            {data.pricing.maxTotal !== null && data.pricing.maxTotal !== undefined ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.grandTotalValue, { color: "#B45309" }]}>
                  {formatCurrency(data.pricing.total)}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: 700, color: "#B45309" }}>
                  {"\u2013"} {formatCurrency(data.pricing.maxTotal)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.grandTotalValue, { color: primary }]}>
                {formatCurrency(data.pricing.total)}
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {showTotalsBlock && breakdownLines.length > 0 ? (
        <View style={styles.breakdownBox} wrap={false}>
          <Text style={styles.breakdownTitle}>Service-Details</Text>
          {breakdownLines.map((line) => (
            <Text key={line} style={styles.breakdownLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {showTotalsBlock &&
        data.pricing.priceModel === "stundenansatz" &&
        data.pricing.hourlyRate !== null &&
        data.pricing.hourlyRate !== undefined && (
          <View style={[styles.priceModelBox, { borderColor: primary, backgroundColor: "#F0F9FF" }]} wrap={false}>
            <View style={styles.priceModelRow}>
              <Text style={[styles.priceModelLabel, { color: primary }]}>Preismodell:</Text>
              <Text style={[styles.priceModelValue, { color: primary }]}>
                Stundenansatz — CHF {Number(data.pricing.hourlyRate).toLocaleString("de-CH")} / Std.
              </Text>
            </View>
            <Text style={[styles.priceModelNote, { color: COLORS.text.secondary }]}>
              Die Abrechnung erfolgt nach effektivem Zeitaufwand zum angegebenen Stundenansatz. Der Endpreis ergibt sich aus den tatsächlich geleisteten Stunden.
            </Text>
          </View>
        )}

      {showTotalsBlock &&
        data.pricing.priceModel === "kostendach" &&
        data.pricing.hourlyRate !== null &&
        data.pricing.hourlyRate !== undefined &&
        data.pricing.kostendachMax !== null &&
        data.pricing.kostendachMax !== undefined && (
          <View style={[styles.priceModelBox, { borderColor: "#D97706", backgroundColor: "#FFFBEB" }]} wrap={false}>
            <View style={styles.priceModelRow}>
              <Text style={[styles.priceModelLabel, { color: "#92400E" }]}>Preismodell:</Text>
              <Text style={[styles.priceModelValue, { color: "#92400E" }]}>
                Stundenansatz CHF {Number(data.pricing.hourlyRate).toLocaleString("de-CH")} / Std. — Kostendach: max. CHF{" "}
                {Number(data.pricing.kostendachMax).toLocaleString("de-CH")}
              </Text>
            </View>
            <Text style={[styles.priceModelNote, { color: "#92400E" }]}>
              Sie zahlen maximal CHF {Number(data.pricing.kostendachMax).toLocaleString("de-CH")}, unabhängig vom tatsächlichen Zeitaufwand.
            </Text>
          </View>
        )}
    </View>
  );
};
