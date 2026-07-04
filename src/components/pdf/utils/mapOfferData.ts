import {
  OfferData as PdfOfferData,
  OfferItemEffortMeta,
  OfferItemVolumeMeta,
  OfferItemAreaMeta,
  OfferItemBreakdownEntry,
  OfferItemLeistungEntry,
} from "../types/offer.types";
import { computeDisplayTotals, type SubtotalItem } from "@/lib/offerPricing";

export interface LegacyOfferData {
  id: string;
  title: string;
  description?: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: LegacyAddress;
  customer_destination?: LegacyAddress;
  service_type?: string;
  service_date?: string;
  valid_until?: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  created_at: string;
  items: LegacyOfferItem[];
  company: LegacyCompanyInfo;
  access_token?: string;
  baseUrl?: string;
  leistungsuebersicht?: {
    included_services: { name: string }[];
  };
  price_model?: 'pauschal' | 'stundenansatz' | 'kostendach' | null;
  hourly_rate?: number | null;
  kostendach_max?: number | null;
  payment_terms?: string | null;
  service_start_time?: string | null;
  service_end_time?: string | null;
  brief_layout?: boolean | null;
  customer_salutation?: string | null;
  offer_number?: number | null;
  offerte_type?: 'normal' | 'blind' | null;
  surcharges?: { label: string; amount: number }[] | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  // ── Data-bridge P1a (Katman 3/4, offer-level) — carried, not yet mapped/rendered ──
  customer_number?: string | null;
  discount_percent?: number | null;
}

export interface LegacyOfferItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  service_type?: string | null;
  // ── Data-bridge P1a (Katman 1-4) — DB snake_case; carried, not yet mapped/rendered ──
  price_type?: string | null;
  list_price?: number | null;
  /** Item-level discount % (offer_items.discount_percent, Katman 1c) */
  discount_percent?: number | null;
  effort_meta?: OfferItemEffortMeta | null;
  volume_meta?: OfferItemVolumeMeta | null;
  area_meta?: OfferItemAreaMeta | null;
  breakdown?: OfferItemBreakdownEntry[];
  leistung?: OfferItemLeistungEntry[];
}

export interface LegacyCompanyInfo {
  company_name: string;
  street?: string;
  house_number?: string;
  plz: string;
  city: string;
  phone?: string;
  email: string;
  website?: string;
  mwst_number?: string;
  logo_url?: string;
  primary_color?: string;
  iban?: string;
}

export interface LegacyAddress {
  street?: string;
  house_number?: string;
  plz?: string;
  city?: string;
  floor?: number;
  has_lift?: boolean;
  rooms?: number;
}

/**
 * Parse offer items to extract worker count and vehicle info.
 * Looks for patterns like "4 Mitarbeiter", "2 Lieferwagen", "1 LKW 7.5t" etc.
 */
interface ExtractedResources {
  workers?: number;
  vehicles?: { count: number; type: string }[];
}

const VEHICLE_KEYWORDS = [
  'Lieferwagen', 'LKW', 'Transporter', 'Fahrzeug', 'Sattelzug',
  'Möbelwagen', 'Anhänger',
];

function extractResourcesFromItems(items: LegacyOfferItem[]): ExtractedResources {
  const result: ExtractedResources = {};
  const allText = items.map(i => i.description).join(' ');

  // Workers: "4 Mitarbeiter" or "Mitarbeiter 4"
  const workerMatch = allText.match(/(\d+)\s*Mitarbeiter/i);
  if (workerMatch) {
    result.workers = parseInt(workerMatch[1], 10);
  }

  // Vehicles: "2 Lieferwagen", "1 LKW 7.5t", etc.
  const vehicles: { count: number; type: string }[] = [];
  for (const keyword of VEHICLE_KEYWORDS) {
    const regex = new RegExp(`(\\d+)\\s*(${keyword}[\\w\\s.]*?)(?=[,\\.\\n]|\\d+\\s*Mitarbeiter|$)`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(allText)) !== null) {
      const count = parseInt(m[1], 10);
      const type = m[2].trim().replace(/\s+/g, ' ');
      // Avoid duplicates
      if (!vehicles.find(v => v.type.toLowerCase() === type.toLowerCase())) {
        vehicles.push({ count, type });
      }
    }
  }
  if (vehicles.length > 0) result.vehicles = vehicles;

  return result;
}

/**
 * Given a list of included-service strings and resource data extracted from items,
 * replace any static vehicle/worker entries with dynamic counts.
 */
