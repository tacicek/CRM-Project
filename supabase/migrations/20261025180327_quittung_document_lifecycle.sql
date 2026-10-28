-- Quittung: immutable issued content, independent delivery/payment state, and an
-- explicit invoice link. No invoice synchronization creates another payment.
BEGIN;

CREATE SCHEMA IF NOT EXISTS quittung_private;
REVOKE ALL ON SCHEMA quittung_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA quittung_private TO authenticated,service_role;

ALTER TABLE public.quittungen
  ADD COLUMN IF NOT EXISTS rechnung_id uuid,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_open_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.quittungen ALTER COLUMN datum SET DEFAULT ((now() AT TIME ZONE 'Europe/Zurich')::date);
ALTER TABLE public.quittungen DROP CONSTRAINT IF EXISTS quittungen_status_check;
ALTER TABLE public.quittungen ADD CONSTRAINT quittungen_status_check
  CHECK (status IN ('draft','issued','signed','sent','paid'));
ALTER TABLE public.quittungen DROP CONSTRAINT IF EXISTS quittungen_payment_status_check;
ALTER TABLE public.quittungen ADD CONSTRAINT quittungen_payment_status_check
  CHECK (payment_status IN ('open','partial','paid'));
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.quittungen'::regclass AND conname='quittungen_id_company_unique') THEN
    ALTER TABLE public.quittungen ADD CONSTRAINT quittungen_id_company_unique UNIQUE(id,company_id);
  END IF;
