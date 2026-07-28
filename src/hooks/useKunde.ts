import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Kunde } from "@/hooks/useKunden";

export type DuplikatKandidat =
  Database["public"]["Functions"]["duplicate_candidates"]["Returns"][number];

/**
 * Rueckgabe von `customer_summary`. Die RPC liefert Json; diese Form beschreibt,
 * was tatsaechlich drinsteht (Migration 20260728150000).
 */
export type KundeZusammenfassung = {
  kunde: Kunde;
  anzahl: Record<
    "anfragen" | "offerten" | "auftraege" | "termine" | "rechnungen" | "quittungen" | "emails",
    number
  >;
  pipeline: Record<"offerten_offen" | "offerten_akzeptiert" | "auftraege_offen", number>;
  /**
   * Seit dem Zahlungsbuch (20260729160000) gibt es nur noch EINEN Umsatztopf:
   * `bezahlt` ist die Summe der Zahlungseingaenge, `davon_quittungen` ein
   * Ausschnitt daraus. Vorher standen zwei Summen nebeneinander und ein
   * Kommentar war der einzige Schutz davor, sie zu addieren.
   * `offen` kommt aus rechnungen.open_amount und kennt Teilzahlungen.
   */
  finanzen: Record<
    "fakturiert" | "bezahlt" | "offen" | "davon_quittungen" | "gutschriften",
    number
  >;
  aktivitaet: {
    erster_kontakt: string | null;
    letzte_aktion: string | null;
    naechster_termin: { id: string; datum: string; start: string | null; titel: string } | null;
  };
  zusammengefuehrt_aus: { id: string; anzeigename: string; am: string }[];
};

/**
 * Eine Kundenkarte: Stammsatz, Kennzahlen und Duplikat-Kandidaten.
 *
 * Der Stammsatz wird zusaetzlich zur RLS auf die Firma eingegrenzt (Muster:
 * OfferteDetail.tsx) — ein Tippfehler in der URL soll nicht zu einer leeren
 * Seite fuehren, sondern zu einer klaren Antwort.
 */
export const useKunde = (id: string | undefined, companyId: string | undefined) => {
  const { toast } = useToast();
  const t = useT();
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [zusammenfassung, setZusammenfassung] = useState<KundeZusammenfassung | null>(null);
  const [duplikate, setDuplikate] = useState<DuplikatKandidat[]>([]);
  const [loading, setLoading] = useState(true);
  const [nichtGefunden, setNichtGefunden] = useState(false);

  const laden = useCallback(async () => {
    if (!id || !companyId) return;
    setLoading(true);

    const { data: satz, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !satz) {
      setNichtGefunden(true);
      setLoading(false);
      return;
    }
    setKunde(satz);
    setNichtGefunden(false);

    const [{ data: summe }, { data: dups }] = await Promise.all([
      supabase.rpc("customer_summary", { p_customer_id: id }),
      supabase.rpc("duplicate_candidates", { p_company_id: companyId, p_customer_id: id }),
    ]);

    setZusammenfassung((summe as unknown as KundeZusammenfassung) ?? null);
    setDuplikate((dups ?? []) as DuplikatKandidat[]);
    setLoading(false);
  }, [id, companyId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const speichern = useCallback(
    async (werte: Database["public"]["Tables"]["customers"]["Update"]) => {
      if (!id) return false;
      const { data, error } = await supabase
        .from("customers")
        .update(werte)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) {
        toast({
          title: t("kunde.error.save"),
          description: error?.code === "42501" ? t("kunde.error.forbidden") : error?.message,
          variant: "destructive",
        });
        return false;
      }
      setKunde(data);
      toast({ title: t("kunde.saved") });
      return true;
    },
    [id, toast, t],
  );

  /**
   * Zusammenfuehren. Die eigentliche Regel — wer darf, was wird umgehaengt, was
   * bleibt stehen — steckt in `merge_customers`; hier wird nur aufgerufen und
   * die Ablehnung (42501) in einen lesbaren Satz uebersetzt.
   */
  const zusammenfuehren = useCallback(
    async (quelleId: string, zielId: string, grund: string | null) => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc("merge_customers", {
        p_company_id: companyId,
        p_source_customer_id: quelleId,
        p_target_customer_id: zielId,
        p_reason: grund,
      });
      if (error) {
        toast({
          title: t("common.error"),
          description: error.code === "42501" ? t("kunde.merge.forbidden") : error.message,
          variant: "destructive",
        });
        return null;
      }
      toast({ title: t("kunde.merge.done") });
      return data as Json;
    },
    [companyId, toast, t],
  );

  const vorschau = useCallback(
    async (quelleId: string, zielId: string) => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc("customer_merge_preview", {
        p_company_id: companyId,
        p_source_customer_id: quelleId,
        p_target_customer_id: zielId,
      });
      return error ? null : (data as Json);
    },
    [companyId],
  );

  return {
    kunde,
    zusammenfassung,
    duplikate,
    loading,
    nichtGefunden,
    laden,
    speichern,
    zusammenfuehren,
    vorschau,
  };
};
