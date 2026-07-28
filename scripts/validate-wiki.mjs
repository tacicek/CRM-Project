#!/usr/bin/env node
/**
 * `npm run wiki:validate` — the documented entry point for the Wiki's anti-drift checks.
 *
 * The checks themselves live in src/features/wiki/__tests__/wikiContent.test.ts, not
 * here, and that is deliberate. Every check is an assertion about TypeScript *values*:
 * the article registry, the route map, and all 21 localized bodies. A .mjs script cannot
 * import those. The alternatives were both worse:
 *
 *   - regex over the TypeScript source: breaks on any legal refactor (a trailing comma,
 *     a extracted constant, a multi-line string) and cannot compare block structure at
 *     all. It would go green while the content was broken, which is worse than having no
 *     validator.
 *   - adding a TypeScript runtime just for this script: a new dependency for no gain,
 *     when Vitest already resolves `@/` and TypeScript natively.
 *
 * So this file exists to give those checks the command name the team expects, and to
 * forward their exit code unchanged.
 */
import { spawnSync } from "node:child_process";

const SPEC = "src/features/wiki/__tests__/wikiContent.test.ts";

const result = spawnSync("npx", ["vitest", "run", SPEC], { stdio: "inherit" });

if (result.error) {
  console.error(`wiki:validate: could not run vitest — ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
