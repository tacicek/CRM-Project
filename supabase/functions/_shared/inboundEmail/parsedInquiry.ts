/**
 * Strict validation of the model's output.
 *
 * The email is written by a stranger, so the model's answer is treated as
 * untrusted too: only known fields survive, every value is narrowed, every
 * number is range-checked. A model that answers `confidence_score: 5` (or a
 * string, or a nested object) must not be able to push a mail past the
 * auto-approve threshold, and an invented field must not reach the database.
 *
 * Pure — unit tested.
 */

import type { ExtractedLeadFields, ParsedInquiryResult } from "./types.ts";

/** Service taxonomy — identical to the one `extract-anfrage-ai` already uses. */
export const SERVICE_TYPES = [
  "umzug_privat",
  "umzug_firma",
  "reinigung",
  "raeumung",
  "entsorgung",
  "lagerung",
  "klaviertransport",
  "moebellift",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export type ParseFailure =
  | "not_json"
  | "not_an_object"
  | "missing_is_inquiry"
  | "missing_confidence";

export type ParseOutcome =
  | { ok: true; value: ParsedInquiryResult }
  | { ok: false; reason: ParseFailure };

type FieldKind =
  | { kind: "text"; max: number }
  | { kind: "plz" }
  | { kind: "date" }
  | { kind: "number"; min: number; max: number }
  | { kind: "boolean" };

const text = (max: number): FieldKind => ({ kind: "text", max });
const number = (min: number, max: number): FieldKind => ({ kind: "number", min, max });
const boolean: FieldKind = { kind: "boolean" };
const plz: FieldKind = { kind: "plz" };
const date: FieldKind = { kind: "date" };

/**
 * Whitelist of extractable fields. Anything the model invents is dropped here
 * rather than in the database. Names and semantics come from the existing
 * extraction schema — see `extract-anfrage-ai`.
 */
export const EXTRACTED_FIELDS: Record<string, FieldKind> = {
  // Contact
  first_name: text(100),
  last_name: text(100),
  email: text(200),
  phone: text(50),
  preferred_date: date,
  preferred_time: text(50),
  special_notes: text(4_000),

  // Origin address (Umzug, Klaviertransport)
  from_street: text(200),
  from_house_number: text(20),
  from_plz: plz,
  from_city: text(100),
  // Basements exist; 200th floors do not.
  from_floor: number(-5, 99),
  from_has_elevator: boolean,
  from_has_estrich: boolean,
  from_has_keller: boolean,
  from_rooms: number(0.5, 30),
  from_living_space_m2: number(1, 10_000),

  // Destination address
  to_street: text(200),
  to_house_number: text(20),
  to_plz: plz,
  to_city: text(100),
  to_floor: number(-5, 99),
  to_has_elevator: boolean,

  // Single-address services (Reinigung, Räumung, Entsorgung, Möbellift)
  address_street: text(200),
  address_house_number: text(20),
  address_plz: plz,
  address_city: text(100),

  // Umzug extras
  packing_service_needed: boolean,
  furniture_assembly_needed: boolean,
  cleaning_service_needed: boolean,
  storage_needed: boolean,
  piano_transport_needed: boolean,

  // Reinigung
  property_type: text(50),
  number_of_rooms: number(0.5, 30),
  living_space_m2: number(1, 10_000),
  bathroom_count: number(0, 20),
  kitchen_type: text(50),
  has_balcony: boolean,
  has_garage: boolean,
  has_basement: boolean,
  has_attic: boolean,
  cleaning_type: text(50),

  // Räumung / Entsorgung
  clearing_type: text(50),
  estimated_volume: text(50),
  has_heavy_items: boolean,
  heavy_items_description: text(500),
  disposal_type: text(50),
  items_description: text(500),

  // Lagerung
  pickup_street: text(200),
  pickup_house_number: text(20),
  pickup_plz: plz,
  pickup_city: text(100),
  pickup_floor: number(-5, 99),
  pickup_has_elevator: boolean,
  storage_duration: text(50),
  storage_volume: text(50),
  access_frequency: text(50),
  needs_climate_control: boolean,
  storage_items_description: text(500),

  // Klaviertransport
  piano_type: text(30),
  piano_brand: text(50),
  piano_weight_kg: number(1, 2_000),
  staircase_type: text(30),
  staircase_width_cm: number(10, 500),
  window_access_possible: boolean,

  // Möbellift
  moebellift_floor: number(-5, 99),
  moebellift_item_description: text(500),
  moebellift_item_dimensions: text(100),
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed.slice(0, maxLength);
};

const asNumber = (value: unknown, min: number, max: number): number | null => {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : NaN;
  if (!Number.isFinite(parsed)) return null;
  return parsed < min || parsed > max ? null : parsed;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const asIsoDate = (value: unknown): string | null => {
  const raw = asText(value, 10);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  // Rejects 2026-02-31 and friends — Date normalises them, so compare back.
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === raw ? raw : null;
};

const asPlz = (value: unknown): string | null => {
  const raw = asText(value, 10);
  return raw && /^\d{4}$/.test(raw) ? raw : null;
};

const asLanguage = (value: unknown): "de" | "fr" | "en" => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return raw === "fr" || raw === "en" ? raw : "de";
};

export const asServiceType = (value: unknown): ServiceType | null => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (SERVICE_TYPES as readonly string[]).includes(raw)
    ? (raw as ServiceType)
    : null;
};

const asStringList = (value: unknown, maxItems = 20): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asText(entry, 60))
    .filter((entry): entry is string => entry !== null)
    .slice(0, maxItems);
};

const validateField = (spec: FieldKind, value: unknown): string | number | boolean | null => {
  switch (spec.kind) {
    case "text":
      return asText(value, spec.max);
    case "number":
      return asNumber(value, spec.min, spec.max);
    case "boolean":
      return asBoolean(value);
    case "plz":
      return asPlz(value);
    case "date":
      return asIsoDate(value);
  }
};

export const extractKnownFields = (
  raw: Record<string, unknown> | null,
): ExtractedLeadFields => {
  const source = raw ?? {};
  const out: ExtractedLeadFields = {};
  for (const [field, spec] of Object.entries(EXTRACTED_FIELDS)) {
    if (!(field in source)) continue;
    const value = validateField(spec, source[field]);
    // A field the model filled with garbage is the same as a field it never
    // filled — the review UI must show "missing", not a wrong value.
    if (value !== null) out[field] = value;
  }
  return out;
};

/**
 * Strip the ```json fences some models wrap their answer in, then validate.
 * Same unwrapping `extract-anfrage-ai` does today.
 */
export const parseInquiryResult = (responseText: string): ParseOutcome => {
  const cleaned = responseText
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  let payload: unknown;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "not_json" };
  }

  const root = asRecord(payload);
  if (!root) return { ok: false, reason: "not_an_object" };

  const isInquiry = asBoolean(root.is_inquiry);
  if (isInquiry === null) return { ok: false, reason: "missing_is_inquiry" };

  // Clamping would let a nonsense 5.0 become 1.0 and auto-create a lead. An
  // out-of-range score means the whole answer is untrustworthy.
  const confidence = asNumber(root.confidence_score, 0, 1);
  if (confidence === null) return { ok: false, reason: "missing_confidence" };

  return {
    ok: true,
    value: {
      isInquiry,
      serviceType: asServiceType(root.detected_service_type),
      language: asLanguage(root.language),
      confidenceScore: confidence,
      rejectionReason: asText(root.rejection_reason, 300),
      missingCriticalFields: asStringList(root.missing_critical_fields),
      extracted: extractKnownFields(root),
    },
  };
};
