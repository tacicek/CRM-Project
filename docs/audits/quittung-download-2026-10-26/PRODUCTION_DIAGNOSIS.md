# Quittung PDF download — production diagnosis, 26 October 2026

The deployed receipt handler returned the Storage SDK's signed URL directly. Its SDK client used the Edge runtime's internal HTTP Supabase origin. Such a URL is unsuitable for a browser on the public HTTPS CRM. The configured public Supabase URL also used HTTP, so changing to that variable alone would still leave a mixed-content problem. The application URL variables were absent; the existing application URL helper supplies the configured code fallback.

This defect is supported by the handler source, measured runtime URL classifications and a positive read-only file check: the existing archived PDF downloaded through the CRM's HTTPS Storage proxy with **HTTP 200**, **114,755 bytes**, valid PDF magic and **SHA256 matching the archive record**. No signed URL, token, object path or PDF contents are retained here.

## Other causes checked

- There were 26 receipts, including 6 issued and 3 paid. All issued company snapshots had valid required issuer fields.
- One current archive existed. Its object was present, nonempty and associated with the expected canonical path. There were no unregistered receipt objects.
- The private PDF bucket existed, allowed PDF files and had a 15 MiB size limit.
- Archive registration was service-only, with a fixed search path and valid constraints. The service role had the necessary receipt read/lock and archive read/insert privileges.
- All 6 issued logo references resolved to the same existing object. Its public HTTPS request returned 200, `image/webp`, 12,114 bytes; image decoding verified an 800 × 165 WebP.
- In the sampled 45 minutes, the handler had no caught errors. Gateway requests showed four receipt POSTs with 200 and two with 401; no 400, 403, 404, 409 or 500 appeared. Signed-upload POST/PUT and object reads returned 200. Storage logs agreed with the gateway aggregates.

The full sanitized measurements are in [production-diagnosis.json](production-diagnosis.json).

## Limits

The three `paid` receipts had no current archive. The user's specific receipt was not identified, so these checks do not prove that their exact interaction reached the download stage. A closed receipt may also refer to a sent or signed receipt. The internal signed-URL defect is confirmed independently of that terminology.

One signing POST and one signed-file GET in the aggregate came from this probe. The two 401 responses may include deployment authentication smoke checks. No customer identities, request bodies or session tokens were inspected to attribute them.

No user JWT was created and no user was impersonated. The probe used the existing service credential in memory to request a short-lived read signature for an existing archive, then checked its bytes through HTTPS. No database row, ledger entry, archive record, dispatch or Storage object was written. The positive check does not replace an authenticated browser regression test of the complete handler flow.

## Reproducible safe check

[probe-existing-archive.sh](probe-existing-archive.sh) uses the repository's production identity guard. Supply the same explicit `CRM_PROD_*` target variables required by `scripts/prod-readonly.sh`, plus `CRM_PROD_EDGE_CONTAINER` and the independently verified `CRM_PUBLIC_ORIGIN` (HTTPS only). The script prints only sanitized success/failure metadata, byte count and hash-match booleans. It does not print credentials, headers, tokens, object paths or file contents.

```bash
bash docs/audits/quittung-download-2026-10-26/probe-existing-archive.sh
```

This probe signs and reads an existing archive directly through the verified public Storage proxy. It neither invokes receipt creation nor claims to exercise a user's authenticated Edge request. The collected successful probe is sufficient evidence for the Storage/HTTPS path; the rollout owner records deployment and browser verification separately.
