-- Aggregate-only diagnosis. Never emits customer fields, IDs or address values.
-- Run through scripts/prod-readonly.sh with its target/identity guard.
BEGIN READ ONLY;
WITH source AS (
  SELECT q.id, q.version, q.status, q.issued_at,
    q.customer_id IS NULL AS receipt_customer_missing,
    o.customer_id IS NULL AS offer_customer_missing,
    q.customer_id IS NOT NULL AND q.customer_id = o.customer_id AS customer_matches,
    q.kunde_unterschrift IS NOT NULL OR q.teamchef_unterschrift IS NOT NULL AS has_signature,
    q.kunde_signed_at IS NOT NULL OR q.teamchef_signed_at IS NOT NULL AS has_signature_timestamp,
    q.company_snapshot IS NOT NULL AS has_company_snapshot,
    q.auftrag_id IS NOT NULL AS has_order_link,
    o.frozen_address_at IS NOT NULL AND o.frozen_address_at <= q.created_at
      AND o.updated_at <= q.created_at AND o.created_at <= q.created_at AS source_predates_receipt,
    q.customer_address = concat_ws(', ', nullif(o.frozen_from_street,''),
      nullif(concat_ws(' ', nullif(o.frozen_from_plz,''), nullif(o.frozen_from_city,'')),'')) AS exact_old_formatter,
    q.customer_address = concat_ws(', ',
      nullif(concat_ws(' ', nullif(o.frozen_from_street,''), nullif(o.frozen_from_house_number,'')),''),
      nullif(concat_ws(' ', nullif(o.frozen_from_plz,''), nullif(o.frozen_from_city,'')),'')) AS exact_full_formatter,
    EXISTS (SELECT 1 FROM public.quittung_documents d WHERE d.quittung_id = q.id) AS has_document,
    EXISTS (SELECT 1 FROM public.quittung_dispatches x JOIN public.quittung_documents d ON d.id = x.document_id
      WHERE d.quittung_id = q.id) AS has_dispatch
  FROM public.quittungen q
  JOIN public.offers o ON o.id = q.offer_id AND o.company_id = q.company_id
  WHERE nullif(btrim(o.frozen_from_street),'') IS NOT NULL
    AND nullif(btrim(o.frozen_from_house_number),'') IS NOT NULL
), classified AS (
  SELECT *, status = 'draft' AND issued_at IS NULL AND NOT has_signature
    AND NOT has_signature_timestamp AND NOT has_company_snapshot
    AND NOT has_order_link AND NOT has_document AND NOT has_dispatch
    AND customer_matches AND source_predates_receipt AND exact_old_formatter
    AND NOT exact_full_formatter AS strict_candidate
  FROM source
)
SELECT jsonb_build_object(
  'receipt_total', (SELECT count(*) FROM public.quittungen),
  'draft_total', (SELECT count(*) FROM public.quittungen WHERE status = 'draft'),
  'issued_total', (SELECT count(*) FROM public.quittungen WHERE issued_at IS NOT NULL),
  'receipt_order_links', (SELECT count(*) FROM public.quittungen WHERE auftrag_id IS NOT NULL),
  'draft_exact_missing_number_pattern', count(*) FILTER (WHERE status = 'draft' AND exact_old_formatter AND source_predates_receipt),
  'strict_draft_candidates', count(*) FILTER (WHERE strict_candidate),
  'strict_candidate_versions', (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT version AS v FROM classified WHERE strict_candidate) versions),
  'draft_identity_mismatch_excluded', count(*) FILTER (WHERE status = 'draft' AND exact_old_formatter AND source_predates_receipt AND NOT customer_matches),
  'excluded_draft_receipt_customer_missing', count(*) FILTER (WHERE status = 'draft' AND exact_old_formatter AND source_predates_receipt AND NOT customer_matches AND receipt_customer_missing),
  'excluded_draft_offer_customer_missing', count(*) FILTER (WHERE status = 'draft' AND exact_old_formatter AND source_predates_receipt AND NOT customer_matches AND offer_customer_missing),
  'issued_exact_missing_number_pattern', count(*) FILTER (WHERE issued_at IS NOT NULL AND exact_old_formatter),
  'issued_matching_pattern_with_document', count(*) FILTER (WHERE issued_at IS NOT NULL AND exact_old_formatter AND has_document),
  'issued_matching_pattern_source_too_recent', count(*) FILTER (WHERE issued_at IS NOT NULL AND exact_old_formatter AND NOT source_predates_receipt),
  'issued_matching_pattern_with_signature', count(*) FILTER (WHERE issued_at IS NOT NULL AND exact_old_formatter AND has_signature),
  'company_profiles_with_number', (SELECT count(*) FROM public.companies WHERE nullif(btrim(house_number),'') IS NOT NULL),
  'issued_company_snapshot_number_key_absent', (SELECT count(*) FROM public.quittungen WHERE issued_at IS NOT NULL AND NOT coalesce(company_snapshot ? 'house_number',false))
) FROM classified;
ROLLBACK;
