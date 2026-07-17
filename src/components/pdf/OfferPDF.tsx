import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Header } from "./components/Header";
import { CustomerSection } from "./components/CustomerSection";
import { AddressComparison } from "./components/AddressComparison";
import { ServiceTable } from "./components/ServiceTable";
import { Footer, PDF_FOOTER_RESERVE_PT } from "./components/Footer";
import { SignaturePage } from "./components/SignaturePage";
import { BlindOfferteDisclaimer } from "./components/BlindOfferteDisclaimer";
import { TimeEstimateBlock } from "./components/TimeEstimateBlock";
import { OfferPDFBrief } from "./OfferPDFBrief";
import { OfferPDFModern } from "./OfferPDFModern";
import { AgbPdfSection } from "./AgbPdfSection";
import { OfferData } from "./types/offer.types";
import { COLORS, FONT_SIZES, SPACING } from "./styles/constants";
import { lightenHex } from "./utils/colors";
import { chunkOfferTableItems } from "./utils/chunkOfferItems";
import { documentI18nFor } from "@/i18n/documentLocale";

/** Rows on first page (space left after header blocks) */
const TABLE_ROWS_FIRST_PAGE = 5;
/** Rows on continuation pages */
const TABLE_ROWS_CONTINUATION = 11;

const ACCENT_DEFAULT = "#F97316";

// Keine Silbentrennung: Wörter werden als Ganzes umbrochen (design v2). Verhindert
// Brüche wie "(Nr. 10035-)" im Bestätigungstext; gilt für alle Offerte-PDF-Vorlagen.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    // Header blutet nicht mehr zum Rand — alle Seiten (auch Fortsetzungen) starten
    // mit demselben oberen Abstand.
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: PDF_FOOTER_RESERVE_PT,
    fontSize: FONT_SIZES.base,
    fontFamily: "Helvetica",
    color: COLORS.text.primary,
  },
  // ── Bottom section (payment info boxes) ──────────────────────────────────
  bottomSection: {
    marginTop: SPACING.lg,
    flexDirection: "column",
    gap: SPACING.sm,
  },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: SPACING.sm,
    borderRadius: 4,
    backgroundColor: COLORS.gray[50], // ZAHLUNG/VERSICHERUNG: inline mint override (accent tint)
  },
  infoBoxAccent: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    backgroundColor: ACCENT_DEFAULT,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: COLORS.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoBoxText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 1.45,
  },
  // ── Continuation pages ────────────────────────────────────────────────────
  continuationBanner: {
    paddingTop: SPACING.base,
    marginBottom: SPACING.base,
  },
  continuationTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.text.primary,
  },
  continuationSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  // ── Signature block (flows after the offerte) ─────────────────────────────
  signatureFlow: {
    marginTop: SPACING.xl,
  },
  // ── Description / extra info ──────────────────────────────────────────────
  descBox: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  descLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 700,
    color: COLORS.text.secondary,
    marginBottom: 3,
  },
  descText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    lineHeight: 1.45,
  },
});

interface OfferPDFProps {
  data: OfferData;
}

// ─── Payment / insurance bottom section ──────────────────────────────────────

interface BottomSectionProps {
  data: OfferData;
  accent: string;
}

const BottomSection = ({ data, accent }: BottomSectionProps) => {
  const { t } = documentI18nFor(data.locale);
  const paymentText = data.paymentTerms?.trim();
  // Matches the German insurance entry of the Leistungsübersicht — that list is
  // DB-authored, so the probe stays German (see report).
  const insuranceText = data.includedServices?.find((s) =>
    /versicherung|haftpflicht/i.test(s)
  );
  const accentTint = lightenHex(accent, 0.93);

  // Only render if there's something to show
  if (!paymentText && !insuranceText && !data.description) return null;

  return (
    <View style={styles.bottomSection} wrap={false}>
      {paymentText ? (
        <View style={[styles.infoBox, { backgroundColor: accentTint }]}>
          <View style={[styles.infoBoxAccent, { backgroundColor: accent }]} />
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: accent }]}>
              {t("doc.offer.section.payment")}
            </Text>
            <Text style={styles.infoBoxText}>{paymentText}</Text>
          </View>
        </View>
      ) : null}

      {insuranceText ? (
        <View style={[styles.infoBox, { backgroundColor: accentTint }]}>
          <View style={[styles.infoBoxAccent, { backgroundColor: accent }]} />
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: accent }]}>
              {t("doc.offer.section.insurance")}
            </Text>
            <Text style={styles.infoBoxText}>{insuranceText}</Text>
          </View>
        </View>
      ) : null}

      {data.description ? (
        <View style={styles.descBox}>
          <Text style={styles.descLabel}>{t("doc.offer.section.remarks")}</Text>
          <Text style={styles.descText}>{data.description}</Text>
        </View>
      ) : null}
    </View>
  );
};

// ─── Main document ────────────────────────────────────────────────────────────

export const OfferPDF = ({ data }: OfferPDFProps) => {
  if (data.briefLayout) {
    return <OfferPDFBrief data={data} />;
  }

  // Firmenweite Vorlagen-Wahl (Einstellungen → Offerte PDF-Vorlage). Das offer-level
  // brief_layout bleibt als explizite Einzelfall-Wahl übergeordnet (Zweig oben).
  if (data.pdfTemplate === "modern") {
    return <OfferPDFModern data={data} />;
  }

  const { t } = documentI18nFor(data.locale);
  const accent = data.company.primaryColor || ACCENT_DEFAULT;

  const chunks = chunkOfferTableItems(data.items, TABLE_ROWS_FIRST_PAGE, TABLE_ROWS_CONTINUATION);

  return (
    <Document>
      {chunks.map((chunk, chunkIdx) => {
        const isLastChunk = chunkIdx === chunks.length - 1;

        return (
          <Page key={`offer-table-${chunkIdx}`} size="A4" style={styles.page}>
            {chunkIdx === 0 ? (
              <>
                {/* Dark header band — bleeds to edges (negative margin handled in Header) */}
                <Header data={data} />

                {/* Two-column: Auftraggeber + Offerte-Details */}
                <CustomerSection data={data} />

                {/* Route comparison box */}
                <AddressComparison data={data} />

                {/* Blind offerte disclaimer + time estimate note */}
                {data.offerteType === "blind" && <BlindOfferteDisclaimer locale={data.locale} />}
                <TimeEstimateBlock data={data} />
              </>
            ) : (
              <View style={styles.continuationBanner}>
                <Text style={styles.continuationTitle}>{t("doc.offer.tableContinued")}</Text>
                <Text style={styles.continuationSub}>
                  {t("doc.offer.numbered", { number: data.offerNumber })}
                </Text>
              </View>
            )}

            <ServiceTable
              data={data}
              itemsOverride={chunk}
              showTotalsBlock={isLastChunk}
            />

            {isLastChunk ? (
              <>
                <BottomSection data={data} accent={accent} />
                {/* Signature/approval block in the flow — on a short offerte it fills
                    the same page; if it overflows, wrap={false} moves it whole to the next page. */}
                <View style={styles.signatureFlow} wrap={false}>
                  <SignaturePage data={data} />
                </View>
              </>
            ) : null}

            <Footer data={data} />
          </Page>
        );
      })}

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
