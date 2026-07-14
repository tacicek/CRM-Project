import { getServiceLabel } from "@/i18n/domain";
import type { Locale } from "@/i18n/locale";
// Canonical service-type normalization — single source for offer_items STAMPING (reference §3).
//
// ⚠️ Lesson #1/#3: This fn is for STAMPING (which single base an item belongs to). The existing
// `normalizeServiceTypeForAgb` (AGB lookup) and `getServiceTypeCandidates` (catalog IN-lookup)
// serve DIFFERENT needs (multi-candidate) — they were left untouched and stay in place. This is NOT
// a third conflicting mapper; it is the canonical one that resolves the conflicts of those two with
// approved decisions.
//
// Approved taxonomy (D1-D6):
//   D1 transport_moebel / moebel_transport → transport
//   D2 klaviertransport / *klavier*        → transport
//   D3 moebellift / moebellift_*           → moebellift (separate base — split off from umzug)
//   D4 malerarbeit / renovation            → null (no base in the catalog → Allgemein)
//   D5 lagerung_*                          → lagerung
//   D6 entrümpelung / entruempelung (ü+ue) → raeumung
//   raeumung ≠ entsorgung (separate — Lesson #3)

export type CatalogBase =
  | "umzug"
  | "moebellift"
  | "reinigung"
  | "raeumung"
  | "entsorgung"
  | "transport"
  | "lagerung";

// Exact matches (from the two existing mappers + approved decisions). null = deliberate "no base".
const EXACT = new Map<string, CatalogBase | null>([
  // umzug
  ["umzug", "umzug"],
  ["umzug_privat", "umzug"],
  ["umzug_firma", "umzug"],
  ["umzug_buero", "umzug"],
  ["umzug_international", "umzug"],
  ["privatumzug", "umzug"],
  ["firmenumzug", "umzug"],
  ["moebellift", "moebellift"], // D3 (separate base)
  // reinigung
  ["reinigung", "reinigung"],
  ["endreinigung", "reinigung"],
  ["grundreinigung", "reinigung"],
  ["umzugsreinigung", "reinigung"],
  ["reinigung_umzug", "reinigung"],
  ["reinigung_bau", "reinigung"],
  ["reinigung_buero", "reinigung"],
  ["reinigung_end", "reinigung"],
  ["reinigung_grund", "reinigung"],
  ["reinigung_fenster", "reinigung"],
  ["fensterreinigung", "reinigung"],
  // raeumung (≠ entsorgung)
  ["raeumung", "raeumung"],
  ["raeumung_wohnung", "raeumung"],
  ["raeumung_keller", "raeumung"],
  ["raeumung_haus", "raeumung"],
  ["entrümpelung", "raeumung"], // D6 (ü)
  ["entruempelung", "raeumung"], // D6 (ue)
  // entsorgung
  ["entsorgung", "entsorgung"],
  ["entsorgung_moebel", "entsorgung"],
  ["entsorgung_sperrgut", "entsorgung"],
  // transport (D1 + D2)
  ["transport", "transport"],
  ["moebel_transport", "transport"], // D1
  ["transport_moebel", "transport"], // D1 (NOT Mapper B's →umzug)
  ["usm_transport", "transport"],
  ["wasserbett_transport", "transport"],
  ["klaviertransport", "transport"], // D2
  ["transport_klavier", "transport"], // D2
  // lagerung
  ["lagerung", "lagerung"],
  // D4 — deliberate null (no base in the catalog)
  ["malerarbeit", null],
  ["renovation", null],
]);

// Prefix rules (after exact). moebellift_ first — it does not clash with umzug_ but the intent is clear.
const PREFIX: [string, CatalogBase][] = [
  ["moebellift_", "moebellift"], // D3 (separate base)
  ["umzug_", "umzug"],
  ["reinigung_", "reinigung"],
  ["raeumung_", "raeumung"],
  ["entsorgung_", "entsorgung"],
  ["transport_", "transport"], // D1: transport_* → transport
  ["lagerung_", "lagerung"], // D5
];

/**
 * Reduces a lead/service type to one of the 7 canonical bases; null if there is no match in the catalog.
 * Order: exact → prefix → content → null (reference §3).
 * DEFENSIVE: null/empty → null; normalize with trim + lowercase.
 */
export const normalizeToCatalogBase = (t: string | null): CatalogBase | null => {
  if (!t) return null;
  const v = t.trim().toLowerCase();
  if (!v) return null;

  // 1) exact (null value = deliberate "no base")
  if (EXACT.has(v)) return EXACT.get(v) ?? null;

  // 2) deliberate null prefixes (D4) — before the content rule
  if (v.startsWith("malerarbeit") || v.startsWith("renovation")) return null;

  // 3) prefix
  for (const [p, base] of PREFIX) {
    if (v.startsWith(p)) return base;
  }

  // 4) content (D2: klavier anywhere → transport)
  if (v.includes("klavier")) return "transport";

  // 5) unrecognized → null (falls into the Allgemein group)
  return null;
};

