# Archived receipt download: internal versus public Storage URL

The receipt download/preview path fetches the URL returned by `send-quittung`. The Edge handler creates its server-side Supabase client with `SUPABASE_URL`, then returns `createSignedUrl(...).data.signedUrl` unchanged. In self-hosted Supabase, `SUPABASE_URL` is the internal Docker gateway address. The Storage SDK adds that configured base to Storage's relative `signedURL` response.

The deterministic reproduction uses the **real Edge handler, real membership helper, and installed Supabase SDK**. Only HTTP responses are replaced with local synthetic Auth/PostgREST/Storage responses. The original code returns HTTP 200 and the correct document identity, path and signing token, but its URL starts with `http://supabase-kong:8000`. That address is unusable by the external browser and is insecure mixed content when fetched from an HTTPS dashboard.

Both `lookup` and the already-archived `archive` path fail the expected public-origin assertion under two configurations: a directly reachable HTTPS Supabase public URL, and an HTTP Supabase public URL with an HTTPS dashboard Storage proxy. See [storage-url-before.json](storage-url-before.json). The pre-existing handler test mocked an already-public HTTPS URL, so it did not exercise the server-client origin boundary.

**After the fix, all eight handler scenarios pass.** [storage-url-after.json](storage-url-after.json) covers `lookup` and `archive` under HTTPS public origin, HTTP public plus configured HTTPS dashboard, HTTP public plus the real canonical dashboard default when app URL variables are unset, and an HTTPS public base with a path prefix. The complete encoded signing query is preserved, including percent escapes and a literal plus character. All backend Auth/PostgREST/Storage requests still use the internal gateway; no request is sent to the public host by the server-side SDK.

## Correct fix boundary

Keep internal Supabase calls on `SUPABASE_URL`. Before returning a signed Storage URL to the browser, choose an externally reachable **HTTPS** base and preserve the exact Storage object path and signing query. A directly configured HTTPS `SUPABASE_PUBLIC_URL` is preferred. The production configuration was independently checked by the parent agent: its public Kong endpoint is HTTP, so blindly substituting `SUPABASE_PUBLIC_URL` would still leave mixed content. In that deployment, the canonical HTTPS dashboard origin already proxies `/storage/v1`; `publicReceiptPdfUrl` uses the trusted `getDashAppUrl()` value as fallback. The deployment's app URL environment variables are unset, so the existing canonical HTTPS default applies. This fallback depends on the deployed reverse proxy and is not an automatic feature of every Supabase installation.

The public base must supply the scheme as well as the hostname. Do not derive this trusted address from request `Host`, `Origin` or forwarded headers. The harness supplies deliberately unrelated request/forwarded origins to catch that shortcut, and tests both secure-public and HTTP-public/HTTPS-dashboard configurations for `lookup` and `archive`.

`calendar-feed/index.ts` already uses `SUPABASE_PUBLIC_URL` for outward-facing identifiers. No shared general-purpose Storage URL normalization helper existed when this investigation began. The narrow receipt response boundary fixes both archived download and preview; changing the server client's global base is unnecessary.

Official Supabase documentation explicitly distinguishes the [internal and external Edge Function URLs](https://supabase.com/docs/guides/self-hosting/self-hosted-functions#internal-vs-external-urls). Its [createSignedUrl reference](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) documents the temporary signed-link API. The current changelog was checked; the scheduled TLS cipher removal is unrelated to the reproduced Docker-origin error.

## Reproduce

```bash
AUDIT_RESULT_NAME=storage-url-current.json node docs/audits/quittung-download-2026-10-26/storage-url-repro.mjs
```

Exit 1 means the handler response still violates the public-origin/path/token contract; exit 0 means all checks pass. The stored `before` file was captured before the fix and retained; the matrix was expanded from four to eight scenarios for final verification. The harness uses synthetic strings instead of real keys or signed JWTs, never contacts a live service, and performs no live writes. Its SDK adapter is the installed package; the Edge handler's pinned `supabase-js@2.39.3` also imports Storage JS and uses the same client-base construction mechanism.
