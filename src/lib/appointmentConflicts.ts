// Pure conflict detection for appointments (M3). Tested; the modal feeds live rows in.
//
// Two appointments only truly conflict when they overlap in time AND share a resource
// (a team member or a vehicle). Two independent crews working different jobs at the same
// hour is NOT a conflict — the old "any time overlap" check flagged those as false
// positives, training users to ignore the warning and miss the real double-bookings.
//
// Fallback: when the candidate has NO resources assigned yet, resource matching is
// impossible, so we fall back to plain time-overlap (informational).

export interface ConflictCandidate {
  id?: string | null;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  assigned_team_member_ids?: string[] | null;
  required_vehicles?: string[] | null;
}

export interface ConflictResult<T> {
  appointment: T;
  /** Which resource classes overlap. Empty => time-only (candidate had no resources). */
  sharedTeam: boolean;
  sharedVehicles: boolean;
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart < bEnd && aEnd > bStart;

const intersects = (a: string[] | null | undefined, b: string[] | null | undefined): boolean => {
  if (!a || !b || a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((x) => set.has(x));
};

/**
 * Returns the existing appointments that genuinely conflict with the candidate.
 * The caller is expected to have already narrowed `existing` to the same day/company
 * and excluded cancelled + the candidate itself (kept flexible here for testability).
 */
export function detectConflicts<T extends ConflictCandidate>(
  candidate: ConflictCandidate,
  existing: T[],
): ConflictResult<T>[] {
  const hasResources =
    (candidate.assigned_team_member_ids?.length ?? 0) > 0 ||
    (candidate.required_vehicles?.length ?? 0) > 0;

  const out: ConflictResult<T>[] = [];
  for (const apt of existing) {
    if (apt.id && candidate.id && apt.id === candidate.id) continue;
    if (!overlaps(candidate.start_time, candidate.end_time, apt.start_time, apt.end_time)) continue;

    if (!hasResources) {
      // No resources on the candidate → can't match; surface time overlap only.
      out.push({ appointment: apt, sharedTeam: false, sharedVehicles: false });
      continue;
    }
    const sharedTeam = intersects(candidate.assigned_team_member_ids, apt.assigned_team_member_ids);
    const sharedVehicles = intersects(candidate.required_vehicles, apt.required_vehicles);
    if (sharedTeam || sharedVehicles) {
      out.push({ appointment: apt, sharedTeam, sharedVehicles });
    }
  }
  return out;
}
