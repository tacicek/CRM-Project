#!/usr/bin/env node
/**
 * Capture the Wiki's screenshots from the running CRM, against the isolated crm-wiki
 * stack and nothing else.
 *
 * THE HAZARD THIS SCRIPT EXISTS TO CONTAIN
 *
 * `vite.config.ts`, in serve mode, rewrites the browser-visible VITE_SUPABASE_URL to the
 * literal `window.location.origin` and proxies /rest, /auth, /storage, /functions and
 * /realtime to whatever Supabase the environment resolved. This repo's `.env.local`
 * resolves to PRODUCTION. Consequences:
 *
 *   - the page always believes it is on localhost, so a "is the URL loopback?" check
 *     passes even when every byte is coming from the production database;
 *   - a naive capture run would photograph real customers.
 *
 * Two mechanisms close it, and neither may be weakened:
 *
 *   1. This script spawns its OWN Vite with every variable in vite.config's resolution
 *      chain set explicitly. Setting only VITE_SUPABASE_URL is not enough: an empty value
 *      falls through to SUPABASE_URL, and VITE_SUPABASE_PROJECT_ID is a third path to a
 *      remote host.
 *   2. It asks the database BEHIND the proxy to identify itself, via
 *      public.crm_wiki_identity(). Production has no such function, so it refuses there
 *      whatever the URL says.
 *
 * Nothing is written unless a shot passes every quality check — a run that fails leaves
 * no files rather than a directory of login screens and spinners.
 *
 * Usage:
 *   npm run wiki:db:up && CRM_WIKI_ENV=1 npm run wiki:db:bootstrap
 *   CRM_WIKI_ENV=1 CRM_WIKI_CAPTURE=1 npm run wiki:capture
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { SHOTS, VIEWPORTS, ALL_LOCALES } from "./wiki-shots.manifest.mjs";

const CONFIG = "supabase-wiki/runtime/supabase/config.toml";
const CREDENTIALS = "supabase-wiki/.runtime/credentials.json";
const OUT_ROOT = "public/wiki/screenshots";
const META_FILE = "src/features/wiki/wikiScreenshotMeta.generated.ts";
const BASE_PORT = "8099";
const MARKER_VERSION = 1;
/** Bumped when an image is re-captured; `public/` filenames are not content-hashed. */
const ASSET_VERSION = "v1";
const CHROME = process.env.CRM_WIKI_CHROME ?? "/usr/bin/google-chrome-stable";

const refuse = (message) => {
  console.error(`REFUSING (wiki-capture): ${message}`);
  process.exit(2);
};
const fail = (message) => {
  console.error(`wiki-capture: ${message}`);
  process.exit(1);
};

// --- config -------------------------------------------------------------------------
const readConfigValue = (section, key) => {
  const text = readFileSync(CONFIG, "utf8");
  const lines = text.split("\n");
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) inSection = trimmed === `[${section}]`;
    else if (inSection) {
      const match = new RegExp(`^${key}\\s*=\\s*"?([^"\\s#]+)"?`).exec(trimmed);
      if (match) return match[1];
    }
  }
  return null;
};

const readProjectId = () => /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(CONFIG, "utf8"))?.[1] ?? null;

/**
 * Ids the fixtures cannot pin.
 *
 * Rows created through the app's own routines — `create_offer_revision`,
 * `create_offer_amendment` — get their uuid from the routine, not from the seed file.
 * That is deliberate (see supabase-wiki/seed/040-offerten.sql): writing those rows by
 * hand would bypass the triggers and produce states the app cannot actually reach.
 *
 * So the manifest writes `{nachtragId}` and this looks the value up at capture time.
 * Each query must return exactly one row; anything else means the fixture changed and
 * the run stops rather than photographing the wrong record.
 */
const FIXTURE_QUERIES = {
  acceptedOfferId: "SELECT id FROM public.offers WHERE status = 'accepted' ORDER BY created_at LIMIT 1",
  supersededOfferId: "SELECT id FROM public.offers WHERE superseded_at IS NOT NULL ORDER BY created_at LIMIT 1",
  draftOfferId: "SELECT id FROM public.offers WHERE status = 'draft' AND version_number = 1 ORDER BY created_at LIMIT 1",
  newVersionId: "SELECT id FROM public.offers WHERE version_number = 2 ORDER BY created_at LIMIT 1",
  nachtragId: "SELECT id FROM public.offer_amendments ORDER BY created_at LIMIT 1",
  leadId: "SELECT id FROM public.leads ORDER BY created_at LIMIT 1",
};

