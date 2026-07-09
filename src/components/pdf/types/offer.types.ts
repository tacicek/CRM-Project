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
    /** Per-service dates (2026-07): all items of one service group carry the same value;
        NULL falls back to the offer-level executionDate. */
    scheduledDate?: string | null;
    scheduledStartTime?: string | null;
    scheduledEndTime?: string | null;
    // ── Data-bridge P1a (Katman 1-4) — carried for the redesign, NOT yet rendered ──
    /** Price semantics: pauschale | per_unit | per_hour | inkl | optional */
    priceType?: string | null;
    /** Betrags-Achse: fixed | rate | range (offer_items.amount_basis) */
    amountBasis?: string | null;
    /** Item-/Service-level Kostendach (offer_items.kostendach_max) */
    kostendachMax?: number | null;
    /** Original catalog price before item discount (Katman 1c) */
    listPrice?: number | null;
    /** Item-level discount % (Katman 1c) */
    discountPercent?: number | null;
    /** Effort meta (crew/vehicles/hourly rate/effort range) — offer_item_effort_meta */
    effortMeta?: OfferItemEffortMeta | null;
    /** Volume meta (m³ + rate) — offer_item_volume_meta */
    volumeMeta?: OfferItemVolumeMeta | null;
    /** Area meta (object type / m² / handover) — offer_item_area_meta */
    areaMeta?: OfferItemAreaMeta | null;
    /** Detailed breakdown rows — offer_item_breakdown (1:N) */
    breakdownRows?: OfferItemBreakdownEntry[];
    /** Included-service (Leistungsumfang) rows — offer_item_leistung (1:N) */
    leistung?: OfferItemLeistungEntry[];
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
    /** P3b-2c-ii: offer-level Rabatt row (between Zuschläge and MwSt). */
    discountPercent?: number | null;
    discountAmount?: number;
    maxDiscountAmount?: number | null;
    /** Discounted base ("Total exkl. MwSt") — equals offers.subtotal on the min side. */
    taxableBase?: number;
    maxTaxableBase?: number | null;
    /** rate-Posten vorhanden → Aggregat-Box ausblenden, RATE_AGGREGATE_NOTE zeigen. */
    hasRateItem?: boolean;
  };
  /** Blind Offerte only — time-range estimate data */
  timeEstimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  includedServices?: string[];
  paymentTerms?: string | null;
  acceptanceUrl?: string;
  qrCodeUrl?: string;
  /** When true, render with SN 010 130 Swiss letter standard layout */
  briefLayout?: boolean;
  /** Company-level PDF template (companies.pdf_template): classic (default) | modern (v2 design) */
  pdfTemplate?: "classic" | "modern";
  /** 'blind' = created without on-site visit | 'normal' (default) = after visit */
  offerteType?: 'normal' | 'blind';
  /** Explicit salutation from form (e.g. "Herr", "Frau") — used for gender-aware greeting */
  customerSalutation?: string | null;
  // ── Data-bridge P1b (Katman 3/4, offer-level) — carried, NOT yet rendered ──
  customerNumber?: string | null;
  discountPercent?: number | null;
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
  hasEstrich?: boolean;
  hasKeller?: boolean;
}

// ── Per-item service meta (data-bridge P1a) ─────────────────────────────────────
// Shapes mirror the DB tables 1:1 (offer_item_*_meta / _breakdown / _leistung).
// Shared here so both LegacyOfferItem (mapOfferData input) and OfferData.items
// (render type) reference one definition. Carried in P1a, rendered from P2 onward.

export interface OfferItemEffortMeta {
  crew?: number | null;
  vehicles?: number | null;
  vehicle_type?: string | null;
  hourly_rate?: number | null;
  aufwand_min_h?: number | null;
  aufwand_max_h?: number | null;
}

export interface OfferItemVolumeMeta {
  volume_m3?: number | null;
  volume_min_m3?: number | null;
  volume_max_m3?: number | null;
  rate?: number | null;
  rate_unit?: string | null;
  location?: string | null;
}

export interface OfferItemAreaMeta {
  object_type?: string | null;
  area_m2?: number | null;
  abgabe?: string | null;
  abnahmegarantie?: boolean | null;
}

export interface OfferItemBreakdownEntry {
  position: number;
  label: string;
  value: string;
}

export interface OfferItemLeistungEntry {
  position: number;
  text: string;
}
