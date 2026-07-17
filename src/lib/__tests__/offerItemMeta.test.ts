import { describe, it, expect } from "vitest";
import {
  metaKindForService,
  buildMetaPayload,
  metaPayloadToJson,
  seedMetaDraft,
  isMetaDraftFilled,
  EMPTY_META_DRAFT,
  type GroupMetaDraft,
} from "@/lib/offerItemMeta";

const draft = (patch: Partial<GroupMetaDraft>): GroupMetaDraft => ({ ...EMPTY_META_DRAFT, ...patch });

describe("metaKindForService", () => {
  it("maps move/transport to effort", () => {
    expect(metaKindForService("umzug")).toBe("effort");
    expect(metaKindForService("transport")).toBe("effort");
    expect(metaKindForService("Umzug")).toBe("effort"); // case-insensitive
  });
  it("maps reinigung to area", () => {
    expect(metaKindForService("reinigung")).toBe("area");
  });
  it("maps disposal/storage/clearance to volume", () => {
    expect(metaKindForService("entsorgung")).toBe("volume");
    expect(metaKindForService("lagerung")).toBe("volume");
    expect(metaKindForService("raeumung")).toBe("volume");
    expect(metaKindForService("räumung")).toBe("volume");
  });
  it("returns null for unknown / empty", () => {
    expect(metaKindForService(null)).toBeNull();
    expect(metaKindForService("")).toBeNull();
    expect(metaKindForService("beratung")).toBeNull();
  });
});

describe("buildMetaPayload", () => {
  it("returns {} when kind is null or draft empty", () => {
    expect(buildMetaPayload(null, draft({ crew: "4" }))).toEqual({});
    expect(buildMetaPayload("effort", EMPTY_META_DRAFT)).toEqual({});
  });

  it("builds effort meta and coerces numbers (comma decimal)", () => {
    const out = buildMetaPayload("effort", draft({ crew: "4", vehicles: "2", vehicleType: "LKW", hourlyRate: "60,5" }));
    expect(out).toEqual({ effort_meta: { crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60.5 } });
  });

  it("does not write effort meta when only vehicle_type is set (PDF would not draw it)", () => {
    expect(buildMetaPayload("effort", draft({ vehicleType: "LKW" }))).toEqual({});
  });

  it("builds area meta and maps the Abnahme switch", () => {
    const out = buildMetaPayload("area", draft({ objectType: "Wohnung", areaM2: "88", abnahmegarantie: true }));
    expect(out).toEqual({ area_meta: { object_type: "Wohnung", area_m2: 88, abnahmegarantie: true } });
  });

  it("area: abnahmegarantie alone does not create a row (needs object or m²)", () => {
    expect(buildMetaPayload("area", draft({ abnahmegarantie: true }))).toEqual({});
  });

  it("area: abnahmegarantie false serializes as null", () => {
    const out = buildMetaPayload("area", draft({ objectType: "Büro", abnahmegarantie: false }));
    expect(out).toEqual({ area_meta: { object_type: "Büro", area_m2: null, abnahmegarantie: null } });
  });

  it("builds volume meta with rate unit", () => {
    expect(buildMetaPayload("volume", draft({ rate: "60", rateUnit: "once", volumeM3: "12" }))).toEqual({
      volume_meta: { rate: 60, rate_unit: "once", volume_m3: 12 },
    });
    expect(buildMetaPayload("volume", draft({ rate: "200", rateUnit: "monthly" }))).toEqual({
      volume_meta: { rate: 200, rate_unit: "monthly", volume_m3: null },
    });
  });

  it("volume: empty numbers → no row", () => {
    expect(buildMetaPayload("volume", draft({ rateUnit: "monthly" }))).toEqual({});
  });
});

describe("seedMetaDraft ↔ buildMetaPayload round-trip", () => {
  it("effort round-trips through seed", () => {
    const seeded = seedMetaDraft({ crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60 }, null, null);
    expect(buildMetaPayload("effort", seeded)).toEqual({
      effort_meta: { crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60 },
    });
  });

  it("volume round-trips, defaulting rate_unit to once", () => {
    const seeded = seedMetaDraft(null, { volume_m3: 12, rate: 60, rate_unit: null }, null);
    expect(seeded.rateUnit).toBe("once");
    expect(buildMetaPayload("volume", seeded)).toEqual({
      volume_meta: { rate: 60, rate_unit: "once", volume_m3: 12 },
    });
  });

  it("area round-trips the boolean", () => {
    const seeded = seedMetaDraft(null, null, { object_type: "Wohnung", area_m2: 88, abnahmegarantie: true });
    expect(seeded.abnahmegarantie).toBe(true);
    expect(buildMetaPayload("area", seeded)).toEqual({
      area_meta: { object_type: "Wohnung", area_m2: 88, abnahmegarantie: true },
    });
  });

  it("seeds numeric strings coming from PostgREST (numeric-as-string)", () => {
    const seeded = seedMetaDraft({ crew: 3, hourly_rate: "55.00" as unknown as number }, null, null);
    expect(seeded.hourlyRate).toBe("55.00");
    expect(buildMetaPayload("effort", seeded).effort_meta?.hourly_rate).toBe(55);
  });
});

describe("isMetaDraftFilled", () => {
  it("reflects whether a payload would be written", () => {
    expect(isMetaDraftFilled("effort", draft({ crew: "4" }))).toBe(true);
    expect(isMetaDraftFilled("effort", draft({ vehicleType: "LKW" }))).toBe(false);
    expect(isMetaDraftFilled(null, draft({ crew: "4" }))).toBe(false);
  });
});

describe("metaPayloadToJson", () => {
  it("effort meta → fresh JSON with only persisted keys", () => {
    expect(metaPayloadToJson({ effort_meta: { crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60 } }))
      .toEqual({ effort_meta: { crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60 } });
  });
  it("area meta preserved; null values kept", () => {
    expect(metaPayloadToJson({ area_meta: { object_type: "Wohnung", area_m2: 88, abnahmegarantie: null } }))
      .toEqual({ area_meta: { object_type: "Wohnung", area_m2: 88, abnahmegarantie: null } });
  });
  it("volume meta preserved", () => {
    expect(metaPayloadToJson({ volume_meta: { rate: 60, rate_unit: "m3", volume_m3: 30 } }))
      .toEqual({ volume_meta: { rate: 60, rate_unit: "m3", volume_m3: 30 } });
  });
  it("empty payload → empty object; absent metas omitted", () => {
    expect(metaPayloadToJson({})).toEqual({});
  });
  it("undefined optional field → null (never a fabricated value)", () => {
    expect(metaPayloadToJson({ effort_meta: { crew: 3 } }))
      .toEqual({ effort_meta: { crew: 3, vehicles: null, vehicle_type: null, hourly_rate: null } });
  });
  it("does not mutate input", () => {
    const input = { effort_meta: { crew: 4, vehicles: 2, vehicle_type: "LKW", hourly_rate: 60 } };
    const snap = structuredClone(input);
    metaPayloadToJson(input);
    expect(input).toEqual(snap);
  });
});
