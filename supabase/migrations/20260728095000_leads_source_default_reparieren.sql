-- =============================================================================
-- leads.source: Standardwert verletzt die eigene Pruefregel
-- =============================================================================
--
-- BEFUND
-- Die Spalte hat den Standardwert 'website':
--
--     ALTER TABLE leads ALTER COLUMN source SET DEFAULT 'website';
--
-- Die Pruefregel daneben laesst genau diesen Wert NICHT zu:
--
--     CHECK (source IN ('web_form','ai_voice','manual','import','widget','api','email'))
--
-- Damit scheitert jedes INSERT in `leads`, das `source` nicht ausdruecklich
-- setzt — mit 23514 und einer Fehlermeldung, in der der Wert steht, den
-- niemand geschrieben hat.
--
-- Warum das bisher niemandem auffiel: alle drei aktiven Wege setzen den Wert
-- selbst. inbound-email-lead schreibt 'email', import-manual-lead schreibt
-- 'import' (im Bestand: 64x import, 4x email, sonst nichts). Der Standardwert
-- wurde also noch nie benutzt — er wartet auf den naechsten Aufrufer, der ihn
-- weglaesst.
--
-- ABHILFE
-- Der Standardwert wird auf 'web_form' gezogen, den Begriff, den die Pruefregel
-- fuer dieselbe Sache vorsieht. BEWUSST NICHT umgekehrt: 'website' in die
-- Pruefregel aufzunehmen wuerde zwei Namen fuer eine Herkunft schaffen und
-- Auswertungen nach Herkunft dauerhaft aufspalten.
--
-- Kein Datenumbau noetig: keine einzige Zeile traegt 'website'.
-- =============================================================================

BEGIN;

ALTER TABLE public.leads ALTER COLUMN source SET DEFAULT 'web_form';

COMMENT ON COLUMN public.leads.source IS
  'Herkunft der Anfrage. Wertebereich siehe leads_source_check. Der Standardwert '
  'lautet web_form; bis 2026-07-28 stand hier website, was die Pruefregel ablehnte '
  'und jedes INSERT ohne ausdruecklichen Wert scheitern liess.';

COMMIT;