const resolveFixtureIds = (dbContainer) => {
  const ids = {};
  for (const [name, sql] of Object.entries(FIXTURE_QUERIES)) {
    const out = execFileSync(
      "docker",
      ["exec", "-i", dbContainer, "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql],
      { encoding: "utf8" },
    ).trim();
    if (!/^[0-9a-f-]{36}$/.test(out)) {
      fail(`fixture lookup "${name}" returned ${JSON.stringify(out)} instead of one uuid — re-run the bootstrap.`);
    }
    ids[name] = out;
  }
  return ids;
};

/** Replace `{name}` placeholders in a route, refusing on an unknown name. */
const fillRoute = (route, ids) =>
  route.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in ids)) fail(`manifest route "${route}" uses unknown placeholder {${key}}`);
    return ids[key];
  });

// --- guard --------------------------------------------------------------------------
// The decision logic below MIRRORS src/test/wiki-guard.ts, which is the tested
// specification. Same arrangement as db-guard.ts <-> test-db.sh: the TypeScript states
// and proves the rule, the build-time tool enforces it without dragging a TS runtime in.
// The two must be edited together — src/test/__tests__/wiki-guard.test.ts is what keeps
// the specification honest.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLoopback = (url) => url !== null && LOOPBACK_HOSTS.has(url.hostname);

const evaluateWikiCaptureTarget = (e) => {
  if (e.wikiEnvFlag !== "1") return { ok: false, reason: "not_opted_in" };
  if (e.captureFlag !== "1") return { ok: false, reason: "capture_not_opted_in" };

  const base = parseUrl(e.baseUrl);
  if (!isLoopback(base)) return { ok: false, reason: "base_url_not_loopback" };
  if (base.port !== e.expectedBasePort) return { ok: false, reason: "base_url_wrong_port" };

  const api = parseUrl(e.apiUrl);
  if (!isLoopback(api)) return { ok: false, reason: "api_url_not_loopback" };
  if (api.port !== e.expectedApiPort) return { ok: false, reason: "api_url_wrong_port" };

  if (e.identityProject === null || e.identityProject === undefined) {
    return { ok: false, reason: "identity_unreachable" };
  }
  if (e.identityProject !== e.expectedProject) return { ok: false, reason: "identity_wrong_project" };
  if (e.identityVersion !== e.expectedMarkerVersion) return { ok: false, reason: "identity_wrong_version" };

  return { ok: true };
};

const GUARD_EXPLANATIONS = {
  not_opted_in: "CRM_WIKI_ENV must be '1' (explicit opt-in; never inferred).",
  capture_not_opted_in: "CRM_WIKI_CAPTURE must be '1' (second opt-in, specific to writing screenshots).",
  base_url_not_loopback: "the capture base URL is not a loopback address.",
  base_url_wrong_port: "the capture base URL is not on the dedicated capture port.",
  api_url_not_loopback: "the Supabase API the dev server proxies to is not loopback.",
  api_url_wrong_port: "the Supabase API port is not the dedicated wiki stack port.",
  identity_unreachable:
    "the database behind the dev-server proxy did not answer crm_wiki_identity() — it is NOT the wiki stack (production fails exactly here).",
  identity_wrong_project: "the database behind the proxy identifies as a different project.",
  identity_wrong_version: "the marker version does not match this script; re-run the bootstrap.",
};

const explainWikiGuardRefusal = (reason) => GUARD_EXPLANATIONS[reason] ?? reason;

// --- forbidden content --------------------------------------------------------------
/** Strings that must never appear in a captured page. */
const LEAK_PATTERNS = [
  { pattern: /sslip\.io/i, what: "the production Supabase host" },
  { pattern: /213\.199\.45\.205/, what: "the production server IP" },
  { pattern: /service_role/i, what: "a service-role reference" },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}/, what: "a JWT" },
  { pattern: /\bre_[A-Za-z0-9]{10,}/, what: "a Resend key" },
  { pattern: /\bwhsec_[A-Za-z0-9]{10,}/, what: "a webhook secret" },
  { pattern: /\bsb_secret_[A-Za-z0-9_-]{10,}/, what: "a Supabase secret key" },
];
/** Any email that is not on the sanctioned synthetic domain. */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** A rendered catalog key means a locale is missing a translation. */
const RAW_KEY_RE = /\b(nav|wiki|settings|task|common|kunde|offer|lead)\.[a-z][A-Za-z0-9.]{3,}\b/;

