-- ============================================================
-- document-pdfs bucket (PRIVAT) — E-Mail-Anhänge (Rechnung-PDF; später Offer/Quittung).
-- Grund: PDF wurde bisher als base64 im Request-Body an die Edge Function gesendet.
-- Die self-hosted edge-runtime bricht große Bodies intermittierend ab
-- ("user body write aborted" / "connection closed before message completed" → 502).
-- Neu: Client lädt das PDF in Storage hoch (kleiner Request-Body, nur rechnungId),
-- die Edge Function lädt es per service_role herunter, hängt es an und löscht es danach.
--
-- Pfad-Schema: {company_id}/rechnung/{rechnung_id}.pdf
--   → (storage.foldername(name))[1] = company_id  (RLS-Scope pro Firma)
-- PRIVAT: keine public URL (Rechnungs-PDF). Lesen nur via service_role in der Funktion.
-- Aufräumen: Datei wird nach dem Versand in der Funktion entfernt (ephemer).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-pdfs', 'document-pdfs', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- KEINE authenticated-Policy für Client-Uploads:
-- Der self-hosted storage-Dienst führt Upload-INSERTs nicht als Rolle 'authenticated' aus
-- (er läuft als supabase_storage_admin; Supabase-Rollen sind NOINHERIT, daher greifen
-- "TO authenticated"-Policies nicht → "new row violates RLS"). Belegt: ein INSERT mit
-- explizitem SET ROLE authenticated gelingt, der echte Upload (selbst mit reiner
-- bucket_id-Policy) bekommt 403.
-- Lösung: Der Client lädt NICHT direkt hoch. Die Edge Function (service_role, umgeht RLS)
-- erstellt eine signierte Upload-URL; der Client lädt per uploadToSignedUrl hoch (token-
-- autorisiert, keine RLS). Daher genügt unten die service_role-Policy.

-- service_role: voller Zugriff (Download + Delete in der Edge Function).
-- (service_role umgeht RLS i.d.R.; explizite Policy = Konsistenz mit besichtigung-Pattern.)
CREATE POLICY "document_pdfs_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'document-pdfs')
WITH CHECK (bucket_id = 'document-pdfs');
