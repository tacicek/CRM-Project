-- Run before and after the new helper-only migration; no writes, no customer/company addresses printed.
BEGIN READ ONLY;
SELECT count(*) AS receipt_count,
 md5(coalesce(string_agg(id::text||':'||coalesce(company_snapshot::text,'null'),',' ORDER BY id),'')) AS existing_snapshots_fingerprint
FROM public.quittungen;
SELECT position('''house_number''' IN pg_get_functiondef('quittung_private.company_snapshot(uuid)'::regprocedure))>0 AS builder_includes_house_number;
SELECT count(*) AS companies_checked,
 count(*) FILTER (WHERE quittung_private.company_snapshot(id) ? 'house_number') AS new_snapshots_with_number_field
FROM public.companies;
SELECT has_function_privilege('anon','quittung_private.company_snapshot(uuid)','EXECUTE') AS anon_execute,
 has_function_privilege('authenticated','quittung_private.company_snapshot(uuid)','EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role','quittung_private.company_snapshot(uuid)','EXECUTE') AS service_execute;
ROLLBACK;
