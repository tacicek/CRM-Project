/**
 * Pure builders that turn an AuftragModal form draft into the generated Supabase
 * `auftraege` Insert / Update payloads.
 *
 * Why this exists: the modal currently spreads its form-draft object straight into
 * `.insert()` / `.update()`. That draft carries a plain `status: string` (vs the
 * `auftrag_status` enum), and `items` / `extra_services` / `service_details` typed as named
 * interfaces / `Record<string, unknown>` (none of which are assignable to the columns'
 * `Json` type). These factories re-materialise each field explicitly — status is parsed to
 * the enum, the three JSON columns are serialized field-by-field with finite-number checks,
 * and nothing outside the listed columns can leak in. No cast, no stringify, no spread.
 *
 * Insert and Update are deliberately SEPARATE factories (§8): Insert emits `company_id`,
 * the `auftrag_nummer` trigger sentinel, `appointment_id` and `language`; Update emits none
 * of those. Reminder-reset and appointment schedule-stripping stay in the wiring layer.
 */
import type { Database, Json } from "@/integrations/supabase/types";
import type { AuftragItem, AuftragExtraService, AuftragServiceDetails } from "@/lib/auftragSnapshot";
import { isAuftragStatus, type AuftragStatus } from "@/lib/auftragStatus";

type AuftragInsert = Database["public"]["Tables"]["auftraege"]["Insert"];
export type AuftragUpdate = Database["public"]["Tables"]["auftraege"]["Update"];

export type AuftragPayloadReason =
  | "invalid_status"
  | "invalid_items"
  | "invalid_extra_services"
  | "invalid_service_details"
  | "invalid_number";

/** The `service_details` PERSISTENCE contract — flat primitives only. Distinct from the
 * read-side `AuftragServiceDetails = Record<string, unknown>`: what we accept back out of the
 * DB is wider than what we allow writing in. */
export type AuftragServiceDetailValue = string | number | boolean | null;
export type PersistedAuftragServiceDetails = Record<string, AuftragServiceDetailValue>;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isFiniteOrNull = (v: number | null | undefined): boolean =>
  v === null || v === undefined || isFiniteNumber(v);

// ============================================================
// Status
// ============================================================

/**
 * Parse an unknown form/DB value to the `auftrag_status` enum. Reuses the canonical guard
 * from auftragStatus.ts (no parallel value set). Unknown/empty/non-string → failure; never
 * coerced to `geplant`. Pure.
 */
export const parseAuftragStatus = (
  value: unknown,
): { ok: true; value: AuftragStatus } | { ok: false } =>
  typeof value === "string" && isAuftragStatus(value) ? { ok: true, value } : { ok: false };

// ============================================================
// JSON serializers
// ============================================================

export const serializeAuftragItems = (
  items: AuftragItem[],
): { ok: true; value: Json } | { ok: false; reason: "invalid_items" } => {
  const out: Json[] = [];
  for (const it of items) {
    if (!isFiniteNumber(it.position) || !isFiniteNumber(it.quantity) || !isFiniteNumber(it.unit_price)) {
      return { ok: false, reason: "invalid_items" };
    }
    if (it.total !== null && it.total !== undefined && !isFiniteNumber(it.total)) {
      return { ok: false, reason: "invalid_items" };
    }
    // Only the known columns are copied — unknown UI keys cannot leak into the payload.
    const entry: Json = {
      id: it.id,
      position: it.position,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit ?? null,
      unit_price: it.unit_price,
      total: it.total ?? null,
      price_type: it.price_type ?? null,
    };
    out.push(entry);
  }
  return { ok: true, value: out };
};

export const serializeAuftragExtraServices = (
  extras: AuftragExtraService[],
): { ok: true; value: Json } | { ok: false; reason: "invalid_extra_services" } => {
  const out: Json[] = [];
  for (const ex of extras) {
    if (!isFiniteNumber(ex.quantity) || !isFiniteNumber(ex.unit_price)) {
      return { ok: false, reason: "invalid_extra_services" };
    }
    const entry: Json = {
      id: ex.id,
      description: ex.description,
      quantity: ex.quantity,
      unit: ex.unit,
      unit_price: ex.unit_price,
    };
    out.push(entry);
  }
  return { ok: true, value: out };
};

