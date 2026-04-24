/**
 * OfferPDFBrief — SN 010 130 Swiss letter standard layout.
 *
 * Physical layout (A4 = 595 × 842pt):
 *   Left margin:    25 mm = 71 pt
 *   Right margin:   15 mm = 43 pt
 *   Letterhead zone: 0–40 mm from top (0–113 pt)
 *   Address zone:   starts at 52 mm from top (~147 pt)
 *   Bottom margin: 20 mm = 57 pt
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { AddressComparison } from "./components/AddressComparison";
import { BlindOfferteDisclaimer } from "./components/BlindOfferteDisclaimer";
import { Footer, PDF_FOOTER_RESERVE_PT } from "./components/Footer";
import { IncludedServices } from "./components/IncludedServices";
import { ServiceTable } from "./components/ServiceTable";
import { SignaturePage } from "./components/SignaturePage";
import { TimeEstimateBlock } from "./components/TimeEstimateBlock";
import { TitleSection } from "./components/TitleSection";
import { COLORS, FONT_SIZES } from "./styles/constants";
import { OfferData } from "./types/offer.types";
import { chunkOfferTableItems } from "./utils/chunkOfferItems";
import { formatDateLong } from "./utils/formatters";
import { detectSalutation } from "./utils/salutation";

// 1 mm in PDF points
const MM = 2.8346;

/** Fewer rows on first brief page (letterhead + intro use space) */
const BRIEF_TABLE_FIRST_PAGE = 3;
const BRIEF_TABLE_CONTINUATION = 10;

const styles = StyleSheet.create({
  page: {
    paddingLeft: Math.round(25 * MM),
    paddingRight: Math.round(15 * MM),
    paddingTop: 10,
    paddingBottom: Math.max(Math.round(20 * MM) + 16, PDF_FOOTER_RESERVE_PT),
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text.primary,
    lineHeight: 1.5,
  },
  letterheadZone: {
    height: 103,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logoArea: {
    flex: 1,
    paddingTop: 4,
  },
  logo: {
    width: 130,
    height: 34,
    objectFit: "contain",
  },
  companyNameFallback: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.text.primary,
  },
  senderBlock: {
    width: 175,
    textAlign: "right",
    paddingTop: 4,
  },
  senderName: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
    color: COLORS.text.primary,
  },
  senderLine: {
    fontSize: 8,
    color: COLORS.text.secondary,
    marginBottom: 1,
  },
  addressDateZone: {
    marginTop: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  recipientBlock: {
    width: 210,
  },
  recipientLine: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 0,
  },
  dateReferenceBlock: {
    alignItems: "flex-end",
  },
  dateLine: {
    fontSize: 10,
    textAlign: "right",
  },
  referenceLine: {
    fontSize: 10,
    textAlign: "right",
    marginTop: 10,
  },
  referenceLineMuted: {
    fontSize: 9,
    textAlign: "right",
    marginTop: 3,
    color: COLORS.text.secondary,
  },
  blindBadge: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#D97706",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignSelf: "flex-end",
  },
  blindBadgeText: {
    fontSize: 7,
    color: "#D97706",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    textAlign: "right",
  },
  salutation: {
    fontSize: 10,
    marginBottom: 10,
  },
  introText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 14,
  },
  closingSection: {
    marginTop: 28,
  },
  closingGreeting: {
    fontSize: 10,
    marginBottom: 6,
  },
  closingCompany: {
    fontSize: 10,
    fontWeight: 700,
  },
  signatureSpace: {
    marginTop: 50,
  },
  paymentBlock: {
    marginTop: 8,
    padding: 8,
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
});

const hasValidLogo = (logo?: string): boolean =>
  !!logo &&
  (logo.startsWith("data:image") ||
    logo.startsWith("http://") ||
    logo.startsWith("https://"));

interface OfferPDFBriefProps {
  data: OfferData;
}

