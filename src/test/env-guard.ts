/**
 * Fail-closed production-safety guard for integration tests.
 *
 * The CRM's real database is a self-hosted Supabase on Coolify. A test run that
 * accidentally points at it would create, mutate or delete real customer data.
 * This guard is the single chokepoint every DB/RLS/edge integration test must call
 * before it opens a connection. It is PURE (no I/O) so it is itself unit-testable,
 * and it REFUSES by default: anything it cannot positively prove to be a local,
 * explicitly-opted-in test target throws.
 *
 * `NODE_ENV === "test"` is deliberately NOT sufficient (a dev could run tests with
 * a prod URL in `.env.local`). Two independent signals are required:
 *   1. the Supabase URL host is on a hard allowlist of local hosts, AND
 *   2. an explicit opt-in flag is set (CRM_TEST_ENV=1), AND
 *   3. the DB host/port (when supplied) is local, AND
 *   4. nothing looks like the known production shape.
 */

/** Hosts that are unambiguously a developer machine / CI test container. */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  // Supabase-in-Docker service name, only reachable inside a CI test network.
  "supabase_kong_crm-test",
]);

/** Local Supabase default ports (supabase/config.toml: api 54321, db 54322). */
const ALLOWED_API_PORTS: ReadonlySet<string> = new Set(["54321", ""]);
const ALLOWED_DB_PORTS: ReadonlySet<string> = new Set(["54322", "5432"]);

export interface TestEnvInput {
  /** import.meta.env.VITE_SUPABASE_URL / process.env equivalent the client would use. */
  supabaseUrl: string | undefined | null;
  /** Direct Postgres host, when a test connects to the DB (not via the API). */
  databaseHost?: string | undefined | null;
  /** Direct Postgres port. */
  databasePort?: string | number | undefined | null;
  /** Explicit opt-in flag — must equal "1". Sourced from process.env.CRM_TEST_ENV. */
  testEnvFlag?: string | undefined | null;
}

export class UnsafeTestEnvironmentError extends Error {
  constructor(reason: string) {
    super(
      `Refusing to run integration tests: ${reason}. ` +
        `Tests may only target a local Supabase stack with CRM_TEST_ENV=1. ` +
        `This is a fail-closed guard — see src/test/env-guard.ts.`
    );
    this.name = "UnsafeTestEnvironmentError";
  }
}

/** Parse the host of a URL without throwing; returns null on any malformed input. */
const parseHost = (url: string): { host: string; port: string } | null => {
  try {
    const u = new URL(url);
    // u.hostname strips brackets from IPv6; normalise back so the allowlist matches.
    const host = u.hostname === "::1" ? "::1" : u.hostname;
    return { host, port: u.port };
  } catch {
    return null;
  }
};

/**
 * Throws unless every safety signal proves this is a local, opted-in test target.
 * Returns void on success so a caller can `assertSafeTestEnvironment(...)` as a gate.
 */
export const assertSafeTestEnvironment = (input: TestEnvInput): void => {
  // 1. Explicit opt-in. Absent flag → refuse (never infer intent).
  if (input.testEnvFlag !== "1") {
    throw new UnsafeTestEnvironmentError(
      "CRM_TEST_ENV is not set to \"1\" (explicit opt-in missing)"
    );
  }

  // 2. Supabase URL must be present and parseable — an unknown target is unsafe.
  if (!input.supabaseUrl || input.supabaseUrl.trim() === "") {
    throw new UnsafeTestEnvironmentError("VITE_SUPABASE_URL is empty/undefined");
  }
  const parsed = parseHost(input.supabaseUrl);
  if (!parsed) {
    throw new UnsafeTestEnvironmentError(`VITE_SUPABASE_URL is not a valid URL: ${input.supabaseUrl}`);
  }

  // 3. Host on the local allowlist. A real domain (prod) fails here.
  if (!ALLOWED_HOSTS.has(parsed.host)) {
    throw new UnsafeTestEnvironmentError(`Supabase host "${parsed.host}" is not a local test host`);
  }
  if (!ALLOWED_API_PORTS.has(parsed.port)) {
    throw new UnsafeTestEnvironmentError(
      `Supabase API port "${parsed.port}" is not a local Supabase port`
    );
  }

  // 4. Direct DB host/port, when supplied, must also be local.
  const hasHost = input.databaseHost !== null && input.databaseHost !== undefined;
  if (hasHost && !ALLOWED_HOSTS.has(input.databaseHost)) {
    throw new UnsafeTestEnvironmentError(`Database host "${input.databaseHost}" is not local`);
  }
  const hasPort = input.databasePort !== null && input.databasePort !== undefined;
  if (hasPort) {
    const port = String(input.databasePort);
    if (!ALLOWED_DB_PORTS.has(port)) {
      throw new UnsafeTestEnvironmentError(`Database port "${port}" is not a local Supabase DB port`);
    }
  }
};

/** Non-throwing variant for callers that want a boolean (e.g. a skip decision). */
export const isSafeTestEnvironment = (input: TestEnvInput): boolean => {
  try {
    assertSafeTestEnvironment(input);
    return true;
  } catch {
    return false;
  }
};
