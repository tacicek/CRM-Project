import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt, Plus, Search, Eye, Edit, Download,
  MoreHorizontal, Loader2, CheckCircle, Clock, FileText,
  Banknote, X, Trash2,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { QuittungPDF } from "@/components/quittung/QuittungPDF";
import { logoToBase64 } from "@/lib/logoToBase64";
import { supabase } from "@/integrations/supabase/client";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Quittung, QuittungStatus, STATUS_CONFIG, formatChf,
} from "@/types/quittung.types";

const STATUS_TABS: { value: 'all' | QuittungStatus; label: string }[] = [
  { value: 'all',    label: 'Alle' },
  { value: 'draft',  label: 'Entwurf' },
  { value: 'signed', label: 'Unterzeichnet' },
  { value: 'sent',   label: 'Versendet' },
  { value: 'paid',   label: 'Bezahlt' },
];

export default function FirmaQuittungen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { company } = useCachedCompany(
    "id, company_name, logo_url, primary_color, email, phone, street, plz, city, mwst_number, iban, bank_name, bewertungs_url, crm_enabled"
  );
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Pre-fetch logo as base64 via Supabase Storage client (bypasses CORS reliably)
  const companyLogoUrl = (company as { logo_url?: string | null } | null)?.logo_url;
  useEffect(() => {
    logoToBase64(companyLogoUrl).then(b64 => { if (b64) setLogoBase64(b64); });
  }, [company, companyLogoUrl]);

  const companyForPdf = company ? {
    company_name: (company as { company_name: string }).company_name,
    logo_url: logoBase64 ?? (company as { logo_url?: string | null }).logo_url,
    primary_color: (company as { primary_color?: string | null }).primary_color,
    email: (company as { email: string }).email,
    phone: (company as { phone?: string | null }).phone,
    street: (company as { street?: string | null }).street,
    plz: (company as { plz?: string | null }).plz,
    city: (company as { city?: string | null }).city,
    mwst_number: (company as { mwst_number?: string | null }).mwst_number,
    iban: (company as { iban?: string | null }).iban,
    bank_name: (company as { bank_name?: string | null }).bank_name,
    bewertungs_url: (company as { bewertungs_url?: string | null }).bewertungs_url,
  } : null;

  const [quittungen, setQuittungen] = useState<Quittung[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | QuittungStatus>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("quittungen" as never)
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Quittungen load error:", error);
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
    } else if (data) {
      setQuittungen(data as unknown as Quittung[]);
    }
    setIsLoading(false);
  }, [company?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("quittungen").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setQuittungen(q => q.filter(x => x.id !== id));
      toast({ title: "Quittung gelöscht" });
    }
    setDeletingId(null);
  };

  const handleDownloadPdf = async (q: Quittung) => {
    if (!companyForPdf) return;
    setDownloadingId(q.id);
    try {
      const blob = await pdf(
        <QuittungPDF quittung={q} company={companyForPdf} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quittung-${q.quittung_nr || q.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF-Fehler", description: "Konnte PDF nicht erstellen", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase
      .from("quittungen")
      .update({ status: "paid" })
      .eq("id", id);
    if (!error) {
      setQuittungen(q => q.map(x => x.id === id ? { ...x, status: "paid" as QuittungStatus } : x));
      toast({ title: "Als bezahlt markiert" });
    }
  };

  const filtered = quittungen.filter(q => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.quittung_nr?.toLowerCase().includes(s) &&
          !q.customer_name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const stats = {
    total: quittungen.length,
    signed: quittungen.filter(q => q.status === "signed").length,
    paid: quittungen.filter(q => q.status === "paid").length,
    revenue: quittungen.filter(q => q.status === "paid")
      .reduce((s, q) => s + (q.gesamttotal || 0), 0),
  };

  return (
    <>
      <Helmet><title>Quittungen | Firma</title></Helmet>
        <div className="space-y-5">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-4 py-3 md:px-6 md:py-4 text-white">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base md:text-xl font-bold leading-tight">Quittungen</h1>
                <p className="text-white/70 text-[11px] hidden sm:block">Quittungen erstellen, unterzeichnen und versenden</p>
              </div>
              <Button
                onClick={() => navigate("/firma/quittungen/neu")}
                size="sm"
                className="shrink-0 bg-white text-emerald-700 hover:bg-white/90 shadow-md h-8 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Neue Quittung</span>
              </Button>
            </div>
          </div>

          {/* Stats */}
          {!isLoading && quittungen.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              {[
                { label: "Gesamt", value: stats.total, icon: FileText, color: "from-slate-100 to-slate-50", iconBg: "bg-slate-200", iconColor: "text-slate-600" },
                { label: "Unterzeichnet", value: stats.signed, icon: CheckCircle, color: "from-blue-50 to-indigo-50", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
                { label: "Bezahlt", value: stats.paid, icon: Banknote, color: "from-emerald-50 to-green-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
                { label: "Umsatz", value: formatChf(stats.revenue), icon: Banknote, color: "from-teal-50 to-cyan-50", iconBg: "bg-teal-100", iconColor: "text-teal-600" },
              ].map((s, i) => (
                <div key={i} className={`relative overflow-hidden rounded-xl p-3 md:p-4 bg-gradient-to-br ${s.color} border border-slate-200/50`}>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}>
                      <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-2xl font-bold text-slate-900 leading-tight truncate">{s.value}</p>
                      <p className="text-[10px] md:text-xs text-slate-500 truncate">{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-4 md:p-6">
              {/* Filters */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Nr. oder Kundenname..." className="pl-8 pr-7 h-9 text-sm" />
                  {search && (
                    <button onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
                  {STATUS_TABS.map(tab => (
                    <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                      className={`shrink-0 px-3 h-9 text-xs rounded-lg border font-medium transition-colors ${
                        statusFilter === tab.value
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-500">
                    {quittungen.length === 0 ? "Noch keine Quittungen" : "Keine Treffer"}
                  </p>
                  {quittungen.length === 0 && (
                    <Button size="sm" className="mt-4" onClick={() => navigate("/firma/quittungen/neu")}>
                      <Plus className="w-4 h-4 mr-2" /> Erste Quittung erstellen
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(q => {
                    const cfg = STATUS_CONFIG[q.status];
                    return (
                      <div key={q.id}
                        className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md transition-all">
                        <div className={`absolute top-0 left-0 w-full h-0.5 ${
                          q.status === "paid" ? "bg-emerald-400" :
                          q.status === "signed" ? "bg-blue-400" :
                          q.status === "sent" ? "bg-indigo-400" : "bg-slate-300"
                        }`} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => navigate(`/firma/quittungen/${q.id}`)}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-mono text-slate-400">{q.quittung_nr}</span>
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {q.customer_name || "–"}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500">
                                {format(new Date(q.datum), "dd. MMMM yyyy", { locale: de })}
                              </p>
                            </div>
                            {/* Quick PDF download — generated on-demand, no upfront render */}
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 shrink-0 text-slate-400 hover:text-emerald-600"
                              title="PDF herunterladen"
                              disabled={downloadingId === q.id}
                              onClick={e => { e.stopPropagation(); handleDownloadPdf(q); }}
                            >
                              {downloadingId === q.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Download className="w-4 h-4" />}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${q.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" /> Anzeigen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${q.id}/bearbeiten`)}>
                                  <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                                </DropdownMenuItem>
                                {q.pdf_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={q.pdf_url} target="_blank" rel="noreferrer">
                                      <Download className="w-4 h-4 mr-2" /> PDF herunterladen
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {q.status !== "paid" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleMarkPaid(q.id)}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                                      Als bezahlt markieren
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(q.id)}
                                  disabled={deletingId === q.id}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  {deletingId === q.id
                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    : <Trash2 className="w-4 h-4 mr-2" />}
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Badges + amount */}
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                {cfg.label}
                              </span>
                              {q.betrag_noch_offen && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                  <Clock className="w-2.5 h-2.5 mr-1" /> Offen
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {formatChf(q.gesamttotal || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
    </>
  );
}
