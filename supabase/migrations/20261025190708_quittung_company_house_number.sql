-- Capture the separate issuer house number for receipts issued from now on.
-- Existing issued snapshots and archived PDF bytes are deliberately untouched.
BEGIN;

CREATE OR REPLACE FUNCTION quittung_private.company_snapshot(p_company_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('company_name',c.company_name,'email',c.email,
    'notification_email',c.notification_email,'logo_url',c.logo_url,'primary_color',c.primary_color,
    'phone',c.phone,'street',c.street,'house_number',c.house_number,'plz',c.plz,'city',c.city,'mwst_number',c.mwst_number,
    'iban',c.iban,'bank_name',c.bank_name,'bewertungs_url',c.bewertungs_url,
    'default_language',c.default_language,'captured_at',now())
  FROM public.companies c WHERE c.id=p_company_id
    AND (current_setting('role',true) IN ('none','postgres','supabase_admin','service_role') OR public.is_company_member(c.id));
$$;
REVOKE ALL ON FUNCTION quittung_private.company_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION quittung_private.company_snapshot(uuid) TO authenticated,service_role;

COMMIT;
