import { Image, Link, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatCurrency, formatDate } from "../utils/formatters";
import { lightenHex } from "../utils/colors";

const styles = StyleSheet.create({
  titleText: {
    fontSize: FONT_SIZES["3xl"],
    fontWeight: 700,
    textAlign: "center",
    marginBottom: SPACING.base,
  },
  acceptanceBox: {
    marginTop: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: 4,
    padding: SPACING.base,
    alignItems: "center",
  },
  button: {
    backgroundColor: COLORS.primary,
    color: COLORS.text.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    textAlign: "center",
    width: 220,
  },
  qr: {
    width: 132,
    height: 132,
    marginTop: SPACING.base,
  },
  qrCaption: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  legalText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    lineHeight: 1.5,
    marginTop: SPACING.base,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.gray[50],
    padding: SPACING.base,
    marginTop: SPACING.base,
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 700,
    marginBottom: SPACING.sm,
  },
  summaryLine: {
    fontSize: FONT_SIZES.base,
    marginBottom: 4,
  },
  summaryTotal: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 700,
    marginTop: SPACING.sm,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xl,
  },
  signatureCol: {
    width: "45%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[700],
    marginTop: 40,
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
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
      <Text style={[styles.titleText, { color: primary }]}>Auftragsbestätigung</Text>

      <View style={styles.acceptanceBox}>
        {data.acceptanceUrl ? (
          <Link src={data.acceptanceUrl} style={[styles.button, { backgroundColor: primary }]}>
            Online Offerte annehmen
          </Link>
        ) : (
          <Text style={[styles.button, { backgroundColor: primary }]}>Online Offerte annehmen</Text>
        )}
        {data.qrCodeUrl ? <Image style={styles.qr} src={data.qrCodeUrl} /> : null}
        <Text style={styles.qrCaption}>Mit Handy scannen</Text>
        {shortUrl ? <Text style={styles.qrCaption}>{shortUrl}</Text> : null}
        <Text style={styles.qrCaption}>oder unterschreiben Sie unten:</Text>
      </View>

      <Text style={styles.legalText}>
        Hiermit erteile ich der Firma {data.company.name} den in dieser Offerte (Nr. {data.offerNumber})
        beschriebenen Auftrag.
        {"\n\n"}
        Ich bestätige, dass ich die Offerte sowie die allgemeinen Geschäftsbedingungen gelesen und verstanden
        habe und mit allen Punkten einverstanden bin.
      </Text>

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
        <Text style={styles.summaryTotal}>Gesamtbetrag: {formatCurrency(data.pricing.total)}</Text>
      </View>

      <View style={styles.signatureRow}>
        <View style={styles.signatureCol}>
          <Text>Ort, Datum:</Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Unterschrift Auftraggeber</Text>
          <Text style={styles.signatureLabel}>({data.customer.name})</Text>
        </View>
        <View style={styles.signatureCol}>
          <Text>Ort, Datum:</Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Unterschrift Auftragnehmer</Text>
          <Text style={styles.signatureLabel}>({data.company.name})</Text>
        </View>
      </View>
    </View>
  );
};
