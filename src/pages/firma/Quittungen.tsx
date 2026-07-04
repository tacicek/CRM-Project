import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Eye, Edit, Download,
  MoreHorizontal, Loader2, CheckCircle, Clock,
  X, Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { QuittungPDF } from "@/components/quittung/QuittungPDF";
import { logoToBase64 } from "@/lib/logoToBase64";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useQuittungen } from "@/hooks/useQuittungen";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Quittung, QuittungStatus, formatChf,
} from "@/types/quittung.types";

const STATUS_TABS: { value: 'all' | QuittungStatus; label: string }[] = [
  { value: 'all',    label: 'Alle' },
  { value: 'draft',  label: 'Entwurf' },
  { value: 'signed', label: 'Unterzeichnet' },
  { value: 'sent',   label: 'Versendet' },
  { value: 'paid',   label: 'Bezahlt' },
];

// Folk-style status mapping
const FOLK_STATUS: Record<QuittungStatus, { label: string; color: string; bg: string }> = {
  draft:  { label: "Entwurf",       color: "text-folk-ink3",  bg: "bg-folk-bg-warm" },
  signed: { label: "Unterzeichnet", color: "text-folk-sky",   bg: "bg-folk-sky-bg" },
  sent:   { label: "Versendet",     color: "text-folk-violet", bg: "bg-folk-violet-bg" },
  paid:   { label: "Bezahlt",       color: "text-folk-mint",  bg: "bg-folk-mint-bg" },
};

interface QuittungCompany {
  id: string;
  company_name: string;
  email: string;
  logo_url?: string | null;
  primary_color?: string | null;
  phone?: string | null;
  street?: string | null;
  plz?: string | null;
  city?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  bewertungs_url?: string | null;
}

