-- =============================================================================
-- customer_id auf den sieben Vorgangstabellen
-- =============================================================================
--
-- BEFUND
-- `customers` steht (20260728100000), aber nichts zeigt darauf. Ohne diese
-- Spalten laesst sich die Frage "was hat dieser Kunde bei uns" nicht stellen.
--
-- ABHILFE — zusammengesetzter Fremdschluessel, kein einfacher
-- Ein `REFERENCES customers(id)` wuerde die Mandantentrennung NICHT halten:
-- die INSERT-Policy prueft `is_company_member(company_id)` der eigenen Zeile,
-- sie sieht nicht, zu welcher Firma die eingetragene customer_id gehoert.
-- Firma A koennte den Kunden von Firma B in ihren Auftrag schreiben und ihn
-- damit ueber die Kundenkarte auslesen.
--
--     FOREIGN KEY (customer_id, company_id) REFERENCES customers (id, company_id)
--
-- Der Schluessel traegt die Firma mit. Sieben Constraints statt sieben Trigger,
-- ohne Laufzeitkosten.
--
-- ON DELETE SET NULL (customer_id) — spaltengenau, seit PG 15 moeglich (diese
-- Installation laeuft 15.8). Nur customer_id wird geleert, company_id (NOT NULL)
-- bleibt stehen. CASCADE waere falsch: das Loeschen eines Kunden wuerde seine
-- Rechnungen mitnehmen, also genau das, was 20260727130000 verbietet. RESTRICT
-- waere ebenfalls falsch: ein Kunde muss loeschbar bleiben.
--
-- ⚠️ leads.company_id ist NULLABLE (heute 1 Zeile ohne Firma). Ein
-- zusammengesetzter Fremdschluessel prueft mit MATCH SIMPLE gar nicht, sobald
-- eine Spalte NULL ist — fuer diese eine Zeile greift die Absicherung also
-- nicht. Sie ist ohnehin in keiner firmenbezogenen Abfrage sichtbar und steht im
-- Dry-Run-Bericht mit ID. leads.company_id auf NOT NULL zu ziehen ist eine
-- eigene Aufgabe (die Zeile muesste erst zugeordnet oder entfernt werden).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Spalten
-- -----------------------------------------------------------------------------

ALTER TABLE public.leads          ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.offers         ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.auftraege      ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.appointments   ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.rechnungen     ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.quittungen     ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS customer_id UUID;

COMMENT ON COLUMN public.leads.customer_id IS
  'Kanonischer Kunde. Wird beim INSERT per Trigger gesetzt; die customer_*-Felder '
  'daneben bleiben der Stand zum Zeitpunkt der Anfrage.';
COMMENT ON COLUMN public.offers.customer_id IS
  'Kanonischer Kunde, vom Lead geerbt. Die eingefrorenen customer_*- und '
  'frozen_*-Felder bleiben unberuehrt.';
COMMENT ON COLUMN public.auftraege.customer_id IS      'Kanonischer Kunde, von der Offerte geerbt.';
COMMENT ON COLUMN public.appointments.customer_id IS   'Kanonischer Kunde, vom Auftrag bzw. Lead geerbt.';
COMMENT ON COLUMN public.rechnungen.customer_id IS     'Kanonischer Kunde, vom Auftrag geerbt.';
COMMENT ON COLUMN public.quittungen.customer_id IS     'Kanonischer Kunde, vom Auftrag geerbt.';
COMMENT ON COLUMN public.inbound_emails.customer_id IS
  'Kanonischer Kunde — NUR gesetzt, wenn die Absenderadresse einen BESTEHENDEN '
  'Kunden trifft. Aus einer eingehenden Mail entsteht nie ein Kunde, sonst legte '
  'jede Werbemail einen an.';

-- -----------------------------------------------------------------------------
-- 2. Fremdschluessel
-- -----------------------------------------------------------------------------

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_customer_fk,
  ADD  CONSTRAINT leads_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_customer_fk,
  ADD  CONSTRAINT offers_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.auftraege
  DROP CONSTRAINT IF EXISTS auftraege_customer_fk,
  ADD  CONSTRAINT auftraege_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_customer_fk,
  ADD  CONSTRAINT appointments_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.rechnungen
  DROP CONSTRAINT IF EXISTS rechnungen_customer_fk,
  ADD  CONSTRAINT rechnungen_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.quittungen
  DROP CONSTRAINT IF EXISTS quittungen_customer_fk,
  ADD  CONSTRAINT quittungen_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

ALTER TABLE public.inbound_emails
  DROP CONSTRAINT IF EXISTS inbound_emails_customer_fk,
  ADD  CONSTRAINT inbound_emails_customer_fk
       FOREIGN KEY (customer_id, company_id)
       REFERENCES public.customers (id, company_id)
       ON DELETE SET NULL (customer_id);

-- -----------------------------------------------------------------------------
-- 3. Indizes
--
-- Sortierspalte ist jeweils die, nach der customer_timeline() ordnet — nicht
-- ueberall created_at: ein Termin kann in der Zukunft liegen, eine Rechnung
-- traegt ihr eigenes Belegdatum. company_id gehoert nicht in den Index: die
-- customer_id ist durch den zusammengesetzten Fremdschluessel bereits an genau
-- eine Firma gebunden.
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_leads_customer
  ON public.leads (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offers_customer
  ON public.offers (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auftraege_customer
  ON public.auftraege (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_customer
  ON public.appointments (customer_id, appointment_date DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rechnungen_customer
  ON public.rechnungen (customer_id, datum DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quittungen_customer
  ON public.quittungen (customer_id, datum DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_emails_customer
  ON public.inbound_emails (customer_id, received_at DESC)
  WHERE customer_id IS NOT NULL;

-- Keine Aenderung an RLS: customer_id ist eine Spalte auf Zeilen, die von den
-- bestehenden Policies bereits abgedeckt sind.

COMMIT;
