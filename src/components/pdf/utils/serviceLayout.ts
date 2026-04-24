import type { OfferData } from "../types/offer.types";

type ServiceType = OfferData["service"]["type"];

type ServiceLayout = {
  useRouteInTitle: boolean;
  executionDateLabel: string;
  primaryAddressLabel: string;
  secondaryAddressLabel: string;
  showSecondaryByDefault: boolean;
};

const MOVING_TYPES: ServiceType[] = ["Privatumzug", "Firmenumzug", "Büroumzug", "Umzug"];

export const isMovingService = (serviceType: ServiceType): boolean => MOVING_TYPES.includes(serviceType);

export const getServiceLayout = (serviceType: ServiceType): ServiceLayout => {
  if (isMovingService(serviceType)) {
    return {
      useRouteInTitle: true,
      executionDateLabel: "Umzugstermin",
      primaryAddressLabel: "Auszugsadresse",
      secondaryAddressLabel: "Einzugsadresse",
      showSecondaryByDefault: true,
    };
  }

  switch (serviceType) {
    case "Reinigung":
      return {
        useRouteInTitle: false,
        executionDateLabel: "Reinigungstermin",
        primaryAddressLabel: "Reinigungsadresse",
        secondaryAddressLabel: "Zusätzliche Adresse",
        showSecondaryByDefault: false,
      };
    case "Räumung":
      return {
        useRouteInTitle: false,
        executionDateLabel: "Räumungstermin",
        primaryAddressLabel: "Räumungsadresse",
        secondaryAddressLabel: "Zusätzliche Adresse",
        showSecondaryByDefault: false,
      };
    case "Entsorgung":
      return {
        useRouteInTitle: false,
        executionDateLabel: "Entsorgungstermin",
        primaryAddressLabel: "Abholadresse",
        secondaryAddressLabel: "Entsorgungsadresse",
        showSecondaryByDefault: false,
      };
    case "Lagerung":
      return {
        useRouteInTitle: false,
        executionDateLabel: "Lagerungstermin",
        primaryAddressLabel: "Abholadresse",
        secondaryAddressLabel: "Lageradresse",
        showSecondaryByDefault: false,
      };
    case "Klaviertransport":
      return {
        useRouteInTitle: true,
        executionDateLabel: "Transporttermin",
        primaryAddressLabel: "Abholadresse",
        secondaryAddressLabel: "Zieladresse",
        showSecondaryByDefault: true,
      };
    case "Möbellift":
      return {
        useRouteInTitle: false,
        executionDateLabel: "Einsatztermin",
        primaryAddressLabel: "Einsatzadresse",
        secondaryAddressLabel: "Zusätzliche Adresse",
        showSecondaryByDefault: false,
      };
    default:
      return {
        useRouteInTitle: false,
        executionDateLabel: "Ausführungstermin",
        primaryAddressLabel: "Einsatzadresse",
        secondaryAddressLabel: "Zusätzliche Adresse",
        showSecondaryByDefault: false,
      };
  }
};
