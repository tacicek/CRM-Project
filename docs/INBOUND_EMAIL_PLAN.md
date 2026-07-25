# Inbound Email → CRM Lead — Discovery Report & Implementation Plan

> Phase 1 deliverable for `claude-code-inbound-email-implementation-prompt.md`.
> Reference architecture: `single-company-crm-inbound-email-architecture.md`.
> Findings verified against the live self-hosted DB (2026-07-25) and the Resend docs, not only against migrations.

---

## Umsetzungsstand (2026-07-25)

| Phase | Status |
|---|---|
| 1 — Datenbank | **Code fertig, NICHT auf Produktion angewendet.** Zwei Migrationen + ROLLBACKs, beide in einer `BEGIN … ROLLBACK`-Transaktion gegen die Live-DB verifiziert (Idempotenz, alle CHECKs, `ON DELETE SET NULL`, Retention, `source='email'`, atomare Lead-Erstellung, Firmen-Prüfung, Reaper). `types.ts` chirurgisch ergänzt |
| 2 — Backend | **Fertig.** Webhook-Funktion, Signaturprüfung, Normalisierung, Vorfilter, KI-Klassifizierung, Entscheid, Lead-Erstellung; zwei Live-Funktionen auf die gemeinsamen Module umgestellt |
| 3 — Review-UI | **Fertig.** `/firma/email-import` mit Tabs, Detailansicht, Bearbeiten, Übernehmen, Ablehnen und erneutem Verarbeiten |
| 4 — Tests | **Alle Punkte der Testliste abgedeckt** (148 neue Tests). Ein HTTP-Harness für Edge Functions existiert im Repo nicht und wurde nicht eingeführt — die Doppelzustellungs- und Retry-Regel liegt stattdessen als reine Funktion in `_shared/inboundEmail/idempotency.ts` und wird dort geprüft |

Gate: `npx tsc --noEmit -p tsconfig.app.json` sauber, `npx vitest run` 646/646 grün, ESLint ohne neue Befunde
(`supabase/` ist von der ESLint-Konfiguration ausgenommen — unverändert).

### Testliste des Briefings → Fundstelle

| Verlangt | Abgedeckt in |
|---|---|
| valid / invalid signature | `_shared/__tests__/svixWebhook.test.ts` (inkl. Replay, Secret-Rotation, fremdes Secret) |
| duplicate webhook | `inboundEmail/__tests__/idempotency.test.ts` |
| high / medium / low confidence | `inboundEmail/__tests__/decision.test.ts` (Grenzwerte 0.85 / 0.60) |
| autoresponder / bounce filtering | `inboundEmail/__tests__/prefilters.test.ts` (inkl. Gegenproben: echte Anfragen kommen durch) |
| malformed AI output | `inboundEmail/__tests__/parsedInquiry.test.ts` |
| transient AI failure | `_shared/__tests__/aiProvider.test.ts` |
| retry without duplicate lead | `inboundEmail/__tests__/idempotency.test.ts` |
| prompt injection inside email content | `_shared/__tests__/prompts.test.ts` + `parsedInquiry.test.ts` |
| attachment metadata handling | `inboundEmail/__tests__/normalize.test.ts` |

### Was für Phase 3 aus ManualImport herausgelöst wurde

Die Vorgabe „reuse the existing lead form … do not build a second lead form" liess sich nur einlösen, indem
das Formular aus der 2283-Zeilen-Seite herausgetrennt wird. ManualImport ist dadurch auf ~745 Zeilen
geschrumpft und verhält sich unverändert:

| Neu | Inhalt | Genutzt von |
|---|---|---|
| `src/types/extractedLead.ts` | `ExtractedData` (Extraktionsschema) | beide Seiten |
| `src/components/leads/ExtractedLeadForm.tsx` | das komplette Bearbeitungsformular je Service-Typ | beide Seiten |
| `src/lib/extractedLeadToLeadData.ts` | Extraktionsschema → `lead_data`, inkl. Telefonformatierung | beide Seiten |

