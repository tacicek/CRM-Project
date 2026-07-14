import { Helmet } from "react-helmet-async";
import { AuftragModal } from "@/components/firma/AuftragModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Loader2,
  User,
  ArrowLeft,
  Calendar,
  CalendarIcon,
  Mail,
  Phone,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  CheckCircle,
  MessageSquare,
  Building2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Check,
  History,
  CalendarCheck,
  ClipboardList,
} from "lucide-react";
import { Fragment, Suspense, lazy, useEffect, useState } from "react";
import { groupItemsByService } from "@/lib/offerServiceType";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import { sendOffer } from "@/lib/sendOffer";
import { parseSurcharges, sumSurchargeAmounts } from "@/lib/offerSurcharges";
import { computeDisplayTotals, hourlyRange, isFreeItem, itemAmountDisplay, offerHasRateItem, toAmountBasis } from "@/lib/offerPricing";
import { PositionDescription, InklusiveList } from "@/components/offerte/PositionDisplay";
import { OFFER_ITEMS_PDF_SELECT } from "@/lib/offerItemsPdfSelect";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useI18n, useT } from "@/i18n/useI18n";
import { getAppointmentLabel, getOfferStatusLabel, getServiceLabel } from "@/i18n/domain";
import {
  formatCurrency as formatCurrencyI18n,
  formatDate as formatDateI18n,
  formatDateTime as formatDateTimeI18n,
  formatPercent,
} from "@/i18n/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  service_type?: string | null;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  price_type?: string | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  amount_basis?: string | null;
  kostendach_max?: number | null;
}

const PdfPreviewDialog = lazy(async () => {
  const module = await import("@/components/offerte/PdfPreviewDialog");
  return { default: module.PdfPreviewDialog };
});

interface Offer {
  id: string;
  /** Sprache des KUNDEN, beim Erstellen aus dem Lead eingefroren. Steuert PDF + E-Mail. */
  language: string | null;
  title: string;
  description: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  service_date: string | null;
  valid_until: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  access_token: string;
  customer_response_note: string | null;
  lead_id: string | null;
  agb_accepted_at: string | null;
  agb_version: string | null;
  payment_terms: string | null;
  price_model: 'pauschal' | 'stundenansatz' | 'kostendach' | null;
  discount_percent?: number | null;
  surcharges?: unknown;
  hourly_rate: number | null;
  kostendach_max: number | null;
  service_start_time: string | null;
  service_end_time: string | null;
  brief_layout?: boolean | null;
  customer_salutation?: string | null;
  offerte_type?: "normal" | "blind" | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  // Layer 2a: frozen address (preserved even if the lead is deleted). Read priority frozen > lead.
  frozen_from_street?: string | null;
  frozen_from_house_number?: string | null;
  frozen_from_plz?: string | null;
  frozen_from_city?: string | null;
  frozen_from_floor?: number | null;
  frozen_from_has_lift?: boolean | null;
  frozen_has_estrich?: boolean | null;
  frozen_has_keller?: boolean | null;
  frozen_to_street?: string | null;
  frozen_to_house_number?: string | null;
  frozen_to_plz?: string | null;
  frozen_to_city?: string | null;
  frozen_to_floor?: number | null;
  frozen_to_has_lift?: boolean | null;
}

interface Company {
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
  primary_color: string | null;
  signature_url: string | null;
  pdf_template: string | null;
  /** Fallback-Dokumentsprache für Offerten ohne eigene `language`. */
  default_language: string | null;
}

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  status: string;
  created_at: string;
  error_message: string | null;
  metadata: {
    from_email?: string;
    is_company_email?: boolean;
  } | null;
}

interface LeadData {
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_has_estrich?: boolean | null;
  from_has_keller?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  service_type?: string | null;
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  packing_service_needed?: boolean | null;
  cleaning_service_needed?: boolean | null;
  storage_needed?: boolean | null;
  description?: string | null;
  property_type?: string | null;
}

// Legacy alias for compatibility
type LeadAddress = LeadData;

// Visual meta only — the label comes from getOfferStatusLabel(status, locale), so the
// operator's dashboard language decides it (the old map hardcoded German labels).
const STATUS_META: Record<string, { emoji: string; color: string; bg: string }> = {
  draft:    { emoji: "📝", color: "text-folk-ink3",  bg: "bg-folk-bg-warm" },
  sent:     { emoji: "📤", color: "text-folk-sky",   bg: "bg-folk-sky-bg" },
  viewed:   { emoji: "👀", color: "text-folk-lemon", bg: "bg-folk-lemon-bg" },
  accepted: { emoji: "✅", color: "text-folk-mint",  bg: "bg-folk-mint-bg" },
  rejected: { emoji: "❌", color: "text-folk-coral", bg: "bg-folk-coral-bg" },
};

const getStatusMeta = (status: string) =>
  STATUS_META[status] ?? { emoji: "📄", color: "text-folk-ink3", bg: "bg-folk-bg-warm" };

const FirmaOfferteDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  // Dashboard locale — this page is the OPERATOR's view of the offer. The customer's
  // language (offer.language / company.default_language) is threaded separately into the
  // PDF payload below and must never be replaced by these hooks.
  const t = useT();
  const { locale, dateLocale } = useI18n();

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingBesichtigung, setIsConfirmingBesichtigung] = useState(false);
  const [showBesichtigungDialog, setShowBesichtigungDialog] = useState(false);
  const [besichtigungDate, setBesichtigungDate] = useState<Date | undefined>(undefined);
  const [besichtigungTime, setBesichtigungTime] = useState("09:00");
  const [besichtigungDuration, setBesichtigungDuration] = useState("60");
  const [besichtigungAddress, setBesichtigungAddress] = useState({
    street: "",
    houseNumber: "",
    plz: "",
    city: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showAuftragModal, setShowAuftragModal] = useState(false);
  const [existingAuftragId, setExistingAuftragId] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [items, setItems] = useState<OfferItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [leistungsuebersicht, setLeistungsuebersicht] = useState<{
    included_services: Array<{ id: string; name: string; description?: string }>;
    excluded_services: string[];
    special_notes?: string;
  } | null>(null);
  const [agbSections, setAgbSections] = useState<Array<{
    id: string;
    title: string;
    content: string;
    display_order: number;
  }>>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [leadAddress, setLeadAddress] = useState<LeadAddress | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) {
        setIsLoading(false);
        return;
      }

      try {
        // Get company
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "*",
        });

        if (!companyData) {
          navigate("/firma");
          return;
        }
        setCompany(companyData);

        // Get offer
        const { data: offerData, error: offerError } = await supabase
          .from("offers")
          .select("*")
          .eq("id", id)
          .eq("company_id", companyData.id)
          .maybeSingle();

        if (offerError || !offerData) {
          toast({
            title: t("common.error"),
            description: t("offer.detail.toast.notFound"),
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }
        setOffer(offerData);

        // Check if an auftrag already exists for this offer
        if (offerData.status === "accepted") {
          const { data: existingAuftrag } = await supabase
            .from("auftraege")
            .select("id")
            .eq("offer_id", id)
            .maybeSingle();
          setExistingAuftragId(existingAuftrag?.id ?? null);
        }

        // Get lead info to fetch AGB sections and address data
        let normalizedServiceType = "";
        if (offerData.lead_id) {
          const { data: leadData } = await supabase
            .from("leads")
            .select("service_type, from_street, from_house_number, from_plz, from_city, from_floor, from_has_lift, from_has_estrich, from_has_keller, from_rooms, from_living_space_m2, to_street, to_house_number, to_plz, to_city, to_floor, to_has_lift, preferred_date, preferred_time_slot, packing_service_needed, cleaning_service_needed, storage_needed, description, property_type")
            .eq("id", offerData.lead_id)
            .maybeSingle();
          if (leadData) {
            // Normalize service type for AGB lookup (e.g., umzug_privat -> umzug)
            normalizedServiceType = normalizeServiceTypeForAgb(leadData.service_type);
            setLeadAddress(leadData as LeadData);
          }
        }

        // Get offer items, leistungsuebersicht, email logs, AGB and checklist in parallel
        const [itemsResult, leistungResult, emailLogsResult, agbResult] = await Promise.all([
          supabase
            .from("offer_items")
            .select(OFFER_ITEMS_PDF_SELECT)
            .eq("offer_id", id)
            .order("position"),
          supabase
            .from("offer_leistungsuebersicht")
            .select("*")
            .eq("offer_id", id)
            .maybeSingle(),
          supabase
            .from("email_logs")
            .select("*")
            .eq("metadata->>offer_id", id)
            .order("created_at", { ascending: false }),
          normalizedServiceType ? supabase
            .from("agb_sections")
            .select("*")
            .eq("company_id", companyData.id)
            .eq("service_type", normalizedServiceType)
            .eq("is_active", true)
            .order("display_order", { ascending: true }) : Promise.resolve({ data: null }),
        ]);

        setItems(itemsResult.data || []);
        setEmailLogs((emailLogsResult.data || []) as EmailLog[]);
        setAgbSections(agbResult.data || []);

        if (leistungResult.data) {
          // Parse included_services from JSON
          const includedServices = Array.isArray(leistungResult.data.included_services)
            ? leistungResult.data.included_services
            : [];

          setLeistungsuebersicht({
            included_services: includedServices as Array<{ id: string; name: string; description?: string }>,
            excluded_services: leistungResult.data.excluded_services || [],
            special_notes: leistungResult.data.special_notes || undefined,
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, id, navigate, toast, t]);

  // Dashboard locale — the operator reads this page. The customer's copy of the same
  // values is rendered by the PDF from the offer's own `language`.
  const formatDate = (dateString: string | null) =>
    dateString ? formatDateI18n(dateString, locale) : "-";

  const formatCurrency = (amount: number) => formatCurrencyI18n(amount, locale);

  /**
   * Returns { maxSubtotal, maxVat, maxTotal } for blind offers, computed from the loaded
   * items' per-item time_estimate — the same source OfferView and the PDF use. (The old
   * code read offer.time_estimate, an offer-level field that is never written, so the range
   * was always null and the firm saw only the min total for a blind offer.)
   */
  // Per-service date label for a group header — own value, fallback offer.service_date;
  // rendered only when at least one group carries its own date.
  const groupDateLabel = (group: { serviceType: string | null; items: OfferItem[] }): string | null => {
    if (!items.some((i) => i.scheduled_date)) return null;
    const sched = group.items.find((i) => i.scheduled_date);
    const date = sched?.scheduled_date ?? offer?.service_date;
    if (!date) return null;
    const st = sched?.scheduled_start_time?.slice(0, 5);
    const et = sched?.scheduled_end_time?.slice(0, 5);
    // Operator-facing heading → dashboard locale (the customer's copy of the same line
    // is rendered by the PDF from the offer's own language).
    const time =
      st && et
        ? ` · ${t("doc.time.fromUntil", { start: st, end: et })}`
        : st
          ? ` · ${t("doc.time.from", { start: st })}`
          : "";
    return `${getAppointmentLabel(group.serviceType, locale)}: ${formatDateI18n(date, locale)}${time}`;
  };

  // Shared item mapper for the totals chain (getBlindRange + Zwischensumme rows).
  const toSubtotalItems = () =>
    items.map((it) => ({
      priceType: it.price_type ?? 'pauschale',
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unit_price) || 0,
      timeEstimate: it.time_estimate ?? null,
      amountBasis: toAmountBasis(it.amount_basis),
    }));

  const hasRateItem = () => offerHasRateItem(toSubtotalItems());

  // Blind/Stunden-Spanne (nur fixed+range). rate-Posten → gar keine Aggregatsumme (Box ausgeblendet).
  const getBlindRange = () => {
    if (offer?.offerte_type !== 'blind') return null;
    const subtotalItems = toSubtotalItems();
    if (!subtotalItems.some((it) => hourlyRange(it.timeEstimate) !== null)) return null;
    const surchargesSum = sumSurchargeAmounts(parseSurcharges(offer.surcharges));
    // P3b-2a: consolidated read chain — the discount now also caps the max side.
    // maxSubtotal is the RAW max items sum (Zwischensumme upper bound, items only —
    // previously it wrongly included the surcharges while the min side did not).
    const dtMax = computeDisplayTotals(
      subtotalItems, surchargesSum, Number(offer.vat_rate), offer.discount_percent, "max",
    );
    return {
      maxSubtotal: dtMax.subtotal,
      maxVat: dtMax.vatAmount,
      maxTotal: dtMax.total,
      maxDiscountAmount: dtMax.discountAmount,
      maxTaxableBase: dtMax.taxableBase,
    };
  };

  const getStatusBadge = (status: string) => {
    const m = getStatusMeta(status);
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-semibold ${m.bg} ${m.color}`}>
        <span>{m.emoji}</span>
        {getOfferStatusLabel(status, locale)}
      </span>
    );
  };

  const formatDateTime = (dateString: string) => formatDateTimeI18n(dateString, locale);

  const formatPreferredTimeSlot = (slot: string | null | undefined) => {
    switch (slot) {
      case "morning": return t("offer.detail.timeSlot.morning");
      case "afternoon": return t("offer.detail.timeSlot.afternoon");
      case "evening": return t("offer.detail.timeSlot.evening");
      case "flexible": return t("offer.detail.timeSlot.flexible");
      default: return slot ?? "-";
    }
  };

  const handleDownloadPdf = async () => {
    const payload = buildOfferPayload();
    if (!payload) return;

    const { generateOfferPdf } = await import("@/lib/generateOfferPdf");
    await generateOfferPdf(payload);

    toast({
      title: t("offer.detail.toast.pdfCreated.title"),
      description: t("offer.detail.toast.pdfCreated.description"),
    });
  };

  const getPublicOfferUrl = () => {
    if (!offer) return "";
    return `${window.location.origin}/offerte/${offer.access_token}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getPublicOfferUrl());
    toast({
      title: t("offer.detail.toast.linkCopied.title"),
      description: t("offer.detail.toast.linkCopied.description"),
    });
  };

  const handleOpenPublicView = () => {
    window.open(getPublicOfferUrl(), "_blank");
  };

  /** Build the LegacyOfferData payload used by both download and send flows */
  const buildOfferPayload = () => {
    if (!offer || !company) return null;
    return {
      ...offer,
      description: offer.description || undefined,
      customer_phone: offer.customer_phone || undefined,
      service_date: offer.service_date || undefined,
      valid_until: offer.valid_until || undefined,
      items: items.map((item) => ({
        ...item,
        total: Number(item.total),
      })),
      company: {
        company_name: company.company_name,
        street: company.street || undefined,
        house_number: company.house_number || undefined,
        plz: company.plz,
        city: company.city,
        phone: company.phone || undefined,
        email: company.email,
                website: company.website || undefined,
                mwst_number: company.mwst_number || undefined,
                logo_url: company.logo_url || undefined,
                primary_color: company.primary_color || undefined,
                iban: company.iban || undefined,
                pdf_template: company.pdf_template,
                default_language: company.default_language,
              },
      // Address priority: frozen (offer.frozen_*) > lead (fallback). This preserves the offer
      // address even if the lead is deleted; no visible difference since 16/16 already have frozen filled.
      customer_address: (offer.frozen_from_street || offer.frozen_from_plz || offer.frozen_from_city || leadAddress) ? {
        street: offer.frozen_from_street ?? leadAddress?.from_street ?? undefined,
        house_number: offer.frozen_from_house_number ?? leadAddress?.from_house_number ?? undefined,
        plz: offer.frozen_from_plz ?? leadAddress?.from_plz ?? undefined,
        city: offer.frozen_from_city ?? leadAddress?.from_city ?? undefined,
        floor: offer.frozen_from_floor ?? leadAddress?.from_floor ?? undefined,
        has_lift: offer.frozen_from_has_lift ?? leadAddress?.from_has_lift ?? undefined,
        has_estrich: offer.frozen_has_estrich ?? leadAddress?.from_has_estrich ?? undefined,
        has_keller: offer.frozen_has_keller ?? leadAddress?.from_has_keller ?? undefined,
      } : undefined,
      customer_destination: (offer.frozen_to_plz || offer.frozen_to_city || leadAddress?.to_plz || leadAddress?.to_city) ? {
        street: offer.frozen_to_street ?? leadAddress?.to_street ?? undefined,
        house_number: offer.frozen_to_house_number ?? leadAddress?.to_house_number ?? undefined,
        plz: offer.frozen_to_plz ?? leadAddress?.to_plz ?? undefined,
        city: offer.frozen_to_city ?? leadAddress?.to_city ?? undefined,
        floor: offer.frozen_to_floor ?? leadAddress?.to_floor ?? undefined,
        has_lift: offer.frozen_to_has_lift ?? leadAddress?.to_has_lift ?? undefined,
      } : undefined,
      service_type: leadAddress?.service_type || undefined,
      access_token: offer.access_token,
      baseUrl: window.location.origin,
      leistungsuebersicht: leistungsuebersicht || undefined,
      agbSections: agbSections.length > 0 ? agbSections : undefined,
      brief_layout: offer.brief_layout ?? false,
      customer_salutation: offer.customer_salutation ?? null,
      offerte_type: offer.offerte_type === "blind" ? "blind" : "normal",
    };
  };

  const handleSendOffer = async () => {
    if (!offer || !company) return;

    setIsSending(true);
    try {
      const result = await sendOffer({ offerId: offer.id, companyId: company.id, forceResend: true });

      if (!result.success) {
        toast({
          title: t("offer.list.toast.sendFailed.title"),
          description: result.error ?? t("offer.list.toast.sendFailed.description"),
          variant: "destructive",
        });
        return;
      }

      setOffer({ ...offer, status: "sent", sent_at: new Date().toISOString() });
      toast({
        title: t("offer.list.toast.sent.title"),
        description: t("offer.list.toast.sent.description"),
        variant: "success",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

  const handleDeleteOffer = async () => {
    if (!offer) return;

    // C1: an accepted offer has a linked Auftrag (and possibly Rechnung/Quittung).
    // Deleting it would strip those links (offer_id → NULL). Block it — the offer is
    // the origin document of an active job and must not be removed.
    if (offer.status === "accepted") {
      toast({
        title: t("offer.detail.toast.deleteBlocked.title"),
        description: t("offer.detail.toast.deleteBlocked.description"),
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.from("offers").delete().eq("id", offer.id);

      if (error) throw error;

      toast({
        title: t("offer.detail.toast.deleted.title"),
        description: t("offer.detail.toast.deleted.description"),
      });
      navigate("/firma/offerten");
    } catch (error) {
      console.error("Error deleting offer:", error);
      toast({
        title: t("common.error"),
        description: t("offer.detail.toast.deleteFailed"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const parseBesichtigungDetails = () => {
    if (!offer?.customer_response_note) return null;

    const note = offer.customer_response_note;
    // Parse date and time from the note, e.g., "Besichtigung gewünscht am 28.12.2025 um 08:49 Uhr"
    const dateMatch = note.match(/(\d{2}\.\d{2}\.\d{4})/);
    const timeMatch = note.match(/um\s+(\d{2}:\d{2})/);

    if (dateMatch) {
      const [day, month, year] = dateMatch[1].split(".");
      return {
        date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
        time: timeMatch ? timeMatch[1] : "09:00",
      };
    }
    return null;
  };

  const openBesichtigungDialog = async () => {
    const details = parseBesichtigungDetails();
    if (details) {
      setBesichtigungDate(details.date);
      setBesichtigungTime(details.time);
    } else {
      setBesichtigungDate(new Date());
      setBesichtigungTime("09:00");
    }

    // Try to get address from lead if available
    if (offer) {
      const { data: leadData } = await supabase
        .from("leads")
        .select("from_street, from_house_number, from_plz, from_city")
        .eq("id", offer.lead_id)
        .maybeSingle();

      if (leadData) {
        setBesichtigungAddress({
          street: leadData.from_street || "",
          houseNumber: leadData.from_house_number || "",
          plz: leadData.from_plz || "",
          city: leadData.from_city || "",
        });
      } else {
        setBesichtigungAddress({ street: "", houseNumber: "", plz: "", city: "" });
      }
    }

    setShowBesichtigungDialog(true);
  };

  const handleConfirmBesichtigung = async () => {
    if (!offer || !company || !besichtigungDate) return;

    const isoDate = format(besichtigungDate, "yyyy-MM-dd");

    setIsConfirmingBesichtigung(true);
    try {
      const { error } = await supabase.functions.invoke("confirm-besichtigung", {
        body: {
          offerId: offer.id,
          besichtigungDate: isoDate,
          besichtigungTime: besichtigungTime,
          durationMinutes: parseInt(besichtigungDuration),
          companyId: company.id,
          address: {
            street: besichtigungAddress.street,
            houseNumber: besichtigungAddress.houseNumber,
            plz: besichtigungAddress.plz,
            city: besichtigungAddress.city,
          },
        },
      });

      if (error) throw error;

      // Refresh offer data to show updated status
      const { data: updatedOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("id", offer.id)
        .single();

      if (updatedOffer) {
        setOffer(updatedOffer);
      }

      setShowBesichtigungDialog(false);
      toast({
        title: t("offer.detail.toast.besichtigungConfirmed.title"),
        description: t("offer.detail.toast.besichtigungConfirmed.description"),
      });
    } catch (error) {
      console.error("Error confirming besichtigung:", error);
      toast({
        title: t("common.error"),
        description: t("offer.detail.toast.besichtigungFailed"),
        variant: "destructive",
      });
    } finally {
      setIsConfirmingBesichtigung(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>{t("offer.detail.pageTitle")}</title>
        </Helmet>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
      </>
    );
  }

  if (!offer) {
    return (
      <>
        <Helmet>
          <title>{t("offer.detail.notFound.pageTitle")}</title>
        </Helmet>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("offer.detail.notFound.title")}</h3>
            <Button onClick={() => navigate("/firma/offerten")}>{t("offer.detail.back")}</Button>
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{offer.title}</title>
      </Helmet>
        <div className="space-y-4 sm:space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/firma/offerten")}
              className="h-9 w-9 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2"
              aria-label={t("offer.detail.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="text-2xl leading-none">📄</span>
                <h1 className="text-xl font-bold tracking-tight text-folk-ink sm:text-2xl">{offer.title}</h1>
                {getStatusBadge(offer.status)}
              </div>
              <p className="mt-1 font-mono text-[14px] text-folk-ink3">
                {formatDate(offer.created_at)}
                {offer.sent_at && ` · ${t("offer.detail.sentOn", { date: formatDate(offer.sent_at) })}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("offer.detail.downloadPdf")}</span>
                <span className="sm:hidden">{t("offer.detail.downloadPdfShort")}</span>
              </Button>
              {offer.status === "accepted" && (
                existingAuftragId ? (
                  <Button
                    onClick={() => navigate("/firma/auftraege")}
                    variant="outline"
                    className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm hover:text-folk-ink2"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("offer.detail.viewAuftrag")}</span>
                    <span className="sm:hidden">{t("offer.detail.auftragShort")}</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowAuftragModal(true)}
                    className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("offer.detail.createAuftrag")}</span>
                    <span className="sm:hidden">{t("offer.detail.auftragShort")}</span>
                  </Button>
                )
              )}
              {offer.status === "draft" && (
                <Button
                  onClick={handleOpenPreview}
                  disabled={isSending}
                  className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{t("offer.detail.previewAndSend")}</span>
                  <span className="sm:hidden">{t("offer.detail.previewShort")}</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-1 lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Offer Details */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">{t("offer.form.details.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  {offer.description && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">{t("common.description")}</p>
                      <p className="text-sm sm:text-base">{offer.description}</p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">{t("offer.detail.execution")}</p>
                        <p className="font-medium text-sm sm:text-base">{formatDate(offer.service_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">{t("offer.form.field.validUntil")}</p>
                        <p className="font-medium text-sm sm:text-base">{formatDate(offer.valid_until)}</p>
                      </div>
                    </div>
                  </div>

                  {leadAddress?.preferred_date && (
                    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2">{t("offer.detail.customerWish")}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{formatDate(leadAddress.preferred_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{formatPreferredTimeSlot(leadAddress.preferred_time_slot)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Items - Mobile Card View */}
              <Card className="sm:hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("offer.detail.positions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const groups = groupItemsByService(items);
                    const multi = groups.length > 1;
                    return groups.map((group) => (
                      <Fragment key={group.serviceType ?? "allgemein"}>
                        {multi && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{getServiceLabel(group.serviceType, locale)}</span>
                            {groupDateLabel(group) && (
                              <span className="text-xs font-medium">{groupDateLabel(group)}</span>
                            )}
                          </div>
                        )}
                        {group.items.filter((item) => !isFreeItem(item.price_type)).map((item) => {
                          const display = itemAmountDisplay({
                            priceType: item.price_type ?? "",
                            amountBasis: toAmountBasis(item.amount_basis),
                            quantity: Number(item.quantity),
                            unitPrice: Number(item.unit_price),
                            unit: item.unit ?? "",
                            timeEstimate: item.time_estimate ?? null,
                            total: Number(item.total),
                          });
                          return (
                          <div key={item.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="shrink-0 text-xs">{item.position}</Badge>
                              <div className="text-sm min-w-0"><PositionDescription text={item.description} /></div>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              {display.kind === "range" ? (
                                <>
                                  <span>
                                    {t("offer.detail.hoursRangeRate", {
                                      min: item.time_estimate!.minHours,
                                      max: item.time_estimate!.maxHours,
                                      rate: formatCurrency(Number(item.time_estimate!.hourlyRate)),
                                    })}
                                  </span>
                                  <span className="font-semibold text-amber-700">{formatCurrency(display.min)} – {formatCurrency(display.max)}</span>
                                </>
                              ) : display.kind === "rate" ? (
                                <>
                                  <span>{t("domain.priceModel.byEffort")}</span>
                                  <span className="font-semibold text-foreground">
                                    {t("offer.detail.perUnit", {
                                      amount: formatCurrency(display.unitPrice),
                                      unit: display.unit,
                                    })}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>{item.quantity} {item.unit} × {formatCurrency(Number(item.unit_price))}</span>
                                  <span className="font-semibold text-foreground">{formatCurrency(display.kind === "fixed" ? display.amount : Number(item.total))}</span>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                        {group.items.some((item) => isFreeItem(item.price_type)) && (
                          <div className="rounded-lg bg-muted/30 p-3">
                            <InklusiveList
                              items={group.items.filter((item) => isFreeItem(item.price_type))}
                              label={t("doc.offer.includedShort")}
                            />
                          </div>
                        )}
                      </Fragment>
                    ));
                  })()}

                  <Separator className="my-3" />

                  <div className="space-y-2 text-sm">
                    {(() => { if (hasRateItem()) return (<div className="text-muted-foreground leading-snug">{t("doc.offer.rateAggregateNote")}</div>); const range = getBlindRange(); const surchargeList = parseSurcharges(offer.surcharges); const dtMin = computeDisplayTotals(toSubtotalItems(), sumSurchargeAmounts(surchargeList), Number(offer.vat_rate), offer.discount_percent, "min"); const itemsSub = dtMin.subtotal; return (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground shrink-0">{t("common.subtotal")}</span>
                          {range ? (
                            <div className="text-right text-amber-700 font-medium leading-snug">
                              <div>{formatCurrency(itemsSub)}</div>
                              <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxSubtotal) })}</div>
                            </div>
                          ) : (
                            <span>{formatCurrency(itemsSub)}</span>
                          )}
                        </div>
                        {surchargeList.map((s, i) => (
                          <div key={i} className="flex items-start justify-between gap-4">
                            <span className="text-muted-foreground truncate">{s.label || t("offer.form.totals.surcharge")}</span>
                            <span className="shrink-0">{formatCurrency(s.amount)}</span>
                          </div>
                        ))}
                        {offer.discount_percent && offer.discount_percent > 0 ? (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-muted-foreground shrink-0">
                                {t("offer.form.totals.discount", { percent: formatPercent(Number(offer.discount_percent), locale) })}
                              </span>
                              {range ? (
                                <div className="text-right text-amber-700 leading-snug">
                                  <div>- {formatCurrency(dtMin.discountAmount)}</div>
                                  <div className="text-xs text-amber-600">{t("offer.detail.upToMinus", { amount: formatCurrency(range.maxDiscountAmount) })}</div>
                                </div>
                              ) : (
                                <span>- {formatCurrency(dtMin.discountAmount)}</span>
                              )}
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-muted-foreground shrink-0">{t("offer.form.totals.totalExclVat")}</span>
                              {range ? (
                                <div className="text-right text-amber-700 leading-snug">
                                  <div>{formatCurrency(dtMin.taxableBase)}</div>
                                  <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxTaxableBase) })}</div>
                                </div>
                              ) : (
                                <span>{formatCurrency(dtMin.taxableBase)}</span>
                              )}
                            </div>
                          </>
                        ) : null}
                        {/* MwSt row only when a rate is active — at 0 % it is omitted entirely
                            (Zwischensumme = Total), mirroring the PDF/Rechnung rule. */}
                        {Number(offer.vat_rate) > 0 ? (
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-muted-foreground shrink-0">{t("offer.detail.vatRow", { rate: formatPercent(Number(offer.vat_rate), locale) })}</span>
                            {range ? (
                              <div className="text-right text-amber-700 leading-snug">
                                <div>{formatCurrency(Number(offer.vat_amount))}</div>
                                <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxVat) })}</div>
                              </div>
                            ) : (
                              <span>{formatCurrency(Number(offer.vat_amount))}</span>
                            )}
                          </div>
                        ) : null}
                        <Separator />
                        <div className="flex items-start justify-between gap-4 font-bold text-base pt-1">
                          <span className="shrink-0">{t("common.total")}</span>
                          {range ? (
                            <div className="text-right text-amber-700 leading-snug">
                              <div>{formatCurrency(Number(offer.total))}</div>
                              <div className="text-sm font-semibold text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(Number(range.maxTotal)) })}</div>
                            </div>
                          ) : (
                            <span className="text-primary">{formatCurrency(Number(offer.total))}</span>
                          )}
                        </div>
                      </>
                    ); })()}
                  </div>
                </CardContent>
              </Card>

              {/* Items - Desktop Table View */}
              <Card className="hidden sm:block">
                <CardHeader>
                  <CardTitle>{t("offer.detail.positions")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("offer.detail.column.position")}</TableHead>
                        <TableHead>{t("common.description")}</TableHead>
                        <TableHead className="text-right w-20">{t("offer.detail.column.quantity")}</TableHead>
                        <TableHead className="w-20">{t("offer.detail.column.unit")}</TableHead>
                        <TableHead className="text-right w-28">{t("offer.detail.column.price")}</TableHead>
                        <TableHead className="text-right w-28">{t("common.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const groups = groupItemsByService(items);
                        const multi = groups.length > 1;
                        return groups.map((group) => (
                          <Fragment key={group.serviceType ?? "allgemein"}>
                            {multi && (
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableCell colSpan={6} className="py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{getServiceLabel(group.serviceType, locale)}</span>
                                    {groupDateLabel(group) && (
                                      <span className="text-xs font-medium">{groupDateLabel(group)}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {group.items.filter((item) => !isFreeItem(item.price_type)).map((item) => {
                              const display = itemAmountDisplay({
                                priceType: item.price_type ?? "",
                                amountBasis: toAmountBasis(item.amount_basis),
                                quantity: Number(item.quantity),
                                unitPrice: Number(item.unit_price),
                                unit: item.unit ?? "",
                                timeEstimate: item.time_estimate ?? null,
                                total: Number(item.total),
                              });
                              return (
                              <TableRow key={item.id}>
                                <TableCell className="text-center">{item.position}</TableCell>
                                <TableCell><PositionDescription text={item.description} /></TableCell>
                                {display.kind === "range" ? (
                                  <>
                                    <TableCell className="text-right">
                                      {t("offer.detail.hoursRange", {
                                        min: item.time_estimate!.minHours,
                                        max: item.time_estimate!.maxHours,
                                      })}
                                    </TableCell>
                                    <TableCell>{t("domain.unit.hour")}</TableCell>
                                    <TableCell className="text-right">
                                      {t("offer.detail.perHour", { amount: formatCurrency(Number(item.time_estimate!.hourlyRate)) })}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-amber-700">{formatCurrency(display.min)} – {formatCurrency(display.max)}</TableCell>
                                  </>
                                ) : display.kind === "rate" ? (
                                  <>
                                    <TableCell className="text-right text-muted-foreground">{t("offer.detail.byEffortShort")}</TableCell>
                                    <TableCell>{display.unit}</TableCell>
                                    <TableCell className="text-right font-medium">
                                      {t("offer.detail.perUnit", { amount: formatCurrency(display.unitPrice), unit: display.unit })}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">{t("offer.detail.byEffortShort")}</TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(display.kind === "fixed" ? display.amount : Number(item.total))}</TableCell>
                                  </>
                                )}
                              </TableRow>
                              );
                            })}
                            {group.items.some((item) => isFreeItem(item.price_type)) && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell />
                                <TableCell colSpan={5} className="py-3">
                                  <InklusiveList
                                    items={group.items.filter((item) => isFreeItem(item.price_type))}
                                    label={t("doc.offer.includedShort")}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ));
                      })()}
                    </TableBody>
                  </Table>

                  <Separator className="my-4" />

                  <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                      {(() => { if (hasRateItem()) return (<div className="text-sm text-muted-foreground leading-snug">{t("doc.offer.rateAggregateNote")}</div>); const range = getBlindRange(); const surchargeList = parseSurcharges(offer.surcharges); const dtMin = computeDisplayTotals(toSubtotalItems(), sumSurchargeAmounts(surchargeList), Number(offer.vat_rate), offer.discount_percent, "min"); const itemsSub = dtMin.subtotal; return (
                      <>
                        <div className="flex items-start justify-between gap-4 text-sm">
                          <span className="text-muted-foreground shrink-0">{t("common.subtotal")}</span>
                          {range ? (
                            <div className="text-right text-amber-700 font-medium leading-snug">
                              <div>{formatCurrency(itemsSub)}</div>
                              <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxSubtotal) })}</div>
                            </div>
                          ) : (
                            <span>{formatCurrency(itemsSub)}</span>
                          )}
                        </div>
                        {surchargeList.map((s, i) => (
                          <div key={i} className="flex items-start justify-between gap-4 text-sm">
                            <span className="text-muted-foreground truncate">{s.label || t("offer.form.totals.surcharge")}</span>
                            <span className="shrink-0">{formatCurrency(s.amount)}</span>
                          </div>
                        ))}
                        {offer.discount_percent && offer.discount_percent > 0 ? (
                          <>
                            <div className="flex items-start justify-between gap-4 text-sm">
                              <span className="text-muted-foreground shrink-0">
                                {t("offer.form.totals.discount", { percent: formatPercent(Number(offer.discount_percent), locale) })}
                              </span>
                              {range ? (
                                <div className="text-right text-amber-700 leading-snug">
                                  <div>- {formatCurrency(dtMin.discountAmount)}</div>
                                  <div className="text-xs text-amber-600">{t("offer.detail.upToMinus", { amount: formatCurrency(range.maxDiscountAmount) })}</div>
                                </div>
                              ) : (
                                <span>- {formatCurrency(dtMin.discountAmount)}</span>
                              )}
                            </div>
                            <div className="flex items-start justify-between gap-4 text-sm">
                              <span className="text-muted-foreground shrink-0">{t("offer.form.totals.totalExclVat")}</span>
                              {range ? (
                                <div className="text-right text-amber-700 leading-snug">
                                  <div>{formatCurrency(dtMin.taxableBase)}</div>
                                  <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxTaxableBase) })}</div>
                                </div>
                              ) : (
                                <span>{formatCurrency(dtMin.taxableBase)}</span>
                              )}
                            </div>
                          </>
                        ) : null}
                        {/* MwSt row only when a rate is active — at 0 % it is omitted entirely
                            (Zwischensumme = Total), mirroring the PDF/Rechnung rule. */}
                        {Number(offer.vat_rate) > 0 ? (
                          <div className="flex items-start justify-between gap-4 text-sm">
                            <span className="text-muted-foreground shrink-0">{t("offer.detail.vatRow", { rate: formatPercent(Number(offer.vat_rate), locale) })}</span>
                            {range ? (
                              <div className="text-right text-amber-700 leading-snug">
                                <div>{formatCurrency(Number(offer.vat_amount))}</div>
                                <div className="text-xs text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(range.maxVat) })}</div>
                              </div>
                            ) : (
                              <span>{formatCurrency(Number(offer.vat_amount))}</span>
                            )}
                          </div>
                        ) : null}
                        <Separator />
                        <div className="flex items-start justify-between gap-4 font-bold text-lg">
                          <span className="shrink-0">{t("common.total")}</span>
                          {range ? (
                            <div className="text-right text-amber-700 leading-snug">
                              <div>{formatCurrency(Number(offer.total))}</div>
                              <div className="text-sm font-semibold text-amber-600">{t("offer.detail.upTo", { amount: formatCurrency(Number(range.maxTotal)) })}</div>
                            </div>
                          ) : (
                            <span className="">{formatCurrency(Number(offer.total))}</span>
                          )}
                        </div>
                      </>
                      ); })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    {t("offer.detail.customer")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      {offer.customer_first_name} {offer.customer_last_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${offer.customer_email}`} className="text-secondary hover:underline truncate">
                      {offer.customer_email}
                    </a>
                  </div>
                  {offer.customer_phone && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${offer.customer_phone}`} className="text-secondary hover:underline">
                        {offer.customer_phone}
                      </a>
                    </div>
                  )}

                  {/* Quick Contact Buttons - Mobile Only */}
                  <div className="flex gap-2 pt-2 sm:hidden">
                    <a href={`mailto:${offer.customer_email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Mail className="w-4 h-4 mr-1.5" />
                        {t("common.email")}
                      </Button>
                    </a>
                    {offer.customer_phone && (
                      <a href={`tel:${offer.customer_phone}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          <Phone className="w-4 h-4 mr-1.5" />
                          {t("offer.detail.call")}
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Email Status Section */}
              {emailLogs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4" />
                      {t("offer.detail.emailStatus")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3">
                    {emailLogs.slice(0, 3).map((log) => (
                      <div key={log.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/50">
                        <div className="shrink-0 mt-0.5">
                          {log.status === "sent" ? (
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                          ) : log.status === "failed" ? (
                            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs sm:text-sm font-medium">
                            {log.email_type === "offer_sent" ? t("offer.detail.emailSent") : log.email_type}
                          </span>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                            {log.recipient_email}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Activity Timeline */}
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <History className="w-4 h-4" />
                    {t("offer.detail.activity.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Timeline items */}
                  <div className="space-y-3">
                    {/* Created */}
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
                        <div className="w-0.5 flex-1 bg-border mt-1" />
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-xs sm:text-sm font-medium">{t("offer.detail.activity.created")}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {formatDateTime(offer.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Sent */}
                    {offer.sent_at && (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1" />
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-xs sm:text-sm font-medium">{t("offer.detail.activity.sent")}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {t("offer.detail.activity.sentTo", { email: offer.customer_email })}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDateTime(offer.sent_at)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Viewed */}
                    {offer.viewed_at && (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1" />
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-xs sm:text-sm font-medium">{t("offer.detail.activity.viewed")}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDateTime(offer.viewed_at)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Accepted */}
                    {offer.accepted_at && (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-600 mt-1" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm font-medium text-green-700">{t("offer.detail.activity.accepted")}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDateTime(offer.accepted_at)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Rejected */}
                    {offer.rejected_at && (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm font-medium text-red-700">{t("offer.detail.activity.rejected")}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDateTime(offer.rejected_at)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* No events after creation */}
                    {!offer.sent_at && !offer.viewed_at && !offer.accepted_at && !offer.rejected_at && (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-muted mt-1" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground italic">
                            {t("offer.detail.activity.none")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {offer.customer_response_note && offer.customer_response_note.toLowerCase().includes("besichtigung") && (
                offer.customer_response_note.startsWith("✅") ? (
                  // Confirmed state
                  <Card className="border-green-200 bg-green-50/50 overflow-hidden">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="flex items-center gap-2 text-green-700 text-sm">
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t("offer.detail.besichtigung.confirmed")}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-white rounded-lg p-2 sm:p-3 border border-green-200">
                        <div className="flex items-start gap-2">
                          <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 mt-0.5 shrink-0" />
                          <p className="text-xs sm:text-sm break-words text-green-700 font-medium">
                            {offer.customer_response_note.replace("✅ ", "")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  // Pending request state
                  <Card className="border-blue-200 bg-blue-50/50 overflow-hidden">
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="flex items-center gap-2 text-blue-700 text-sm">
                        <Eye className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t("offer.detail.besichtigung.request")}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 sm:space-y-3">
                      <div className="bg-white rounded-lg p-2 sm:p-3 border border-blue-200">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 mt-0.5 shrink-0" />
                          <p className="text-xs sm:text-sm break-words line-clamp-3">{offer.customer_response_note}</p>
                        </div>
                      </div>

                      <Button
                        onClick={openBesichtigungDialog}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                      >
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        {t("offer.detail.besichtigung.confirmAction")}
                      </Button>
                    </CardContent>
                  </Card>
                )
              )}

              {/* Customer Response Note (non-Besichtigung) */}
              {offer.customer_response_note && !offer.customer_response_note.toLowerCase().includes("besichtigung") && (
                <Card>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MessageSquare className="w-4 h-4" />
                      {t("offer.detail.customerNote")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs sm:text-sm text-muted-foreground">{offer.customer_response_note}</p>
                  </CardContent>
                </Card>
              )}

              {/* AGB Acceptance Status */}
              {offer.status === "accepted" && (
                <Card className={offer.agb_accepted_at ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className={`flex items-center gap-2 text-sm ${offer.agb_accepted_at ? "text-green-700" : "text-amber-700"}`}>
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t("offer.detail.agb.title")}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {offer.agb_accepted_at ? (
                      <>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-green-700">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">{t("offer.detail.agb.accepted")}</span>
                        </div>
                        <div className="bg-white rounded-lg p-2 sm:p-3 border border-green-200 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">{t("offer.detail.agb.acceptedAt")}</span>
                            <span className="font-medium">{formatDateTime(offer.agb_accepted_at)}</span>
                          </div>
                          {offer.agb_version && (
                            <div className="flex items-start gap-2 text-xs">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{t("offer.detail.agb.version")}</span>
                              <span className="font-mono text-[10px] break-all">{offer.agb_version.substring(0, 50)}...</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {t("offer.detail.agb.acceptedNote")}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">{t("offer.detail.agb.missing")}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {t("offer.detail.agb.missingNote")}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-medium">{t("offer.detail.customerLink")}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={handleCopyLink}>
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        {t("common.copy")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleOpenPublicView}>
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                  {offer.status !== "accepted" && (
                  <>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive text-xs sm:text-sm">
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        {t("offer.detail.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("offer.detail.delete.confirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("common.confirmDelete.description")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteOffer}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            t("common.delete")
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* PDF Preview Dialog */}
        {offer && company && (
          <Suspense fallback={null}>
            <PdfPreviewDialog
              open={showPreview}
              onOpenChange={setShowPreview}
              offer={{
                id: offer.id,
                title: offer.title,
                description: offer.description || undefined,
                customer_first_name: offer.customer_first_name,
                customer_last_name: offer.customer_last_name,
                customer_email: offer.customer_email,
                customer_phone: offer.customer_phone || undefined,
                service_date: offer.service_date || undefined,
                valid_until: offer.valid_until || undefined,
                subtotal: offer.subtotal,
                vat_rate: offer.vat_rate,
                vat_amount: offer.vat_amount,
                total: offer.total,
                surcharges: parseSurcharges(offer.surcharges).map((s) => ({ label: s.label, amount: s.amount })),
                created_at: offer.created_at,
                // Spread the full item (incl. time_estimate + price_type) so the preview PDF
                // matches the downloaded/sent PDF — the old explicit field list dropped
                // time_estimate, hiding the blind min–max range in the preview only.
                items: items.map((item) => ({
                  ...item,
                  total: Number(item.total),
                })),
                company: {
                  company_name: company.company_name,
                  street: company.street || undefined,
                  house_number: company.house_number || undefined,
                  plz: company.plz,
                  city: company.city,
                  phone: company.phone || undefined,
                  email: company.email,
                  website: company.website || undefined,
                  mwst_number: company.mwst_number || undefined,
                  logo_url: company.logo_url || undefined,
                  primary_color: company.primary_color || undefined,
                  pdf_template: company.pdf_template,
                  default_language: company.default_language,
                },
                access_token: offer.access_token,
                baseUrl: window.location.origin,
                leistungsuebersicht: leistungsuebersicht || undefined,
                payment_terms: offer.payment_terms ?? null,
                price_model: offer.price_model ?? null,
                hourly_rate: offer.hourly_rate ?? null,
                kostendach_max: offer.kostendach_max ?? null,
                service_start_time: offer.service_start_time ?? null,
                service_end_time: offer.service_end_time ?? null,
                brief_layout: offer.brief_layout ?? false,
                customer_salutation: offer.customer_salutation ?? null,
                offerte_type: offer.offerte_type === "blind" ? "blind" : "normal",
                time_estimate: offer.time_estimate ?? null,
              }}
              onSend={handleSendOffer}
              isSending={isSending}
            />
          </Suspense>
        )}

        {/* Besichtigung Confirmation Dialog */}
        <Dialog open={showBesichtigungDialog} onOpenChange={setShowBesichtigungDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                {t("offer.detail.besichtigung.dialog.title")}
              </DialogTitle>
              <DialogDescription>
                {t("offer.detail.besichtigung.dialog.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="besichtigung-date">{t("common.date")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !besichtigungDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {besichtigungDate ? (
                        format(besichtigungDate, "PPP", { locale: dateLocale })
                      ) : (
                        <span>{t("common.selectDate")}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={besichtigungDate}
                      onSelect={setBesichtigungDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="besichtigung-time">{t("offer.detail.besichtigung.dialog.time")}</Label>
                <Input
                  id="besichtigung-time"
                  type="time"
                  value={besichtigungTime}
                  onChange={(e) => setBesichtigungTime(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("offer.detail.besichtigung.dialog.duration")}</Label>
                <Select value={besichtigungDuration} onValueChange={setBesichtigungDuration}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder={t("offer.detail.besichtigung.dialog.durationPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="30">{t("offer.detail.besichtigung.dialog.duration30")}</SelectItem>
                    <SelectItem value="60">{t("offer.detail.besichtigung.dialog.duration60")}</SelectItem>
                    <SelectItem value="120">{t("offer.detail.besichtigung.dialog.duration120")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t("offer.detail.besichtigung.dialog.address")}
                </Label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="bes-street" className="text-xs text-muted-foreground">{t("common.street")}</Label>
                  <Input
                    id="bes-street"
                    placeholder={t("common.street")}
                    value={besichtigungAddress.street}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, street: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bes-nr" className="text-xs text-muted-foreground">{t("offer.detail.besichtigung.dialog.houseNumber")}</Label>
                  <Input
                    id="bes-nr"
                    placeholder={t("offer.detail.besichtigung.dialog.houseNumber")}
                    value={besichtigungAddress.houseNumber}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, houseNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bes-plz" className="text-xs text-muted-foreground">{t("common.plz")}</Label>
                  <Input
                    id="bes-plz"
                    placeholder={t("common.plz")}
                    value={besichtigungAddress.plz}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, plz: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="bes-city" className="text-xs text-muted-foreground">{t("common.city")}</Label>
                  <Input
                    id="bes-city"
                    placeholder={t("common.city")}
                    value={besichtigungAddress.city}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
              </div>

              {offer && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    <strong>{t("offer.detail.besichtigung.dialog.customer")}</strong> {offer.customer_first_name} {offer.customer_last_name}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>{t("offer.detail.besichtigung.dialog.email")}</strong> {offer.customer_email}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBesichtigungDialog(false)}
                disabled={isConfirmingBesichtigung}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleConfirmBesichtigung}
                disabled={isConfirmingBesichtigung || !besichtigungDate}
                className="bg-green-600 hover:bg-green-700"
              >
                {isConfirmingBesichtigung ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {t("offer.detail.besichtigung.dialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Auftrag Modal */}
        <AuftragModal
          isOpen={showAuftragModal}
          onClose={() => setShowAuftragModal(false)}
          companyId={company?.id || null}
          offerId={offer?.id || null}
          onSuccess={() => {
            setShowAuftragModal(false);
            setExistingAuftragId("created");
            toast({
              title: t("offer.list.toast.auftragCreated.title"),
              description: t("offer.list.toast.auftragCreated.description"),
            });
            navigate("/firma/auftraege");
          }}
        />
    </>
  );
};

export default FirmaOfferteDetail;
