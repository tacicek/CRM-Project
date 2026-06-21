-- ============================================================
-- Tighten besichtigung-uploads bucket: 50MB → 10MB, sadece görsel.
-- Edge fn (upload-besichtigung-photo) zaten 10MB + JPEG/PNG/WebP/HEIC enforce ediyor;
-- bu, depolama katmanında defense-in-depth backstop.
-- NOT: Bucket id 'besichtigung-uploads' (storage.buckets + edge fn ile birebir).
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit = 10485760, -- 10MB (52428800'den düşürüldü)
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'besichtigung-uploads';

-- Video tipleri (mp4/quicktime/webm) kaldırıldı — AI yalnız görsel analiz ediyor.
