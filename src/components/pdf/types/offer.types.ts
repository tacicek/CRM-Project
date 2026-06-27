export interface OfferData {
  company: {
    name: string;
    logo?: string;
    address?: string;
    city: string;
    zip: string;
    phone?: string;
    email: string;
    website?: string;
    mwstNr?: string;
    primaryColor?: string;
    iban?: string;
  };
  offerNumber: string;
  /** Custom offer title entered by the company (e.g. "Privatumzug Luzern nach Bern") */
  offerTitle?: string | null;
  createdDate: string;
  validUntil?: string;
  executionDate?: string;
  executionStartTime?: string | null;
  executionEndTime?: string | null;
  description?: string | null;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  service: {
    type: "Privatumzug" | "Firmenumzug" | "Büroumzug" | "Umzug" | "Reinigung" | "Räumung" | "Entsorgung" | "Lagerung" | "Klaviertransport" | "Möbellift";
    fromCity?: string;
    toCity?: string;
  };
  addresses?: {
    from?: AddressDetails;
    to?: AddressDetails;
  };
  items: Array<{
    description: string;
    details?: string[];
    quantity: number;
    unit: string;
    price: number;
    total: number;
    /** Per-item time estimate for Blind Offerte */
    timeEstimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
    /** Multi-service grouping key (clean base or null=Allgemein) */
    serviceType?: string | null;
  }>;
  breakdown?: {
    volume?: number;
    estimatedTime?: number;
    carryTime?: number;
    assemblyTime?: number;
    driveTime?: number;
    bufferTime?: number;
    truckType?: string;
    workers?: number;
  };
  pricing: {
    subtotal: number;
    mwstRate: number;
    mwstAmount: number;
    total: number;
    priceModel?: 'pauschal' | 'stundenansatz' | 'kostendach';
    hourlyRate?: number | null;
    kostendachMax?: number | null;
    /** Zuschläge — zwischen Zwischensumme und MwSt gerendert. */
    surcharges?: { label: string; amount: number }[];
    /** Populated for blind offerte with time estimate — max of the range */
    maxSubtotal?: number | null;
    maxMwstAmount?: number | null;
    maxTotal?: number | null;
  };
  /** Blind Offerte only — time-range estimate data */
  timeEstimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  includedServices?: string[];
  paymentTerms?: string | null;
  acceptanceUrl?: string;
  qrCodeUrl?: string;
  /** When true, render with SN 010 130 Swiss letter standard layout */
  briefLayout?: boolean;
  /** 'blind' = created without on-site visit | 'normal' (default) = after visit */
  offerteType?: 'normal' | 'blind';
  /** Explicit salutation from form (e.g. "Herr", "Frau") — used for gender-aware greeting */
  customerSalutation?: string | null;
}

export interface AddressDetails {
  street?: string;
  plz?: string;
  city?: string;
  buildingType?: "MFH" | "EFH" | "Hochhaus";
  floor?: number;
  rooms?: number;
  hasLift?: boolean;
  hasParking?: boolean;
}
