-- =============================================================================
-- companies: is_admin bildet keine firmenuebergreifende Ausnahme mehr
-- =============================================================================
--
-- BEFUND M01-01 (gemessen 2026-08-28)
--
-- `public.companies` traegt vier Policies, die einem globalen „Admin" SELECT,
-- INSERT, UPDATE und DELETE auf JEDE Firma geben:
--
--     Admins can view   all companies  [SELECT] USING is_admin(auth.uid())
--     Admins can update all companies  [UPDATE] USING is_admin(auth.uid())
--     Admins can insert     companies  [INSERT] WITH CHECK is_admin(auth.uid())
--     Admins can delete     companies  [DELETE] USING is_admin(auth.uid())
--
--     is_admin(u) := EXISTS (SELECT 1 FROM user_roles
--                             WHERE user_id = u
--                               AND role IN ('super_admin','admin','moderator'))
--
-- `is_admin` fragt NICHT, zu welcher Firma jemand gehoert. Wer drinsteht, sieht
-- und aendert jede Firma — Adresse, IBAN, Absenderidentitaet. Zusaetzlich zaehlt
-- `moderator` dort wie `super_admin`, waehrend dieselbe Rolle in
-- `src/lib/adminPermissions.ts` die SCHWAECHSTE ist. Zwei Rollenmodelle, ein
-- Name, verschiedene Bedeutung.
--
-- Gemessen: `user_roles` hat NULL Zeilen. Heute also wirkungslos — und genau
-- eine Zeile davon entfernt, es nicht mehr zu sein.
--
-- ENTSCHEIDUNG DEC-002 (Betreiber, 2026-08-28)
--
-- Die vier mandantenlosen Policies werden entfernt. Policy-basierter Zugriff laeuft danach
-- ausschliesslich ueber `company_members`, die Rollen owner/admin und den
-- aktiven Mandanten. `is_admin` selbst bleibt bestehen — sie hat andere,
-- gepruefte Aufrufer.
--
-- DIE FUENFTE STELLE, DIE DAZUGEHOERT
--
-- `companies_select_member` traegt `(is_company_member(id) OR is_admin(auth.uid()))`.
-- Nur die vier benannten Policies zu entfernen liesse damit einen
-- firmenuebergreifenden SELECT-Weg auf `companies` offen — die Entscheidung
-- waere nicht umgesetzt. Die Policy wird deshalb ohne den `is_admin`-Zweig neu
-- angelegt. Der Mitgliedschaftszweig bleibt woertlich, wie er ist.
--
-- WAS HIER AUSDRUECKLICH NICHT PASSIERT
--
--   · `is_admin` wird nicht geloescht und nicht umdefiniert.
--   · Die 55 uebrigen Policies auf 46 anderen Tabellen, die `is_admin`
--     benutzen, bleiben UNBERUEHRT. Sie sind ein eigener, groesserer Befund
--     (M01-02) und brauchen eine eigene Entscheidung — hier waere ihr
--     Mitnehmen ein Eingriff ohne Auftrag.
--   · `guard_company_ownership()` bleibt unberuehrt. Der Trigger auf
--     `companies` benutzt `is_admin`, um einen EIGENTUEMERWECHSEL zu erlauben;
--     das ist eine andere Frage als der mandantenlose Lesezugriff, und der
--     Trigger sperrt, statt zu oeffnen.
--
-- Ein spaeter tatsaechlich benoetigter plattformweiter Support-Zugang wird als
-- NEUE, getrennte und auditierte Funktion entworfen: lesend als Vorgabe,
-- ausdrueckliche Mandantenwahl, Begruendung, Zeitbegrenzung, vollstaendiges
-- Audit-Log. Keine Wiederverwendung dieser Policies.
--
-- WIEDERHOLBAR. `DROP POLICY IF EXISTS` ist beim zweiten Lauf ein No-op.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Admins can view all companies"   ON public.companies;
DROP POLICY IF EXISTS "Admins can update all companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can insert companies"     ON public.companies;
DROP POLICY IF EXISTS "Admins can delete companies"     ON public.companies;

-- Der Mitgliedschaftszweig bleibt woertlich; nur die Ausnahme faellt.
DROP POLICY IF EXISTS companies_select_member ON public.companies;
CREATE POLICY companies_select_member ON public.companies
  FOR SELECT TO authenticated
  USING (is_company_member(id));

-- ── Nachweis ────────────────────────────────────────────────────────────────

DO $pruefung$
DECLARE
  v_rest int;
  v_mitglied int;
BEGIN
  -- 1. Auf `companies` darf keine Policy mehr `is_admin` nennen.
  SELECT count(*) INTO v_rest
    FROM pg_policy
   WHERE polrelid = 'public.companies'::regclass
     AND (coalesce(pg_get_expr(polqual, polrelid), '')
            ~* '\m(is_admin|is_super_admin|is_staff|has_role)\M'
       OR coalesce(pg_get_expr(polwithcheck, polrelid), '')
            ~* '\m(is_admin|is_super_admin|is_staff|has_role)\M');
  IF v_rest > 0 THEN
    RAISE EXCEPTION 'auf companies nennen noch % Policies eine mandantenlose Rollenpruefung', v_rest;
  END IF;
  -- Absichtlich breiter als `is_admin`: eine spaetere Policy mit
  -- `has_role(auth.uid(),''admin'')` oder `is_super_admin()` reisst dieselbe
  -- Luecke auf und wuerde eine Pruefung auf den blossen Namen `is_admin`
  -- klaglos passieren.

  -- 2. Der Mitgliedschaftsweg muss WEITERHIN existieren. Ohne ihn saehe
  --    niemand mehr seine eigene Firma — das waere kein Fortschritt, sondern
  --    ein Ausfall.
  SELECT count(*) INTO v_mitglied
    FROM pg_policy
   WHERE polrelid = 'public.companies'::regclass
     AND polcmd = 'r'
     AND coalesce(pg_get_expr(polqual, polrelid), '') ILIKE '%is_company_member%';
  IF v_mitglied = 0 THEN
    RAISE EXCEPTION 'es gibt keinen Mitgliedschafts-Leseweg mehr auf companies';
  END IF;

  -- Zu 3 und 4: beide pruefen Objekte, die diese Migration NICHT anfasst. Sie
  -- koennen durch nichts in dieser Datei rot werden und sind deshalb
  -- Vorbedingungen, kein Wirkungsnachweis. Sie stehen hier, damit ein Lauf gegen
  -- eine fremde Umgebung auffaellt — nicht als Beleg fuer die Aenderung.
  --
  -- 3. `is_admin` existiert weiterhin — sie wurde nicht geloescht.
  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_admin ist verschwunden — diese Migration darf sie nicht entfernen';
  END IF;

  -- 4. Der Eigentuemer-Trigger bleibt.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                  WHERE t.tgrelid = 'public.companies'::regclass
                    AND t.tgname = 'trigger_companies_guard_ownership'
                    AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'der Eigentuemer-Trigger auf companies fehlt';
  END IF;
END
$pruefung$;

COMMIT;
