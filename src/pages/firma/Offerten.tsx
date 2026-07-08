import { Helmet } from "react-helmet-async";
import { AuftragModal } from "@/components/firma/AuftragModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Plus,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  ClipboardList,
  Building2,
  Server,
  MapPin,
  Home,
  Pencil,
  RefreshCw,
  MoreHorizontal,
  Send,
  FileCheck,
  CalendarPlus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getServiceLabel } from "@/lib/serviceLabels";
import { sendOffer } from "@/lib/sendOffer";
import { RATE_AGGREGATE_SHORT } from "@/lib/offerPricing";

interface Offer {
  id: string;
  offer_number: number | null;
  title: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  valid_until: string | null;
  checklist_url: string | null;
  lead_id: string;
  service_date: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  price_model?: 'pauschal' | 'stundenansatz' | 'kostendach' | null;
  kostendach_max?: number | null;
  offerte_type?: 'normal' | 'blind' | null;
}

interface LeadInfo {
  id: string;
  service_type: string;
  from_city: string;
  from_plz: string;
  to_city: string | null;
  to_plz: string | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  preferred_date: string | null;
}

interface EmailLogInfo {
  offer_id: string;
  from_email: string;
  is_company_email: boolean;
}

interface ChecklistTemplate {
  service_type: string;
  title: string;
}

interface OfferStats {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
  rejected: number;
  totalValue: number;
  acceptedValue: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSizeOption = typeof PAGE_SIZE_OPTIONS[number];

interface PaginationBarProps {
  total: number;
  page: number;
  pageSize: PageSizeOption;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSizeOption) => void;
}

const PaginationBar = ({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationBarProps) => {
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | "...")[] = [];
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p); };
  addPage(1);
  if (page > 3) pages.push("...");
  if (page > 2) addPage(page - 1);
  addPage(page);
  if (page < totalPages - 1) addPage(page + 1);
  if (page < totalPages - 2) pages.push("...");
  if (totalPages > 1) addPage(totalPages);

  return (
    <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-folk-line pt-4 sm:flex-row">
      <div className="flex items-center gap-3 text-[12.5px] text-folk-ink3">
        <span><span className="font-mono">{from}–{to}</span> von <span className="font-mono">{total}</span></span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v) as PageSizeOption); onPageChange(1); }}>
          <SelectTrigger className="h-8 w-[110px] rounded-md border-folk-line bg-folk-card text-[14px] text-folk-ink2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-[14px]">{s} pro Seite</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-folk-line bg-folk-card text-folk-ink3 transition-colors hover:bg-folk-bg-warm disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-1 text-[12.5px] text-folk-ink4">…</span>
            ) : (
              <button
                key={p}
                className={`flex h-8 w-8 items-center justify-center rounded-md border font-mono text-[14px] transition-colors ${
                  p === page
                    ? "border-folk-ink bg-folk-ink text-white"
                    : "border-folk-line bg-folk-card text-folk-ink2 hover:bg-folk-bg-warm"
                }`}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-folk-line bg-folk-card text-folk-ink3 transition-colors hover:bg-folk-bg-warm disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// Folk-style status meta
const STATUS_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  draft:    { label: "Entwurf",    emoji: "📝", color: "text-folk-ink3",   bg: "bg-folk-bg-warm" },
  sent:     { label: "Gesendet",   emoji: "📤", color: "text-folk-sky",    bg: "bg-folk-sky-bg" },
  viewed:   { label: "Angesehen",  emoji: "👀", color: "text-folk-lemon",  bg: "bg-folk-lemon-bg" },
  accepted: { label: "Angenommen", emoji: "✅", color: "text-folk-mint",   bg: "bg-folk-mint-bg" },
  rejected: { label: "Abgelehnt",  emoji: "❌", color: "text-folk-coral",  bg: "bg-folk-coral-bg" },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, emoji: "📄", color: "text-folk-ink3", bg: "bg-folk-bg-warm" };
}

