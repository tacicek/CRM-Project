-- =============================================================================
-- ROLLBACK zu 20260809120000_funktionsrechte_zweite_welle.sql
-- =============================================================================
--
-- Stellt den Rechtestand wieder her, den die Migration in
-- public.undo_20260809120000 festgehalten hat — und NUR den. Ohne die Tabelle
-- gibt es nichts wiederherzustellen; dann bricht diese Datei ab, statt zu raten.
--
-- EINE ASYMMETRIE, ausdruecklich benannt: festgehalten wurde die WIRKSAME
-- Ausfuehrbarkeit (`has_function_privilege`) plus die Frage, ob ein
-- PUBLIC-Eintrag bestand. Wo `anon` sein Recht nur ueber PUBLIC geerbt hatte,
-- gibt dieser Rollback PUBLIC zurueck und `anon` nicht zusaetzlich einzeln —
-- wirksam ist das derselbe Zustand, in der ACL steht danach aber nicht
-- zwingend derselbe Text. Wer Text-Gleichheit braucht, nimmt den
-- Rechte-Schnappschuss aus supabase-test/baseline/function-grants.sql.
--
-- `service_role` kommt hier nicht vor: die Migration hat es nicht angefasst.
-- =============================================================================

BEGIN;

DO $rollback$
DECLARE
  z      record;
  fehlt  integer;
BEGIN
  IF to_regclass('public.undo_20260809120000') IS NULL THEN
    RAISE EXCEPTION 'public.undo_20260809120000 fehlt — 20260809120000 lief hier nie, es gibt nichts zurueckzunehmen';
  END IF;

  FOR z IN SELECT * FROM public.undo_20260809120000 LOOP
    -- Eine Funktion kann seit der Aufnahme entfallen sein. Das ist kein
    -- Fehler, aber es wird nicht stillschweigend uebergangen.
    IF to_regprocedure(z.func_signature) IS NULL THEN
      RAISE NOTICE 'uebersprungen (Funktion existiert nicht mehr): %', z.func_signature;
      CONTINUE;
    END IF;

    IF z.hatte_public THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', z.func_signature);
    ELSE
      IF z.hatte_anon THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', z.func_signature);
      END IF;
      IF z.hatte_auth THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', z.func_signature);
      END IF;
    END IF;
  END LOOP;

  -- Pruefen statt behaupten: nach dem Lauf muss jede festgehaltene Zeile
  -- wieder ihre wirksame Ausfuehrbarkeit haben.
  SELECT count(*) INTO fehlt
  FROM public.undo_20260809120000 u
  WHERE to_regprocedure(u.func_signature) IS NOT NULL
    AND ( (u.hatte_anon AND NOT has_function_privilege('anon', u.func_signature::regprocedure, 'EXECUTE'))
       OR (u.hatte_auth AND NOT has_function_privilege('authenticated', u.func_signature::regprocedure, 'EXECUTE')) );
  IF fehlt > 0 THEN
    RAISE EXCEPTION 'Rollback unvollstaendig: % Signatur(en) haben ihr Recht nicht zurueck', fehlt;
  END IF;
END
$rollback$;

DROP TABLE public.undo_20260809120000;

COMMIT;
