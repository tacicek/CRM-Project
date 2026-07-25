-- =============================================================================
-- inbound_emails.opened_at — "hat das schon jemand angeschaut?"
--
-- Der E-Mail-Eingang ist ein GEMEINSAMES Postfach: öffnet eine Person eine Mail,
-- ist sie für das ganze Team nicht mehr neu. Im Browser (localStorage) gespeichert
-- würde jede Person ihren eigenen Ungelesen-Stand sehen — genau das, was ein
-- geteiltes Postfach nicht sein darf.
--
-- Bewusst ein Zeitstempel und kein boolean: "wann zuletzt angeschaut" beantwortet
-- später auch "liegt hier etwas seit Tagen unbearbeitet?", ohne erneutes DDL.
-- =============================================================================

BEGIN;

ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.inbound_emails.opened_at IS
  'Wann die Mail zum ersten Mal in der Review-Oberfläche geöffnet wurde. '
  'NULL = von niemandem angeschaut.';

-- Zähler je Tab: (company_id, processing_status) gibt es schon; dieser Index
-- bedient zusätzlich die Frage "davon ungelesen".
CREATE INDEX IF NOT EXISTS idx_inbound_emails_unopened
  ON public.inbound_emails (company_id, processing_status)
  WHERE opened_at IS NULL;

COMMIT;
