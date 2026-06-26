import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatCurrency, formatTime } from "../utils/formatters";
import { formatQuantityUnit } from "../utils/formatQuantityUnit";
import { hourlyRange } from "@/lib/offerPricing";

const DARK = "#1C1C27";
const SECTION_BG = "#F9FAFB";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
  },
  // Table header
  headerRow: {
    flexDirection: "row",
    backgroundColor: DARK,
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
  },
  headerCell: {
    color: "#FFFFFF",
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  // Category header row
  categoryRow: {
    flexDirection: "row",
    backgroundColor: SECTION_BG,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    marginTop: 2,
    alignItems: "center",
  },
  categoryBullet: {
    width: 8,
    height: 8,
    borderRadius: 1,
    marginRight: 6,
    marginTop: 1,
  },
  categoryName: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    letterSpacing: 0.5,
  },
  categoryTotal: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    minWidth: 70,
    textAlign: "right",
  },
  // Item row
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    alignItems: "flex-start",
  },
  rowAlt: {
    backgroundColor: "#FAFAFA",
  },
  // Column widths (must match header)
  colPos: { flex: 0.45, fontSize: FONT_SIZES.sm, color: COLORS.text.secondary },
  colDesc: { flex: 2.2 },
  colQty: { flex: 0.8, textAlign: "center", fontSize: FONT_SIZES.sm },
  colUnit: { flex: 0.8, textAlign: "right", fontSize: FONT_SIZES.sm },
  colTotal: { flex: 0.8, textAlign: "right", fontSize: FONT_SIZES.sm, fontWeight: 700 },
  descMain: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
  },
  descDetail: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 1,
    lineHeight: 1.35,
  },
  // Totals block (right-aligned summary)
  totalsOuter: {
    marginTop: SPACING.base,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  totalValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    fontWeight: 700,
  },
  totalDivider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginHorizontal: SPACING.sm,
    marginVertical: 2,
  },
  grandTotalBox: {
    backgroundColor: DARK,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    borderRadius: 3,
  },
  grandTotalLabel: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  grandTotalCurrency: {
    fontSize: FONT_SIZES.xs,
    color: "#A0A0B0",
    marginRight: 4,
  },
  grandTotalValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
  },
  grandTotalValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  // Price model notes
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
});

// ─── Category grouping ────────────────────────────────────────────────────────

interface ItemGroup {
  header: string | null;
  headerTotal: number;
  items: { item: OfferData["items"][number]; localIdx: number }[];
  groupIdx: number;
}

