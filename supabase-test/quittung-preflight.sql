-- Read-only preflight BEFORE the Quittung lifecycle migration. No new columns,
-- functions, or production data mutation are required. Any returned draft must
-- be corrected explicitly; the migration refuses to rewrite inconsistent money.
BEGIN READ ONLY;
WITH inspected AS (
 SELECT q.*,
   (SELECT coalesce(sum(CASE WHEN p->'checked'='true'::jsonb AND jsonb_typeof(p->'betrag')='number'
                            THEN round((p->>'betrag')::numeric,2) ELSE 0 END),0)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(q.positionen)='array' THEN q.positionen ELSE '[]'::jsonb END) p) AS item_sum,
   EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(q.positionen)='array' THEN q.positionen ELSE '[]'::jsonb END) p
    WHERE jsonb_typeof(p) IS DISTINCT FROM 'object'
      OR jsonb_typeof(p->'id') IS DISTINCT FROM 'string'
      OR btrim(p->>'id')=''
      OR jsonb_typeof(p->'beschreibung') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p->'satz') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p->'checked') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p->'is_custom') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(p->'betrag') IS DISTINCT FROM 'number'
      OR CASE WHEN jsonb_typeof(p->'betrag')='number' THEN (p->>'betrag')::numeric<0 ELSE false END
      OR (p ? 'menge' AND p->'menge'<>'null'::jsonb AND
        CASE WHEN jsonb_typeof(p->'menge')='number' THEN (p->>'menge')::numeric<0 ELSE true END)
      OR (p ? 'einzelpreis' AND p->'einzelpreis'<>'null'::jsonb AND
        CASE WHEN jsonb_typeof(p->'einzelpreis')='number' THEN (p->>'einzelpreis')::numeric<0 ELSE true END)
      OR (p ? 'einheit' AND p->'einheit'<>'null'::jsonb AND jsonb_typeof(p->'einheit') IS DISTINCT FROM 'string')
      OR (p ? 'price_type' AND p->'price_type'<>'null'::jsonb AND p->>'price_type' NOT IN ('pauschale','per_unit','per_hour','optional','inkl'))
   ) AS invalid_item,
   (SELECT count(*)<>count(DISTINCT p->>'id')
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(q.positionen)='array' THEN q.positionen ELSE '[]'::jsonb END) p) AS duplicate_item_id,
   (q.offer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.offers o WHERE o.id=q.offer_id AND o.company_id=q.company_id))
     OR (q.auftrag_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.auftraege a WHERE a.id=q.auftrag_id AND a.company_id=q.company_id
       AND (q.offer_id IS NULL OR a.offer_id IS NOT DISTINCT FROM q.offer_id))) AS invalid_source
 FROM public.quittungen q WHERE q.status='draft'
), findings AS (
 SELECT id,quittung_nr,array_remove(ARRAY[
   CASE WHEN jsonb_typeof(positionen) IS DISTINCT FROM 'array' OR invalid_item OR duplicate_item_id THEN 'invalid_positionen' END,
   CASE WHEN invalid_source THEN 'inconsistent_offer_or_order_source' END,
   CASE WHEN rabatt<0 OR rabatt>item_sum OR mwst_satz<0 OR mwst_satz>100 THEN 'invalid_discount_or_tax' END,
   CASE WHEN zwischensumme<>round(item_sum,2) OR total<>round(item_sum-rabatt,2)
       OR mwst_betrag<>round(round(item_sum-rabatt,2)*mwst_satz/100,2)
       OR gesamttotal<>round(item_sum-rabatt,2)+round(round(item_sum-rabatt,2)*mwst_satz/100,2)
     THEN 'stored_totals_differ_from_items' END
 ],NULL) AS issues FROM inspected
)
SELECT id,quittung_nr,issues FROM findings WHERE cardinality(issues)>0 ORDER BY id;
-- A legacy payment assigned to several receipts needs a deliberate reconciliation;
-- the new direct-payment history will not silently choose one of those receipts.
SELECT payment_id,array_agg(id ORDER BY id) AS receipt_ids
FROM public.quittungen WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING count(*)>1;
ROLLBACK;
