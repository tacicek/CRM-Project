/**
 * Canonical `umzugsbox_rentals.box_items` snapshot type + pure parser.
 *
 * `box_items` is a JSONB column (generated type `Json | null`) written by UmzugsboxModal as
 * an array of `{ type, quantity }`. The list/PDF consumers currently read it through an
 * unchecked `as UmzugsboxRental[]` cast. This parser is the validated boundary that will
 * replace that cast (5D.2B); it is intentionally NOT wired here.
 *
 * Semantics (product-decided, Batch 5D.2A):
 *   - null / empty array  → `source:"legacy"` (fall back to the legacy box_type/box_quantity)
 *   - undefined / non-array / ANY malformed item → failure (never coerced to legacy or [])
 *   - a valid non-empty array → canonical, freshly-built BoxItem[] (extra keys stripped)
 * No silent filtering, no mutation, no cast. An unknown/legacy `type` string is preserved.
 */

import type { Database } from "@/integrations/supabase/types";

export interface BoxItem {
  type: string;
  quantity: number;
}

export type BoxItemsSnapshotResult =
  | { ok: true; source: "items"; value: BoxItem[] }
  | { ok: true; source: "legacy"; value: null }
  | { ok: false; reason: "invalid_box_items" };

/** A JSON object literal — not an array, not an exotic object (Date/Map/class instance). */
const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** A non-empty, non-whitespace string (an unknown legacy value is still valid — kept raw). */
const isValidType = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** A finite number strictly greater than 0 (a positive fraction is valid). */
const isValidQuantity = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

export function parseBoxItemsSnapshot(raw: unknown): BoxItemsSnapshotResult {
  if (raw === null) return { ok: true, source: "legacy", value: null };
  if (!Array.isArray(raw)) return { ok: false, reason: "invalid_box_items" };
  if (raw.length === 0) return { ok: true, source: "legacy", value: null };

  const value: BoxItem[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return { ok: false, reason: "invalid_box_items" };
    if (!isValidType(item.type)) return { ok: false, reason: "invalid_box_items" };
    if (!isValidQuantity(item.quantity)) return { ok: false, reason: "invalid_box_items" };
    // Fresh object with only the canonical keys — extra keys are not carried through.
    value.push({ type: item.type, quantity: item.quantity });
  }
  return { ok: true, source: "items", value };
}

// ============================================================
// Row → validated view-model
// ============================================================

/** The raw generated row (box_items is the untyped `Json` column). */
export type UmzugsboxRentalRow = Database["public"]["Tables"]["umzugsbox_rentals"]["Row"];

/** Every generated column EXCEPT the raw JSON snapshot — nullability preserved verbatim. */
export type UmzugsboxRentalBase = Omit<UmzugsboxRentalRow, "box_items">;

/** The validated rental: generated row with `box_items` narrowed to the canonical shape. */
export type UmzugsboxRental = UmzugsboxRentalBase & {
  box_items: BoxItem[] | null;
};

export type UmzugsboxRentalEntry =
  | { kind: "valid"; rental: UmzugsboxRental }
  | { kind: "invalid_snapshot"; row: UmzugsboxRentalBase; reason: "box_items" };

/**
 * Narrow a raw `umzugsbox_rentals` row into a validated entry. `box_items` is parsed by
 * `parseBoxItemsSnapshot`; a valid array (or null/[] → legacy) yields a `valid` entry with
 * `box_items` narrowed (legacy → null), while a malformed/non-array snapshot yields an
 * `invalid_snapshot` that carries the safe scalar/relation row (every generated column,
 * nullability intact) but NEVER the raw JSON. Pure; no cast, no mutation, no defaulting of
 * nullable scalars, no change to financials/status/dates.
 */
export function mapUmzugsboxRentalRow(row: UmzugsboxRentalRow): UmzugsboxRentalEntry {
  const { box_items, ...base } = row;
  const parsed = parseBoxItemsSnapshot(box_items);
  if (!parsed.ok) return { kind: "invalid_snapshot", row: base, reason: "box_items" };
  return { kind: "valid", rental: { ...base, box_items: parsed.value } };
}
