-- =============================================================================
-- E-Mail-Protokoll: Mitgliedersicht, und die herrenlosen Zeilen
-- =============================================================================
--
-- BEFUND
--
-- 1. `email_logs` traegt genau eine Policy: `Admins can view all email logs`
--    (`is_admin(auth.uid())`). Eine Mitgliederregel fehlt. Auf der Produktion
--    gemessen: die zweite Firma besitzt 37 Zeilen und sieht davon 0. Die erste
--    sieht alle 214 — aber nur, weil ihr Konto `super_admin` in `user_roles`
--    traegt. Die Sichtbarkeit haengt damit an einer Rolle statt an der
--    Mitgliedschaft, und zwar an einer Rolle, die es nur noch aus dem
--    Offerio-Erbe gibt. Zwei Bildschirme lesen die Tabelle:
--    OfferteDetail.tsx (E-Mail-Verlauf je Offerte) und Offerten.tsx
--    (Versandstatus in der Liste — dort steht der Firmenfilter im Code bereits,
--    es fehlt allein die Regel in der Datenbank).
--
-- 2. Sechs Zeilen in `email_logs` haben `company_id IS NULL`. Alle sechs sind
--    Quittungs-Mails: drei Belege, je eine Kunden- und eine Firmenkopie.
--    `send-quittung` hat das Feld bis b3391ba6 (2026-07-03) nicht
--    mitgeschrieben. Die Zeile vom 2026-07-15 faellt in die Luecke zwischen
--    Commit und Auslieferung — ausgeliefert wurde die Funktion erst am
--    2026-07-27. Die Datei auf dem Server traegt das Feld heute; ein laufender
--    Fehler ist das keiner mehr, nur Rueckstand.
--
-- 3. Ein Lead ohne `company_id`: ANF-2026-712782 vom 2026-05-15 08:57. Drei
--    Minuten spaeter steht derselbe Kunde ein zweites Mal in der Tabelle,
--    diesmal mit Firma (ANF-2026-981117). Am selben Tag bekam `leads` die
--    Spalte `company_id` und `import-manual-lead` seine Korrektur — die erste
--    Zeile ist der gescheiterte Versuch, die zweite der gelungene.
--
-- ABHILFE
--
-- Die Policy allein genuegt nicht. `is_company_member(NULL)` ist FALSE, weil
-- `company_id = NULL` keine Zeile trifft: die sechs Mails blieben auch unter
-- der neuen Regel unsichtbar. Regel und Zuordnung gehoeren deshalb in denselben
-- Lauf, sonst ist die Regel nachweislich unvollstaendig.
--
-- HERGELEITET, NICHT ABGESCHRIEBEN. Keine feste ID im Skript. Die Firma einer
-- Mail kommt ueber `metadata->>'quittung_id'` aus `quittungen`, die Firma des
-- Leads aus seinem eigenen Zwilling. Steht die Datenlage anders als erwartet,
-- greift das Skript ins Leere statt daneben — und der Pruefblock am Ende laesst
-- die Transaktion dann scheitern, statt einen halben Zustand zu hinterlassen.
--
-- NICHT HIER: die `super_admin`-Zeile. Ein Rechteentzug gehoert nicht in
-- dieselbe Datei wie eine Datenkorrektur. Er kommt eigens, danach — und erst,
-- wenn diese Migration liegt, weil sonst die erste Firma ihre eigenen 171
-- Zeilen mitverliert.
--
-- NICHT HIER: das Loeschen des doppelten Leads. Diese Migration ordnet ihn nur
-- zu; die Bereinigung ist ein eigener Vorgang.
--
-- WIEDERHOLBAR. Jede Anweisung sucht `company_id IS NULL`. Ein zweiter Lauf
-- findet nichts mehr und tut nichts.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Rueckbau-Speicher
--
-- Ein UPDATE ist nur dann umkehrbar, wenn der Vorzustand irgendwo steht. Ohne
-- diese Tabelle muesste das ROLLBACK-Skript die betroffenen Zeilen erneut
-- erraten — und traefe nach dem naechsten Quittungsversand die falschen.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.undo_20260802110000 (
  table_name     TEXT        NOT NULL,
  row_id         UUID        NOT NULL,
  old_company_id UUID,
  noted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);

COMMENT ON TABLE public.undo_20260802110000 IS
  'Vorzustand der von 20260802110000 geaenderten Zeilen. Das zugehoerige ROLLBACK-Skript liest hier und entfernt die Tabelle danach.';

