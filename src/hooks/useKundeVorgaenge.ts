import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deuteLadefehler, type Ladefehler } from "@/lib/ladefehler";

export type VorgangOfferte = {
  id: string;
  title: string | null;
  status: string;
  total: number | null;
  created_at: string;
};
export type VorgangAuftrag = {
  id: string;
  auftrag_nummer: string | null;
  title: string | null;
  status: string;
  total: number | null;
  scheduled_date: string | null;
};
export type VorgangRechnung = {
  id: string;
  rechnung_nr: string | null;
  status: string;
  gesamttotal: number | null;
  open_amount: number | null;
  datum: string | null;
  faellig_am: string | null;
};
export type VorgangQuittung = {
  id: string;
  quittung_nr: string | null;
  gesamttotal: number | null;
  datum: string | null;
};
export type VorgangTermin = {
  id: string;
  title: string | null;
  appointment_date: string;
  start_time: string | null;
  status: string;
  appointment_type: string;
};

export type KundeVorgaenge = {
  offerten: VorgangOfferte[];
  auftraege: VorgangAuftrag[];
  rechnungen: VorgangRechnung[];
  quittungen: VorgangQuittung[];
  termine: VorgangTermin[];
};

const LEER: KundeVorgaenge = {
  offerten: [],
  auftraege: [],
  rechnungen: [],
  quittungen: [],
  termine: [],
};

/**
 * Die Vorgaenge eines Kunden als LISTEN — nicht als Zaehler.
 *
 * Der Verlauf (`customer_timeline`) beantwortet "was ist passiert" in
 * Zeitreihenfolge und ist auf 25 Zeilen geblaettert. Die Frage "welche Offerten
 * sind offen" beantwortet er nicht: die aelteste offene Offerte kann auf Seite
 * drei stehen. Deshalb hier vier eigene, nach Vorgangsart sortierte Abfragen.
 *
 * Keine RPC: es sind einfache Tabellenlesungen, die RLS auf `is_company_member`
 * bereits eingrenzt, und der Kundenbezug ist durch den zusammengesetzten
 * Fremdschluessel (customer_id, company_id) mandantensicher.
 */
export const useKundeVorgaenge = (customerId: string | undefined) => {
  const [vorgaenge, setVorgaenge] = useState<KundeVorgaenge>(LEER);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<Ladefehler | null>(null);

  const laden = useCallback(async () => {
    if (!customerId) return;
    setLaedt(true);

    const [o, a, r, q, tm] = await Promise.all([
      supabase
        .from("offers")
        .select("id, title, status, total, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("auftraege")
        .select("id, auftrag_nummer, title, status, total, scheduled_date")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("scheduled_date", { ascending: false }),
      supabase
        .from("rechnungen")
        .select("id, rechnung_nr, status, gesamttotal, open_amount, datum, faellig_am")
        .eq("customer_id", customerId)
        .order("datum", { ascending: false }),
      supabase
        .from("quittungen")
        .select("id, quittung_nr, gesamttotal, datum")
        .eq("customer_id", customerId)
        .order("datum", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, title, appointment_date, start_time, status, appointment_type")
        .eq("customer_id", customerId)
        .order("appointment_date", { ascending: false }),
    ]);

    // Eine unvollstaendige Liste sieht aus wie eine vollstaendige. Scheitert
    // eine der fuenf Abfragen, gilt der ganze Abschnitt als ungeladen.
    const f =
      deuteLadefehler(o.error) ??
      deuteLadefehler(a.error) ??
      deuteLadefehler(r.error) ??
      deuteLadefehler(q.error) ??
      deuteLadefehler(tm.error);
    if (f) {
      setFehler(f);
      setVorgaenge(LEER);
      setLaedt(false);
      return;
    }

    setFehler(null);
    setVorgaenge({
      offerten: (o.data ?? []) as VorgangOfferte[],
      auftraege: (a.data ?? []) as VorgangAuftrag[],
      rechnungen: (r.data ?? []) as VorgangRechnung[],
      quittungen: (q.data ?? []) as VorgangQuittung[],
      termine: (tm.data ?? []) as VorgangTermin[],
    });
    setLaedt(false);
  }, [customerId]);

  useEffect(() => {
    laden();
  }, [laden]);

  return { vorgaenge, laedt, fehler, laden };
};
