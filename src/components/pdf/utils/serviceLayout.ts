import { getAddressLabels, getAppointmentLabel, normalizeServiceKey } from "@/i18n/domain";
import type { Locale } from "@/i18n/locale";

/**
 * Per-service layout decisions for the Offerte PDF.
 *
 * The eight German label sets that used to live here are gone: address headers and the
 * appointment label now come from the catalog (getAddressLabels / getAppointmentLabel),
 * so they follow the customer's language. What stays here is the layout question the
 * catalog cannot answer: does this service have a FROM→TO route worth printing in the
 * title?
 */
export interface ServiceLayout {
  useRouteInTitle: boolean;
  executionDateLabel: string;
  primaryAddressLabel: string;
  secondaryAddressLabel: string;
}

/** Besides a removal, only a transport prints its route in the title ("… Zürich nach Bern"). */
const ROUTE_SERVICES = new Set(["klaviertransport", "transport"]);

export const isMovingService = (serviceType: string | null | undefined): boolean =>
  normalizeServiceKey(serviceType).startsWith("umzug");

export const getServiceLayout = (
  serviceType: string | null | undefined,
  locale: Locale
): ServiceLayout => {
  const key = normalizeServiceKey(serviceType);
  const addresses = getAddressLabels(key, locale);
  return {
    useRouteInTitle: isMovingService(key) || ROUTE_SERVICES.has(key),
    executionDateLabel: getAppointmentLabel(key, locale),
    primaryAddressLabel: addresses.primary,
    secondaryAddressLabel: addresses.secondary,
  };
};