Die Review-Seite legt Leads **nicht selbst** an: „Übernehmen" ruft `import-manual-lead` mit
`source: 'email'` und `inbound_email_id` auf — dieselbe Funktion wie der manuelle Import.

Für „erneut verarbeiten" hat `inbound-email-lead` einen zweiten, authentifizierten Eingang bekommen
(JWT + Firmenmitgliedschaft statt Signatur; erkennbar am fehlenden `svix-signature`-Header). Ein Webhook
kommt kein zweites Mal, und Resend hält die Nachricht vor — der erneute Lauf holt sie dort frisch ab.

### Nachtrag: Lead-Erstellung ist transaktional

Das Briefing verlangt unter *Coding standards*: „Use transactions for linked inbound-record and lead state
changes where possible." Die erste Fassung schrieb zwei getrennte Anweisungen (Lead anlegen, dann
verknüpfen). Bricht es dazwischen ab, existiert der Lead, aber die Mail bleibt auf `processing` stehen —
in keinem Tab sichtbar, und weil `lead_id` NULL blieb, greift die „es gibt schon einen Lead"-Sperre nicht.

`20260725130000_inbound_email_lead_txn.sql` schliesst das:

- `create_lead_from_inbound_email(inbound_id, company_id, lead, outcome)` — sperrt die Zeile, prüft die
  Firmenzugehörigkeit (der Service-Role-Client umgeht RLS), legt den Lead an und verknüpft ihn in einer
  Transaktion. Ein zweiter Aufruf gibt den bestehenden Lead zurück, statt einen weiteren anzulegen.
  Beide Schreiber nutzen sie: die automatische Pipeline und die Review-Freigabe über `import-manual-lead`.
- `reap_stuck_inbound_emails()` + Cron alle 15 Minuten — Zeilen, die seit über 15 Minuten auf `processing`
  stehen, gelten als gescheitert und tauchen damit unter „Fehlgeschlagen" auf, statt unsichtbar zu bleiben.

Die Prüfung gegen die Live-DB hat dabei einen echten Fehler gefunden: ein
`INSERT … SELECT * FROM jsonb_populate_record(NULL::leads, …)` setzt jede nicht gelieferte Spalte explizit
auf NULL und hebelt damit die DEFAULTs aus (`id` kam als NULL an). Die Funktion schreibt jetzt nur die
tatsächlich gelieferten Spalten.

### Reihenfolge beim Ausrollen

1. Beide Migrationen anwenden (STOP-Gate — braucht ausdrückliche Freigabe).
2. Secrets setzen: `RESEND_WEBHOOK_SECRET`, ggf. `RESEND_API_KEY`, `INBOUND_EMAIL_DEFAULT_COMPANY_ID`
   oder je Firma eine `api_keys`-Zeile mit `key_name='inbound_email_alias'`.
3. Edge Functions deployen — `_shared/` muss mitkopiert werden, sonst fehlen den drei Funktionen die neuen Module:
   `inbound-email-lead` (neu), `import-manual-lead`, `extract-anfrage-ai`.
   Bis dahin läuft in Produktion der alte Stand dieser beiden Funktionen; ihr Verhalten ist unverändert
   (`import-manual-lead` ohne `source` schreibt weiterhin `'import'`).
4. Resend: Inbound-Domain + Webhook auf `POST /functions/v1/inbound-email-lead`, Event `email.received`.

---

## 1. Current architecture findings

### 1.1 There is no backend layer other than Edge Functions

The frontend is a static Vite SPA. Every server-side action already runs as a Deno Edge Function
(`supabase/functions/*`, 45+). Public ones are declared `verify_jwt = false` in
[supabase/config.toml](../supabase/config.toml) and authenticate themselves (service-role bearer, RPC token, or
`x-internal-secret`).

→ The webhook belongs in a new Edge Function. The architecture doc's `/api/webhooks/...` option does not
exist in this stack.

### 1.2 The manual-import flow is a near-complete precedent

