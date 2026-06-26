import { describe, it, expect } from "vitest";
import {
  hourlyRange,
  BLIND_DISCLAIMER_LABEL,
  BLIND_DISCLAIMER_TEXT,
} from "@/lib/offerPricing";

describe("hourlyRange", () => {
  it("normal: min*rate ve max*rate döndürür", () => {
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 100 })).toEqual({
      min: 200,
      max: 400,
    });
  });

  it("null/undefined → null", () => {
    expect(hourlyRange(null)).toBeNull();
    expect(hourlyRange(undefined)).toBeNull();
  });

  it("minHours=0 veya hourlyRate=0 → null (ServiceTable guard'ıyla birebir)", () => {
    expect(hourlyRange({ minHours: 0, maxHours: 4, hourlyRate: 100 })).toBeNull();
    expect(hourlyRange({ minHours: 2, maxHours: 4, hourlyRate: 0 })).toBeNull();
  });

  it("defensive: yanlış şekil / yanlış tip → null (patlamadan)", () => {
    // as cast tuzağı: DB jsonb beklenmedik şekil taşıyabilir
    expect(hourlyRange({ min: 2, max: 4 } as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
    expect(
      hourlyRange({ minHours: "2", maxHours: "4", hourlyRate: "100" } as unknown as Parameters<typeof hourlyRange>[0]),
    ).toBeNull();
    expect(hourlyRange({} as unknown as Parameters<typeof hourlyRange>[0])).toBeNull();
  });
});

describe("blind disclaimer sabitleri", () => {
  it("metin sabitleri tanımlı ve dolu", () => {
    expect(BLIND_DISCLAIMER_LABEL).toBe("Wichtiger Hinweis");
    expect(BLIND_DISCLAIMER_TEXT).toContain("ohne persönliche Besichtigung");
  });
});
