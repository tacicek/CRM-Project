import type { Locale } from "@/i18n/locale";

/**
 * Fields the AI extraction returns for a lead — the schema shared by the manual
 * import and the inbound-email review queue.
 *
 * Lives here rather than next to one of the two pages because both edit the same
 * shape through the same form (`@/components/leads/ExtractedLeadForm`), and the
 * edge-side counterpart (`supabase/functions/_shared/inboundEmail/parsedInquiry.ts`)
 * validates exactly these field names.
 */
export interface ExtractedData {
  // Base fields (all service types)
  detected_service_type: string;
  /**
   * DOCUMENT locale — the language the CUSTOMER wrote in (AI-detected, operator-editable).
   * NOT the operator's dashboard language. Start of the propagation chain:
   * leads.language → offers.language → auftraege / rechnungen / quittungen / appointments.
   */
  language: Locale;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  special_notes: string | null;
  confidence_score: number;

  // Umzug fields
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_elevator?: boolean;
  from_has_estrich?: boolean | null;
  from_has_keller?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_elevator?: boolean;
  packing_service_needed?: boolean;
  furniture_assembly_needed?: boolean;
  cleaning_service_needed?: boolean;
  storage_needed?: boolean;
  piano_transport_needed?: boolean;

  // Reinigung fields
  address_street?: string | null;
  address_house_number?: string | null;
  address_plz?: string | null;
  address_city?: string | null;
  property_type?: string | null;
  number_of_rooms?: number | null;
  living_space_m2?: number | null;
  bathroom_count?: number | null;
  kitchen_type?: string | null;
  has_balcony?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;
  has_attic?: boolean;
  cleaning_type?: string | null;

  // Räumung fields
  clearing_type?: string | null;
  estimated_volume?: string | null;
  has_heavy_items?: boolean;
  heavy_items_description?: string | null;

  // Entsorgung fields
  disposal_type?: string | null;
  items_description?: string | null;

  // Lagerung fields
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_plz?: string | null;
  pickup_city?: string | null;
  pickup_floor?: number | null;
  pickup_has_elevator?: boolean;
  storage_duration?: string | null;
  storage_volume?: string | null;
  access_frequency?: string | null;
  needs_climate_control?: boolean;
  storage_items_description?: string | null;

  // Klaviertransport fields
  piano_type?: string | null;
  piano_brand?: string | null;
  piano_weight_kg?: number | null;
  staircase_type?: string | null;
  staircase_width_cm?: number | null;
  window_access_possible?: boolean;

  // Möbellift fields
  moebellift_floor?: number | null;
  moebellift_item_description?: string | null;
  moebellift_item_dimensions?: string | null;
  direction?: string | null;
}