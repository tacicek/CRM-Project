#!/usr/bin/env bash
# Parse/boot gate for Supabase Edge Functions.
#
# `deno check` runs a FULL type-check, but the edge-function suite carries pre-existing type
# errors (SupabaseClient generic mismatches, `error` typed as unknown, etc.). Failing on those
# would make this gate permanently red. Instead we fail ONLY on genuine SWC parse errors — the
# class that actually stops a function from booting (a stray `import` inside a function body, a
# raw backtick inside a template literal, a missing token). Legacy TS type errors and
# npm:/module-resolution notes are tolerated.
#
# This is exactly the check that would have caught the C1–C4 boot-breakers before deploy.
set -uo pipefail

# Disable deno's ANSI colour so `error:` lines start at column 0 for the classifier below.
export NO_COLOR=1

fail=0
while IFS= read -r f; do
  out="$(deno check "$f" 2>&1)"
  # SWC parse errors surface as `error: SyntaxError: ...` / `error: Expected ...` /
  # `error: Unexpected ...` at column 0. TS type errors are `TS#### [ERROR]`, and unresolved
  # npm: specifiers are `error: Could not find a matching package` — both tolerated.
  if echo "$out" | grep -qE '^error: (SyntaxError|Expected|Unexpected)'; then
    echo "::error file=$f::Edge function fails to parse (boot-breaker)"
    echo "$out" | grep -E '^error:|Expected|Unexpected' | head -5
    fail=1
  fi
done < <(find supabase/functions -name index.ts -not -path '*_shared*')

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Parse/boot check FAILED — one or more edge functions would not boot. See errors above."
  exit 1
fi

echo "All edge functions parse (boot) OK."
