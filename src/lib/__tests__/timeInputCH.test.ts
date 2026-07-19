import { describe, it, expect } from "vitest";
import { autoFormat, displayToValue, normalizeDisplay } from "@/lib/timeInputCH";

describe("TimeInputCH helpers", () => {
  describe("normalizeDisplay", () => {
    it("passes through HH:MM", () => {
      expect(normalizeDisplay("08:30")).toBe("08:30");
    });
    it("drops seconds from a `time` column value", () => {
      expect(normalizeDisplay("08:30:00")).toBe("08:30");
    });
    it("maps empty to empty", () => {
      expect(normalizeDisplay("")).toBe("");
    });
  });

  describe("autoFormat", () => {
    it("leaves <=2 digits without a colon", () => {
      expect(autoFormat("0")).toBe("0");
      expect(autoFormat("08")).toBe("08");
    });
    it("inserts the colon after two digits", () => {
      expect(autoFormat("083")).toBe("08:3");
      expect(autoFormat("0830")).toBe("08:30");
    });
    it("strips non-digits and caps at four digits", () => {
      expect(autoFormat("08:30")).toBe("08:30");
      expect(autoFormat("083099")).toBe("08:30");
      expect(autoFormat("ab8")).toBe("8");
    });
  });

  describe("displayToValue", () => {
    it("pads and validates a valid time", () => {
      expect(displayToValue("8:30")).toBe("08:30");
      expect(displayToValue("08:30")).toBe("08:30");
      expect(displayToValue("23:59")).toBe("23:59");
      expect(displayToValue("00:00")).toBe("00:00");
    });
    it("accepts a bare 4-digit entry without the colon", () => {
      expect(displayToValue("0830")).toBe("08:30");
    });
    it("treats a 2-digit hour as incomplete (never 00:08)", () => {
      expect(displayToValue("08")).toBe("");
      expect(displayToValue("8:5")).toBe("");
    });
    it("rejects out-of-range hours/minutes (24h, no AM/PM)", () => {
      expect(displayToValue("24:00")).toBe("");
      expect(displayToValue("08:60")).toBe("");
      expect(displayToValue("99:99")).toBe("");
    });
    it("returns empty for incomplete or malformed input", () => {
      expect(displayToValue("08:")).toBe("");
      expect(displayToValue("")).toBe("");
      expect(displayToValue("abc")).toBe("");
    });
  });
});
