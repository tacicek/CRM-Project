# Quittung finalized-PDF download correction

Source commit: `2921e58638f43362a75b6b1f7981776426b15541`.
The two changed Edge runtime files were deployed at `2026-10-25T19:28:27Z`; the runtime restarted at `19:28:28Z`. No frontend rollout, database migration, payment write or archive rewrite was needed.

## Cause and correction

Finalized receipts use the immutable archive flow; drafts generate their PDF locally. Supabase's service SDK produced a signed PDF URL by prefixing Storage's relative signed path with the internal Docker `SUPABASE_URL`. The handler returned that private HTTP URL to the HTTPS browser. Preview and download then failed at the final fetch even when upload/archive had succeeded.

Production `SUPABASE_PUBLIC_URL` is also HTTP-only, so substituting it blindly would retain a mixed-content failure. The handler now uses a configured HTTPS public Storage endpoint, or the configured HTTPS CRM Storage proxy through the existing `getDashAppUrl()` contract. In the current environment this resolves to `https://crm-hirschen.ch`. Request Origin/Host headers are not used. The signed path, token/query encoding, optional configured path prefix and document metadata are preserved. Internal server-to-server SDK requests remain on the internal network.

## Deployment

The pre-deploy file hashes matched the last known release before any overwrite. `index.ts` and `document.ts` were backed up under `/data/crm-rollouts/quittung-download-20261026/edge-before.tar.gz`, SHA256 `0dc1e53dafe6a8dffb2b3a1b4fad3743183d1df198ca5576db18d5fe5575a2fa`. Both installed hashes match the source commit. Only the Edge runtime container was restarted; no environment settings were changed.

[File manifest](edge-manifest.json), [deployment](edge-deploy.log), [live handler smoke](edge-smoke.json).

## Evidence

- A deterministic real-handler + real-SDK reproduction returned the private HTTP origin before the fix. The extended corrected suite passes 8/8 scenarios: lookup/archive, HTTPS public API, HTTP public API with configured CRM proxy, the actual default CRM configuration, and a reverse-proxy path prefix. Signed query encoding is unchanged.
- Real detail/list/helper/Storage SDK and PDF renderer tests reproduce the failure with the internal URL. Six fixed scenarios pass, including existing and first-created archives, detail/list downloads and archived preview. Named downloads match archived/uploaded bytes exactly; frozen receipts receive no database writes.
- Full unit suite: 122 files, 2,245 tests passed. Deno type checking and test-infrastructure TypeScript passed. Deno lint passes with the existing pinned-URL import convention excluded (`no-import-prefix`); the unchanged imports are the only default Deno lint findings. Repository ESLint intentionally ignores these Edge files.
- Live read-only investigation found an existing archive/object with valid permissions and checksum. A signed HTTPS fetch returned HTTP 200, `application/pdf`, 114,755 bytes, valid PDF magic and the exact archived SHA256. Tokens, object paths, customer fields and file content were not logged. No user JWT was minted or impersonated.
- The same read-only existing-archive check passed after deployment: signing HTTP 200, download HTTP 200, 114,755 bytes, valid PDF magic and matching archived SHA256. This verifies the public Storage route; it does not impersonate a user or exercise an authenticated production handler request. [Post-deploy result](live-download-after.json).
- The three currently paid rows did not yet have an archive during diagnosis; the user's specific chosen receipt was not identified. Positive first-archive coverage is controlled local integration coverage. Production positive read verification uses the already existing archive.

[Storage URL reproduction](../../../docs/audits/quittung-download-2026-10-26/STORAGE_URL_DIAGNOSIS.md), [frontend reproduction](../../../docs/audits/quittung-download-2026-10-26/FRONTEND_DIAGNOSIS.md), [production diagnosis](../../../docs/audits/quittung-download-2026-10-26/PRODUCTION_DIAGNOSIS.md).

No customer test email was sent. Historical PDF bytes, original names/addresses and payment records are unchanged. The download correction is server-side and applies to the existing frontend archive client.
