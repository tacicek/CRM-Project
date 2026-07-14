import { StyleSheet, Text, View, Svg, Path } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData, AddressDetails } from "../types/offer.types";
import { getServiceLayout } from "../utils/serviceLayout";
import { formatFloorLabel } from "@/lib/floorUtils";
import { formatDate } from "../utils/formatters";
import { documentI18nFor } from "@/i18n/documentLocale";
import { getYesNo } from "@/i18n/domain";
import type { Locale } from "@/i18n/locale";
import type { Translator } from "@/i18n/translator";

const ORANGE = "#F97316";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
    flexDirection: "row",
    alignItems: "stretch",
  },
  // Address cards — separate rounded cards, accent header band
  addrCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 6,
    overflow: "hidden",
  },
  addrHeader: {
    paddingVertical: 5,
    paddingHorizontal: SPACING.sm,
  },
  addrHeaderText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  addrBody: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  addrStreet: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  addrCity: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 3,
  },
  addrMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  // Arrow divider — accent circle with white arrow
  arrowDivider: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // Meta cells (TERMIN, FLÄCHE) — free-standing, no border (design v2)
  metaSection: {
    flexDirection: "column",
    width: 96,
    justifyContent: "center",
    paddingLeft: SPACING.sm,
  },
  metaCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.text.secondary,
    letterSpacing: 1,
    marginBottom: 3,
    textAlign: "center",
  },
  metaValue: {
    fontSize: FONT_SIZES.lg,
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

const formatAddressLines = (t: Translator, locale: Locale, addr?: AddressDetails) => {
  if (!addr) return { street: "", city: "", meta: [] as string[] };
  const street = addr.street || "";
  const city = [addr.plz, addr.city].filter(Boolean).join(" ");
  const meta: string[] = [];
  if (typeof addr.rooms === "number") meta.push(`${addr.rooms} ${t("doc.address.roomsShort")}`);
  const floorLabel = formatFloorLabel(addr.floor);
  if (floorLabel) meta.push(floorLabel);
  // Tri-state: undefined = unknown -> omitted; an explicit false is INFORMATION for the
  // mover (old Bernova template shows Ja/Nein rows) and must be visible, not hidden.
  if (addr.hasLift === true) meta.push(t("doc.address.lift"));
  else if (addr.hasLift === false) meta.push(t("doc.address.noLift"));
  if (typeof addr.hasEstrich === "boolean")
    meta.push(`${t("doc.address.attic")}: ${getYesNo(addr.hasEstrich, locale)}`);
  if (typeof addr.hasKeller === "boolean")
    meta.push(`${t("doc.address.cellar")}: ${getYesNo(addr.hasKeller, locale)}`);
  // Building type is a Swiss abbreviation code (MFH/EFH/Hochhaus), not prose — kept as stored.
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

  const { t, locale } = documentI18nFor(data.locale);
  const layout = getServiceLayout(data.service.type, locale);
  const accent = data.company.primaryColor || ORANGE;
  const showRoute = Boolean(from && to);

  const fromFmt = formatAddressLines(t, locale, from);
  const toFmt = formatAddressLines(t, locale, to);

  // Meta cells — only numeric/defined values (rooms: use == null, NOT !== null to catch undefined too)
  const metaCells: { label: string; value: string; unit?: string }[] = [];

  // Per-service dates: when any item group carries its own date, the per-group band in
  // the ServiceTable shows the dates — the global TERMIN cell would repeat the first one
  // under a generic label, so it is suppressed.
  const hasGroupDates = (data.items ?? []).some((it) => it.scheduledDate);
  if (data.executionDate && !hasGroupDates) {
    // Time below the date (old template parity: "01.07.2026 08:00 Uhr").
    // DB time columns may carry seconds ("08:00:00") — display as HH:MM.
    const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : null);
    const start = hhmm(data.executionStartTime);
    const end = hhmm(data.executionEndTime);
    const time =
      start && end
        ? t("doc.time.fromUntil", { start, end })
        : start
          ? t("doc.time.from", { start })
          : undefined;
    metaCells.push({
      label: t("doc.address.appointment"),
      value: formatDate(data.executionDate, locale),
      unit: time,
    });
  }

  // typeof-Guard deckt null UND undefined bereits ab (typeof null === "object"),
  // ein zusätzlicher Null-Check ist daher überflüssig.
  const rooms = from?.rooms ?? to?.rooms;
  if (typeof rooms === "number") {
    metaCells.push({
      label: t("doc.address.area"),
      value: String(rooms),
      unit: t("doc.address.roomsShort"),
    });
  }

  return (
    <View style={styles.container}>
      {/* FROM address */}
      <View style={styles.addrCard}>
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

      {/* Arrow — accent circle, white SVG arrow (font-unabhängig; Helvetica rendert U+2192 nicht) */}
      {showRoute ? (
        <View style={styles.arrowDivider}>
          <View style={[styles.arrowCircle, { backgroundColor: accent }]}>
            <Svg width={11} height={9} viewBox="0 0 16 12">
              <Path
                d="M2 6 H12 M8 2.5 L12.5 6 L8 9.5"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
        </View>
      ) : null}

      {/* TO address — only when both exist */}
      {showRoute ? (
        <View style={styles.addrCard}>
          <View style={[styles.addrHeader, { backgroundColor: accent }]}>
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

      {/* Meta cells — TERMIN, FLÄCHE (free-standing, right of the cards) */}
      {metaCells.length > 0 ? (
        <View style={styles.metaSection}>
          {metaCells.map((cell) => (
            <View key={cell.label} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{cell.label}</Text>
              <Text style={styles.metaValue}>{cell.value}</Text>
              {cell.unit ? <Text style={styles.metaUnit}>{cell.unit}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
