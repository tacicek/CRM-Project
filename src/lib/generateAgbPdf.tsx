import { Document, pdf } from "@react-pdf/renderer";
import { AgbPdfSection } from "@/components/pdf/AgbPdfSection";
import type { OfferAgbSection } from "@/components/pdf/types/offer.types";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

/**
 * Standalone AGB attachment for the offer e-mail (a separate `AGB.pdf`, kept distinct from
 * the main offer PDF — the two must never duplicate the AGB in one message).
 *
 * `locale` is the CUSTOMER's language (the offer's, not the operator's). It defaults to
 * German so an old caller degrades to a readable document instead of throwing — the same
 * contract as resolveDocumentLocale. Only the document chrome (title, subtitle) is
 * translated here; `section.title` / `section.content` are printed as passed in.
 *
 * Rendering is delegated to the shared <AgbPdfSection/> so this attachment and the in-offer
 * AGB page produce identical output. Sections are rendered in the given order — the caller
 * already selects them `ORDER BY display_order`.
 */
export const generateAgbPdfBase64 = async (
  sections: OfferAgbSection[],
  companyName?: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<string | null> => {
  if (!sections || sections.length === 0) return null;

  const doc = pdf(
    <Document>
      <AgbPdfSection sections={sections} locale={locale} companyName={companyName} />
    </Document>
  );
  const pdfBlob = await doc.toBlob();
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};