/**
 * Serialize the `service_details` snapshot for persistence. The writer (buildServiceDetails)
 * emits a flat object of primitives; this enforces that contract — every value must be
 * string / boolean / null or a FINITE number. Nested object, array, undefined, NaN, Infinity
 * → failure (never silently dropped). Keys are preserved; input is not mutated.
 */
export const serializeAuftragServiceDetails = (
  details: AuftragServiceDetails,
): { ok: true; value: Json } | { ok: false; reason: "invalid_service_details" } => {
  const out: PersistedAuftragServiceDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === null) { out[key] = null; continue; }
    if (typeof value === "string") { out[key] = value; continue; }
    if (typeof value === "boolean") { out[key] = value; continue; }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { ok: false, reason: "invalid_service_details" };
      out[key] = value;
      continue;
    }
    // array / nested object / undefined / symbol / function
    return { ok: false, reason: "invalid_service_details" };
  }
  return { ok: true, value: out };
};

// ============================================================
// Payload source models
// ============================================================

/** The editable fields shared by create and edit — resolved from the modal form + context.
 * Deliberately excludes nested relations, UI/open/loading state, labels and callbacks. */
export interface AuftragPayloadSource {
  companyId: string;
  offerId: string | null;
  leadId: string | null;
  title: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  scheduledDate: string; // already formatted "yyyy-MM-dd" by the caller
  scheduledTime: string | null;
  estimatedDurationMinutes: number | null;
  description: string | null;
  specialInstructions: string | null;
  internalNotes: string | null;
  teamLeaderId: string | null;
  assignedTeamMembers: string[];
  reminderDaysBefore: number;
  status: unknown; // parsed to the enum
  serviceType: string | null;
  pricingType: string | null;
  hourlyRate: number | null;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  total: number | null;
  completedAt: string | null;
  items: AuftragItem[];
  extraServices: AuftragExtraService[];
  serviceDetails: AuftragServiceDetails;
}

/** Insert-only extras: the canonical service appointment and the frozen document language. */
export interface AuftragInsertExtra {
  appointmentId: string | null;
  language: string;
}

const financialsAreFinite = (s: AuftragPayloadSource): boolean =>
  isFiniteOrNull(s.hourlyRate) &&
  isFiniteOrNull(s.subtotal) &&
  isFiniteOrNull(s.vatRate) &&
  isFiniteOrNull(s.vatAmount) &&
  isFiniteOrNull(s.total);

// ============================================================
// Factories
// ============================================================

/**
 * Build the generated `auftraege` INSERT payload. Explicit field list — no spread, no UI
 * leak. `auftrag_nummer: ""` is the trigger sentinel (see below). Financial snapshot values
 * pass through untouched (not recomputed/rounded), but NaN/Infinity are rejected.
 */
export const buildAuftragInsertPayload = (
  source: AuftragPayloadSource,
  extra: AuftragInsertExtra,
): { ok: true; value: AuftragInsert } | { ok: false; reason: AuftragPayloadReason } => {
  const status = parseAuftragStatus(source.status);
  if (!status.ok) return { ok: false, reason: "invalid_status" };
  if (!financialsAreFinite(source)) return { ok: false, reason: "invalid_number" };

  const items = serializeAuftragItems(source.items);
  if (!items.ok) return { ok: false, reason: "invalid_items" };
  const extras = serializeAuftragExtraServices(source.extraServices);
  if (!extras.ok) return { ok: false, reason: "invalid_extra_services" };
  const details = serializeAuftragServiceDetails(source.serviceDetails);
  if (!details.ok) return { ok: false, reason: "invalid_service_details" };

  const value: AuftragInsert = {
    company_id: source.companyId,
    // Trigger sentinel: the column is NOT NULL with no schema default, so the generated
    // Insert type marks `auftrag_nummer` required. `set_auftrag_nummer` (BEFORE INSERT)
    // overwrites this empty string with the real number — the client never computes it.
    auftrag_nummer: "",
    offer_id: source.offerId,
    lead_id: source.leadId,
    appointment_id: extra.appointmentId,
    language: extra.language,
    title: source.title,
    customer_name: source.customerName,
    customer_email: source.customerEmail,
    customer_phone: source.customerPhone,
    from_address: source.fromAddress,
    to_address: source.toAddress,
    scheduled_date: source.scheduledDate,
    scheduled_time: source.scheduledTime,
    estimated_duration_minutes: source.estimatedDurationMinutes,
    description: source.description,
    special_instructions: source.specialInstructions,
    internal_notes: source.internalNotes,
    team_leader_id: source.teamLeaderId,
    assigned_team_members: source.assignedTeamMembers,
    reminder_days_before: source.reminderDaysBefore,
    status: status.value,
    service_type: source.serviceType,
    pricing_type: source.pricingType,
    hourly_rate: source.hourlyRate,
    subtotal: source.subtotal,
    vat_rate: source.vatRate,
    vat_amount: source.vatAmount,
    total: source.total,
    items: items.value,
    extra_services: extras.value,
    service_details: details.value,
    completed_at: source.completedAt,
  };
  return { ok: true, value };
};