function applyResourcestoIncludedServices(
  services: string[],
  resources: ExtractedResources,
): string[] {
  if (!resources.workers && (!resources.vehicles || resources.vehicles.length === 0)) {
    return services;
  }

  return services.map((service) => {
    const lower = service.toLowerCase();

    // Replace worker count
    if (resources.workers !== undefined) {
      // Match e.g. "Umzugsfachkräfte (inkl. Spesen)", "3 Mitarbeiter", "Mitarbeiter (4 Pers.)"
      if (lower.includes('mitarbeiter') || lower.includes('umzugsfachkräfte') || lower.includes('personal')) {
        // If it already has a number, replace it; otherwise prepend
        const numMatch = service.match(/\d+/);
        if (numMatch) {
          return service.replace(/\d+/, String(resources.workers));
        }
        return `${resources.workers} ${service}`;
      }
    }

    // Replace vehicle count/type
    if (resources.vehicles && resources.vehicles.length > 0) {
      const vehicleMatch = VEHICLE_KEYWORDS.find(kw => lower.includes(kw.toLowerCase()));
      if (vehicleMatch) {
        const dynamicVehicle = resources.vehicles.find(v =>
          v.type.toLowerCase().includes(vehicleMatch.toLowerCase())
        ) ?? resources.vehicles[0];
        // Replace number in the service string, or prepend if none
        const numMatch = service.match(/\d+/);
        if (numMatch) {
          return service.replace(/\d+/, String(dynamicVehicle.count));
        }
        return `${dynamicVehicle.count} ${service}`;
      }

      // Generic "Fahrzeuge" without specific type — replace count
      if (lower.includes('fahrzeug') || lower.includes('wagen') || lower.includes('auto')) {
        const totalVehicles = resources.vehicles.reduce((sum, v) => sum + v.count, 0);
        const numMatch = service.match(/\d+/);
        if (numMatch) {
          return service.replace(/\d+/, String(totalVehicles));
        }
      }
    }

    return service;
  });
}

/** Return validUntil only if explicitly set — no fallback date generated. */
const resolveValidUntil = (validUntil?: string | null): string | undefined =>
  validUntil || undefined;

const mapServiceType = (rawType: string | undefined, title: string): PdfOfferData["service"]["type"] => {
  const value = (rawType || title || "").toLowerCase();
  if (value.includes("firma")) return "Firmenumzug";
  if (value.includes("büro")) return "Büroumzug";
  if (value.includes("reinigung")) return "Reinigung";
  if (value.includes("räum") || value.includes("raeum")) return "Räumung";
  if (value.includes("entsorgung")) return "Entsorgung";
  if (value.includes("lagerung")) return "Lagerung";
  if (value.includes("klavier")) return "Klaviertransport";
  if (value.includes("möbellift") || value.includes("moebellift")) return "Möbellift";
  if (value.includes("umzug")) return "Privatumzug";
  return "Umzug";
};

const mapAddress = (addr?: LegacyAddress): PdfOfferData["addresses"]["from"] | undefined => {
  if (!addr) return undefined;
  if (!addr.street && !addr.plz && !addr.city) return undefined;
  return {
    street: [addr.street, addr.house_number].filter(Boolean).join(" "),
    plz: addr.plz,
    city: addr.city,
    floor: addr.floor,
    rooms: addr.rooms,
    hasLift: addr.has_lift,
  };
};

