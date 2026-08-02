/**
 * Pure decision logic for the DESTRUCTIVE database test guard.
 *
 * `scripts/test-db.sh` wipes a schema (`DROP SCHEMA public CASCADE`) before rebuilding the
 * test baseline. The old guard trusted a single signal — "a Supabase CLI db is published on
 * port 54322" — but 54322 is the Supabase DEFAULT, so ANY other project started with default
 * ports would be selected and wiped. That is the P0 this module closes.
 *
 * This function is the tested SPECIFICATION of the multi-evidence rule; the shell script
 * mirrors it as the runtime enforcement point (same pattern as env-guard.ts ↔ test-db.sh).
 * It is PURE (no I/O) and REFUSES by default: it never targets "whatever is on a port", only
 * a database it can positively prove — by FIVE independent signals — is the CRM test stack:
 *
 *   1. explicit opt-in            CRM_TEST_ENV=1
 *   2. loopback ONLY              every published binding of the db port is 127.0.0.1
 *                                 (a wildcard such as 0.0.0.0 or :: is a refusal, not a pass)
 *   3. dedicated port             matches the port from supabase-test/runtime config (54342),
 *                                 never the 54322 default
 *   4. unique container identity  container name + CLI project label == "crm-test"
 *   5. in-db identity marker      crm_test_guard.identity row == (crm-test, expected version)
 *
 * `mode: "bootstrap"` is the ONLY mode that may proceed WITHOUT the marker (signals 1-4 must
 * still hold), because the very first bootstrap is what creates it. Every normal run requires
 * all five.
 */

import {
  evaluatePublishedBindings,
  type PublishedBinding,
} from "@/test/published-bindings";

export type DbGuardReason =
  | "not_opted_in"
  | "remote_target"
  | "no_published_binding"
  | "non_loopback_host"
  | "wrong_port"
  | "wrong_project"
  | "container_mismatch"
  | "marker_missing"
  | "marker_wrong_project"
  | "marker_wrong_version";

export interface DbGuardEvidence {
  /** process.env.CRM_TEST_ENV — must equal "1". */
  testEnvFlag: string | undefined | null;
  /** true if the target was resolved from a remote URL / linked project (never allowed). */
  isRemote: boolean;
  /**
   * EVERY published host binding of the db container port, from
   * `docker inspect … .NetworkSettings.Ports["5432/tcp"]`.
   *
   * A list, not a single value: a container may publish one container port through several
   * host bindings, and the old single-value shape could not express a second, wildcard one
   * hiding behind a first, loopback one.
   */
  publishedBindings: readonly PublishedBinding[] | undefined | null;
  /** The db port the dedicated test config declares (source of truth), e.g. "54342". */
  expectedPort: string;
  /** The project_id the dedicated test config declares, e.g. "crm-test". */
  expectedProject: string;
  /** The container's `com.supabase.cli.project` label. */
  actualProjectLabel: string | undefined | null;
  /** The resolved container name, expected to be `supabase_db_<expectedProject>`. */
  containerName: string | undefined | null;
  /** crm_test_guard.identity.project_id (null when the marker table/row is absent). */
  markerProject: string | undefined | null;
  /** crm_test_guard.identity.marker_version (null when absent). */
  markerVersion: number | undefined | null;
  /** The marker version this script generation expects. */
  expectedMarkerVersion: number;
}

type DbGuardMode = "bootstrap" | "run";

export type DbGuardResult = { ok: true } | { ok: false; reason: DbGuardReason };

/**
 * Decide whether the destructive rebuild may run against this target. Signals 1-4 are
 * required in every mode; the marker (signal 5) is required only in "run" mode.
 */
export const evaluateDbTarget = (evidence: DbGuardEvidence, mode: DbGuardMode): DbGuardResult => {
  // 1. Explicit opt-in — never inferred.
  if (evidence.testEnvFlag !== "1") return { ok: false, reason: "not_opted_in" };

  // Remote / linked targets are categorically refused.
  if (evidence.isRemote) return { ok: false, reason: "remote_target" };

  // 2 + 3. Loopback-only publication on the dedicated port. Both signals come from the same
  //         evidence and are decided by the shared rule in published-bindings.ts, which the
  //         shell mirrors inside loopback_verify_container: every binding, no exceptions.
  //         Note the shell checks MORE than this module does — container name, running
  //         state, project label, network membership, and every other published port —
  //         because those need a live inspect rather than pure logic.
  //         The refusal is passed through unchanged — every PublishedBindingReason is also a
  //         DbGuardReason, so the caller sees which of the two signals failed and why.
  const bindings = evaluatePublishedBindings(evidence.publishedBindings, evidence.expectedPort);
  if (!bindings.ok) return bindings;

  // 4. Unique container identity: BOTH the CLI project label and the container name must
  //    match the dedicated project. Name alone or label alone is insufficient.
  if (evidence.actualProjectLabel !== evidence.expectedProject) return { ok: false, reason: "wrong_project" };
  if (evidence.containerName !== `supabase_db_${evidence.expectedProject}`) {
    return { ok: false, reason: "container_mismatch" };
  }

  // 5. In-db marker — required for a normal run; the first bootstrap creates it.
  if (mode === "run") {
    if (evidence.markerProject === null || evidence.markerProject === undefined) {
      return { ok: false, reason: "marker_missing" };
    }
    if (evidence.markerProject !== evidence.expectedProject) {
      return { ok: false, reason: "marker_wrong_project" };
    }
    if (evidence.markerVersion !== evidence.expectedMarkerVersion) {
      return { ok: false, reason: "marker_wrong_version" };
    }
  }

  return { ok: true };
};
