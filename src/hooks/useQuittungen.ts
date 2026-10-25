import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import { quittungListSchema, quittungSearchFilter, type QuittungListFilter, type QuittungListItem } from "@/lib/quittungList";

const PAGE_SIZE = 25;
const SELECT = "id,company_id,quittung_nr,customer_name,datum,status,gesamttotal,payment_status,paid_amount,issued_at,sent_at,rechnung_id,version";
const EMPTY_STATS = { total: 0, issued: 0, paid: 0, open: 0 };

export const useQuittungen = (companyId: string | undefined, search = "", filter: QuittungListFilter = "all", page = 1) => {
  const { toast } = useToast();
  const t = useT();
  const [quittungen, setQuittungen] = useState<QuittungListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState(EMPTY_STATS);
  const generation = useRef(0);

  const fetchQuittungen = useCallback(async () => {
    const request = ++generation.current;
    if (!companyId) { setQuittungen([]); setStats(EMPTY_STATS); setCount(0); setError(null); setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase.from("quittungen").select(SELECT, { count: "exact" }).eq("company_id", companyId);
      if (search.trim()) query = query.or(quittungSearchFilter(search.trim()));
      if (filter === "paid" || filter === "open" || filter === "partial") query = query.eq("payment_status", filter);
      else if (filter !== "all") query = query.eq("status", filter);
      const [rows, total, issued, paid, open] = await Promise.all([
        query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
        supabase.from("quittungen").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("quittungen").select("id", { count: "exact", head: true }).eq("company_id", companyId).not("issued_at", "is", null),
        supabase.from("quittungen").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("payment_status", "paid"),
        supabase.from("quittungen").select("id", { count: "exact", head: true }).eq("company_id", companyId).not("issued_at", "is", null).neq("payment_status", "paid"),
      ]);
      for (const result of [rows, total, issued, paid, open]) if (result.error) throw result.error;
      const parsed = quittungListSchema.array().safeParse(rows.data);
      if (!parsed.success) throw new Error(t("receipt.list.invalid"));
      if (request !== generation.current) return;
      setQuittungen(parsed.data); setCount(rows.count ?? 0);
      setStats({ total: total.count ?? 0, issued: issued.count ?? 0, paid: paid.count ?? 0, open: open.count ?? 0 });
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      setError(cause && typeof cause === "object" && "message" in cause ? String(cause.message) : t("receipt.list.loadError"));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [companyId, search, filter, page, t]);

  useEffect(() => { void fetchQuittungen(); return () => { generation.current += 1; }; }, [fetchQuittungen]);
  useEffect(() => {
    if (!companyId) return;
    const refresh = () => { void fetchQuittungen(); };
    const channel = supabase.channel(`quittungen-list-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quittungen", filter: `company_id=eq.${companyId}` }, refresh).subscribe();
    window.addEventListener("focus", refresh);
    return () => { void supabase.removeChannel(channel); window.removeEventListener("focus", refresh); };
  }, [companyId, fetchQuittungen]);

  const deleteQuittung = useCallback(async (row: QuittungListItem): Promise<boolean> => {
    if (row.status !== "draft" || row.issued_at) {
      toast({ title: t("receipt.list.error"), description: t("receipt.list.deleteBlocked"), variant: "destructive" });
      return false;
    }
    try {
      const { data, error: deleteError } = await supabase.from("quittungen").delete()
        .eq("company_id", companyId ?? "").eq("id", row.id).eq("version", row.version).select("id").single();
      if (deleteError || !data) throw deleteError ?? new Error(t("receipt.list.invalid"));
      await fetchQuittungen();
      return true;
    } catch (cause) {
      toast({ title: t("receipt.list.error"), description: cause && typeof cause === "object" && "message" in cause ? String(cause.message) : t("receipt.list.deleteBlocked"), variant: "destructive" });
      return false;
    }
  }, [companyId, fetchQuittungen, toast, t]);

  return { quittungen, loading, error, count, stats, pageSize: PAGE_SIZE, fetchQuittungen, deleteQuittung };
};