END $$;
ALTER TABLE public.quittungen DROP CONSTRAINT IF EXISTS quittungen_rechnung_fk;
ALTER TABLE public.quittungen ADD CONSTRAINT quittungen_rechnung_fk
  FOREIGN KEY(rechnung_id,company_id) REFERENCES public.rechnungen(id,company_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_quittungen_rechnung ON public.quittungen(rechnung_id) WHERE rechnung_id IS NOT NULL;
COMMENT ON COLUMN public.quittungen.version IS
  'Content/payment rendering revision. Sending and internal notes do not change this version.';
COMMENT ON COLUMN public.quittungen.issued_at IS
  'Time this system froze the document; a legacy record is captured now, not backdated.';

-- Counters reserve numbers independently of receipt deletion and serialize inserts.
CREATE TABLE IF NOT EXISTS public.quittung_nr_counter (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  jahr integer NOT NULL,
  letzte_nr bigint NOT NULL CHECK(letzte_nr >= 0),
  PRIMARY KEY(company_id,jahr)
);
ALTER TABLE public.quittung_nr_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quittung_nr_counter FROM PUBLIC, anon, authenticated;
INSERT INTO public.quittung_nr_counter(company_id,jahr,letzte_nr)
SELECT company_id, split_part(quittung_nr,'-',2)::integer,
       max(split_part(quittung_nr,'-',3)::bigint)
FROM public.quittungen WHERE quittung_nr ~ '^QU-[0-9]{4}-[0-9]+$'
GROUP BY company_id,split_part(quittung_nr,'-',2)::integer
ON CONFLICT(company_id,jahr) DO UPDATE
SET letzte_nr=greatest(public.quittung_nr_counter.letzte_nr,excluded.letzte_nr);
CREATE OR REPLACE FUNCTION public.generate_quittung_nr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n bigint; y integer := extract(year FROM now() AT TIME ZONE 'Europe/Zurich')::integer;
BEGIN
  IF NEW.quittung_nr IS NULL THEN
    INSERT INTO public.quittung_nr_counter(company_id,jahr,letzte_nr)
    VALUES(NEW.company_id,y,1)
    ON CONFLICT(company_id,jahr) DO UPDATE SET letzte_nr=public.quittung_nr_counter.letzte_nr+1
    RETURNING letzte_nr INTO n;
    NEW.quittung_nr := 'QU-'||y||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.generate_quittung_nr() FROM PUBLIC,anon,authenticated;

-- Retain every direct-payment association, including reversed payments. The old
-- payment_id column remains a pointer to the most recent payment for compatibility.
CREATE TABLE IF NOT EXISTS public.quittung_payment_links (
  quittung_id uuid NOT NULL,
  company_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(quittung_id,payment_id),
  UNIQUE(payment_id),
  FOREIGN KEY(quittung_id,company_id) REFERENCES public.quittungen(id,company_id) ON DELETE RESTRICT,
  FOREIGN KEY(payment_id,company_id) REFERENCES public.payments(id,company_id) ON DELETE RESTRICT
);
ALTER TABLE public.quittung_payment_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quittung_payment_links_read ON public.quittung_payment_links;
CREATE POLICY quittung_payment_links_read ON public.quittung_payment_links FOR SELECT TO authenticated
  USING(public.is_company_member(company_id));
REVOKE ALL ON public.quittung_payment_links FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.quittung_payment_links TO authenticated,service_role;
INSERT INTO public.quittung_payment_links(quittung_id,company_id,payment_id)
SELECT id,company_id,payment_id FROM public.quittungen WHERE payment_id IS NOT NULL
ON CONFLICT(quittung_id,payment_id) DO NOTHING;

-- Derived payment values are calculated on the server, never asserted by clients.
DROP FUNCTION IF EXISTS public.quittung_payment_state(public.quittungen);
DROP FUNCTION IF EXISTS quittung_private.payment_state(public.quittungen);
CREATE FUNCTION quittung_private.payment_state(p_q public.quittungen)
RETURNS TABLE(payment_status text,paid_amount numeric,payment_open_amount numeric,payment_date date,payment_method text,payment_reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.rechnungen; n integer; methods integer;
BEGIN
  IF current_setting('role',true) NOT IN ('none','postgres','supabase_admin','service_role') AND NOT public.is_company_member(p_q.company_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Firma.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.quittungen q WHERE q.id=p_q.id AND q.company_id<>p_q.company_id) THEN
    RAISE EXCEPTION 'Quittung gehört nicht zu dieser Firma.' USING ERRCODE='42501';
  END IF;
  IF p_q.rechnung_id IS NOT NULL THEN
    SELECT * INTO r FROM public.rechnungen WHERE id=p_q.rechnung_id AND company_id=p_q.company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung gehört nicht zu dieser Firma.' USING ERRCODE='23503'; END IF;
    payment_status := CASE WHEN r.status='bezahlt' THEN 'paid' WHEN r.paid_total>0 THEN 'partial' ELSE 'open' END;
    paid_amount := greatest(r.paid_total,0);
    payment_open_amount := greatest(r.open_amount,0);
    SELECT count(*),count(DISTINCT p.method),max(p.payment_date),min(p.method),min(p.reference)
    INTO n,methods,payment_date,payment_method,payment_reference
    FROM public.payment_allocations a JOIN public.payments p ON p.id=a.payment_id
    WHERE a.rechnung_id=r.id AND a.amount>0
      AND NOT EXISTS(SELECT 1 FROM public.payments rev WHERE rev.reverses_payment_id=p.id);
  ELSE
    SELECT coalesce(sum(p.amount),0),count(*),count(DISTINCT p.method),max(p.payment_date),min(p.method),min(p.reference)
    INTO paid_amount,n,methods,payment_date,payment_method,payment_reference
    FROM public.quittung_payment_links l JOIN public.payments p ON p.id=l.payment_id
    WHERE l.quittung_id=p_q.id AND l.company_id=p_q.company_id AND p.amount>0
      AND NOT EXISTS(SELECT 1 FROM public.payments rev WHERE rev.reverses_payment_id=p.id);
    payment_status := CASE WHEN paid_amount>0 AND paid_amount>=p_q.gesamttotal THEN 'paid'
                           WHEN paid_amount>0 THEN 'partial' ELSE 'open' END;
  END IF;
  IF p_q.rechnung_id IS NULL THEN payment_open_amount := greatest(p_q.gesamttotal-paid_amount,0); END IF;
  IF methods>1 THEN payment_method := NULL; END IF;
  IF n<>1 THEN payment_reference := NULL; END IF;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION quittung_private.payment_state(public.quittungen) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION quittung_private.payment_state(public.quittungen) TO authenticated,service_role;

DROP FUNCTION IF EXISTS public.quittung_company_snapshot(uuid);
CREATE OR REPLACE FUNCTION quittung_private.company_snapshot(p_company_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('company_name',c.company_name,'email',c.email,
    'notification_email',c.notification_email,'logo_url',c.logo_url,'primary_color',c.primary_color,
    'phone',c.phone,'street',c.street,'plz',c.plz,'city',c.city,'mwst_number',c.mwst_number,
    'iban',c.iban,'bank_name',c.bank_name,'bewertungs_url',c.bewertungs_url,
    'default_language',c.default_language,'captured_at',now())
  FROM public.companies c WHERE c.id=p_company_id
    AND (current_setting('role',true) IN ('none','postgres','supabase_admin','service_role') OR public.is_company_member(c.id));
$$;
REVOKE ALL ON FUNCTION quittung_private.company_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION quittung_private.company_snapshot(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION quittung_private.valid_signature(p_value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE bytes bytea;
BEGIN
  IF p_value IS NULL THEN RETURN true; END IF;
  IF length(p_value)>3000000 OR p_value !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' THEN RETURN false; END IF;
  BEGIN bytes:=decode(split_part(p_value,',',2),'base64');
  EXCEPTION WHEN invalid_parameter_value THEN RETURN false; END;
  RETURN length(bytes)>8 AND substring(bytes FROM 1 FOR 8)=decode('89504e470d0a1a0a','hex');
END $$;
REVOKE ALL ON FUNCTION quittung_private.valid_signature(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION quittung_private.valid_signature(text) TO authenticated,service_role;

-- Replace the old boolean-only payment guard. The lifecycle guard below derives
-- the boolean from the ledger, including invoice payments and reversals.
DROP TRIGGER IF EXISTS trigger_quittungen_bezahlt_buchung ON public.quittungen;
CREATE OR REPLACE FUNCTION public.guard_quittung_status_regression()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.status IN ('issued','signed','sent','paid') AND NEW.status='draft' THEN
    RAISE EXCEPTION 'Ausgestellte Quittungen können nicht in den Entwurf zurückgesetzt werden.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_quittung_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb; sub numeric:=0; active integer:=0; pay record; inv public.rechnungen;
  old_frozen boolean:=false; finalize_now boolean:=false; old_content jsonb; new_content jsonb;
  ignored text[]:=ARRAY['version','updated_at','status','sent_at','pdf_url','notiz','customer_id'];
BEGIN
  IF TG_OP='INSERT' AND NEW.sent_at IS NOT NULL AND current_user IN ('authenticated','anon') THEN
    RAISE EXCEPTION 'Versanddatum wird vom Versanddienst gesetzt.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND current_setting('role',true) IN ('authenticated','anon') THEN
      RAISE EXCEPTION 'Versanddatum wird vom Versanddienst gesetzt.' USING ERRCODE='42501';
    END IF;
    old_frozen := OLD.issued_at IS NOT NULL OR OLD.status<>'draft';
    IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.quittung_nr IS DISTINCT FROM OLD.quittung_nr THEN
      RAISE EXCEPTION 'Firma und Belegnummer einer Quittung sind unveränderlich.' USING ERRCODE='42501';
    END IF;
    IF old_frozen THEN
      IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND current_user NOT IN ('postgres','supabase_admin') THEN
        RAISE EXCEPTION 'Kundenverknüpfung eines ausgestellten Belegs nur über die Kundenzusammenführung ändern.' USING ERRCODE='42501';
      END IF;
      old_content := to_jsonb(OLD) - ARRAY['status','betrag_noch_offen','payment_id','payment_status','paid_amount','payment_open_amount',
        'payment_date','payment_method','payment_reference','version','updated_at','sent_at','pdf_url','notiz','customer_id'];
      new_content := to_jsonb(NEW) - ARRAY['status','betrag_noch_offen','payment_id','payment_status','paid_amount','payment_open_amount',
        'payment_date','payment_method','payment_reference','version','updated_at','sent_at','pdf_url','notiz','customer_id'];
      IF new_content IS DISTINCT FROM old_content THEN
        RAISE EXCEPTION 'Ausgestellte Quittung ist unveränderlich. Bitte einen neuen Beleg erstellen.' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  -- Payment links can only be changed by the authorized payment RPC. Merely
  -- passing a payment UUID to the REST table must not claim another payment.
  IF (TG_OP='INSERT' AND NEW.payment_id IS NOT NULL)
     OR (TG_OP='UPDATE' AND NEW.payment_id IS DISTINCT FROM OLD.payment_id) THEN
    IF NOT EXISTS(SELECT 1 FROM public.quittung_payment_links l WHERE l.quittung_id=NEW.id AND l.payment_id=NEW.payment_id) THEN
      RAISE EXCEPTION 'Zahlung nur über die Zahlungserfassung verknüpfen.' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NOT old_frozen THEN
    IF jsonb_typeof(NEW.positionen) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Positionen müssen eine Liste sein.' USING ERRCODE='23514';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(NEW.positionen)) <> (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.positionen)) THEN
      RAISE EXCEPTION 'Positionen benötigen eindeutige IDs.' USING ERRCODE='23514';
    END IF;
    FOR p IN SELECT value FROM jsonb_array_elements(NEW.positionen) LOOP
      IF jsonb_typeof(p) IS DISTINCT FROM 'object'
         OR jsonb_typeof(p->'id') IS DISTINCT FROM 'string'
         OR btrim(p->>'id')=''
         OR jsonb_typeof(p->'beschreibung') IS DISTINCT FROM 'string'
         OR jsonb_typeof(p->'satz') IS DISTINCT FROM 'string'
         OR jsonb_typeof(p->'checked') IS DISTINCT FROM 'boolean'
         OR jsonb_typeof(p->'is_custom') IS DISTINCT FROM 'boolean'
         OR jsonb_typeof(p->'betrag') IS DISTINCT FROM 'number'
         OR (p->>'betrag')::numeric<0
         OR (p ? 'einzelpreis' AND p->'einzelpreis'<>'null'::jsonb AND (jsonb_typeof(p->'einzelpreis') IS DISTINCT FROM 'number' OR (p->>'einzelpreis')::numeric<0))
         OR (p ? 'einheit' AND p->'einheit'<>'null'::jsonb AND jsonb_typeof(p->'einheit') IS DISTINCT FROM 'string')
         OR (p ? 'price_type' AND p->'price_type'<>'null'::jsonb AND (jsonb_typeof(p->'price_type') IS DISTINCT FROM 'string' OR p->>'price_type' NOT IN ('pauschale','per_unit','per_hour','optional','inkl')))
         OR (p ? 'menge' AND p->'menge'<>'null'::jsonb AND
             (jsonb_typeof(p->'menge') IS DISTINCT FROM 'number' OR (p->>'menge')::numeric<0)) THEN
        RAISE EXCEPTION 'Ungültige Quittungsposition.' USING ERRCODE='23514';
      END IF;
      IF (p->>'checked')::boolean THEN
        sub:=sub+round((p->>'betrag')::numeric,2);
        IF (p->>'betrag')::numeric>0 AND btrim(p->>'beschreibung')<>'' THEN active:=active+1; END IF;
      END IF;
    END LOOP;
    IF NEW.rabatt<0 OR NEW.rabatt>sub OR NEW.mwst_satz<0 OR NEW.mwst_satz>100 THEN
      RAISE EXCEPTION 'Rabatt oder Mehrwertsteuersatz ist ungültig.' USING ERRCODE='23514';
    END IF;
    NEW.zwischensumme:=round(sub,2); NEW.total:=round(sub-NEW.rabatt,2);
    NEW.mwst_betrag:=round(NEW.total*NEW.mwst_satz/100,2);
    NEW.gesamttotal:=NEW.total+NEW.mwst_betrag;
    IF NEW.rechnung_id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.quittung_payment_links l JOIN public.payments p ON p.id=l.payment_id WHERE l.quittung_id=NEW.id AND NOT EXISTS(SELECT 1 FROM public.payments rev WHERE rev.reverses_payment_id=p.id)) THEN
        RAISE EXCEPTION 'Quittung hat bereits eine direkte Zahlung.' USING ERRCODE='23514';
      END IF;
      IF TG_OP='INSERT' OR NEW.rechnung_id IS DISTINCT FROM OLD.rechnung_id THEN
        -- Serialize a new link with invoice payment/balance updates: an invoice
        -- trigger cannot see a receipt whose linking transaction is uncommitted.
        SELECT * INTO inv FROM public.rechnungen WHERE id=NEW.rechnung_id AND company_id=NEW.company_id FOR SHARE;
      ELSE
        SELECT * INTO inv FROM public.rechnungen WHERE id=NEW.rechnung_id AND company_id=NEW.company_id;
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung gehört nicht zu dieser Firma.' USING ERRCODE='23503'; END IF;
      IF (NEW.customer_id IS DISTINCT FROM inv.customer_id
         OR (NEW.customer_id IS NULL AND lower(btrim(NEW.customer_name))<>lower(btrim(inv.customer_name))))
         AND NOT (TG_OP='UPDATE' AND current_user IN ('postgres','supabase_admin')
           AND NEW.rechnung_id IS NOT DISTINCT FROM OLD.rechnung_id
           AND NEW.customer_id IS DISTINCT FROM OLD.customer_id
           AND current_setting('crm.merging_customers',true)=OLD.customer_id::text||'>'||NEW.customer_id::text) THEN
        RAISE EXCEPTION 'Rechnung und Quittung müssen zum selben Kunden gehören.' USING ERRCODE='23514';
      END IF;
      IF NEW.auftrag_id IS NOT NULL AND inv.auftrag_id IS NOT NULL AND NEW.auftrag_id<>inv.auftrag_id THEN
        RAISE EXCEPTION 'Rechnung und Quittung gehören zu verschiedenen Aufträgen.' USING ERRCODE='23514';
      END IF;
    END IF;
    IF NEW.offer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.offers o WHERE o.id=NEW.offer_id AND o.company_id=NEW.company_id) THEN
      RAISE EXCEPTION 'Offerte gehört nicht zu dieser Firma.' USING ERRCODE='23503';
    END IF;
    IF NEW.auftrag_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.auftraege a WHERE a.id=NEW.auftrag_id AND a.company_id=NEW.company_id AND (NEW.offer_id IS NULL OR a.offer_id IS NOT DISTINCT FROM NEW.offer_id)) THEN
      RAISE EXCEPTION 'Auftrag und Offerte passen nicht zur Quittung.' USING ERRCODE='23503';
    END IF;
    finalize_now:=NEW.status<>'draft';
    IF finalize_now THEN
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.positionen) x WHERE (x->>'checked')::boolean AND (x->>'betrag')::numeric>0 AND btrim(x->>'beschreibung')='') THEN
        RAISE EXCEPTION 'Ausgewählte Leistungen benötigen eine Beschreibung.' USING ERRCODE='23514';
      END IF;
      IF btrim(NEW.customer_name)='' OR active=0 OR NEW.gesamttotal<=0 THEN
        RAISE EXCEPTION 'Vor dem Ausstellen sind Kunde und mindestens eine gültige Leistung erforderlich.' USING ERRCODE='23514';
      END IF;
      IF (NEW.kunde_signed_at IS NOT NULL AND NEW.kunde_unterschrift IS NULL)
         OR (NEW.teamchef_signed_at IS NOT NULL AND NEW.teamchef_unterschrift IS NULL) THEN
        RAISE EXCEPTION 'Unterschriftsdatum ohne Unterschrift.' USING ERRCODE='23514';
      END IF;
      IF NOT quittung_private.valid_signature(NEW.kunde_unterschrift) OR NOT quittung_private.valid_signature(NEW.teamchef_unterschrift) THEN
        RAISE EXCEPTION 'Ungültiges Unterschriftsbild.' USING ERRCODE='23514';
      END IF;
      IF NEW.kunde_unterschrift IS NOT NULL THEN NEW.kunde_signed_at:=coalesce(NEW.kunde_signed_at,now()); END IF;
      IF NEW.teamchef_unterschrift IS NOT NULL THEN NEW.teamchef_signed_at:=coalesce(NEW.teamchef_signed_at,now()); END IF;
      IF NEW.kunde_signed_at>now()+interval '5 minutes' OR NEW.teamchef_signed_at>now()+interval '5 minutes' THEN
        RAISE EXCEPTION 'Unterschriftsdatum liegt in der Zukunft.' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  IF old_frozen OR finalize_now THEN
    IF TG_OP='UPDATE' AND OLD.company_snapshot IS NOT NULL THEN NEW.company_snapshot:=OLD.company_snapshot;
    ELSE NEW.company_snapshot:=quittung_private.company_snapshot(NEW.company_id); END IF;
    NEW.issued_at:=CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.issued_at,now()) ELSE now() END;
  ELSE
    NEW.company_snapshot:=NULL; NEW.issued_at:=NULL;
  END IF;
  SELECT * INTO pay FROM quittung_private.payment_state(NEW);
  NEW.payment_status:=pay.payment_status; NEW.paid_amount:=pay.paid_amount; NEW.payment_open_amount:=pay.payment_open_amount;
  NEW.payment_date:=pay.payment_date; NEW.payment_method:=pay.payment_method; NEW.payment_reference:=pay.payment_reference;
  NEW.betrag_noch_offen:=NEW.payment_status<>'paid';
  IF NEW.issued_at IS NOT NULL THEN
    NEW.status:=CASE WHEN NEW.payment_status='paid' THEN 'paid'
      WHEN NEW.sent_at IS NOT NULL OR (TG_OP='UPDATE' AND OLD.status='sent') THEN 'sent'
      WHEN NEW.kunde_unterschrift IS NOT NULL OR NEW.teamchef_unterschrift IS NOT NULL THEN 'signed'
      ELSE 'issued' END;
  ELSE NEW.status:='draft'; END IF;
  IF TG_OP='UPDATE' THEN
    NEW.version:=OLD.version+CASE WHEN (to_jsonb(NEW)-ignored) IS DISTINCT FROM (to_jsonb(OLD)-ignored) THEN 1 ELSE 0 END;
  ELSE NEW.version:=1; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_quittung_lifecycle() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS zz_quittung_lifecycle ON public.quittungen;
