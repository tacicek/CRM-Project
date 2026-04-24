import { Helmet } from "react-helmet-async";
import FirmaLayout from "@/components/firma/FirmaLayout";
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
  Banknote,
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
import { buildOfferEmailAttachments } from "@/lib/buildOfferEmailAttachments";

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

// =============================================================================
// PAGINATION BAR
// =============================================================================
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
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{from}–{to} von {total}</span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v) as PageSizeOption); onPageChange(1); }}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">{s} pro Seite</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
            ) : (
              <button
                key={p}
                className={`h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors border ${p === page ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
const FirmaOfferten = () => {
  const { user } = useAuth();
  const { companyId } = useCachedCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [auftragOffer, setAuftragOffer] = useState<Offer | null>(null);
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

  // Filter/arama değişince sayfayı sıfırla
  useEffect(() => { setCurrentPage(1); }, [activeFilter, pageSize, searchQuery, typeFilter]);

  /** Build frontend-generated attachments for email resend. */
  const buildEmailAttachmentsForOffer = async (
    offerId: string
  ): Promise<{ offerPdfBase64: string | null; agbPdfBase64: string | null; checklistPdfBase64: string | null }> => {
    try {
      if (!companyId) return { offerPdfBase64: null, agbPdfBase64: null, checklistPdfBase64: null };
      return await buildOfferEmailAttachments(offerId, companyId);
    } catch (err) {
      console.warn("[Offerten] Failed to generate email attachments on frontend", err);
      return { offerPdfBase64: null, agbPdfBase64: null, checklistPdfBase64: null };
    }
  };

  const handleResendOffer = async (offerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResending(offerId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte neu einloggen und erneut versuchen.", variant: "destructive" });
        setIsResending(null);
        return;
      }

      // Generate PDFs on frontend (same render path as download)
      const { offerPdfBase64, agbPdfBase64, checklistPdfBase64 } = await buildEmailAttachmentsForOffer(offerId);

      const { data, error } = await supabase.functions.invoke("send-offer", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          offerId,
          force_resend: true,
          ...(offerPdfBase64 ? { offerPdfBase64 } : {}),
          ...(agbPdfBase64 ? { agbPdfBase64 } : {}),
          ...(checklistPdfBase64 ? { checklistPdfBase64 } : {}),
        },
      });

      if (error) {
        let errorMessage = "Die E-Mail konnte nicht gesendet werden.";
        try {
          const body = await (error as unknown as { context?: Response }).context?.json();
          if (body?.error) errorMessage = String(body.error);
        } catch (_) { /* ignore */ }
        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

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
    } catch (error: unknown) {
      console.error("Resend error:", error);
      const raw = (error as { message?: string })?.message ?? "";
      let title = "E-Mail nicht gesendet";
      let description = "Die Offerte konnte nicht per E-Mail gesendet werden. Bitte versuchen Sie es erneut.";

      if (raw.includes("Keine E-Mail") || raw.includes("customer_email") || raw.includes("No customer")) {
        title = "Keine Kunden-E-Mail";
        description = "Der Kunde hat keine E-Mail-Adresse hinterlegt. Bitte Offerte bearbeiten und E-Mail ergänzen.";
      } else if (raw.includes("RESEND") || raw.includes("email") || raw.includes("422")) {
        title = "E-Mail-Versand fehlgeschlagen";
        description = "Die E-Mail konnte nicht zugestellt werden. Bitte prüfen Sie die Kunden-E-Mail-Adresse.";
      } else if (raw.includes("401") || raw.includes("unauthorized") || raw.includes("Sitzung")) {
        title = "Sitzung abgelaufen";
        description = "Bitte laden Sie die Seite neu und versuchen Sie es erneut.";
      } else if (raw.includes("500")) {
        title = "Serverfehler";
        description = "Ein technischer Fehler ist aufgetreten. Bitte versuchen Sie es in einigen Minuten erneut.";
      }

      toast({ title, description, variant: "destructive" });
    } finally {
      setIsResending(null);
    }
  };

  const handleAddToCalendar = (offer: Offer, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!offer.lead_id) {
      toast({
        title: "Lead fehlt",
        description: "Dieser Offerte ist kein Lead zugeordnet.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/firma/kalender?newAppointment=true&leadId=${offer.lead_id}`);
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
          .order("created_at", { ascending: false });

        if (offersError) throw offersError;
        if (!isMounted) return;

        setOffers(offersData || []);

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

        const sentOffers = (offersData || []).filter((o: Offer) => o.sent_at);
        if (sentOffers.length > 0) {
          const offerIds = sentOffers.map((o: Offer) => o.id);
          // Fetch by company+type only; filter offer_id client-side to avoid
          // JSONB .in() compatibility issues across PostgREST versions.
          const { data: emailLogsData } = await supabase
            .from("email_logs")
            .select("metadata")
            .eq("email_type", "offer_sent")
            .eq("company_id", companyId);

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "draft":
        return { label: "Entwurf", icon: FileText, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" };
      case "sent":
        return { label: "Gesendet", icon: Send, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
      case "viewed":
        return { label: "Angesehen", icon: Eye, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
      case "accepted":
        return { label: "Angenommen", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
      case "rejected":
        return { label: "Abgelehnt", icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" };
      default:
        return { label: status, icon: FileText, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" };
    }
  };

  const renderMobileOfferCard = (offer: Offer) => {
    const statusConfig = getStatusConfig(offer.status);
    const StatusIcon = statusConfig.icon;
    const leadInfo = leadInfoMap[offer.lead_id];

    return (
      <div
        key={offer.id}
        className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg transition-all duration-300"
      >
        {/* Status bar */}
        <div className={`absolute top-0 left-0 w-full h-1 ${offer.status === 'accepted' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
            offer.status === 'rejected' ? 'bg-gradient-to-r from-rose-500 to-red-500' :
              offer.status === 'sent' || offer.status === 'viewed' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                'bg-slate-300'
          }`} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/firma/offerten/${offer.id}`)}
            >
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  #{offer.offer_number ?? offer.id.slice(0, 6).toUpperCase()}
                </span>
                <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight line-clamp-1 min-w-0">
                  {offer.title}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {offer.customer_first_name} {offer.customer_last_name}
              </p>
              {leadInfo && (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{leadInfo.from_city}{leadInfo.to_city ? ` → ${leadInfo.to_city}` : ''}</span>
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Mehr Optionen">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/firma/offerten/${offer.id}`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Anzeigen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/firma/offerte-bearbeiten/${offer.id}`)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                {offer.status === "accepted" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAddToCalendar(offer)}>
                      <CalendarPlus className="w-4 h-4 mr-2 text-emerald-600" />
                      Zum Kalender hinzufügen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAuftragOffer(offer)}>
                      <FileCheck className="w-4 h-4 mr-2 text-blue-600" />
                      Auftrag erstellen
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleResendOffer(offer.id, e as unknown as React.MouseEvent)}
                  disabled={isResending === offer.id}
                >
                  {isResending === offer.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Erneut senden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
            {offer.offerte_type === 'blind' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                Blind
              </span>
            )}
            {offer.price_model === 'stundenansatz' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                Stundenansatz
              </span>
            )}
            {offer.price_model === 'kostendach' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                {offer.kostendach_max !== null && offer.kostendach_max !== undefined
                  ? `Kostendach CHF ${Number(offer.kostendach_max).toLocaleString('de-CH')}`
                  : 'Kostendach'}
              </span>
            )}
            {(!offer.price_model || offer.price_model === 'pauschal') && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                Pauschal
              </span>
            )}
          </div>

          {/* Amount + Date */}
          <div
            className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer"
            onClick={() => navigate(`/firma/offerten/${offer.id}`)}
          >
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(Number(offer.total))}
            </span>
            <span className="text-xs text-slate-400">{formatDate(offer.created_at)}</span>
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {offer.sent_at && (
                <div className="flex items-center gap-1.5">
                  {emailLogs[offer.id]?.is_company_email ? (
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Server className="w-3.5 h-3.5 text-blue-500" />
                  )}
                  <span className="text-slate-500">
                    {emailLogs[offer.id]?.is_company_email ? "Firma" : "System"}
                  </span>
                </div>
              )}
              {offer.checklist_url && (
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-500">Checkliste</span>
                </div>
              )}
            </div>
            {offer.valid_until && (
              <span className="text-slate-400">bis {formatDate(offer.valid_until)}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Offerten | Firma</title>
      </Helmet>
      <FirmaLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 px-4 py-3 md:px-6 md:py-4 text-white">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base md:text-xl font-bold leading-tight">Offerten</h1>
                <p className="text-white/70 text-[11px] hidden sm:block">Verwalten Sie Ihre Angebote</p>
              </div>
              <Button
                onClick={() => navigate("/firma/anfragen")}
                size="sm"
                className="shrink-0 bg-white text-indigo-600 hover:bg-white/90 shadow-md h-8 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Neue Offerte</span>
              </Button>
            </div>
          </div>

          {/* Statistics */}
          {!isLoading && offers.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              {[
                { label: "Gesamt", value: stats.total, icon: FileText, gradient: "from-slate-100 to-slate-50", iconBg: "bg-slate-200", iconColor: "text-slate-600", filterKey: null },
                { label: "Ausstehend", value: stats.sent + stats.viewed, icon: Clock, gradient: "from-amber-50 to-orange-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", filterKey: "ausstehend" },
                { label: "Angenommen", value: stats.accepted, icon: CheckCircle, gradient: "from-emerald-50 to-green-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", filterKey: "angenommen" },
                { label: "Wert", value: formatCurrency(stats.acceptedValue), icon: Banknote, gradient: "from-indigo-50 to-violet-50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", isValue: true, filterKey: "angenommen" },
              ].map((stat, i) => (
                <div
                  key={i}
                  onClick={() => setActiveFilter(stat.filterKey)}
                  className={`relative overflow-hidden rounded-xl p-3 md:p-4 bg-gradient-to-br ${stat.gradient} border border-slate-200/50 dark:border-slate-800 cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${activeFilter === stat.filterKey ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                    }`}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl ${stat.iconBg} flex items-center justify-center shrink-0`}>
                      <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`${stat.isValue ? 'text-sm md:text-lg' : 'text-xl md:text-2xl'} font-bold text-slate-900 dark:text-white leading-tight truncate`}>
                        {stat.value}
                      </p>
                      <p className="text-[10px] md:text-xs text-slate-500 truncate">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Offers List */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

            <div className="p-4 md:p-6">
              {/* List header + filters */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {activeFilter === null
                      ? "Alle Offerten"
                      : activeFilter === "ausstehend"
                        ? "Ausstehende"
                        : "Angenommene"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {activeFilter === null
                      ? `${offers.length} insgesamt`
                      : activeFilter === "ausstehend"
                        ? `${offers.filter((o) => o.status === "sent" || o.status === "viewed").length} ausstehend`
                        : `${offers.filter((o) => o.status === "accepted").length} angenommen`}
                  </p>
                </div>
                {activeFilter !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveFilter(null)}
                    className="shrink-0 h-8 text-xs px-2"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Search + type filter row */}
              <div className="flex items-center gap-2 mb-5">
                {/* Search bar */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nr., Name oder Titel..."
                    className="pl-8 pr-7 h-9 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Suche löschen"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Type filter */}
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'normal' | 'blind')}>
                  <SelectTrigger className="h-9 w-28 sm:w-36 text-xs sm:text-sm shrink-0">
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
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                  <p className="text-sm text-slate-500">Lade Offerten...</p>
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
                        <div className="text-center py-12">
                          <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                          <p className="text-slate-500 font-medium">Keine Offerte gefunden</p>
                          <p className="text-slate-400 text-sm mt-1">
                            Kein Ergebnis für „{searchQuery}"
                          </p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchQuery("")}>
                            Suche zurücksetzen
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Mobile view */}
                        <div className="lg:hidden space-y-3">
                          {pagedOffers.map(renderMobileOfferCard)}
                        </div>

                        {/* Desktop view */}
                        <div className="hidden lg:block overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-slate-100 dark:border-slate-800">
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Nr.</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Datum</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Titel</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kunde</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Betrag</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">E-Mail</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gültig bis</TableHead>
                                <TableHead className="text-right"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pagedOffers.map((offer) => {
                                const leadInfo = leadInfoMap[offer.lead_id];
                                const statusConfig = getStatusConfig(offer.status);
                                const StatusIcon = statusConfig.icon;

                                return (
                                  <TableRow
                                    key={offer.id}
                                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors"
                                    onClick={() => navigate(`/firma/offerten/${offer.id}`)}
                                  >
                                    <TableCell className="text-sm font-mono font-medium text-slate-500 dark:text-slate-400">
                                      {offer.offer_number ?? offer.id.slice(0, 6).toUpperCase()}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                      {formatDate(offer.created_at)}
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[180px]">
                                      <div>
                                        <span className="truncate block text-slate-900 dark:text-white">{offer.title}</span>
                                        {leadInfo && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            {getServiceLabel(leadInfo.service_type)}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                                      {offer.customer_first_name} {offer.customer_last_name}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {leadInfo && (
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1 text-slate-500">
                                            <MapPin className="w-3 h-3" />
                                            <span>{leadInfo.from_city}</span>
                                            {leadInfo.to_city && (
                                              <>
                                                <ArrowRight className="w-3 h-3" />
                                                <span>{leadInfo.to_city}</span>
                                              </>
                                            )}
                                          </div>
                                          {leadInfo.from_rooms && (
                                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                                              <Home className="w-3 h-3" />
                                              <span>{leadInfo.from_rooms} Zi.</span>
                                              {leadInfo.from_living_space_m2 && (
                                                <span>• {leadInfo.from_living_space_m2} m²</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-900 dark:text-white">
                                      {formatCurrency(Number(offer.total))}
                                    </TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {statusConfig.label}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {offer.sent_at ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex justify-center">
                                                {emailLogs[offer.id]?.is_company_email ? (
                                                  <Building2 className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                  <Server className="w-4 h-4 text-blue-500" />
                                                )}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-popover border z-50">
                                              <p>
                                                {emailLogs[offer.id]?.is_company_email
                                                  ? `Firmen-E-Mail: ${emailLogs[offer.id]?.from_email}`
                                                  : "System-E-Mail"}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-500">{formatDate(offer.valid_until)}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label="Mehr Optionen"
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/firma/offerten/${offer.id}`);
                                            }}
                                          >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Anzeigen
                                          </DropdownMenuItem>
                                          {offer.status === "accepted" && (
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                handleAddToCalendar(offer, e as unknown as React.MouseEvent);
                                              }}
                                            >
                                              <CalendarPlus className="w-4 h-4 mr-2 text-emerald-600" />
                                              Zum Kalender hinzufügen
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/firma/offerte-bearbeiten/${offer.id}`);
                                            }}
                                          >
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Bearbeiten
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={(e) => handleResendOffer(offer.id, e)}
                                            disabled={isResending === offer.id}
                                          >
                                            {isResending === offer.id ? (
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-4 h-4 mr-2" />
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

                        {/* Pagination */}
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
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine Offerten vorhanden</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Erstellen Sie eine Offerte aus einer akzeptierten Anfrage
                  </p>
                  <Button
                    onClick={() => navigate("/firma/anfragen")}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                  >
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Zu den Anfragen
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FirmaLayout>

      {/* Auftrag Modal */}
      <AuftragModal
        isOpen={!!auftragOffer}
        onClose={() => setAuftragOffer(null)}
        companyId={companyId}
        offerId={auftragOffer?.id || null}
        onSuccess={() => {
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
