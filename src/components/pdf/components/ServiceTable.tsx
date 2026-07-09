import { Circle, Path, Polyline, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import {
  OfferData,
  OfferItemAreaMeta,
  OfferItemEffortMeta,
  OfferItemVolumeMeta,
} from "../types/offer.types";
import { formatCurrency, formatDate, formatTime } from "../utils/formatters";
import { formatQuantityUnit } from "../utils/formatQuantityUnit";
import { isFreeItem, itemAmountDisplay, toAmountBasis, RATE_AGGREGATE_NOTE } from "@/lib/offerPricing";
import { groupItemsByService, groupScheduled, serviceTerminLabel } from "@/lib/offerServiceType";

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
  // rate-Posten: Hinweiszeile statt Aggregat-Box — Note links, Gültigkeit rechts (design v2)
  rateNoteRow: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  rateNoteText: {
    flex: 1,
    maxWidth: "62%",
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 1.5,
  },
  rateNoteValid: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: "right",
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

// ─── Position meta lines (P2c) ────────────────────────────────────────────────
// Compact per-position detail lines under the description (new_offer.png pattern):
//   effort → person/truck vector icons + crew/vehicles left, hourly rate as a badge right
//   area   → "OBJEKT" label + object type / m² (+ Abnahme note)
//   volume → "TARIF" label + rate per m³/Monat + estimated volume
// Icons are font-independent Svg vectors — same lesson as CheckMark: the built-in
// Helvetica has no emoji/dingbat glyphs, so no unicode/emoji icons.

const metaStyles = StyleSheet.create({
  effortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  effortItems: { flexDirection: "row", alignItems: "center" },
  effortItem: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  effortText: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },
  rateBadge: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 3,
    backgroundColor: SECTION_BG,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
  },
  rateBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: 700, color: COLORS.text.primary },
  metaLine: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: COLORS.text.secondary,
    marginRight: 5,
  },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.text.primary },
  metaNote: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, marginTop: 1 },
});

/** Null/undefined guard that satisfies eqeqeq (meta fields are `T | null | undefined`). */
const isSet = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;

/** Swiss rate notation: whole francs as "CHF 280.–", fractional amounts via formatCurrency. */
const formatRate = (value: number): string => {
  const n = Number(value);
  return Number.isInteger(n) ? `CHF ${n.toLocaleString("de-CH")}.–` : formatCurrency(n);
};

/** m²/m³ measures without artificial decimals: 110.00 → "110", 3.5 → "3.5". */
const formatMeasure = (value: number): string =>
  Number(value).toLocaleString("de-CH", { maximumFractionDigits: 1 });

const PersonIcon = ({ color }: { color: string }) => (
  <Svg width={8} height={8} viewBox="0 0 10 10" style={{ marginRight: 3 }}>
    <Circle cx={5} cy={3.1} r={1.9} fill="none" stroke={color} strokeWidth={1.1} />
    <Path d="M1.7 9.3 C1.7 7 3.1 6 5 6 C6.9 6 8.3 7 8.3 9.3" fill="none" stroke={color} strokeWidth={1.1} />
  </Svg>
);

const TruckIcon = ({ color }: { color: string }) => (
  <Svg width={11} height={8} viewBox="0 0 13 10" style={{ marginRight: 3 }}>
    <Rect x={0.8} y={1.6} width={6.6} height={4.8} fill="none" stroke={color} strokeWidth={1.1} />
    <Path d="M7.4 3.2 H10.2 L11.9 5.2 V6.4 H7.4" fill="none" stroke={color} strokeWidth={1.1} />
    <Circle cx={3.2} cy={8.2} r={1.2} fill="none" stroke={color} strokeWidth={1.1} />
    <Circle cx={9.7} cy={8.2} r={1.2} fill="none" stroke={color} strokeWidth={1.1} />
  </Svg>
);

const EffortLine = ({ effort }: { effort: OfferItemEffortMeta }) => (
  <View style={metaStyles.effortRow}>
    <View style={metaStyles.effortItems}>
      {isSet(effort.crew) ? (
        <View style={metaStyles.effortItem}>
          <PersonIcon color={COLORS.text.secondary} />
          <Text style={metaStyles.effortText}>{`${effort.crew} Mitarbeiter`}</Text>
        </View>
      ) : null}
      {isSet(effort.vehicles) ? (
        <View style={metaStyles.effortItem}>
          <TruckIcon color={COLORS.text.secondary} />
          <Text style={metaStyles.effortText}>
            {`${effort.vehicles}${effort.vehicle_type ? ` ${effort.vehicle_type}` : ""}`}
          </Text>
        </View>
      ) : null}
    </View>
    {isSet(effort.hourly_rate) ? (
      <View style={metaStyles.rateBadge}>
        <Text style={metaStyles.rateBadgeText}>{`à ${formatRate(Number(effort.hourly_rate))}/Stunde`}</Text>
      </View>
    ) : null}
  </View>
);

