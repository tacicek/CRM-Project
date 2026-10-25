-- READ ONLY. First verify target with scripts/prod-readonly.sh.
-- Run supabase-test/quittung-preflight.sql as the separate data-shape preflight.
BEGIN READ ONLY;
SELECT current_database() AS database_name,current_setting('server_version') AS server_version;
SELECT v.name,to_regclass(v.name) IS NOT NULL AS present FROM (VALUES
 ('public.quittungen'),('public.rechnungen'),('public.payments'),('public.payment_allocations'),
 ('public.customers'),('public.companies'),('public.company_members'),('public.offers'),('public.auftraege')) v(name);
SELECT v.signature,to_regprocedure(v.signature) IS NOT NULL AS present FROM (VALUES
 ('public.is_company_member(uuid,uuid)'),('public.is_company_role(uuid,text[],uuid)'),
 ('public.record_payment(uuid,numeric,date,text,uuid,text,text,jsonb)'),
 ('public.reverse_payment(uuid,text)'),('public.record_quittung_payment(uuid,text,date,text,text)'),
 ('public.merge_customers(uuid,uuid,uuid,text)'),('public.customer_reference_columns()')) v(signature);
SELECT v.table_name,v.column_name,EXISTS(SELECT 1 FROM information_schema.columns c
 WHERE c.table_schema='public' AND c.table_name=v.table_name AND c.column_name=v.column_name) AS present
FROM (VALUES ('rechnungen','paid_total'),('rechnungen','credited_total'),('rechnungen','open_amount'),
 ('payments','reverses_payment_id'),('quittungen','payment_id'),('quittungen','kunde_signed_at'),('quittungen','teamchef_signed_at'),
 ('companies','default_language'),('companies','notification_email'),('companies','bank_name'),('companies','bewertungs_url')) v(table_name,column_name);
SELECT conrelid::regclass AS relation_name,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid IN ('public.rechnungen'::regclass,'public.payments'::regclass) AND contype='u'
 AND pg_get_constraintdef(oid)='UNIQUE (id, company_id)';
SELECT position('crm.merging_customers' IN pg_get_functiondef('public.merge_customers(uuid,uuid,uuid,text)'::regprocedure))>0 AS merge_has_authorized_context,
 position('customer_reference_columns' IN pg_get_functiondef('public.merge_customers(uuid,uuid,uuid,text)'::regprocedure))>0 AS merge_discovers_all_customer_references;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='document-pdfs';
SELECT status,count(*) AS receipts FROM public.quittungen GROUP BY status ORDER BY status;
SELECT count(*) AS receipt_count,md5(coalesce(string_agg(md5(jsonb_build_object(
 'id',id,'company_id',company_id,'positionen',positionen,'rabatt',rabatt,'zwischensumme',zwischensumme,
 'total',total,'mwst_satz',mwst_satz,'mwst_betrag',mwst_betrag,'gesamttotal',gesamttotal,
 'customer_name',customer_name,'customer_email',customer_email,'customer_phone',customer_phone,
 'kunde_unterschrift',kunde_unterschrift,'teamchef_unterschrift',teamchef_unterschrift)::text),',' ORDER BY id),'')) AS preserved_content_fingerprint
FROM public.quittungen;
-- Advisory: statuses may legitimately be corrected by ledger-derived backfill.
SELECT count(*) AS legacy_paid_without_active_direct_payment FROM public.quittungen q
WHERE q.status='paid' AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.id=q.payment_id AND p.amount>0
 AND NOT EXISTS(SELECT 1 FROM public.payments rev WHERE rev.reverses_payment_id=p.id));
-- Block oversized suffixes: migration's atomic counter uses bigint.
SELECT id,quittung_nr FROM public.quittungen WHERE quittung_nr ~ '^QU-[0-9]{4}-[0-9]+$'
 AND split_part(quittung_nr,'-',3)::numeric>9223372036854775807::numeric;
ROLLBACK;
