-- Public receipt contract: canonical totals, immutable issue, ledger/invoice
-- synchronization, versioned archive, and company isolation. Synthetic data only.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$
DECLARE
 c uuid:='a0000000-0000-4000-8000-0000000000c1';
 q public.quittungen; q2 public.quittungen; r public.rechnungen; r2 public.rechnungen;
 p uuid; p2 uuid; n bigint; v integer; result jsonb; rejected boolean;
 doc public.quittung_documents; again public.quittung_documents;
 d public.quittung_dispatches; again_d public.quittung_dispatches;
 items jsonb:='[{"id":"one","beschreibung":"Umzug – Işıl Çiçek","satz":"1 × 100 CHF","betrag":100,"checked":true,"is_custom":false},{"id":"optional","beschreibung":"Optional","satz":"","betrag":300,"checked":false,"is_custom":false}]';
BEGIN
 SET LOCAL ROLE authenticated;
 INSERT INTO public.quittungen(company_id,customer_name,positionen,mwst_satz,rabatt,zwischensumme,total,mwst_betrag,gesamttotal)
 VALUES(c,'Receipt regression',items,8.1,10,999,999,0,999) RETURNING * INTO q;
 IF q.zwischensumme<>100 OR q.total<>90 OR q.mwst_betrag<>7.29 OR q.gesamttotal<>97.29 THEN
   RAISE EXCEPTION 'FAIL Q1: money is not computed from checked line items'; END IF;
 IF q.payment_status<>'open' OR NOT q.betrag_noch_offen OR q.issued_at IS NOT NULL THEN
   RAISE EXCEPTION 'FAIL Q2: draft claims an issue or a payment'; END IF;
 v:=q.version;
 q:=public.finalize_quittung(q.id,v);
 IF q.status<>'issued' OR q.issued_at IS NULL OR q.company_snapshot->>'company_name' IS NULL OR q.version<=v THEN
   RAISE EXCEPTION 'FAIL Q3: unsigned issue does not freeze issuer/content'; END IF;
 rejected:=false;
 BEGIN PERFORM public.finalize_quittung(q.id,v); EXCEPTION WHEN serialization_failure THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q4: stale finalization accepted'; END IF;
 rejected:=false;
 BEGIN UPDATE public.quittungen SET customer_name='Changed after signature' WHERE id=q.id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q5: issued customer content is editable'; END IF;
 rejected:=false;
 BEGIN UPDATE public.quittungen SET status='draft' WHERE id=q.id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q6: issued document can regress to draft'; END IF;
 result:=public.record_quittung_payment(q.id,'twint',DATE '2026-10-26','SYNTHETIC-001');
 p:=(result->>'payment_id')::uuid;
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.status<>'paid' OR q.payment_status<>'paid' OR q.paid_amount<>97.29 OR q.betrag_noch_offen
    OR q.payment_method<>'twint' OR q.payment_date<>DATE '2026-10-26' OR q.payment_reference<>'SYNTHETIC-001' THEN
   RAISE EXCEPTION 'FAIL Q7: direct payment and all receipt states are not atomic'; END IF;
 v:=q.version;
 RESET ROLE;
 SET LOCAL ROLE service_role;
 UPDATE public.quittungen SET sent_at=now() WHERE id=q.id;
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.status<>'paid' OR q.version<>v THEN RAISE EXCEPTION 'FAIL Q8: send changes payment or render version'; END IF;
 RESET ROLE;
 SET LOCAL ROLE authenticated;
 rejected:=false;
 BEGIN PERFORM public.record_quittung_payment(q.id); EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q9: duplicate active direct payment accepted'; END IF;
 PERFORM public.reverse_payment(p,'Synthetic reversal');
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.payment_status<>'open' OR q.paid_amount<>0 OR q.status='paid' OR NOT q.betrag_noch_offen
    OR q.payment_method IS NOT NULL OR q.payment_date IS NOT NULL THEN
   RAISE EXCEPTION 'FAIL Q10: reversal does not reopen receipt consistently'; END IF;
 result:=public.record_quittung_payment(q.id,'cash',DATE '2026-10-26');
 IF (SELECT count(*) FROM public.quittung_payment_links WHERE quittung_id=q.id)<>2 THEN
   RAISE EXCEPTION 'FAIL Q11: re-collection lost historical payment association'; END IF;
 RAISE NOTICE 'PASS Quittung direct issue/payment/reversal/history and content guards';

 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,positionen,zwischensumme,mwst_satz,mwst_betrag,total,rabatt,gesamttotal,status,datum,faellig_am)
 VALUES(c,'Invoice receipt regression','quittung-invoice@example.test','[{"beschreibung":"Service","menge":1,"einzelpreis":100,"betrag":100,"einheit":"pauschal"}]',100,0,0,100,0,100,'versendet',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO r;
 INSERT INTO public.quittungen(company_id,customer_name,customer_email,customer_id,positionen,mwst_satz,rechnung_id)
 VALUES(c,r.customer_name,r.customer_email,r.customer_id,items,0,r.id) RETURNING * INTO q2;
 q2:=public.finalize_quittung(q2.id,q2.version);
 n:=(SELECT count(*) FROM public.payments WHERE company_id=c);
 result:=public.record_payment(c,40,DATE '2026-10-25','bank',r.customer_id,'PART1',NULL,jsonb_build_array(jsonb_build_object('rechnung_id',r.id,'amount',40)));
 p:=(result->>'payment_id')::uuid;
 SELECT * INTO q2 FROM public.quittungen WHERE id=q2.id;
 IF q2.payment_status<>'partial' OR q2.paid_amount<>40 OR q2.status='paid' OR NOT q2.betrag_noch_offen THEN
   RAISE EXCEPTION 'FAIL Q12: partial invoice payment was not reflected'; END IF;
 result:=public.record_payment(c,60,DATE '2026-10-26','twint',r.customer_id,'PART2',NULL,jsonb_build_array(jsonb_build_object('rechnung_id',r.id,'amount',60)));
 p2:=(result->>'payment_id')::uuid;
 SELECT * INTO q2 FROM public.quittungen WHERE id=q2.id;
 IF q2.payment_status<>'paid' OR q2.status<>'paid' OR q2.paid_amount<>100 OR q2.payment_id IS NOT NULL
    OR q2.payment_method IS NOT NULL OR q2.payment_reference IS NOT NULL THEN
   RAISE EXCEPTION 'FAIL Q13: full invoice payment is not reflected accurately'; END IF;
 IF (SELECT count(*) FROM public.payments WHERE company_id=c)<>n+2 THEN
   RAISE EXCEPTION 'FAIL Q14: invoice synchronization duplicated a payment'; END IF;
 rejected:=false;
 BEGIN PERFORM public.record_quittung_payment(q2.id); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q15: direct payment accepted for invoice-linked receipt'; END IF;
 PERFORM public.reverse_payment(p2,'Synthetic invoice reversal');
 SELECT * INTO q2 FROM public.quittungen WHERE id=q2.id;
 IF q2.payment_status<>'partial' OR q2.paid_amount<>40 OR q2.status='paid' OR q2.payment_method<>'bank' THEN
   RAISE EXCEPTION 'FAIL Q16: invoice reversal did not reopen receipt'; END IF;
 INSERT INTO public.credit_notes(company_id,rechnung_id,amount,status) VALUES(c,r.id,60,'versendet');
 SELECT * INTO q2 FROM public.quittungen WHERE id=q2.id;
 IF q2.payment_status<>'paid' OR q2.paid_amount<>40 OR q2.payment_open_amount<>0 THEN
   RAISE EXCEPTION 'FAIL Q17: credit note either fails status sync or fabricates cash'; END IF;
 RAISE NOTICE 'PASS Quittung invoice partial/full/reversal/credit-note synchronization without double income';

 -- Test both same-company wrong-customer and cross-company linkage.
 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,positionen,zwischensumme,mwst_satz,mwst_betrag,total,rabatt,gesamttotal,status,datum,faellig_am)
 VALUES(c,'Other invoice customer','other-quittung@example.test','[{"beschreibung":"Service","menge":1,"einzelpreis":100,"betrag":100,"einheit":"pauschal"}]',100,0,0,100,0,100,'versendet',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO r2;
 rejected:=false;
 BEGIN INSERT INTO public.quittungen(company_id,customer_id,customer_name,positionen,rechnung_id)
 VALUES(c,r.customer_id,r.customer_name,items,r2.id);
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q18: receipt linked to another customer invoice'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Bad JSON','{}');
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q19: malformed line JSON accepted'; END IF;
 INSERT INTO public.quittungen(company_id,customer_name) VALUES(c,'') RETURNING * INTO q;
 rejected:=false;
 BEGIN PERFORM public.finalize_quittung(q.id,q.version); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q20: empty draft finalized'; END IF;
 -- Deleting the highest draft must not recycle its number.
 n:=split_part(q.quittung_nr,'-',3)::bigint;
 DELETE FROM public.quittungen WHERE id=q.id;
 INSERT INTO public.quittungen(company_id,customer_name) VALUES(c,'Counter test') RETURNING * INTO q;
 IF split_part(q.quittung_nr,'-',3)::bigint<=n THEN RAISE EXCEPTION 'FAIL Q21: deleted receipt number reused'; END IF;
 RAISE NOTICE 'PASS Quittung validation, customer linkage and non-recycled numbering';

 RESET ROLE;
 SET LOCAL ROLE service_role;
 SELECT * INTO q2 FROM public.quittungen WHERE id=q2.id;
 doc:=public.register_quittung_document(q2.id,q2.version,c::text||'/quittung/'||q2.id::text||'/'||q2.version||'/'||repeat('a',64)||'.pdf',repeat('a',64));
 again:=public.register_quittung_document(q2.id,q2.version,doc.pdf_path,repeat('a',64));
 IF doc.id<>again.id THEN RAISE EXCEPTION 'FAIL Q22: document registration is not idempotent'; END IF;
 rejected:=false;
 BEGIN UPDATE public.quittung_documents SET sha256=repeat('b',64) WHERE id=doc.id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q23: archived metadata can be overwritten'; END IF;
 d:=public.claim_quittung_dispatch(doc.id,'customer','Customer@example.test');
 again_d:=public.claim_quittung_dispatch(doc.id,'customer','customer@example.test');
 IF d.id IS NULL OR again_d.id IS NOT NULL THEN RAISE EXCEPTION 'FAIL Q24: active dispatch claim was duplicated'; END IF;
 UPDATE public.quittung_dispatches SET status='failed',error='Synthetic provider failure' WHERE id=d.id;
 again_d:=public.claim_quittung_dispatch(doc.id,'customer','customer@example.test');
 IF again_d.id<>d.id THEN RAISE EXCEPTION 'FAIL Q25: retry changed stable provider idempotency identity'; END IF;
 UPDATE public.quittung_dispatches SET status='sent',provider_id='synthetic',sent_at=now() WHERE id=d.id;
 again_d:=public.claim_quittung_dispatch(doc.id,'customer','customer@example.test');
 IF again_d.id IS NOT NULL THEN RAISE EXCEPTION 'FAIL Q26: already sent recipient was claimed again'; END IF;
 RESET ROLE;
 SET LOCAL ROLE authenticated;
 rejected:=false;
 BEGIN PERFORM public.register_quittung_document(q2.id,q2.version,doc.pdf_path,repeat('a',64));
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q27: browser can register arbitrary PDF'; END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 IF EXISTS(SELECT 1 FROM public.quittung_documents WHERE id=doc.id) OR EXISTS(SELECT 1 FROM public.quittung_dispatches WHERE id=d.id) THEN
   RAISE EXCEPTION 'FAIL Q28: foreign company sees receipt archive/dispatch'; END IF;
 rejected:=false;
 BEGIN PERFORM public.finalize_quittung(q2.id,q2.version); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q29: foreign company can finalize receipt'; END IF;
 RESET ROLE;
 RAISE NOTICE 'PASS Quittung archive immutability, dispatch idempotency and company isolation';
