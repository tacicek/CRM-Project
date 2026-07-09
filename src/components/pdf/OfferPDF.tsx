import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
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
import { OfferData } from "./types/offer.types";
import { COLORS, FONT_SIZES, SPACING } from "./styles/constants";
import { chunkOfferTableItems } from "./utils/chunkOfferItems";

/** Rows on first page (space left after header blocks) */
const TABLE_ROWS_FIRST_PAGE = 5;
/** Rows on continuation pages */
const TABLE_ROWS_CONTINUATION = 11;

const ACCENT_DEFAULT = "#F97316";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0, // header bleeds to edge — no top padding
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
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.gray[50],
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
  const paymentText = data.paymentTerms?.trim();
  const insuranceText = data.includedServices?.find((s) =>
    /versicherung|haftpflicht/i.test(s)
  );

  // Only render if there's something to show
  if (!paymentText && !insuranceText && !data.description) return null;

  return (
    <View style={styles.bottomSection} wrap={false}>
      {paymentText ? (
        <View style={styles.infoBox}>
          <View style={[styles.infoBoxAccent, { backgroundColor: accent }]} />
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: COLORS.text.secondary }]}>ZAHLUNG</Text>
            <Text style={styles.infoBoxText}>{paymentText}</Text>
          </View>
        </View>
      ) : null}

      {insuranceText ? (
        <View style={styles.infoBox}>
          <View style={[styles.infoBoxAccent, { backgroundColor: accent }]} />
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: COLORS.text.secondary }]}>VERSICHERUNG</Text>
            <Text style={styles.infoBoxText}>{insuranceText}</Text>
          </View>
        </View>
      ) : null}

      {data.description ? (
        <View style={styles.descBox}>
          <Text style={styles.descLabel}>BEMERKUNGEN</Text>
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
                {data.offerteType === "blind" && <BlindOfferteDisclaimer />}
                <TimeEstimateBlock data={data} />
              </>
            ) : (
              <View style={styles.continuationBanner}>
                <Text style={styles.continuationTitle}>Leistungstabelle — Fortsetzung</Text>
                <Text style={styles.continuationSub}>{`Offerte Nr. ${data.offerNumber}`}</Text>
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
    </Document>
  );
};
