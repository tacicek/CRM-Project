import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { COLORS, FONT_SIZES, SPACING } from "../styles/constants";
import { OfferData } from "../types/offer.types";
import { formatDate } from "../utils/formatters";
import { lightenHex } from "../utils/colors";
import { getServiceLayout } from "../utils/serviceLayout";
import { documentI18nFor } from "@/i18n/documentLocale";
import { getServiceLabel } from "@/i18n/domain";

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.base,
  },
  titleText: {
    fontSize: FONT_SIZES["2xl"],
    fontWeight: 700,
    marginBottom: 2,
  },
  titleSubtext: {
    fontSize: FONT_SIZES.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  detailsBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.gray[300],
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.sm,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    width: 120,
    fontSize: FONT_SIZES.sm,
    fontWeight: 700,
  },
  detailValue: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
});

interface TitleSectionProps {
  data: OfferData;
}

export const TitleSection = ({ data }: TitleSectionProps) => {
  const { t, locale } = documentI18nFor(data.locale);
  const layout = getServiceLayout(data.service.type, locale);
  const serviceLabel = getServiceLabel(data.service.type, locale);
  const route =
    layout.useRouteInTitle && data.service.fromCity && data.service.toCity
      ? `${data.service.fromCity} ${t("doc.address.routeTo")}${data.service.toCity}`
      : undefined;
  const primary = data.company.primaryColor || COLORS.primary;
  const primaryLight = data.company.primaryColor ? lightenHex(data.company.primaryColor) : COLORS.primaryLight;
  const routeOrType = route ? `${serviceLabel} ${route}` : serviceLabel;

  const timeLabel = data.executionStartTime
    ? t("doc.time.from", { start: data.executionStartTime })
    : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.titleText, { color: primary }]}>
        {t("doc.offer.titleFor", { service: serviceLabel })}
      </Text>
      {data.offerTitle ? (
        <Text style={styles.titleSubtext}>{data.offerTitle}</Text>
      ) : null}
      <View style={[styles.detailsBox, { backgroundColor: primaryLight }]}>
        {data.executionDate ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{`${layout.executionDateLabel}:`}</Text>
            <Text style={styles.detailValue}>
              {formatDate(data.executionDate, locale)}{timeLabel ? `  |  ${timeLabel}` : ""}
            </Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t("doc.offer.serviceKind")}</Text>
          <Text style={styles.detailValue}>{routeOrType}</Text>
        </View>
      </View>
    </View>
  );
};