END $$;
DO $$
DECLARE c uuid:='a0000000-0000-4000-8000-0000000000c1'; r public.rechnungen; target public.rechnungen; q public.quittungen;
  rejected boolean; old_name text; v integer;
  items jsonb:='[{"id":"one","beschreibung":"Service","satz":"","betrag":100,"checked":true,"is_custom":false}]';
  png text:='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6y1wAAAAASUVORK5CYII=';
BEGIN
 PERFORM set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,positionen,zwischensumme,mwst_satz,mwst_betrag,total,rabatt,gesamttotal,status,datum,faellig_am)
 VALUES(c,'Merge source','receipt-merge-source@example.test','[{"beschreibung":"Service","menge":1,"einzelpreis":100,"betrag":100,"einheit":"pauschal"}]',100,0,0,100,0,100,'entwurf',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO r;
 INSERT INTO public.quittungen(company_id,customer_id,customer_name,customer_email,positionen,mwst_satz,rechnung_id)
 VALUES(c,r.customer_id,r.customer_name,r.customer_email,items,0,r.id) RETURNING * INTO q;
 q:=public.finalize_quittung(q.id,q.version,png,NULL,now(),NULL);
 IF q.status<>'signed' OR q.kunde_unterschrift<>png OR q.kunde_signed_at IS NULL THEN
   RAISE EXCEPTION 'FAIL Q30: captured signature and issue are not persisted together'; END IF;
 v:=q.version;
 UPDATE public.rechnungen SET positionen='[{"beschreibung":"Service","menge":1,"einzelpreis":150,"betrag":150,"einheit":"pauschal"}]',zwischensumme=150,total=150,gesamttotal=150 WHERE id=r.id;
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.payment_open_amount<>150 OR q.version<=v THEN RAISE EXCEPTION 'FAIL Q31: invoice amount-only change leaves receipt balance stale'; END IF;
 rejected:=false;
 BEGIN UPDATE public.quittungen SET sent_at=now() WHERE id=q.id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q32: browser can assert delivery'; END IF;
 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,datum,faellig_am)
 VALUES(c,'Merge target','receipt-merge-target@example.test',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO target;
 rejected:=false;
 BEGIN UPDATE public.quittungen SET customer_id=target.customer_id WHERE id=q.id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q33: browser can swap frozen canonical customer'; END IF;
 old_name:=q.customer_name; v:=q.version;
 PERFORM public.merge_customers(c,r.customer_id,target.customer_id,'Synthetic receipt merge');
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.customer_id<>target.customer_id OR q.customer_name<>old_name OR q.version<>v THEN
   RAISE EXCEPTION 'FAIL Q34: authorized customer merge breaks frozen receipt snapshot'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Bad unit',jsonb_set(items,'{0,einheit}','123'));
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q35: numeric unit accepted'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Bad rate',jsonb_set(items,'{0,einzelpreis}','-1'));
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q36: negative unit price accepted'; END IF;
 INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Bad signature',items) RETURNING * INTO q;
 rejected:=false;
 BEGIN PERFORM public.finalize_quittung(q.id,q.version,'data:image/png;base64,YnJva2Vu');
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q37: non-PNG signature accepted'; END IF;
 RESET ROLE;
 UPDATE public.quittung_nr_counter SET letzte_nr=9999 WHERE company_id=c AND jahr=extract(year FROM CURRENT_DATE);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.quittungen(company_id,customer_name) VALUES(c,'Counter 10000') RETURNING * INTO q;
 IF split_part(q.quittung_nr,'-',3)<>'10000' THEN RAISE EXCEPTION 'FAIL Q38: five-digit receipt number truncated'; END IF;
 RESET ROLE;
 RAISE NOTICE 'PASS Quittung signature capture, invoice amount edits, customer merge, shape validation and five-digit numbers';
