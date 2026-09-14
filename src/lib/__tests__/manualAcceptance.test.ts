import { describe, expect, it } from "vitest";
import { manualAcceptanceFailure, manualAcceptanceWarning } from "@/lib/manualAcceptance";

const item = (scheduled_date: string | null, service_type = "umzug") => ({
  service_type,
  scheduled_date,
  scheduled_start_time: null,
  position: 1,
});

describe("manualAcceptanceWarning", () => {
  it("keine Warnung, solange die Frist offen ist", () => {
    expect(manualAcceptanceWarning("2026-09-30", "2026-10-10", [], "2026-09-14")).toEqual({ kind: "none" });
  });

  it("warnt nach Ablauf der Annahmefrist (valid_until)", () => {
    expect(manualAcceptanceWarning("2026-09-01", "2026-10-10", [], "2026-09-14")).toEqual({
      kind: "deadlinePassed",
      deadline: "2026-09-01",
    });
  });

  it("die Frist endet spaetestens am Vortag des ersten Arbeitstags — aus den Gruppen gerechnet", () => {
    expect(manualAcceptanceWarning(null, "2026-12-01", [item("2026-09-14")], "2026-09-14")).toEqual({
      kind: "deadlinePassed",
      deadline: "2026-09-13",
    });
  });

  it("ein vergangener Arbeitstag geht der Frist vor", () => {
    expect(manualAcceptanceWarning("2026-08-01", "2026-09-10", [], "2026-09-14")).toEqual({
      kind: "workDatePassed",
      workDate: "2026-09-10",
    });
  });

  it("ohne Frist und ohne Datum: keine Warnung", () => {
    expect(manualAcceptanceWarning(null, null, [], "2026-09-14")).toEqual({ kind: "none" });
  });
});

describe("manualAcceptanceFailure", () => {
  it("liest die festen Kennungen der Datenbankfunktion", () => {
    expect(manualAcceptanceFailure({ message: "offer_not_open" })).toBe("notOpen");
    expect(manualAcceptanceFailure({ message: "offer_superseded" })).toBe("superseded");
    expect(manualAcceptanceFailure({ message: "offer_not_found" })).toBe("notFound");
  });

  it("alles andere ist eine Stoerung", () => {
    expect(manualAcceptanceFailure({ message: "Failed to fetch" })).toBe("failed");
    expect(manualAcceptanceFailure(null)).toBe("failed");
    expect(manualAcceptanceFailure("offer_not_open")).toBe("failed");
  });
});