/**
 * Reschedule side of the update: reset the four reminder flags ONLY when the schedule
 * actually changed, so an unrelated edit never clears a sent reminder. Returns a fresh
 * payload (never mutates). These fields are deliberately NOT in the base factory.
 */
export const applyAuftragRescheduleReset = (
  payload: AuftragUpdate,
  didScheduleChange: boolean,
): AuftragUpdate =>
  didScheduleChange
    ? {
        ...payload,
        team_reminder_sent: false,
        reminder_sent_at: null,
        customer_reminder_sent: false,
        customer_reminder_sent_at: null,
      }
    : payload;

/**
 * Drop the schedule columns from an update payload. Used when a linked appointment owns the
 * canonical time (a trigger mirrors it back to auftrag.scheduled_*). Fresh object, no cast,
 * no mutation, no `delete`.
 */
export const stripAuftragSchedule = (payload: AuftragUpdate): AuftragUpdate => {
  const { scheduled_date: _sd, scheduled_time: _st, estimated_duration_minutes: _edm, ...rest } = payload;
  return rest;
};

/**
 * Build the generated `auftraege` UPDATE payload. Emits only editable columns — never
 * `auftrag_nummer` (immutable, trigger-owned), `company_id` (immutable), `appointment_id`
 * or `language` (create-only). Reminder-reset fields are NOT added here; the wiring layer
 * merges them only on a reschedule.
 */
export const buildAuftragUpdatePayload = (
  source: AuftragPayloadSource,
): { ok: true; value: AuftragUpdate } | { ok: false; reason: AuftragPayloadReason } => {
  const status = parseAuftragStatus(source.status);
  if (!status.ok) return { ok: false, reason: "invalid_status" };
  if (!financialsAreFinite(source)) return { ok: false, reason: "invalid_number" };

  const items = serializeAuftragItems(source.items);
  if (!items.ok) return { ok: false, reason: "invalid_items" };
  const extras = serializeAuftragExtraServices(source.extraServices);
  if (!extras.ok) return { ok: false, reason: "invalid_extra_services" };
  const details = serializeAuftragServiceDetails(source.serviceDetails);
  if (!details.ok) return { ok: false, reason: "invalid_service_details" };

  const value: AuftragUpdate = {
    offer_id: source.offerId,
    lead_id: source.leadId,
    title: source.title,
    customer_name: source.customerName,
    customer_email: source.customerEmail,
    customer_phone: source.customerPhone,
    from_address: source.fromAddress,
    to_address: source.toAddress,
    scheduled_date: source.scheduledDate,
    scheduled_time: source.scheduledTime,
    estimated_duration_minutes: source.estimatedDurationMinutes,
    description: source.description,
    special_instructions: source.specialInstructions,
    internal_notes: source.internalNotes,
    team_leader_id: source.teamLeaderId,
    assigned_team_members: source.assignedTeamMembers,
    reminder_days_before: source.reminderDaysBefore,
    status: status.value,
    service_type: source.serviceType,
    pricing_type: source.pricingType,
    hourly_rate: source.hourlyRate,
    subtotal: source.subtotal,
    vat_rate: source.vatRate,
    vat_amount: source.vatAmount,
    total: source.total,
    items: items.value,
    extra_services: extras.value,
    service_details: details.value,
    completed_at: source.completedAt,
  };
  return { ok: true, value };
};
