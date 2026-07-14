import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database, Json } from "@/integrations/supabase/types";
import type { RechnungData, RechnungCompany, RechnungPosition } from "@/lib/generateRechnungPdf";
import { resolveDocumentLocale } from "@/i18n/documentLocale";

export type Rechnung = Database["public"]["Tables"]["rechnungen"]["Row"];
export type RechnungInsert = Database["public"]["Tables"]["rechnungen"]["Insert"];
export type RechnungUpdate = Database["public"]["Tables"]["rechnungen"]["Update"];

/** Rechnungen Row → generateRechnungPdf RechnungData (positionen Json → typed). */
export const rechnungToPdfData = (r: Rechnung, company: RechnungCompany): RechnungData => ({
  rechnung_nr: r.rechnung_nr ?? "",
  datum: r.datum,
  faellig_am: r.faellig_am,
  customer_name: r.customer_name,
  customer_address: r.customer_address,
  customer_email: r.customer_email,
  positionen: (r.positionen as unknown as RechnungPosition[]) ?? [],
  zwischensumme: r.zwischensumme,
  mwst_satz: r.mwst_satz,
  mwst_betrag: r.mwst_betrag,
  total: r.total,
  currency: "CHF",
  qr_referenz: r.qr_referenz,
  qr_iban: r.qr_iban,
  // Customer language, frozen on the invoice row — the PDF must never follow the operator.
  locale: resolveDocumentLocale(r),
  // Anschreiben & Konditionen — without these the list-page PDF silently dropped the
  // whole letter block (salutation, intro, payment terms, closing) that the DB row carries.
  anrede: r.anrede,
  einleitung: r.einleitung,
  schlusstext: r.schlusstext,
  zahlungskonditionen: r.zahlungskonditionen,
  company,
});

/** positionen (RechnungPosition[]) → boundary conversion for the Json column. */
export const positionenToJson = (positionen: RechnungPosition[]): Json =>
  positionen as unknown as Json;

/**
 * Rechnungen data layer — supabase.from + useState/useEffect (Quittungen pattern,
 * no React Query). Reloads automatically when companyId changes.
 */
export const useRechnungen = (companyId: string | undefined) => {
  const { toast } = useToast();
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRechnungen = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("rechnungen")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
    } else {
      setError(null);
      setRechnungen(data ?? []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => {
    fetchRechnungen();
  }, [fetchRechnungen]);

  const createRechnung = useCallback(
    async (payload: RechnungInsert): Promise<Rechnung | null> => {
      const { data, error } = await supabase
        .from("rechnungen")
        .insert(payload)
        .select("*")
        .single();
      if (error || !data) {
        toast({ title: "Fehler", description: error?.message, variant: "destructive" });
        return null;
      }
      setRechnungen((prev) => [data, ...prev]);
      return data;
    },
    [toast],
  );

  const updateRechnung = useCallback(
    async (id: string, payload: RechnungUpdate): Promise<Rechnung | null> => {
      const { data, error } = await supabase
        .from("rechnungen")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        toast({ title: "Fehler", description: error?.message, variant: "destructive" });
        return null;
      }
      setRechnungen((prev) => prev.map((r) => (r.id === id ? data : r)));
      return data;
    },
    [toast],
  );

  const deleteRechnung = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from("rechnungen").delete().eq("id", id);
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return false;
      }
      setRechnungen((prev) => prev.filter((r) => r.id !== id));
      return true;
    },
    [toast],
  );

  return {
    rechnungen,
    loading,
    error,
    fetchRechnungen,
    createRechnung,
    updateRechnung,
    deleteRechnung,
  };
};
