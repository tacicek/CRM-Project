import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import type { Database } from "@/integrations/supabase/types";

export type Kunde = Database["public"]["Tables"]["customers"]["Row"];
export type KundeUpdate = Database["public"]["Tables"]["customers"]["Update"];
export type KundeListeZeile =
  Database["public"]["Functions"]["search_customers"]["Returns"][number];

export type KundenFilter = "alle" | "person" | "firma" | "duplikate";

export type KundenKennzahlen = {
  gesamt: number;
  neu30: number;
  duplikate: number;
  inaktiv90: number;
};

type Args = {
  companyId: string | undefined;
  suche: string;
  filter: KundenFilter;
  seite: number;
  proSeite: number;
};

/**
 * Datenschicht der Kundenliste — supabase.from/rpc + useState/useEffect, wie
 * useRechnungen. (Im Repo gibt es keinen einzigen useQuery-Aufruf, obwohl der
 * QueryClientProvider steht; das Muster hier folgt dem Bestand.)
 *
 * Gelesen wird ueber die RPC `search_customers`, NICHT ueber `from("customers")`:
 * die Liste zeigt "letzte Aktion", "offene Offerten" und "offener Betrag", und
 * diese Werte leiten sich aus sechs Tabellen ab. Sie in `customers` zu
 * speichern hiesse sechs Trigger oder stilles Veralten. Die RPC rechnet sie per
 * LATERAL aus und liefert die Trefferzahl gleich mit — deshalb blaettert hier
 * der Server und nicht der Browser.
 */
export const useKunden = ({ companyId, suche, filter, seite, proSeite }: Args) => {
  const { toast } = useToast();
  const t = useT();
  const [kunden, setKunden] = useState<KundeListeZeile[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [kennzahlen, setKennzahlen] = useState<KundenKennzahlen>({
    gesamt: 0,
    neu30: 0,
    duplikate: 0,
    inaktiv90: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKunden = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.rpc("search_customers", {
      p_company_id: companyId,
      p_query: suche.trim() || null,
      p_filter: filter,
      p_limit: proSeite,
      p_offset: (seite - 1) * proSeite,
    });

    if (error) {
      setError(error.message);
      toast({
        title: t("kunde.error.load"),
        description: error.code === "42501" ? t("kunde.error.forbidden") : error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const zeilen = (data ?? []) as KundeListeZeile[];
    setError(null);
    setKunden(zeilen);
    // `gesamt` steht auf jeder Zeile (Fensterfunktion). Ohne Treffer ist es 0.
    setGesamt(zeilen.length > 0 ? Number(zeilen[0].gesamt) : 0);
    setLoading(false);
  }, [companyId, suche, filter, seite, proSeite, toast, t]);

  useEffect(() => {
    fetchKunden();
  }, [fetchKunden]);

  /**
   * Die vier Kennzahlen zaehlen ueber den GESAMTEN Bestand, nicht ueber die
   * angezeigte Seite — deshalb vier eigene count-Abfragen statt einer Auswertung
   * der Liste (Muster: Dashboard.tsx, FirmaLayout.tsx).
   */
  const fetchKennzahlen = useCallback(async () => {
    if (!companyId) return;
    const basis = () =>
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .is("merged_into_customer_id", null);

    const vor30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const vor90 = new Date(Date.now() - 90 * 864e5).toISOString();

    const [gesamtR, neuR, dupR, inaktivR] = await Promise.all([
      basis(),
      basis().gte("created_at", vor30),
      basis().eq("possible_duplicate", true),
      // Naeherung: wer seit 90 Tagen keinen neuen Vorgang hat, gilt als inaktiv.
      // `first_seen_at` ist dafuer der einzige Wert, der auf der Zeile steht.
      basis().lt("first_seen_at", vor90),
    ]);

    setKennzahlen({
      gesamt: gesamtR.count ?? 0,
      neu30: neuR.count ?? 0,
      duplikate: dupR.count ?? 0,
      inaktiv90: inaktivR.count ?? 0,
    });
  }, [companyId]);

  useEffect(() => {
    fetchKennzahlen();
  }, [fetchKennzahlen]);

  return { kunden, gesamt, kennzahlen, loading, error, fetchKunden, fetchKennzahlen };
};

/**
 * Einen Kunden aendern. Bewusst hier und nicht auf der Liste: die Kundenkarte
 * ist der einzige Ort, an dem gepflegt wird.
 */
export const updateKunde = async (
  id: string,
  werte: KundeUpdate,
): Promise<{ ok: true; kunde: Kunde } | { ok: false; grund: string; verboten: boolean }> => {
  const { data, error } = await supabase
    .from("customers")
    .update(werte)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    // Der Guard aus 20260728100000 meldet sich mit 42501, wenn jemand die
    // Zusammenfuehrungsfelder direkt setzen will.
    return { ok: false, grund: error?.message ?? "", verboten: error?.code === "42501" };
  }
  return { ok: true, kunde: data };
};
