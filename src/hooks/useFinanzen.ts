import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import type { Database } from "@/integrations/supabase/types";

export type OffenerPosten =
  Database["public"]["Functions"]["open_receivables"]["Returns"][number];
export type Zahlung = Database["public"]["Tables"]["payments"]["Row"];

/**
 * Rueckgabe von `finance_overview`. Die RPC liefert Json; diese Form beschreibt,
 * was darin steht (Migration 20260729150000).
 *
 * `kassiert_total` ist die EINZIGE Umsatzzahl des Systems — die Summe der
 * Zahlungseingaenge. Rechnung und Quittung zaehlen darin je einmal; vor dem
 * Zahlungsbuch rechnete jede Liste ihre eigene Summe und beide zusammen
 * ergaben mehr, als hereingekommen war.
 */
export type FinanzUebersicht = {
  kassiert_total: number;
  kassiert_30t: number;
  nicht_abgeglichen: number;
  offen_total: number;
  offen_anzahl: number;
  ueberfaellig_total: number;
  ueberfaellig_anzahl: number;
  entwurf_total: number;
  gutschriften_total: number;
};

const LEER: FinanzUebersicht = {
  kassiert_total: 0,
  kassiert_30t: 0,
  nicht_abgeglichen: 0,
  offen_total: 0,
  offen_anzahl: 0,
  ueberfaellig_total: 0,
  ueberfaellig_anzahl: 0,
  entwurf_total: 0,
  gutschriften_total: 0,
};

export const useFinanzen = (companyId: string | undefined) => {
  const { toast } = useToast();
  const t = useT();

  const [uebersicht, setUebersicht] = useState<FinanzUebersicht>(LEER);
  const [posten, setPosten] = useState<OffenerPosten[]>([]);
  const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    const [u, p, z] = await Promise.all([
      supabase.rpc("finance_overview", { p_company_id: companyId }),
      supabase.rpc("open_receivables", { p_company_id: companyId, p_limit: 100 }),
      supabase
        .from("payments")
        .select("*")
        .eq("company_id", companyId)
        .order("payment_date", { ascending: false })
        .limit(100),
    ]);

    const fehler = u.error ?? p.error ?? z.error;
    if (fehler) {
      toast({
        title: t("common.error"),
        description:
          fehler.code === "42501"
            ? t("kunde.error.forbidden")
            : fehler.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setUebersicht({ ...LEER, ...(u.data as unknown as FinanzUebersicht) });
    setPosten(p.data ?? []);
    setZahlungen(z.data ?? []);
    setLoading(false);
  }, [companyId, toast, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  const stornieren = useCallback(
    async (paymentId: string, grund?: string) => {
      const { error } = await supabase.rpc("reverse_payment", {
        p_payment_id: paymentId,
        p_reason: grund,
      });
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: t("finanz.zahlungen.storniert") });
      await laden();
      return true;
    },
    [toast, t, laden],
  );

  return { uebersicht, posten, zahlungen, loading, laden, stornieren };
};