export default function FirmaQuittungen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { companyId } = useCachedCompany();
  // Full company record (incl. address/iban/bank) — useCachedCompany ignores the select → fresh fetch.
  const [company, setCompany] = useState<QuittungCompany | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    fetchSingleCompanyForUser<QuittungCompany>({
      userId: user.id,
      userEmail: user.email,
      select: "id, company_name, logo_url, primary_color, email, phone, street, plz, city, mwst_number, iban, bank_name, bewertungs_url, crm_enabled",
    }).then((row) => { if (row) setCompany(row); });
  }, [user?.id, user?.email]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const companyLogoUrl = company?.logo_url;
  useEffect(() => {
    logoToBase64(companyLogoUrl).then(b64 => { if (b64) setLogoBase64(b64); });
  }, [company, companyLogoUrl]);

  const companyForPdf = company ? {
    company_name: company.company_name,
    logo_url: logoBase64 ?? company.logo_url,
    primary_color: company.primary_color,
    email: company.email,
    phone: company.phone,
    street: company.street,
    plz: company.plz,
    city: company.city,
    mwst_number: company.mwst_number,
    iban: company.iban,
    bank_name: company.bank_name,
    bewertungs_url: company.bewertungs_url,
  } : null;

  const { quittungen, loading: isLoading, updateQuittung, deleteQuittung } = useQuittungen(companyId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | QuittungStatus>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const ok = await deleteQuittung(id);
    if (ok) toast({ title: "Quittung gelöscht" });
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
    // E: keep the two payment indicators in sync — marking paid also clears the
    // "noch offen" flag (otherwise the receipt shows "bezahlt" AND "Offen" at once).
    const updated = await updateQuittung(id, { status: "paid", betrag_noch_offen: false });
    if (updated) toast({ title: "Als bezahlt markiert" });
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

  const kpiTiles = [
    { emoji: "🧾", label: "Gesamt",        value: stats.total,             isValue: false },
    { emoji: "✍️", label: "Unterzeichnet", value: stats.signed,            isValue: false },
    { emoji: "✅", label: "Bezahlt",       value: stats.paid,              isValue: false },
    { emoji: "💰", label: "Umsatz",        value: formatChf(stats.revenue), isValue: true },
  ];

  return (
    <>
      <Helmet><title>Quittungen · CRM</title></Helmet>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">🧾</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Quittungen</h1>
              <span className="text-[15px] text-folk-ink3">
                <span className="font-mono">{stats.total}</span> insgesamt · <span className="font-mono">{stats.paid}</span> bezahlt · Umsatz <span className="font-mono">{formatChf(stats.revenue)}</span>
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              Quittungen vor Ort erstellen, unterzeichnen und an Kunden versenden.
            </p>
          </div>
          <Button
            onClick={() => navigate("/firma/quittungen/neu")}
            className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
          >
            <Plus className="h-3.5 w-3.5" />
            Neue Quittung
          </Button>
        </div>

        {/* KPI */}
        {!isLoading && quittungen.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {kpiTiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-folk-line bg-folk-card p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                  <span className="text-xl leading-none">{tile.emoji}</span>
                </div>
                <div className={`mt-3 font-sans font-bold tracking-tight text-folk-ink ${tile.isValue ? "text-lg md:text-xl" : "text-3xl"}`}>
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List card */}
        <section className="rounded-xl border border-folk-line bg-folk-card">
          <div className="p-4 md:p-6">
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-folk-ink3" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nr. oder Kundenname …"
                  className="h-9 rounded-lg border-folk-line bg-folk-card pl-8 pr-7 text-[15px] text-folk-ink placeholder:text-folk-ink4 focus-visible:ring-folk-coral/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-folk-ink4 hover:text-folk-ink2"
                    aria-label="Suche löschen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="scrollbar-none flex gap-1 overflow-x-auto">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`h-9 shrink-0 rounded-lg border px-3 text-[12.5px] font-medium transition-colors ${
                      statusFilter === tab.value
                        ? "border-folk-ink bg-folk-ink text-white"
                        : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">🧾</div>
                <p className="font-semibold text-folk-ink">
                  {quittungen.length === 0 ? "Noch keine Quittungen" : "Keine Treffer"}
                </p>
                {quittungen.length === 0 && (
                  <Button
                    size="sm"
                    className="mt-3 h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                    onClick={() => navigate("/firma/quittungen/neu")}
                  >
                    <Plus className="h-3.5 w-3.5" /> Erste Quittung erstellen
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(q => {
                  const cfg = FOLK_STATUS[q.status];
                  return (
                    <article
                      key={q.id}
                      className="overflow-hidden rounded-xl border border-folk-line bg-folk-card transition-colors hover:border-folk-ink5"
                    >
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => navigate(`/firma/quittungen/${q.id}`)}
                          >
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="font-mono text-[10.5px] text-folk-ink4">{q.quittung_nr}</span>
                              <p className="truncate text-[15px] font-semibold tracking-tight text-folk-ink">
                                {q.customer_name || "–"}
                              </p>
                            </div>
                            <p className="font-mono text-[11.5px] text-folk-ink3">
                              {format(new Date(q.datum), "dd. MMMM yyyy", { locale: de })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-coral"
                            title="PDF herunterladen"
                            disabled={downloadingId === q.id}
                            onClick={e => { e.stopPropagation(); handleDownloadPdf(q); }}
                          >
                            {downloadingId === q.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${q.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> Anzeigen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/firma/quittungen/${q.id}/bearbeiten`)}>
                                <Edit className="mr-2 h-4 w-4" /> Bearbeiten
                              </DropdownMenuItem>
                              {q.pdf_url && (
                                <DropdownMenuItem asChild>
                                  <a href={q.pdf_url} target="_blank" rel="noreferrer">
                                    <Download className="mr-2 h-4 w-4" /> PDF herunterladen
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {q.status !== "paid" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleMarkPaid(q.id)}>
                                    <CheckCircle className="mr-2 h-4 w-4 text-folk-mint" />
                                    Als bezahlt markieren
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(q.id)}
                                disabled={deletingId === q.id}
                                className="text-folk-coral focus:text-folk-coral"
                              >
                                {deletingId === q.id
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <Trash2 className="mr-2 h-4 w-4" />}
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {q.betrag_noch_offen && (
                              <span className="inline-flex items-center rounded-md bg-folk-lemon-bg px-2 py-0.5 text-[13px] font-semibold text-folk-lemon">
                                <Clock className="mr-1 h-2.5 w-2.5" /> Offen
                              </span>
                            )}
                          </div>
                          <span className="font-sans text-[14px] font-bold tracking-tight text-folk-ink">
                            {formatChf(q.gesamttotal || 0)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
