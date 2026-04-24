import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Header } from "./components/Header";
import { CustomerSection } from "./components/CustomerSection";
import { TitleSection } from "./components/TitleSection";
import { AddressComparison } from "./components/AddressComparison";
import { ServiceTable } from "./components/ServiceTable";
import { IncludedServices } from "./components/IncludedServices";
import { Footer, PDF_FOOTER_RESERVE_PT } from "./components/Footer";
import { SignaturePage } from "./components/SignaturePage";
import { BlindOfferteDisclaimer } from "./components/BlindOfferteDisclaimer";
import { TimeEstimateBlock } from "./components/TimeEstimateBlock";
import { OfferPDFBrief } from "./OfferPDFBrief";
import { OfferData } from "./types/offer.types";
import { COLORS, FONT_SIZES, SPACING } from "./styles/constants";
import { chunkOfferTableItems } from "./utils/chunkOfferItems";

/** Rows on first page (space left after header blocks) */
const TABLE_ROWS_FIRST_PAGE = 5;
/** Rows on continuation pages */
const TABLE_ROWS_CONTINUATION = 11;

const styles = StyleSheet.create({
  paymentBlock: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  paymentLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
    color: COLORS.text.primary,
    minWidth: 110,
  },
  paymentValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    flex: 1,
  },
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: PDF_FOOTER_RESERVE_PT,
    fontSize: FONT_SIZES.base,
    fontFamily: "Helvetica",
    color: COLORS.text.primary,
  },
  tableContinuationBanner: {
    marginBottom: 14,
  },
  tableContinuationTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.text.primary,
  },
  tableContinuationSub: {
    fontSize: 9,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  pageTwoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    alignItems: "center",
  },
  pageTwoLogo: {
    width: 120,
    height: 30,
    objectFit: "contain",
  },
  pageTwoCity: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: "right",
  },
});

interface OfferPDFProps {
  data: OfferData;
}

export const OfferPDF = ({ data }: OfferPDFProps) => {
  if (data.briefLayout) {
    return <OfferPDFBrief data={data} />;
  }

  const chunks = chunkOfferTableItems(data.items, TABLE_ROWS_FIRST_PAGE, TABLE_ROWS_CONTINUATION);

  return (
    <Document>
      {chunks.map((chunk, chunkIdx) => {
        const isLastChunk = chunkIdx === chunks.length - 1;
        const positionOffset = chunks.slice(0, chunkIdx).reduce((acc, c) => acc + c.length, 0);

        return (
          <Page key={`offer-table-${chunkIdx}`} size="A4" style={styles.page}>
            {chunkIdx === 0 ? (
              <>
                <Header data={data} />
                <CustomerSection data={data} />
                <TitleSection data={data} />
                <AddressComparison data={data} />
                {data.offerteType === "blind" && <BlindOfferteDisclaimer />}
                <TimeEstimateBlock data={data} />
              </>
            ) : (
              <View style={styles.tableContinuationBanner} wrap={false}>
                <Text style={styles.tableContinuationTitle}>Leistungstabelle — Fortsetzung</Text>
                <Text style={styles.tableContinuationSub}>Offerte Nr. {data.offerNumber}</Text>
              </View>
            )}

            <ServiceTable
              data={data}
              itemsOverride={chunk}
              showTotalsBlock={isLastChunk}
              positionOffset={positionOffset}
            />

            {isLastChunk ? (
              <View wrap={false}>
                <IncludedServices data={data} />
                {data.description ? (
                  <View style={styles.paymentBlock}>
                    <Text style={styles.paymentLabel}>Beschreibung:</Text>
                    <Text style={styles.paymentValue}>{data.description}</Text>
                  </View>
                ) : null}
                {data.paymentTerms ? (
                  <View style={styles.paymentBlock}>
                    <Text style={styles.paymentLabel}>Zahlungskondition:</Text>
                    <Text style={styles.paymentValue}>{data.paymentTerms}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Footer data={data} />
          </Page>
        );
      })}

      <Page size="A4" style={styles.page}>
        <View style={styles.pageTwoHeader}>
          {data.company.logo ? (
            <Image style={styles.pageTwoLogo} src={data.company.logo} />
          ) : (
            <Text>{data.company.name}</Text>
          )}
          <Text style={styles.pageTwoCity}>{`${data.company.zip} ${data.company.city}`}</Text>
        </View>
        <SignaturePage data={data} />
        <Footer data={data} />
      </Page>
    </Document>
  );
};
