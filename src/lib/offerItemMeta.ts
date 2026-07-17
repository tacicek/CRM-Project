/**
 * Group-based service meta for the Offerte form (effort / area / volume).
 *
 * The offer PDF (ServiceTable) renders a per-item meta card under the first priced
 * position of each service group — "4 Mitarbeiter · 2 LKW · à CHF 60/Stunde" (effort),
 * "OBJEKT: Wohnung, ca. 88 m²" (area), "TARIF: CHF 60/m³" (volume). The data lives in
 * the to-one tables offer_item_{effort,volume,area}_meta (PK offer_item_id).
 *
 * A whole service group shares ONE meta value (like the per-group scheduled date), so the
 * form models it group-keyed — NOT per OfferItem. At save the draft is attached to the
 * group's first billable item in the replace_offer_items payload; the RPC writes the row.
 *
 * Only fields the PDF actually renders are exposed here (aufwand-range, abgabe and location
 * columns exist in the schema but are never drawn — omitting them keeps the form honest).
 */
import type {
  OfferItemEffortMeta,
  OfferItemVolumeMeta,
  OfferItemAreaMeta,
} from "@/components/pdf/types/offer.types";
import type { Json } from "@/integrations/supabase/types";

export type ServiceMetaKind = "effort" | "area" | "volume";

/** Which meta card a service group shows — mirrors ServiceTable's per-service render. */
export const metaKindForService = (serviceType: string | null | undefined): ServiceMetaKind | null => {
  const s = (serviceType ?? "").trim().toLowerCase();
  if (s === "umzug" || s === "transport") return "effort";
  if (s === "reinigung") return "area";
  if (s === "entsorgung" || s === "lagerung" || s === "raeumung" || s === "räumung") return "volume";
  return null;
};

/** Form draft — all inputs string-typed (like groupDates), one per service group. */
export interface GroupMetaDraft {
  // effort (Umzug/Transport)
  crew: string;
  vehicles: string;
  vehicleType: string;
  hourlyRate: string;
  // area (Reinigung)
  objectType: string;
  areaM2: string;
  abnahmegarantie: boolean;
  // volume (Entsorgung/Lagerung/Räumung)
  rate: string;
  rateUnit: "once" | "monthly"; // once → render "CHF x/m³", monthly → "CHF x/Monat"
  volumeM3: string;
}

export const EMPTY_META_DRAFT: GroupMetaDraft = {
  crew: "",
  vehicles: "",
  vehicleType: "",
  hourlyRate: "",
  objectType: "",
  areaM2: "",
  abnahmegarantie: false,
  rate: "",
  rateUnit: "once",
  volumeM3: "",
};

const toNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toStrTrim = (s: string): string | null => {
  const t = s.trim();
  return t === "" ? null : t;
};

const toStr = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? "" : String(v);

/**
 * Build the meta sub-object for a group's first billable item in the RPC payload.
 * Returns `{}` when the group's service has no meta kind or the draft is effectively
 * empty — the gates mirror ServiceTable so we never write a row the PDF wouldn't draw.
 */
export const buildMetaPayload = (
  kind: ServiceMetaKind | null,
  draft: GroupMetaDraft | undefined,
): { effort_meta?: OfferItemEffortMeta; area_meta?: OfferItemAreaMeta; volume_meta?: OfferItemVolumeMeta } => {
  if (!kind || !draft) return {};

  if (kind === "effort") {
    const crew = toNum(draft.crew);
    const vehicles = toNum(draft.vehicles);
    const hourly_rate = toNum(draft.hourlyRate);
    // ServiceTable draws effort only when crew | vehicles | hourly_rate is set.
    if (crew === null && vehicles === null && hourly_rate === null) return {};
    return {
      effort_meta: { crew, vehicles, vehicle_type: toStrTrim(draft.vehicleType), hourly_rate },
    };
  }

  if (kind === "area") {
    const object_type = toStrTrim(draft.objectType);
    const area_m2 = toNum(draft.areaM2);
    // ServiceTable uses areaMeta only when object_type | area_m2 is set.
    if (object_type === null && area_m2 === null) return {};
    return {
      area_meta: { object_type, area_m2, abnahmegarantie: draft.abnahmegarantie ? true : null },
    };
  }

  // volume
  const rate = toNum(draft.rate);
  const volume_m3 = toNum(draft.volumeM3);
  // ServiceTable uses volumeMeta only when rate | volume_m3 is set.
  if (rate === null && volume_m3 === null) return {};
  return {
    volume_meta: { rate, rate_unit: draft.rateUnit, volume_m3 },
  };
};

/**
 * Re-materialize a `buildMetaPayload` result as JSON-safe values for the `replace_offer_items`
 * payload. The meta objects are named interfaces (not assignable to `Json`); this rebuilds each
 * present meta with fresh literals carrying only the persisted keys buildMetaPayload emits.
 * `?? null` only removes the interface's optional `undefined` (buildMetaPayload never emits it),
 * so no real value is changed. Pure; no cast; input not mutated.
 */
export const metaPayloadToJson = (
  payload: { effort_meta?: OfferItemEffortMeta; area_meta?: OfferItemAreaMeta; volume_meta?: OfferItemVolumeMeta },
): { effort_meta?: Json; area_meta?: Json; volume_meta?: Json } => {
  const out: { effort_meta?: Json; area_meta?: Json; volume_meta?: Json } = {};
  const e = payload.effort_meta;
  if (e) out.effort_meta = { crew: e.crew ?? null, vehicles: e.vehicles ?? null, vehicle_type: e.vehicle_type ?? null, hourly_rate: e.hourly_rate ?? null };
  const a = payload.area_meta;
  if (a) out.area_meta = { object_type: a.object_type ?? null, area_m2: a.area_m2 ?? null, abnahmegarantie: a.abnahmegarantie ?? null };
  const v = payload.volume_meta;
  if (v) out.volume_meta = { rate: v.rate ?? null, rate_unit: v.rate_unit ?? null, volume_m3: v.volume_m3 ?? null };
  return out;
};

/** Seed a form draft from the loaded (embedded) meta rows — for the edit page. */
export const seedMetaDraft = (
  effort?: OfferItemEffortMeta | null,
  volume?: OfferItemVolumeMeta | null,
  area?: OfferItemAreaMeta | null,
): GroupMetaDraft => ({
  crew: toStr(effort?.crew),
  vehicles: toStr(effort?.vehicles),
  vehicleType: effort?.vehicle_type ?? "",
  hourlyRate: toStr(effort?.hourly_rate),
  objectType: area?.object_type ?? "",
  areaM2: toStr(area?.area_m2),
  abnahmegarantie: area?.abnahmegarantie === true,
  rate: toStr(volume?.rate),
  rateUnit: volume?.rate_unit === "monthly" ? "monthly" : "once",
  volumeM3: toStr(volume?.volume_m3),
});

/** True when the draft has any non-default content (for "is this group configured" checks). */
export const isMetaDraftFilled = (kind: ServiceMetaKind | null, draft: GroupMetaDraft | undefined): boolean => {
  const payload = buildMetaPayload(kind, draft);
  return Boolean(payload.effort_meta || payload.area_meta || payload.volume_meta);
};
