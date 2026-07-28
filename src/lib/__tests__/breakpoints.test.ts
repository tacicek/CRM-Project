import { describe, expect, it } from "vitest";
import {
  BREAKPOINT_DESKTOP_MIN,
  BREAKPOINT_TABLET_MIN,
  resolveBreakpoint,
} from "@/lib/breakpoints";

describe("resolveBreakpoint", () => {
  it("treats the reference phone widths as mobile", () => {
    expect(resolveBreakpoint(360)).toBe("mobile");
    expect(resolveBreakpoint(390)).toBe("mobile");
    expect(resolveBreakpoint(430)).toBe("mobile");
  });

  it("switches to tablet exactly at 820", () => {
    expect(resolveBreakpoint(819)).toBe("mobile");
    expect(resolveBreakpoint(BREAKPOINT_TABLET_MIN)).toBe("tablet");
  });

  it("switches to desktop exactly at 1100", () => {
    expect(resolveBreakpoint(1099)).toBe("tablet");
    expect(resolveBreakpoint(BREAKPOINT_DESKTOP_MIN)).toBe("desktop");
    expect(resolveBreakpoint(1920)).toBe("desktop");
  });

  it("does not crash on a zero width during first render", () => {
    expect(resolveBreakpoint(0)).toBe("mobile");
  });
});