CREATE TRIGGER zz_quittung_lifecycle BEFORE INSERT OR UPDATE ON public.quittungen
FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_lifecycle();

-- merge_customers moves receipt references before invoice references. Only that
-- authorized definer operation may temporarily differ; the committed identities
-- must still agree. Check both sides so an invoice edit cannot bypass the rule.
CREATE OR REPLACE FUNCTION public.guard_quittung_invoice_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.quittungen q JOIN public.rechnungen r ON r.id=q.rechnung_id
    WHERE ((TG_TABLE_NAME='quittungen' AND q.id=NEW.id) OR (TG_TABLE_NAME='rechnungen' AND r.id=NEW.id))
      AND q.customer_id IS DISTINCT FROM r.customer_id) THEN
    RAISE EXCEPTION 'Rechnung und Quittung müssen zum selben Kunden gehören.' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.guard_quittung_invoice_customer() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS quittung_invoice_customer ON public.quittungen;
CREATE CONSTRAINT TRIGGER quittung_invoice_customer AFTER INSERT OR UPDATE ON public.quittungen
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_invoice_customer();
DROP TRIGGER IF EXISTS invoice_quittung_customer ON public.rechnungen;
CREATE CONSTRAINT TRIGGER invoice_quittung_customer AFTER UPDATE ON public.rechnungen
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_quittung_invoice_customer();

