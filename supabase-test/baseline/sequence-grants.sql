-- ERZEUGT von scripts/refresh-test-baseline.sh — nicht von Hand aendern.
-- Sequenz-ACLs (tracked-principal direct-privilege projection: PUBLIC, anon,
-- authenticated, service_role). Fingerprint: c1c387db459127b278080c8834ebae47
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public.klavier_seq TO anon;
GRANT UPDATE ON SEQUENCE public.klavier_seq TO anon;
GRANT USAGE ON SEQUENCE public.klavier_seq TO anon;
GRANT SELECT ON SEQUENCE public.klavier_seq TO authenticated;
GRANT UPDATE ON SEQUENCE public.klavier_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.klavier_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.klavier_seq TO service_role;
GRANT UPDATE ON SEQUENCE public.klavier_seq TO service_role;
GRANT USAGE ON SEQUENCE public.klavier_seq TO service_role;
GRANT SELECT ON SEQUENCE public.moebellift_seq TO anon;
GRANT UPDATE ON SEQUENCE public.moebellift_seq TO anon;
GRANT USAGE ON SEQUENCE public.moebellift_seq TO anon;
GRANT SELECT ON SEQUENCE public.moebellift_seq TO authenticated;
GRANT UPDATE ON SEQUENCE public.moebellift_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.moebellift_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.moebellift_seq TO service_role;
GRANT UPDATE ON SEQUENCE public.moebellift_seq TO service_role;
GRANT USAGE ON SEQUENCE public.moebellift_seq TO service_role;
GRANT SELECT ON SEQUENCE public.offer_number_seq TO anon;
GRANT UPDATE ON SEQUENCE public.offer_number_seq TO anon;
GRANT USAGE ON SEQUENCE public.offer_number_seq TO anon;
GRANT SELECT ON SEQUENCE public.offer_number_seq TO authenticated;
GRANT UPDATE ON SEQUENCE public.offer_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.offer_number_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.offer_number_seq TO service_role;
GRANT UPDATE ON SEQUENCE public.offer_number_seq TO service_role;
GRANT USAGE ON SEQUENCE public.offer_number_seq TO service_role;
GRANT SELECT ON SEQUENCE public.raeumung_seq TO anon;
GRANT UPDATE ON SEQUENCE public.raeumung_seq TO anon;
GRANT USAGE ON SEQUENCE public.raeumung_seq TO anon;
GRANT SELECT ON SEQUENCE public.raeumung_seq TO authenticated;
GRANT UPDATE ON SEQUENCE public.raeumung_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.raeumung_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.raeumung_seq TO service_role;
GRANT UPDATE ON SEQUENCE public.raeumung_seq TO service_role;
GRANT USAGE ON SEQUENCE public.raeumung_seq TO service_role;
GRANT SELECT ON SEQUENCE public.umzug_anfrage_seq TO anon;
GRANT UPDATE ON SEQUENCE public.umzug_anfrage_seq TO anon;
GRANT USAGE ON SEQUENCE public.umzug_anfrage_seq TO anon;
GRANT SELECT ON SEQUENCE public.umzug_anfrage_seq TO authenticated;
GRANT UPDATE ON SEQUENCE public.umzug_anfrage_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.umzug_anfrage_seq TO authenticated;
GRANT SELECT ON SEQUENCE public.umzug_anfrage_seq TO service_role;
GRANT UPDATE ON SEQUENCE public.umzug_anfrage_seq TO service_role;
GRANT USAGE ON SEQUENCE public.umzug_anfrage_seq TO service_role;
DO $acl_check$
DECLARE ist TEXT;
BEGIN
WITH relevante_acl AS (
  SELECT c.relname,
         CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee_name,
         x.privilege_type,
         x.is_grantable
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    coalesce(c.relacl, acldefault('s', c.relowner))
  ) x
  WHERE n.nspname = 'public'
    AND c.relkind IN ('S')
    AND (
      x.grantee = 0
      OR x.grantee IN (
        SELECT oid FROM pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
      )
    )
)
  SELECT md5(coalesce(string_agg(
    relname || ':' || grantee_name || ':' || privilege_type || ':' || is_grantable::text,
    ',' ORDER BY relname COLLATE "C", grantee_name COLLATE "C", privilege_type COLLATE "C", is_grantable
  ), '')) INTO ist FROM relevante_acl;

  IF ist IS DISTINCT FROM 'c1c387db459127b278080c8834ebae47' THEN
    RAISE EXCEPTION 'Sequenz-ACLs — ACL-Fingerprint weicht ab: %', ist;
  END IF;
END
$acl_check$;
