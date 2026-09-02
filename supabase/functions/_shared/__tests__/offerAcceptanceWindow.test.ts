import { describe, it, expect } from "vitest";
import {
  addDays,
  computeAcceptanceDeadline,
  evaluateAcceptanceWindow,
  heuteIso,
  istIsoDatum,
} from "../offerAcceptanceWindow.ts";

describe("addDays", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-09-02", 7)).toBe("2026-09-09");
  });
});

describe("computeAcceptanceDeadline", () => {
  it("nimmt den früheren der beiden Tage", () => {
    expect(computeAcceptanceDeadline("2026-08-20", "2026-08-10")).toBe("2026-08-09");
    expect(computeAcceptanceDeadline("2026-08-05", "2026-08-30")).toBe("2026-08-05");
  });

  it("kommt mit nur einem gesetzten Wert aus", () => {
    expect(computeAcceptanceDeadline("2026-08-05", null)).toBe("2026-08-05");
    expect(computeAcceptanceDeadline(null, "2026-09-01")).toBe("2026-08-31");
  });

  it("ohne beide Werte ist die Annahme unbefristet", () => {
    expect(computeAcceptanceDeadline(null, null)).toBeNull();
  });

  it("übergeht Unsinn statt ihn zu vergleichen", () => {
    expect(computeAcceptanceDeadline("morgen", "2026-09-10")).toBe("2026-09-09");
    expect(computeAcceptanceDeadline("", "")).toBeNull();
    // Das gekippte Jahr aus Offerte 10091 — als Frist wäre es die früheste
    // überhaupt und würde jede Offerte sperren. Die Form stimmt, also zählt es;
    // dass so ein Wert gar nicht erst entsteht, hält `dateInputCH` fest.
    expect(computeAcceptanceDeadline(null, "0261-08-31")).toBe("0261-08-30");
  });
});

describe("evaluateAcceptanceWindow", () => {
  it("am Fristtag selbst darf noch angenommen werden", () => {
    expect(evaluateAcceptanceWindow("2026-08-02", null, "2026-08-02")).toEqual({
      frist: "2026-08-02",
      offen: true,
    });
    expect(evaluateAcceptanceWindow("2026-08-01", null, "2026-08-02")).toEqual({
      frist: "2026-08-01",
      offen: false,
    });
  });

  it("ohne Fristen bleibt das Fenster offen", () => {
    expect(evaluateAcceptanceWindow(null, null, "2026-08-02")).toEqual({ frist: null, offen: true });
  });

  it("das Ausführungsdatum schliesst das Fenster, auch wenn «Gültig bis» weit offen steht", () => {
    // Offerte 10095: angelegt am 02.09., Ausführung 02.09., Gültig bis 10.09.
    // «Gültig bis» sagt offen, die Ausführung sagt geschlossen — und gewinnt.
    expect(evaluateAcceptanceWindow("2026-09-10", "2026-09-02", "2026-09-02")).toEqual({
      frist: "2026-09-01",
      offen: false,
    });
    // Dieselbe Offerte mit dem Datum, das der Kunde gewünscht hat.
    expect(evaluateAcceptanceWindow("2026-09-10", "2026-09-15", "2026-09-02")).toEqual({
      frist: "2026-09-10",
      offen: true,
    });
  });

  it("ein unbrauchbarer Vergleichstag öffnet das Tor nicht, sondern bricht ab", () => {
    expect(() => evaluateAcceptanceWindow("2026-09-10", null, "02.09.2026")).toThrow(TypeError);
    expect(() => evaluateAcceptanceWindow("2026-09-10", null, "")).toThrow(TypeError);
  });
});

describe("heuteIso", () => {
  it("liefert den UTC-Tag, nicht den lokalen", () => {
    // 00:30 in Zürich ist noch der Vortag in UTC — die Datenbank entscheidet in UTC.
    expect(heuteIso(new Date("2026-09-02T22:30:00Z"))).toBe("2026-09-02");
    expect(heuteIso(new Date("2026-09-02T00:30:00Z"))).toBe("2026-09-02");
  });
});

describe("istIsoDatum", () => {
  it("erkennt genau die Form YYYY-MM-DD", () => {
    expect(istIsoDatum("2026-09-02")).toBe(true);
    expect(istIsoDatum("2026-9-2")).toBe(false);
    expect(istIsoDatum(null)).toBe(false);
    expect(istIsoDatum(20260902)).toBe(false);
  });
});
