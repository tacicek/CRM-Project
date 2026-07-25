import type { ExtractedData } from "@/types/extractedLead";

/**
 * Format a Swiss phone number for storage (+41 …).
 *
 * Note: the edge-side pipeline has no equivalent — `inbound-email-lead` stores the
 * number as the customer wrote it rather than running a second, slightly different
 * implementation. Numbers that come through this path are normalised, numbers from
 * a fully automatic mail import are not.
 */
const formatSwissPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    return '+41 ' + cleaned.substring(1);
  }
  if (cleaned.startsWith('0041')) {
    return '+41 ' + cleaned.substring(4);
  }
  return phone;
};

/**
 * AI extraction schema → the `lead_data` payload `import-manual-lead` expects.
 *
 * Shared by the manual import and the inbound-email review queue: both let an
 * operator edit the same extracted fields and then approve them, so both must
 * produce the identical lead. The edge function has its own copy of this mapping
 * (`supabase/functions/_shared/leadMapping.ts#extractedToLeadInput`) for the fully
 * automatic path — a Deno function cannot import from `src/`, the same deliberate
 * duplication the repo already accepts for `serviceLabels`.
 */
export const extractedLeadToLeadData = (
  extractedData: ExtractedData,
): Record<string, unknown> => {
  const serviceType = extractedData.detected_service_type;

  // Format phone number before saving
  const formattedPhone = formatSwissPhone(extractedData.phone);

  // Build lead data based on service type
  const baseLeadData = {
    customer_first_name: extractedData.first_name?.trim() || null,
    customer_last_name: extractedData.last_name?.trim() || null,
    customer_email: extractedData.email?.trim().toLowerCase() || null,
    customer_phone: formattedPhone || null,
    preferred_date: extractedData.preferred_date || null,
    preferred_time_slot: extractedData.preferred_time || null,
    description: extractedData.special_notes?.trim() || null,
    service_type: serviceType,
    // Customer language — persisted to leads.language by import-manual-lead and
    // frozen onto the offer from there.
    language: extractedData.language,
  };

  let leadData: Record<string, unknown> = { ...baseLeadData };

  // Add service-specific fields
  if (serviceType === "umzug_privat" || serviceType === "umzug_firma") {
    leadData = {
      ...leadData,
      from_street: extractedData.from_street?.trim() || null,
      from_house_number: extractedData.from_house_number?.trim() || null,
      from_plz: extractedData.from_plz?.trim() || null,
      from_city: extractedData.from_city?.trim() || null,
      from_floor: extractedData.from_floor,
      from_has_lift: extractedData.from_has_elevator,
      from_has_estrich: extractedData.from_has_estrich ?? null,
      from_has_keller: extractedData.from_has_keller ?? null,
      from_rooms: extractedData.from_rooms,
      from_living_space_m2: extractedData.from_living_space_m2,
      to_street: extractedData.to_street?.trim() || null,
      to_house_number: extractedData.to_house_number?.trim() || null,
      to_plz: extractedData.to_plz?.trim() || null,
      to_city: extractedData.to_city?.trim() || null,
      to_floor: extractedData.to_floor,
      to_has_lift: extractedData.to_has_elevator,
      packing_service_needed: extractedData.packing_service_needed,
      cleaning_service_needed: extractedData.cleaning_service_needed,
      storage_needed: extractedData.storage_needed,
    };
  } else if (serviceType === "reinigung") {
    leadData = {
      ...leadData,
      from_street: extractedData.address_street?.trim() || null,
      from_house_number: extractedData.address_house_number?.trim() || null,
      from_plz: extractedData.address_plz?.trim() || null,
      from_city: extractedData.address_city?.trim() || null,
      from_rooms: extractedData.number_of_rooms,
      from_living_space_m2: extractedData.living_space_m2,
      property_type: extractedData.property_type,
      bathroom_count: extractedData.bathroom_count,
      kitchen_type: extractedData.kitchen_type,
      has_balcony: extractedData.has_balcony,
      has_garage: extractedData.has_garage,
      has_basement: extractedData.has_basement,
      has_attic: extractedData.has_attic,
    };
  } else if (serviceType === "raeumung") {
    leadData = {
      ...leadData,
      from_street: extractedData.address_street?.trim() || null,
      from_house_number: extractedData.address_house_number?.trim() || null,
      from_plz: extractedData.address_plz?.trim() || null,
      from_city: extractedData.address_city?.trim() || null,
      from_rooms: extractedData.number_of_rooms,
      property_type: extractedData.property_type,
      clearing_type: extractedData.clearing_type,
      estimated_volume: extractedData.estimated_volume,
      has_heavy_items: extractedData.has_heavy_items,
      heavy_items_description: extractedData.heavy_items_description?.trim() || null,
    };
  } else if (serviceType === "entsorgung") {
    leadData = {
      ...leadData,
      from_street: extractedData.address_street?.trim() || null,
      from_house_number: extractedData.address_house_number?.trim() || null,
      from_plz: extractedData.address_plz?.trim() || null,
      from_city: extractedData.address_city?.trim() || null,
      disposal_type: extractedData.disposal_type,
      items_description: extractedData.items_description?.trim() || null,
      estimated_volume: extractedData.estimated_volume,
    };
  } else if (serviceType === "lagerung") {
    leadData = {
      ...leadData,
      pickup_street: extractedData.pickup_street?.trim() || null,
      pickup_house_number: extractedData.pickup_house_number?.trim() || null,
      from_plz: extractedData.pickup_plz?.trim() || null,
      from_city: extractedData.pickup_city?.trim() || null,
      pickup_floor: extractedData.pickup_floor,
      pickup_has_lift: extractedData.pickup_has_elevator,
      storage_duration: extractedData.storage_duration,
      storage_volume: extractedData.storage_volume,
      access_frequency: extractedData.access_frequency,
      needs_climate_control: extractedData.needs_climate_control,
      storage_items_description: extractedData.storage_items_description?.trim() || null,
    };
  } else if (serviceType === "klaviertransport") {
    leadData = {
      ...leadData,
      from_street: extractedData.from_street?.trim() || null,
      from_house_number: extractedData.from_house_number?.trim() || null,
      from_plz: extractedData.from_plz?.trim() || null,
      from_city: extractedData.from_city?.trim() || null,
      from_floor: extractedData.from_floor,
      from_has_lift: extractedData.from_has_elevator,
      to_street: extractedData.to_street?.trim() || null,
      to_house_number: extractedData.to_house_number?.trim() || null,
      to_plz: extractedData.to_plz?.trim() || null,
      to_city: extractedData.to_city?.trim() || null,
      to_floor: extractedData.to_floor,
      to_has_lift: extractedData.to_has_elevator,
      piano_type: extractedData.piano_type,
      piano_brand: extractedData.piano_brand?.trim() || null,
      piano_weight_kg: extractedData.piano_weight_kg,
      staircase_type: extractedData.staircase_type,
      staircase_width_cm: extractedData.staircase_width_cm,
      window_access_possible: extractedData.window_access_possible,
    };
  } else if (serviceType === "moebellift") {
    leadData = {
      ...leadData,
      from_street: extractedData.address_street?.trim() || null,
      from_house_number: extractedData.address_house_number?.trim() || null,
      from_plz: extractedData.address_plz?.trim() || null,
      from_city: extractedData.address_city?.trim() || null,
      moebellift_floor: extractedData.moebellift_floor,
      moebellift_item_description: extractedData.moebellift_item_description?.trim() || null,
      moebellift_item_dimensions: extractedData.moebellift_item_dimensions?.trim() || null,
    };
  }
  return leadData;
};
