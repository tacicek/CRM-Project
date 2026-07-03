import { Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatCurrency, formatTime } from "../utils/formatters";
import { formatQuantityUnit } from "../utils/formatQuantityUnit";
import { hourlyRange, isFreeItem } from "@/lib/offerPricing";
import { groupItemsByService } from "@/lib/offerServiceType";

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

// ─── Service grouping (Faz 3) ───────────────────────────────────────────────
// Grouping now happens via offer_items.service_type (groupItemsByService, Faz 0).
// The old isSectionHeader heuristic was retired (it was never used in live data).

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
}

// Two-column position row (servisler.png): description (+ a small Menge/Einzel context
// line) on the left, price on the right. Same price computation as before — only the
// presentation collapses from the old 5 columns to 2. No POS badge (screenshot pattern).
const ItemRow = ({ item }: RowProps) => {
  const te = item.timeEstimate;
  const r = hourlyRange(te);
  // Menge/Einzel context, folded into a small sub-line under the description.
  const sub = r
    ? `${te!.minHours}–${te!.maxHours} Std. à ${formatCurrency(te!.hourlyRate)}/Std.`
    : item.priceType === "pauschale"
      ? "Pauschal"
      : item.quantity !== 1
        ? `${formatQuantityUnit(item.quantity, item.unit)} à ${formatCurrency(item.price)}`
        : formatQuantityUnit(item.quantity, item.unit);

  return (
    <View style={cardStyles.posRow} wrap={false}>
      <View style={cardStyles.posLeft}>
        <Text style={cardStyles.posDesc}>{item.description}</Text>
        {sub ? <Text style={cardStyles.posSub}>{sub}</Text> : null}
      </View>
      <View style={cardStyles.posRight}>
        {r ? (
          <>
            <Text style={[cardStyles.posPrice, { color: "#B45309" }]}>{formatCurrency(r.min)}</Text>
            <Text style={cardStyles.posPriceSub}>{"–"} {formatCurrency(r.max)}</Text>
          </>
        ) : (
          <Text style={cardStyles.posPrice}>{formatCurrency(item.total)}</Text>
        )}
      </View>
    </View>
  );
};

// ─── Leistungsumfang (✓-list) ───────────────────────────────────────────────────
// One combined list per service group. Source priority per item:
//   1. item.leistung (offer_item_leistung rows, position-sorted)
//   2. else item.details (description-derived sub-lines — existing mechanism)
//   3. else, for a free (inkl/optional) item, its own description
// Free items leave the price table entirely (Change 2); this is where they resurface.
const buildLeistungLines = (groupItems: OfferData["items"]): string[] => {
  const lines: string[] = [];
  for (const item of groupItems) {
    if (item.leistung && item.leistung.length > 0) {
      for (const l of [...item.leistung].sort((a, b) => a.position - b.position)) {
        if (l.text && l.text.trim()) lines.push(l.text.trim());
      }
    } else if (item.details && item.details.length > 0) {
      for (const d of item.details) {
        const clean = d.replace(/^[•·-]\s*/, "").trim();
        if (clean) lines.push(clean);
      }
    } else if (isFreeItem(item.priceType) && item.description && item.description.trim()) {
      lines.push(item.description.trim());
    }
  }
  return lines;
};

const leistungStyles = StyleSheet.create({
  box: { marginTop: 4, marginBottom: 8, paddingHorizontal: SPACING.sm },
  title: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: COLORS.text.secondary,
    marginBottom: 3,
  },
  line: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2 },
  lineText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text.primary, lineHeight: 1.35 },
});

/** Font-independent vector checkmark (built-in Helvetica has no U+2713 glyph). */
const CheckMark = ({ color }: { color: string }) => (
  <Svg width={9} height={9} viewBox="0 0 10 10" style={{ marginRight: 5, marginTop: 2 }}>
    <Polyline points="1.5,5.5 4,8 8.5,2.2" fill="none" stroke={color} strokeWidth={1.6} />
  </Svg>
);

const LeistungsumfangBlock = ({ lines, accent }: { lines: string[]; accent: string }) => (
  <View style={leistungStyles.box}>
    <Text style={leistungStyles.title}>LEISTUNGSUMFANG</Text>
    {lines.map((line, i) => (
      <View key={`${line}-${i}`} style={leistungStyles.line} wrap={false}>
        <CheckMark color={accent} />
        <Text style={leistungStyles.lineText}>{line}</Text>
      </View>
    ))}
  </View>
);

// ─── Props ────────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    marginBottom: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 4,
  },
  cardBand: {
    backgroundColor: DARK,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  cardBandText: {
    color: "#FFFFFF",
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingHorizontal: SPACING.sm,
    paddingTop: 2,
    paddingBottom: 4,
  },
  posRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  posLeft: { flex: 1, paddingRight: SPACING.sm },
  posDesc: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: COLORS.text.primary },
  posSub: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, marginTop: 1 },
  posRight: { minWidth: 78, alignItems: "flex-end" },
  posPrice: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: COLORS.text.primary },
  posPriceSub: { fontSize: FONT_SIZES.xs, color: "#B45309" },
});

interface ServiceTableProps {
  data: OfferData;
  itemsOverride?: OfferData["items"];
  showTotalsBlock?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const ServiceTable = ({
  data,
  itemsOverride,
  showTotalsBlock = true,
}: ServiceTableProps) => {
  const items = itemsOverride ?? data.items;
  const breakdownLines = buildBreakdownLines(data);
  const accent = data.company.primaryColor || "#F97316";

  // Group items by stored service_type; each renders as its own card (dark band = service
  // name + priced rows + Leistungsumfang), unconditionally — every service gets a band.
  const groups = groupItemsByService(items.map((it) => ({ ...it, service_type: it.serviceType })));

  return (
    <View style={styles.container}>
      {groups.map((group, gi) => {
        const billable = group.items.filter((it) => !isFreeItem(it.priceType));
        const leistungLines = buildLeistungLines(group.items);
        return (
          // wrap={false}: keep the whole card together on one page (group-aware chunking in
          // P2b-i already sizes groups to fit; rare oversized groups still degrade gracefully).
          <View key={`group-${gi}`} style={cardStyles.card} wrap={false}>
            <View style={cardStyles.cardBand}>
              <Text style={cardStyles.cardBandText}>{group.label}</Text>
            </View>
            <View style={cardStyles.cardBody}>
              {billable.map((item, idx) => (
                <ItemRow key={`${item.description}-${idx}`} item={item} />
              ))}
              {leistungLines.length > 0 ? (
                <LeistungsumfangBlock lines={leistungLines} accent={accent} />
              ) : null}
            </View>
          </View>
        );
      })}

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

            {/* MwSt \u2014 only when a rate is active (Satz > 0); at 0% the row is omitted
                entirely (Zwischensumme = Gesamtbetrag), mirroring the Rechnung PDF
                (generateRechnungPdf.ts: `if (data.mwst_satz > 0)`). Amounts are untouched. */}
            {data.pricing.mwstRate > 0 ? (
              data.pricing.maxMwstAmount !== null ? (
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
              )
            ) : null}

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