export const OfferPDFBrief = ({ data }: OfferPDFBriefProps) => {
  const { company, customer, offerNumber, createdDate } = data;

  const fromAddr = data.addresses?.from;
  const recipientStreet = fromAddr?.street ?? "";
  const recipientCity = [fromAddr?.plz, fromAddr?.city].filter(Boolean).join(" ");

  const salutation = detectSalutation(customer.name, data.customerSalutation);

  const cityPrefix = company.city ? `${company.city}, ` : "";
  const dateStr = `${cityPrefix}${formatDateLong(createdDate)}`;

  const chunks = chunkOfferTableItems(data.items, BRIEF_TABLE_FIRST_PAGE, BRIEF_TABLE_CONTINUATION);

  const letterheadAndAddress = (
    <>
      <View style={styles.letterheadZone}>
        <View style={styles.logoArea}>
          {hasValidLogo(company.logo) ? (
            <Image style={styles.logo} src={company.logo!} cache={false} />
          ) : (
            <Text style={styles.companyNameFallback}>{company.name}</Text>
          )}
        </View>

        <View style={styles.senderBlock}>
          <Text style={styles.senderName}>{company.name}</Text>
          {company.address ? <Text style={styles.senderLine}>{company.address}</Text> : null}
          <Text style={styles.senderLine}>
            {company.zip} {company.city}
          </Text>
          {company.phone ? <Text style={styles.senderLine}>Tel. {company.phone}</Text> : null}
          <Text style={styles.senderLine}>{company.email}</Text>
          {company.mwstNr ? <Text style={styles.senderLine}>MwSt-Nr: {company.mwstNr}</Text> : null}
        </View>
      </View>

      <View style={styles.addressDateZone}>
        <View style={styles.recipientBlock}>
          <Text style={styles.recipientLine}>{customer.name}</Text>
          {recipientStreet ? <Text style={styles.recipientLine}>{recipientStreet}</Text> : null}
          {recipientCity ? <Text style={styles.recipientLine}>{recipientCity}</Text> : null}
          {customer.phone?.trim() ? (
            <Text style={styles.recipientLine}>Telefon: {customer.phone.trim()}</Text>
          ) : null}
          {customer.email?.trim() ? (
            <Text style={styles.recipientLine}>E-Mail: {customer.email.trim()}</Text>
          ) : null}
        </View>

        <View style={styles.dateReferenceBlock}>
          <Text style={styles.dateLine}>{dateStr}</Text>
          <Text style={styles.referenceLine}>Offerte Nr. {offerNumber}</Text>
          {data.validUntil ? (
            <Text style={styles.referenceLineMuted}>
              {`Gültig bis: ${formatDateLong(data.validUntil)}`}
            </Text>
          ) : null}
          {data.offerteType === "blind" ? (
            <View style={styles.blindBadge}>
              <Text style={styles.blindBadgeText}>BLIND OFFERTE — Ohne Besichtigung</Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <Document>
      {chunks.map((chunk, chunkIdx) => {
        const isLastChunk = chunkIdx === chunks.length - 1;
        const positionOffset = chunks.slice(0, chunkIdx).reduce((acc, c) => acc + c.length, 0);

        return (
          <Page key={`brief-table-${chunkIdx}`} size="A4" style={styles.page}>
            {chunkIdx === 0 ? (
              <>
                {letterheadAndAddress}
                <Text style={styles.salutation}>{salutation}</Text>
                <Text style={styles.introText}>
                  Vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen die folgende Offerte unterbreiten zu
                  dürfen.
                </Text>
                <TitleSection data={data} />
                <AddressComparison data={data} />
                {data.offerteType === "blind" && <BlindOfferteDisclaimer />}
                <TimeEstimateBlock data={data} />
              </>
            ) : (
              <View style={styles.tableContinuationBanner} wrap={false}>
                <Text style={styles.tableContinuationTitle}>Leistungstabelle — Fortsetzung</Text>
                <Text style={styles.tableContinuationSub}>Offerte Nr. {offerNumber}</Text>
              </View>
            )}

            <ServiceTable
              data={data}
              itemsOverride={chunk}
              showTotalsBlock={isLastChunk}
              positionOffset={positionOffset}
            />

            {isLastChunk ? (
              <>
                <View wrap={false}>
                  <IncludedServices data={data} />
                  {data.paymentTerms ? (
                    <View style={styles.paymentBlock}>
                      <Text style={styles.paymentLabel}>Zahlungskondition:</Text>
                      <Text style={styles.paymentValue}>{data.paymentTerms}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.closingSection} wrap={false}>
                  <Text style={styles.closingGreeting}>Freundliche Grüsse</Text>
                  <Text style={styles.closingCompany}>{company.name}</Text>
                  <View style={styles.signatureSpace} />
                </View>
              </>
            ) : null}

            <Footer data={data} />
          </Page>
        );
      })}

      <Page size="A4" style={styles.page}>
        <View style={styles.pageTwoHeader}>
          {hasValidLogo(company.logo) ? (
            <Image style={styles.pageTwoLogo} src={company.logo!} cache={false} />
          ) : (
            <Text>{company.name}</Text>
          )}
          <Text style={styles.pageTwoCity}>{`${company.zip} ${company.city}`}</Text>
        </View>
        <SignaturePage data={data} />
        <Footer data={data} />
      </Page>
    </Document>
  );
};
