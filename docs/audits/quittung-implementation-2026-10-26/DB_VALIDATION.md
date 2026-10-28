# Quittung database validation — 26 October 2026

All database execution targeted the disposable **crm-test** container on **127.0.0.1:54342**. The repository's lifecycle lock, Docker identity/network/bind checks and database identity marker were verified before mutations. Production was neither queried nor modified. Tests use synthetic customers and receipts; receipt/payment regression transactions roll back. The separate concurrency test commits only temporary draft records and cleans those generated IDs afterward.

## Results

| Verification | Result | Evidence |
| --- | --- | --- |
| Full guarded SQL integration suite | **13/13 test files passed** | [Full log](db-full-suite.log) |
| Quittung lifecycle regression | **43 numbered assertions passed** | [Receipt log](db-quittung-tests.log), `supabase-test/tests/quittungen.sql` |
| Actual concurrent database connections | **3/3 scenarios passed** | [Concurrency results](db-concurrency-results.json), `supabase-test/tests/quittung-concurrency.sh` |
| Migration applied again to the migrated schema | Successful, transaction committed | [Idempotency log](db-migration-idempotency.log) |
| Read-only deployment preflight on local fixtures | No invalid drafts or duplicate legacy payment links | [Preflight log](db-preflight.log) |
| Local Supabase security advisors | 0 ERROR, 17 WARN, 10 INFO across the whole existing schema | [Advisor output](db-security-advisors.json) |
| Generated client schema | Actual local Supabase generation; surgical integration | [Typegen provenance](db-typegen-provenance.json) |

The new numbering counter intentionally has RLS enabled without client policies: clients have no table privileges and the numbering trigger writes through its restricted definer function. This produces one expected INFO. No new Quittung object produces an advisor WARN. An existing `update_quittungen_updated_at` function still has the inherited mutable-search-path warning; the remaining warnings concern existing schema outside this implementation. The new lifecycle/payment/archive functions explicitly set their search path and revoke unintended execution rights.

The full runner initially exposed a pre-existing bootstrap omission: `api-budget.sql` expected `api_rate_budget`, but its existing migration was missing from the pending list. Adding `20260828130000_api_budget_dauerhaft.sql` to **test bootstrap only** resolved that failure. The final run rebuilt the sanitized baseline and passed every suite. This does not introduce a second production migration.

## Verified behavior

- Server-calculated checked-line totals, discount and VAT; malformed positions, invalid unit/rate values, empty finalization and invalid PNG signatures are rejected.
- Unsigned issue and signed issue freeze the financial/customer text/source/company snapshot. Draft regression and stale finalization are rejected. Client INSERT/UPDATE cannot assert email delivery.
- Direct payment atomically creates the ledger payment, retains its receipt association and marks the receipt paid. Duplicate active collection is rejected; reversal reopens it; collection after reversal preserves history.
- Explicit linked invoices mirror partial/full payment, credit-note closure, reversal and amount-only changes without creating another payment. Paid cash and remaining invoice balance remain separate values.
- Direct and invoice payment-reference corrections update the receipt rendering version.
- Archive registration is idempotent and service-only; stored document metadata cannot be overwritten by that role. Active/sent dispatch claims cannot duplicate a send, and failed retries preserve dispatch identity.
- Company isolation, owner/admin payment permissions, frozen customer identity protection and authorized customer merging are exercised.
- Invoice-linked draft merging was first reproduced as a failure ([before-fix log](db-draft-merge-before-fix.log)). The fix permits the authorized merge's temporary reference order and verifies the final receipt/invoice customer identity through deferred constraints. Both signed and draft cases pass, and a persistent mismatch is rejected.
- Receipt numbers are not recycled after deletion, support five digits, and concurrent inserts receive distinct numbers.

The concurrency tests use two real PostgreSQL connections and an observed transaction checkpoint. They exercise (1) an uncommitted receipt link followed by an invoice edit, (2) an invoice edit followed by a new receipt link, and (3) overlapping same-company receipt inserts. Both linked-receipt cases end with the current invoice balance.

## Reproduce locally

With the dedicated test stack already started and its local admin password supplied through the existing test environment:

```bash
CRM_TEST_ENV=1 bash scripts/test-db.sh
CRM_TEST_ENV=1 bash supabase-test/tests/quittung-concurrency.sh
```

The full runner requires `TEST_DB_ADMIN_PASSWORD`; it rebuilds only the verified disposable database. Do not replace its target with a production connection. The concurrency script must run after, rather than alongside, the rebuild.

Security advisors used the installed Supabase CLI with an explicit loopback database URL and `PGSSLMODE=disable`; no linked project was selected. The first attempt lacked that environment setting and refused the local server's non-TLS connection. The successful run's JSON is retained above.

## Deployment boundaries

The deployment migration is `supabase/migrations/20261025180327_quittung_document_lifecycle.sql`. Before applying it to real data, run `supabase-test/quittung-preflight.sql` against the intended database in read-only mode and review any returned receipt IDs. The migration refuses invalid legacy draft shapes, mismatched stored totals and duplicate direct-payment associations; it does not silently repair financial history. Validation errors include affected legacy receipt IDs/numbers.

Legacy issued receipts retain their stored financial and customer text. Their company snapshot is captured from the company data available at migration time, with the real capture time; historical issuer data cannot be reconstructed. Payment state is rederived from existing ledger/reversal evidence. Existing PDF URLs are not evidence of a newly registered immutable document version.

The local preflight result does **not** establish that production legacy data is clean. Production rollout, production preflight, real Storage upload and real email delivery were not performed by these SQL checks. Edge, frontend and PDF checks have separate artifacts in this directory.
