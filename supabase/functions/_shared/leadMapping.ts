/**
 * The one place where extracted data becomes a `leads` row.
 *
 * Lifted out of `import-manual-lead` unchanged so that the manual import, the
 * inbound-email pipeline and the review-approve action all write leads the same
 * way. A second mapper would drift from this one within a release or two, and
 * the divergence would only surface as wrong data in a customer's offer.
 *
 * Placeholders ("Unbekannt", ""): `leads` declares customer_first_name,
 * customer_last_name, customer_email, customer_phone, from_plz and from_city
 * NOT NULL. Nothing is invented here — an unknown value stays visibly unknown,
 * and the caller keeps the honest NULLs alongside (inbound_emails.extracted_data)
 * so it stays auditable which facts the customer never gave.
 */

import type { Locale } from "./i18n/locale.ts";

/** Values as they arrive from a JSON body — never trusted, never coerced. */
type LooseValue = string | number | boolean | null | undefined;

export type LeadImportInput = Record<string, LooseValue>;

/** Mirrors `leads_source_check`. */
export type LeadSource =
  | "web_form"
  | "ai_voice"
  | "manual"
  | "import"
  | "widget"
  | "api"
  | "email";

export interface LeadMappingOptions {
  companyId: string;
  /** DOCUMENT locale — the language the customer wrote in. */
  language: Locale;
  source: LeadSource;
}

export const buildLeadInsert = (
  leadData: LeadImportInput,
  options: LeadMappingOptions,
): Record<string, unknown> => {
  const resolvedPlz = leadData.from_plz || leadData.plz || leadData.zip ||
    leadData.pickup_plz || "";

  const leadInsert: Record<string, unknown> = {
    company_id: options.companyId,
    language: options.language,
    customer_first_name: leadData.customer_first_name || "Unbekannt",
    customer_last_name: leadData.customer_last_name || "Unbekannt",
    customer_email: leadData.customer_email || "",
    customer_phone: leadData.customer_phone || "",
    service_type: leadData.service_type || "umzug_privat",
    preferred_date: leadData.preferred_date || null,
    preferred_time_slot: leadData.preferred_time_slot || null,
    description: leadData.description || null,
    status: "pending",
    source: options.source,
    from_plz: String(resolvedPlz).trim(),
    from_city: leadData.from_city || leadData.address_city || leadData.pickup_city ||
      "Unbekannt",
    form_version: 1,
    detailed_form_data: leadData,
  };

  const serviceType = leadData.service_type || "umzug_privat";

  if (serviceType === "umzug_privat" || serviceType === "umzug_firma") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      from_floor: leadData.from_floor ?? null,
      from_has_lift: leadData.from_has_lift ?? false,
      from_rooms: leadData.from_rooms ?? null,
      from_living_space_m2: leadData.from_living_space_m2 ?? null,
      to_street: leadData.to_street || null,
      to_house_number: leadData.to_house_number || null,
      to_plz: leadData.to_plz || null,
      to_city: leadData.to_city || null,
      to_floor: leadData.to_floor ?? null,
      to_has_lift: leadData.to_has_lift ?? false,
      packing_service_needed: leadData.packing_service_needed ?? false,
      cleaning_service_needed: leadData.cleaning_service_needed ?? false,
      storage_needed: leadData.storage_needed ?? false,
    });
  } else if (serviceType === "reinigung") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      from_rooms: leadData.from_rooms ?? null,
      from_living_space_m2: leadData.from_living_space_m2 ?? null,
      property_type: leadData.property_type || null,
      bathroom_count: leadData.bathroom_count ?? null,
      kitchen_type: leadData.kitchen_type || null,
      has_balcony: leadData.has_balcony ?? false,
      has_garage: leadData.has_garage ?? false,
      has_basement: leadData.has_basement ?? false,
      has_attic: leadData.has_attic ?? false,
    });
  } else if (serviceType === "raeumung") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      from_rooms: leadData.from_rooms ?? null,
      property_type: leadData.property_type || null,
      clearing_type: leadData.clearing_type || null,
      estimated_volume: leadData.estimated_volume || null,
      has_heavy_items: leadData.has_heavy_items ?? false,
      heavy_items_description: leadData.heavy_items_description || null,
    });
  } else if (serviceType === "entsorgung") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      disposal_type: leadData.disposal_type || null,
      items_description: leadData.items_description || null,
      estimated_volume: leadData.estimated_volume || null,
    });
  } else if (serviceType === "lagerung") {
    Object.assign(leadInsert, {
      pickup_street: leadData.pickup_street || null,
      pickup_house_number: leadData.pickup_house_number || null,
      pickup_floor: leadData.pickup_floor ?? null,
      pickup_has_lift: leadData.pickup_has_lift ?? false,
      storage_duration: leadData.storage_duration || null,
      storage_volume: leadData.storage_volume || null,
      access_frequency: leadData.access_frequency || null,
      needs_climate_control: leadData.needs_climate_control ?? false,
      storage_items_description: leadData.storage_items_description || null,
    });
  } else if (serviceType === "klaviertransport") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      from_floor: leadData.from_floor ?? null,
      from_has_lift: leadData.from_has_lift ?? false,
      to_street: leadData.to_street || null,
      to_house_number: leadData.to_house_number || null,
      to_plz: leadData.to_plz || null,
      to_city: leadData.to_city || null,
      to_floor: leadData.to_floor ?? null,
      to_has_lift: leadData.to_has_lift ?? false,
      piano_type: leadData.piano_type || null,
      piano_brand: leadData.piano_brand || null,
      piano_weight_kg: leadData.piano_weight_kg ?? null,
      staircase_type: leadData.staircase_type || null,
      staircase_width_cm: leadData.staircase_width_cm ?? null,
      window_access_possible: leadData.window_access_possible ?? false,
    });
  } else if (serviceType === "moebellift") {
    Object.assign(leadInsert, {
      from_street: leadData.from_street || null,
      from_house_number: leadData.from_house_number || null,
      moebellift_floor: leadData.moebellift_floor ?? null,
      moebellift_item_description: leadData.moebellift_item_description || null,
      moebellift_item_dimensions: leadData.moebellift_item_dimensions || null,
    });
  }

  return leadInsert;
};


