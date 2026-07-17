/**
 * Fail-closed validation for the three JSON snapshot columns on `auftraege`:
 *   - `items`           → the frozen offer line items (auftraege.items: Json | null)
 *   - `extra_services`  → on-site extra services (auftraege.extra_services: Json | null)
 *   - `service_details` → flat service-specific snapshot (auftraege.service_details: Json | null)
 *
 * Writer-verified shapes (AuftragModal writes `items` + `service_details`, SahaExtrasModal
 * writes `extra_services`) — a single format each, no legacy variants. These types match the
 * hand-maintained interfaces those files used inline; centralising them here removes the
 * duplication and gives a testable boundary.
 *
 * Contract (same as offerSurcharges.validateSurcharges): null/undefined → valid empty
 * list/object; a wrong container or ANY malformed item → failure (never silently coerced
 * to []/{} or filtered). Pure — no mutation, no cast, no rounding of amounts.
 *
 * Also exposes the Auftraege list view-model: `mapAuftragRow` narrows a raw query row into
 * a discriminated `AuftragListEntry` (valid snapshot vs invalid_snapshot), so the page can
 * drop its `as Auftrag[]` cast while keeping malformed records visible.
 */
import type { Database } from "@/integrations/supabase/types";

export interface AuftragItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number | null;
  price_type?: string | null;
}

export interface AuftragExtraService {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export type AuftragItemsResult = { ok: true; value: AuftragItem[] } | { ok: false };
export type ExtraServicesResult = { ok: true; value: AuftragExtraService[] } | { ok: false };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isNullableString = (v: unknown): boolean => v === null || v === undefined || typeof v === "string";

const isAuftragItem = (p: unknown): p is AuftragItem =>
  isRecord(p) &&
  typeof p.id === "string" &&
  isFiniteNumber(p.position) &&
  typeof p.description === "string" &&
  isFiniteNumber(p.quantity) &&
  isNullableString(p.unit) &&
  isFiniteNumber(p.unit_price) &&
  (p.total === null || p.total === undefined || isFiniteNumber(p.total)) &&
  isNullableString(p.price_type);

const isExtraService = (p: unknown): p is AuftragExtraService =>
  isRecord(p) &&
  typeof p.id === "string" &&
  typeof p.description === "string" &&
  isFiniteNumber(p.quantity) &&
  typeof p.unit === "string" &&
  isFiniteNumber(p.unit_price);

export const validateAuftragItems = (raw: unknown): AuftragItemsResult => {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false };
  const valid = raw.filter(isAuftragItem);
  return valid.length === raw.length ? { ok: true, value: valid } : { ok: false };
};

export const validateExtraServices = (raw: unknown): ExtraServicesResult => {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false };
  const valid = raw.filter(isExtraService);
  return valid.length === raw.length ? { ok: true, value: valid } : { ok: false };
};

// ============================================================
// service_details — flat snapshot object
// ============================================================

/**
 * The `auftraege.service_details` snapshot. The writer (AuftragModal.buildServiceDetails)
 * emits a FLAT object whose keys vary by service_type (umzug/reinigung/…); the sibling
 * `service_type` column is the discriminator, not a field inside this object. Values are
 * JSON primitives. Not a financial source.
 */
export type AuftragServiceDetails = Record<string, unknown>;
export type ServiceDetailsResult = { ok: true; value: AuftragServiceDetails } | { ok: false };

/**
 * A JSON object literal — not an array, and not an exotic object (Date, Map, Set, class
 * instance). `isRecord` above is deliberately looser (it gates per-field checks that would
 * themselves reject a Date); service_details accepts arbitrary keys, so nothing downstream
 * would catch a non-plain object — hence the prototype check here.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Fail-closed validation of `auftraege.service_details` (Json | null, DB DEFAULT '{}').
 * Validates only the CONTAINER — per-key shapes are writer-variadic and readers are
 * tolerant, so we do not invent per-key schemas. null/undefined → valid empty object;
 * `{}` and any plain object → success; array / primitive / exotic object → failure.
 * Pure; returns the same reference (no mutation, no cast).
 */