CREATE OR REPLACE FUNCTION public.finalize_quittung(
  p_quittung_id uuid,p_expected_version integer,
  p_kunde_unterschrift text DEFAULT NULL,p_teamchef_unterschrift text DEFAULT NULL,
  p_kunde_signed_at timestamptz DEFAULT NULL,p_teamchef_signed_at timestamptz DEFAULT NULL
) RETURNS public.quittungen LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quittungen;
BEGIN
  SELECT * INTO q FROM public.quittungen WHERE id=p_quittung_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_company_member(q.company_id) THEN
    RAISE EXCEPTION 'Quittung nicht gefunden oder keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF q.version<>p_expected_version THEN RAISE EXCEPTION 'Quittung wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF q.issued_at IS NOT NULL THEN RETURN q; END IF;
  IF q.status<>'draft' THEN
    UPDATE public.quittungen SET notiz=notiz WHERE id=q.id RETURNING * INTO q;
    RETURN q;
  END IF;
  UPDATE public.quittungen SET status='issued',
    kunde_unterschrift=coalesce(p_kunde_unterschrift,kunde_unterschrift),
    teamchef_unterschrift=coalesce(p_teamchef_unterschrift,teamchef_unterschrift),
    kunde_signed_at=coalesce(p_kunde_signed_at,kunde_signed_at),
    teamchef_signed_at=coalesce(p_teamchef_signed_at,teamchef_signed_at)
  WHERE id=q.id RETURNING * INTO q;
  RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.finalize_quittung(uuid,integer,text,text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_quittung(uuid,integer,text,text,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_quittung_payment(
  p_quittung_id uuid,p_method text DEFAULT 'cash',p_payment_date date DEFAULT NULL,
  p_reference text DEFAULT NULL,p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quittungen; pay uuid;
BEGIN
  SELECT * INTO q FROM public.quittungen WHERE id=p_quittung_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_company_role(q.company_id,ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Nur Eigentümer oder Administratoren können Zahlungen erfassen.' USING ERRCODE='42501';
  END IF;
  IF q.status='draft' THEN RAISE EXCEPTION 'Quittung zuerst ausstellen.' USING ERRCODE='23514'; END IF;
  IF q.rechnung_id IS NOT NULL THEN RAISE EXCEPTION 'Zahlung bei der verknüpften Rechnung erfassen.' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.quittung_payment_links l JOIN public.payments p ON p.id=l.payment_id
    WHERE l.quittung_id=q.id AND NOT EXISTS(SELECT 1 FROM public.payments rev WHERE rev.reverses_payment_id=p.id)) THEN
    RAISE EXCEPTION 'Quittung ist bereits gebucht.' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.payments(company_id,customer_id,payment_date,amount,method,reference,note,created_via,created_by)
  VALUES(q.company_id,q.customer_id,coalesce(p_payment_date,(now() AT TIME ZONE 'Europe/Zurich')::date),q.gesamttotal,p_method,p_reference,
    coalesce(p_note,'Quittung '||q.quittung_nr),'quittung',auth.uid()) RETURNING id INTO pay;
  INSERT INTO public.quittung_payment_links(quittung_id,company_id,payment_id) VALUES(q.id,q.company_id,pay);
  UPDATE public.quittungen SET payment_id=pay WHERE id=q.id RETURNING * INTO q;
  RETURN jsonb_build_object('payment_id',pay,'amount',q.paid_amount,'warnung',NULL);
END $$;
REVOKE ALL ON FUNCTION public.record_quittung_payment(uuid,text,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_quittung_payment(uuid,text,date,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_quittung_invoice_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.quittungen SET notiz=notiz WHERE rechnung_id=NEW.id;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_quittung_invoice_payment() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sync_quittung_invoice_payment ON public.rechnungen;
CREATE TRIGGER sync_quittung_invoice_payment AFTER UPDATE OF status,paid_total,credited_total,open_amount,gesamttotal,total ON public.rechnungen
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.paid_total IS DISTINCT FROM NEW.paid_total OR OLD.credited_total IS DISTINCT FROM NEW.credited_total OR OLD.open_amount IS DISTINCT FROM NEW.open_amount)
EXECUTE FUNCTION public.sync_quittung_invoice_payment();
CREATE OR REPLACE FUNCTION public.sync_quittung_payment_reversal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.quittungen q SET notiz=q.notiz
  WHERE EXISTS(SELECT 1 FROM public.quittung_payment_links l WHERE l.quittung_id=q.id AND l.payment_id=NEW.reverses_payment_id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_quittung_payment_reversal() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sync_quittung_payment_reversal ON public.payments;
CREATE TRIGGER sync_quittung_payment_reversal AFTER INSERT ON public.payments
FOR EACH ROW WHEN (NEW.reverses_payment_id IS NOT NULL) EXECUTE FUNCTION public.sync_quittung_payment_reversal();

CREATE OR REPLACE FUNCTION public.sync_quittung_payment_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.quittungen q SET notiz=q.notiz
  WHERE EXISTS(SELECT 1 FROM public.quittung_payment_links l WHERE l.quittung_id=q.id AND l.payment_id=NEW.id)
     OR EXISTS(SELECT 1 FROM public.payment_allocations a WHERE a.rechnung_id=q.rechnung_id AND a.payment_id=NEW.id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_quittung_payment_reference() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sync_quittung_payment_reference ON public.payments;
CREATE TRIGGER sync_quittung_payment_reference AFTER UPDATE OF reference ON public.payments
FOR EACH ROW WHEN (OLD.reference IS DISTINCT FROM NEW.reference) EXECUTE FUNCTION public.sync_quittung_payment_reference();

-- Capture a stable current snapshot for legacy issued documents. We explicitly
-- record the capture time now; the historical issuer details cannot be reconstructed.
DO $$
DECLARE old_row public.quittungen; new_row public.quittungen; problems jsonb:='[]';
BEGIN
  FOR old_row IN SELECT * FROM public.quittungen ORDER BY id LOOP
    BEGIN
      UPDATE public.quittungen SET notiz=notiz WHERE id=old_row.id RETURNING * INTO new_row;
      IF (old_row.zwischensumme,old_row.total,old_row.mwst_betrag,old_row.gesamttotal)
        IS DISTINCT FROM (new_row.zwischensumme,new_row.total,new_row.mwst_betrag,new_row.gesamttotal) THEN
        RAISE EXCEPTION 'Bestehende Positionssumme und gespeicherte Beträge widersprechen sich.' USING ERRCODE='23514';
      END IF;
    EXCEPTION WHEN check_violation OR invalid_text_representation OR foreign_key_violation THEN
      problems:=problems||jsonb_build_array(jsonb_build_object('id',old_row.id,'number',old_row.quittung_nr,'error',SQLERRM));
    END;
  END LOOP;
  IF jsonb_array_length(problems)>0 THEN
    RAISE EXCEPTION 'Quittung-Migration abgebrochen: ungültige Bestandsdaten zuerst fachlich korrigieren.' USING ERRCODE='23514',DETAIL=problems::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quittung_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  quittung_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  pdf_path text NOT NULL,
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quittung_id,version), UNIQUE(id,company_id), UNIQUE(pdf_path),
  FOREIGN KEY(quittung_id,company_id) REFERENCES public.quittungen(id,company_id) ON DELETE RESTRICT
);
ALTER TABLE public.quittung_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quittung_documents_read ON public.quittung_documents;
CREATE POLICY quittung_documents_read ON public.quittung_documents FOR SELECT TO authenticated USING(public.is_company_member(company_id));
REVOKE ALL ON public.quittung_documents FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.quittung_documents TO authenticated,service_role;
GRANT INSERT ON public.quittung_documents TO service_role;
CREATE TABLE IF NOT EXISTS public.quittung_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  company_id uuid NOT NULL,
  recipient_kind text NOT NULL CHECK(recipient_kind IN ('customer','firma')),
  recipient_email text NOT NULL,
  status text NOT NULL CHECK(status IN ('processing','sent','failed')),
  provider_id text,error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
  UNIQUE(document_id,recipient_kind,recipient_email),
  FOREIGN KEY(document_id,company_id) REFERENCES public.quittung_documents(id,company_id) ON DELETE RESTRICT
);
ALTER TABLE public.quittung_dispatches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quittung_dispatches_read ON public.quittung_dispatches;
CREATE POLICY quittung_dispatches_read ON public.quittung_dispatches FOR SELECT TO authenticated USING(public.is_company_member(company_id));
REVOKE ALL ON public.quittung_dispatches FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.quittung_dispatches TO authenticated,service_role;
GRANT INSERT,UPDATE ON public.quittung_dispatches TO service_role;

CREATE OR REPLACE FUNCTION public.register_quittung_document(p_quittung_id uuid,p_expected_version integer,p_pdf_path text,p_sha256 text)
RETURNS public.quittung_documents LANGUAGE plpgsql SET search_path='' AS $$
DECLARE q public.quittungen; d public.quittung_documents;
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO q FROM public.quittungen WHERE id=p_quittung_id FOR UPDATE;
  IF NOT FOUND OR q.issued_at IS NULL THEN RAISE EXCEPTION 'Quittung zuerst ausstellen.' USING ERRCODE='23514'; END IF;
  IF q.version<>p_expected_version THEN RAISE EXCEPTION 'Quittung wurde inzwischen geändert.' USING ERRCODE='40001'; END IF;
  IF p_pdf_path<>q.company_id::text||'/quittung/'||q.id::text||'/'||q.version||'/'||p_sha256||'.pdf' THEN
    RAISE EXCEPTION 'Ungültiger PDF-Pfad.' USING ERRCODE='23514';
  END IF;
  SELECT * INTO d FROM public.quittung_documents WHERE quittung_id=q.id AND version=q.version;
  IF FOUND THEN RETURN d; END IF;
  INSERT INTO public.quittung_documents(company_id,quittung_id,version,pdf_path,sha256)
  VALUES(q.company_id,q.id,q.version,p_pdf_path,p_sha256) RETURNING * INTO d;
  RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.register_quittung_document(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_quittung_document(uuid,integer,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_quittung_dispatch(p_document_id uuid,p_kind text,p_email text)
RETURNS public.quittung_dispatches LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d public.quittung_documents; dispatch public.quittung_dispatches;
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.quittung_documents WHERE id=p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDF nicht gefunden.' USING ERRCODE='23503'; END IF;
  IF p_kind NOT IN ('customer','firma') OR nullif(btrim(p_email),'') IS NULL THEN RAISE EXCEPTION 'Ungültiger Empfänger.' USING ERRCODE='23514'; END IF;
  INSERT INTO public.quittung_dispatches(document_id,company_id,recipient_kind,recipient_email,status)
  VALUES(d.id,d.company_id,p_kind,lower(btrim(p_email)),'processing')
  ON CONFLICT(document_id,recipient_kind,recipient_email) DO UPDATE SET
    status='processing',claimed_at=now(),error=NULL
  WHERE public.quittung_dispatches.status='failed'
     OR (public.quittung_dispatches.status='processing' AND public.quittung_dispatches.claimed_at<now()-interval '2 minutes')
  RETURNING * INTO dispatch;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN dispatch;
END $$;
REVOKE ALL ON FUNCTION public.claim_quittung_dispatch(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quittung_dispatch(uuid,text,text) TO service_role;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='quittungen') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quittungen;
  END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