const AreaLine = ({ area }: { area: OfferItemAreaMeta }) => {
  const parts = [
    area.object_type?.trim() || null,
    isSet(area.area_m2) ? `ca. ${formatMeasure(Number(area.area_m2))} m²` : null,
  ].filter(Boolean) as string[];
  return (
    <View>
      <View style={metaStyles.metaLine}>
        <Text style={metaStyles.metaLabel}>OBJEKT</Text>
        <Text style={metaStyles.metaText}>{parts.join(", ")}</Text>
      </View>
      {area.abnahmegarantie ? (
        <Text style={metaStyles.metaNote}>inkl. Abnahme mit der Verwaltung</Text>
      ) : null}
    </View>
  );
};

const VolumeLine = ({ volume }: { volume: OfferItemVolumeMeta }) => {
  const unitLabel = volume.rate_unit === "monthly" ? "Monat" : "m³";
  const vol =
    isSet(volume.volume_m3)
      ? `ca. ${formatMeasure(Number(volume.volume_m3))} m³`
      : isSet(volume.volume_min_m3) && isSet(volume.volume_max_m3)
        ? `ca. ${formatMeasure(Number(volume.volume_min_m3))}–${formatMeasure(Number(volume.volume_max_m3))} m³`
        : null;
  return (
    <View>
      {isSet(volume.rate) ? (
        <View style={metaStyles.metaLine}>
          <Text style={metaStyles.metaLabel}>TARIF</Text>
          <Text style={metaStyles.metaText}>{`${formatRate(Number(volume.rate))}/${unitLabel}`}</Text>
        </View>
      ) : null}
      {vol ? <Text style={metaStyles.metaNote}>{`geschätztes Volumen ${vol}`}</Text> : null}
    </View>
  );
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
  // Ansatz + Einheit fuer rate-Posten aus effort/volume-Meta bzw. unit_price ableiten.
  const rateUnit =
    item.volumeMeta?.rate_unit === "monthly" ? "Monat" : (item.unit?.trim() || "Std.");
  const rateValue = isSet(item.effortMeta?.hourly_rate)
    ? Number(item.effortMeta?.hourly_rate)
    : isSet(item.volumeMeta?.rate)
      ? Number(item.volumeMeta?.rate)
      : item.price;
  // SINGLE SOURCE fuer die Betragsdarstellung (fixed | rate | range | free).
  const display = itemAmountDisplay({
    priceType: item.priceType ?? "",
    amountBasis: toAmountBasis(item.amountBasis),
    quantity: item.quantity,
    unitPrice: rateValue,
    unit: rateUnit,
    timeEstimate: te ?? null,
    total: item.total,
  });
  // Meta lines render only when they carry actual content (embeds can exist all-null).
  const effort =
    item.effortMeta &&
    (isSet(item.effortMeta.crew) ||
      isSet(item.effortMeta.vehicles) ||
      isSet(item.effortMeta.hourly_rate))
      ? item.effortMeta
      : null;
  const area =
    item.areaMeta && (item.areaMeta.object_type || isSet(item.areaMeta.area_m2))
      ? item.areaMeta
      : null;
  const volume =
    item.volumeMeta &&
    (isSet(item.volumeMeta.rate) ||
      isSet(item.volumeMeta.volume_m3) ||
      isSet(item.volumeMeta.volume_min_m3))
      ? item.volumeMeta
      : null;
  // Menge/Einzel context, folded into a small sub-line under the description.
  const sub =
    display.kind === "range" && te
      ? `${te.minHours}–${te.maxHours} Std. à ${formatCurrency(te.hourlyRate)}/Std.`
      : display.kind === "rate"
        ? null // Preisspalte zeigt den Ansatz; keine irrefuehrende Menge-Zeile
        : item.priceType === "pauschale"
          ? "Pauschal"
          : item.quantity !== 1
            ? `${formatQuantityUnit(item.quantity, item.unit)} à ${formatCurrency(item.price)}`
            : formatQuantityUnit(item.quantity, item.unit);

  return (
    <View style={cardStyles.posRow} wrap={false}>
      <View style={cardStyles.posLeft}>
        <Text style={cardStyles.posDesc}>{item.description}</Text>
        {/* Dedup (P2c): effort meta REPLACES the Menge/Einzel sub-line — the hourly rate
            lives in its badge and the hours already sit in the price column (hourlyRange),
            so nothing is shown twice. Without effort meta the old sub-line stays as-is. */}
        {effort ? (
          <EffortLine effort={effort} />
        ) : sub ? (
          <Text style={cardStyles.posSub}>{sub}</Text>
        ) : null}
        {area ? <AreaLine area={area} /> : null}
        {volume ? <VolumeLine volume={volume} /> : null}
      </View>
      <View style={cardStyles.posRight}>
        {display.kind === "range" ? (
          <>
            <Text style={[cardStyles.posPrice, { color: "#B45309" }]}>{formatRate(display.min)}</Text>
            {/* "bis", not a dash — a stacked leading "–" reads as subtraction/negative */}
            <Text style={[cardStyles.posPriceSub, { color: "#B45309" }]}>bis {formatRate(display.max)}</Text>
          </>
        ) : display.kind === "rate" ? (
          <>
            {/* rate: Einheitspreis statt Betrag — Menge/Dauer unbestimmt, nicht in der Summe */}
            <Text style={cardStyles.posPrice}>{formatRate(display.unitPrice)}</Text>
            <Text style={cardStyles.posPriceSub}>{`/ ${display.unit}`}</Text>
          </>
        ) : (
          <Text style={cardStyles.posPrice}>
            {formatRate(display.kind === "fixed" ? display.amount : item.total)}
          </Text>
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
    borderColor: COLORS.gray[100],
    borderRadius: 6,
  },
  cardBand: {
    backgroundColor: DARK,
    paddingVertical: 7,
    paddingHorizontal: SPACING.sm,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBandDate: {
    color: "#CBD5E1",
    fontSize: FONT_SIZES.xs,
  },
  cardBandText: {
    color: "#FFFFFF",
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    letterSpacing: 1.2,
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
  posPrice: { fontSize: FONT_SIZES.base, fontWeight: 700, color: COLORS.text.primary },
  posPriceSub: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },
});

/** Active offer-level discount or null — gates the Rabatt/Total-exkl. rows. */
const styleDiscount = (data: OfferData): number | null =>
  data.pricing.discountPercent && data.pricing.discountPercent > 0
    ? data.pricing.discountPercent
    : null;

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

  // Per-service dates: as soon as ONE group carries its own date, every band shows its
  // date (own value, fallback = offer-level executionDate) and the global TERMIN cell
  // is suppressed (AddressComparison) — otherwise the same info would appear twice,
  // once under a wrong label. No group date → exact legacy rendering.
  const hasAnyGroupDate = items.some((it) => it.scheduledDate);
  const bandDate = (group: (typeof groups)[number]): string | null => {
    if (!hasAnyGroupDate) return null;
    const sched = groupScheduled(group.items);
    const date = sched?.date ?? data.executionDate;
    if (!date) return null;
    const st = sched?.startTime?.slice(0, 5);
    const et = sched?.endTime?.slice(0, 5);
    const time = st && et ? ` · ${st}–${et} Uhr` : st ? ` · ab ${st} Uhr` : "";
    return `${serviceTerminLabel(group.serviceType)}: ${formatDate(date)}${time}`;
  };

  return (
    <View style={styles.container}>
      {groups.map((group, gi) => {
        const billable = group.items.filter((it) => !isFreeItem(it.priceType));
        const leistungLines = buildLeistungLines(group.items);
        // Item-/Service-level Kostendach: greift, sobald ein Posten dieser Gruppe einen Cap traegt.
        const groupCap = billable.map((it) => it.kostendachMax).find(isSet) ?? null;
        // Ansatz fuer die Std-Ableitung im Kostendach: effort/volume-Meta ODER (UI-erstellte
        // rate-Posten ohne Meta) der Einzelpreis des rate-Postens (= Ansatz in unit_price).
        const groupRate =
          billable
            .map((it) => it.effortMeta?.hourly_rate ?? it.volumeMeta?.rate ?? (toAmountBasis(it.amountBasis) === "rate" ? it.price : null))
            .find(isSet) ?? null;
        return (
          // wrap={false}: keep the whole card together on one page (group-aware chunking in
          // P2b-i already sizes groups to fit; rare oversized groups still degrade gracefully).
          <View key={`group-${gi}`} style={cardStyles.card} wrap={false}>
            <View style={cardStyles.cardBand}>
              <Text style={cardStyles.cardBandText}>{group.label.toUpperCase()}</Text>
              {bandDate(group) ? <Text style={cardStyles.cardBandDate}>{bandDate(group)}</Text> : null}
            </View>
            <View style={cardStyles.cardBody}>
              {billable.map((item, idx) => (
                <ItemRow key={`${item.description}-${idx}`} item={item} />
              ))}
              {leistungLines.length > 0 ? (
                <LeistungsumfangBlock lines={leistungLines} accent={accent} />
              ) : null}
              {/* Service-block Kostendach: nur wenn ein rate-Posten dieser Gruppe ein Item-Cap traegt.
                  Das globale offer-level Kostendach (unten) rendert dann als Fallback nicht mehr. */}
              {isSet(groupCap) ? (
                <View
                  style={[styles.priceModelBox, { borderColor: "#FDE68A", backgroundColor: "#FFFBEB", marginTop: 8 }]}
                  wrap={false}
                >
                  <View style={styles.priceModelRow}>
                    <Text style={[styles.priceModelLabel, { color: "#B45309" }]}>Kostendach:</Text>
                    <Text style={[styles.priceModelValue, { color: "#B45309" }]}>
                      {isSet(groupRate) && Number(groupRate) > 0
                        ? `Stundenansatz ${formatRate(Number(groupRate))}/Std. — max. CHF ${Number(groupCap).toLocaleString("de-CH")} (${+(Number(groupCap) / Number(groupRate)).toFixed(1)} Std.)`
                        : `max. CHF ${Number(groupCap).toLocaleString("de-CH")}`}
                    </Text>
                  </View>
                  <Text style={[styles.priceModelNote, { color: "#92400E" }]}>
                    {`Sie zahlen maximal CHF ${Number(groupCap).toLocaleString("de-CH")}, unabhängig vom tatsächlichen Zeitaufwand.`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* rate-Posten → keine Aggregatsumme; Hinweis links, Gültigkeit rechts (design v2). */}
      {showTotalsBlock && data.pricing.hasRateItem ? (
        <View style={styles.rateNoteRow} wrap={false}>
          <Text style={styles.rateNoteText}>{RATE_AGGREGATE_NOTE}</Text>
          {data.validUntil ? (
            <Text style={styles.rateNoteValid}>{`Angebot gültig bis ${formatDate(data.validUntil)}`}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Totals block (nur ohne rate-Posten) */}
      {showTotalsBlock && !data.pricing.hasRateItem ? (
        <View style={styles.totalsOuter} wrap={false}>
          <View style={styles.totalsBox}>
            <>
            {/* Zwischensumme */}
            {data.pricing.maxSubtotal !== null ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Zwischensumme:</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.totalValue, { color: "#B45309" }]}>
                    {formatCurrency(data.pricing.subtotal)}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                    bis {formatCurrency(data.pricing.maxSubtotal)}
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

            {/* Rabatt + Total exkl. MwSt — only when an offer-level discount is active
                (new_offer.png pattern); without a discount the block is absent and the
                layout is byte-identical to before (P3b-2c-ii). */}
            {isSet(styleDiscount(data)) ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {`Rabatt ${Number(data.pricing.discountPercent).toLocaleString("de-CH")} %`}
                  </Text>
                  {isSet(data.pricing.maxDiscountAmount) ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.totalValue, { color: "#B45309" }]}>
                        {`- ${formatCurrency(data.pricing.discountAmount ?? 0)}`}
                      </Text>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                        bis {`- ${formatCurrency(data.pricing.maxDiscountAmount)}`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.totalValue}>{`- ${formatCurrency(data.pricing.discountAmount ?? 0)}`}</Text>
                  )}
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total exkl. MwSt</Text>
                  {isSet(data.pricing.maxTaxableBase) ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.totalValue, { color: "#B45309" }]}>
                        {formatCurrency(data.pricing.taxableBase ?? 0)}
                      </Text>
                      <Text style={{ fontSize: FONT_SIZES.xs, color: "#B45309" }}>
                        bis {formatCurrency(data.pricing.maxTaxableBase)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.totalValue}>{formatCurrency(data.pricing.taxableBase ?? 0)}</Text>
                  )}
                </View>
              </>
            ) : null}

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
                      bis {formatCurrency(data.pricing.maxMwstAmount)}
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
                      bis {formatCurrency(data.pricing.maxTotal)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.grandTotalValue, { color: "#FFFFFF" }]}>
                    {formatCurrency(data.pricing.total)}
                  </Text>
                )}
              </View>
            </View>
            </>

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
                {`Angebot gültig bis ${formatDate(data.validUntil)}`}
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

      {/* Price model: Kostendach (offer-level) — nur als FALLBACK, wenn KEIN Posten ein
          item-/service-level Kostendach traegt (dann rendert es der Service-Block oben). */}
      {showTotalsBlock &&
        data.pricing.priceModel === "kostendach" &&
        data.pricing.hourlyRate !== null &&
        data.pricing.kostendachMax !== null &&
        !items.some((it) => isSet(it.kostendachMax)) && (
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