/**
 * Validated model output (`extract-anfrage-ai` schema) → the input
 * `buildLeadInsert` expects.
 *
 * This is the same field-by-field mapping the manual-import preview performs
 * before it calls `import-manual-lead` (ManualImport.tsx). It has to exist a
 * second time here because a Deno edge function cannot import from `src/` —
 * the same deliberate duplication the repo already accepts for
 * `_shared/serviceLabels.ts` vs `src/lib/serviceLabels.ts`. It is kept
 * literal, field for field, so the two stay comparable by eye.
 *
 * Note on the phone number: the manual import runs `formatSwissPhone()` in the
 * browser before sending. There is no edge-side equivalent, so the number is
 * passed through as the customer wrote it rather than being reformatted by a
 * second, slightly different implementation.
 */
export const extractedToLeadInput = (
  serviceType: string,
  extracted: Record<string, string | number | boolean | null>,
): LeadImportInput => {
  const value = (field: string): LooseValue => {
    const raw = extracted[field];
    return raw === undefined ? null : raw;
  };
  const lowerCased = (field: string): LooseValue => {
    const raw = extracted[field];
    return typeof raw === "string" ? raw.toLowerCase() : null;
  };

  const leadData: LeadImportInput = {
    service_type: serviceType,
    customer_first_name: value("first_name"),
    customer_last_name: value("last_name"),
    customer_email: lowerCased("email"),
    customer_phone: value("phone"),
    preferred_date: value("preferred_date"),
    preferred_time_slot: value("preferred_time"),
    description: value("special_notes"),
  };

  if (serviceType === "umzug_privat" || serviceType === "umzug_firma") {
    return {
      ...leadData,
      from_street: value("from_street"),
      from_house_number: value("from_house_number"),
      from_plz: value("from_plz"),
      from_city: value("from_city"),
      from_floor: value("from_floor"),
      from_has_lift: value("from_has_elevator"),
      from_rooms: value("from_rooms"),
      from_living_space_m2: value("from_living_space_m2"),
      to_street: value("to_street"),
      to_house_number: value("to_house_number"),
      to_plz: value("to_plz"),
      to_city: value("to_city"),
      to_floor: value("to_floor"),
      to_has_lift: value("to_has_elevator"),
      packing_service_needed: value("packing_service_needed"),
      cleaning_service_needed: value("cleaning_service_needed"),
      storage_needed: value("storage_needed"),
    };
  }

  if (serviceType === "reinigung") {
    return {
      ...leadData,
      from_street: value("address_street"),
      from_house_number: value("address_house_number"),
      from_plz: value("address_plz"),
      from_city: value("address_city"),
      from_rooms: value("number_of_rooms"),
      from_living_space_m2: value("living_space_m2"),
      property_type: value("property_type"),
      bathroom_count: value("bathroom_count"),
      kitchen_type: value("kitchen_type"),
      has_balcony: value("has_balcony"),
      has_garage: value("has_garage"),
      has_basement: value("has_basement"),
      has_attic: value("has_attic"),
    };
  }

  if (serviceType === "raeumung") {
    return {
      ...leadData,
      from_street: value("address_street"),
      from_house_number: value("address_house_number"),
      from_plz: value("address_plz"),
      from_city: value("address_city"),
      from_rooms: value("number_of_rooms"),
      property_type: value("property_type"),
      clearing_type: value("clearing_type"),
      estimated_volume: value("estimated_volume"),
      has_heavy_items: value("has_heavy_items"),
      heavy_items_description: value("heavy_items_description"),
    };
  }

  if (serviceType === "entsorgung") {
    return {
      ...leadData,
      from_street: value("address_street"),
      from_house_number: value("address_house_number"),
      from_plz: value("address_plz"),
      from_city: value("address_city"),
      disposal_type: value("disposal_type"),
      items_description: value("items_description"),
      estimated_volume: value("estimated_volume"),
    };
  }

  if (serviceType === "lagerung") {
    return {
      ...leadData,
      pickup_street: value("pickup_street"),
      pickup_house_number: value("pickup_house_number"),
      from_plz: value("pickup_plz"),
      from_city: value("pickup_city"),
      pickup_floor: value("pickup_floor"),
      pickup_has_lift: value("pickup_has_elevator"),
      storage_duration: value("storage_duration"),
      storage_volume: value("storage_volume"),
      access_frequency: value("access_frequency"),
      needs_climate_control: value("needs_climate_control"),
      storage_items_description: value("storage_items_description"),
    };
  }

  if (serviceType === "klaviertransport") {
    return {
      ...leadData,
      from_street: value("from_street"),
      from_house_number: value("from_house_number"),
      from_plz: value("from_plz"),
      from_city: value("from_city"),
      from_floor: value("from_floor"),
      from_has_lift: value("from_has_elevator"),
      to_street: value("to_street"),
      to_house_number: value("to_house_number"),
      to_plz: value("to_plz"),
      to_city: value("to_city"),
      to_floor: value("to_floor"),
      to_has_lift: value("to_has_elevator"),
      piano_type: value("piano_type"),
      piano_brand: value("piano_brand"),
      piano_weight_kg: value("piano_weight_kg"),
      staircase_type: value("staircase_type"),
      staircase_width_cm: value("staircase_width_cm"),
      window_access_possible: value("window_access_possible"),
    };
  }

  if (serviceType === "moebellift") {
    return {
      ...leadData,
      from_street: value("address_street"),
      from_house_number: value("address_house_number"),
      from_plz: value("address_plz"),
      from_city: value("address_city"),
      moebellift_floor: value("moebellift_floor"),
      moebellift_item_description: value("moebellift_item_description"),
      moebellift_item_dimensions: value("moebellift_item_dimensions"),
    };
  }

  return leadData;
};
