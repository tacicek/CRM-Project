import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Eye, Download, MoreHorizontal, Loader2, X, Trash2,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useRechnungen, rechnungToPdfData, type Rechnung } from "@/hooks/useRechnungen";
// downloadRechnungPdf is loaded on demand (see handler) so the @react-pdf + QR engine
// (~1 MB) is not pulled into the Rechnungen list route just to view invoices. The type
// import is erased at build time and costs nothing.
import { type RechnungCompany } from "@/lib/generateRechnungPdf";
import { logoToBase64 } from "@/lib/logoToBase64";
import { useToast } from "@/hooks/use-toast";
import {
  RECHNUNG_STATUS_LABELS, RECHNUNG_STATUS_COLORS, isRechnungStatus, type RechnungStatus,
} from "@/lib/rechnungStatus";
import { useI18n } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";

const STATUS_TABS: { value: "all" | RechnungStatus; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "entwurf", label: "Entwurf" },
  { value: "versendet", label: "Versendet" },
  { value: "bezahlt", label: "Bezahlt" },
  { value: "ueberfaellig", label: "Überfällig" },
];

interface CompanyRow {
  id: string;
  company_name: string;
  street: string | null;
  house_number: string | null;
  plz: string;
  city: string;
  phone: string | null;
  email: string;
  website: string | null;
  mwst_number: string | null;
  iban: string | null;
  logo_url: string | null;
}

