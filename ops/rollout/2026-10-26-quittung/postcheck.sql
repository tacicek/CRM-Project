-- READ ONLY. Run after migration using the verified production read transport.
BEGIN READ ONLY;
SELECT c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') AS browser_can_write,
 has_table_privilege('service_role',c.oid,'SELECT') AS service_can_read
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('quittung_documents','quittung_dispatches','quittung_payment_links','quittung_nr_counter') ORDER BY c.relname;
SELECT p.oid::regprocedure AS signature,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname IN ('finalize_quittung','record_quittung_payment','register_quittung_document','claim_quittung_dispatch') ORDER BY p.proname;
SELECT c.relname,t.tgname,t.tgenabled,t.tgdeferrable,t.tginitdeferred FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE t.tgname IN ('zz_quittung_lifecycle','quittung_invoice_customer','invoice_quittung_customer',
 'sync_quittung_invoice_payment','sync_quittung_payment_reversal','sync_quittung_payment_reference') ORDER BY c.relname,t.tgname;
SELECT count(*) AS issued_missing_snapshot FROM public.quittungen WHERE status<>'draft' AND (issued_at IS NULL OR company_snapshot IS NULL);
SELECT count(*) AS inconsistent_payment_snapshot FROM public.quittungen q CROSS JOIN LATERAL quittung_private.payment_state(q) p
WHERE (q.payment_status,q.paid_amount,q.payment_open_amount,q.payment_date,q.payment_method,q.payment_reference)
 IS DISTINCT FROM (p.payment_status,p.paid_amount,p.payment_open_amount,p.payment_date,p.payment_method,p.payment_reference)
 OR q.betrag_noch_offen IS DISTINCT FROM (q.payment_status<>'paid')
 OR (q.issued_at IS NOT NULL AND (q.status='paid') IS DISTINCT FROM (q.payment_status='paid'));
SELECT count(*) AS missing_legacy_payment_link FROM public.quittungen q WHERE q.payment_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.quittung_payment_links l WHERE l.quittung_id=q.id AND l.payment_id=q.payment_id);
SELECT count(*) AS invoice_customer_mismatch FROM public.quittungen q JOIN public.rechnungen r ON r.id=q.rechnung_id
WHERE q.company_id IS DISTINCT FROM r.company_id OR q.customer_id IS DISTINCT FROM r.customer_id;
SELECT count(*) AS receipt_count,md5(coalesce(string_agg(md5(jsonb_build_object(
 'id',id,'company_id',company_id,'positionen',positionen,'rabatt',rabatt,'zwischensumme',zwischensumme,
 'total',total,'mwst_satz',mwst_satz,'mwst_betrag',mwst_betrag,'gesamttotal',gesamttotal,
 'customer_name',customer_name,'customer_email',customer_email,'customer_phone',customer_phone,
 'kunde_unterschrift',kunde_unterschrift,'teamchef_unterschrift',teamchef_unterschrift)::text),',' ORDER BY id),'')) AS preserved_content_fingerprint
FROM public.quittungen;
SELECT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AS publication_exists,
 EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='quittungen') AS receipt_in_publication;
SELECT conname,convalidated FROM pg_constraint WHERE conrelid='public.quittungen'::regclass
 AND conname IN ('quittungen_status_check','quittungen_payment_status_check','quittungen_rechnung_fk','quittungen_id_company_unique');
ROLLBACK;