function groupItems(items: OfferData["items"]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  let current: ItemGroup = { header: null, headerTotal: 0, items: [], groupIdx: 0 };

  for (const item of items) {
    if (item.isSectionHeader) {
      if (current.items.length > 0 || current.header !== null) {
        current.headerTotal = current.items.reduce((sum, { item: it }) => sum + (it.total || 0), 0);
        groups.push(current);
      }
      current = { header: item.description, headerTotal: 0, items: [], groupIdx: groups.length };
    } else {
      current.items.push({ item, localIdx: current.items.length });
    }
  }

  current.headerTotal = current.items.reduce((sum, { item: it }) => sum + (it.total || 0), 0);
  if (current.items.length > 0 || current.header !== null) {
    groups.push(current);
  }

  return groups;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RowProps {
  item: OfferData["items"][number];
  posLabel: string;
  alt: boolean;
}

const ItemRow = ({ item, posLabel, alt }: RowProps) => {
  const te = item.timeEstimate;
  const r = hourlyRange(te);

  return (
    <View style={[styles.row, alt ? styles.rowAlt : {}]} wrap={false}>
      <Text style={styles.colPos}>{posLabel}</Text>
      <View style={styles.colDesc}>
        <Text style={styles.descMain}>{item.description}</Text>
        {item.details?.map((d, di) => {
          const clean = d.replace(/^[•·-]\s*/, "").trim();
          return (
            <Text key={`${clean}-${di}`} style={styles.descDetail}>
              {clean}
            </Text>
          );
        })}
      </View>
      {r ? (
        <>
          <Text style={styles.colQty}>{`${te!.minHours}–${te!.maxHours} Std.`}</Text>
          <Text style={styles.colUnit}>{`${formatCurrency(te!.hourlyRate)}/Std.`}</Text>
          <View style={[styles.colTotal, { alignItems: "flex-end" }]}>
            <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: 700, color: "#B45309" }}>
              {formatCurrency(r.min)}
            </Text>
            <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
              {"\u2013"} {formatCurrency(r.max)}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.colQty}>{formatQuantityUnit(item.quantity, item.unit)}</Text>
          <Text style={styles.colUnit}>{formatCurrency(item.price)}</Text>
          <Text style={styles.colTotal}>{formatCurrency(item.total)}</Text>
        </>
      )}
    </View>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ServiceTableProps {
  data: OfferData;
  itemsOverride?: OfferData["items"];
  showTotalsBlock?: boolean;
  positionOffset?: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const ServiceTable = ({
  data,
  itemsOverride,
  showTotalsBlock = true,
  positionOffset = 0,
}: ServiceTableProps) => {
  const items = itemsOverride ?? data.items;
  const breakdownLines = buildBreakdownLines(data);
  const accent = data.company.primaryColor || "#F97316";

  const groups = groupItems(items);
  const hasCategories = groups.some((g) => g.header !== null);

  // Global row counter for flat numbering (when no categories)
  let flatIdx = positionOffset;

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={[styles.headerRow, { backgroundColor: accent }]} wrap={false}>
        <Text style={[styles.headerCell, styles.colPos]}>POS.</Text>
        <Text style={[styles.headerCell, styles.colDesc]}>BESCHREIBUNG</Text>
        <Text style={[styles.headerCell, styles.colQty]}>MENGE</Text>
        <Text style={[styles.headerCell, styles.colUnit]}>EINZEL CHF</Text>
        <Text style={[styles.headerCell, styles.colTotal]}>TOTAL CHF</Text>
      </View>

      {/* Rows */}
      {groups.map((group, gi) => (
        <View key={`group-${gi}`}>
          {/* Category header row (if this group has a header) */}
          {group.header ? (
            <View style={styles.categoryRow} wrap={false}>
              <View style={[styles.categoryBullet, { backgroundColor: accent }]} />
              <Text style={styles.categoryName}>{group.header}</Text>
              {group.headerTotal > 0 ? (
                <Text style={styles.categoryTotal}>{formatCurrency(group.headerTotal)}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Items in this group */}
          {group.items.map(({ item, localIdx }) => {
            const posLabel = hasCategories
              ? `${gi + 1}.${localIdx + 1}`
              : String(++flatIdx);

            return (
              <ItemRow
                key={`${item.description}-${posLabel}`}
                item={item}
                posLabel={posLabel}
                alt={localIdx % 2 === 1}
              />
            );
          })}
        </View>
      ))}

      {/* Totals block */}
      {showTotalsBlock ? (
        <View style={styles.totalsOuter} wrap={false}>
          <View style={styles.totalsBox}>
            {/* Zwischensumme */}
            {data.pricing.maxSubtotal !== null ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Zwischensumme:</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.totalValue, { color: "#B45309" }]}>
                    {formatCurrency(data.pricing.subtotal)}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                    {"\u2013"} {formatCurrency(data.pricing.maxSubtotal)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Zwischensumme</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.pricing.subtotal)}</Text>
              </View>
            )}

            {/* Zuschläge — zwischen Zwischensumme und MwSt */}
            {(data.pricing.surcharges ?? []).map((s, i) => (
              <View key={i} style={styles.totalRow}>
                <Text style={styles.totalLabel}>{s.label || "Zuschlag"}</Text>
                <Text style={styles.totalValue}>{formatCurrency(s.amount)}</Text>
              </View>
            ))}

            <View style={styles.totalDivider} />

            {/* MwSt */}
            {data.pricing.maxMwstAmount !== null ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{`MwSt ${data.pricing.mwstRate} %`}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.totalValue, { color: "#B45309" }]}>
                    {formatCurrency(data.pricing.mwstAmount)}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                    {"\u2013"} {formatCurrency(data.pricing.maxMwstAmount)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{`MwSt ${data.pricing.mwstRate} %`}</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.pricing.mwstAmount)}</Text>
              </View>
            )}

            {/* GESAMTBETRAG — dark box */}
            <View style={[styles.grandTotalBox, { backgroundColor: accent }]}>
              <Text style={styles.grandTotalLabel}>GESAMTBETRAG</Text>
              <View style={styles.grandTotalValueRow}>
                {data.pricing.maxTotal !== null ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.grandTotalValue, { color: "#FFFFFF" }]}>
                      {formatCurrency(data.pricing.total)}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZES.xs, color: "#F1F5F9" }}>
                      {"\u2013"} {formatCurrency(data.pricing.maxTotal)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.grandTotalValue, { color: "#FFFFFF" }]}>
                    {formatCurrency(data.pricing.total)}
                  </Text>
                )}
              </View>
            </View>

            {/* Valid until note */}
            {data.validUntil ? (
              <Text
                style={{
                  fontSize: FONT_SIZES.xs,
                  color: COLORS.text.secondary,
                  textAlign: "right",
                  marginTop: 4,
                  paddingHorizontal: SPACING.sm,
                }}
              >
                {`Angebot gültig bis ${new Date(data.validUntil).toLocaleDateString("de-CH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Breakdown */}
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

      {/* Price model: Stundenansatz */}
      {showTotalsBlock &&
        data.pricing.priceModel === "stundenansatz" &&
        data.pricing.hourlyRate !== null && (
          <View
            style={[styles.priceModelBox, { borderColor: accent, backgroundColor: "#F0F9FF" }]}
            wrap={false}
          >
            <View style={styles.priceModelRow}>
              <Text style={[styles.priceModelLabel, { color: accent }]}>Preismodell:</Text>
              <Text style={[styles.priceModelValue, { color: accent }]}>
                {`Stundenansatz — CHF ${Number(data.pricing.hourlyRate).toLocaleString("de-CH")} / Std.`}
              </Text>
            </View>
            <Text style={[styles.priceModelNote, { color: COLORS.text.secondary }]}>
              Die Abrechnung erfolgt nach effektivem Zeitaufwand zum angegebenen Stundenansatz.
            </Text>
          </View>
        )}

      {/* Price model: Kostendach */}
      {showTotalsBlock &&
        data.pricing.priceModel === "kostendach" &&
        data.pricing.hourlyRate !== null &&
        data.pricing.kostendachMax !== null && (
          <View
            style={[styles.priceModelBox, { borderColor: "#D97706", backgroundColor: "#FFFBEB" }]}
            wrap={false}
          >
            <View style={styles.priceModelRow}>
              <Text style={[styles.priceModelLabel, { color: "#92400E" }]}>Preismodell:</Text>
              <Text style={[styles.priceModelValue, { color: "#92400E" }]}>
                {`Stundenansatz CHF ${Number(data.pricing.hourlyRate).toLocaleString("de-CH")} / Std. — Kostendach max. CHF ${Number(data.pricing.kostendachMax).toLocaleString("de-CH")}`}
              </Text>
            </View>
            <Text style={[styles.priceModelNote, { color: "#92400E" }]}>
              {`Sie zahlen maximal CHF ${Number(data.pricing.kostendachMax).toLocaleString("de-CH")}, unabhängig vom tatsächlichen Zeitaufwand.`}
            </Text>
          </View>
        )}
    </View>
  );
};