```
ManualImport.tsx  ──▶ extract-anfrage-ai  ──▶ (operator edits in preview form) ──▶ import-manual-lead ──▶ leads
   raw text            AI extraction                review UI                        canonical mapping
```

| Component | File | Relevance |
|---|---|---|
| AI extraction | [supabase/functions/extract-anfrage-ai/index.ts](../supabase/functions/extract-anfrage-ai/index.ts) (817) | Per-company provider dispatch (anthropic/openai/gemini) read from `api_keys`; per-service-type field schema; `confidence_score`; document-language detection; enum normalization maps |
| Prompt | [supabase/functions/_shared/prompts.ts](../supabase/functions/_shared/prompts.ts) `EXTRACT_LEAD_PROMPT` + `compilePrompt()` | Full service taxonomy + JSON field spec, ~400 lines. Reusable |
| Lead creation | [supabase/functions/import-manual-lead/index.ts](../supabase/functions/import-manual-lead/index.ts) (274) | Auth → membership → `crm_enabled` → per-service field mapping → `leads` insert. **This is the canonical import→lead path** |
| Review UI | [src/pages/firma/ManualImport.tsx](../src/pages/firma/ManualImport.tsx) (2283) | Preview/edit form for every service type, per-field editing, validation, `sanitizeText`, save |

The inbound-email pipeline is the *same* pipeline with a different trigger and without a human in the loop
for the high-confidence branch.

### 1.3 What does **not** exist

- **No webhook signature verification anywhere in the repo.** No `svix` dependency, no HMAC verification, no
  raw-body handling. This is greenfield and is the single biggest security item.
- **No inbound/receiving email table.** `email_logs` is outbound-only (recipient, subject, email_type, status).
- **No `email` lead source.** See §3.
- **No prompt-injection defence.** `EXTRACT_LEAD_PROMPT` interpolates `{{raw_text}}` into a fenced block with no
  instruction/data separation. Acceptable when an operator pastes text they read themselves; **not** acceptable
  for an autonomous path fed by strangers.
- **No `isInquiry` / spam classification in the AI step.** `extract-anfrage-ai` assumes the input *is* an
  inquiry — it always returns extracted fields.

### 1.4 Scheduler, storage, logging, i18n

- **pg_cron is live** (6 active jobs). Two idioms exist: pure SQL (`expire_unconfirmed_risky_leads`) and
  `public.invoke_edge_function('<fn>')` which pulls the service-role key from `vault.decrypted_secrets` and
  POSTs to Kong. Retention needs no new scheduler.
- **Storage buckets**: `document-pdfs` (private, 15 MB, PDF-only) is the private-bucket precedent. Not needed
  for V1 (see §5 attachments).
- **Logging**: `_shared/logger.ts` → `createLogger(prefix)` with `[prefix] step - {json}`.
- **i18n**: two axes (dashboard vs document). DE catalog is the source of truth; `fr`/`en` are
  `Record<keyof typeof de, string>` → a missing key is a compile error. Edge functions have their own
  `_shared/i18n` catalog.

### 1.5 Tests

`vitest.config.ts` includes only `src/**/__tests__/**`. 498 tests green today, incl. an integration-test
foundation (`src/test/{env-guard,db-guard,fixtures}.ts`). Deno/edge-function code is **not** covered by any
test today. (CLAUDE.md §9 claims "only 2 test files" — stale.)

---

## 2. Existing components that will be reused

| Reused | How |
|---|---|
| `import-manual-lead` | Extended with optional `source` + `inbound_email_id`. Stays the single lead-creation path for both manual import and review-approve |
| Per-service lead field mapping | Extracted from `import-manual-lead` into `_shared/leadMapping.ts`, used by both callers. No second mapper |
| AI provider dispatch + `api_keys` config | Extracted from `extract-anfrage-ai` into `_shared/aiProvider.ts`, used by both. No second provider layer |
| `EXTRACT_LEAD_PROMPT` field spec | Split into `EXTRACT_LEAD_FIELD_SPEC` + envelope. Manual-import prompt stays byte-identical (guarded by a test); the inbound prompt reuses the spec with a hardened envelope |
| `compilePrompt()`, `createLogger()`, `_shared/i18n`, `isLocale/toLocale` | As-is |
| `is_company_member(company_id)` RLS helper | `inbound_emails` policies mirror `manual_imported_leads_manage_member` |
| pg_cron + `invoke_edge_function` | Retention job (pure SQL — no edge function needed) |
| `MODULES` feature flags + `FirmaLayout` | Sidebar entry for the review page |
| `leadForm.ts` zod conventions | New zod schemas follow the same style |
| ManualImport preview-form components | Review UI reuses them rather than building a second lead form |

