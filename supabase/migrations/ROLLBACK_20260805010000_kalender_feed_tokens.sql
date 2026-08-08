-- Rollback zu 20260805010000_kalender_feed_tokens.sql
--
-- Entfernt Token-Erzeugung und Token-Tabelle vollstaendig. Folge: JEDES
-- bestehende Kalender-Abo antwortet ab sofort mit 404 — die Feeds sind tot,
-- nicht nur pausiert. Die Edge Function `calendar-feed` selbst bleibt liegen
-- und ist ohne Tabelle harmlos (jeder Lookup scheitert).

BEGIN;

DROP FUNCTION IF EXISTS public.create_calendar_feed_token(text);
DROP TABLE IF EXISTS public.calendar_feed_tokens;

COMMIT;
