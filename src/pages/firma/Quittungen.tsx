import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Eye, Edit, Download, MoreHorizontal, Loader2, CheckCircle, Trash2, RefreshCw, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanyRecord } from "@/hooks/useCompanyRecord";
import { useQuittungen } from "@/hooks/useQuittungen";
import { ZahlungErfassenDialog } from "@/components/firma/ZahlungErfassenDialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import { getQuittungStatusLabel } from "@/i18n/domain";
import { supabase } from "@/integrations/supabase/client";
import { mapQuittungRow, type ReceiptCompanySnapshot } from "@/types/quittung.types";
import { downloadQuittungDocument } from "@/lib/quittungDocuments";
import { quittungPaymentAction, type QuittungListItem, type QuittungListFilter } from "@/lib/quittungList";
import { formatReceiptDate } from "@/lib/quittungPresentation";

interface QuittungCompany extends ReceiptCompanySnapshot { id: string }
const COMPANY_SELECT = "id,company_name,logo_url,primary_color,email,phone,street,house_number,plz,city,mwst_number,iban,bank_name,bewertungs_url";
const FILTERS: QuittungListFilter[] = ["all", "draft", "issued", "signed", "sent", "open", "partial", "paid"];
const PAYMENT_CLASS = { paid: "bg-folk-mint-bg text-folk-mint", partial: "bg-folk-lemon-bg text-folk-lemon", open: "bg-folk-bg-warm text-folk-ink3" };