---

## 3. Database objects and constraints affected

Verified live:

```
leads_source_check  CHECK (source IN ('web_form','ai_voice','manual','import','widget','api'))   -- no 'email'
chk_leads_status    CHECK (status IN ('pending','pending_verification','awaiting_customer_confirmation',
                                      'unconfirmed_risky','verified','in_progress','distributed',
                                      'no_matches','unknown_plz','completed','rejected',
                                      'expired_unverified','job_confirmed'))
leads_language_check CHECK (language IN ('de','fr','en'))
```

**NOT NULL columns on `leads`**: `customer_email`, `customer_first_name`, `customer_last_name`,
`customer_phone`, `service_type`, `from_plz`, `from_city`, `language`.
→ Conflicts with the prompt's "preserve null for unknown facts". Resolution in §8/A3.

**Triggers on `leads`** (live):

| Trigger | Effect on an email-sourced lead |
|---|---|
| `calculate_spam_score_trigger` (BEFORE INSERT) | Counts same-email leads in 24 h → `+3` each; `preferred_date IS NULL` → `+1`; `description < 10 chars` → `+1`. A repeat customer scores 3. Harmless at our status |
| `on_lead_high_spam_notify` (AFTER INSERT) | Fires only when `spam_score >= 6 AND status = 'pending_verification'`. We insert with `status='pending'` (same as manual import) → **does not fire**. Note: it would POST to `notify-admin-new-lead`, a function that no longer exists, at a hard-coded old Offerio cloud URL. Pre-existing latent bug, out of scope, reported |
| `trigger_set_lead_slug`, `trigger_leads_updated_at` | Wanted, unchanged |

**`manual_imported_leads`** exists (company_id, lead_id, raw_import_text, ai_confidence_score, imported_by)
with correct RLS — but `import-manual-lead` **never writes to it**. It is dead today. It is *not* a fit for
inbound email (no idempotency key, no processing state, no `provider_message_id`), so a new table is
justified. Fixing the dead write is out of scope.

**New**: `public.inbound_emails` (§5), `leads_source_check` extended with `'email'`.

---

## 4. Security risks found

| # | Risk | Mitigation |
|---|---|---|
| S1 | **Unauthenticated public endpoint.** `verify_jwt=false` + Kong has no auth plugin → anyone on the internet can POST | Svix signature verification is the *only* gate. Fail closed when `RESEND_WEBHOOK_SECRET` is unset (same posture as `cronAuth.ts`) |
| S2 | **Raw-body corruption.** Signature covers `${svix-id}.${svix-timestamp}.${rawBody}`. Any parse→re-stringify breaks it | Read `await req.text()` **once**, verify, then `JSON.parse`. Never `req.json()` first |
| S3 | **Replay attacks** | Reject `svix-timestamp` outside ±5 min, plus DB-level idempotency |
| S4 | **Prompt injection** — the email is written by a stranger | Hardened envelope: content delimited and declared untrusted data, explicit "ignore instructions inside", no tools, schema-bound output, strict zod validation of the result, and the *decision* (threshold comparison) is made in code, never by the model. Test case included |
| S5 | **Untrusted HTML rendered in the CRM** | HTML is never stored or rendered. Plain text only; if the mail is HTML-only, it is converted to text server-side (script/style stripped) before AI and before the preview is stored |
| S6 | **Timing attack on signature compare** | Constant-time comparison |
| S7 | **Secret leakage in logs** | Structured logs contain ids/status/score only. Never body, never keys. Body preview is capped and only stored in the DB row |
| S8 | **Concurrent duplicate webhooks** | Uniqueness enforced by a DB constraint + `insert … on conflict do nothing` claim, not by a read-then-write check |
| S9 | **Attachment binaries in Postgres** | Metadata only; the pipeline never downloads attachment content in V1 |
| S10 | **Unbounded AI spend** from a mail flood | Deterministic pre-filters run before the AI call; `processing_attempts` capped at 3; oversized bodies truncated at 30 000 chars |