// ---------------------------------------------------------------------------
// Grouping — SINGLE source for render consumers (PDF, firma detail, public OfferView).
// ---------------------------------------------------------------------------

// Ordering between groups. Known bases not in this list come after, null (Allgemein) comes last.
export const SERVICE_ORDER: CatalogBase[] = [
  "umzug",
  "moebellift",
  "reinigung",
  "raeumung",
  "entsorgung",
  "transport",
  "lagerung",
];

/**
 * Options for the per-item service dropdown (create + edit share this source — avoid divergence).
 * 'allgemein' = null sentinel (Radix Select needs a string; converted to null on write).
 *
 * The VALUE stays the German DB token (it is the stored key). Only the visible LABEL is
 * localized — and it takes the locale explicitly, because this dropdown is drawn in the
 * OPERATOR's dashboard language while the same key is printed on the customer's PDF in the
 * CUSTOMER's language. A module-level German constant could not serve both.
 */
export const getServiceOptions = (
  locale: Locale
): { value: string; label: string }[] => [
  ...SERVICE_ORDER.map((base) => ({
    value: base as string,
    label: getServiceLabel(base, locale),
  })),
  { value: "allgemein", label: getServiceLabel("allgemein", locale) },
];

export interface ServiceGroup<T> {
  serviceType: string | null; // stored key (trim+lowercase); null/empty → null (Allgemein)
  label: string;
  items: T[];
}

const capitalize = (s: string): string => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Fallback display string carried on ServiceGroup.label.
 *
 * ⚠️ Do NOT render this. It is locale-less by construction (grouping is a pure function and
 * has no locale). Every renderer resolves `group.serviceType` through
 * `getServiceLabel(key, locale)` instead — the PDFs already do. It survives only so the
 * grouping result stays debuggable and the shape unchanged.
 */
const labelFor = (key: string | null): string => {
  if (key === null) return "allgemein";
  return capitalize(key);
};

/**
 * Groups items by the stored service_type (reference §7).
 *
 * ⚠️ Lesson #2: does NOT CALL normalizeToCatalogBase — it only buckets with trim().toLowerCase().
 * Normalize = stamping's job (Phase 2). If a raw variant appears (e.g. 'reinigung_end' as a separate
 * group) that is a STAMPING bug signal; the grouper does NOT hide it.
 */
export function groupItemsByService<
  T extends { service_type?: string | null; position?: number },
>(items: T[]): ServiceGroup<T>[] {
  // 1) bucket — trim+lowercase only; preserve first-seen order
  const buckets = new Map<string | null, T[]>();
  const firstSeen: (string | null)[] = [];
  for (const item of items) {
    const raw = (item.service_type ?? "").trim().toLowerCase();
    const key = raw === "" ? null : raw;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      firstSeen.push(key);
    }
    buckets.get(key)!.push(item);
  }

  // 3) order between groups: SERVICE_ORDER → other known (first-seen) → null last
  const rank = (key: string | null): number => {
    if (key === null) return Number.MAX_SAFE_INTEGER;
    const idx = SERVICE_ORDER.indexOf(key as CatalogBase);
    return idx === -1 ? SERVICE_ORDER.length + firstSeen.indexOf(key) : idx;
  };
  const sortedKeys = [...firstSeen].sort((a, b) => rank(a) - rank(b));

  // 2) within a group: by position (stable; if no position, input order is preserved)
  return sortedKeys.map((key) => {
    const groupItems = [...buckets.get(key)!].sort(
      (x, y) => (x.position ?? 0) - (y.position ?? 0),
    );
    return { serviceType: key, label: labelFor(key), items: groupItems };
  });
}

/**
 * German "Termin" label for a service group (per-service dates, 2026-07).
 * Explicit map because the Fugen-s is not universal (Umzugstermin but Transporttermin).
 */
export function serviceTerminLabel(serviceType: string | null | undefined): string {
  switch ((serviceType ?? "").trim().toLowerCase()) {
    case "umzug": return "Umzugstermin";
    case "reinigung": return "Reinigungstermin";
    case "raeumung": return "Räumungstermin";
    case "entsorgung": return "Entsorgungstermin";
    case "lagerung": return "Lagerungstermin";
    case "transport": return "Transporttermin";
    default: return "Termin";
  }
}

/**
 * The group's scheduled date/time — first non-null value (the group invariant
 * guarantees all items carry the same one). Returns null when the group has none
 * (callers fall back to the offer-level date).
 */
export function groupScheduled<T extends { scheduledDate?: string | null; scheduledStartTime?: string | null; scheduledEndTime?: string | null }>(
  items: T[],
): { date: string; startTime: string | null; endTime: string | null } | null {
  const hit = items.find((i) => i.scheduledDate);
  if (!hit?.scheduledDate) return null;
  return {
    date: hit.scheduledDate,
    startTime: hit.scheduledStartTime ?? null,
    endTime: hit.scheduledEndTime ?? null,
  };
}
