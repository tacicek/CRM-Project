import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { OfferAgbSection } from "./types/offer.types";

/**
 * Shared AGB (Allgemeine Geschäftsbedingungen) page for the offer PDF.
 *
 * Rendered as its own trailing A4 `<Page>` so it always starts fresh, appended by all three
 * templates (classic / modern / brief) — one component, no per-template copy. It is also
 * the single rendering used by the standalone AGB e-mail attachment (generateAgbPdf.tsx),
 * so both documents show byte-identical AGB output.
 *
 * `content` is treated as PLAIN TEXT with significant line breaks (`whiteSpace: pre-wrap`) —
 * the established contract of the shipping AGB.pdf. No HTML is interpreted.
 *
 * Order is preserved verbatim: every caller already queries `ORDER BY display_order`, so the
 * component must NOT re-sort. Empty / no sections → renders nothing.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    fontSize: 10,
    color: "#111827",
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6B7280",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    color: "#111827",
  },
  sectionText: {
    fontSize: 10,
    color: "#374151",
    whiteSpace: "pre-wrap",
  },
});

interface AgbPdfSectionProps {
  sections: OfferAgbSection[];
  /** Document (customer) language — the AGB chrome (title/subtitle) is translated with it. */
  locale: Locale;
  companyName?: string;
}

export const AgbPdfSection = ({ sections, locale, companyName }: AgbPdfSectionProps) => {
  if (!sections || sections.length === 0) return null;

  const { t } = documentI18nFor(locale);

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header}>
        <Text style={styles.title}>{t("doc.agb.title")}</Text>
        <Text style={styles.subtitle}>
          {companyName
            ? t("doc.agb.subtitle", { company: companyName })
            : t("doc.agb.subtitleGeneric")}
        </Text>
      </View>

      {sections.map((section, index) => (
        <View key={section.id || `${section.title}-${index}`} style={styles.section} wrap>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionText}>{section.content}</Text>
        </View>
      ))}
    </Page>
  );
};
