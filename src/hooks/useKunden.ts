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
  blockiert: number;
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
  const [kennzahlen, setKennzahlen] = useState<KundenKennzahlen | null>(null);
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
   * Die Kacheln zaehlen ueber den GESAMTEN Bestand, nicht ueber die angezeigte
   * Seite.
   *
   * BEFUND (behoben, 20260807100000): "Inaktiv (90 T.)" zaehlte hier
   * `first_seen_at < heute - 90 Tage`, also Kunden, deren ERSTER Kontakt lange
   * her ist. Ein Stammkunde seit zwei Jahren mit einem Auftrag von letzter
   * Woche fiel darunter — die Kachel zeigte ungefaehr das Gegenteil ihres
   * Namens. "Letzte Aktion" leitet sich aus sieben Tabellen ab und ist im
   * Browser nicht zu haben; deshalb rechnet jetzt `customer_kennzahlen`.
   *
   * `null` heisst: die Zahlen sind nicht bekannt. Die Kacheln bleiben dann weg,
   * statt vier Nullen zu behaupten.
   */
  const fetchKennzahlen = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase.rpc("customer_kennzahlen", {
      p_company_id: companyId,
    });
    if (error || !data) {
      setKennzahlen(null);
      return;
    }
    setKennzahlen(data as unknown as KundenKennzahlen);
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
