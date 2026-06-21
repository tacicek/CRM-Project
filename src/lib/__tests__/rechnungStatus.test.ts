import { describe, it, expect } from "vitest";
import {
  isRechnungStatus,
  canTransitionRechnung,
  allowedRechnungTargets,
  RECHNUNG_TRANSITIONS,
  RECHNUNG_STATUS_LABELS,
  RECHNUNG_STATUS_COLORS,
  type RechnungStatus,
} from "@/lib/rechnungStatus";

const ALL: RechnungStatus[] = ["entwurf", "versendet", "bezahlt", "ueberfaellig"];

describe("isRechnungStatus", () => {
  it("akzeptiert alle gültigen Status", () => {
    for (const s of ALL) expect(isRechnungStatus(s)).toBe(true);
  });
  it("lehnt ungültige Strings ab", () => {
    expect(isRechnungStatus("draft")).toBe(false);
    expect(isRechnungStatus("paid")).toBe(false);
    expect(isRechnungStatus("")).toBe(false);
  });
  it("ist gegen Object-Prototype-Keys robust", () => {
    expect(isRechnungStatus("toString")).toBe(false);
    expect(isRechnungStatus("constructor")).toBe(false);
  });
});

describe("canTransitionRechnung — gültige Übergänge", () => {
  it("erlaubt jeden in RECHNUNG_TRANSITIONS definierten Übergang", () => {
    for (const from of ALL) {
      for (const to of RECHNUNG_TRANSITIONS[from]) {
        expect(canTransitionRechnung(from, to)).toBe(true);
      }
    }
  });
  it("erlaubt immer den gleichen Status (no-op)", () => {
    for (const s of ALL) expect(canTransitionRechnung(s, s)).toBe(true);
  });
  it("erlaubt die konkreten Geschäftsübergänge", () => {
    expect(canTransitionRechnung("entwurf", "versendet")).toBe(true);
    expect(canTransitionRechnung("entwurf", "bezahlt")).toBe(true);
    expect(canTransitionRechnung("versendet", "bezahlt")).toBe(true);
    expect(canTransitionRechnung("versendet", "ueberfaellig")).toBe(true);
    expect(canTransitionRechnung("ueberfaellig", "bezahlt")).toBe(true);
  });
});

describe("canTransitionRechnung — ungültige Übergänge", () => {
  it("blockiert unsinnige Wechsel", () => {
    expect(canTransitionRechnung("versendet", "entwurf")).toBe(false);
    expect(canTransitionRechnung("ueberfaellig", "versendet")).toBe(false);
    expect(canTransitionRechnung("bezahlt", "entwurf")).toBe(false);
    expect(canTransitionRechnung("entwurf", "ueberfaellig")).toBe(false);
  });
  it("lehnt Übergänge mit ungültigen Status ab", () => {
    expect(canTransitionRechnung("draft", "bezahlt")).toBe(false);
    expect(canTransitionRechnung("entwurf", "paid")).toBe(false);
  });
});

describe("bezahlt ist terminal", () => {
  it("hat keine ausgehenden Übergänge", () => {
    expect(RECHNUNG_TRANSITIONS.bezahlt).toEqual([]);
  });
  it("erlaubt keinen Wechsel von bezahlt (außer no-op)", () => {
    for (const to of ALL) {
      expect(canTransitionRechnung("bezahlt", to)).toBe(to === "bezahlt");
    }
  });
});

describe("allowedRechnungTargets", () => {
  it("liefert [self, ...transitions] für jeden gültigen Status", () => {
    for (const s of ALL) {
      expect(allowedRechnungTargets(s)).toEqual([s, ...RECHNUNG_TRANSITIONS[s]]);
    }
  });
  it("liefert für bezahlt nur sich selbst", () => {
    expect(allowedRechnungTargets("bezahlt")).toEqual(["bezahlt"]);
  });
  it("fällt bei ungültigem Status auf ['entwurf'] zurück", () => {
    expect(allowedRechnungTargets("xyz")).toEqual(["entwurf"]);
  });
});

describe("Labels & Colors", () => {
  it("hat ein Label und eine Farbe für jeden Status", () => {
    for (const s of ALL) {
      expect(RECHNUNG_STATUS_LABELS[s]).toBeTruthy();
      expect(RECHNUNG_STATUS_COLORS[s]).toBeTruthy();
    }
  });
});