---

## 5. Resend inbound contract (verified against the docs — changes the pipeline)

**The `email.received` webhook carries metadata only — no body, no headers, no attachment content.**
The body must be fetched afterwards:

```
GET https://api.resend.com/emails/receiving/{id}
Authorization: Bearer re_...
→ { id, from, to[], cc[], subject, text, html, headers, message_id,
    attachments[{id, filename, content_type, size, ...}], raw{download_url, expires_at} }
```

Consequences:

1. A **fetch-body step** sits between verification and normalization. The API key comes from
   `companies.resend_api_key` when `resend_enabled`, else the `RESEND_API_KEY` edge secret — resolving it from
   the company row is what makes the multi-company step later a lookup change rather than a rewrite.
2. Resend **stores the message on its side**, so a failed fetch is retryable without data loss — which is
   also why we can store a capped preview only and never the raw body (data minimisation, §7 of the arch doc,
   satisfied with zero storage).
3. `provider_message_id` = the Resend email `id` (stable, per-message) — the idempotency key.

---

## 6. File-by-file implementation plan

### Phase 1 — database

| File | Change |
|---|---|
| `supabase/migrations/<ts>_inbound_emails.sql` | **new** — `inbound_emails` table + `unique (provider, provider_message_id)` + indexes (`company_id, processing_status, received_at desc`) + `updated_at` trigger + RLS (`is_company_member(company_id)` for ALL, `is_admin(auth.uid())` for SELECT) + status CHECK (`received, processing, needs_review, lead_created, rejected, failed`) + extend `leads_source_check` with `'email'` + `public.cleanup_inbound_emails()` + cron job |
| `src/integrations/supabase/types.ts` | Surgical hand-edit (per CLAUDE.md §6: no noisy regen) — add the `inbound_emails` Row/Insert/Update/Relationships block |

Columns: `id, company_id (NOT NULL, FK), provider, provider_message_id, from_email, from_name, to_emails text[],
subject, body_preview, processing_status, classification, confidence_score numeric(5,4), rejection_reason,
missing_critical_fields jsonb, extracted_data jsonb, attachments jsonb, lead_id (FK, ON DELETE SET NULL),
processing_attempts int, last_error, received_at, processed_at, created_at, updated_at`.
No raw body column — by design (§5.2).

### Phase 2 — backend

