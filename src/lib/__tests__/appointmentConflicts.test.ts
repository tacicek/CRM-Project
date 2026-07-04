import { describe, it, expect } from "vitest";
import { detectConflicts, type ConflictCandidate } from "@/lib/appointmentConflicts";

const appt = (o: Partial<ConflictCandidate> & { id: string }): ConflictCandidate & { id: string } => ({
  start_time: "09:00", end_time: "12:00", assigned_team_member_ids: [], required_vehicles: [], ...o,
});

describe("detectConflicts (M3 resource-based)", () => {
  it("time overlap + shared team member → conflict", () => {
    const cand = appt({ id: "c", assigned_team_member_ids: ["t1"] });
    const r = detectConflicts(cand, [appt({ id: "a", start_time: "10:00", end_time: "13:00", assigned_team_member_ids: ["t1", "t2"] })]);
    expect(r).toHaveLength(1);
    expect(r[0].sharedTeam).toBe(true);
  });

  it("time overlap but DIFFERENT crews → NO conflict (was a false positive before)", () => {
    const cand = appt({ id: "c", assigned_team_member_ids: ["t1"], required_vehicles: ["v1"] });
    const r = detectConflicts(cand, [appt({ id: "a", assigned_team_member_ids: ["t2"], required_vehicles: ["v2"] })]);
    expect(r).toHaveLength(0);
  });

  it("shared vehicle → conflict even with different crews", () => {
    const cand = appt({ id: "c", assigned_team_member_ids: ["t1"], required_vehicles: ["lkw-1"] });
    const r = detectConflicts(cand, [appt({ id: "a", assigned_team_member_ids: ["t9"], required_vehicles: ["lkw-1"] })]);
    expect(r).toHaveLength(1);
    expect(r[0].sharedVehicles).toBe(true);
    expect(r[0].sharedTeam).toBe(false);
  });

  it("no time overlap → never a conflict", () => {
    const cand = appt({ id: "c", start_time: "09:00", end_time: "10:00", assigned_team_member_ids: ["t1"] });
    const r = detectConflicts(cand, [appt({ id: "a", start_time: "10:00", end_time: "11:00", assigned_team_member_ids: ["t1"] })]);
    expect(r).toHaveLength(0); // touching edges don't overlap
  });

  it("candidate without resources → falls back to time-only overlap", () => {
    const cand = appt({ id: "c" }); // no team, no vehicles
    const r = detectConflicts(cand, [appt({ id: "a", start_time: "11:00", end_time: "14:00", assigned_team_member_ids: ["t1"] })]);
    expect(r).toHaveLength(1);
    expect(r[0].sharedTeam).toBe(false);
    expect(r[0].sharedVehicles).toBe(false);
  });

  it("excludes the candidate itself by id", () => {
    const cand = appt({ id: "same", assigned_team_member_ids: ["t1"] });
    const r = detectConflicts(cand, [appt({ id: "same", assigned_team_member_ids: ["t1"] })]);
    expect(r).toHaveLength(0);
  });

  it("HH:MM:SS times compare correctly", () => {
    const cand = appt({ id: "c", start_time: "09:00:00", end_time: "12:00:00", assigned_team_member_ids: ["t1"] });
    const r = detectConflicts(cand, [appt({ id: "a", start_time: "11:30:00", end_time: "13:00:00", assigned_team_member_ids: ["t1"] })]);
    expect(r).toHaveLength(1);
  });
});
