import { describe, it, expect } from "vitest";
import { floorLabelToInt, formatFloorLabel } from "@/lib/floorUtils";

describe("formatFloorLabel", () => {
  it("0 is NEVER '0. OG' — ground floor renders as Erdgeschoss", () => {
    expect(formatFloorLabel(0)).toBe("Erdgeschoss");
  });
  it("negative floors render as UG", () => {
    expect(formatFloorLabel(-1)).toBe("UG");
  });
  it("positive floors render as 'n. OG'", () => {
    expect(formatFloorLabel(1)).toBe("1. OG");
    expect(formatFloorLabel(3)).toBe("3. OG");
    expect(formatFloorLabel(15)).toBe("15. OG");
  });
  it("null/undefined/NaN → null (row omitted by callers)", () => {
    expect(formatFloorLabel(null)).toBeNull();
    expect(formatFloorLabel(undefined)).toBeNull();
    expect(formatFloorLabel(Number.NaN)).toBeNull();
  });
  it("round-trips with floorLabelToInt for the common labels", () => {
    expect(formatFloorLabel(floorLabelToInt("EG"))).toBe("Erdgeschoss");
    expect(formatFloorLabel(floorLabelToInt("UG"))).toBe("UG");
    expect(formatFloorLabel(floorLabelToInt("3. OG"))).toBe("3. OG");
  });
});
