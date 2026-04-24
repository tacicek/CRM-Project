import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export interface AgbPdfSection {
  id?: string;
  title: string;
  content: string;
  display_order?: number;
}

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

export const generateAgbPdfBase64 = async (
  sections: AgbPdfSection[],
  companyName?: string
): Promise<string | null> => {
  if (!sections || sections.length === 0) return null;

  const sortedSections = [...sections].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  const doc = pdf(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Allgemeine Geschäftsbedingungen (AGB)</Text>
          <Text style={styles.subtitle}>
            {companyName
              ? `${companyName} - gültige Version zum Angebotszeitpunkt`
              : "Gültige Version zum Angebotszeitpunkt"}
          </Text>
        </View>

        {sortedSections.map((section, index) => (
          <View key={section.id || `${section.title}-${index}`} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.content}</Text>
          </View>
        ))}
      </Page>
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