| File | Change |
|---|---|
| `supabase/functions/_shared/svixWebhook.ts` | **new** — pure `verifySvixSignature({payload, id, timestamp, signatureHeader, secret, nowMs, toleranceSec})`, Web Crypto HMAC-SHA256, multi-signature support, constant-time compare |
| `supabase/functions/_shared/inboundEmail/normalize.ts` | **new** — pure `normalizeResendEmail(payload, fetched)` → provider-independent `NormalizedInboundEmail`; sender/display-name parsing, HTML→text fallback, quoted-reply and signature stripping, truncation flags |
| `supabase/functions/_shared/inboundEmail/prefilters.ts` | **new** — pure `classifyDeterministic(email)` → `null \| {reason}` for bounces (`mailer-daemon`, `postmaster`), auto-replies (`Auto-Submitted`, `Precedence: bulk`, out-of-office / Abwesenheitsnotiz / absence), empty bodies. Conservative by design |
| `supabase/functions/_shared/inboundEmail/decision.ts` | **new** — pure `decide(parsed, thresholds)` → `lead_created \| needs_review \| rejected`. Thresholds injected, never read from the model output |
| `supabase/functions/_shared/inboundEmail/parsedInquiry.ts` | **new** — strict schema + `validateParsedInquiry(json)`; clamps `confidenceScore` to [0,1], narrows enums, rejects unknown shapes |
| `supabase/functions/_shared/aiProvider.ts` | **new** — `callAiProvider({supabase, companyId, prompt, maxTokens})`, moved verbatim out of `extract-anfrage-ai` |
| `supabase/functions/_shared/leadMapping.ts` | **new** — `buildLeadInsert(leadData, {companyId, language, source})`, moved verbatim out of `import-manual-lead` |
| `supabase/functions/_shared/prompts.ts` | **modified** — split `EXTRACT_LEAD_PROMPT` into `EXTRACT_LEAD_FIELD_SPEC` + envelope (output byte-identical, test-guarded); add `INBOUND_EMAIL_CLASSIFY_PROMPT` + `createClassifyInboundEmailPrompt()` with the injection-hardened envelope and the `isInquiry`/`rejectionReason`/`missingCriticalFields` additions |
| `supabase/functions/extract-anfrage-ai/index.ts` | **modified** — use `_shared/aiProvider.ts` (≈ −120 lines). Behaviour unchanged |
| `supabase/functions/import-manual-lead/index.ts` | **modified** — use `_shared/leadMapping.ts`; accept optional `source` (default `'import'`, allow `'email'`) and optional `inbound_email_id` → on success set that row to `lead_created` + `lead_id`. Existing callers unaffected |
| `supabase/functions/inbound-email-lead/index.ts` | **new** — the pipeline: flag check → raw body → signature → event filter → claim row (`on conflict do nothing`) → fetch body from Resend → normalize → pre-filters → AI (1 retry on malformed output only) → validate → decide → create lead via shared mapper *or* leave `needs_review` → persist outcome → 200 |
| `supabase/config.toml` | **modified** — `[functions.inbound-email-lead] verify_jwt = false` |
| `.env.example` | **modified** — names only: `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_ENABLED`, `INBOUND_EMAIL_AUTO_APPROVE_THRESHOLD`, `INBOUND_EMAIL_REVIEW_THRESHOLD`, `INBOUND_EMAIL_MAX_BODY_CHARS`, `INBOUND_EMAIL_MAX_PROCESSING_ATTEMPTS` |

### Phase 3 — review UI

| File | Change |
|---|---|
| `src/pages/firma/EmailImport.tsx` | **new** — tabs (needs review / converted / rejected / failed), list + detail, sender/subject/preview/confidence/missing fields, **reusing** the ManualImport preview-form components for editing, actions approve / edit+approve / reject / retry |
| `src/pages/firma/ManualImport.tsx` | **modified** — extract the shared preview form into `src/components/leads/ExtractedLeadForm.tsx` so both pages use one form. Manual import behaviour unchanged |
| `src/components/leads/ExtractedLeadForm.tsx` | **new** — the extracted component |
| `src/App.tsx`, `src/config/modules.ts`, `src/components/firma/FirmaLayout.tsx` | **modified** — route `/firma/email-import`, `MODULES.inboundEmail`, sidebar entry |
| `src/i18n/catalog/{de,fr,en}/lead.ts` | **modified** — new keys in all three (missing key = compile error) |

### Phase 4 — tests

| File | Change |
|---|---|
| `vitest.config.ts` | **modified** — add `supabase/functions/**/__tests__/**/*.test.ts` to `include` so the pure edge-side modules become testable (they use no Deno API) |
| `supabase/functions/_shared/__tests__/svixWebhook.test.ts` | valid / invalid / missing / stale-timestamp / multi-signature |
| `.../inboundEmail/__tests__/normalize.test.ts` | sender parsing, HTML→text, truncation, quoted-reply stripping, attachment metadata only |
| `.../inboundEmail/__tests__/prefilters.test.ts` | bounce, out-of-office (DE/FR/EN), bulk, empty — plus negative cases proving normal customer mails pass |
| `.../inboundEmail/__tests__/decision.test.ts` | threshold boundaries 0.85 / 0.60, exact-equality cases |
| `.../inboundEmail/__tests__/parsedInquiry.test.ts` | malformed output, out-of-range confidence, injected-instruction payload stays schema-bound |
| `.../inboundEmail/__tests__/leadMapping.test.ts` | field mapping per service type, `source='email'`, NOT NULL placeholder behaviour |
| `supabase/functions/_shared/__tests__/prompts.test.ts` | `EXTRACT_LEAD_PROMPT` output unchanged after the split |

