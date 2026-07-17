import { describe, it, expect } from "vitest";
import { evaluateDbTarget, type DbGuardEvidence } from "@/test/db-guard";

// A fully-valid evidence set for the dedicated crm-test stack. Each test overrides one signal.
const valid = (overrides: Partial<DbGuardEvidence> = {}): DbGuardEvidence => ({
  testEnvFlag: "1",
  isRemote: false,
  host: "127.0.0.1",
  expectedPort: "54342",
  actualPort: "54342",
  expectedProject: "crm-test",
  actualProjectLabel: "crm-test",
  containerName: "supabase_db_crm-test",
  markerProject: "crm-test",
  markerVersion: 1,
  expectedMarkerVersion: 1,
  ...overrides,
});

describe("evaluateDbTarget", () => {
  it("1. refuses when CRM_TEST_ENV is not set", () => {
    expect(evaluateDbTarget(valid({ testEnvFlag: undefined }), "run")).toEqual({ ok: false, reason: "not_opted_in" });
  });
  it("1b. refuses an empty CRM_TEST_ENV value", () => {
    expect(evaluateDbTarget(valid({ testEnvFlag: "" }), "run")).toEqual({ ok: false, reason: "not_opted_in" });
  });
  it("2. refuses a non-local host", () => {
    expect(evaluateDbTarget(valid({ host: "10.0.2.4" }), "run")).toEqual({ ok: false, reason: "non_local_host" });
  });
  it("3. refuses another project's port (e.g. the 54322 default)", () => {
    expect(evaluateDbTarget(valid({ actualPort: "54322" }), "run")).toEqual({ ok: false, reason: "wrong_port" });
  });
  it("4. refuses the right port but wrong project label", () => {
    expect(evaluateDbTarget(valid({ actualProjectLabel: "umzungcheck-next" }), "run")).toEqual({ ok: false, reason: "wrong_project" });
  });
  it("4b. refuses a container name that is not supabase_db_<project>", () => {
    expect(evaluateDbTarget(valid({ containerName: "supabase_db_umzungcheck-next" }), "run")).toEqual({ ok: false, reason: "container_mismatch" });
  });
  it("5. refuses run mode when the marker is missing", () => {
    expect(evaluateDbTarget(valid({ markerProject: null, markerVersion: null }), "run")).toEqual({ ok: false, reason: "marker_missing" });
  });
  it("6. refuses a marker for the wrong project", () => {
    expect(evaluateDbTarget(valid({ markerProject: "something-else" }), "run")).toEqual({ ok: false, reason: "marker_wrong_project" });
  });
  it("7. refuses a stale marker version", () => {
    expect(evaluateDbTarget(valid({ markerVersion: 0 }), "run")).toEqual({ ok: false, reason: "marker_wrong_version" });
  });
  it("8. refuses a remote target", () => {
    expect(evaluateDbTarget(valid({ isRemote: true }), "run")).toEqual({ ok: false, reason: "remote_target" });
  });
  it("9. refuses when there is no published host (guard could not resolve target)", () => {
    expect(evaluateDbTarget(valid({ host: null }), "run")).toEqual({ ok: false, reason: "non_local_host" });
  });
  it("10. allows run mode when every signal is correct", () => {
    expect(evaluateDbTarget(valid(), "run")).toEqual({ ok: true });
  });
  it("11. bootstrap proceeds WITHOUT a marker (it is what creates it) — signals 1-4 still hold", () => {
    expect(evaluateDbTarget(valid({ markerProject: null, markerVersion: null }), "bootstrap")).toEqual({ ok: true });
  });
  it("12. bootstrap still refuses on a wrong port / non-local host / no opt-in", () => {
    expect(evaluateDbTarget(valid({ markerProject: null, actualPort: "54322" }), "bootstrap")).toEqual({ ok: false, reason: "wrong_port" });
    expect(evaluateDbTarget(valid({ markerProject: null, host: "example.com" }), "bootstrap")).toEqual({ ok: false, reason: "non_local_host" });
    expect(evaluateDbTarget(valid({ markerProject: null, testEnvFlag: undefined }), "bootstrap")).toEqual({ ok: false, reason: "not_opted_in" });
  });
  it("13. does not fall back to a default port when actualPort is empty", () => {
    expect(evaluateDbTarget(valid({ actualPort: "" }), "run")).toEqual({ ok: false, reason: "wrong_port" });
    expect(evaluateDbTarget(valid({ actualPort: null }), "run")).toEqual({ ok: false, reason: "wrong_port" });
  });
});
