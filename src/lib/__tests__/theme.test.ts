import { describe, expect, it } from "vitest";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

describe("parseThemePreference", () => {
  it("accepts the three known values", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to system when nothing is stored", () => {
    expect(parseThemePreference(null)).toBe("system");
  });

  it("falls back to system on unknown or corrupt input", () => {
    expect(parseThemePreference("")).toBe("system");
    expect(parseThemePreference("Dark")).toBe("system");
    expect(parseThemePreference("{}")).toBe("system");
  });

  it("uses a namespaced storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("crm:theme");
  });
});

describe("resolveTheme", () => {
  it("returns the explicit choice regardless of the system setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system setting when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