export const mapOfferToPdfData = (offer: LegacyOfferData, qrCodeUrl?: string): PdfOfferData => {
  // Use the real sequential offer_number from DB if available, fallback to UUID prefix
  const offerNumber = offer.offer_number
    ? String(offer.offer_number)
    : offer.id.slice(0, 8).toUpperCase();
  const acceptanceUrl = offer.access_token && offer.baseUrl
    ? `${offer.baseUrl}/offerte/${offer.access_token}`
    : undefined;

  const items = offer.items.map((item) => {
    const parts = item.description.split("\n").map((line) => line.trim()).filter(Boolean);
    const te = item.time_estimate;
    const mainDesc = parts[0] || item.description;
    return {
      description: mainDesc,
      details: parts.length > 1 ? parts.slice(1) : undefined,
      quantity: item.quantity,
      unit: item.unit || "Pauschale",
      price: item.unit_price,
      total: item.total || item.quantity * item.unit_price,
      timeEstimate: te ?? null,
      serviceType: item.service_type ?? null,
      // ── Data-bridge P1b — carried, NOT yet rendered (ServiceTable ignores these) ──
      priceType: item.price_type ?? null,
      listPrice: item.list_price ?? null,
      discountPercent: item.discount_percent ?? null,
      effortMeta: item.effort_meta ?? null,
      volumeMeta: item.volume_meta ?? null,
      areaMeta: item.area_meta ?? null,
      breakdownRows: item.breakdown,
      leistung: item.leistung,
    };
  });

  const fromAddress = mapAddress(offer.customer_address);
  const toAddress = mapAddress(offer.customer_destination);

  return {
    company: {
      name: offer.company.company_name,
      logo: offer.company.logo_url,
      address: [offer.company.street, offer.company.house_number].filter(Boolean).join(" "),
      city: offer.company.city,
      zip: offer.company.plz,
      phone: offer.company.phone,
      email: offer.company.email,
      website: offer.company.website,
      mwstNr: offer.company.mwst_number,
      primaryColor: offer.company.primary_color,
      iban: offer.company.iban,
    },
    offerNumber,
    offerTitle: offer.title ?? null,
    createdDate: offer.created_at,
    validUntil: resolveValidUntil(offer.valid_until),
    executionDate: offer.service_date,
    executionStartTime: offer.service_start_time ?? null,
    executionEndTime: offer.service_end_time ?? null,
    description: offer.description ?? null,
    customer: {
      name: `${offer.customer_first_name} ${offer.customer_last_name}`,
      email: offer.customer_email,
      phone: offer.customer_phone,
      address: fromAddress
        ? [fromAddress.street, `${fromAddress.plz || ""} ${fromAddress.city || ""}`.trim()].filter(Boolean).join(", ")
        : undefined,
    },
    service: {
      type: mapServiceType(offer.service_type, offer.title),
      fromCity: fromAddress?.city,
      toCity: toAddress?.city,
    },
    addresses: fromAddress || toAddress ? { from: fromAddress, to: toAddress } : undefined,
    items,
    pricing: (() => {
      // Compute max totals from per-item time estimates
      const hasItemTe = offer.items.some(i => i.time_estimate && i.time_estimate.maxHours && i.time_estimate.hourlyRate);
      let maxSubtotal: number | null = null;
      let maxMwstAmount: number | null = null;
      let maxTotal: number | null = null;
      // Zuschläge: offer.subtotal = steuerbare Basis (Positionen + Zuschläge).
      // Anzeige: Positionen-Zwischensumme = subtotal − Σ Zuschläge; Zuschlagszeilen separat.
      const surcharges = (offer.surcharges ?? []).map((s) => ({ label: s.label, amount: s.amount }));
      const surchargesSum = surcharges.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
      // P3b-2a: consolidated read chain (computeDisplayTotals). Zwischensumme = RAW items sum —
      // never derived back from offers.subtotal (discounted base since P3b-1). The former inline
      // max reduce (TODO(3b)) is gone: optional/inkl are now excluded on the max side too,
      // matching OfferView/Detail (single source).
      const subtotalItems = offer.items.map((item): SubtotalItem => ({
        priceType: item.price_type ?? "",
        quantity: item.quantity,
        unitPrice: item.unit_price,
        timeEstimate: item.time_estimate ?? null,
      }));
      const minTotals = computeDisplayTotals(
        subtotalItems, surchargesSum, offer.vat_rate, offer.discount_percent, "min",
      );
      const itemsSubtotal = minTotals.subtotal;
      if (hasItemTe) {
        const maxTotals = computeDisplayTotals(
          subtotalItems, surchargesSum, offer.vat_rate, offer.discount_percent, "max",
        );
        maxSubtotal = maxTotals.subtotal;
        maxMwstAmount = maxTotals.vatAmount;
        maxTotal = maxTotals.total;
      }
      return {
        subtotal: itemsSubtotal,
        surcharges,
        mwstRate: offer.vat_rate,
        mwstAmount: offer.vat_amount,
        total: offer.total,
        priceModel: offer.price_model ?? 'pauschal',
        hourlyRate: offer.hourly_rate ?? null,
        kostendachMax: offer.kostendach_max ?? null,
        maxSubtotal,
        maxMwstAmount,
        maxTotal,
      };
    })(),
    timeEstimate: null,
    includedServices: (() => {
      const rawServices = offer.leistungsuebersicht?.included_services?.map((s) => s.name).filter(Boolean);
      if (!rawServices || rawServices.length === 0) return undefined;
      const resources = extractResourcesFromItems(offer.items);
      return applyResourcestoIncludedServices(rawServices, resources);
    })(),
    paymentTerms: offer.payment_terms ?? null,
    acceptanceUrl,
    qrCodeUrl,
    briefLayout: offer.brief_layout ?? false,
    customerSalutation: offer.customer_salutation ?? null,
    offerteType: offer.offerte_type ?? 'normal',
    // ── Data-bridge P1b (offer-level) — carried, NOT yet rendered ──
    customerNumber: offer.customer_number ?? null,
    discountPercent: offer.discount_percent ?? null,
  };
};