export default function FirmaRechnungen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  // Dashboard locale — list amounts follow the operator. The PDF follows the invoice row
  // (rechnungToPdfData resolves rechnungen.language), not this.
  const { locale: uiLocale } = useI18n();
  const { companyId } = useCachedCompany();
  // Full company record (incl. plz/iban) — useCachedCompany ignores the select and only
  // returns activeCompany (id/name/logo); QR-Bill creditor address fields are required → fresh fetch.
  const [c, setC] = useState<CompanyRow | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    fetchSingleCompanyForUser<CompanyRow>({
      userId: user.id,
      userEmail: user.email,
      select: "id, company_name, street, house_number, plz, city, phone, email, website, mwst_number, iban, logo_url",
    }).then((row) => { if (row) setC(row); });
  }, [user?.id, user?.email]);

  const { rechnungen, loading, deleteRechnung } = useRechnungen(companyId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RechnungStatus>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const pdfCompany: RechnungCompany | null = c
    ? {
        company_name: c.company_name,
        street: c.street,
        house_number: c.house_number,
        plz: c.plz,
        city: c.city,
        phone: c.phone,
        email: c.email,
        website: c.website,
        mwst_number: c.mwst_number,
        iban: c.iban ?? "",
      }
    : null;

  const handleDownloadPdf = async (r: Rechnung) => {
    if (!pdfCompany) return;
    // The PDF uses the invoice's own qr_iban snapshot (or company.iban if absent) —
    // the guard must follow the same logic, otherwise it blocks needlessly even when qr_iban is filled.
    if (!(r.qr_iban || pdfCompany.iban)) {
      toast({ title: "IBAN fehlt", description: "Bitte IBAN in den Einstellungen hinterlegen.", variant: "destructive" });
      return;
    }
    // The QR-Bill creditor requires a structured address — if missing, show a clear warning instead of the cryptic "PLZ required".
    const missingAddr = [!pdfCompany.street?.trim() && "Strasse", !pdfCompany.plz?.trim() && "PLZ", !pdfCompany.city?.trim() && "Ort"].filter(Boolean) as string[];
    if (missingAddr.length > 0) {
      toast({ title: "Firmen-Adresse unvollständig", description: `Bitte ${missingAddr.join(", ")} in den Einstellungen hinterlegen.`, variant: "destructive" });
      return;
    }
    setDownloadingId(r.id);
    try {
      const logo = c?.logo_url ? await logoToBase64(c.logo_url) : null;
      const { downloadRechnungPdf } = await import("@/lib/generateRechnungPdf");
      await downloadRechnungPdf(rechnungToPdfData(r, pdfCompany), logo);
    } catch (e) {
      toast({ title: "PDF-Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const ok = await deleteRechnung(id);
    if (ok) toast({ title: "Rechnung gelöscht" });
    setDeletingId(null);
  };

  const filtered = useMemo(
    () =>
      rechnungen.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          if (!r.rechnung_nr?.toLowerCase().includes(s) && !r.customer_name?.toLowerCase().includes(s)) return false;
        }
        return true;
      }),
    [rechnungen, statusFilter, search],
  );

  const stats = useMemo(() => {
    const count = (st: RechnungStatus) => rechnungen.filter((r) => r.status === st).length;
    return {
      total: rechnungen.length,
      bezahlt: count("bezahlt"),
      ueberfaellig: count("ueberfaellig"),
      revenue: rechnungen.filter((r) => r.status === "bezahlt").reduce((s, r) => s + (r.gesamttotal || 0), 0),
      offen: count("entwurf") + count("versendet"),
    };
  }, [rechnungen]);

  const kpiTiles = [
    { emoji: "📄", label: "Gesamt", value: String(stats.total), isValue: false },
    { emoji: "📬", label: "Offen", value: String(stats.offen), isValue: false },
    { emoji: "⚠️", label: "Überfällig", value: String(stats.ueberfaellig), isValue: false },
    { emoji: "💰", label: "Umsatz", value: formatCurrency(stats.revenue, uiLocale), isValue: true },
  ];

  return (
    <>
      <Helmet><title>Rechnungen · CRM</title></Helmet>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📄</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Rechnungen</h1>
              <span className="text-[15px] text-folk-ink3">
                <span className="font-mono">{stats.total}</span> insgesamt · <span className="font-mono">{stats.bezahlt}</span> bezahlt · Umsatz <span className="font-mono">{formatCurrency(stats.revenue, uiLocale)}</span>
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              QR-Rechnungen aus abgeschlossenen Aufträgen erstellen und versenden.
            </p>
          </div>
          <Button
            onClick={() => navigate("/firma/rechnungen/neu")}
            className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
          >
            <Plus className="h-3.5 w-3.5" />
            Neue Rechnung
          </Button>
        </div>

        {/* KPI */}
        {!loading && rechnungen.length > 0 && (
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nr. oder Kundenname …"
                  className="h-9 rounded-lg border-folk-line bg-folk-card pl-8 pr-7 text-[15px] text-folk-ink placeholder:text-folk-ink4 focus-visible:ring-folk-coral/30"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-folk-ink4 hover:text-folk-ink2" aria-label="Suche löschen">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="scrollbar-none flex gap-1 overflow-x-auto">
                {STATUS_TABS.map((tab) => (
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
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">📄</div>
                <p className="font-semibold text-folk-ink">
                  {rechnungen.length === 0 ? "Noch keine Rechnungen" : "Keine Treffer"}
                </p>
                {rechnungen.length === 0 && (
                  <Button
                    size="sm"
                    className="mt-3 h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                    onClick={() => navigate("/firma/rechnungen/neu")}
                  >
                    <Plus className="h-3.5 w-3.5" /> Erste Rechnung erstellen
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => {
                  const status = isRechnungStatus(r.status) ? r.status : "entwurf";
                  return (
                    <article key={r.id} className="overflow-hidden rounded-xl border border-folk-line bg-folk-card transition-colors hover:border-folk-ink5">
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/firma/rechnungen/${r.id}`)}>
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="font-mono text-[10.5px] text-folk-ink4">{r.rechnung_nr}</span>
                              <p className="truncate text-[15px] font-semibold tracking-tight text-folk-ink">
                                {r.customer_name || "–"}
                              </p>
                            </div>
                            <p className="font-mono text-[11.5px] text-folk-ink3">
                              {format(new Date(r.datum), "dd. MMM yyyy", { locale: de })} · fällig {format(new Date(r.faellig_am), "dd. MMM yyyy", { locale: de })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-coral"
                            title="PDF herunterladen"
                            disabled={downloadingId === r.id}
                            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(r); }}
                          >
                            {downloadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/firma/rechnungen/${r.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> Anzeigen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPdf(r)}>
                                <Download className="mr-2 h-4 w-4" /> PDF herunterladen
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(r.id)}
                                disabled={deletingId === r.id}
                                className="text-folk-coral focus:text-folk-coral"
                              >
                                {deletingId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ${RECHNUNG_STATUS_COLORS[status]}`}>
                            {RECHNUNG_STATUS_LABELS[status]}
                          </span>
                          <span className="font-sans text-[14px] font-bold tracking-tight text-folk-ink">
                            {formatCurrency(r.gesamttotal || 0, uiLocale)}
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
