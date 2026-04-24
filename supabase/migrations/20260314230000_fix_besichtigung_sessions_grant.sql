-- ROOT CAUSE FIX: Storage upload fails for ALL buckets because
-- the besichtigung INSERT policy on storage.objects references
-- besichtigung.sessions in a subquery. When PostgreSQL evaluates
-- ALL permissive policies (OR'd together), it tries to access
-- besichtigung.sessions even for non-besichtigung uploads.
-- If the authenticated role lacks SELECT on besichtigung.sessions,
-- the entire INSERT fails with "permission denied for table sessions".

-- Grant SELECT on besichtigung.sessions so the policy subquery can execute
GRANT USAGE ON SCHEMA besichtigung TO authenticated;
GRANT SELECT ON besichtigung.sessions TO authenticated;
