import { Helmet } from "react-helmet-async";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  MapPin,
  Calendar,
  CalendarPlus,
  Coins,
  Check,
  X,
  Eye,
  Loader2,
  Phone,
  Mail,
  User,
  AlertTriangle,
  ClipboardList,
  Filter,
  Navigation,
  Clock,
  TrendingUp,
  Sparkles,
  Archive,
  ArrowRight,
  Inbox,
  CheckCircle2,
  Zap,
  Users,
  Download,
  Camera,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getServiceLabel } from "@/lib/serviceLabels";
import { jsPDF } from "jspdf";
import { CreateVirtualBesichtigungDialog } from "@/components/firma/CreateVirtualBesichtigungDialog";

interface Lead {
  id: string;
  slug: string;
  service_type: string;
  from_plz: string;
  from_city: string;
  from_street: string | null;
  from_house_number: string | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_plz: string | null;
  to_city: string | null;
  to_street: string | null;
  to_house_number: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  description: string | null;
  token_cost: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: string;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  estimated_job_price_min: number | null;
  estimated_job_price_max: number | null;
  estimated_job_price_confidence: string | null;
  packing_service_needed: boolean | null;
  cleaning_service_needed: boolean | null;
  storage_needed: boolean | null;
  storage_duration: string | null;
  storage_volume: string | null;
  special_items: string[] | null;
  has_heavy_items: boolean | null;
  heavy_items_description: string | null;
  piano_type: string | null;
  max_companies: number | null;
  piano_brand: string | null;
  piano_weight_kg: number | null;
  property_type: string | null;
  kitchen_type: string | null;
  bathroom_count: number | null;
  has_balcony: boolean | null;
  has_garage: boolean | null;
  has_basement: boolean | null;
  has_attic: boolean | null;
  clearing_type: string | null;
  estimated_volume: string | null;
  disposal_type: string | null;
  items_description: string | null;
  // Detailed wizard form data
  // Using 'any' to allow flexible access to different service type data structures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detailed_form_data: any;
  form_version: number | null;
  cleaning_windows: boolean | null;
}

// Type for detailed Umzug form data
interface UmzugDetailedData {
  auszug: {
    property_type: string;
    anzahl_zimmer: number;
    anzahl_stockwerke: number;
    wohnflaeche_m2: number;
    adresse: {
      land: string;
      strasse: string;
      hausnummer: string;
      plz: string;
      ort: string;
    };
    stockwerk: string;
    lift: {
      vorhanden: boolean;
      typ?: string;
    };
    parkplatz: {
      distanz_meter: number;
      stufen: string;
      weg_beeintraechtigt: boolean;
      beeintraechtigung_details?: string;
    };
    zusatz: Record<string, boolean | number>;
  };
  einzug: {
    property_type: string;
    anzahl_zimmer: number;
    anzahl_stockwerke: number;
    wohnflaeche_m2: number;
    adresse: {
      land: string;
      strasse: string;
      hausnummer: string;
      plz: string;
      ort: string;
    };
    stockwerk: string;
    lift: {
      vorhanden: boolean;
      typ?: string;
    };
    parkplatz: {
      distanz_meter: number;
      stufen: string;
      weg_beeintraechtigt: boolean;
      beeintraechtigung_details?: string;
    };
    zusatz: Record<string, boolean | number>;
  };
  umzug_details: {
    datum: string;
    flexibilitaet: string;
    startzeit: string;
  };
  inventar: {
    items: { name: string; anzahl: number }[];
    geschaetzte_kartons: number;
    schwere_gegenstaende: { name: string; anzahl: number }[];
  };
  zusatzleistungen: {
    verpackung: { aktiv: boolean; umfang: string };
    auspacken: boolean;
    moebelmontage: boolean;
    entsorgung: { aktiv: boolean; volumen_m3: number };
    endreinigung: boolean;
    zwischenlagerung: { aktiv: boolean; dauer_wochen: number };
    moebellift: { aktiv: boolean; standort: string };
  };
  kunde: {
    anrede: string;
    vorname: string;
    nachname: string;
    email: string;
    telefon: string;
  };
}

// Type for detailed Reinigung form data
interface _ReinigungDetailedData {
  service_type: string;
  unterkunft_art: string;
  zimmer_anzahl: number;
  wohnflaeche_m2: number;
  zusatz_raeume: {
    keller: boolean;
    dachboden: boolean;
    garage: boolean;
    wintergarten: boolean;
    balkon: {
      aktiv: boolean;
      flaeche_m2: number;
      hochdruckreinigung: boolean;
      glas_gelaender: boolean;
    };
  };
  besonderheiten: {
    keine: boolean;
    einbauschraenke: boolean;
    stark_verhaerteter_dreck_kueche: boolean;
    waschturm: boolean;
    haustierhaltung: boolean;
    moebel_vorhanden: boolean;
  };
  badezimmer: {
    duschen_badewannen: number;
    toiletten: number;
    lavabos: number;
    verhaerteter_schmutz: boolean;
  };
  fenster: {
    normale_fenster: number;
    fensterwaende: number;
    fenstertueren: number;
    schimmel_entfernen: boolean;
  };
  storen: {
    lamellenstoren: number;
    rolllaeden: number;
    fensterlaeden: number;
  };
  zusatzleistungen: {
    hochdruck_reinigung: boolean;
    kamin_reinigung: boolean;
    teppichboden: {
      aktiv: boolean;
      anzahl_raeume: number;
    };
    fugenreinigung: boolean;
  };
  termin: {
    wunschdatum: string;
    flexibilitaet: string;
    bemerkungen: string;
  };
}