-- Bewusst mit RLS und ohne Policy: erreichbar nur fuer service_role und
-- postgres (BYPASSRLS), wie bei company_secrets und den Nummernkreisen.
ALTER TABLE public.undo_20260802110000 ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. Mitgliedersicht auf das E-Mail-Protokoll
--
-- Die Admin-Policy bleibt unberuehrt. Sie faellt mit der `super_admin`-Zeile
-- ohnehin in sich zusammen; sie hier mitzuentfernen wuerde zwei Vorgaenge
-- vermischen.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS email_logs_select_member ON public.email_logs;

CREATE POLICY email_logs_select_member
  ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

-- -----------------------------------------------------------------------------
-- 2. Quittungs-Mails ihrer Firma zuordnen
--
-- Der Weg ist `metadata->>'quittung_id'` -> `quittungen.company_id`. Verglichen
-- wird als Text, nicht ueber einen Cast nach UUID: ein unerwarteter Wert im
-- JSON soll die Migration nicht mit einem Typfehler abbrechen, sondern
-- schlicht nicht getroffen werden. Der Pruefblock am Ende meldet ihn dann.
-- -----------------------------------------------------------------------------
INSERT INTO public.undo_20260802110000 (table_name, row_id, old_company_id)
SELECT 'email_logs', e.id, e.company_id
FROM public.email_logs e
JOIN public.quittungen q ON q.id::TEXT = e.metadata->>'quittung_id'
WHERE e.company_id IS NULL
  AND e.metadata ? 'quittung_id'
ON CONFLICT (table_name, row_id) DO NOTHING;

UPDATE public.email_logs AS e
SET company_id = q.company_id
FROM public.quittungen AS q
WHERE e.company_id IS NULL
  AND e.metadata ? 'quittung_id'
  AND q.id::TEXT = e.metadata->>'quittung_id';

-- -----------------------------------------------------------------------------
-- 3. Den herrenlosen Lead seiner Firma zuordnen
--
-- Die Firma kommt aus dem Zwilling: derselbe Kunde, derselbe Tag, andere Zeile,
-- Firma gesetzt. `DISTINCT` in einer skalaren Unterabfrage ist hier Absicht —
-- gaebe es zwei verschiedene Firmen, bricht Postgres mit "more than one row
-- returned by a subquery" ab, statt eine davon zu waehlen.
-- -----------------------------------------------------------------------------
INSERT INTO public.undo_20260802110000 (table_name, row_id, old_company_id)
SELECT 'leads', l.id, l.company_id
FROM public.leads l
WHERE l.slug = 'ANF-2026-712782'
  AND l.company_id IS NULL
ON CONFLICT (table_name, row_id) DO NOTHING;

UPDATE public.leads AS herrenlos
SET company_id = (
      SELECT DISTINCT zwilling.company_id
      FROM public.leads AS zwilling
      WHERE zwilling.customer_email  = herrenlos.customer_email
        AND zwilling.created_at::DATE = herrenlos.created_at::DATE
        AND zwilling.company_id IS NOT NULL
        AND zwilling.id <> herrenlos.id
    )
WHERE herrenlos.slug = 'ANF-2026-712782'
  AND herrenlos.company_id IS NULL;

-- -----------------------------------------------------------------------------
-- 4. Nachweis
--
-- Kein "vermutlich gelaufen". Trifft eine der drei Bedingungen nicht zu, faellt
-- die ganze Transaktion — ein halb zugeordneter Bestand waere schlimmer als
-- gar keiner, weil er wie ein fertiger aussieht.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  offene_mails INTEGER;
BEGIN
  SELECT count(*) INTO offene_mails
  FROM public.email_logs
  WHERE company_id IS NULL
    AND metadata ? 'quittung_id';

  IF offene_mails > 0 THEN
    RAISE EXCEPTION
      'Nach dem Lauf tragen noch % Quittungs-Mails keine Firma. Vermutlich zeigt metadata->>''quittung_id'' auf einen geloeschten Beleg.',
      offene_mails;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leads
    WHERE slug = 'ANF-2026-712782' AND company_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Lead ANF-2026-712782 traegt weiterhin keine Firma — der Zwilling (gleiche E-Mail, gleicher Tag, Firma gesetzt) wurde nicht gefunden.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.email_logs'::REGCLASS
      AND polname  = 'email_logs_select_member'
  ) THEN
    RAISE EXCEPTION 'Policy email_logs_select_member fehlt.';
  END IF;
END $$;

COMMIT;
