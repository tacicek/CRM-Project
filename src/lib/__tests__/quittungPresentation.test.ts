import { describe, expect, it } from "vitest";
import { buildReceiptPdfRows, formatReceiptDate, formatReceiptTimestamp, splitReceiptText } from "@/lib/quittungPresentation";
import type { QuittungPosition } from "@/types/quittung.types";

describe("receipt dates", () => {
  it("preserves a date-only field independently of the viewer time zone", () => {
    expect(formatReceiptDate("2026-10-25", "de")).toBe("25.10.2026");
    expect(formatReceiptDate("2024-02-29", "fr")).toBe("29.02.2024");
    expect(() => formatReceiptDate("2026-02-29", "de")).toThrow(RangeError);
  });

  it("prints Swiss signature time on both sides of the daylight-saving transition", () => {
    expect(formatReceiptTimestamp("2026-10-25T00:30:00Z", "de")).toContain("02:30 MESZ");
    expect(formatReceiptTimestamp("2026-10-25T09:30:00Z", "de")).toContain("10:30 MEZ");
  });
});

describe("receipt PDF rows", () => {
  const position: QuittungPosition = {
    id: "service", beschreibung: "Işıl Çiçek – Umzug", satz: "2 × CHF 50",
    betrag: 100, checked: true, is_custom: false,
  };

  it("preserves all Unicode text in bounded continuation fragments", () => {
    const text = "İı Şş Ğğ Çç → äöü 😀\n".repeat(100);
    const parts = splitReceiptText(text);
    expect(parts.join("")).toBe(text);
    expect(parts.every(part => Array.from(part).length <= 320)).toBe(true);
    expect(parts.every(part => part.split("\n").length <= 9)).toBe(true);
    const rows = buildReceiptPdfRows([{ ...position, beschreibung: text }]);
    expect(rows.map(row => row.description).join("")).toBe(text);
    expect(rows.filter(row => row.amount !== null).map(row => row.amount)).toEqual([100]);
    expect(rows.slice(1).every(row => row.continuation)).toBe(true);
  });

  it("prints a selected free service as zero and excludes unselected digital rows", () => {
    const positions = [{ ...position, betrag: 0 }, { ...position, id: "unused", checked: false }];
    expect(buildReceiptPdfRows(positions).map(row => row.amount)).toEqual([0]);
    expect(buildReceiptPdfRows(positions, true)).toHaveLength(2);
  });

  it("prints structured quantity and unit price alongside the authored remark", () => {
    const rows = buildReceiptPdfRows([{ ...position, menge: 2.5, einheit: "Std.", einzelpreis: 40, satz: "Festpreis" }]);
    expect(rows[0].rate).toBe("2.5 Std. × CHF\u00a040.00\nFestpreis");
  });

  it("labels included services without presenting their original unit rate as a charge", () => {
    const rows = buildReceiptPdfRows([{ ...position, price_type: "inkl", betrag: 0, menge: 10, einzelpreis: 10, satz: "" }], false, "fr");
    expect(rows[0].rate).toBe("Inclus");
    expect(rows[0].amount).toBe(0);
  });
});
