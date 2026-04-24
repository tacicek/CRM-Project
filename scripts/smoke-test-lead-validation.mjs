#!/usr/bin/env node
/**
 * Smoke test: validate-lead-quality end-to-end
 *
 * 3 scenarios:
 *   1. clean        → expected: pending_verification (AI not called)
 *   2. borderline   → expected: awaiting_customer_confirmation (AI called, email sent)
 *   3. obviously_fake → expected: unconfirmed_risky (AI not called, clearly_invalid)
 *
 * Usage: node scripts/smoke-test-lead-validation.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// --- load .env ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const EMAIL_BASE = "tuncaycicek";
const EMAIL_DOMAIN = "gmail.com";
const nowIso = Date.now();
const TAG = Math.random().toString(36).slice(2, 8); // unique per run

function buildLead({ email, firstName, lastName, phone, plz, city }) {
  return {
    service_type: "umzug",
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_email: email,
    customer_phone: phone,
    customer_salutation: "herr",
    customer_contact_time: null,
    from_plz: plz,
    from_city: city,
    from_street: "Teststrasse",
    from_house_number: "1",
    from_floor: 0,
    from_has_lift: true,
    from_rooms: 3,
    from_living_space_m2: 75,
    property_type: "wohnung",
    preferred_date: new Date(Date.now() + 14 * 86400_000).toISOString().split("T")[0],
    is_flexible_date: true,
    moving_flexibility: "flex1w",
    description: "SMOKE TEST — bitte ignorieren",
    status: "pending_verification",
    max_companies: 5,
    form_version: 2,
    source_form_id: null,
    detailed_form_data: { smoke_test: true, t: nowIso },
  };
}

const scenarios = [
  {
    name: "1_clean",
    expected: "pending_verification",
    note: "AI should NOT be called (deterministic clearly_valid)",
    lead: buildLead({
      email: `${EMAIL_BASE}+clean${TAG}@${EMAIL_DOMAIN}`,
      firstName: "Tuncay",
      lastName: "Cicek",
      phone: "+41791234567",
      plz: "8001",
      city: "Zürich",
    }),
  },
  {
    name: "2_borderline",
    expected: "awaiting_customer_confirmation",
    note: `AI should be called → double opt-in email to ${EMAIL_BASE}+confirm${TAG}@${EMAIL_DOMAIN}`,
    lead: buildLead({
      email: `${EMAIL_BASE}+confirm${TAG}@${EMAIL_DOMAIN}`,
      firstName: "Tuncay",
      lastName: "Tuncay", // identical first/last → -10 suspicious
      phone: "+41791234567",
      plz: "3000",
      city: "Bern",
    }),
  },
  {
    name: "3_obviously_fake",
    expected: "unconfirmed_risky",
    note: "Deterministic clearly_invalid (typo TLD + keyboard pattern name)",
    lead: buildLead({
      // typo TLD (.como not valid) + typo domain (gmall→gmail)
      email: `test${TAG}@gmall.como`,
      firstName: "asdfasdf",
      lastName: "qwerty",
      phone: "+41791234567",
      plz: "4000",
      city: "Basel",
    }),
  },
];

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: r.status, body: parsed };
}

async function invokeFn(name, body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: r.status, body: parsed };
}

// Leads table has RLS for anon — we cannot SELECT directly.
// We rely on the edge function response for the final status.

async function run() {
  console.log(`\n=== SMOKE TEST: validate-lead-quality ===`);
  console.log(`URL: ${SUPABASE_URL}\n`);

  for (const sc of scenarios) {
    console.log(`──────────────────────────────────────────`);
    console.log(`▶ Scenario: ${sc.name}`);
    console.log(`  Expected:  ${sc.expected}`);
    console.log(`  Email:     ${sc.lead.customer_email}`);
    console.log(`  Name:      ${sc.lead.customer_first_name} ${sc.lead.customer_last_name}`);
    console.log(`  Note:      ${sc.note}`);

    // 1) submit_lead_json (returns slug, not id)
    const sub = await rpc("submit_lead_json", { lead_data: sc.lead });
    if (sub.status >= 300) {
      console.log(`  ❌ submit failed [${sub.status}]:`, sub.body);
      continue;
    }
    const slug = typeof sub.body === "string" ? sub.body : sub.body?.toString();
    console.log(`  ✓ Lead slug: ${slug}`);

    // Edge function now accepts slug (or UUID) directly.
    const val = await invokeFn("validate-lead-quality", { lead_id: slug });
    console.log(`  ✓ validate [${val.status}]:`, JSON.stringify(val.body));

    const got = val.body?.status;
    const pass = got === sc.expected;
    console.log(`  ${pass ? "✅ PASS" : "⚠️  MISMATCH"} — expected="${sc.expected}", got="${got}"`);
    if (val.body?.quality_score !== undefined) {
      console.log(`  ✓ Score:    ${val.body.quality_score}`);
    }
    if (val.body?.double_opt_in_sent) {
      console.log(`  ✓ Double opt-in email sent: YES`);
    }
    if (val.body?.rejection_reason) {
      console.log(`  ✓ Reason:   ${val.body.rejection_reason}`);
    }
    if (val.body?.signals?.length) {
      console.log(`  ✓ Signals:  ${JSON.stringify(val.body.signals)}`);
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Done. Check Gmail inbox (tuncaycicek@gmail.com) for scenario 2 opt-in email.`);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
