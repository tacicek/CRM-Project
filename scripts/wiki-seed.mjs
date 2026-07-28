#!/usr/bin/env node
/**
 * Synthetic data for the wiki screenshot stack: the operator account, then the domain
 * fixtures, then a live proof that both actually work.
 *
 * Invoked by scripts/wiki-db.sh, which has already verified the target is the crm-wiki
 * stack. This script does the parts bash is bad at: the gotrue admin API over HTTP, and
 * JSON.
 *
 * The account is created through the GoTrue Admin API rather than by INSERTing into
 * auth.users. A hand-written row would have to produce a correct bcrypt hash plus
 * instance_id, aud, role, several *_token columns and a matching auth.identities row with
 * the right provider_id — every one of them a gotrue-version coupling that breaks
 * silently at login. supabase-test inserts directly and is right to, because gotrue is
 * disabled there; here it is running and owns the table.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const PROJECT = process.env.WIKI_PROJECT ?? "crm-wiki";
const DB_CONTAINER = process.env.WIKI_DB_CONTAINER ?? `supabase_db_${PROJECT}`;
const ANCHOR = process.env.WIKI_ANCHOR_DATE ?? new Date().toISOString().slice(0, 10);
const WORKDIR = "supabase-wiki/runtime";
const RUNTIME_DIR = "supabase-wiki/.runtime";

/** The one synthetic operator. `example.test` is reserved and can never resolve. */
const OPERATOR_EMAIL = "anna.beispiel@example.test";

const fail = (message) => {
  console.error(`wiki-seed: ${message}`);
  process.exit(1);
};

/** `supabase status -o env` → a plain object. Refuses loudly if a key is missing. */
const readStackEnv = () => {
  const raw = execFileSync("supabase", ["--workdir", WORKDIR, "status", "-o", "env"], {
    encoding: "utf8",
  });
  const env = {};
  for (const line of raw.split("\n")) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  for (const key of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) {
      console.error(`wiki-seed: '${key}' missing from \`supabase status -o env\`. Raw output:\n${raw}`);
      process.exit(1);
    }
  }
  return env;
};

/** Run one seed file inside the db container, with psql variables bound. */
const psqlFile = (file, vars) => {
  const args = [
    "exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
    "-q", "-v", "ON_ERROR_STOP=1",
  ];
  for (const [key, value] of Object.entries(vars)) args.push("-v", `${key}=${value}`);
  args.push("-f", "-");
  return execFileSync("docker", args, { encoding: "utf8", input: readFileSync(file, "utf8") });
};

const main = async () => {
  const env = readStackEnv();
  const { API_URL: apiUrl, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey } = env;

  const admin = (pathname, init = {}) =>
    fetch(`${apiUrl}${pathname}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

  // --- the operator account ---------------------------------------------------------
  // A fresh password every bootstrap; it never enters git and never enters the browser
  // bundle. The capture script reads it back from the runtime file.
  const password = `wiki-${randomUUID()}`;

  const listed = await admin("/auth/v1/admin/users");
  if (!listed.ok) fail(`could not list users (${listed.status}). Is [auth] enabled in the wiki config?`);
  const existing = (await listed.json()).users?.find((u) => u.email === OPERATOR_EMAIL);

  let userId;
  if (existing) {
    // Reset the password rather than recreating: the id is referenced by companies rows
    // that the fixtures re-upsert, and churning it would orphan them.
    const updated = await admin(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!updated.ok) fail(`could not reset the operator password (${updated.status}): ${await updated.text()}`);
    userId = existing.id;
    console.log(`wiki-seed: reused operator ${OPERATOR_EMAIL}`);
  } else {
    const created = await admin("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: OPERATOR_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { first_name: "Anna", last_name: "Beispiel" },
      }),
    });
    if (!created.ok) fail(`could not create the operator (${created.status}): ${await created.text()}`);
    userId = (await created.json()).id;
    console.log(`wiki-seed: created operator ${OPERATOR_EMAIL}`);
  }

  // --- domain fixtures --------------------------------------------------------------
  for (const file of ["010-company-and-user.sql", "020-dashboard.sql", "030-kunden-finanzen.sql", "040-offerten.sql", "050-email-eingang.sql", "060-auftraege-kalender.sql"]) {
    const full = path.join("supabase-wiki/seed", file);
    try {
      psqlFile(full, { user_id: userId, anchor: ANCHOR });
      console.log(`wiki-seed: applied ${file}`);
    } catch (error) {
      fail(`${file} failed:\n${error.stderr ?? error.message}`);
    }
  }

  // --- the probe --------------------------------------------------------------------
  // This is the step that turns the most likely silent failure into a loud one. If
  // auth.uid() cannot see the JWT claim, RLS returns nothing while every HTTP call still
  // answers 200 — and the capture would produce a full set of plausible, empty pages.
  const login = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OPERATOR_EMAIL, password }),
  });
  if (!login.ok) {
    fail(
      `the synthetic operator cannot log in (${login.status}): ${await login.text()}\n` +
        `  If this says "Email logins are disabled", set [auth.email] enable_signup = true\n` +
        `  in ${WORKDIR}/supabase/config.toml — that key gates the email PROVIDER, not just\n` +
        `  registration. Public sign-up stays closed via [auth] enable_signup = false.`,
    );
  }
  const { access_token: token } = await login.json();

  const authed = (pathname) =>
    fetch(`${apiUrl}${pathname}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });

  const companies = await (await authed("/rest/v1/companies?select=id,company_name,is_verified")).json();
  if (!Array.isArray(companies) || companies.length !== 1) {
    fail(
      `RLS probe failed: expected exactly 1 company for the operator, got ${JSON.stringify(companies)}.\n` +
        `  This is the silent-failure case: HTTP is fine, but auth.uid() cannot resolve the\n` +
        `  JWT claim, so every company-scoped policy returns nothing and every screenshot\n` +
        `  would be a plausible blank page. Refusing to continue.`,
    );
  }
  if (companies[0].is_verified !== true) {
    fail("the seeded company is not verified; the app would render its verification gate instead of the dashboard.");
  }

  const leads = await (await authed("/rest/v1/leads?select=id")).json();
  if (!Array.isArray(leads) || leads.length === 0) {
    fail(`RLS probe failed: the operator sees 0 requests, so every list screenshot would be empty.`);
  }

  // --- hand the credentials to the capture script -----------------------------------
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const credentialsPath = path.join(RUNTIME_DIR, "credentials.json");
  writeFileSync(
    credentialsPath,
    `${JSON.stringify({ email: OPERATOR_EMAIL, password, userId, anchor: ANCHOR, apiUrl }, null, 2)}\n`,
    { mode: 0o600 },
  );

  console.log(
    `wiki-seed: probe OK — operator sees company "${companies[0].company_name}" and ${leads.length} requests.`,
  );
  console.log(`wiki-seed: credentials written to ${credentialsPath} (gitignored, mode 600).`);
};

main().catch((error) => fail(error?.stack ?? String(error)));
