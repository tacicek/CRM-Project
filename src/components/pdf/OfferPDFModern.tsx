import { Document, Image, Link, Page, Path, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { Footer, PDF_FOOTER_RESERVE_PT } from "./components/Footer";
import { BlindOfferteDisclaimer } from "./components/BlindOfferteDisclaimer";
import { TimeEstimateBlock } from "./components/TimeEstimateBlock";
import { AgbPdfSection } from "./AgbPdfSection";
import { AddressDetails, OfferData } from "./types/offer.types";
import { FONT_SIZES } from "./styles/constants";
import { formatCurrency, formatDate, formatMeasure, formatRoundedCurrency } from "./utils/formatters";
import { getServiceLayout } from "./utils/serviceLayout";
import { lightenHex } from "./utils/colors";
import { formatFloorLabel } from "@/lib/floorUtils";
import { isFreeItem, itemAmountDisplay, toAmountBasis } from "@/lib/offerPricing";
import {
  groupItemsByService,
  groupScheduled,
  type ServiceGroup as ServiceGroupOf,
} from "@/lib/offerServiceType";
import { documentI18nFor } from "@/i18n/documentLocale";
import { getAppointmentLabel, getServiceLabel, getYesNo } from "@/i18n/domain";
import { formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/locale";
import type { Translator } from "@/i18n/translator";

// ─── Modern (v2) Offerte-Layout ───────────────────────────────────────────────
// Zweite, von der Firma in den Einstellungen wählbare PDF-Vorlage (companies.pdf_template
// = 'modern'). Gestaltung nach der Claude-Design-Vorlage "Offerte PDF v2":
// heller Kopf mit zweifarbigem OFFERTE-Wortzeichen, "Auf einen Blick"-Box,
// Adresskarten mit Akzent-Headern, dunkle Service-Bänder mit Leistungsumfang,
// Kostendach-Hinweis, Auftragsbestätigung mit QR-Panel und Zusammenfassung.
// Datenmodell identisch zur Standard-Vorlage (OfferData) — nur die Präsentation ändert.

const DARK = "#1A1A1A";
const TEAL_FALLBACK = "#0F766E";
const AMBER = { bg: "#FDF6E4", border: "#F0DFB4", title: "#B45309", text: "#92400E" } as const;
const GRAY = { border: "#E5E7EB", light: "#F9FAFB", label: "#6B7280", text: "#111827" } as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: PDF_FOOTER_RESERVE_PT,
    fontSize: FONT_SIZES.base,
    fontFamily: "Helvetica",
    color: GRAY.text,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 12 },
  logo: { width: 34, height: 34, borderRadius: 6, marginRight: 9 },
  companyName: { fontSize: 13, fontWeight: 700, color: GRAY.text },
  companyAddress: { fontSize: FONT_SIZES.xs, fontWeight: 700, marginTop: 2, lineHeight: 1.35 },
  headerRight: { alignItems: "flex-end" },
  wordmarkRow: { flexDirection: "row", marginBottom: 4 },
  wordmark: { fontSize: 19, fontWeight: 700, letterSpacing: 1 },
  headerMetaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 1.5 },
  headerMetaLabel: { fontSize: FONT_SIZES.sm, color: GRAY.label, marginRight: 4 },
  headerMetaValue: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: GRAY.text },
  headerRule: { height: 2.5, marginTop: 10, marginBottom: 14, borderRadius: 2 },
  // ── "Auf einen Blick" ────────────────────────────────────────────────────────
  glanceBox: { borderRadius: 6, borderWidth: 1, padding: 12, marginBottom: 14 },
  glanceLabel: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, marginBottom: 8 },
  glanceRow: { flexDirection: "row", alignItems: "flex-start" },
  glanceCol: { flex: 1.4, paddingRight: 10 },
  glanceColMid: { flex: 0.9, paddingRight: 10 },
  glanceColRight: { flex: 1.1, alignItems: "flex-end" },
  glanceFieldLabel: { fontSize: FONT_SIZES.xs, color: GRAY.label, marginBottom: 2 },
  glanceName: { fontSize: 12, fontWeight: 700, color: GRAY.text, marginBottom: 3 },
  glanceRoute: { fontSize: FONT_SIZES.sm, color: GRAY.label, lineHeight: 1.4 },
  glanceTermin: { fontSize: 12, fontWeight: 700, color: GRAY.text },
  glanceHeadline: { fontSize: 15, fontWeight: 700, textAlign: "right" },
  glanceNote: {
    fontSize: FONT_SIZES.xs,
    color: GRAY.label,
    lineHeight: 1.45,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  // ── Auftraggeber / Offerte-Details ──────────────────────────────────────────
  partiesRow: { flexDirection: "row", marginBottom: 14 },
  partiesCol: { flex: 1, paddingRight: 12 },
  sectionMicroLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1,
    color: GRAY.label,
    marginBottom: 5,
  },
  partyName: { fontSize: FONT_SIZES.base, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: FONT_SIZES.sm, color: GRAY.label, lineHeight: 1.45 },
  detailRow: { flexDirection: "row", marginBottom: 2, flexWrap: "wrap" },
  detailLabel: { fontSize: FONT_SIZES.sm, color: GRAY.label, marginRight: 4 },
  detailValue: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: GRAY.text, flexShrink: 1 },
  // ── Adresskarten ────────────────────────────────────────────────────────────
  addressesRow: { flexDirection: "row", alignItems: "stretch", marginBottom: 14 },
  addressCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: GRAY.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  addressHeader: { paddingVertical: 6, paddingHorizontal: 10 },
  addressHeaderText: { fontSize: FONT_SIZES.xs, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1 },
  addressBody: { paddingHorizontal: 10, paddingVertical: 4 },
  addressLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  addressLineLabel: { fontSize: FONT_SIZES.sm, color: GRAY.label },
  addressLineValue: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: GRAY.text, textAlign: "right", flexShrink: 1, paddingLeft: 8 },
  arrowDivider: { width: 30, alignItems: "center", justifyContent: "center" },
  arrowCircle: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  // ── Service-Sektionen ───────────────────────────────────────────────────────
  serviceSection: { marginBottom: 12 },
  serviceBand: {
    backgroundColor: DARK,
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceBandText: { fontSize: FONT_SIZES.base, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1.2 },
  serviceBandDate: { fontSize: FONT_SIZES.xs, color: "#CBD5E1" },
  serviceBody: { paddingHorizontal: 6, paddingTop: 6 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  itemLeft: { flex: 1, paddingRight: 12 },
  itemDesc: { fontSize: 10.5, fontWeight: 700, color: GRAY.text, lineHeight: 1.3 },
  itemSub: { fontSize: FONT_SIZES.xs, color: GRAY.label, marginTop: 1.5 },
  itemRight: { minWidth: 80, alignItems: "flex-end" },
  itemPrice: { fontSize: 10.5, fontWeight: 700, color: GRAY.text },
  itemPriceSub: { fontSize: FONT_SIZES.xs, color: GRAY.label, marginTop: 1 },
  leistungTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1,
    color: GRAY.label,
    marginTop: 4,
    marginBottom: 4,
  },
  leistungLine: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2.5 },
  leistungText: { flex: 1, fontSize: FONT_SIZES.sm, color: GRAY.text, lineHeight: 1.35 },
  leistungSuffix: { color: GRAY.label },
  capBox: {
    backgroundColor: AMBER.bg,
    borderWidth: 1,
    borderColor: AMBER.border,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  capTitle: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: AMBER.title, marginBottom: 2 },
  capNote: { fontSize: FONT_SIZES.xs, color: AMBER.text, lineHeight: 1.4 },
  // ── Summen / Aufwand-Hinweis ────────────────────────────────────────────────
  rateNote: { fontSize: FONT_SIZES.sm, color: GRAY.label, lineHeight: 1.5, marginTop: 2, marginBottom: 12 },
  totalsOuter: { alignItems: "flex-end", marginTop: 2, marginBottom: 12 },
  totalsBox: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: FONT_SIZES.sm, color: GRAY.label },
  totalValue: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: GRAY.text },
  totalDivider: { height: 1, backgroundColor: GRAY.border, marginVertical: 2 },
  grandTotalBox: {
    backgroundColor: DARK,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: FONT_SIZES.sm, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1 },
  grandTotalValue: { fontSize: FONT_SIZES.lg, fontWeight: 700, color: "#FFFFFF" },
  validUntilNote: { fontSize: FONT_SIZES.xs, color: GRAY.label, textAlign: "right", marginTop: 4 },
  // ── Info-Boxen (Zahlung / Versicherung / Bemerkungen) ───────────────────────
  infoBox: { borderRadius: 5, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10 },
  infoBoxAccentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  infoBoxTitle: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, marginBottom: 3 },
  infoBoxText: { fontSize: FONT_SIZES.sm, color: GRAY.text, lineHeight: 1.45 },
  // ── Auftragsbestätigung ─────────────────────────────────────────────────────
  confirmCard: {
    borderWidth: 1,
    borderColor: GRAY.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  confirmTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  confirmRow: { flexDirection: "row", alignItems: "flex-start" },
  confirmLeft: { flex: 1, paddingRight: 14 },
  confirmText: { fontSize: FONT_SIZES.sm, color: GRAY.text, lineHeight: 1.5 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  signatureCol: { width: "47%" },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: "#374151", marginBottom: 4, marginTop: 18 },
  signatureLabel: { fontSize: FONT_SIZES.xs, color: GRAY.label, lineHeight: 1.4 },
  signatureParty: { fontSize: FONT_SIZES.xs, fontWeight: 700, color: GRAY.text, marginTop: 1 },
  qrPanel: { width: 140, borderRadius: 6, padding: 10, alignItems: "center" },
  qrPanelTitle: { fontSize: 7, fontWeight: 700, letterSpacing: 0.8, marginBottom: 7, textAlign: "center" },
  qrFrame: { backgroundColor: "#FFFFFF", borderRadius: 4, padding: 5 },
  qrImage: { width: 78, height: 78 },
  qrCaption: { fontSize: 7, color: GRAY.label, marginTop: 6, marginBottom: 7, textAlign: "center" },
  qrButton: {
    color: "#FFFFFF",
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    textAlign: "center",
    width: "100%",
    textDecoration: "none",
  },
  // ── Zusammenfassung ─────────────────────────────────────────────────────────
  summaryBox: { borderRadius: 6, borderWidth: 1, padding: 12, marginBottom: 4 },
  summaryTitle: { fontSize: 11, fontWeight: 700, marginBottom: 5 },
  summaryLine: { fontSize: FONT_SIZES.sm, color: GRAY.text, lineHeight: 1.5 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isSet = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;

/**
 * Einheit eines rate-Postens als "pro …"-Label (Preiszeile rechts).
 * Bekannte Einheiten kommen aus dem Katalog; alles andere ist frei erfasster DB-Text und
 * wird unverändert in "pro {unit}" eingesetzt.
 */
const perUnitLabel = (unit: string, t: Translator): string => {
  const u = unit.trim().toLowerCase();
  if (!u) return "";
  if (u.startsWith("std") || u.includes("stunde")) return t("domain.unit.perHour");
  if (u === "m³" || u === "m3") return t("domain.unit.perM3");
  if (u === "m²" || u === "m2") return t("domain.unit.perM2");
  if (u.includes("monat")) return t("domain.unit.perMonth");
  return t("domain.unit.perUnit", { unit: unit.trim() });
};

/** Kurzform der Einheit für Fliesstext ("ab CHF 45.–/m³"). */
const shortUnit = (unit: string, t: Translator): string => {
  const u = unit.trim().toLowerCase();
  if (u.startsWith("std") || u.includes("stunde")) return t("domain.unit.hour");
  if (u === "m3") return "m³";
  if (u === "m2") return "m²";
  return unit.trim() || t("domain.unit.hour");
};

type PdfItem = OfferData["items"][number];

/** Ansatz + Einheit eines Postens (identische Ableitung wie ServiceTable.ItemRow). */
const itemDisplay = (item: PdfItem, t: Translator) => {
  const rateUnit =
    item.volumeMeta?.rate_unit === "monthly"
      ? t("domain.unit.month")
      : (item.unit?.trim() || t("domain.unit.hour"));
  const rateValue = isSet(item.effortMeta?.hourly_rate)
    ? Number(item.effortMeta?.hourly_rate)
    : isSet(item.volumeMeta?.rate)
      ? Number(item.volumeMeta?.rate)
      : item.price;
  return itemAmountDisplay({
    priceType: item.priceType ?? "",
    amountBasis: toAmountBasis(item.amountBasis),
    quantity: item.quantity,
    unitPrice: rateValue,
    unit: rateUnit,
    timeEstimate: item.timeEstimate ?? null,
    total: item.total,
  });
};

type ServiceGroup = ServiceGroupOf<PdfItem>;

/** Item-level Kostendach der Gruppe (erster gesetzter Wert unter den zahlbaren Posten). */
const groupCap = (group: ServiceGroup): number | null =>
  group.items
    .filter((it) => !isFreeItem(it.priceType))
    .map((it) => it.kostendachMax)
    .find(isSet) ?? null;

/** Ansatz für die Std-Ableitung im Kostendach (effort/volume-Meta oder rate-Einzelpreis). */
const groupRate = (group: ServiceGroup): number | null =>
  group.items
    .filter((it) => !isFreeItem(it.priceType))
    .map((it) =>
      it.effortMeta?.hourly_rate ??
      it.volumeMeta?.rate ??
      (toAmountBasis(it.amountBasis) === "rate" ? it.price : null),
    )
    .find(isSet) ?? null;

/** Kompakter Preis-Fingerprint einer Gruppe für den "Zzgl. …"-Satz der Blick-Box. */
const summarizeGroup = (group: ServiceGroup, t: Translator, locale: Locale): string | null => {
  const billable = group.items.filter((it) => !isFreeItem(it.priceType));
  if (billable.length === 0) return null;
  const label = getServiceLabel(group.serviceType, locale);
  const cap = groupCap(group);
  if (isSet(cap)) {
    return `${label} ${t("doc.offer.costCapMax", { cap: formatMeasure(Number(cap), locale) })}`;
  }
  let fixedSum = 0;
  let hasRange = false;
  let rate: { value: number; unit: string } | null = null;
  for (const item of billable) {
    const d = itemDisplay(item, t);
    if (d.kind === "fixed") fixedSum += d.amount;
    if (d.kind === "range") {
      fixedSum += d.min;
      hasRange = true;
    }
    if (d.kind === "rate" && !rate) rate = { value: d.unitPrice, unit: shortUnit(d.unit, t) };
  }
  const fixedPart =
    fixedSum > 0
      ? `${hasRange ? t("doc.offer.from") : ""}${formatRoundedCurrency(fixedSum, locale)}`
      : null;
  const ratePart = rate
    ? `${t("doc.offer.from")}${formatRoundedCurrency(rate.value, locale)}/${rate.unit}`
    : null;
  if (fixedPart && ratePart) return `${label} ${fixedPart} ${t("doc.offer.plus")}${ratePart}`;
  if (fixedPart) return `${label} ${fixedPart}`;
  if (ratePart) return `${label} ${ratePart}`;
  return null;
};

/** Leistungsumfang-Zeilen einer Gruppe. Freie Posten (inkl/optional) erscheinen hier
    mit Zusatz statt in der Preisliste — gleiche Quellen-Priorität wie ServiceTable. */
const buildLeistungLines = (
  group: ServiceGroup,
  t: Translator
): { text: string; suffix?: string }[] => {
  const lines: { text: string; suffix?: string }[] = [];
  for (const item of group.items) {
    if (item.leistung && item.leistung.length > 0) {
      for (const l of [...item.leistung].sort((a, b) => a.position - b.position)) {
        if (l.text?.trim()) lines.push({ text: l.text.trim() });
      }
    } else if (item.details && item.details.length > 0) {
      for (const d of item.details) {
        const clean = d.replace(/^[•·-]\s*/, "").trim();
        if (clean) lines.push({ text: clean });
      }
    } else if (isFreeItem(item.priceType) && item.description?.trim()) {
      lines.push({
        text: item.description.trim(),
        suffix:
          item.priceType === "optional"
            ? t("domain.priceModel.onRequest")
            : t("domain.priceModel.included"),
      });
    }
  }
  return lines;
};

const CheckMark = ({ color }: { color: string }) => (
  <Svg width={9} height={9} viewBox="0 0 10 10" style={{ marginRight: 5, marginTop: 2 }}>
    <Polyline points="1.5,5.5 4,8 8.5,2.2" fill="none" stroke={color} strokeWidth={1.6} />
  </Svg>
);

const ArrowRight = ({ color, size = 10 }: { color: string; size?: number }) => (
  <Svg width={size} height={size * 0.75} viewBox="0 0 16 12">
    <Path
      d="M2 6 H12 M8 2.5 L12.5 6 L8 9.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

// ─── Adresskarte ──────────────────────────────────────────────────────────────

const addressRows = (
  addr: AddressDetails,
  t: Translator,
  locale: Locale
): { label: string; value: string }[] => {
  const rows: { label: string; value: string }[] = [];
  if (addr.street) rows.push({ label: t("doc.address.street"), value: addr.street });
  const city = [addr.plz, addr.city].filter(Boolean).join(" ");
  if (city) rows.push({ label: t("doc.address.plzCity"), value: city });
  const floor = formatFloorLabel(addr.floor);
  if (floor) rows.push({ label: t("doc.address.floor"), value: floor });
  if (addr.hasLift === true)
    rows.push({ label: t("doc.address.lift"), value: getYesNo(true, locale) });
  else if (addr.hasLift === false)
    rows.push({ label: t("doc.address.lift"), value: t("doc.address.noLift") });
  if (typeof addr.rooms === "number")
    rows.push({ label: t("doc.address.rooms"), value: String(addr.rooms) });
  return rows;
};

const AddressCard = ({
  title,
  addr,
  accent,
  t,
  locale,
}: {
  title: string;
  addr: AddressDetails;
  accent: string;
  t: Translator;
  locale: Locale;
}) => (
  <View style={styles.addressCard}>
    <View style={[styles.addressHeader, { backgroundColor: accent }]}>
      <Text style={styles.addressHeaderText}>{title.toUpperCase()}</Text>
    </View>
    <View style={styles.addressBody}>
      {addressRows(addr, t, locale).map((row) => (
        <View key={row.label} style={styles.addressLine}>
          <Text style={styles.addressLineLabel}>{row.label}</Text>
          <Text style={styles.addressLineValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ─── Service-Sektion ──────────────────────────────────────────────────────────

const ItemRowModern = ({ item, t, locale }: { item: PdfItem; t: Translator; locale: Locale }) => {
  const display = itemDisplay(item, t);
  const te = item.timeEstimate;
  // Kontextzeile unter der Beschreibung — gleiche Regeln wie die Standard-Vorlage,
  // Effort-Meta als Textzeile (Design zeigt Ressourcen im Klartext statt Icons).
  const effort = item.effortMeta;
  const effortText =
    effort && (isSet(effort.crew) || isSet(effort.vehicles))
      ? [
          isSet(effort.crew) ? t("doc.offer.item.crew", { count: Number(effort.crew) }) : null,
          // vehicle_type is operator-authored free text — printed as stored.
          isSet(effort.vehicles)
            ? `${effort.vehicles}${effort.vehicle_type ? ` ${effort.vehicle_type}` : t("doc.offer.item.vehicles")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const sub =
    effortText ??
    (display.kind === "range" && te
      ? t("doc.offer.rateRange", {
          min: te.minHours,
          max: te.maxHours,
          rate: formatCurrency(te.hourlyRate, locale),
        })
      : display.kind === "rate"
        ? null
        : item.priceType === "pauschale"
          ? t("doc.offer.flatRate")
          : item.quantity !== 1
            ? t("doc.offer.item.quantityAtPrice", {
                quantity: `${item.quantity} ${item.unit}`,
                price: formatCurrency(item.price, locale),
              })
            : null);

  return (
    <View style={styles.itemRow} wrap={false}>
      <View style={styles.itemLeft}>
        {/* offer_items.description is a snapshot in the customer's language — as authored. */}
        <Text style={styles.itemDesc}>{item.description}</Text>
        {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
      </View>
      <View style={styles.itemRight}>
        {display.kind === "range" ? (
          <>
            <Text style={[styles.itemPrice, { color: AMBER.title }]}>
              {formatRoundedCurrency(display.min, locale)}
            </Text>
            <Text style={[styles.itemPriceSub, { color: AMBER.title }]}>
              {t("doc.offer.upTo")}
              {formatRoundedCurrency(display.max, locale)}
            </Text>
          </>
        ) : display.kind === "rate" ? (
          <>
            <Text style={styles.itemPrice}>{formatRoundedCurrency(display.unitPrice, locale)}</Text>
            <Text style={styles.itemPriceSub}>{perUnitLabel(display.unit, t)}</Text>
          </>
        ) : (
          <Text style={styles.itemPrice}>
            {formatRoundedCurrency(display.kind === "fixed" ? display.amount : item.total, locale)}
          </Text>
        )}
      </View>
    </View>
  );
};

const ServiceSection = ({
  group,
  accent,
  bandDate,
  t,
  locale,
}: {
  group: ServiceGroup;
  accent: string;
  bandDate: string | null;
  t: Translator;
  locale: Locale;
}) => {
  const billable = group.items.filter((it) => !isFreeItem(it.priceType));
  const leistungLines = buildLeistungLines(group, t);
  const cap = groupCap(group);
  const rate = groupRate(group);
  const capHours =
    isSet(cap) && isSet(rate) && Number(rate) > 0 ? +(Number(cap) / Number(rate)).toFixed(1) : null;

  return (
    <View style={styles.serviceSection} wrap={false}>
      <View style={styles.serviceBand}>
        {/* group.label from offerServiceType is German-only — resolve the stored key instead. */}
        <Text style={styles.serviceBandText}>
          {getServiceLabel(group.serviceType, locale).toUpperCase()}
        </Text>
        {bandDate ? <Text style={styles.serviceBandDate}>{bandDate}</Text> : null}
      </View>
      <View style={styles.serviceBody}>
        {billable.map((item, idx) => (
          <ItemRowModern key={`${item.description}-${idx}`} item={item} t={t} locale={locale} />
        ))}
        {leistungLines.length > 0 ? (
          <View>
            {billable.length > 0 ? (
              <Text style={styles.leistungTitle}>{t("doc.offer.section.scope")}</Text>
            ) : null}
            {leistungLines.map((line, i) => (
              <View key={`${line.text}-${i}`} style={styles.leistungLine} wrap={false}>
                <CheckMark color={accent} />
                <Text style={styles.leistungText}>
                  {line.text}
                  {line.suffix ? <Text style={styles.leistungSuffix}>{`  ·  ${line.suffix}`}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {isSet(cap) ? (
          <View style={styles.capBox} wrap={false}>
            <Text style={styles.capTitle}>
              {capHours
                ? t("doc.offer.costCapHours", {
                    cap: formatMeasure(Number(cap), locale),
                    hours: formatMeasure(capHours, locale),
                  })
                : `${t("doc.offer.costCap")} ${t("doc.offer.costCapMax", { cap: formatMeasure(Number(cap), locale) })}`}
            </Text>
            <Text style={styles.capNote}>
              {t("doc.offer.costCapNote", { cap: formatMeasure(Number(cap), locale) })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

// ─── Summenblock (nur ohne rate-Posten) ──────────────────────────────────────

const TotalsBlock = ({ data, t, locale }: { data: OfferData; t: Translator; locale: Locale }) => {
  const p = data.pricing;
  const discount = p.discountPercent && p.discountPercent > 0 ? p.discountPercent : null;
  const range = (min: number, max: number | null | undefined) =>
    isSet(max) ? (
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.totalValue, { color: AMBER.title }]}>
          {formatCurrency(min, locale)}
        </Text>
        <Text style={{ fontSize: FONT_SIZES.xs, color: AMBER.title }}>
          {t("doc.offer.upTo")}
          {formatCurrency(max, locale)}
        </Text>
      </View>
    ) : (
      <Text style={styles.totalValue}>{formatCurrency(min, locale)}</Text>
    );

  return (
    <View style={styles.totalsOuter} wrap={false}>
      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("doc.offer.subtotal")}</Text>
          {range(p.subtotal, p.maxSubtotal)}
        </View>
        {/* s.label is operator-authored free text — printed as stored. */}
        {(p.surcharges ?? []).map((s, i) => (
          <View key={i} style={styles.totalRow}>
            <Text style={styles.totalLabel}>{s.label || t("doc.offer.surcharge")}</Text>
            <Text style={styles.totalValue}>{formatCurrency(s.amount, locale)}</Text>
          </View>
        ))}
        {isSet(discount) ? (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {t("doc.offer.discount", { percent: formatPercent(Number(discount), locale) })}
              </Text>
              {isSet(p.maxDiscountAmount) ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.totalValue, { color: AMBER.title }]}>
                    {`- ${formatCurrency(p.discountAmount ?? 0, locale)}`}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZES.xs, color: AMBER.title }}>
                    {t("doc.offer.upTo")}
                    {`- ${formatCurrency(p.maxDiscountAmount, locale)}`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.totalValue}>
                  {`- ${formatCurrency(p.discountAmount ?? 0, locale)}`}
                </Text>
              )}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("doc.offer.totalExclVat")}</Text>
              {range(p.taxableBase ?? 0, p.maxTaxableBase)}
            </View>
          </>
        ) : null}
        <View style={styles.totalDivider} />
        {p.mwstRate > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {t("doc.offer.vat", { rate: formatPercent(p.mwstRate, locale) })}
            </Text>
            {range(p.mwstAmount, p.maxMwstAmount)}
          </View>
        ) : null}
        <View style={styles.grandTotalBox}>
          <Text style={styles.grandTotalLabel}>{t("doc.offer.grandTotal")}</Text>
          {isSet(p.maxTotal) ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.grandTotalValue}>{formatCurrency(p.total, locale)}</Text>
              <Text style={{ fontSize: FONT_SIZES.xs, color: "#E2E8F0" }}>
                {t("doc.offer.upTo")}
                {formatCurrency(p.maxTotal, locale)}
              </Text>
            </View>
          ) : (
            <Text style={styles.grandTotalValue}>{formatCurrency(p.total, locale)}</Text>
          )}
        </View>
        {data.validUntil ? (
          <Text style={styles.validUntilNote}>
            {t("doc.offer.offerValidUntil", { date: formatDate(data.validUntil, locale) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ─── Hauptdokument ────────────────────────────────────────────────────────────

interface OfferPDFModernProps {
  data: OfferData;
}

export const OfferPDFModern = ({ data }: OfferPDFModernProps) => {
  const { t, locale } = documentI18nFor(data.locale);
  const accent = data.company.primaryColor || TEAL_FALLBACK;
  const mintBg = lightenHex(accent, 0.93);
  const mintBorder = lightenHex(accent, 0.82);

  const layout = getServiceLayout(data.service.type, locale);
  const groups = groupItemsByService(
    data.items.map((it) => ({ ...it, service_type: it.serviceType })),
  );
  const primary = groups[0] ?? null;
  const primaryCap = primary ? groupCap(primary) : null;

  // ── "Auf einen Blick": Kopfzahl + Zzgl.-Satz ────────────────────────────────
  const glanceHeadline = (() => {
    if (primary && isSet(primaryCap)) {
      return {
        label: `${t("domain.priceModel.kostendach")} ${getServiceLabel(primary.serviceType, locale)}`,
        value: t("doc.offer.costCapMax", { cap: formatMeasure(Number(primaryCap), locale) }),
      };
    }
    if (!data.pricing.hasRateItem) {
      const value = isSet(data.pricing.maxTotal)
        ? `${formatRoundedCurrency(data.pricing.total, locale)} – ${formatRoundedCurrency(data.pricing.maxTotal, locale)}`
        : formatRoundedCurrency(data.pricing.total, locale);
      return { label: t("doc.offer.glance.total"), value };
    }
    return { label: t("doc.offer.glance.price"), value: t("domain.priceModel.byEffort") };
  })();

  const glanceNote = (() => {
    const parts = groups
      .slice(1)
      .map((group) => summarizeGroup(group, t, locale))
      .filter(Boolean) as string[];
    // The German original built this sentence from an accusative article table; naming the
    // service instead keeps it translatable without a case system.
    const capSentence =
      primary && isSet(primaryCap)
        ? t("doc.offer.costCapGlance", {
            service: getServiceLabel(primary.serviceType, locale),
          })
        : null;
    const extras =
      parts.length > 0
        ? t("doc.offer.costCapExtras", { parts: parts.join(` ${t("doc.offer.listAnd")} `) })
        : null;
    return [extras, capSentence].filter(Boolean).join(" ") || null;
  })();

  // ── Termin (Offerte-Datum, sonst Datum der Hauptgruppe) ─────────────────────
  const terminDate = data.executionDate ?? (primary ? groupScheduled(primary.items)?.date ?? undefined : undefined);

  // ── Adressen / Route ────────────────────────────────────────────────────────
  const from = data.addresses?.from;
  const to = data.addresses?.to;
  const showRoute = Boolean(from && to);
  const addrLine = (a?: AddressDetails) =>
    a ? [a.street, [a.plz, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";

  // Per-Service-Termine im Band (Parität zur Standard-Vorlage)
  const hasAnyGroupDate = data.items.some((it) => it.scheduledDate);
  const bandDate = (group: ServiceGroup): string | null => {
    if (!hasAnyGroupDate) return null;
    const sched = groupScheduled(group.items);
    const date = sched?.date ?? data.executionDate;
    if (!date) return null;
    const start = sched?.startTime?.slice(0, 5);
    const end = sched?.endTime?.slice(0, 5);
    const time =
      start && end
        ? ` · ${t("doc.time.fromUntil", { start, end })}`
        : start
          ? ` · ${t("doc.time.from", { start })}`
          : "";
    return `${getAppointmentLabel(group.serviceType, locale)}: ${formatDate(date, locale)}${time}`;
  };

  const offerteArtLabel =
    data.offerteType === "blind"
      ? t("doc.offer.type.blindShort")
      : t("doc.offer.type.normal");
  const route =
    data.service.fromCity && data.service.toCity
      ? `${data.service.fromCity} ${t("doc.address.routeTo")}${data.service.toCity}`
      : null;
  // offerTitle is operator-authored free text; without it the title is composed from the
  // localized service label.
  const summaryTitle =
    data.offerTitle?.trim() ||
    `${getServiceLabel(data.service.type, locale)}${route ? ` ${route}` : ""}`;

  const paymentText = data.paymentTerms?.trim();
  // Probes the German Leistungsübersicht entries (DB-authored) — see report.
  const insuranceText = data.includedServices?.find((s) => /versicherung|haftpflicht/i.test(s));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Kopf ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {data.company.logo ? <Image style={styles.logo} src={data.company.logo} /> : null}
            <View>
              <Text style={styles.companyName}>{data.company.name}</Text>
              <Text style={[styles.companyAddress, { color: accent }]}>
                {[data.company.address, [data.company.zip, data.company.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.wordmarkRow}>
              <Text style={[styles.wordmark, { color: DARK }]}>{t("doc.offer.wordmark.head")}</Text>
              <Text style={[styles.wordmark, { color: accent }]}>{t("doc.offer.wordmark.tail")}</Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerMetaLabel}>{t("doc.offer.numberShort")}</Text>
              <Text style={styles.headerMetaValue}>{data.offerNumber}</Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerMetaLabel}>{t("doc.offer.date")}</Text>
              <Text style={styles.headerMetaValue}>{formatDate(data.createdDate, locale)}</Text>
            </View>
            {data.validUntil ? (
              <View style={styles.headerMetaRow}>
                <Text style={styles.headerMetaLabel}>{t("doc.offer.validUntil")}</Text>
                <Text style={styles.headerMetaValue}>{formatDate(data.validUntil, locale)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.headerRule, { backgroundColor: accent }]} />

        {/* ── Auf einen Blick ── */}
        <View style={[styles.glanceBox, { backgroundColor: mintBg, borderColor: mintBorder }]} wrap={false}>
          <Text style={[styles.glanceLabel, { color: accent }]}>{t("doc.offer.section.glance")}</Text>
          <View style={styles.glanceRow}>
            <View style={styles.glanceCol}>
              <Text style={styles.glanceFieldLabel}>{t("doc.offer.glance.for")}</Text>
              <Text style={styles.glanceName}>{data.customer.name}</Text>
              {showRoute ? (
                <Text style={styles.glanceRoute}>{`${addrLine(from)}  –  ${addrLine(to)}`}</Text>
              ) : addrLine(from) ? (
                <Text style={styles.glanceRoute}>{addrLine(from)}</Text>
              ) : null}
            </View>
            {terminDate ? (
              <View style={styles.glanceColMid}>
                <Text style={styles.glanceFieldLabel}>{t("doc.offer.glance.appointment")}</Text>
                <Text style={styles.glanceTermin}>{formatDate(terminDate, locale)}</Text>
              </View>
            ) : null}
            <View style={styles.glanceColRight}>
              <Text style={styles.glanceFieldLabel}>{glanceHeadline.label}</Text>
              <Text style={[styles.glanceHeadline, { color: accent }]}>{glanceHeadline.value}</Text>
            </View>
          </View>
          {glanceNote ? (
            <Text style={[styles.glanceNote, { borderTopColor: mintBorder }]}>{glanceNote}</Text>
          ) : null}
        </View>

        {/* ── Auftraggeber / Offerte-Details ── */}
        <View style={styles.partiesRow}>
          <View style={styles.partiesCol}>
            <Text style={styles.sectionMicroLabel}>{t("doc.offer.section.customer")}</Text>
            <Text style={styles.partyName}>{data.customer.name}</Text>
            {data.customer.address ? <Text style={styles.partyLine}>{data.customer.address}</Text> : null}
            <Text style={styles.partyLine}>
              {[data.customer.phone, data.customer.email].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={styles.partiesCol}>
            <Text style={styles.sectionMicroLabel}>{t("doc.offer.section.offerDetails")}</Text>
            {data.company.mwstNr ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("doc.offer.vatNumber")}</Text>
                <Text style={styles.detailValue}>{data.company.mwstNr}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("doc.offer.type")}</Text>
              <Text style={styles.detailValue}>{offerteArtLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Adresskarten ── */}
        {from || to ? (
          <View style={styles.addressesRow}>
            {from ? (
              <AddressCard
                title={layout.primaryAddressLabel}
                addr={from}
                accent={accent}
                t={t}
                locale={locale}
              />
            ) : null}
            {showRoute ? (
              <View style={styles.arrowDivider}>
                <View style={[styles.arrowCircle, { backgroundColor: accent }]}>
                  <ArrowRight color="#FFFFFF" size={11} />
                </View>
              </View>
            ) : null}
            {showRoute && to ? (
              <AddressCard
                title={layout.secondaryAddressLabel}
                addr={to}
                accent={accent}
                t={t}
                locale={locale}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── Blind-Hinweise (Parität zur Standard-Vorlage) ── */}
        {data.offerteType === "blind" ? <BlindOfferteDisclaimer locale={locale} /> : null}
        <TimeEstimateBlock data={data} />

        {/* ── Service-Sektionen ── */}
        {groups.map((group, gi) => (
          <ServiceSection
            key={`group-${gi}`}
            group={group}
            accent={accent}
            bandDate={bandDate(group)}
            t={t}
            locale={locale}
          />
        ))}

        {/* ── Gesamtpreis: Aufwand-Hinweis ODER Summenblock ── */}
        {data.pricing.hasRateItem ? (
          <Text style={styles.rateNote}>
            {`${t("doc.offer.rateAggregateNote")}${
              data.validUntil
                ? ` ${t("doc.offer.offerValidUntil", { date: formatDate(data.validUntil, locale) })}.`
                : ""
            }`}
          </Text>
        ) : (
          <TotalsBlock data={data} t={t} locale={locale} />
        )}

        {/* ── Zahlung / Versicherung / Bemerkungen ── */}
        {paymentText ? (
          <View style={[styles.infoBox, { backgroundColor: mintBg }]} wrap={false}>
            <View style={[styles.infoBoxAccentBar, { backgroundColor: accent }]} />
            <Text style={[styles.infoBoxTitle, { color: accent }]}>
              {t("doc.offer.section.payment")}
            </Text>
            <Text style={styles.infoBoxText}>{paymentText}</Text>
          </View>
        ) : null}
        {insuranceText ? (
          <View style={[styles.infoBox, { backgroundColor: mintBg }]} wrap={false}>
            <View style={[styles.infoBoxAccentBar, { backgroundColor: accent }]} />
            <Text style={[styles.infoBoxTitle, { color: accent }]}>
              {t("doc.offer.section.insurance")}
            </Text>
            <Text style={styles.infoBoxText}>{insuranceText}</Text>
          </View>
        ) : null}
        {data.description ? (
          <View style={[styles.infoBox, { backgroundColor: GRAY.light, borderWidth: 1, borderColor: GRAY.border }]} wrap={false}>
            <Text style={[styles.infoBoxTitle, { color: GRAY.label }]}>
              {t("doc.offer.section.remarks")}
            </Text>
            <Text style={styles.infoBoxText}>{data.description}</Text>
          </View>
        ) : null}

        {/* ── Auftragsbestätigung ── */}
        <View style={styles.confirmCard} wrap={false}>
          <Text style={styles.confirmTitle}>{t("doc.offer.confirm.title")}</Text>
          <View style={styles.confirmRow}>
            <View style={styles.confirmLeft}>
              {/* Ein zusammenhängender String — JSX-Runs erzeugen sonst Trennstrich-Umbrüche ("10035-)") */}
              <Text style={styles.confirmText}>
                {t("doc.offer.confirm.textCompact", {
                  company: data.company.name,
                  number: data.offerNumber,
                })}
              </Text>
              <View style={styles.signatureRow}>
                <View style={styles.signatureCol}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>
                    {t("doc.offer.confirm.placeDateSignature")}
                  </Text>
                  <Text style={styles.signatureParty}>
                    {t("doc.offer.confirm.customerRole", { name: data.customer.name })}
                  </Text>
                </View>
                <View style={styles.signatureCol}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>
                    {t("doc.offer.confirm.placeDateSignature")}
                  </Text>
                  <Text style={styles.signatureParty}>
                    {t("doc.offer.confirm.contractorRole", { company: data.company.name })}
                  </Text>
                </View>
              </View>
            </View>
            {data.qrCodeUrl ? (
              <View style={[styles.qrPanel, { backgroundColor: mintBg }]}>
                <Text style={[styles.qrPanelTitle, { color: accent }]}>
                  {t("doc.offer.qr.headlineShort")}
                </Text>
                <View style={styles.qrFrame}>
                  <Image style={styles.qrImage} src={data.qrCodeUrl} />
                </View>
                <Text style={styles.qrCaption}>{t("doc.offer.qr.scan")}</Text>
                {data.acceptanceUrl ? (
                  <Link src={data.acceptanceUrl} style={[styles.qrButton, { backgroundColor: accent }]}>
                    {t("doc.offer.qr.buttonShort")}
                  </Link>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Zusammenfassung ── */}
        <View style={[styles.summaryBox, { backgroundColor: mintBg, borderColor: mintBorder }]} wrap={false}>
          <Text style={styles.summaryTitle}>{t("doc.offer.summary")}</Text>
          <Text style={styles.summaryLine}>
            {`${summaryTitle} · ${t("doc.offer.summary.customer")}${data.customer.name}`}
          </Text>
          <Text style={styles.summaryLine}>
            {[
              data.executionDate
                ? `${t("doc.offer.summary.date")}${formatDate(data.executionDate, locale)}`
                : null,
              t("doc.offer.typeValue", { value: offerteArtLabel }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={styles.summaryLine}>
            {data.pricing.hasRateItem
              ? t("doc.offer.rateAggregateNote")
              : isSet(data.pricing.maxTotal)
                ? t("doc.offer.summary.totalRange", {
                    min: formatCurrency(data.pricing.total, locale),
                    max: formatCurrency(data.pricing.maxTotal, locale),
                  })
                : t("doc.offer.summary.total", {
                    amount: formatCurrency(data.pricing.total, locale),
                  })}
          </Text>
        </View>

        <Footer data={data} />
      </Page>

      {data.agbSections && data.agbSections.length > 0 ? (
        <AgbPdfSection
          sections={data.agbSections}
          locale={data.locale}
          companyName={data.company.name}
        />
      ) : null}
    </Document>
  );
};
