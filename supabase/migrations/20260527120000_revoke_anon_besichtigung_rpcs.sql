-- Güvenlik: Besichtigung write RPC'lerinden anon erişimini kaldır
-- Bu fonksiyonlar sadece service_role veya authenticated kullanıcılar tarafından
-- edge function üzerinden çağrılmalıdır.
-- Okuma fonksiyonu (get_besichtigung_photos) da token doğrulaması gerektirdiğinden
-- anon erişimini kaldırıyoruz — sadece upload-besichtigung-photo edge fn kullanır.

REVOKE EXECUTE ON FUNCTION public.insert_besichtigung_photo(uuid, text, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_besichtigung_session_status(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_besichtigung_photo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_besichtigung_photos(uuid) FROM anon;

-- Sadece authenticated ve service_role kullansın
GRANT EXECUTE ON FUNCTION public.insert_besichtigung_photo(uuid, text, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_besichtigung_session_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_besichtigung_photo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_besichtigung_photos(uuid) TO service_role;
