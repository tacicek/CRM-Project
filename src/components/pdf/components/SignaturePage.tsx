import { Image, Link, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatCurrency, formatDate } from "../utils/formatters";
import { lightenHex } from "../utils/colors";
import { RATE_AGGREGATE_NOTE } from "@/lib/offerPricing";

const styles = StyleSheet.create({
  titleText: {
    fontSize: FONT_SIZES["2xl"],
    fontWeight: 700,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  // ── Two-column: left = text + signatures, right = QR card ──
  mainRow: {
    marginTop: SPACING.base,
    flexDirection: "row",
    gap: SPACING.lg,
    alignItems: "flex-start",
  },
  leftCol: {
    flex: 1,
  },
  legalText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    lineHeight: 1.5,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING["2xl"],
  },
  signatureCol: {
    width: "48%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[700],
    marginTop: 30,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 1.35,
  },
  // ── QR acceptance card (right) ──
  qrCard: {
    width: 190,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: 6,
    padding: SPACING.base,
    alignItems: "center",
  },
  qrCardTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  qr: {
    width: 120,
    height: 120,
  },
  qrScan: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  qrCaption: {
    fontSize: 7,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  button: {
    color: COLORS.text.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    textAlign: "center",
    width: "100%",
  },
  // ── Summary ──
  summaryBox: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.gray[50],
    padding: SPACING.base,
    marginTop: SPACING.lg,
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    marginBottom: SPACING.xs,
  },
  summaryLine: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 3,
  },
  summaryTotal: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
    marginTop: SPACING.xs,
  },
});

interface SignaturePageProps {
  data: OfferData;
}

export const SignaturePage = ({ data }: SignaturePageProps) => {
  const route =
    data.service.fromCity && data.service.toCity
      ? `${data.service.fromCity} nach ${data.service.toCity}`
      : undefined;
  const primary = data.company.primaryColor || COLORS.primary;
  const primaryLight = data.company.primaryColor ? lightenHex(data.company.primaryColor, 0.9) : "#F0F9FF";
  const shortUrl = data.acceptanceUrl ? data.acceptanceUrl.replace(/^https?:\/\//, "") : "";

  return (
    <View>
      <Text style={styles.titleText}>Auftragsbestätigung</Text>

      <View style={styles.mainRow}>
        {/* Left: confirmation text + signature grid */}
        <View style={styles.leftCol}>
          {/* Ein zusammenhängender String — JSX-Interpolation erzeugt separate Text-Runs,
              deren Grenzen react-pdf als Umbruchstellen mit Trennstrich behandelt ("10035-)"). */}
          <Text style={styles.legalText}>
            {`Hiermit erteile ich der Firma ${data.company.name} den in dieser Offerte (Nr. ${data.offerNumber}) beschriebenen Auftrag.\n\nIch bestätige, dass ich die Offerte sowie die allgemeinen Geschäftsbedingungen gelesen und verstanden habe und mit allen Punkten einverstanden bin.`}
          </Text>

          <View style={styles.signatureRow}>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Ort, Datum</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{`Unterschrift Auftraggeber · ${data.customer.name}`}</Text>
            </View>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Ort, Datum</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{`Unterschrift Auftragnehmer · ${data.company.name}`}</Text>
            </View>
          </View>
        </View>

        {/* Right: QR acceptance card */}
        {data.qrCodeUrl ? (
          <View style={styles.qrCard}>
            <Text style={[styles.qrCardTitle, { color: primary }]}>ONLINE OFFERTE ANNEHMEN</Text>
            <Image style={styles.qr} src={data.qrCodeUrl} />
            <Text style={styles.qrScan}>Mit dem Handy scannen</Text>
            {shortUrl ? <Text style={styles.qrCaption}>{shortUrl}</Text> : null}
            {data.acceptanceUrl ? (
              <Link src={data.acceptanceUrl} style={[styles.button, { backgroundColor: primary }]}>
                Online Offerte annehmen
              </Link>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Summary */}
      <View style={[styles.summaryBox, { borderColor: primary, backgroundColor: primaryLight }]}>
        <Text style={styles.summaryTitle}>Zusammenfassung</Text>
        <Text style={styles.summaryLine}>{`${data.service.type}${route ? ` ${route}` : ""}`}</Text>
        <Text style={styles.summaryLine}>
          {`Offerte-Art: ${data.offerteType === 'blind' ? 'Blind Offerte (ohne Besichtigung)' : 'Normal Offerte (nach Besichtigung)'}`}
        </Text>
        <Text style={styles.summaryLine}>Kunde: {data.customer.name}</Text>
        {data.executionDate ? (
          <Text style={styles.summaryLine}>Ausführungsdatum: {formatDate(data.executionDate)}</Text>
        ) : null}
        {data.pricing.hasRateItem ? (
          <Text style={styles.summaryLine}>{RATE_AGGREGATE_NOTE}</Text>
        ) : (
          <Text style={styles.summaryTotal}>
            {data.pricing.maxTotal !== null && data.pricing.maxTotal !== undefined
              ? `Gesamtbetrag: ${formatCurrency(data.pricing.total)} – ${formatCurrency(data.pricing.maxTotal)}`
              : `Gesamtbetrag: ${formatCurrency(data.pricing.total)}`}
          </Text>
        )}
      </View>
    </View>
  );
};
