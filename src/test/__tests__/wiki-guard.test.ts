import { describe, expect, it } from "vitest";
import {
  evaluateWikiCaptureTarget,
  explainWikiGuardRefusal,
  type WikiCaptureEvidence,
} from "@/test/wiki-guard";

/**
 * The screenshot guard's specification.
 *
 * The case that matters most is `refuses production behind a loopback URL`. In dev,
 * vite.config.ts rewrites the browser-visible VITE_SUPABASE_URL to
 * `window.location.origin` and proxies the API elsewhere — and this repo's .env.local
 * resolves to production. So a loopback base URL proves nothing at all, and the only
 * honest check is whether the database behind the proxy identifies itself. If that test
 * is ever deleted, a capture run can photograph real customers.
 */
const good: WikiCaptureEvidence = {
  wikiEnvFlag: "1",
  captureFlag: "1",
  baseUrl: "http://localhost:8099",
  expectedBasePort: "8099",
  apiUrl: "http://127.0.0.1:54421",
  expectedApiPort: "54421",
  identityProject: "crm-wiki",
  identityVersion: 1,
  expectedProject: "crm-wiki",
  expectedMarkerVersion: 1,
};

const evidence = (overrides: Partial<WikiCaptureEvidence>): WikiCaptureEvidence => ({
  ...good,
  ...overrides,
});

describe("evaluateWikiCaptureTarget", () => {
  it("allows the fully verified local wiki stack", () => {
    expect(evaluateWikiCaptureTarget(good)).toEqual({ ok: true });
  });

  it("refuses production behind a loopback URL", () => {
    // The whole point of the guard. Every URL check passes; only the identity fails.
    const result = evaluateWikiCaptureTarget(evidence({ identityProject: null, identityVersion: null }));
    expect(result).toEqual({ ok: false, reason: "identity_unreachable" });
  });

  it("refuses a different local project that happens to answer", () => {
    expect(evaluateWikiCaptureTarget(evidence({ identityProject: "crm-test" }))).toEqual({
      ok: false,
      reason: "identity_wrong_project",
    });
  });

  it("refuses a stale marker version", () => {
    expect(evaluateWikiCaptureTarget(evidence({ identityVersion: 0 }))).toEqual({
      ok: false,
      reason: "identity_wrong_version",
    });
  });

  it("requires both opt-ins, and never infers either", () => {
    expect(evaluateWikiCaptureTarget(evidence({ wikiEnvFlag: undefined }))).toEqual({
      ok: false,
      reason: "not_opted_in",
    });
    expect(evaluateWikiCaptureTarget(evidence({ wikiEnvFlag: "true" }))).toEqual({
      ok: false,
      reason: "not_opted_in",
    });
    expect(evaluateWikiCaptureTarget(evidence({ captureFlag: null }))).toEqual({
      ok: false,
      reason: "capture_not_opted_in",
    });
  });

  it("refuses a non-loopback base URL", () => {
    expect(evaluateWikiCaptureTarget(evidence({ baseUrl: "http://example.test:8099" }))).toEqual({
      ok: false,
      reason: "base_url_not_loopback",
    });
    expect(
      evaluateWikiCaptureTarget(evidence({ baseUrl: "https://crm.example.test" })),
    ).toEqual({ ok: false, reason: "base_url_not_loopback" });
  });

  it("refuses the developer's own dev server on port 8080", () => {
    // 8080 is the normal `npm run dev` port, which on this machine points at production.
    expect(evaluateWikiCaptureTarget(evidence({ baseUrl: "http://localhost:8080" }))).toEqual({
      ok: false,
      reason: "base_url_wrong_port",
    });
  });

  it("refuses a proxy target that is not the wiki stack's API", () => {
    expect(
      evaluateWikiCaptureTarget(evidence({ apiUrl: "http://supabasekong.example.test" })),
    ).toEqual({ ok: false, reason: "api_url_not_loopback" });

    // 54321 is another local Supabase project's Kong, not ours.
    expect(evaluateWikiCaptureTarget(evidence({ apiUrl: "http://127.0.0.1:54321" }))).toEqual({
      ok: false,
      reason: "api_url_wrong_port",
    });
  });

  it("treats an unparseable URL as not loopback rather than throwing", () => {
    expect(evaluateWikiCaptureTarget(evidence({ baseUrl: "not a url" }))).toEqual({
      ok: false,
      reason: "base_url_not_loopback",
    });
  });

  it("checks the opt-ins before anything else, so a refusal is never misleading", () => {
    const result = evaluateWikiCaptureTarget(
      evidence({ wikiEnvFlag: undefined, baseUrl: "http://evil.test", identityProject: null }),
    );
    expect(result).toEqual({ ok: false, reason: "not_opted_in" });
  });
});

describe("explainWikiGuardRefusal", () => {
  it("gives a full sentence for every reason", () => {
    const reasons = [
      "not_opted_in",
      "capture_not_opted_in",
      "base_url_not_loopback",
      "base_url_wrong_port",
      "api_url_not_loopback",
      "api_url_wrong_port",
      "identity_unreachable",
      "identity_wrong_project",
      "identity_wrong_version",
    ] as const;

    for (const reason of reasons) {
      const message = explainWikiGuardRefusal(reason);
      expect(message.length, reason).toBeGreaterThan(20);
      // A bare enum value in an error message helps nobody.
      expect(message, reason).not.toBe(reason);
    }
  });
});
