import { describe, expect, it } from "vitest";
import { formatCurrency, formatMeasure, normalizePdfNumber } from "../formatters";

describe("PDF number formatting", () => {
  it("uses a PDF-safe Swiss grouping separator for French CHF", () => {
    expect(formatCurrency(1200, "fr")).toBe("1'200.00 CHF");
  });

  it("normalizes grouping separators without changing decimal separators", () => {
    expect(normalizePdfNumber("CHF\u00a01’200.50")).toBe("CHF 1'200.50");
    expect(normalizePdfNumber("1\u202f200.00\u00a0CHF")).toBe("1'200.00 CHF");
  });

  it("also keeps grouped measurements PDF-safe", () => {
    expect(formatMeasure(1200, "fr")).toBe("1'200");
  });
});
