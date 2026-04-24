-- =============================================================================
-- Make besichtigung-uploads bucket public for read access
-- =============================================================================
-- Photos are temporary (deleted 3 days after offer sent / 30 days max).
-- Paths contain unguessable random tokens: {token}/{room}/{timestamp}_{file}
-- Making bucket public avoids cross-schema RLS issues with signed URLs.
-- Write/delete access is still controlled by RLS policies.
-- =============================================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'besichtigung-uploads';
