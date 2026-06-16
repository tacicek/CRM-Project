import { describe, it, expect } from "vitest";
import {
  type AuftragStatus,
  AUFTRAG_STATUS_LABELS,
  AUFTRAG_TRANSITIONS,
  isAuftragStatus,
  canTransitionAuftrag,
  allowedAuftragTargets,
} from "../auftragStatus";

const ALL_STATUSES: AuftragStatus[] = [
  "geplant",
  "bestaetigt",
  "in_bearbeitung",
  "abgeschlossen",
  "storniert",
];

describe("isAuftragStatus", () => {
  it("akzeptiert alle gültigen Status", () => {
    for (const s of ALL_STATUSES) {
      expect(isAuftragStatus(s)).toBe(true);
    }
  });

  it("lehnt ungültige Strings ab", () => {
    expect(isAuftragStatus("")).toBe(false);
    expect(isAuftragStatus("confirmed")).toBe(false); // appointment_status, nicht auftrag
    expect(isAuftragStatus("pending")).toBe(false);
    expect(isAuftragStatus("GEPLANT")).toBe(false); // case-sensitive
    expect(isAuftragStatus("geplant ")).toBe(false); // Whitespace
  });

  it("ist gegen Object-Prototype-Keys robust", () => {
    expect(isAuftragStatus("toString")).toBe(false);
    expect(isAuftragStatus("constructor")).toBe(false);
    expect(isAuftragStatus("hasOwnProperty")).toBe(false);
  });
});

describe("canTransitionAuftrag — gültige Übergänge", () => {
  it("erlaubt jeden in AUFTRAG_TRANSITIONS definierten Übergang", () => {
    for (const from of ALL_STATUSES) {
      for (const to of AUFTRAG_TRANSITIONS[from]) {
        expect(canTransitionAuftrag(from, to)).toBe(true);
      }
    }
  });

  it("erlaubt immer den gleichen Status (no-op)", () => {
    for (const s of ALL_STATUSES) {
      expect(canTransitionAuftrag(s, s)).toBe(true);
    }
  });

  it("erlaubt Reaktivierung storniert → geplant", () => {
    expect(canTransitionAuftrag("storniert", "geplant")).toBe(true);
  });
});

describe("canTransitionAuftrag — ungültige Übergänge", () => {
  it("lehnt jeden NICHT in AUFTRAG_TRANSITIONS definierten Übergang ab", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to) continue; // gleicher Status separat getestet
        const expected = AUFTRAG_TRANSITIONS[from].includes(to);
        expect(canTransitionAuftrag(from, to)).toBe(expected);
      }
    }
  });

  it("blockiert konkrete unsinnige Wechsel", () => {
    expect(canTransitionAuftrag("in_bearbeitung", "geplant")).toBe(false);
    expect(canTransitionAuftrag("storniert", "bestaetigt")).toBe(false);
    expect(canTransitionAuftrag("storniert", "abgeschlossen")).toBe(false);
  });

  it("lehnt Übergänge mit ungültigen Status ab", () => {
    expect(canTransitionAuftrag("foo", "geplant")).toBe(false);
    expect(canTransitionAuftrag("geplant", "bar")).toBe(false);
    expect(canTransitionAuftrag("foo", "bar")).toBe(false);
    expect(canTransitionAuftrag("", "")).toBe(true); // gleicher (leerer) String → no-op erlaubt
  });
});

describe("abgeschlossen ist terminal", () => {
  it("hat keine ausgehenden Übergänge", () => {
    expect(AUFTRAG_TRANSITIONS.abgeschlossen).toEqual([]);
  });

  it("erlaubt keinen Wechsel von abgeschlossen (außer no-op)", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransitionAuftrag("abgeschlossen", to)).toBe(to === "abgeschlossen");
    }
  });
});

describe("allowedAuftragTargets", () => {
  it("liefert [self, ...transitions] für jeden gültigen Status", () => {
    for (const from of ALL_STATUSES) {
      expect(allowedAuftragTargets(from)).toEqual([from, ...AUFTRAG_TRANSITIONS[from]]);
    }
  });

  it("liefert für abgeschlossen nur sich selbst", () => {
    expect(allowedAuftragTargets("abgeschlossen")).toEqual(["abgeschlossen"]);
  });

  it("liefert für storniert sich selbst + geplant (Reaktivierung)", () => {
    expect(allowedAuftragTargets("storniert")).toEqual(["storniert", "geplant"]);
  });

  it("fällt bei ungültigem Status auf ['geplant'] zurück", () => {
    expect(allowedAuftragTargets("foo")).toEqual(["geplant"]);
    expect(allowedAuftragTargets("")).toEqual(["geplant"]);
  });

  it("enthält keine Duplikate (self nicht in eigenen transitions)", () => {
    for (const from of ALL_STATUSES) {
      const targets = allowedAuftragTargets(from);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });
});

describe("AUFTRAG_STATUS_LABELS", () => {
  it("hat ein Label für jeden Status", () => {
    for (const s of ALL_STATUSES) {
      expect(AUFTRAG_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});
