# Quittung production rollout — 26 October 2026

Deployment explicitly requested by the user. Operational timestamps below are UTC; the working-session date is 26 October in Asia/Bangkok.

## Release

- Application: https://crm-hirschen.ch
- Release commit: `3008c18344de51f12d6aaba8673d5cd97ec72115`, pushed to `tacicek/CRM-Project` main.
- Previous frontend commit: `a0b90d2984e4af78e54c57a27091a59bbce7710b`.
- Coolify application: ID `36`, UUID `bymhk0pd41d3vgms4iz87lqb`.
- Exact-commit deployment: `es4ho9fzfxygjszkvzhcdf0x`, queued at `2026-10-25T18:54:47Z`.
- Automatic deployment was disabled and remains disabled. The installed native Coolify queue helper was used without modifying application configuration or creating API credentials.
- The release was prepared in an isolated clone of current remote main. Unrelated workspace changes, including `.gitignore` and `translate-content`, were excluded. Main and the working base had identical trees before this feature patch. The original workspace Git metadata was not changed.

## Live result

Deployment finished at `2026-10-25T18:58:33Z`. The running healthy container is
`bymhk0pd41d3vgms4iz87lqb-20261025T185448`, using the exact release image/commit.
[Deployment status](frontend-deployment-status.jsonl), [container](frontend-container.json).

Public HTTPS checks passed for `/health`, both receipt SPA routes, the JavaScript entry and all three receipt chunks with correct MIME types. Both deployed DejaVu font files have SHA256 values equal to the release source. A fresh Chromium context reached the visible login page from both protected receipt routes without page or asset errors. No API request or user write was attempted by the browser smoke.
[Public checks](frontend-public-smoke.json), [browser checks](frontend-browser-smoke.json).

## Database

Only `20261025180327_quittung_document_lifecycle.sql` was applied. SHA256:
`040daad10e79906babe0580e4f3b805b5a214a6a2baa7c92ccd22e592b4b5fee`.

The intended cluster identity was checked against an independently saved baseline immediately before the write. The SQL ran as a single transaction with stop-on-error, a 30-second lock timeout and a 120-second statement timeout. [Migration output](migration.log) ends in `COMMIT`.

[Preflight](schema-before.log) and [postcheck](schema-after.log):

- 26 existing receipts before and after.
- Preserved financial/customer/signature content fingerprint: `239b5ea40d4d2fc1c0a2287eae1e13c9` before and after.
- Four consistency checks returned zero: missing issued snapshot, inconsistent payment state, missing legacy payment link, invoice/customer mismatch.
- Six lifecycle/payment/customer triggers enabled; all four checked constraints valid.
- Receipt Realtime publication membership present.
- RLS enabled on all four new tables; no anonymous read or authenticated direct write privileges. Archive/dispatch RPCs require the service role.
- Three existing direct-payment associations were backfilled; this does not create new payment records.

Production has no `supabase_migrations.schema_migrations` table. This release does not fabricate a historical migration baseline. This rollout log, exact source checksum and verification results record the application.

## Edge Functions

Seven files were installed from the same release: the three `send-quittung` files, `htmlEscape.ts`, the i18n catalog, the invoice email template and `send-rechnung-email/index.ts`. All 14 local dependency hashes match the release. Only the Edge runtime container was restarted.

The invoice sender uses the already committed main-branch membership-check/import corrections alongside the shared template. Live-only configuration, unrelated handlers and the main router were preserved. [Before manifest](edge-manifest-before.json), [deployment](edge-deploy.log), [verified server artifacts](server-artifacts.json).

Both handlers passed public HTTPS OPTIONS requests and rejected missing/invalid sessions with HTTP 401. These requests boot the actual handlers without sending customer mail. [Smoke results](edge-smoke.json).

## Backups

Task-specific backups were created and validated before migration under `/data/crm-rollouts/quittung-20261026` on the production server. Directory mode 0700; backup file modes 0600. Database archive listing and function tar listing were validated. No backup retention policy or unrelated files were changed.

- `database-before.dump`: 4,108,341 bytes; SHA256 `e50eea1858cc740ac51f96f60bb34a2220f2147584ba04bed7cf9296ba0fd451`.
- `functions-before.tar.gz`: 359,239 bytes; SHA256 `b3444bae207c0d890b5697bdaf3c023fa6007f93943150db1a80f8f58abec3ea`.

The data migration establishes immutable issued receipts. Prefer a forward fix with writes/sending paused if necessary; blindly restoring the older application against the new schema is not a safe rollback. Database restore would require accounting for any writes after the backup.

## Validation scope

The isolated release passed 2,224 tests in 121 files, TypeScript checking, Vite build and ESLint (zero errors, one existing PaginationBar warning). Earlier local integration evidence covers 13 SQL suites, 43 receipt assertions, three real database concurrency scenarios, ten Chromium form scenarios and 19 generated PDFs with 71 checks.

No real customer test email was sent and no synthetic financial transaction was entered in production. Production checks validate schema/data preservation, permissions, handler boot/auth rejection and deployed frontend artifacts; the positive authenticated business flows were exercised locally with controlled fixtures.

Existing browser tabs must be refreshed after deployment because the old receipt-send request format is incompatible with the new archive API.
