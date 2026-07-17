/**
 * The slice of a `leads` row that AuftragModal reads when pre-filling a new Auftrag from an
 * offer's lead, plus the pure `service_details` snapshot builder.
 *
 * `AuftragLead` is a `Pick` over the generated `leads.Row` — never a hand-copied interface —
 * so it can never drift from the schema. The old inline `Lead` interface carried a phantom
 * `piano_transport_needed` column that does not exist on `leads`; the piano-transport signal
 * is instead DERIVED here with the project's canonical rule (see `hasPianoTransportDetails`).
 */
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

/** Exactly the `leads` columns AuftragModal consumes (address, language, and every field the
 * service-details builder reads). `piano_transport_needed` is intentionally absent — it is
 * not a column and is derived from `piano_type` / `piano_weight_kg`. */
export type AuftragLead = Pick<
  LeadRow,
  | "service_type"
  | "language"
  | "description"
  | "estimated_duration_minutes"
  // Origin address
  | "from_street"
  | "from_house_number"
  | "from_plz"
  | "from_city"
  | "from_floor"
  | "from_has_lift"
  // Destination address
  | "to_street"
  | "to_house_number"
  | "to_plz"
  | "to_city"
  | "to_floor"
  | "to_has_lift"
  // Umzug
  | "from_rooms"
  | "from_living_space_m2"
  | "property_type"
  | "distance_km"
  | "packing_service_needed"
  | "cleaning_service_needed"
  | "storage_needed"
  | "piano_type"
  | "piano_weight_kg"
  // Reinigung
  | "bathroom_count"
  | "kitchen_type"
  | "has_balcony"
  | "has_garage"
  | "has_basement"
  | "has_attic"
  | "cleaning_windows"
  // Räumung
  | "clearing_type"
  | "estimated_volume"
  | "has_heavy_items"
  | "heavy_items_description"
  // Lagerung
  | "storage_duration"
  | "storage_volume"
>;

/**
 * Canonical "does this lead need piano transport?" rule. `leads` has NO boolean flag for it —
 * the signal is the presence of piano data, exactly as the offer-header migration freezes it:
 *   frozen_has_klavier = (l.piano_type IS NOT NULL OR l.piano_weight_kg IS NOT NULL)
 * `piano_brand` alone is deliberately NOT a signal. Mirrors SQL `IS NOT NULL` with `!== null`
 * (a stored empty string counts as present, matching the frozen rule). Pure; no mutation.
 */
export const hasPianoTransportDetails = (
  lead: Pick<LeadRow, "piano_type" | "piano_weight_kg">,
): boolean => lead.piano_type !== null || lead.piano_weight_kg !== null;

/**
 * Build the `auftraege.service_details` snapshot from a lead, keyed by service type. Pure:
 * reads `leadData`, returns a fresh object, mutates nothing. Sibling flags pass through with
 * their raw nullable values; `piano_transport_needed` is the one derived boolean.
 */
export const buildServiceDetails = (leadData: AuftragLead): Record<string, unknown> => {
  const details: Record<string, unknown> = {};

  switch (leadData.service_type) {
    case "umzug":
      details.from_rooms = leadData.from_rooms;
      details.from_living_space_m2 = leadData.from_living_space_m2;
      details.from_floor = leadData.from_floor;
      details.from_has_lift = leadData.from_has_lift;
      details.to_floor = leadData.to_floor;
      details.to_has_lift = leadData.to_has_lift;
      details.property_type = leadData.property_type;
      details.distance_km = leadData.distance_km;
      details.packing_service_needed = leadData.packing_service_needed;
      details.cleaning_service_needed = leadData.cleaning_service_needed;
      details.storage_needed = leadData.storage_needed;
      details.piano_transport_needed = hasPianoTransportDetails(leadData);
      break;

    case "reinigung":
      details.from_rooms = leadData.from_rooms;
      details.from_living_space_m2 = leadData.from_living_space_m2;
      details.bathroom_count = leadData.bathroom_count;
      details.kitchen_type = leadData.kitchen_type;
      details.has_balcony = leadData.has_balcony;
      details.has_garage = leadData.has_garage;
      details.has_basement = leadData.has_basement;
      details.has_attic = leadData.has_attic;
      details.cleaning_windows = leadData.cleaning_windows;
      break;

    case "klaviertransport":
      details.piano_type = leadData.piano_type;
      details.piano_weight_kg = leadData.piano_weight_kg;
      details.from_floor = leadData.from_floor;
      details.from_has_lift = leadData.from_has_lift;
      details.to_floor = leadData.to_floor;
      details.to_has_lift = leadData.to_has_lift;
      details.distance_km = leadData.distance_km;
      break;

    case "raeumung":
      details.clearing_type = leadData.clearing_type;
      details.estimated_volume = leadData.estimated_volume;
      details.has_heavy_items = leadData.has_heavy_items;
      details.heavy_items_description = leadData.heavy_items_description;
      break;

    case "lagerung":
      details.storage_duration = leadData.storage_duration;
      details.storage_volume = leadData.storage_volume;
      break;
  }

  return details;
};
