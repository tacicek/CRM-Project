/**
 * Pure decision logic for the WIKI SCREENSHOT capture guard.
 *
 * The hazard this closes is specific and non-obvious. `vite.config.ts`, in `serve` mode,
 * rewrites the browser-visible `VITE_SUPABASE_URL` to the literal expression
 * `window.location.origin` and proxies `^/(rest|auth|storage|functions|realtime)/` to
 * whatever Supabase the environment resolved. The repo's `.env.local` currently resolves
 * to PRODUCTION. So:
 *
 *   - the page always believes it is talking to localhost, and
 *   - a guard that asks "is the base URL loopback?" PASSES against production.
 *
 * A screenshot run that trusted the URL would therefore photograph real customers. The
 * only check that cannot be fooled is asking the database *behind the proxy* to identify
 * itself: production has no `crm_wiki_guard` marker.
 *
 * This module is the tested SPECIFICATION; `scripts/capture-wiki-screenshots.mjs` mirrors
 * it as the runtime enforcement point, exactly as `db-guard.ts` ↔ `test-db.sh` do.
 *
 * Why this does not extend `src/test/env-guard.ts`: that module's allowlists are pinned
 * to the app stack's ports (api 54321 / db 54322) as a production-safety boundary, and
 * its model assumes `supabaseUrl` *is* the API endpoint. Neither is true here — the
 * browser's endpoint is the dev server, and the real target is hidden in `server.proxy`.
 * Widening a production-safety allowlist to accommodate a screenshot tool would be the
 * wrong trade, so this is a sibling with narrower rules of its own.
 */

export type WikiGuardReason =
  | "not_opted_in"
  | "capture_not_opted_in"
  | "base_url_not_loopback"
  | "base_url_wrong_port"
  | "api_url_not_loopback"
  | "api_url_wrong_port"
  | "identity_unreachable"
  | "identity_wrong_project"
  | "identity_wrong_version";

export interface WikiCaptureEvidence {
  /** process.env.CRM_WIKI_ENV — must equal "1". */
  wikiEnvFlag: string | undefined | null;
  /** process.env.CRM_WIKI_CAPTURE — must equal "1". A second, capture-specific opt-in. */
  captureFlag: string | undefined | null;
  /** The URL the browser is pointed at, e.g. "http://localhost:8099". */
  baseUrl: string;
  /** The port the capture dev server must bind to. */
  expectedBasePort: string;
  /** The Supabase API URL the dev server proxies to, e.g. "http://127.0.0.1:54421". */
  apiUrl: string;
  /** The api port the dedicated wiki config declares. */
  expectedApiPort: string;
  /**
   * `project_id` returned by `public.crm_wiki_identity()` *through the dev-server proxy*.
   * `null` when the call failed or returned nothing — which is what production does.
   */
  identityProject: string | undefined | null;
  /** `marker_version` from the same call. */
  identityVersion: number | undefined | null;
  /** The project id this stack must be. */
  expectedProject: string;
  /** The marker version this script generation expects. */
  expectedMarkerVersion: number;
}

export type WikiGuardResult = { ok: true } | { ok: false; reason: WikiGuardReason };

/**
 * Hosts the capture may talk to. Narrower than env-guard's set on purpose: a screenshot
 * run has no reason to reach a container hostname, only the loopback interface.
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Parse a URL without throwing; an unparseable URL is treated as not-loopback. */
const parse = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLoopback = (url: URL | null): boolean =>
  url !== null && LOOPBACK_HOSTS.has(url.hostname);

/**
 * Decide whether a capture run may proceed.
 *
 * Refuses by default. Every signal must hold; there is no "bootstrap" escape hatch,
 * because unlike the DB rebuild there is no first run that legitimately lacks the marker
 * — the bootstrap creates it before any browser starts.
 */
export const evaluateWikiCaptureTarget = (evidence: WikiCaptureEvidence): WikiGuardResult => {
  // 1. Two explicit opt-ins, neither ever inferred.
  if (evidence.wikiEnvFlag !== "1") return { ok: false, reason: "not_opted_in" };
  if (evidence.captureFlag !== "1") return { ok: false, reason: "capture_not_opted_in" };

  // 2. The browser must be pointed at our own dev server on its dedicated port. This is
  //    necessary but NOT sufficient — see the module docstring.
  const base = parse(evidence.baseUrl);
  if (!isLoopback(base)) return { ok: false, reason: "base_url_not_loopback" };
  if (base!.port !== evidence.expectedBasePort) return { ok: false, reason: "base_url_wrong_port" };

  // 3. The proxy target must itself be the local wiki stack's API.
  const api = parse(evidence.apiUrl);
  if (!isLoopback(api)) return { ok: false, reason: "api_url_not_loopback" };
  if (api!.port !== evidence.expectedApiPort) return { ok: false, reason: "api_url_wrong_port" };

  // 4. The decisive signal: the database behind the proxy identifies itself as this
  //    stack. Production cannot satisfy this, whatever the URL says.
  if (evidence.identityProject === null || evidence.identityProject === undefined) {
    return { ok: false, reason: "identity_unreachable" };
  }
  if (evidence.identityProject !== evidence.expectedProject) {
    return { ok: false, reason: "identity_wrong_project" };
  }
  if (evidence.identityVersion !== evidence.expectedMarkerVersion) {
    return { ok: false, reason: "identity_wrong_version" };
  }

  return { ok: true };
};

/** Human-readable refusal text, so the script never prints a bare enum value. */
export const explainWikiGuardRefusal = (reason: WikiGuardReason): string => {
  switch (reason) {
    case "not_opted_in":
      return "CRM_WIKI_ENV must be '1' (explicit opt-in; never inferred).";
    case "capture_not_opted_in":
      return "CRM_WIKI_CAPTURE must be '1' (second opt-in, specific to writing screenshots).";
    case "base_url_not_loopback":
      return "the capture base URL is not a loopback address.";
    case "base_url_wrong_port":
      return "the capture base URL is not on the dedicated capture port.";
    case "api_url_not_loopback":
      return "the Supabase API the dev server proxies to is not a loopback address.";
    case "api_url_wrong_port":
      return "the Supabase API port is not the dedicated wiki stack port.";
    case "identity_unreachable":
      return "the database behind the dev-server proxy did not answer crm_wiki_identity() — it is NOT the wiki stack (production would fail exactly here).";
    case "identity_wrong_project":
      return "the database behind the proxy identifies as a different project.";
    case "identity_wrong_version":
      return "the wiki stack's marker version does not match this script generation; re-run the bootstrap.";
  }
};
