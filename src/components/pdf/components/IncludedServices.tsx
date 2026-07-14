import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { documentI18nFor } from "@/i18n/documentLocale";
import type { Translator } from "@/i18n/translator";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
    backgroundColor: COLORS.gray[50],
    borderRadius: 4,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  block: {
    marginBottom: SPACING.base,
  },
  blockLast: {
    marginBottom: 0,
  },
  title: {
    fontSize: FONT_SIZES.base,
    fontWeight: 700,
    marginBottom: SPACING.xs,
    color: COLORS.text.primary,
  },
  text: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    marginBottom: 3,
    lineHeight: 1.45,
  },
  hint: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 1.35,
  },
});

/** Fallback list — only used when the offer carries no Leistungsübersicht of its own. */
const defaultIncluded = (t: Translator): string[] => [
  t("doc.offer.included.default.insurance"),
  t("doc.offer.included.default.staff"),
  t("doc.offer.included.default.vehicles"),
  t("doc.offer.included.default.travel"),
  t("doc.offer.included.default.equipment"),
];

const defaultExcluded = (t: Translator): string[] => [
  t("doc.offer.excluded.default.hazardous"),
  t("doc.offer.excluded.default.permits"),
  t("doc.offer.excluded.default.extraScope"),
];

interface IncludedServicesProps {
  data: OfferData;
}

export const IncludedServices = ({ data }: IncludedServicesProps) => {
  const { t } = documentI18nFor(data.locale);
  // DB-authored included services (leistungsuebersicht_templates) stay as authored — only
  // the fallback list, which the PDF itself owns, is translated.
  const services = data.includedServices?.length ? data.includedServices : defaultIncluded(t);

  return (
    <View style={styles.container} wrap={false}>
      <View style={styles.block}>
        <Text style={styles.title}>{t("doc.offer.included.title")}</Text>
        {services.map((service, index) => (
          <Text key={`${service}-${index}`} style={styles.text}>
            • {service}
          </Text>
        ))}
      </View>

      <View style={styles.blockLast}>
        <Text style={styles.title}>{t("doc.offer.excluded.title")}</Text>
        {defaultExcluded(t).map((service, index) => (
          <Text key={`${service}-${index}`} style={styles.text}>
            • {service}
          </Text>
        ))}
        <Text style={styles.hint}>{t("doc.offer.excluded.hint")}</Text>
      </View>
    </View>
  );
};
