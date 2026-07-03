import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import type { Quittung } from "@/types/quittung.types";

export type QuittungUpdate = Database["public"]["Tables"]["quittungen"]["Update"];

/**
 * Quittungen data layer — supabase.from + useState/useEffect (useRechnungen pattern,
 * no React Query). Reloads automatically when companyId changes.
 *
 * Return type is the hand-maintained Quittung (status union + QuittungPosition[]); the page
 * depends on this narrower type (FOLK_STATUS[q.status]). Payload is the generated Update type.
 */
export const useQuittungen = (companyId: string | undefined) => {
  const { toast } = useToast();
  const [quittungen, setQuittungen] = useState<Quittung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuittungen = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("quittungen")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
    } else {
      setError(null);
      setQuittungen(data ?? []);
    }
    setLoading(false);
  }, [companyId, toast]);

  useEffect(() => {
    fetchQuittungen();
  }, [fetchQuittungen]);

  const updateQuittung = useCallback(
    async (id: string, payload: QuittungUpdate): Promise<Quittung | null> => {
      const { data, error } = await supabase
        .from("quittungen")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        toast({ title: "Fehler", description: error?.message, variant: "destructive" });
        return null;
      }
      setQuittungen((prev) => prev.map((q) => (q.id === id ? data : q)));
      return data;
    },
    [toast],
  );

  const deleteQuittung = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from("quittungen").delete().eq("id", id);
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return false;
      }
      setQuittungen((prev) => prev.filter((q) => q.id !== id));
      return true;
    },
    [toast],
  );

  return { quittungen, loading, error, fetchQuittungen, updateQuittung, deleteQuittung };
};