const main = async () => {
  const projectId = readProjectId();
  const apiPort = readConfigValue("api", "port");
  const dbPort = readConfigValue("db", "port");
  if (!projectId || !apiPort || !dbPort) refuse(`could not read project_id/[api].port/[db].port from ${CONFIG}`);

  // --- container identity (mirrors scripts/wiki-db.sh) ------------------------------
  const dbContainer = `supabase_db_${projectId}`;
  let label;
  try {
    label = execFileSync("docker", ["inspect", "-f", '{{ index .Config.Labels "com.supabase.cli.project" }}', dbContainer], { encoding: "utf8" }).trim();
  } catch {
    refuse(`container '${dbContainer}' is not running. Start it: npm run wiki:db:up`);
  }
  if (label !== projectId) refuse(`container '${dbContainer}' has project label '${label}', expected '${projectId}'.`);

  const fixtureIds = resolveFixtureIds(dbContainer);

  if (!existsSync(CREDENTIALS)) {
    refuse(`${CREDENTIALS} is missing. Run: CRM_WIKI_ENV=1 npm run wiki:db:bootstrap`);
  }
  const credentials = JSON.parse(await readFile(CREDENTIALS, "utf8"));

  // --- stack keys -------------------------------------------------------------------
  const statusRaw = execFileSync("supabase", ["--workdir", "supabase-wiki/runtime", "status", "-o", "env"], { encoding: "utf8" });
  const stackEnv = Object.fromEntries(
    statusRaw.split("\n").map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]),
  );
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const anonKey = stackEnv.ANON_KEY;
  if (!anonKey) fail(`ANON_KEY missing from \`supabase status -o env\`:\n${statusRaw}`);

  // --- spawn our own Vite -----------------------------------------------------------
  // Every variable in vite.config's resolution chain is pinned. Leaving any of them to
  // the dotenv fallback would let .env.local's production URL back in.
  const baseUrl = `http://localhost:${BASE_PORT}`;
  console.log(`wiki-capture: starting Vite on ${baseUrl} → ${apiUrl}`);
  const vite = spawn("npx", ["vite", "--port", BASE_PORT, "--strictPort", "--host", "127.0.0.1"], {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: apiUrl,
      SUPABASE_URL: apiUrl,
      VITE_SUPABASE_PROJECT_ID: "",
      VITE_SUPABASE_ANON_KEY: anonKey,
      VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
      SUPABASE_PUBLISHABLE_KEY: anonKey,
      VITE_APP_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stopVite = () => { try { vite.kill("SIGTERM"); } catch { /* already gone */ } };
  process.on("exit", stopVite);
  process.on("SIGINT", () => { stopVite(); process.exit(130); });

  // Wait for the server to answer rather than sleeping a fixed time.
  const deadline = Date.now() + 60_000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const probe = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      if (probe.ok) { up = true; break; }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) { stopVite(); fail(`Vite did not come up on ${baseUrl} within 60s.`); }

  // --- THE decisive check: identity through the proxy -------------------------------
  let identityProject = null;
  let identityVersion = null;
  try {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/crm_wiki_identity`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) {
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length === 1) {
        identityProject = rows[0].project_id;
        identityVersion = rows[0].marker_version;
      }
    }
  } catch { /* leave null → refuse below */ }

  // A bootstrap ends with `NOTIFY pgrst, 'reload schema'`, and PostgREST answers 502 for
  // the second or so it takes to rebuild its cache. Starting the browser inside that
  // window fails a shot for a reason that has nothing to do with the content, so wait
  // until the API answers cleanly twice in a row before going on.
  let consecutiveOk = 0;
  const settleDeadline = Date.now() + 30_000;
  while (consecutiveOk < 2 && Date.now() < settleDeadline) {
    try {
      const probe = await fetch(`${baseUrl}/rest/v1/companies?select=id&limit=1`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(3000),
      });
      consecutiveOk = probe.ok ? consecutiveOk + 1 : 0;
    } catch {
      consecutiveOk = 0;
    }
    if (consecutiveOk < 2) await new Promise((r) => setTimeout(r, 700));
  }
  if (consecutiveOk < 2) {
    stopVite();
    fail("the Supabase API never settled — it kept failing for 30s. Is the stack healthy?");
  }

  const verdict = evaluateWikiCaptureTarget({
    wikiEnvFlag: process.env.CRM_WIKI_ENV,
    captureFlag: process.env.CRM_WIKI_CAPTURE,
    baseUrl,
    expectedBasePort: BASE_PORT,
    apiUrl,
    expectedApiPort: apiPort,
    identityProject,
    identityVersion,
    expectedProject: projectId,
    expectedMarkerVersion: MARKER_VERSION,
  });
  if (!verdict.ok) { stopVite(); refuse(explainWikiGuardRefusal(verdict.reason)); }
  console.log(`wiki-capture: target verified — '${identityProject}' behind ${baseUrl}`);

  // --- browser ----------------------------------------------------------------------
  if (!existsSync(CHROME)) { stopVite(); fail(`Chrome not found at ${CHROME}. Set CRM_WIKI_CHROME.`); }
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars"],
  });

  const scratch = await mkdtemp(path.join(tmpdir(), "crm-wiki-shots-"));
  const written = [];
  let storageState = null;

  const newContext = async ({ locale, viewport, anonymous }) => {
    const context = await browser.newContext({
      ...VIEWPORTS[viewport],
      locale: locale === "en" ? "en-GB" : `${locale}-CH`,
      storageState: anonymous ? undefined : storageState ?? undefined,
      reducedMotion: "reduce",
    });
    // The dashboard locale is read once, in a useState initialiser, so it must exist
    // before the first mount — not after navigation.
    await context.addInitScript(([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
    }, ["crm_ui_locale", locale]);
    // Erscheinungsbild festnageln. Ohne das entscheidet die Systemeinstellung
    // der aufnehmenden Maschine, ob die Bilder hell oder dunkel werden — das
    // Wiki bekaeme bei jedem Lauf ein anderes Aussehen, je nachdem wer es
    // startet. Die Artikel beschreiben die helle Darstellung.
    await context.addInitScript(([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
    }, ["crm:theme", "light"]);
    // Belt and braces on top of [edge_runtime] being disabled: nothing may call out.
    await context.route("**/functions/v1/**", (route) => route.abort("blockedbyclient"));
    return context;
  };

  try {
    // --- log in once, reuse the session ---------------------------------------------
    console.log("wiki-capture: signing in as the synthetic operator…");
    const loginContext = await browser.newContext({ ...VIEWPORTS.desktop });
    const loginPage = await loginContext.newPage();
    await loginPage.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
    await loginPage.fill("input#email", credentials.email);
    await loginPage.fill("input#password", credentials.password);
    await loginPage.click("button[type='submit']");
    await loginPage.waitForURL(/\/firma/, { timeout: 30_000 }).catch(() => {});
    if (!/\/firma/.test(loginPage.url())) {
      const body = await loginPage.locator("body").innerText().catch(() => "");
      throw new Error(`sign-in did not reach /firma (still at ${loginPage.url()}).\nPage said: ${body.slice(0, 300)}`);
    }
    storageState = await loginContext.storageState();
    await loginContext.close();
    console.log("wiki-capture: signed in.");

    // --- shots ------------------------------------------------------------------------
    for (const shot of SHOTS) {
      const locales = shot.locales ?? ALL_LOCALES;
      const viewports = shot.viewports ?? ["desktop"];

      for (const locale of locales) {
        for (const viewport of viewports) {
          const context = await newContext({ locale, viewport, anonymous: shot.anonymous });
          const page = await context.newPage();

          const problems = [];
          page.on("pageerror", (error) => problems.push(`uncaught error: ${error.message}`));
          page.on("response", (response) => {
            const url = response.url();
            if (/\/(rest|auth)\/v1\//.test(url) && response.status() >= 400) {
              problems.push(`${response.status()} from ${url.replace(baseUrl, "")}`);
            }
          });

          const label = `${shot.id}[${locale}/${viewport}]`;
          try {
            await page.goto(`${baseUrl}${fillRoute(shot.route, fixtureIds)}`, { waitUntil: "networkidle", timeout: 30_000 });

            if (shot.readySelector) {
              await page.waitForSelector(shot.readySelector, { state: "visible", timeout: 20_000 });
            }
            if (shot.prepare) await shot.prepare(page);

            // Animations settled, fonts loaded.
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(400);

            // --- quality gates: throw rather than write a useless file -----------------
            if (!shot.anonymous && /\/auth(\?|$)/.test(page.url())) {
              throw new Error("landed on the sign-in page — the session was not carried over");
            }
            const spinners = await page.locator('[class*="animate-spin"]').count();
            if (spinners > 0) throw new Error(`${spinners} loading spinner(s) still visible`);

            const gate = await page.locator("svg.lucide-shield-alert").count();
            if (gate > 0) throw new Error("the company/verification gate screen is showing");

            const text = await page.locator("body").innerText();
            if (text.trim().length < 40) throw new Error("page is effectively blank");

            if (shot.minCount) {
              const n = await page.locator(shot.minCount.selector).count();
              if (n < shot.minCount.min) {
                throw new Error(`only ${n} of ${shot.minCount.selector} (need ${shot.minCount.min}) — the screen is empty`);
              }
            }
            for (const { pattern, what } of LEAK_PATTERNS) {
              if (pattern.test(text)) throw new Error(`page shows ${what}`);
            }
            for (const email of text.match(EMAIL_RE) ?? []) {
              if (!email.endsWith("example.test")) throw new Error(`page shows a non-synthetic email: ${email}`);
            }
            const rawKey = RAW_KEY_RE.exec(text);
            if (rawKey) throw new Error(`page shows the untranslated catalog key "${rawKey[0]}" — the ${locale} catalog has a gap`);

            if (problems.length > 0) throw new Error(problems.join("; "));

            // --- capture ---------------------------------------------------------------
            const suffix = viewport === "mobile" ? "-mobile" : "";
            const stem = `${shot.id}${suffix}-${ASSET_VERSION}`;
            const pngPath = path.join(scratch, `${locale}-${stem}.png`);
            const masks = (shot.mask ?? []).map((selector) => page.locator(selector));

            const target = shot.clip ? page.locator(shot.clip).first() : page;
            await target.screenshot({ path: pngPath, mask: masks, maskColor: "#18181A" });

            const outDir = path.join(OUT_ROOT, locale);
            await mkdir(outDir, { recursive: true });
            const outPath = path.join(outDir, `${stem}.webp`);
            // sharp strips metadata by default; calling .withMetadata() would add it BACK.
            const info = await sharp(pngPath).webp({ quality: 82, effort: 5 }).toFile(outPath);

            written.push({
              key: `${locale}/${stem}`,
              src: `/wiki/screenshots/${locale}/${stem}.webp`,
              width: info.width,
              height: info.height,
              bytes: info.size,
            });
            console.log(`  ✓ ${label} → ${outPath} (${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB)`);
          } catch (error) {
            await context.close();
            throw new Error(`${label}: ${error.message}`);
          }
          await context.close();
        }
      }
    }

    // --- the metadata the article renderer needs --------------------------------------
    written.sort((a, b) => a.key.localeCompare(b.key));
    const entries = written
      .map((w) => `  "${w.src}": { width: ${w.width}, height: ${w.height}, bytes: ${w.bytes} },`)
      .join("\n");
    await writeFile(
      META_FILE,
      `/**\n` +
        ` * GENERATED by scripts/capture-wiki-screenshots.mjs — do not edit by hand.\n` +
        ` *\n` +
        ` * Intrinsic dimensions of every captured screenshot. WikiFigure sets these as real\n` +
        ` * width/height attributes so the browser reserves the correct box before the image\n` +
        ` * loads and the article never shifts under the reader.\n` +
        ` *\n` +
        ` * Re-run the capture to refresh: CRM_WIKI_ENV=1 CRM_WIKI_CAPTURE=1 npm run wiki:capture\n` +
        ` */\n` +
        `export interface WikiScreenshotMeta {\n  width: number;\n  height: number;\n  bytes: number;\n}\n\n` +
        `export const WIKI_SCREENSHOT_META: Record<string, WikiScreenshotMeta> = {\n${entries}\n};\n`,
      "utf8",
    );

    console.log(`\nwiki-capture: ${written.length} screenshots written; metadata → ${META_FILE}`);
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
    stopVite();
  }
};

main().catch((error) => {
  console.error(`wiki-capture: FAILED — ${error.message}`);
  process.exit(1);
});