END $$;
DO $$
DECLARE c uuid:='a0000000-0000-4000-8000-0000000000c1'; r public.rechnungen; target public.rechnungen;
 q public.quittungen; direct_q public.quittungen; result jsonb; v integer; rejected boolean;
 items jsonb:='[{"id":"one","beschreibung":"Service","satz":"","betrag":100,"checked":true,"is_custom":false}]';
BEGIN
 PERFORM set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,positionen,zwischensumme,mwst_satz,mwst_betrag,total,rabatt,gesamttotal,status,datum,faellig_am)
 VALUES(c,'Draft merge source','receipt-draft-merge-source@example.test','[{"beschreibung":"Service","menge":1,"einzelpreis":100,"betrag":100,"einheit":"pauschal"}]',100,0,0,100,0,100,'entwurf',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO r;
 INSERT INTO public.quittungen(company_id,customer_id,customer_name,customer_email,positionen,mwst_satz,rechnung_id)
 VALUES(c,r.customer_id,r.customer_name,r.customer_email,items,0,r.id) RETURNING * INTO q;
 INSERT INTO public.rechnungen(company_id,customer_name,customer_email,datum,faellig_am)
 VALUES(c,'Draft merge target','receipt-draft-merge-target@example.test',CURRENT_DATE,CURRENT_DATE+30) RETURNING * INTO target;
 PERFORM public.merge_customers(c,r.customer_id,target.customer_id,'Synthetic draft receipt merge');
 SET CONSTRAINTS ALL IMMEDIATE;
 SET CONSTRAINTS ALL DEFERRED;
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.customer_id<>target.customer_id OR q.status<>'draft' THEN RAISE EXCEPTION 'FAIL Q39: invoice-linked draft prevents customer merge'; END IF;
 UPDATE public.rechnungen SET status='versendet' WHERE id=r.id;
 q:=public.finalize_quittung(q.id,q.version);
 result:=public.record_payment(c,100,CURRENT_DATE,'bank',target.customer_id,'ORIGINAL-INVOICE',NULL,jsonb_build_array(jsonb_build_object('rechnung_id',r.id,'amount',100)));
 SELECT version INTO v FROM public.quittungen WHERE id=q.id;
 UPDATE public.payments SET reference='CORRECTED-INVOICE' WHERE id=(result->>'payment_id')::uuid;
 SELECT * INTO q FROM public.quittungen WHERE id=q.id;
 IF q.payment_reference<>'CORRECTED-INVOICE' OR q.version<=v THEN RAISE EXCEPTION 'FAIL Q40: invoice payment reference correction not reflected'; END IF;
 INSERT INTO public.quittungen(company_id,customer_name,positionen,mwst_satz) VALUES(c,'Direct reference',items,0) RETURNING * INTO direct_q;
 direct_q:=public.finalize_quittung(direct_q.id,direct_q.version);
 result:=public.record_quittung_payment(direct_q.id,'cash',CURRENT_DATE,'ORIGINAL-DIRECT');
 SELECT version INTO v FROM public.quittungen WHERE id=direct_q.id;
 UPDATE public.payments SET reference='CORRECTED-DIRECT' WHERE id=(result->>'payment_id')::uuid;
 SELECT * INTO direct_q FROM public.quittungen WHERE id=direct_q.id;
 IF direct_q.payment_reference<>'CORRECTED-DIRECT' OR direct_q.version<=v THEN RAISE EXCEPTION 'FAIL Q41: direct payment reference correction not reflected'; END IF;
 rejected:=false;
 BEGIN INSERT INTO public.quittungen(company_id,customer_name,sent_at) VALUES(c,'Fake sent',now());
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q42: browser INSERT can assert delivery'; END IF;
 RESET ROLE;
 rejected:=false;
 BEGIN
   UPDATE public.quittungen SET customer_id=direct_q.customer_id WHERE id=q.id;
   SET CONSTRAINTS ALL IMMEDIATE;
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL Q43: deferred receipt/invoice customer invariant accepts mismatch'; END IF;
 SET CONSTRAINTS ALL IMMEDIATE;
 RAISE NOTICE 'PASS Quittung draft customer merge, payment reference revisions, INSERT delivery guard and deferred customer invariant';
END $$;
DO $$
DECLARE c uuid:='a0000000-0000-4000-8000-0000000000c1'; q public.quittungen; previous_snapshot jsonb;
 items jsonb:='[{"id":"one","beschreibung":"Service","satz":"","betrag":100,"checked":true,"is_custom":false}]';
BEGIN
 UPDATE public.companies SET street='Alte Landstrasse',house_number='12a' WHERE id=c;
 PERFORM set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Address capture',items) RETURNING * INTO q;
 q:=public.finalize_quittung(q.id,q.version);
 IF q.company_snapshot->>'street'<>'Alte Landstrasse' OR q.company_snapshot->>'house_number' IS DISTINCT FROM '12a' THEN
   RAISE EXCEPTION 'FAIL Q44: issuer house number is missing from finalized snapshot'; END IF;
 previous_snapshot:=q.company_snapshot;
 RESET ROLE;
 UPDATE public.companies SET house_number='99' WHERE id=c;
 UPDATE public.quittungen SET notiz=notiz WHERE id=q.id RETURNING * INTO q;
 IF q.company_snapshot IS DISTINCT FROM previous_snapshot THEN RAISE EXCEPTION 'FAIL Q45: issuer address changed on an issued receipt'; END IF;
 UPDATE public.companies SET house_number=NULL WHERE id=c;
 SET LOCAL ROLE authenticated;
 INSERT INTO public.quittungen(company_id,customer_name,positionen) VALUES(c,'Unrecorded house number',items) RETURNING * INTO q;
 q:=public.finalize_quittung(q.id,q.version);
 previous_snapshot:=q.company_snapshot;
 RESET ROLE;
 UPDATE public.companies SET house_number='77B' WHERE id=c;
 UPDATE public.quittungen SET notiz=notiz WHERE id=q.id RETURNING * INTO q;
 IF q.company_snapshot IS DISTINCT FROM previous_snapshot OR q.company_snapshot->>'house_number' IS NOT NULL THEN
   RAISE EXCEPTION 'FAIL Q46: current issuer number leaked into an older snapshot'; END IF;
 RAISE NOTICE 'PASS Quittung issuer house number capture and historical address preservation';
END $$;
ROLLBACK;