export const validateServiceDetails = (raw: unknown): ServiceDetailsResult => {
  if (raw === null || raw === undefined) return { ok: true, value: {} };
  if (!isPlainObject(raw)) return { ok: false };
  return { ok: true, value: raw };
};

// ============================================================
// Auftraege list query → discriminated view-model
// ============================================================

type AuftragRow = Database["public"]["Tables"]["auftraege"]["Row"];

/** offer:offer_id (id, title) — offers.id/title are both NOT NULL; the relation itself is nullable (FK ON DELETE SET NULL). */
export interface AuftragOfferRelation {
  id: string;
  title: string;
}

/** team_leader:team_leader_id (first_name, last_name, email, phone) — team_members; FK ON DELETE SET NULL. */
export interface AuftragTeamLeaderRelation {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

/** The exact row shape the Auftraege list select returns: base row + the two embeds. */
export type AuftragQueryRow = AuftragRow & {
  offer: AuftragOfferRelation | null;
  team_leader: AuftragTeamLeaderRelation | null;
};

/**
 * Safe scalar/relation projection: the raw JSON snapshot columns removed. Every remaining
 * field keeps its generated nullability (status enum | null, nullable scalars, both
 * relations) — no defaults are applied at this layer.
 */
export type AuftragRowSafe = Omit<AuftragQueryRow, "items" | "extra_services" | "service_details">;

export type AuftragListEntry =
  | {
      kind: "valid";
      row: AuftragRowSafe;
      items: AuftragItem[];
      extraServices: AuftragExtraService[];
      serviceDetails: AuftragServiceDetails;
    }
  | {
      kind: "invalid_snapshot";
      row: AuftragRowSafe;
      reason: "items" | "extra_services" | "service_details";
    };

/**
 * Narrow a raw Auftraege query row into a list view-model. Validation order is
 * deterministic (items → extra_services → service_details); the FIRST failing field sets
 * `reason`. The invalid variant carries the safe scalar/relation row (so the list still
 * renders the record) but NEVER the raw JSON. Financial snapshot fields, `status`
 * (enum | null — null preserved), and every nullable scalar pass through untouched — this
 * layer invents no defaults. Pure; does not mutate the input row.
 */
export const mapAuftragRow = (row: AuftragQueryRow): AuftragListEntry => {
  const { items: rawItems, extra_services: rawExtras, service_details: rawDetails, ...safe } = row;
  const items = validateAuftragItems(rawItems);
  if (!items.ok) return { kind: "invalid_snapshot", row: safe, reason: "items" };
  const extraServices = validateExtraServices(rawExtras);
  if (!extraServices.ok) return { kind: "invalid_snapshot", row: safe, reason: "extra_services" };
  const serviceDetails = validateServiceDetails(rawDetails);
  if (!serviceDetails.ok) return { kind: "invalid_snapshot", row: safe, reason: "service_details" };
  return {
    kind: "valid",
    row: safe,
    items: items.value,
    extraServices: extraServices.value,
    serviceDetails: serviceDetails.value,
  };
};

/**
 * JSON-dependent actions (Edit, PDF download, Saha-Extras, Quittung, Rechnung) need a
 * validated snapshot; status transitions and archive do not. The UI wiring (4B.1B-ii)
 * decides how to apply this — this helper only states the rule.
 */
export const canUseAuftragSnapshotActions = (entry: AuftragListEntry): boolean =>
  entry.kind === "valid";

export type AuftragPricingType = "fixed" | "hourly" | "estimate";

/**
 * UI-boundary narrowing of the free-text `pricing_type` column (Row: string | null) to the
 * modal/dialog union. An unknown/legacy string is not a valid pricing type → null (the form
 * already falls back to "fixed"). Product-semantic normalisation done AT the UI edge — the
 * mapper itself invents no defaults.
 */
export const toAuftragPricingType = (value: string | null): AuftragPricingType | null =>
  value === "fixed" || value === "hourly" || value === "estimate" ? value : null;