export default function FirmaQuittungen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const { company, companyId } = useCompanyRecord<QuittungCompany>(COMPANY_SELECT);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<QuittungListFilter>("all");
  const [page, setPage] = useState(1);
  const [zahlungFuer, setZahlungFuer] = useState<QuittungListItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 250);
    return () => clearTimeout(timeout);
  }, [search]);
  const { quittungen, loading, error, count, stats, pageSize, fetchQuittungen, deleteQuittung } = useQuittungen(companyId, debouncedSearch, filter, page);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  useEffect(() => { if (!loading && !error && page > pages) setPage(pages); }, [loading, error, page, pages]);

  const download = async (row: QuittungListItem) => {
    if (!company || !companyId) return;
    setBusy(row.id);
    try {
      const { data, error: readError } = await supabase.from("quittungen").select("*").eq("id", row.id).eq("company_id", companyId).single();
      if (readError || !data) throw readError ?? new Error(t("receipt.notFound"));
      const mapped = mapQuittungRow(data);
      if (!mapped.ok) throw new Error(t("receipt.list.invalid"));
      await downloadQuittungDocument(mapped.value, company);
    } catch (cause) {
      toast({ title: t("receipt.list.downloadError"), description: cause instanceof Error ? cause.message : t("receipt.list.error"), variant: "destructive" });
    } finally { setBusy(null); }
  };
  const remove = async (row: QuittungListItem) => {
    setBusy(row.id);
    try { if (await deleteQuittung(row)) toast({ title: t("receipt.list.deleted") }); }
    finally { setBusy(null); }
  };
  const label = (value: QuittungListFilter) => value === "all" ? t("receipt.list.all")
    : value === "open" || value === "partial" || value === "paid" ? t(`receipt.payment.${value}`)
    : getQuittungStatusLabel(value, locale);

  return <>
    <Helmet><title>{t("receipt.list.title")}</title></Helmet>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1"><h1 className="text-2xl font-bold text-folk-ink">{t("receipt.list.title")}</h1><p className="mt-1 text-sm text-folk-ink3">{t("receipt.list.subtitle")}</p></div>
        <Button variant="outline" onClick={() => void fetchQuittungen()} disabled={loading} aria-label={t("receipt.list.refresh")}><RefreshCw className="size-4" /></Button>
        <Button onClick={() => navigate("/firma/quittungen/neu")}><Plus className="mr-2 size-4" />{t("receipt.new")}</Button>
      </div>
      {!error && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          [t("receipt.list.total"), stats.total], [getQuittungStatusLabel("issued", locale), stats.issued],
          [t("receipt.list.open"), stats.open], [t("receipt.list.paid"), stats.paid],
        ] as const).map(([title, value]) => <div key={title} className="rounded-xl border border-folk-line bg-folk-card p-4"><p className="text-xs font-semibold text-folk-ink3">{title}</p><p className="mt-2 text-2xl font-bold text-folk-ink">{value}</p></div>)}
      </div>}
      <section className="rounded-xl border border-folk-line bg-folk-card p-4 md:p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-3 size-4 text-folk-ink3" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("receipt.list.search")} aria-label={t("receipt.list.search")} className="pl-9" /></div>
          <div className="flex max-w-full gap-1 overflow-x-auto">{FILTERS.map(value => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => { setFilter(value); setPage(1); }}>{label(value)}</Button>)}</div>
        </div>
        {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5"><p className="font-medium">{t("receipt.list.loadError")}</p><p className="mt-1 text-sm">{error}</p><Button className="mt-3" variant="outline" onClick={() => void fetchQuittungen()}>{t("receipt.list.retry")}</Button></div>
          : loading ? <div className="flex justify-center p-12"><Loader2 className="size-7 animate-spin" /></div>
          : quittungen.length === 0 ? <p className="py-12 text-center text-folk-ink3">{count === 0 && !debouncedSearch && filter === "all" ? t("receipt.list.empty") : t("receipt.list.noResults")}</p>
          : <div className="space-y-3">{quittungen.map(row => {
            const action = quittungPaymentAction(row);
            return <article key={row.id} className="rounded-xl border border-folk-line p-4">
              <div className="flex items-start gap-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/firma/quittungen/${row.id}`)}>
                  <span className="font-mono text-xs text-folk-ink3">{row.quittung_nr}</span><p className="truncate font-semibold text-folk-ink">{row.customer_name || "–"}</p><p className="text-xs text-folk-ink3">{formatReceiptDate(row.datum, locale)}</p>
                </button>
                <Button variant="ghost" size="icon" aria-label={t("receipt.list.download")} disabled={busy === row.id} onClick={() => void download(row)}>{busy === row.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}</Button>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("receipt.list.actions")}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${row.id}`)}><Eye className="mr-2 size-4" />{t("receipt.list.details")}</DropdownMenuItem>
                    {!row.issued_at && row.status === "draft" && <><DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${row.id}/bearbeiten`)}><Edit className="mr-2 size-4" />{t("receipt.list.edit")}</DropdownMenuItem><DropdownMenuItem disabled={busy === row.id} onClick={() => void remove(row)}><Trash2 className="mr-2 size-4" />{t("receipt.list.delete")}</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2"><span className="rounded-md bg-folk-bg-warm px-2 py-1 text-xs">{getQuittungStatusLabel(row.status, locale)}</span>{row.issued_at && <span className={`rounded-md px-2 py-1 text-xs ${PAYMENT_CLASS[row.payment_status]}`}>{t(`receipt.payment.${row.payment_status}`)}</span>}{row.rechnung_id && <span className="rounded-md bg-folk-sky-bg px-2 py-1 text-xs text-folk-sky">{t("receipt.list.paymentViaInvoice")}</span>}</div>
                <strong>{formatCurrency(row.gesamttotal, locale)}</strong>
              </div>
              {action && <div className="mt-3">{action === "invoice" ? <Button size="sm" variant="outline" onClick={() => navigate(`/firma/rechnungen/${row.rechnung_id}`)}><FileText className="mr-2 size-4" />{t("receipt.openInvoice")}</Button> : <Button size="sm" variant="outline" onClick={() => setZahlungFuer(row)}><CheckCircle className="mr-2 size-4" />{t("receipt.markPaid")}</Button>}</div>}
            </article>;
          })}</div>}
        <div className="mt-5 flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>{t("receipt.list.previous")}</Button><span className="text-xs">{t("receipt.list.page", { page, pages })}</span><Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>{t("receipt.list.next")}</Button></div>
      </section>
    </div>
    {zahlungFuer && companyId && <ZahlungErfassenDialog open onOpenChange={open => { if (!open) setZahlungFuer(null); }} companyId={companyId}
      quittung={{ id: zahlungFuer.id, nr: zahlungFuer.quittung_nr, betrag: zahlungFuer.gesamttotal }}
      onDone={() => { setZahlungFuer(null); void fetchQuittungen(); }} />}
  </>;
}