interface ExistingOffer {
  id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface LeadDistribution {
  id: string;
  lead_id: string;
  status: string;
  sent_at: string;
  token_cost: number | null;
  expires_at: string | null;
  lead?: Lead;
  existing_offer?: ExistingOffer | null;
}

// =============================================================================
// PAGINATION BAR
// =============================================================================
interface PaginationBarProps {
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PaginationBar = ({ total, page, pageSize, pageSizeOptions, onPageChange, onPageSizeChange }: PaginationBarProps) => {
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build page number buttons: always show first, last, current ±1
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
      {/* Left: result info + page size selector */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{from}–{to} von {total}</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[90px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s} pro Seite
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-indigo-600 hover:bg-indigo-700 border-indigo-600" : ""}`}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
const FirmaAnfragen = () => {
  // CRM-FORK: removed token_balance, crm_enabled, subscription fields — standalone CRM always has full access
  const { companyId, company } = useCachedCompany("id, manual_import_enabled");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const tokenBalance = Infinity; // CRM-FORK: no token gate
  const hasCrmAccess = true; // CRM-FORK: always enabled
  const [distributions, setDistributions] = useState<LeadDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadDistribution | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isVirtualBesichtigungOpen, setIsVirtualBesichtigungOpen] = useState(false);
  
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("anfragen_serviceTypeFilter") || "all";
    }
    return "all";
  });
  const [urgencyFilter, setUrgencyFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("anfragen_urgencyFilter") || "all";
    }
    return "all";
  });

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseInt(localStorage.getItem("anfragen_pageSize") || "10", 10);
      return PAGE_SIZE_OPTIONS.includes(saved as typeof PAGE_SIZE_OPTIONS[number]) ? saved : 10;
    }
    return 10;
  });
  const [newPage, setNewPage]           = useState(1);
  const [acceptedPage, setAcceptedPage] = useState(1);
  const [withOfferPage, setWithOfferPage] = useState(1);
  const [archivePage, setArchivePage]   = useState(1);

  useEffect(() => {
    localStorage.setItem("anfragen_serviceTypeFilter", serviceTypeFilter);
    // Reset pages on filter change
    setNewPage(1); setAcceptedPage(1); setWithOfferPage(1); setArchivePage(1);
  }, [serviceTypeFilter]);

  useEffect(() => {
    localStorage.setItem("anfragen_urgencyFilter", urgencyFilter);
    setNewPage(1); setAcceptedPage(1); setWithOfferPage(1); setArchivePage(1);
  }, [urgencyFilter]);

  useEffect(() => {
    localStorage.setItem("anfragen_pageSize", String(pageSize));
    setNewPage(1); setAcceptedPage(1); setWithOfferPage(1); setArchivePage(1);
  }, [pageSize]);

  // CRM-FORK: removed token/CRM access state sync — always full access

  const isMountedRef = useRef(true);
  const fetchData = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data: dists, error } = await supabase
        .from("lead_distributions")
        .select("id, lead_id, status, sent_at, token_cost, expires_at")
        .eq("company_id", companyId)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      if (!isMountedRef.current) return;

      if (dists && dists.length > 0) {
        const leadIds = dists.map((d) => d.lead_id);
        const { data: leads } = await supabase
          .from("leads")
          .select("*")
          .in("id", leadIds);

        const { data: existingOffers } = await supabase
          .from("offers")
          .select("id, lead_id, status, created_at, sent_at")
          .eq("company_id", companyId)
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (!isMountedRef.current) return;

        const offerMap = new Map<string, { id: string; status: string; created_at: string; sent_at: string | null }>();
        (existingOffers || []).forEach((offer) => {
          if (!offerMap.has(offer.lead_id)) {
            offerMap.set(offer.lead_id, {
              id: offer.id,
              status: offer.status,
              created_at: offer.created_at,
              sent_at: offer.sent_at,
            });
          }
        });

        // SEC-5: PII masking — customer_email and customer_phone are only
        // included in memory for accepted distributions (where token was charged).
        // Non-accepted distributions get null contact fields regardless of what the DB returns.
        const distributionsWithLeads = dists.map((d) => {
          const rawLead = leads?.find((l) => l.id === d.lead_id) as unknown as Lead | undefined;
          const isAccepted = d.status === "accepted";
          const lead: Lead | undefined = rawLead && !isAccepted
            ? { ...rawLead, customer_email: null as unknown as string, customer_phone: null }
            : rawLead;
          return {
            ...d,
            lead,
            existing_offer: offerMap.get(d.lead_id) || null,
          };
        });

        if (isMountedRef.current) setDistributions(distributionsWithLeads as LeadDistribution[]);
      } else if (isMountedRef.current) {
        setDistributions([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (isMountedRef.current) {
        toast({
          title: "Fehler beim Laden",
          description: "Die Anfragen konnten nicht geladen werden.",
          variant: "destructive",
        });
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => { isMountedRef.current = false; };
  }, [fetchData]);

  // Handle ?accept=<distributionId> deep link from email
  const acceptDistIdFromUrl = searchParams.get("accept");
  useEffect(() => {
    if (!acceptDistIdFromUrl || distributions.length === 0) return;
    const target = distributions.find(d => d.id === acceptDistIdFromUrl);
    if (target && target.lead && target.status === "sent") {
      setSelectedLead(target);
      setIsDetailOpen(true);
    } else if (!target) {
      toast({
        title: "Link nicht mehr gültig",
        description: "Diese Anfrage konnte nicht gefunden werden. Möglicherweise wurde der Link bereits verwendet.",
        variant: "destructive",
      });
    } else if (target && target.status !== "sent") {
      toast({
        title: "Anfrage bereits bearbeitet",
        description: target.status === "accepted"
          ? "Sie haben diese Anfrage bereits angenommen."
          : "Diese Anfrage ist nicht mehr verfügbar.",
      });
    }
    setSearchParams({}, { replace: true });
  }, [acceptDistIdFromUrl, distributions, setSearchParams, toast]);

  const getUrgencyLevel = (preferredDate: string | null): string => {
    if (!preferredDate) return "none";
    const date = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "past";
    if (diffDays <= 3) return "urgent";
    if (diffDays <= 7) return "thisweek";
    if (diffDays <= 14) return "soon";
    return "later";
  };

  const handleAcceptLead = async (distribution: LeadDistribution) => {
    if (!companyId || !distribution.lead) return;

    // CRM-FORK: token gate removed — leads are accepted directly
    setIsAccepting(true);

    try {
      // Get current session token for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast({
          title: "Sitzung abgelaufen",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        setIsAccepting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("accept-lead", {
        body: {
          distributionId: distribution.id,
          companyId,
        },
      });

      // Handle edge function errors - check for quota_full in error context too
      if (error) {
        // Try to parse error body for quota_full flag
        const errorBody = (error as { context?: { body?: string } })?.context?.body;
        if (errorBody) {
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.quota_full) {
              toast({
                title: "⏰ Leider zu spät!",
                description: "Diese Anfrage wurde bereits von einer anderen Firma angenommen. Schneller sein lohnt sich – neue Anfragen warten auf Sie!",
                variant: "destructive",
              });
              setIsDetailOpen(false);
              fetchData();
              return;
            }
          } catch {
            // JSON parse failed, continue with normal error handling
          }
        }
        throw error;
      }

      // Handle success response with error flag (quota_full case)
      if (data?.error || data?.success === false) {
        if (data.quota_full) {
          toast({
            title: "⏰ Leider zu spät!",
            description: "Diese Anfrage wurde bereits von einer anderen Firma angenommen. Schneller sein lohnt sich – neue Anfragen warten auf Sie!",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error || "Unbekannter Fehler");
        }
        setIsDetailOpen(false);
        fetchData();
        return;
      }

      try {
        await supabase.functions.invoke("send-token-notification", {
          body: {
            companyId,
            type: "spend",
            previousBalance: tokenBalance,
            newBalance: data.newBalance,
            amount: data.tokenCost,
            leadInfo: {
              slug: distribution.lead.slug,
              serviceType: distribution.lead.service_type,
              fromPlz: distribution.lead.from_plz,
              fromCity: distribution.lead.from_city,
              toPlz: distribution.lead.to_plz,
              toCity: distribution.lead.to_city,
              preferredDate: distribution.lead.preferred_date,
              fromRooms: distribution.lead.from_rooms,
              fromLivingSpaceM2: distribution.lead.from_living_space_m2,
              customerName: `${distribution.lead.customer_first_name} ${distribution.lead.customer_last_name}`,
              customerPhone: distribution.lead.customer_phone,
              customerEmail: distribution.lead.customer_email,
              description: distribution.lead.description,
            },
          },
        });
      } catch (emailError) {
        console.error("Failed to send token notification email:", emailError);
      }

      setTokenBalance(data.newBalance);
      
      if (data.quotaFull) {
        toast({
          title: "Anfrage angenommen!",
          description: `Die Kundendaten sind jetzt sichtbar. Das Kontingent (${data.maxCompanies} Firmen) ist erreicht.`,
        });
      } else {
        toast({
          title: "Anfrage angenommen!",
          description: `Die Kundendaten sind jetzt sichtbar. (${data.acceptedCount}/${data.maxCompanies} Firmen)`,
        });
      }

      setIsDetailOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error accepting lead:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Die Anfrage konnte nicht angenommen werden.",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectLead = async (distribution: LeadDistribution) => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from("lead_distributions")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", distribution.id)
        .eq("company_id", companyId);

      if (error) throw error;

      toast({
        title: "Anfrage abgelehnt",
        description: "Die Anfrage wurde abgelehnt.",
      });

      setIsDetailOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error rejecting lead:", error);
      toast({
        title: "Fehler",
        description: "Die Anfrage konnte nicht abgelehnt werden.",
        variant: "destructive",
      });
    }
  };

  // PDF Download for companies without CRM
  const downloadLeadPdf = async (distribution: LeadDistribution) => {
    const lead = distribution.lead;
    if (!lead) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      const svcKey = lead.service_type?.toLowerCase() ?? "";
      const isRaeumung = svcKey === "raeumung" || svcKey === "entsorgung";
      const isUmzug = svcKey.startsWith("umzug");
      const isReinigung = svcKey.includes("reinigung");
      const isKlaviertransport = svcKey === "klaviertransport";

      type ThemeColor = [number, number, number];
      const getServiceTheme = (serviceType: string): {
        stripe: ThemeColor; light: ThemeColor; accent: ThemeColor; accentText: ThemeColor;
      } => {
        const key = serviceType.toLowerCase();
        if (key.includes("reinigung"))
          return { stripe: [2,132,199], light: [224,242,254], accent: [2,132,199], accentText: [7,89,133] };
        if (key.startsWith("umzug") || key.includes("transport"))
          return { stripe: [37,99,235], light: [219,234,254], accent: [37,99,235], accentText: [30,58,138] };
        if (key.includes("raeumung") || key.includes("entsorgung"))
          return { stripe: [234,88,12], light: [255,237,213], accent: [234,88,12], accentText: [154,52,18] };
        return { stripe: [79,70,229], light: [241,245,249], accent: [79,70,229], accentText: [49,46,129] };
      };
      const theme = getServiceTheme(lead.service_type);

      const drawPageHeader = () => {
        // Thin colored top stripe
        doc.setFillColor(...theme.stripe);
        doc.rect(0, 0, pageWidth, 4, "F");
        // White header area
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 4, pageWidth, 28, "F");
        // Bottom separator
        doc.setDrawColor(226, 232, 240);
        doc.line(0, 32, pageWidth, 32);

        // Brand name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text("Offerio", 20, 18);
        // Subtitle
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Anfrage-Dossier", 20, 25);

        // Right: ref + date
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Ref: ${lead.slug || lead.id}`, pageWidth - 20, 17, { align: "right" });
        doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH")}`, pageWidth - 20, 24, { align: "right" });

        y = 44;
      };

      const checkPageBreak = (neededSpace: number) => {
        if (y + neededSpace > pageHeight - 55) {
          doc.addPage();
          drawPageHeader();
        }
      };

      const addSectionTitle = (title: string) => {
        checkPageBreak(22);
        y += 5;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, y - 4, pageWidth - 40, 10, 1.5, 1.5, "F");
        doc.setFillColor(...theme.stripe);
        doc.roundedRect(20, y - 4, 3, 10, 1, 1, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(title, 28, y + 2.5);
        y += 14;
      };

      const addLine = (label: string, value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return;
        const rowX = 25;
        const labelWidth = 55;
        const displayValue = typeof value === "boolean" ? (value ? "Ja" : "Nein") : String(value);
        const maxW = pageWidth - rowX - labelWidth - 20;
        const valueLines = doc.splitTextToSize(displayValue, maxW);
        const rowHeight = Math.max(7, valueLines.length * 5 + 2);
        checkPageBreak(rowHeight + 2);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, rowX + 2, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(valueLines, rowX + labelWidth, y);

        y += rowHeight;
      };

      const translateValue = (key: string, value: string | boolean | number): string => {
        if (typeof value === "boolean") return value ? "Ja" : "Nein";
        if (key === "stockwerk") {
          const s = String(value);
          if (s === "basement") return "UG";
          if (s === "floor_0") return "EG";
          const m = s.match(/^floor_(\d+)$/);
          if (m) return `${m[1]}. OG`;
          return s;
        }
        const translations: Record<string, Record<string, string>> = {
          lift: { no_elevator:"Kein Lift", small_elevator:"Kleiner Lift", large_elevator:"Grosser Lift" },
          stufen: { steps_0_10:"0-10 Stufen", steps_10_20:"10-20 Stufen", steps_20_plus:"20+ Stufen" },
          property_type: { wohnung:"Wohnung", haus:"Haus", villa:"Villa", lager:"Lager", buero:"Büro" },
          flexibilitaet: { exact:"Genau", flexible_1_week:"±1 Woche", flexible_2_weeks:"±2 Wochen", flexible_1_month:"±1 Monat" },
        };
        return translations[key]?.[String(value)] ?? String(value);
      };

      drawPageHeader();

      // ===== TITLE AREA =====
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Anfrage-Details", 20, y);
      y += 10;

      // Service badge
      const serviceLabel = getServiceLabel(lead.service_type);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      const badgeW = Math.min(pageWidth - 40, doc.getTextWidth(serviceLabel) + 16);
      doc.setFillColor(...theme.light);
      doc.roundedRect(20, y - 4, badgeW, 8, 2, 2, "F");
      doc.setTextColor(...theme.accentText);
      doc.text(serviceLabel, 26, y + 1.5);
      y += 12;

      // Created date
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Anfrage vom ${formatDate(lead.created_at)}`, 20, y);
      y += 7;

      // Separator
      doc.setDrawColor(226, 232, 240);
      doc.line(20, y, pageWidth - 20, y);
      y += 8;

      // ===== SUMMARY CARD =====
      checkPageBreak(30);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, y, pageWidth - 40, 26, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, y, pageWidth - 40, 26, 3, 3, "S");

      // Colored left accent on summary card
      doc.setFillColor(...theme.stripe);
      doc.roundedRect(20, y, 3, 26, 1, 1, "F");

      const c1 = 28, c2 = pageWidth / 3 + 8, c3 = (pageWidth / 3) * 2 + 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("KUNDE", c1, y + 7);
      doc.text("ORT", c2, y + 7);
      doc.text("WUNSCHTERMIN", c3, y + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const customerName = `${lead.customer_first_name || ""} ${lead.customer_last_name || ""}`.trim();
      doc.text(customerName || "—", c1, y + 15);
      doc.text(`${lead.from_plz || ""} ${lead.from_city || ""}`.trim() || "—", c2, y + 15);
      doc.text(formatDate(lead.preferred_date), c3, y + 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`ID: ${lead.slug || lead.id}`, c1, y + 22);
      doc.text(`Service: ${serviceLabel}`, c2, y + 22);
      doc.text(`Status: ${distribution.status || "sent"}`, c3, y + 22);
      y += 32;

      // ===== KUNDENDATEN =====
      addSectionTitle("Kundendaten");
      addLine("Name", `${lead.customer_first_name || ""} ${lead.customer_last_name || ""}`.trim());
      if (distribution.status === "accepted") {
        addLine("E-Mail", lead.customer_email);
        addLine("Telefon", lead.customer_phone);
      } else {
        addLine("E-Mail", "Nach Annahme sichtbar");
        addLine("Telefon", "Nach Annahme sichtbar");
      }

      const detailedData = lead.detailed_form_data as UmzugDetailedData | null;
      const dfd = lead.detailed_form_data as Record<string, unknown> | null;

      // ===== RÄUMUNG / ENTSORGUNG =====
      if (isRaeumung && dfd) {
        const rartLabels: Record<string, string> = {
          wohnung:"Wohnungsräumung", haus:"Hausräumung", keller:"Kellerräumung",
          dachboden:"Dachbodenräumung", buero:"Büroräumung",
        };
        const volLabels: Record<string, string> = {
          teil:"Teilräumung", mittel:"Teilweise", gross:"Grosse Räumung", komplett:"Kompletträumung",
        };
        const dringLabels: Record<string, string> = {
          normal:"Normal", dringend:"Dringend", sehr:"Sehr dringend",
        };
        const entCatLabels: Record<string, string> = {
          moebel:"Möbel", elektro:"Elektrogeräte", sperrgut:"Sperrmüll",
          kleider:"Kleider", buero:"Büromaterial", sonstiges:"Sonstiges",
        };
        const zusLabels: Record<string, string> = {
          endreinigung:"Endreinigung", verpackung:"Verpackung", abschliessen:"Abschliessen",
        };

        // Objektadresse
        addSectionTitle("Objektadresse");
        if (distribution.status === "accepted") {
          const addrStr = dfd.str
            ? `${String(dfd.str)} ${String(dfd.nr || "")}`.trim()
            : `${lead.from_street || ""} ${lead.from_house_number || ""}`.trim();
          addLine("Strasse", addrStr || null);
        }
        addLine("PLZ / Ort", `${String(dfd.plz || lead.from_plz || "")} ${String(dfd.ort || lead.from_city || "")}`.trim());
        addLine("Stockwerk", String(dfd.stock || ""));
        addLine("Lift", (dfd.lift as boolean) ? "Ja" : "Nein");
        if (dfd.m2) addLine("Fläche", `${String(dfd.m2)} m²`);

        // Räumungsdetails
        if (String(dfd.svcType ?? "") !== "entsorgung") {
          addSectionTitle("Räumungsdetails");
          if (dfd.rart) addLine("Räumungsart", rartLabels[String(dfd.rart)] ?? String(dfd.rart));
          if (dfd.vol) addLine("Umfang", volLabels[String(dfd.vol)] ?? String(dfd.vol));
          if (dfd.dring) addLine("Dringlichkeit", dringLabels[String(dfd.dring)] ?? String(dfd.dring));
          const schwerItems = Array.isArray(dfd.schwerItems) ? (dfd.schwerItems as string[]) : [];
          if (schwerItems.length > 0) addLine("Schwere Gegenstände", schwerItems.join(", "));
          if (dfd.zustand && dfd.zustandText) addLine("Besondere Umstände", String(dfd.zustandText));
        }

        // Entsorgung
        const entCats = Array.isArray(dfd.entCats) ? (dfd.entCats as string[]) : [];
        if (entCats.length > 0) {
          addSectionTitle("Entsorgung");
          addLine("Kategorien", entCats.map(c => entCatLabels[c] ?? c).join(", "));
          if (dfd.menge) addLine("Menge", String(dfd.menge));
          if (dfd.eDring) addLine("Dringlichkeit", dringLabels[String(dfd.eDring)] ?? String(dfd.eDring));
        }

        // Zusatzleistungen
        const zusItems = Array.isArray(dfd.zus) ? (dfd.zus as string[]) : [];
        if (zusItems.length > 0) {
          addSectionTitle("Zusatzleistungen");
          addLine("Leistungen", zusItems.map(z => zusLabels[z] ?? z).join(", "));
        }

      // ===== REINIGUNG =====
      } else if (isReinigung && dfd) {
        addSectionTitle("Standortadresse");
        addLine("PLZ / Ort", `${lead.from_plz || ""} ${lead.from_city || ""}`.trim());
        const unterkunft = String(dfd.unterkunft || dfd.unterkunft_art || "");
        addLine("Unterkunftstyp", unterkunft);
        const flaeche = dfd.m2 || dfd.wohnflaeche_m2;
        if (flaeche) addLine("Fläche", `${String(flaeche)} m²`);
        addLine("Zimmer", String(dfd.zimmer || dfd.zimmer_anzahl || lead.from_rooms || ""));

        const reinigungDetails: [string, unknown][] = [
          ["Bad / WC", dfd.bad || dfd.wc ? `${String(dfd.bad || 0)} Bad, ${String(dfd.wc || 0)} WC` : null],
          ["Fenster", dfd.fen_normal || dfd.fen_gross ? `Normal: ${String(dfd.fen_normal || 0)}, Gross: ${String(dfd.fen_gross || 0)}` : null],
        ];
        addSectionTitle("Reinigungsdetails");
        for (const [label, val] of reinigungDetails) {
          if (val) addLine(label, val as string);
        }
        const rooms = Array.isArray(dfd.rooms) ? (dfd.rooms as string[]) : [];
        if (rooms.length > 0) addLine("Räume", rooms.join(", "));
        const besonderheiten = Array.isArray(dfd.besonderheiten) ? (dfd.besonderheiten as string[]) : [];
        if (besonderheiten.length > 0) addLine("Besonderheiten", besonderheiten.join(", "));

      // ===== KLAVIERTRANSPORT =====
      } else if (isKlaviertransport && dfd) {
        const instLabels: Record<string, string> = {
          "klavier":"Klavier (aufrecht)", "flügel-klein":"Flügel (klein)",
          "flügel-gross":"Flügel (gross)", "sonstiges":"Sonstiges",
        };
        addSectionTitle("Transportdetails");
        if (dfd.inst) addLine("Instrument", instLabels[String(dfd.inst)] ?? String(dfd.inst));

        addSectionTitle("Von (Auszug)");
        if (distribution.status === "accepted") {
          addLine("Strasse", `${String(dfd.vonStr || "")} ${String(dfd.vonNr || "")}`.trim());
        }
        addLine("PLZ / Ort", `${String(dfd.vonPlz || lead.from_plz || "")} ${String(dfd.vonOrt || lead.from_city || "")}`.trim());
        addLine("Stockwerk", String(dfd.vonStock || ""));
        addLine("Lift", (dfd.vonLift as boolean) ? "Ja" : "Nein");

        addSectionTitle("Nach (Einzug)");
        if (distribution.status === "accepted") {
          addLine("Strasse", `${String(dfd.nachStr || "")} ${String(dfd.nachNr || "")}`.trim());
        }
        addLine("PLZ / Ort", `${String(dfd.nachPlz || lead.to_plz || "")} ${String(dfd.nachOrt || lead.to_city || "")}`.trim());
        addLine("Stockwerk", String(dfd.nachStock || ""));
        addLine("Lift", (dfd.nachLift as boolean) ? "Ja" : "Nein");

      // ===== UMZUG (new 5-step or old 17-step) =====
      } else if (isUmzug) {
        addSectionTitle("Auszugsadresse");
        if (distribution.status === "accepted") {
          addLine("Strasse", `${lead.from_street || ""} ${lead.from_house_number || ""}`.trim());
        }
        addLine("PLZ / Ort", `${lead.from_plz || ""} ${lead.from_city || ""}`.trim());
        addLine("Stockwerk", lead.from_floor !== null ? translateValue("stockwerk", `floor_${lead.from_floor}`) : null);
        addLine("Lift", lead.from_has_lift);
        // v2 wizard stores von_zimmer/von_m2; fall back to lead fields for old leads
        if (dfd && "von_zimmer" in dfd) {
          if (dfd.von_zimmer) addLine("Zimmer", String(dfd.von_zimmer));
          if (dfd.von_m2) addLine("Wohnfläche", `${String(dfd.von_m2)} m²`);
        } else {
          addLine("Zimmer", lead.from_rooms);
          addLine("Wohnfläche", lead.from_living_space_m2 ? `${lead.from_living_space_m2} m²` : null);
        }

        // Old 17-step auszug
        if (detailedData?.auszug) {
          const auszug = detailedData.auszug;
          addLine("Immobilientyp", auszug.property_type ? translateValue("property_type", auszug.property_type) : null);
          addLine("Anzahl Stockwerke", auszug.anzahl_stockwerke);
          if (auszug.lift?.vorhanden) {
            addLine("Lift-Typ", auszug.lift.typ ? translateValue("lift", auszug.lift.typ) : "Vorhanden");
          }
          if (auszug.parkplatz) {
            addLine("Parkplatz-Distanz", auszug.parkplatz.distanz_meter ? `${auszug.parkplatz.distanz_meter} m` : null);
            addLine("Stufen zum Eingang", auszug.parkplatz.stufen ? translateValue("stufen", auszug.parkplatz.stufen) : null);
            addLine("Weg beeinträchtigt", auszug.parkplatz.weg_beeintraechtigt);
            if (auszug.parkplatz.beeintraechtigung_details) addLine("Details", auszug.parkplatz.beeintraechtigung_details);
          }
          if (auszug.zusatz && Object.keys(auszug.zusatz).length > 0) {
            const items = Object.entries(auszug.zusatz).filter(([,v]) => v === true || (typeof v === "number" && v > 0)).map(([k]) => k.replace(/_/g," "));
            if (items.length > 0) addLine("Zusatz (Auszug)", items.join(", "));
          }
        }

        if (lead.to_plz && lead.to_city) {
          addSectionTitle("Einzugsadresse");
          if (distribution.status === "accepted") {
            addLine("Strasse", `${lead.to_street || ""} ${lead.to_house_number || ""}`.trim());
          }
          addLine("PLZ / Ort", `${lead.to_plz || ""} ${lead.to_city || ""}`.trim());
          addLine("Stockwerk", lead.to_floor !== null ? translateValue("stockwerk", `floor_${lead.to_floor}`) : null);
          addLine("Lift", lead.to_has_lift);

          if (detailedData?.einzug) {
            const einzug = detailedData.einzug;
            addLine("Immobilientyp", einzug.property_type ? translateValue("property_type", einzug.property_type) : null);
            addLine("Zimmer", einzug.anzahl_zimmer);
            addLine("Wohnfläche", einzug.wohnflaeche_m2 ? `${einzug.wohnflaeche_m2} m²` : null);
            addLine("Anzahl Stockwerke", einzug.anzahl_stockwerke);
            if (einzug.lift?.vorhanden) {
              addLine("Lift-Typ", einzug.lift.typ ? translateValue("lift", einzug.lift.typ) : "Vorhanden");
            }
            if (einzug.parkplatz) {
              addLine("Parkplatz-Distanz", einzug.parkplatz.distanz_meter ? `${einzug.parkplatz.distanz_meter} m` : null);
              addLine("Stufen zum Eingang", einzug.parkplatz.stufen ? translateValue("stufen", einzug.parkplatz.stufen) : null);
              addLine("Weg beeinträchtigt", einzug.parkplatz.weg_beeintraechtigt);
            }
            if (einzug.zusatz && Object.keys(einzug.zusatz).length > 0) {
              const items = Object.entries(einzug.zusatz).filter(([,v]) => v === true || (typeof v === "number" && v > 0)).map(([k]) => k.replace(/_/g," "));
              if (items.length > 0) addLine("Zusatz (Einzug)", items.join(", "));
            }
          }
        }

        // Umzugsdetails (v2 wizard)
        if (dfd && "umzugsart" in dfd) {
          addSectionTitle("Umzugsdetails");
          addLine("Art", String(dfd.umzugsart || "") === "firma" ? "Firmenumzug" : "Privatumzug");
          addLine("Unterkunft", String(dfd.unterkunft || ""));
          if (dfd.vol) {
            const volMap: Record<string,string> = { klein:"Klein", mittel:"Mittel", gross:"Gross", "sehr-gross":"Sehr gross" };
            addLine("Umfang", volMap[String(dfd.vol)] ?? String(dfd.vol));
          }
          const flexMap: Record<string,string> = { fix:"Festes Datum", "3":"± 3 Tage", "7":"± 1 Woche", "14":"± 2 Wochen" };
          if (dfd.flex) addLine("Flexibilität", flexMap[String(dfd.flex)] ?? String(dfd.flex));
        }

        // Inventar (old 17-step)
        if (detailedData?.inventar?.items && detailedData.inventar.items.length > 0) {
          addSectionTitle("Inventar");
          const grouped: Record<string, Array<{name: string; anzahl: number}>> = {};
          for (const item of detailedData.inventar.items) {
            const cat = item.kategorie || "Sonstiges";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ name: item.name, anzahl: item.anzahl });
          }
          for (const [cat, items] of Object.entries(grouped)) {
            checkPageBreak(12);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(cat, 26, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            for (const item of items) {
              checkPageBreak(6);
              doc.text(`  • ${item.name}: ${item.anzahl}x`, 26, y);
              y += 5;
            }
          }
        }

        // Zusatzleistungen (Umzug)
        const additionalServices: string[] = [];
        if (lead.packing_service_needed) additionalServices.push("Packservice");
        if (lead.cleaning_service_needed) additionalServices.push("Reinigung");
        if (lead.storage_needed) additionalServices.push(`Einlagerung${lead.storage_duration ? ` (${lead.storage_duration})` : ""}`);
        if (detailedData?.zusatzleistungen) {
          for (const [key, value] of Object.entries(detailedData.zusatzleistungen)) {
            if (value === true) additionalServices.push(key.replace(/_/g," "));
            else if (value && typeof value === "object" && !Array.isArray(value) && "aktiv" in (value as object) && (value as {aktiv:boolean}).aktiv) {
              additionalServices.push(key.replace(/_/g," "));
            }
          }
        }
        if (additionalServices.length > 0) {
          addSectionTitle("Zusatzleistungen");
          addLine("Leistungen", additionalServices.join(", "));
        }
      }

      // ===== TERMIN =====
      addSectionTitle("Termin");
      addLine("Wunschtermin", formatDate(lead.preferred_date));
      addLine("Zeitfenster", lead.preferred_time_slot);
      if (dfd?.flex) {
        const flexMap: Record<string,string> = { fix:"Festes Datum", "3":"± 3 Tage", "7":"± 1 Woche", "14":"± 2 Wochen" };
        addLine("Flexibilität", flexMap[String(dfd.flex)] ?? String(dfd.flex));
      }
      if (detailedData?.umzug_details) {
        addLine("Flexibilität", detailedData.umzug_details.flexibilitaet ? translateValue("flexibilitaet", detailedData.umzug_details.flexibilitaet) : null);
        addLine("Startzeit", detailedData.umzug_details.startzeit);
      }

      // ===== KLAVIER =====
      if (lead.piano_type) {
        addSectionTitle("Klavier / Flügel");
        addLine("Typ", lead.piano_type);
        addLine("Marke", lead.piano_brand);
        addLine("Gewicht", lead.piano_weight_kg ? `${lead.piano_weight_kg} kg` : null);
      }

      // ===== BESCHREIBUNG =====
      if (lead.description) {
        addSectionTitle("Beschreibung / Bemerkungen");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const descLines = doc.splitTextToSize(lead.description, pageWidth - 52);
        const descHeight = descLines.length * 5 + 8;
        checkPageBreak(descHeight + 4);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(24, y - 4, pageWidth - 48, descHeight, 2, 2, "F");
        doc.setTextColor(30, 41, 59);
        doc.text(descLines, 28, y + 1);
        y += descHeight + 4;
      }

      // ===== SCHÄTZUNGEN =====
      if (lead.distance_km || lead.estimated_job_price_min || lead.estimated_duration_minutes) {
        addSectionTitle("Schätzungen");
        addLine("Distanz", lead.distance_km ? `${lead.distance_km.toFixed(1)} km` : null);
        addLine("Geschätzte Dauer", lead.estimated_duration_minutes ? `${Math.floor(lead.estimated_duration_minutes / 60)}h ${lead.estimated_duration_minutes % 60}min` : null);
        if (lead.estimated_job_price_min && lead.estimated_job_price_max) {
          addLine("Preisrahmen", `CHF ${Number(lead.estimated_job_price_min).toLocaleString("de-CH")} – ${Number(lead.estimated_job_price_max).toLocaleString("de-CH")}`);
        }
      }

      // ===== FOOTER =====
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);

        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Seite ${i} / ${totalPages}`, 20, pageHeight - 13);
        doc.text("Offerio • offerio.ch • info@offerio.ch", pageWidth / 2, pageHeight - 13, { align: "center" });
        doc.text("Vertraulich – Nur für die anfragende Firma", pageWidth - 20, pageHeight - 13, { align: "right" });
      }

      doc.save(`Anfrage_${lead.slug || lead.id}.pdf`);

      toast({
        title: "PDF heruntergeladen",
        description: "Die Anfrage wurde als PDF gespeichert.",
      });
    } catch (error) {
      console.error("Error generating lead PDF:", error);
      toast({
        title: "Fehler",
        description: "Die PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const availableServiceTypes = useMemo(() => {
    const types = new Set<string>();
    distributions.forEach((d) => {
      if (d.lead?.service_type) types.add(d.lead.service_type);
    });
    return Array.from(types).sort();
  }, [distributions]);

  const filterDistributions = (dists: LeadDistribution[]) => {
    return dists.filter((d) => {
      if (serviceTypeFilter !== "all" && d.lead?.service_type !== serviceTypeFilter) {
        return false;
      }
      if (urgencyFilter !== "all") {
        const urgency = getUrgencyLevel(d.lead?.preferred_date || null);
        if (urgencyFilter === "urgent" && urgency !== "urgent") return false;
        if (urgencyFilter === "thisweek" && urgency !== "thisweek") return false;
        if (urgencyFilter === "soon" && urgency !== "soon") return false;
        if (urgencyFilter === "later" && !["later", "none"].includes(urgency)) return false;
      }
      return true;
    });
  };

  const pendingLeads = filterDistributions(distributions.filter((d) => {
    if (d.status !== "sent") return false;
    // expires_at geçmişse pending değil — verpasst
    if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
    return true;
  }));
  const allAcceptedLeads = distributions.filter((d) => d.status === "accepted");
  // Split accepted leads: those without offer vs those with offer
  const acceptedWithoutOffer = filterDistributions(allAcceptedLeads.filter((d) => !d.existing_offer));
  const acceptedWithOffer = filterDistributions(allAcceptedLeads.filter((d) => d.existing_offer));
  const archivedLeads = filterDistributions(distributions.filter((d) => {
    if (["rejected", "expired", "quota_full"].includes(d.status || "")) return true;
    // status=sent ama expires_at geçmişse "verpasst" olarak göster
    if (d.status === "sent" && d.expires_at && new Date(d.expires_at) < new Date()) return true;
    return false;
  }));

  const totalPendingCount = distributions.filter((d) => {
    if (d.status !== "sent") return false;
    if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
    return true;
  }).length;

  // Service type icon mapping
  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'umzug_privat':
      case 'umzug_firma':
        return '🏠';
      case 'reinigung':
        return '🧹';
      case 'entsorgung':
      case 'raeumung':
        return '🗑️';
      case 'lagerung':
        return '📦';
      case 'klaviertransport':
        return '🎹';
      default:
        return '📋';
    }
  };

  const LeadCard = ({ distribution, showCustomer = false }: { distribution: LeadDistribution; showCustomer?: boolean }) => {
    const lead = distribution.lead;
    if (!lead) return null;

    const cost = Number(distribution.token_cost || lead.token_cost || 10);

    const getExpiryInfo = () => {
      if (distribution.status !== "sent" || !distribution.expires_at) return null;
      const expiresAt = new Date(distribution.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      if (diffMs <= 0) return { label: "Abgelaufen", className: "bg-red-100 text-red-700 border border-red-300" };
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (diffHours < 1) return { label: `Noch ${diffMins} Min.`, className: "bg-red-100 text-red-700 border border-red-300" };
      if (diffHours < 4) return { label: `Noch ${diffHours} Std.`, className: "bg-orange-100 text-orange-700 border border-orange-200" };
      return { label: `Noch ${diffHours} Std.`, className: "bg-slate-100 text-slate-600 border border-slate-200" };
    };
    const expiryInfo = getExpiryInfo();

    const detailTags: string[] = [];
    if (lead.from_rooms) detailTags.push(`${lead.from_rooms} Zimmer`);
    if (lead.from_living_space_m2) detailTags.push(`${lead.from_living_space_m2} m²`);
    if (lead.packing_service_needed) detailTags.push("Einpackservice");
    if (lead.cleaning_service_needed) detailTags.push("Reinigung");
    if (lead.storage_needed) detailTags.push("Einlagerung");
    if (lead.piano_type) detailTags.push(`Klavier`);
    if (lead.has_heavy_items) detailTags.push("Schwere Gegenstände");
    if (lead.estimated_volume) detailTags.push(lead.estimated_volume);

    const getDateUrgency = () => {
      if (!lead.preferred_date) return null;
      const preferredDate = new Date(lead.preferred_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((preferredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { label: "Vergangen", className: "bg-slate-100 text-slate-500", icon: Clock };
      if (diffDays <= 3) return { label: "Dringend", className: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200", icon: Zap };
      if (diffDays <= 7) return { label: "Diese Woche", className: "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200", icon: Calendar };
      if (diffDays <= 14) return { label: "Bald", className: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200", icon: Calendar };
      return null;
    };

    const urgency = getDateUrgency();

    return (
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Status indicator bar */}
        <div className={`absolute top-0 left-0 w-full h-1 ${
          distribution.status === "sent" && !distribution.existing_offer
            ? "bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"
            : distribution.status === "accepted"
              ? "bg-gradient-to-r from-emerald-500 to-green-500"
              : distribution.status === "quota_full"
                ? "bg-gradient-to-r from-orange-400 to-amber-500"
                : "bg-slate-300"
        }`} />
        
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-2xl">
                  {getServiceIcon(lead.service_type)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{getServiceLabel(lead.service_type)}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {distribution.status === "sent" && !distribution.existing_offer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-200">
                        <Sparkles className="w-3 h-3" />
                        Neu
                      </span>
                    )}
                    {distribution.status === "quota_full" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200">
                        <Clock className="w-3 h-3" />
                        Vergeben
                      </span>
                    )}
                    {urgency && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${urgency.className}`}>
                        <urgency.icon className="w-3 h-3" />
                        {urgency.label}
                      </span>
                    )}
                    {expiryInfo && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${expiryInfo.className}`}>
                        <Clock className="w-3 h-3" />
                        {expiryInfo.label}
                      </span>
                    )}
                    {distribution.existing_offer && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        distribution.existing_offer.status === 'sent' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : distribution.existing_offer.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : distribution.existing_offer.status === 'rejected'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        <FileText className="w-3 h-3" />
                        {distribution.existing_offer.status === 'draft' && 'Offerte erstellt'}
                        {distribution.existing_offer.status === 'sent' && 'Offerte gesendet'}
                        {distribution.existing_offer.status === 'accepted' && 'Angenommen'}
                        {distribution.existing_offer.status === 'rejected' && 'Abgelehnt'}
                        {distribution.existing_offer.status === 'viewed' && 'Angesehen'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Token cost badge */}
              {distribution.status === "sent" && (
                <div className="flex flex-col items-end gap-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-amber-700 dark:text-amber-400">{cost}</span>
                  </div>
                  {/* Max companies info */}
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Users className="w-3 h-3" />
                    <span className="text-[10px] font-medium">
                      {lead.max_companies === 1 ? 'Exklusiv' : `max. ${lead.max_companies || 3} Firmen`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Detail tags */}
            {detailTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detailTags.slice(0, 5).map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {tag}
                  </span>
                ))}
                {detailTags.length > 5 && (
                  <span className="text-[10px] text-slate-400">+{detailTags.length - 5}</span>
                )}
              </div>
            )}

            {/* Location & Date */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>
                  {lead.from_plz} {lead.from_city}
                  {lead.to_city && (
                    <>
                      <ArrowRight className="w-3 h-3 inline mx-1" />
                      {lead.to_plz || ''} {lead.to_city}
                    </>
                  )}
                </span>
              </div>
              {lead.distance_km && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                  <Navigation className="w-3.5 h-3.5" />
                  {Number(lead.distance_km).toFixed(1)} km
                </div>
              )}
              {lead.preferred_date && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {formatDate(lead.preferred_date)}
                </div>
              )}
            </div>

            {/* Estimated Price */}
            {lead.estimated_job_price_min && lead.estimated_job_price_max && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">Geschätzter Wert</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">
                      CHF {Number(lead.estimated_job_price_min).toLocaleString('de-CH')} – {Number(lead.estimated_job_price_max).toLocaleString('de-CH')}
                    </p>
                  </div>
                </div>
                {distribution.status === "sent" && cost > 0 && (
                  <div className="text-right hidden sm:block">
                    <span className="text-xs text-emerald-600">ROI: ~{Math.round((Number(lead.estimated_job_price_min) + Number(lead.estimated_job_price_max)) / 2 / cost)}x</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer info for accepted */}
            {showCustomer && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {lead.customer_first_name} {lead.customer_last_name}
                  </span>
                </div>
                {distribution.status === "accepted" ? (
                  <div className="flex flex-wrap gap-3">
                    <a href={`tel:${lead.customer_phone}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                      <Phone className="w-4 h-4" />
                      {lead.customer_phone}
                    </a>
                    <a href={`mailto:${lead.customer_email}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                      <Mail className="w-4 h-4" />
                      {lead.customer_email}
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Kontaktdaten nach Annahme sichtbar
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {distribution.status === "sent" && (
                <>
                  <div className="hidden sm:flex flex-1" />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full sm:w-auto"
                      onClick={() => {
                        setSelectedLead(distribution);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      Details
                    </Button>
                    {!(distribution.expires_at && new Date(distribution.expires_at) < new Date()) && (
                      <Button
                        size="sm"
                        className="h-9 w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                        onClick={() => handleAcceptLead(distribution)}
                        disabled={tokenBalance < cost}
                        title={tokenBalance < cost ? `Nicht genügend Tokens (${tokenBalance} / ${cost} benötigt)` : undefined}
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        Annehmen
                      </Button>
                    )}
                  </div>
                </>
              )}
              {distribution.status === "accepted" && (
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full">
                  {/* PDF Download */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => downloadLeadPdf(distribution)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    PDF
                  </Button>
                  
                  {/* Offerte erstellen */}
                  <Button
                    size="sm"
                    className={`h-9 ${distribution.existing_offer 
                      ? '' 
                      : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600'
                    }`}
                    variant={distribution.existing_offer ? "outline" : "default"}
                    onClick={() => {
                      if (distribution.existing_offer) {
                        navigate(`/firma/offerte-bearbeiten/${distribution.existing_offer.id}`);
                      } else {
                        navigate(`/firma/offerten/neu?lead=${distribution.lead_id}&distribution=${distribution.id}`);
                      }
                    }}
                  >
                    <ClipboardList className="w-4 h-4 mr-1.5" />
                    {distribution.existing_offer ? 'Bearbeiten' : 'Offerte erstellen'}
                  </Button>
                  
                  {/* Virtuelle Besichtigung */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setSelectedLead(distribution);
                      setIsVirtualBesichtigungOpen(true);
                    }}
                  >
                    <Camera className="w-4 h-4 mr-1.5" />
                    V. Besichtigung
                  </Button>

                  {/* CRM: Termin */}
                  {hasCrmAccess && distribution.existing_offer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => navigate(`/firma/kalender?newAppointment=true&leadId=${distribution.lead_id}`)}
                    >
                      <CalendarPlus className="w-4 h-4 mr-1.5" />
                      Termin
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setSelectedLead(distribution);
                      setIsDetailOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    Details
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Anfragen | Firma</title>
      </Helmet>
      <FirmaLayout>
        <div className="space-y-6">
          {/* Modern Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-5 md:p-8 text-white">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex flex-col gap-4">
                {/* Title row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Inbox className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-3xl font-bold">Anfragen</h1>
                      <p className="text-white/80 text-xs md:text-sm">Verwalten Sie Ihre Lead-Anfragen</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchData()}
                    disabled={isLoading}
                    className="shrink-0 text-white/80 hover:text-white hover:bg-white/20 border border-white/20 h-8 px-3"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                    <span className="text-xs">Aktualisieren</span>
                  </Button>
                </div>

                {/* Stats + Token row — wraps on very small screens */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{totalPendingCount}</div>
                      <div className="text-[10px] md:text-xs text-white/70">Neue</div>
                    </div>
                    <div className="w-px h-7 bg-white/20" />
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{acceptedWithoutOffer.length}</div>
                      <div className="text-[10px] md:text-xs text-white/70">Akzeptiert</div>
                    </div>
                    <div className="w-px h-7 bg-white/20" />
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{acceptedWithOffer.length}</div>
                      <div className="text-[10px] md:text-xs text-white/70">Mit Offerte</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <Coins className="w-4 h-4 md:w-5 md:h-5 text-amber-300" />
                    <span className="font-bold text-base md:text-lg">{tokenBalance.toLocaleString("de-CH")}</span>
                    <span className="text-white/70 text-xs md:text-sm">Tokens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Service-Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Service-Typen</SelectItem>
                  {availableServiceTypes.map((type) => (
                    <SelectItem key={type} value={type}>{getServiceLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Dringlichkeit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Dringlichkeiten</SelectItem>
                  <SelectItem value="urgent">🔥 Dringend (≤3 Tage)</SelectItem>
                  <SelectItem value="thisweek">📅 Diese Woche</SelectItem>
                  <SelectItem value="soon">⏰ Bald (≤14 Tage)</SelectItem>
                  <SelectItem value="later">📆 Später</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(serviceTypeFilter !== "all" || urgencyFilter !== "all") && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-slate-500 hover:text-slate-700 w-full sm:w-auto"
                onClick={() => {
                  setServiceTypeFilter("all");
                  setUrgencyFilter("all");
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          {/* Modern Tabs */}
          <Tabs defaultValue="new" className="w-full">
            <div className="w-full overflow-x-auto pb-0.5">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-max min-w-full sm:min-w-0 sm:w-fit">
                <TabsList className="bg-transparent p-0 h-auto flex">
                  <TabsTrigger 
                    value="new" 
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Neue Anfragen</span>
                    <span className="sm:hidden ml-1">Neu</span>
                    {totalPendingCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                        {totalPendingCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="accepted"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Akzeptiert</span>
                    <span className="sm:hidden ml-1">Akzeptiert</span>
                    <span className="ml-1 text-slate-400 text-[10px] sm:text-xs">({acceptedWithoutOffer.length})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="with-offer"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline ml-1.5">Mit Offerte</span>
                    <span className="sm:hidden ml-1">Offerte</span>
                    <span className="ml-1 text-slate-400 text-[10px] sm:text-xs">({acceptedWithOffer.length})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="archive"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
                  >
                    <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline ml-1">Verpasste Anfragen</span>
                    <span className="sm:hidden ml-1">Verpasst</span>
                    <span className="ml-1 text-slate-400 text-[10px] sm:text-xs">({archivedLeads.length})</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="new" className="mt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-sm text-slate-500">Lade Anfragen...</p>
                  </div>
                </div>
              ) : pendingLeads.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {pendingLeads.slice((newPage - 1) * pageSize, newPage * pageSize).map((d) => (
                      <LeadCard key={d.id} distribution={d} />
                    ))}
                  </div>
                  <PaginationBar
                    total={pendingLeads.length}
                    page={newPage}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setNewPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Inbox className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine neuen Anfragen</h3>
                  <p className="text-slate-500 dark:text-slate-400">Neue Anfragen werden hier angezeigt</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="accepted" className="mt-6">
              {acceptedWithoutOffer.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {acceptedWithoutOffer.slice((acceptedPage - 1) * pageSize, acceptedPage * pageSize).map((d) => (
                      <LeadCard key={d.id} distribution={d} showCustomer />
                    ))}
                  </div>
                  <PaginationBar
                    total={acceptedWithoutOffer.length}
                    page={acceptedPage}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setAcceptedPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine akzeptierten Anfragen ohne Offerte</h3>
                  <p className="text-slate-500 dark:text-slate-400">Akzeptierte Anfragen ohne Offerte erscheinen hier</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="with-offer" className="mt-6">
              {acceptedWithOffer.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {acceptedWithOffer.slice((withOfferPage - 1) * pageSize, withOfferPage * pageSize).map((d) => (
                      <LeadCard key={d.id} distribution={d} showCustomer />
                    ))}
                  </div>
                  <PaginationBar
                    total={acceptedWithOffer.length}
                    page={withOfferPage}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setWithOfferPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine Anfragen mit Offerte</h3>
                  <p className="text-slate-500 dark:text-slate-400">Anfragen mit erstellter Offerte erscheinen hier</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="archive" className="mt-6">
              {archivedLeads.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {archivedLeads.slice((archivePage - 1) * pageSize, archivePage * pageSize).map((d) => (
                      <LeadCard key={d.id} distribution={d} />
                    ))}
                  </div>
                  <PaginationBar
                    total={archivedLeads.length}
                    page={archivePage}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setArchivePage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Archive className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine verpassten Anfragen</h3>
                  <p className="text-slate-500 dark:text-slate-400">Abgelehnte, abgelaufene und verpasste Anfragen erscheinen hier</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Lead Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedLead?.lead && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                      {getServiceIcon(selectedLead.lead.service_type)}
                    </div>
                    <div>
                      <DialogTitle className="text-lg">{getServiceLabel(selectedLead.lead.service_type)}</DialogTitle>
                      <DialogDescription>Anfrage #{selectedLead.lead.slug}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Existing Offer Banner */}
                  {selectedLead.existing_offer && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                      selectedLead.existing_offer.status === 'sent' 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' 
                        : selectedLead.existing_offer.status === 'accepted'
                          ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : selectedLead.existing_offer.status === 'rejected'
                            ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedLead.existing_offer.status === 'sent' 
                            ? 'bg-blue-100 dark:bg-blue-900/50' 
                            : selectedLead.existing_offer.status === 'accepted'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50'
                              : selectedLead.existing_offer.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-900/50'
                                : 'bg-amber-100 dark:bg-amber-900/50'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            selectedLead.existing_offer.status === 'sent' 
                              ? 'text-blue-600' 
                              : selectedLead.existing_offer.status === 'accepted'
                                ? 'text-emerald-600'
                                : selectedLead.existing_offer.status === 'rejected'
                                  ? 'text-red-600'
                                  : 'text-amber-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">
                            {selectedLead.existing_offer.status === 'draft' && '📝 Offerte erstellt (Entwurf)'}
                            {selectedLead.existing_offer.status === 'sent' && '✉️ Offerte wurde gesendet'}
                            {selectedLead.existing_offer.status === 'accepted' && '✅ Offerte wurde angenommen'}
                            {selectedLead.existing_offer.status === 'rejected' && '❌ Offerte wurde abgelehnt'}
                            {selectedLead.existing_offer.status === 'viewed' && '👁️ Offerte wurde angesehen'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Erstellt am {new Date(selectedLead.existing_offer.created_at).toLocaleDateString('de-CH')}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setIsDetailOpen(false);
                          navigate(`/firma/offerte-bearbeiten/${selectedLead.existing_offer!.id}`);
                        }}
                      >
                        Öffnen
                      </Button>
                    </div>
                  )}

                  {/* Estimated Price */}
                  {selectedLead.lead.estimated_job_price_min && selectedLead.lead.estimated_job_price_max && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">Geschätzter Auftragswert</p>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                            CHF {Number(selectedLead.lead.estimated_job_price_min).toLocaleString('de-CH')} – {Number(selectedLead.lead.estimated_job_price_max).toLocaleString('de-CH')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Distance */}
                  {selectedLead.lead.distance_km && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                      <Navigation className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                          {Number(selectedLead.lead.distance_km).toFixed(1)} km Entfernung
                        </p>
                        {selectedLead.lead.estimated_duration_minutes && (
                          <p className="text-xs text-indigo-600/70">~{Math.round(selectedLead.lead.estimated_duration_minutes)} Min. Fahrzeit</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Determine if a detailed section covers location / service data */}
                  {(() => {
                    const dfd = selectedLead.lead.detailed_form_data;
                    const isV2 = selectedLead.lead.form_version === 2;
                    const svcType = selectedLead.lead.service_type?.toLowerCase() ?? "";
                    // Umzug with new 5-step wizard ('vol') or old 17-step wizard ('auszug')
                    const hasUmzugDetail = !!(
                      dfd && isV2 &&
                      svcType.startsWith('umzug') &&
                      ('vol' in dfd || 'auszug' in dfd)
                    );
                    // Reinigung with new wizard
                    const hasReinigungDetail = !!(
                      dfd && isV2 &&
                      svcType.includes('reinigung') &&
                      !('auszug' in dfd)
                    );
                    // Räumung or Entsorgung with new wizard
                    const hasRaeumungDetail = !!(
                      dfd && isV2 &&
                      (svcType === 'raeumung' || svcType === 'entsorgung') &&
                      ('rart' in dfd || 'entCats' in dfd)
                    );
                    const hasAnyDetail = hasUmzugDetail || hasReinigungDetail || hasRaeumungDetail;

                    return (
                      <>
                        {/* Location Grid — hidden for Umzug/Räumung with detailed data (detail block shows everything) */}
                        {!hasUmzugDetail && !hasRaeumungDetail ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                              <p className="text-xs text-slate-500 mb-1">Von</p>
                              <p className="font-medium">{selectedLead.lead.from_plz} {selectedLead.lead.from_city}</p>
                            </div>
                            {selectedLead.lead.to_city && (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                                <p className="text-xs text-slate-500 mb-1">Nach</p>
                                <p className="font-medium">{selectedLead.lead.to_plz || ''} {selectedLead.lead.to_city}</p>
                              </div>
                            )}
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                              <p className="text-xs text-slate-500 mb-1">Wunschdatum</p>
                              <p className="font-medium">{formatDate(selectedLead.lead.preferred_date)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                              <p className="text-xs text-slate-500 mb-1">Erstellt am</p>
                              <p className="font-medium">{formatDate(selectedLead.lead.created_at)}</p>
                            </div>
                          </div>
                        ) : (
                          /* When Umzug detail covers Von/Nach/Datum, show only Erstellt am */
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>Erstellt am {formatDate(selectedLead.lead.created_at)}</span>
                          </div>
                        )}

                        {/* Description */}
                        {selectedLead.lead.description && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <p className="text-xs text-slate-500 mb-1">Beschreibung</p>
                            <p className="text-sm">{selectedLead.lead.description}</p>
                          </div>
                        )}

                        {/* Service Details (Zimmer / Fläche / Etage) — hidden when a detail section covers the same data */}
                        {!hasAnyDetail && (selectedLead.lead.from_rooms || selectedLead.lead.from_living_space_m2 || selectedLead.lead.from_floor !== null) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {selectedLead.lead.from_rooms && (
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                                <p className="text-xs text-slate-500">Zimmer</p>
                                <p className="font-bold">{selectedLead.lead.from_rooms}</p>
                              </div>
                            )}
                            {selectedLead.lead.from_living_space_m2 && (
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                                <p className="text-xs text-slate-500">Fläche</p>
                                <p className="font-bold">{selectedLead.lead.from_living_space_m2} m²</p>
                              </div>
                            )}
                            {selectedLead.lead.from_floor !== null && (
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                                <p className="text-xs text-slate-500">Etage</p>
                                <p className="font-bold">{selectedLead.lead.from_floor}. {selectedLead.lead.from_has_lift ? '✓Lift' : ''}</p>
                              </div>
                            )}
                            {selectedLead.lead.to_floor !== null && (
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                                <p className="text-xs text-slate-500">Ziel-Etage</p>
                                <p className="font-bold">{selectedLead.lead.to_floor}. {selectedLead.lead.to_has_lift ? '✓Lift' : ''}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Extra Services — hidden for Umzug/Räumung (detail blocks have Zusatzleistungen) */}
                        {!hasUmzugDetail && !hasRaeumungDetail && (selectedLead.lead.packing_service_needed || selectedLead.lead.cleaning_service_needed || selectedLead.lead.storage_needed) && (
                          <div className="flex flex-wrap gap-2">
                            {selectedLead.lead.packing_service_needed && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">📦 Einpackservice</span>
                            )}
                            {selectedLead.lead.cleaning_service_needed && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">🧹 Reinigung</span>
                            )}
                            {selectedLead.lead.storage_needed && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                🏪 Einlagerung {selectedLead.lead.storage_duration && `(${selectedLead.lead.storage_duration})`}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Piano Details */}
                  {selectedLead.lead.piano_type && (
                    <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                      <p className="text-xs text-violet-600 font-semibold mb-2">🎹 Klavierdetails</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-violet-500 text-xs">Typ</p>
                          <p className="font-medium">{selectedLead.lead.piano_type}</p>
                        </div>
                        {selectedLead.lead.piano_brand && (
                          <div>
                            <p className="text-violet-500 text-xs">Marke</p>
                            <p className="font-medium">{selectedLead.lead.piano_brand}</p>
                          </div>
                        )}
                        {selectedLead.lead.piano_weight_kg && (
                          <div>
                            <p className="text-violet-500 text-xs">Gewicht</p>
                            <p className="font-medium">{selectedLead.lead.piano_weight_kg} kg</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detailed Reinigung Data */}
                  {selectedLead.lead.detailed_form_data && 
                   selectedLead.lead.form_version === 2 && 
                   selectedLead.lead.service_type?.toLowerCase().includes('reinigung') &&
                   !('auszug' in selectedLead.lead.detailed_form_data) && (() => {
                    const d = selectedLead.lead.detailed_form_data;
                    // Support both new wizard format and old legacy format
                    const unterkunft  = (d.unterkunft || d.unterkunft_art) as string | undefined;
                    const zimmer      = (d.zimmer     || d.zimmer_anzahl)  as string | number | undefined;
                    const m2          = (d.m2         || d.wohnflaeche_m2) as number | undefined;
                    const bad         = d.bad  as number | undefined;
                    const wc          = d.wc   as number | undefined;
                    const badOld      = ((d.badezimmer as Record<string,number> | undefined)?.duschen_badewannen || 0) +
                                        ((d.badezimmer as Record<string,number> | undefined)?.toiletten || 0);
                    const fenNormal   = (d.fen_normal ?? (d.fenster as Record<string,number> | undefined)?.normale_fenster ?? 0) as number;
                    const fenGross    = (d.fen_gross  ?? (d.fenster as Record<string,number> | undefined)?.fensterwaende   ?? 0) as number;
                    const fenTuer     = (d.fen_tuer   ?? (d.fenster as Record<string,number> | undefined)?.fenstertueren   ?? 0) as number;
                    const storenBool  = d.storen as boolean | undefined;
                    const storenCount = d.storen_count as number | undefined;
                    const rooms       = Array.isArray(d.rooms) ? d.rooms as string[] : [];
                    const zusRaeume   = d.zusatz_raeume as Record<string, unknown> | undefined;
                    const balkon      = (d.balkon ?? (zusRaeume?.balkon as Record<string,unknown> | undefined)?.aktiv) as boolean | undefined;
                    const balkonM2    = (d.balkon_m2 ?? (zusRaeume?.balkon as Record<string,unknown> | undefined)?.flaeche_m2) as number | undefined;
                    const bes         = Array.isArray(d.besonderheiten) ? d.besonderheiten as string[] : null;
                    const besObj      = !Array.isArray(d.besonderheiten) ? d.besonderheiten as Record<string,boolean> | undefined : undefined;
                    const zus         = Array.isArray(d.zusatzleistungen) ? d.zusatzleistungen as string[] : null;
                    const zusObj      = !Array.isArray(d.zusatzleistungen) ? d.zusatzleistungen as Record<string,unknown> | undefined : undefined;
                    const bemerkungen = (d.bemerkungen || (d.termin as Record<string,string> | undefined)?.bemerkungen) as string | undefined;
                    const subtype     = d.service_type as string | undefined;

                    return (
                      <div className="space-y-3 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
                        <div className="text-sm text-cyan-700 dark:text-cyan-400 font-semibold flex items-center gap-2">
                          🧹 Detaillierte Reinigungsanfrage
                          {subtype && (
                            <span className="text-[11px] font-normal text-cyan-600 capitalize">
                              ({subtype === "uebergabereinigung" ? "Übergabereinigung" : subtype === "grundreinigung" ? "Grundreinigung" : subtype === "unterhaltsreinigung" ? "Unterhaltsreinigung" : subtype})
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">Detailformular</Badge>
                        </div>
                        
                        {/* Property Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-center">
                            <p className="text-xs text-slate-500">Unterkunft</p>
                            <p className="font-semibold text-sm capitalize">{unterkunft?.replace(/_/g, ' ') || '–'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-center">
                            <p className="text-xs text-slate-500">Zimmer</p>
                            <p className="font-semibold text-sm">{zimmer || '–'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-center">
                            <p className="text-xs text-slate-500">Fläche</p>
                            <p className="font-semibold text-sm">{m2 ? `${m2} m²` : '–'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-center">
                            <p className="text-xs text-slate-500">Bad / WC</p>
                            <p className="font-semibold text-sm">
                              {bad !== undefined
                                ? `${bad} Bad, ${wc ?? 0} WC`
                                : badOld > 0 ? badOld : '–'}
                            </p>
                          </div>
                        </div>

                        {/* Zusatzräume & Balkon */}
                        {(rooms.length > 0 || zusRaeume || balkon) && (
                          <div className="flex flex-wrap gap-1">
                            {rooms.includes('keller')       && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🏚️ Keller</span>}
                            {rooms.includes('dachboden')    && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🏠 Dachboden</span>}
                            {rooms.includes('garage')       && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🚗 Garage</span>}
                            {rooms.includes('wintergarten') && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🌿 Wintergarten</span>}
                            {zusRaeume?.keller       && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🏚️ Keller</span>}
                            {zusRaeume?.dachboden    && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🏠 Dachboden</span>}
                            {zusRaeume?.garage       && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🚗 Garage</span>}
                            {zusRaeume?.wintergarten && <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">🌿 Wintergarten</span>}
                            {balkon && (
                              <span className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-800">
                                🌅 Balkon{balkonM2 ? ` (${balkonM2} m²)` : ''}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Fenster & Storen */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800">
                            <p className="text-xs text-slate-500 mb-1">Fenster</p>
                            <div className="text-xs space-y-0.5">
                              {fenNormal > 0 && <p>{fenNormal} normale Fenster</p>}
                              {fenGross  > 0 && <p>{fenGross} Fensterwände</p>}
                              {fenTuer   > 0 && <p>{fenTuer} Fenstertüren</p>}
                              {fenNormal + fenGross + fenTuer === 0 && <p className="text-slate-400">–</p>}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800">
                            <p className="text-xs text-slate-500 mb-1">Storen</p>
                            <div className="text-xs">
                              {storenBool
                                ? <p>{storenCount && storenCount > 0 ? `${storenCount} Storen` : 'Vorhanden'}</p>
                                : <p className="text-slate-400">Keine</p>
                              }
                            </div>
                          </div>
                        </div>

                        {/* Besonderheiten */}
                        {((bes && bes.length > 0) || (besObj && !besObj.keine)) && (
                          <div className="flex flex-wrap gap-1">
                            {bes ? (
                              <>
                                {bes.includes('einbauschraenke') && <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Einbauschränke</span>}
                                {bes.includes('kueche_stark')    && <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Stark verschmutzte Küche</span>}
                                {bes.includes('waschturm')       && <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">Waschturm</span>}
                                {bes.includes('haustierhaltung') && <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">Haustierhaltung</span>}
                              </>
                            ) : besObj ? (
                              <>
                                {besObj.einbauschraenke                    && <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Einbauschränke</span>}
                                {besObj.stark_verhaerteter_dreck_kueche    && <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Starke Verschmutzung Küche</span>}
                                {besObj.waschturm                          && <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">Waschturm</span>}
                                {besObj.haustierhaltung                    && <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">Haustierhaltung</span>}
                                {besObj.moebel_vorhanden                   && <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">Möbel vorhanden</span>}
                              </>
                            ) : null}
                          </div>
                        )}

                        {/* Zusatzleistungen */}
                        {(zus || zusObj) && (
                          <div className="flex flex-wrap gap-1">
                            {zus ? (
                              <>
                                {zus.includes('hochdruck') && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">💦 Hochdruckreinigung</span>}
                                {zus.includes('kamin')     && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🔥 Kaminreinigung</span>}
                                {zus.includes('teppich')   && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🧶 Teppichreinigung</span>}
                              </>
                            ) : zusObj ? (
                              <>
                                {zusObj.hochdruck_reinigung                     && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">💦 Hochdruckreinigung</span>}
                                {zusObj.kamin_reinigung                         && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🔥 Kaminreinigung</span>}
                                {(zusObj.teppichboden as Record<string,unknown> | undefined)?.aktiv && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🧶 Teppichreinigung</span>}
                                {zusObj.fugenreinigung                          && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">✨ Fugenreinigung</span>}
                              </>
                            ) : null}
                          </div>
                        )}

                        {/* Bemerkungen */}
                        {bemerkungen && (
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800">
                            <p className="text-xs text-slate-500 mb-1">Bemerkungen</p>
                            <p className="text-sm">{bemerkungen}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Detailed Umzug Data - old 17-step wizard (auszug/einzug structure) */}
                  {selectedLead.lead.detailed_form_data && 
                   'auszug' in selectedLead.lead.detailed_form_data && (
                    <div className="space-y-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="text-sm text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-2">
                        🚚 Detaillierte Umzugsanfrage
                        <Badge variant="secondary" className="text-xs">Detailformular</Badge>
                      </div>
                      
                      {/* Auszug (FROM) */}
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-800 space-y-2">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          📍 Auszugsadresse (VON)
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-900/30">
                            <p className="text-xs text-slate-500">Typ</p>
                            <p className="font-semibold text-sm capitalize">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.property_type?.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-900/30">
                            <p className="text-xs text-slate-500">Zimmer</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.anzahl_zimmer}</p>
                          </div>
                          <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-900/30">
                            <p className="text-xs text-slate-500">Fläche</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.wohnflaeche_m2} m²</p>
                          </div>
                          <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-900/30">
                            <p className="text-xs text-slate-500">Lift</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.lift?.vorhanden ? '✅ Ja' : '❌ Nein'}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {selectedLead.status === 'accepted' 
                            ? `${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.strasse} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.hausnummer}, ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.plz} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.ort}`
                            : `${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.plz} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.adresse?.ort}`
                          }
                        </p>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                            Stock: {(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.stockwerk?.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                            Parkplatz: {(selectedLead.lead.detailed_form_data as UmzugDetailedData).auszug?.parkplatz?.distanz_meter}m
                          </span>
                        </div>
                      </div>
                      
                      {/* Einzug (TO) */}
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-800 space-y-2">
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                          🏠 Einzugsadresse (NACH)
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/30">
                            <p className="text-xs text-slate-500">Typ</p>
                            <p className="font-semibold text-sm capitalize">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.property_type?.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/30">
                            <p className="text-xs text-slate-500">Zimmer</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.anzahl_zimmer}</p>
                          </div>
                          <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/30">
                            <p className="text-xs text-slate-500">Fläche</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.wohnflaeche_m2} m²</p>
                          </div>
                          <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/30">
                            <p className="text-xs text-slate-500">Lift</p>
                            <p className="font-semibold text-sm">{(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.lift?.vorhanden ? '✅ Ja' : '❌ Nein'}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {selectedLead.status === 'accepted' 
                            ? `${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.strasse} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.hausnummer}, ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.plz} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.ort}`
                            : `${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.plz} ${(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.adresse?.ort}`
                          }
                        </p>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                            Stock: {(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.stockwerk?.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                            Parkplatz: {(selectedLead.lead.detailed_form_data as UmzugDetailedData).einzug?.parkplatz?.distanz_meter}m
                          </span>
                        </div>
                      </div>
                      
                      {/* Inventory Summary */}
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-800 space-y-3">
                        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          📦 Inventar
                        </p>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 rounded bg-orange-50 dark:bg-orange-900/30">
                            <p className="text-xs text-slate-500">Kartons</p>
                            <p className="font-bold text-lg text-orange-600">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar?.geschaetzte_kartons || 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded bg-purple-50 dark:bg-purple-900/30">
                            <p className="text-xs text-slate-500">Möbelstücke</p>
                            <p className="font-bold text-lg text-purple-600">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar?.items?.reduce((sum, item) => sum + (item.anzahl || 0), 0) || 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded bg-red-50 dark:bg-red-900/30">
                            <p className="text-xs text-slate-500">Spezial</p>
                            <p className="font-bold text-lg text-red-600">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar?.schwere_gegenstaende?.reduce((sum, item) => sum + (item.anzahl || 0), 0) || 0}
                            </p>
                          </div>
                        </div>
                        
                        {/* Detailed Items List */}
                        {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar?.items && 
                         (selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar!.items.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 font-medium">Möbelstücke im Detail:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar!.items
                                .filter(item => item.anzahl > 0)
                                .map((item, idx) => (
                                  <div key={idx} className="flex justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-700">
                                    <span className="truncate">{item.name}</span>
                                    <span className="font-semibold text-purple-600 ml-2">{item.anzahl}x</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Heavy/Special Items */}
                        {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar?.schwere_gegenstaende && 
                         (selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar!.schwere_gegenstaende.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-red-600 font-medium">⚠️ Schwere/Spezielle Gegenstände:</p>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {(selectedLead.lead.detailed_form_data as UmzugDetailedData).inventar!.schwere_gegenstaende
                                .filter(item => item.anzahl > 0)
                                .map((item, idx) => (
                                  <div key={idx} className="flex justify-between p-1.5 rounded bg-red-50 dark:bg-red-900/30">
                                    <span className="truncate">{item.name}</span>
                                    <span className="font-semibold text-red-600 ml-2">{item.anzahl}x</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Additional Services */}
                      {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen && (
                        <div className="flex flex-wrap gap-1">
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.verpackung?.aktiv && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">📦 Verpackung</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.auspacken && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">📭 Auspacken</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.moebelmontage && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🔧 Möbelmontage</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.entsorgung?.aktiv && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🗑️ Entsorgung</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.endreinigung && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🧹 Endreinigung</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.zwischenlagerung?.aktiv && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🏪 Lagerung</span>
                          )}
                          {(selectedLead.lead.detailed_form_data as UmzugDetailedData).zusatzleistungen?.moebellift?.aktiv && (
                            <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🏗️ Möbellift</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Räumung / Entsorgung — Detailansicht */}
                  {selectedLead.lead.detailed_form_data &&
                   (selectedLead.lead.service_type?.toLowerCase() === 'raeumung' ||
                    selectedLead.lead.service_type?.toLowerCase() === 'entsorgung') &&
                   ('rart' in selectedLead.lead.detailed_form_data || 'entCats' in selectedLead.lead.detailed_form_data) && (() => {
                    const d = selectedLead.lead.detailed_form_data as Record<string, unknown>;
                    const isEntsorgungOnly = selectedLead.lead.service_type?.toLowerCase() === 'entsorgung';
                    const rartLabels: Record<string, string> = {
                      wohnung: "Wohnungsräumung", haus: "Hausräumung", keller: "Kellerräumung",
                      dachboden: "Dachbodenräumung", buero: "Büroräumung",
                    };
                    const volLabels: Record<string, string> = {
                      teil: "Teilräumung", mittel: "Teilweise", gross: "Grosse Räumung", komplett: "Kompletträumung",
                    };
                    const dringLabels: Record<string, string> = {
                      normal: "Normal", dringend: "Dringend", sehr: "Sehr dringend",
                    };
                    const entCats: string[] = Array.isArray(d.entCats) ? (d.entCats as string[]) : [];
                    const entCatLabels: Record<string, string> = {
                      moebel: "Möbel", elektro: "Elektrogeräte", sperrgut: "Sperrmüll",
                      kleider: "Kleider", buero: "Büromaterial", sonstiges: "Sonstiges",
                    };
                    const schwerItems: string[] = Array.isArray(d.schwerItems) ? (d.schwerItems as string[]) : [];
                    const zusItems: string[] = Array.isArray(d.zus) ? (d.zus as string[]) : [];
                    const zusLabels: Record<string, string> = {
                      endreinigung: "Endreinigung", verpackung: "Verpackung", abschliessen: "Abschliessen",
                    };
                    return (
                      <div className="space-y-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                        <div className="text-sm text-orange-700 dark:text-orange-400 font-semibold flex items-center gap-2">
                          🗑️ {isEntsorgungOnly ? "Entsorgungsdetails" : "Räumungsdetails"}
                          {d.rart && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-[10px] font-bold">
                              {rartLabels[String(d.rart)] ?? String(d.rart)}
                            </span>
                          )}
                        </div>

                        {/* Adresse */}
                        {!isEntsorgungOnly && (d.ort || d.plz) && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-1">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">📍 Standort</p>
                            <p className="text-sm font-medium">
                              {selectedLead.status === "accepted" && d.str
                                ? `${String(d.str)} ${String(d.nr || "")}, `
                                : ""}
                              {String(d.plz || "")} {String(d.ort || "")}
                            </p>
                            <div className="flex flex-wrap gap-1 text-xs">
                              {d.stock && (
                                <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">
                                  {String(d.stock)}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">
                                {d.lift ? "🛗 Lift" : "Kein Lift"}
                              </span>
                              {d.m2 && (
                                <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">
                                  {String(d.m2)} m²
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Umfang + Termin + Dringlichkeit */}
                        {!isEntsorgungOnly && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-orange-100">
                              <p className="text-[10px] text-slate-400 mb-0.5">Umfang</p>
                              <p className="font-semibold text-sm text-orange-700">{volLabels[String(d.vol)] || "—"}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-orange-100">
                              <p className="text-[10px] text-slate-400 mb-0.5">Datum</p>
                              <p className="font-semibold text-sm">
                                {selectedLead.lead.preferred_date
                                  ? new Date(selectedLead.lead.preferred_date).toLocaleDateString("de-CH")
                                  : "—"}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-orange-100">
                              <p className="text-[10px] text-slate-400 mb-0.5">Dringlichkeit</p>
                              <p className="font-semibold text-sm text-xs">{dringLabels[String(d.dring)] || "—"}</p>
                            </div>
                          </div>
                        )}

                        {/* Schwere Gegenstände */}
                        {schwerItems.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Schwere Gegenstände</p>
                            <div className="flex flex-wrap gap-1.5">
                              {schwerItems.map((item, i) => (
                                <span key={i} className="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                  ⚠️ {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Entsorgungskategorien */}
                        {entCats.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Entsorgung</p>
                            <div className="flex flex-wrap gap-1.5">
                              {entCats.map((cat, i) => (
                                <span key={i} className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {entCatLabels[cat] ?? cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Zusatzleistungen */}
                        {zusItems.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Zusatzleistungen</p>
                            <div className="flex flex-wrap gap-1.5">
                              {zusItems.map((item, i) => (
                                <span key={i} className="px-2 py-1 rounded text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                  {zusLabels[item] ?? item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Besondere Umstände */}
                        {d.zustand && d.zustandText && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">⚠️ Besondere Umstände</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{String(d.zustandText)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Umzug v2 — Neues 5-Schritt-Formular (von/nach/vol/services) */}
                  {selectedLead.lead.detailed_form_data &&
                   selectedLead.lead.service_type?.toLowerCase().startsWith('umzug') &&
                   'vol' in selectedLead.lead.detailed_form_data && (() => {
                    const d = selectedLead.lead.detailed_form_data as Record<string, unknown>;
                    const svc = (selectedLead.lead.additional_services_umzug as Record<string, unknown> | null) || {};
                    const volLabels: Record<string, string> = {klein:"Klein",mittel:"Mittel",gross:"Gross","sehr-gross":"Sehr gross"};
                    const flexLabels: Record<string, string> = {fix:"Festes Datum","3":"± 3 Tage","7":"± 1 Woche","14":"± 2 Wochen"};
                    const stockLabel = (idx: unknown) => {
                      const opts = ["UG","EG","HP","1. OG","2. OG","3. OG","4. OG","5. OG","6. OG","7. OG","8. OG","9. OG","10. OG","11–15. OG","15.+ OG"];
                      return typeof idx === "number" ? opts[idx] ?? "—" : "—";
                    };
                    return (
                      <div className="space-y-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-2">
                          🚚 Umzugsdetails
                          <span className="px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-[10px] font-bold">
                            {String(d.umzugsart) === "firma" ? "Firmenumzug" : "Privatumzug"} · {String(d.unterkunft || "")}
                          </span>
                        </div>

                        {/* Von → Nach */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-1">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">📦 Von (Auszug)</p>
                            <p className="text-sm font-medium">
                              {selectedLead.status === "accepted" && selectedLead.lead.from_street
                                ? `${selectedLead.lead.from_street} ${selectedLead.lead.from_house_number || ""}, `
                                : ""}
                              {selectedLead.lead.from_plz} {selectedLead.lead.from_city}
                            </p>
                            <div className="flex flex-wrap gap-1 text-xs">
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">
                                {stockLabel(d.von_stock)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">
                                {d.von_lift ? "🛗 Lift" : "Kein Lift"}
                              </span>
                              {d.von_zimmer && <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">{String(d.von_zimmer)} Zi</span>}
                              {d.von_m2 ? <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-amber-200">{String(d.von_m2)} m²</span> : null}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-1">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏠 Nach (Einzug)</p>
                            {(d.nach as Record<string,unknown>)?.unknown ? (
                              <p className="text-sm text-slate-400 italic">Noch nicht bekannt</p>
                            ) : (
                              <>
                                <p className="text-sm font-medium">
                                  {selectedLead.status === "accepted" && selectedLead.lead.to_street
                                    ? `${selectedLead.lead.to_street} ${selectedLead.lead.to_house_number || ""}, `
                                    : ""}
                                  {selectedLead.lead.to_plz} {selectedLead.lead.to_city}
                                </p>
                                <div className="flex flex-wrap gap-1 text-xs">
                                  <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-blue-200">
                                    {stockLabel(d.nach_stock)}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-blue-200">
                                    {d.nach_lift ? "🛗 Lift" : "Kein Lift"}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Umfang + Termin + Flexibilität */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-100">
                            <p className="text-[10px] text-slate-400 mb-0.5">Umfang</p>
                            <p className="font-semibold text-sm text-blue-700">{volLabels[String(d.vol)] || "—"}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-100">
                            <p className="text-[10px] text-slate-400 mb-0.5">Datum</p>
                            <p className="font-semibold text-sm">
                              {d.dateUnknown ? "Offen" : selectedLead.lead.preferred_date ? new Date(selectedLead.lead.preferred_date).toLocaleDateString("de-CH") : "—"}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-100">
                            <p className="text-[10px] text-slate-400 mb-0.5">Flexibilität</p>
                            <p className="font-semibold text-sm text-xs">{flexLabels[String(selectedLead.lead.moving_flexibility || d.flex)] || "—"}</p>
                          </div>
                        </div>

                        {/* Zusatzleistungen */}
                        {Object.keys(svc).length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Zusatzleistungen</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(svc.verpackung as Record<string,unknown>)?.aktiv && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">📦 Verpackung</span>}
                              {svc.moebelmontage && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🔧 Möbelmontage</span>}
                              {svc.endreinigung && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🧹 Endreinigung</span>}
                              {(svc.entsorgung as Record<string,unknown>)?.aktiv && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🗑️ Entsorgung</span>}
                              {(svc.zwischenlagerung as Record<string,unknown>)?.aktiv && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🏭 Zwischenlagerung</span>}
                              {(svc.moebellift as Record<string,unknown>)?.aktiv && <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">🏗️ Möbellift</span>}
                              {!Object.values(svc).some(v => (v as Record<string,unknown>)?.aktiv || v === true) && (
                                <span className="text-xs text-slate-400">Keine Zusatzleistungen</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Customer Contact - Only after acceptance */}
                  {selectedLead.status === "accepted" && (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Kundenkontakt
                      </h4>
                      <p className="font-bold text-slate-900 dark:text-white mb-2">
                        {selectedLead.lead.customer_first_name} {selectedLead.lead.customer_last_name}
                      </p>
                      {selectedLead.status === 'accepted' ? (
                        <>
                          <div className="flex flex-wrap gap-3">
                            <a href={`tel:${selectedLead.lead.customer_phone}`} className="inline-flex items-center gap-2 text-emerald-700 hover:underline">
                              <Phone className="w-4 h-4" />
                              {selectedLead.lead.customer_phone}
                            </a>
                            <a href={`mailto:${selectedLead.lead.customer_email}`} className="inline-flex items-center gap-2 text-emerald-700 hover:underline">
                              <Mail className="w-4 h-4" />
                              {selectedLead.lead.customer_email}
                            </a>
                          </div>
                          {(selectedLead.lead.from_street || selectedLead.lead.from_house_number) && (
                            <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                              <p className="text-xs text-emerald-600 mb-1">Adresse</p>
                              <p className="text-sm font-medium">
                                {selectedLead.lead.from_street} {selectedLead.lead.from_house_number}, {selectedLead.lead.from_plz} {selectedLead.lead.from_city}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-2 p-2 rounded bg-emerald-100 dark:bg-emerald-800/30">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 italic">
                            Kontaktdaten und vollständige Adresse werden nach Annahme angezeigt
                          </p>
                          {selectedLead.lead.from_plz && (
                            <p className="text-sm font-medium mt-1">
                              {selectedLead.lead.from_plz} {selectedLead.lead.from_city}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedLead.status === "sent" && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-700 dark:text-amber-300">Kundendaten verborgen</p>
                          <p className="text-sm text-amber-600/80">
                            Name, Kontaktdaten und genaue Adressen werden nach Annahme sichtbar.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedLead.status === "sent" && (
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <div className="flex gap-2">
                      {!(selectedLead.expires_at && new Date(selectedLead.expires_at) < new Date()) && (
                        <Button variant="outline" onClick={() => handleRejectLead(selectedLead)}>
                          <X className="w-4 h-4 mr-1" />
                          Ablehnen
                        </Button>
                      )}
                      {selectedLead.expires_at && new Date(selectedLead.expires_at) < new Date() ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                          <Clock className="w-4 h-4" />
                          Abgelaufen – nicht mehr verfügbar
                        </div>
                      ) : (
                        <Button
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                          onClick={() => handleAcceptLead(selectedLead)}
                          disabled={isAccepting}
                        >
                          {isAccepting ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Annehmen
                        </Button>
                      )}
                    </div>
                  </DialogFooter>
                )}

                {selectedLead.status === "accepted" && (
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {/* PDF Download - nur für gekaufte Anfragen */}
                    <Button
                      variant="outline"
                      onClick={() => downloadLeadPdf(selectedLead)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF herunterladen
                    </Button>
                    
                    {/* Virtual Besichtigung */}
                    <Button
                      variant="outline"
                      onClick={() => setIsVirtualBesichtigungOpen(true)}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Virtuelle Besichtigung
                    </Button>
                    
                    {/* Create Offer */}
                    <Button
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                      onClick={() => {
                        setIsDetailOpen(false);
                        if (selectedLead.existing_offer) {
                          navigate(`/firma/offerte-bearbeiten/${selectedLead.existing_offer.id}`);
                        } else {
                          navigate(`/firma/offerten/neu?lead=${selectedLead.lead_id}&distribution=${selectedLead.id}`);
                        }
                      }}
                    >
                      <ClipboardList className="w-4 h-4 mr-1" />
                      {selectedLead.existing_offer ? 'Offerte bearbeiten' : 'Offerte erstellen'}
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Virtual Besichtigung Dialog */}
        {selectedLead?.lead && companyId && (
          <CreateVirtualBesichtigungDialog
            open={isVirtualBesichtigungOpen}
            onOpenChange={setIsVirtualBesichtigungOpen}
            companyId={companyId}
            leadId={selectedLead.lead_id}
            customerName={`${selectedLead.lead.customer_first_name} ${selectedLead.lead.customer_last_name}`}
            customerEmail={selectedLead.lead.customer_email}
            customerPhone={selectedLead.lead.customer_phone}
            fromAddress={selectedLead.lead.from_street ? `${selectedLead.lead.from_street} ${selectedLead.lead.from_house_number || ""}`.trim() : ""}
            fromPlz={selectedLead.lead.from_plz}
            fromCity={selectedLead.lead.from_city}
          />
        )}
      </FirmaLayout>
    </>
  );
};

export default FirmaAnfragen;