Duplicate-webhook, signature-rejection and retry-without-duplicate-lead are covered at the unit level plus the
manual acceptance scenarios in §8 of the arch doc (no HTTP harness for edge functions exists in this repo;
adding one is out of scope — stated as a limitation).

---

## 7. Migration plan

1. Write the migration file (`YYYYMMDDHHmmss_inbound_emails.sql`) + a matching `ROLLBACK_*.sql`, following the
   repo convention (existing migrations are never edited).
2. Verify in a `BEGIN … ROLLBACK` transaction against the live DB via MCP (the pattern used for the AGB and
   amount_basis work) — table creates, the `leads_source_check` swap, RLS, and a sample insert.
3. **STOP-gate: apply to production only after explicit approval** (`docker exec … psql`, IP-independent).
4. Hand-edit `types.ts` surgically.
5. `leads_source_check` is dropped and recreated with `'email'` added — existing rows all satisfy it, so it is
   backward-safe; rollback re-adds the old constraint (only valid while no `source='email'` rows exist —
   documented in the rollback file).

---

## 8. Assumptions

- **A1 — Resend Inbound is provisioned.** An inbound domain/address and a webhook endpoint with a signing
  secret must exist in the Resend account. Not verifiable from the repo; blocks end-to-end testing only, not
  implementation.
- **A2 — One canonical lead path = shared mapper + service-role insert**, not a new DB function. Reason: the
  repo's RPC creation path (`submit_lead_json`) is known-broken in production, and `import-manual-lead` is the
  de-facto canonical importer. Introducing a new RPC would create the parallel system the brief forbids.
- **A3 — NOT NULL vs "preserve null".** `leads` requires `customer_email/first/last/phone/from_plz/from_city`.
  Inbound leads use the *same* placeholders manual import already uses (`"Unbekannt"`, `""`) and record the
  true `null`s in `inbound_emails.extracted_data`, so nothing is invented and the missing facts stay auditable.
  The sender address is stored as `customer_email` only when it passes the normal-address check (not
  `noreply@`/`mailer-daemon@`/`postmaster@`).
- **A4 — Thresholds live in edge secrets**, not a settings table. The repo has no general settings table
  (`api_keys` is a per-company key/value store for API credentials; overloading it with tuning knobs would be
  a misuse).
- **A5 — Company resolution in V1** = the single `is_verified` company with `crm_enabled`, resolved by
  recipient address when it matches a configured alias. `company_id` is NOT NULL from day one, so the
  multi-company step is an alias-lookup change, not a schema change.
- **A6 — `service_type` values** follow `extract-anfrage-ai`'s taxonomy (`umzug_privat`, `reinigung`,
  `raeumung`, …). `leads.service_type` has no CHECK constraint, so no migration is needed; the mapper reuses the
  existing enum-normalisation maps.
- **A7 — Attachments are metadata-only in V1.** No download, no storage upload, no OCR.
- **A8 — Disabled flag returns 200**, so Resend does not enter a retry storm; the message stays retrievable on
  Resend's side.

---

## 9. Out of scope (found, reported, not fixed)

- `import-manual-lead` never writes `manual_imported_leads` (dead audit table).
- `trigger_notify_admin_high_spam` targets a deleted function at a hard-coded old Offerio cloud URL.
- `npm run type-check` checks nothing (CLAUDE.md §12) — the real gate is `npx tsc --noEmit -p tsconfig.app.json`.
