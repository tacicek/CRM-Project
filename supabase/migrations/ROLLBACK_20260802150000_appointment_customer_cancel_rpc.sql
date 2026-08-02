-- Rollback zu 20260802150000_appointment_customer_cancel_rpc.sql
--
-- ── Was das hier zuruecknimmt ──────────────────────────────────────────────
--
-- Genau eines: die Funktion
-- `public.cancel_appointment_by_action_token(uuid, uuid, text)`.
--
-- Sonst nichts. Diese Migration hat keine Spalte, keinen Index, keinen Trigger
-- und keine Zeile angelegt; entsprechend gibt es auch nichts weiter
-- abzuraeumen. Insbesondere bleibt alles aus B.2.1 unberuehrt — Token-Spalte,
-- Ablaufdatum, Index, Vorschau-Funktion und die Haertung von
-- `log_appointment_changes()`.
--
-- ── Was ausdruecklich NICHT rueckgaengig gemacht wird ──────────────────────
--
-- Absagen, die diese Funktion bereits ausgefuehrt hat, bleiben Absagen.
--
-- Termine, die auf `cancelled` stehen, behalten `status`, `cancelled_at`,
-- `cancelled_by = 'customer'` und `cancellation_reason`. Auftraege, die der
-- Trigger `trg_sync_appointment_cancel_to_auftrag` daraufhin auf `storniert`
-- gesetzt hat, bleiben `storniert`. Die zugehoerigen Zeilen in
-- `appointment_history` bleiben stehen.
--
-- Das ist kein Versehen. Eine Absage ist eine Willenserklaerung des Kunden und
-- ein Geschaeftsvorgang, kein Nebenprodukt dieser Funktion — moeglicherweise
-- wurde daraufhin ein Termin neu vergeben, ein Mitarbeiter umgeplant oder eine
-- Rechnung storniert. Wer eine einzelne Absage zuruecknehmen will, tut das
-- fachlich im Dashboard und nicht, indem er eine Migration zurueckdreht.
--
-- Praktische Folge: nach diesem Rollback laesst sich ueber den Kundenlink nicht
-- mehr absagen (es gibt keinen Aufrufer mehr), aber der Bestand bleibt so, wie
-- die Kunden ihn hinterlassen haben.
--
-- Wiederholbar: die Anweisung ist mit IF EXISTS formuliert, ein zweiter Lauf
-- ist ein No-op.

BEGIN;

DROP FUNCTION IF EXISTS public.cancel_appointment_by_action_token(uuid, uuid, text);

-- Nachpruefung: die Funktion darf in KEINER Signatur mehr existieren. Geprueft
-- wird ueber den Namen, nicht ueber die eine Signatur oben — sonst bliebe eine
-- versehentlich angelegte Ueberladung unbemerkt stehen und waere weiterhin
-- fuer service_role aufrufbar.
DO $$
DECLARE
  v_anzahl integer;
BEGIN
  SELECT count(*) INTO v_anzahl
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'cancel_appointment_by_action_token';
  IF v_anzahl <> 0 THEN
    RAISE EXCEPTION 'Rollback: cancel_appointment_by_action_token ist noch da (% Signatur(en))', v_anzahl;
  END IF;

  RAISE NOTICE 'Rollback 20260802150000: Absage-Funktion entfernt, bereits '
               'erfolgte Absagen bleiben bestehen.';
END
$$;

COMMIT;
