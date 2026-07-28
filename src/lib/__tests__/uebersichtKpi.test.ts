import { describe, expect, it } from "vitest";
import { deltaPercent, groupPaymentsByWeek } from "@/lib/uebersichtKpi";

describe("deltaPercent", () => {
  it("computes a rise", () => {
    expect(deltaPercent(125, 100)).toBe(25);
  });

  it("computes a fall", () => {
    expect(deltaPercent(80, 100)).toBe(-20);
  });

  it("is 0 when nothing moved", () => {
    expect(deltaPercent(100, 100)).toBe(0);
  });

  it("returns null without a comparison base — not 100, not Infinity", () => {
    expect(deltaPercent(5, 0)).toBeNull();
  });

  it("returns null when both are zero", () => {
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it("rounds to whole percent", () => {
    expect(deltaPercent(101, 99)).toBe(2);
  });
});

describe("groupPaymentsByWeek", () => {
  const now = new Date("2026-07-28T12:00:00Z"); // Dienstag, KW31

  it("returns exactly the requested number of weeks", () => {
    expect(groupPaymentsByWeek([], 5, now)).toHaveLength(5);
  });

  it("marks only the last bucket as current", () => {
    const weeks = groupPaymentsByWeek([], 5, now);
    expect(weeks.filter((week) => week.current)).toHaveLength(1);
    expect(weeks[weeks.length - 1].current).toBe(true);
  });

  it("sums payments into their week", () => {
    const weeks = groupPaymentsByWeek(
      [
        { payment_date: "2026-07-28", amount: 1000 },
        { payment_date: "2026-07-27", amount: 500 },
      ],
      5,
      now,
    );
    expect(weeks[weeks.length - 1].amountChf).toBe(1500);
  });

  it("nets a reversal out, because a reversal is negative", () => {
    const weeks = groupPaymentsByWeek(
      [
        { payment_date: "2026-07-28", amount: 1000 },
        { payment_date: "2026-07-28", amount: -400 },
      ],
      5,
      now,
    );
    expect(weeks[weeks.length - 1].amountChf).toBe(600);
  });

  it("ignores payments outside the window", () => {
    const weeks = groupPaymentsByWeek([{ payment_date: "2020-01-01", amount: 999 }], 5, now);
    expect(weeks.every((week) => week.amountChf === 0)).toBe(true);
  });

  it("labels five distinct weeks, the current one last", () => {
    const labels = groupPaymentsByWeek([], 5, now).map((week) => week.label);
    expect(new Set(labels).size).toBe(5);
    expect(labels[labels.length - 1]).toBe("KW31");
  });

  it("survives a year boundary without duplicate labels", () => {
    // KW1 folgt auf KW53/KW52 — die Reihe darf dort nicht zusammenfallen.
    const newYear = new Date("2027-01-05T12:00:00Z");
    const labels = groupPaymentsByWeek([], 5, newYear).map((week) => week.label);
    expect(new Set(labels).size).toBe(5);
  });
});