const FirmaOfferten = () => {
  const { user } = useAuth();
  const { companyId } = useCachedCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [auftragOffer, setAuftragOffer] = useState<Offer | null>(null);
  const [offersWithAuftrag, setOffersWithAuftrag] = useState<Set<string>>(new Set());
  // Offerten mit mindestens einem rate-Posten (amount_basis='rate') — Betrag-Spalte zeigt dann
  // „nach Aufwand" statt einer irreführenden Fix-Summe (spiegelt offerHasRateItem).
  const [rateOfferIds, setRateOfferIds] = useState<Set<string>>(new Set());
  const [_checklistMap, setChecklistMap] = useState<Record<string, string>>({});
  const [_leadServiceTypes, setLeadServiceTypes] = useState<Record<string, string>>({});
  const [leadInfoMap, setLeadInfoMap] = useState<Record<string, LeadInfo>>({});
  const [emailLogs, setEmailLogs] = useState<Record<string, EmailLogInfo>>({});
  const [stats, setStats] = useState<OfferStats>({
    total: 0,
    draft: 0,
    sent: 0,
    viewed: 0,
    accepted: 0,
    rejected: 0,
    totalValue: 0,
    acceptedValue: 0,
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'normal' | 'blind'>('all');
  const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
    if (typeof window !== "undefined") {
      const s = parseInt(localStorage.getItem("offerten_pageSize") || "10", 10);
      return (PAGE_SIZE_OPTIONS as readonly number[]).includes(s) ? (s as PageSizeOption) : 10;
    }
    return 10;
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [activeFilter, pageSize, searchQuery, typeFilter]);

  const handleResendOffer = async (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!companyId) return;
    setIsResending(offerId);

    try {
      const result = await sendOffer({ offerId, companyId, forceResend: true });

      if (!result.success) {
        toast({
          title: "E-Mail nicht gesendet",
          description: result.error ?? "Die Offerte konnte nicht per E-Mail gesendet werden. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Offerte gesendet",
        description: "Die Offerte wurde erfolgreich per E-Mail an den Kunden gesendet.",
        variant: "success",
      });

      const { data: updatedOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("id", offerId)
        .single();

      if (updatedOffer) {
        setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));
      }
    } finally {
      setIsResending(null);
    }
  };

  const handleAddToCalendar = (offer: Offer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!offer.lead_id) {
      toast({
        title: "Lead fehlt",
        description: "Dieser Offerte ist kein Lead zugeordnet.",
        variant: "destructive",
      });
      return;
    }
    // From an offer → a service appointment (not Besichtigung); carry the offer title.
    const params = new URLSearchParams({
      newAppointment: "true",
      leadId: offer.lead_id,
      type: "service",
      title: offer.title ?? "",
    });
    navigate(`/firma/kalender?${params.toString()}`);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOffers = async () => {
      if (!user || !companyId) return;

      try {
        const { data: offersData, error: offersError } = await supabase
          .from("offers")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(200);

        if (offersError) throw offersError;
        if (!isMounted) return;

        setOffers(offersData || []);

        // Welche dieser Offerten haben mindestens einen rate-Posten? amount_basis='rate' ist die
        // exakte DB-Projektion der resolveAmountBasis-'rate'-Regel (rate ist immer explizit).
        const allOfferIds = (offersData || []).map((o: Offer) => o.id).filter(Boolean);
        if (allOfferIds.length > 0) {
          const { data: rateItemsData } = await supabase
            .from("offer_items")
            .select("offer_id")
            .eq("amount_basis", "rate")
            .in("offer_id", allOfferIds);
          if (!isMounted) return;
          setRateOfferIds(
            new Set<string>((rateItemsData || []).map((r: { offer_id: string }) => r.offer_id).filter(Boolean)),
          );
        }

        const offersArr = offersData || [];
        const calculatedStats: OfferStats = {
          total: offersArr.length,
          draft: offersArr.filter((o: Offer) => o.status === 'draft').length,
          sent: offersArr.filter((o: Offer) => o.status === 'sent').length,
          viewed: offersArr.filter((o: Offer) => o.status === 'viewed').length,
          accepted: offersArr.filter((o: Offer) => o.status === 'accepted').length,
          rejected: offersArr.filter((o: Offer) => o.status === 'rejected').length,
          totalValue: offersArr.reduce((sum: number, o: Offer) => sum + Number(o.total || 0), 0),
          acceptedValue: offersArr.filter((o: Offer) => o.status === 'accepted').reduce((sum: number, o: Offer) => sum + Number(o.total || 0), 0),
        };
        setStats(calculatedStats);

        const { data: checklistData } = await supabase
          .from("checklist_templates")
          .select("service_type, title")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .eq("include_in_offerte", true);

        if (!isMounted) return;
        if (checklistData) {
          const map: Record<string, string> = {};
          checklistData.forEach((template: ChecklistTemplate) => {
            map[template.service_type] = template.title;
          });
          setChecklistMap(map);
        }

        const leadIds = (offersData || []).map((o: Offer) => o.lead_id).filter(Boolean);
        if (leadIds.length > 0) {
          const { data: leadsData } = await supabase
            .from("leads")
            .select("id, service_type, from_city, from_plz, to_city, to_plz, from_rooms, from_living_space_m2, from_floor, from_has_lift, to_floor, to_has_lift, preferred_date")
            .in("id", leadIds);

          if (!isMounted) return;
          if (leadsData) {
            const serviceMap: Record<string, string> = {};
            const infoMap: Record<string, LeadInfo> = {};
            leadsData.forEach((lead: LeadInfo) => {
              serviceMap[lead.id] = lead.service_type;
              infoMap[lead.id] = lead;
            });
            setLeadServiceTypes(serviceMap);
            setLeadInfoMap(infoMap);
          }
        }

        // Fetch which accepted offers already have an auftrag
        const acceptedOfferIds = (offersData || [])
          .filter((o: Offer) => o.status === "accepted")
          .map((o: Offer) => o.id);
        if (acceptedOfferIds.length > 0) {
          const { data: auftraegeData } = await supabase
            .from("auftraege")
            .select("offer_id")
            .in("offer_id", acceptedOfferIds);
          if (!isMounted) return;
          const withAuftragSet = new Set<string>(
            (auftraegeData || []).map((a: { offer_id: string }) => a.offer_id).filter(Boolean)
          );
          setOffersWithAuftrag(withAuftragSet);
        }

        const sentOffers = (offersData || []).filter((o: Offer) => o.sent_at);
        if (sentOffers.length > 0) {
          const offerIds = sentOffers.map((o: Offer) => o.id);
          const { data: emailLogsData } = await supabase
            .from("email_logs")
            .select("metadata")
            .eq("email_type", "offer_sent")
            .eq("company_id", companyId)
            .in("metadata->>offer_id" as string, offerIds);

          if (!isMounted) return;
          if (emailLogsData) {
            const logsMap: Record<string, EmailLogInfo> = {};
            emailLogsData
              .filter((log: { metadata: { offer_id?: string; from_email?: string; is_company_email?: boolean } | null }) =>
                log.metadata?.offer_id && offerIds.includes(log.metadata.offer_id)
              )
              .forEach((log: { metadata: { offer_id?: string; from_email?: string; is_company_email?: boolean } | null }) => {
                if (log.metadata?.offer_id) {
                  logsMap[log.metadata.offer_id] = {
                    offer_id: log.metadata.offer_id,
                    from_email: log.metadata.from_email || 'System',
                    is_company_email: log.metadata.is_company_email || false,
                  };
                }
              });
            setEmailLogs(logsMap);
          }
        }
      } catch (error) {
        console.error("Error fetching offers:", error);
        if (isMounted) {
          toast({
            title: "Fehler beim Laden",
            description: "Die Offerten konnten nicht geladen werden.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchOffers();
    return () => { isMounted = false; };
  }, [user, companyId, toast]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(amount);
  };

  // Status icon (mapped to a Lucide icon for desktop table reusability)
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return FileText;
      case "sent": return Send;
      case "viewed": return Eye;
      case "accepted": return CheckCircle;
      case "rejected": return XCircle;
      default: return FileText;
    }
  };

  const renderMobileOfferCard = (offer: Offer) => {
    const status = getStatusMeta(offer.status);
    const leadInfo = leadInfoMap[offer.lead_id];

    return (
      <article
        key={offer.id}
        className="overflow-hidden rounded-xl border border-folk-line bg-folk-card transition-colors hover:border-folk-ink5"
      >
        <div className="p-4">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => navigate(`/firma/offerten/${offer.id}`)}
            >
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 font-mono text-[10.5px] text-folk-ink4">
                  #{offer.offer_number ?? offer.id.slice(0, 6).toUpperCase()}
                </span>
                <p className="line-clamp-1 min-w-0 text-[15px] font-semibold leading-tight tracking-tight text-folk-ink">
                  {offer.title}
                </p>
              </div>
              <p className="text-[14px] text-folk-ink3">
                {offer.customer_first_name} {offer.customer_last_name}
              </p>
              {leadInfo && (
                <div className="mt-1 flex items-center gap-1 text-[13px] text-folk-ink4">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{leadInfo.from_city}{leadInfo.to_city ? ` → ${leadInfo.to_city}` : ''}</span>
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm" aria-label="Mehr Optionen">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/firma/offerten/${offer.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Anzeigen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/firma/offerte-bearbeiten/${offer.id}`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                {offer.status === "accepted" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAddToCalendar(offer)}>
                      <CalendarPlus className="mr-2 h-4 w-4 text-folk-mint" />
                      Zum Kalender hinzufügen
                    </DropdownMenuItem>
                    {offersWithAuftrag.has(offer.id) ? (
                      <DropdownMenuItem onClick={() => navigate("/firma/auftraege")}>
                        <FileCheck className="mr-2 h-4 w-4 text-folk-mint" />
                        Auftrag anzeigen
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setAuftragOffer(offer)}>
                        <FileCheck className="mr-2 h-4 w-4 text-folk-sky" />
                        Auftrag erstellen
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleResendOffer(offer.id, e as unknown as React.MouseEvent)}
                  disabled={isResending === offer.id || ["accepted", "rejected"].includes(offer.status)}
                >
                  {isResending === offer.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Erneut senden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Badges */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-semibold ${status.bg} ${status.color}`}>
              <span>{status.emoji}</span>
              {status.label}
            </span>
            {offer.offerte_type === 'blind' && (
              <span className="inline-flex items-center rounded-md bg-folk-lemon-bg px-2 py-0.5 text-[13px] font-semibold text-folk-lemon">
                Blind
              </span>
            )}
            {offer.price_model === 'stundenansatz' && (
              <span className="inline-flex items-center rounded-md bg-folk-sky-bg px-2 py-0.5 text-[13px] font-semibold text-folk-sky">
                Stundenansatz
              </span>
            )}
            {offer.price_model === 'kostendach' && (
              <span className="inline-flex items-center rounded-md bg-folk-mint-bg px-2 py-0.5 text-[13px] font-semibold text-folk-mint">
                {offer.kostendach_max !== null && offer.kostendach_max !== undefined
                  ? `Kostendach CHF ${Number(offer.kostendach_max).toLocaleString('de-CH')}`
                  : 'Kostendach'}
              </span>
            )}
            {(!offer.price_model || offer.price_model === 'pauschal') && (
              <span className="inline-flex items-center rounded-md bg-folk-bg-warm px-2 py-0.5 text-[13px] font-medium text-folk-ink3">
                Pauschal
              </span>
            )}
          </div>

          {/* Amount + Date */}
          <div
            className="mb-3 flex cursor-pointer items-center justify-between border-b border-folk-line pb-3"
            onClick={() => navigate(`/firma/offerten/${offer.id}`)}
          >
            <span className="font-sans text-xl font-bold tracking-tight text-folk-ink">
              {rateOfferIds.has(offer.id)
                ? <span className="text-base font-semibold text-folk-ink3">{RATE_AGGREGATE_SHORT}</span>
                : formatCurrency(Number(offer.total))}
            </span>
            <span className="font-mono text-[13px] text-folk-ink4">{formatDate(offer.created_at)}</span>
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-[11.5px]">
            <div className="flex items-center gap-3">
              {offer.sent_at && (
                <div className="flex items-center gap-1.5">
                  {emailLogs[offer.id]?.is_company_email ? (
                    <Building2 className="h-3.5 w-3.5 text-folk-mint" />
                  ) : (
                    <Server className="h-3.5 w-3.5 text-folk-sky" />
                  )}
                  <span className="text-folk-ink3">
                    {emailLogs[offer.id]?.is_company_email ? "Firma" : "System"}
                  </span>
                </div>
              )}
              {offer.checklist_url && (
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-folk-mint" />
                  <span className="text-folk-ink3">Checkliste</span>
                </div>
              )}
            </div>
            {offer.valid_until && (
              <span className="font-mono text-folk-ink4">bis {formatDate(offer.valid_until)}</span>
            )}
          </div>
        </div>
      </article>
    );
  };

  // KPI tiles config — Folk style: emoji + label + value, single coral highlight ring on active filter
  const kpiTiles = [
    { key: null,           emoji: "📄", label: "Gesamt",     value: stats.total,                       isValue: false },
    { key: "ausstehend",   emoji: "⏳", label: "Ausstehend", value: stats.sent + stats.viewed,         isValue: false },
    { key: "angenommen",   emoji: "✅", label: "Angenommen", value: stats.accepted,                    isValue: false },
    { key: "angenommen_w", emoji: "💰", label: "Wert",       value: formatCurrency(stats.acceptedValue), isValue: true },
  ];

  return (
    <>
      <Helmet>
        <title>Offerten · CRM</title>
      </Helmet>

      <div className="space-y-5">
        {/* Folk-style page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📄</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Offerten</h1>
              <span className="text-[15px] text-folk-ink3">
                <span className="font-mono">{stats.total}</span> insgesamt · <span className="font-mono">{stats.sent + stats.viewed}</span> ausstehend · Wert <span className="font-mono">{formatCurrency(stats.acceptedValue)}</span>
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              Alle versandten und gespeicherten Angebote — Status, Werte und Versandkanal auf einen Blick.
            </p>
          </div>
          <Button
            onClick={() => navigate("/firma/anfragen")}
            className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
          >
            <Plus className="h-3.5 w-3.5" />
            Neue Offerte
          </Button>
        </div>

        {/* KPI grid */}
        {!isLoading && offers.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {kpiTiles.map((tile) => {
              const filterKey = tile.key === "angenommen_w" ? "angenommen" : tile.key;
              const isActive = activeFilter === filterKey;
              return (
                <button
                  key={tile.label}
                  onClick={() => setActiveFilter(filterKey)}
                  className={`group relative overflow-hidden rounded-xl border bg-folk-card p-4 text-left transition-all md:p-5 ${
                    isActive ? "border-folk-coral/30 ring-1 ring-folk-coral/20" : "border-folk-line"
                  } hover:border-folk-ink5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                    <span className="text-xl leading-none">{tile.emoji}</span>
                  </div>
                  <div className={`mt-3 font-sans font-bold tracking-tight text-folk-ink ${tile.isValue ? "text-lg md:text-xl" : "text-3xl"}`}>
                    {tile.value}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Offers list container */}
        <section className="rounded-xl border border-folk-line bg-folk-card">
          <div className="p-4 md:p-6">
            {/* List header */}
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl leading-none">📋</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-folk-ink">
                  {activeFilter === null ? "Alle Offerten" : activeFilter === "ausstehend" ? "Ausstehende" : "Angenommene"}
                </h2>
                <p className="text-[11.5px] text-folk-ink3">
                  {activeFilter === null
                    ? <><span className="font-mono">{offers.length}</span> insgesamt</>
                    : activeFilter === "ausstehend"
                      ? <><span className="font-mono">{offers.filter((o) => o.status === "sent" || o.status === "viewed").length}</span> ausstehend</>
                      : <><span className="font-mono">{offers.filter((o) => o.status === "accepted").length}</span> angenommen</>}
                </p>
              </div>
              {activeFilter !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFilter(null)}
                  className="h-8 shrink-0 rounded-lg border-folk-line bg-folk-card px-2.5 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                >
                  <X className="mr-1 h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            {/* Search + type filter */}
            <div className="mb-4 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-folk-ink3" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nr., Name oder Titel …"
                  className="h-9 rounded-lg border-folk-line bg-folk-card pl-8 pr-7 text-[15px] text-folk-ink placeholder:text-folk-ink4 focus-visible:ring-folk-coral/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-folk-ink4 hover:text-folk-ink2"
                    aria-label="Suche löschen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'normal' | 'blind')}>
                <SelectTrigger className="h-9 w-28 shrink-0 rounded-lg border-folk-line bg-folk-card text-[12.5px] text-folk-ink2 sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Arten</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="blind">Blind</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="mb-3 h-7 w-7 animate-spin text-folk-coral" />
                <p className="text-[15px] text-folk-ink3">Lade Offerten …</p>
              </div>
            ) : offers.length > 0 ? (
              <>
                {(() => {
                  const q = searchQuery.trim().toLowerCase();
                  const statusFiltered = activeFilter === null
                    ? offers
                    : activeFilter === "ausstehend"
                      ? offers.filter((o) => o.status === "sent" || o.status === "viewed")
                      : activeFilter === "angenommen"
                        ? offers.filter((o) => o.status === "accepted")
                        : offers;

                  const typeFiltered = typeFilter === 'all'
                    ? statusFiltered
                    : statusFiltered.filter((o) => (o.offerte_type ?? 'normal') === typeFilter);

                  const filteredOffers = q
                    ? typeFiltered.filter((o) => {
                        const fullName = `${o.customer_first_name} ${o.customer_last_name}`.toLowerCase();
                        const nr = o.offer_number ? String(o.offer_number) : o.id.slice(0, 8).toUpperCase().toLowerCase();
                        return (
                          nr.includes(q) ||
                          fullName.includes(q) ||
                          o.title.toLowerCase().includes(q) ||
                          o.customer_email.toLowerCase().includes(q)
                        );
                      })
                    : typeFiltered;

                  const pagedOffers = filteredOffers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                  if (filteredOffers.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">🔍</div>
                        <p className="font-semibold text-folk-ink">Keine Offerte gefunden</p>
                        <p className="mt-1 text-[14px] text-folk-ink3">
                          Kein Ergebnis für „{searchQuery}"
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 h-8 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                          onClick={() => setSearchQuery("")}
                        >
                          Suche zurücksetzen
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Mobile view */}
                      <div className="space-y-3 lg:hidden">
                        {pagedOffers.map(renderMobileOfferCard)}
                      </div>

                      {/* Desktop view — Folk table */}
                      <div className="hidden overflow-x-auto lg:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-folk-line hover:bg-transparent">
                              <TableHead className="w-20 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Nr.</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Datum</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Titel</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Kunde</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Details</TableHead>
                              <TableHead className="text-right text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Betrag</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Status</TableHead>
                              <TableHead className="text-center text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">E-Mail</TableHead>
                              <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Gültig bis</TableHead>
                              <TableHead className="text-right"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedOffers.map((offer) => {
                              const leadInfo = leadInfoMap[offer.lead_id];
                              const status = getStatusMeta(offer.status);
                              const StatusIcon = getStatusIcon(offer.status);

                              return (
                                <TableRow
                                  key={offer.id}
                                  className="cursor-pointer border-folk-line-soft transition-colors hover:bg-folk-bg-warm"
                                  onClick={() => navigate(`/firma/offerten/${offer.id}`)}
                                >
                                  <TableCell className="font-mono text-[12.5px] font-medium text-folk-ink3">
                                    {offer.offer_number ?? offer.id.slice(0, 6).toUpperCase()}
                                  </TableCell>
                                  <TableCell className="font-mono text-[12.5px] text-folk-ink2">
                                    {formatDate(offer.created_at)}
                                  </TableCell>
                                  <TableCell className="max-w-[180px] text-[15px] font-medium">
                                    <div>
                                      <span className="block truncate text-folk-ink">{offer.title}</span>
                                      {leadInfo && (
                                        <span className="mt-1 inline-flex items-center rounded bg-folk-bg-warm px-1.5 py-0.5 text-[10.5px] font-medium text-folk-ink3">
                                          {getServiceLabel(leadInfo.service_type)}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[15px] text-folk-ink2">
                                    {offer.customer_first_name} {offer.customer_last_name}
                                  </TableCell>
                                  <TableCell className="text-[12.5px]">
                                    {leadInfo && (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1 text-folk-ink3">
                                          <MapPin className="h-3 w-3" />
                                          <span>{leadInfo.from_city}</span>
                                          {leadInfo.to_city && (
                                            <>
                                              <ArrowRight className="h-3 w-3" />
                                              <span>{leadInfo.to_city}</span>
                                            </>
                                          )}
                                        </div>
                                        {leadInfo.from_rooms && (
                                          <div className="flex items-center gap-1 text-[13px] text-folk-ink4">
                                            <Home className="h-3 w-3" />
                                            <span><span className="font-mono">{leadInfo.from_rooms}</span> Zi.</span>
                                            {leadInfo.from_living_space_m2 && (
                                              <span>· <span className="font-mono">{leadInfo.from_living_space_m2}</span> m²</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-sans text-[15px] font-bold tracking-tight text-folk-ink">
                                    {rateOfferIds.has(offer.id)
                                      ? <span className="text-[13px] font-semibold text-folk-ink3">{RATE_AGGREGATE_SHORT}</span>
                                      : formatCurrency(Number(offer.total))}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-semibold ${status.bg} ${status.color}`}>
                                      <StatusIcon className="h-3 w-3" />
                                      {status.label}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {offer.sent_at ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex justify-center">
                                              {emailLogs[offer.id]?.is_company_email ? (
                                                <Building2 className="h-4 w-4 text-folk-mint" />
                                              ) : (
                                                <Server className="h-4 w-4 text-folk-sky" />
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent className="z-50 border bg-popover">
                                            <p>
                                              {emailLogs[offer.id]?.is_company_email
                                                ? `Firmen-E-Mail: ${emailLogs[offer.id]?.from_email}`
                                                : "System-E-Mail"}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className="text-folk-ink5">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-[12.5px] text-folk-ink3">{formatDate(offer.valid_until)}</TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 rounded-md p-0 text-folk-ink3 hover:bg-folk-bg hover:text-folk-ink2"
                                          onClick={(e) => e.stopPropagation()}
                                          aria-label="Mehr Optionen"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/firma/offerten/${offer.id}`);
                                          }}
                                        >
                                          <Eye className="mr-2 h-4 w-4" />
                                          Anzeigen
                                        </DropdownMenuItem>
                                        {offer.status === "accepted" && (
                                          <>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                handleAddToCalendar(offer, e as unknown as React.MouseEvent);
                                              }}
                                            >
                                              <CalendarPlus className="mr-2 h-4 w-4 text-folk-mint" />
                                              Zum Kalender hinzufügen
                                            </DropdownMenuItem>
                                            {offersWithAuftrag.has(offer.id) ? (
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigate("/firma/auftraege");
                                                }}
                                              >
                                                <FileCheck className="mr-2 h-4 w-4 text-folk-mint" />
                                                Auftrag anzeigen
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setAuftragOffer(offer);
                                                }}
                                              >
                                                <FileCheck className="mr-2 h-4 w-4 text-folk-sky" />
                                                Auftrag erstellen
                                              </DropdownMenuItem>
                                            )}
                                          </>
                                        )}
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/firma/offerte-bearbeiten/${offer.id}`);
                                          }}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Bearbeiten
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={(e) => handleResendOffer(offer.id, e)}
                                          disabled={isResending === offer.id || ["accepted", "rejected"].includes(offer.status)}
                                        >
                                          {isResending === offer.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                          )}
                                          Erneut senden
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <PaginationBar
                        total={filteredOffers.length}
                        page={currentPage}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); localStorage.setItem("offerten_pageSize", String(s)); }}
                      />
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-folk-bg-warm text-3xl">📄</div>
                <Clock className="hidden" />
                <h3 className="mb-2 text-[16px] font-semibold tracking-tight text-folk-ink">Keine Offerten vorhanden</h3>
                <p className="mb-4 text-[15px] text-folk-ink3">
                  Erstellen Sie eine Offerte aus einer akzeptierten Anfrage
                </p>
                <Button
                  onClick={() => navigate("/firma/anfragen")}
                  className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Zu den Anfragen
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <AuftragModal
        isOpen={!!auftragOffer}
        onClose={() => setAuftragOffer(null)}
        companyId={companyId}
        offerId={auftragOffer?.id || null}
        onSuccess={() => {
          if (auftragOffer?.id) {
            setOffersWithAuftrag(prev => new Set([...prev, auftragOffer.id]));
          }
          setAuftragOffer(null);
          toast({
            title: "Auftrag erstellt",
            description: "Der Auftrag wurde erfolgreich erstellt. Sie finden ihn unter 'Aufträge'.",
          });
        }}
      />
    </>
  );
};

export default FirmaOfferten;
