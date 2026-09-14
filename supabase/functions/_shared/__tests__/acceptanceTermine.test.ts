import { describe, expect, it } from "vitest";
import { buildAcceptanceTermine, type AcceptanceItemRow } from "../acceptanceTermine.ts";

const pos = (over: Partial<AcceptanceItemRow>): AcceptanceItemRow => ({
  service_type: null,
  scheduled_date: null,
  scheduled_start_time: null,
  position: 1,
  ...over,
});

describe("buildAcceptanceTermine — dieselben Tage wie create_appointments_for_auftrag", () => {
  it("eine Gruppe: das Gruppendatum gewinnt, Beginn ist die Startzeit der Offerte (nicht die der Position)", () => {
    expect(
      buildAcceptanceTermine(
        [pos({ service_type: "umzug", scheduled_date: "2026-10-02", scheduled_start_time: "07:00:00" })],
        { service_date: "2026-09-04", service_start_time: "09:15:00" },
      ),
    ).toEqual([{ serviceType: "umzug", date: "2026-10-02", startTime: "09:15" }]);
  });

  it("eine Gruppe ohne Startzeit in der Offerte: keine erfundene Uhrzeit", () => {
    expect(
      buildAcceptanceTermine([pos({ service_type: "umzug" })], { service_date: "2026-10-02", service_start_time: null }),
    ).toEqual([{ serviceType: "umzug", date: "2026-10-02", startTime: null }]);
  });

  it("zwei Gruppen: je Gruppe ihr Datum, sonst das Auftragsdatum; Reihenfolge nach Position", () => {
    expect(
      buildAcceptanceTermine(
        [
          pos({ service_type: "reinigung", scheduled_date: null, position: 5 }),
          pos({ service_type: "umzug", scheduled_date: "2026-10-02", scheduled_start_time: "07:30:00", position: 1 }),
          pos({ service_type: "umzug", scheduled_date: "2026-10-01", position: 2 }),
        ],
        { service_date: null, service_start_time: "08:30:00" },
      ),
    ).toEqual([
      { serviceType: "umzug", date: "2026-10-01", startTime: "07:30" },
      { serviceType: "reinigung", date: "2026-10-01", startTime: "08:30" },
    ]);
  });

  it("Positionen ohne Servicetyp bilden keine eigene Gruppe", () => {
    expect(
      buildAcceptanceTermine(
        [pos({ service_type: null, scheduled_date: "2026-11-01" }), pos({ service_type: "umzug" })],
        { service_date: "2026-10-02", service_start_time: null },
      ),
    ).toEqual([{ serviceType: "umzug", date: "2026-10-02", startTime: null }]);
  });

  it("mehrere Tage in EINER Gruppe: der kleinste zaehlt, wie in offer_arbeitsbeginn()", () => {
    expect(
      buildAcceptanceTermine(
        [
          pos({ service_type: "umzug", scheduled_date: "2026-10-09", position: 1 }),
          pos({ service_type: "umzug", scheduled_date: "2026-10-03", position: 2 }),
        ],
        { service_date: "2026-12-01", service_start_time: null },
      ),
    ).toEqual([{ serviceType: "umzug", date: "2026-10-03", startTime: null }]);
  });

  it("ohne jedes Datum nennt die Bestaetigung keinen Termin", () => {
    expect(buildAcceptanceTermine([pos({ service_type: "umzug" })], { service_date: null, service_start_time: null })).toEqual([]);
  });
});
