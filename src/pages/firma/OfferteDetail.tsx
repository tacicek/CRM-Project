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
import { Suspense, lazy, useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
}

const PdfPreviewDialog = lazy(async () => {
  const module = await import("@/components/offerte/PdfPreviewDialog");
  return { default: module.PdfPreviewDialog };
});

interface Offer {
  id: string;
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
  hourly_rate: number | null;
  kostendach_max: number | null;
  service_start_time: string | null;
  service_end_time: string | null;
  brief_layout?: boolean | null;
  customer_salutation?: string | null;
  offerte_type?: "normal" | "blind" | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
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

const FirmaOfferteDetail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();

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
  const [checklistTemplate, setChecklistTemplate] = useState<{
    title: string;
    subtitle?: string | null;
    sections: Array<{ id: string; timeline: string; items: string[]; order: number }>;
  } | null>(null);
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
            title: "Fehler",
            description: "Offerte nicht gefunden",
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }
        setOffer(offerData);

        // Get lead info to fetch AGB sections and address data
        let normalizedServiceType = "";
        if (offerData.lead_id) {
          const { data: leadData } = await supabase
            .from("leads")
            .select("service_type, from_street, from_house_number, from_plz, from_city, from_floor, from_has_lift, from_rooms, from_living_space_m2, to_street, to_house_number, to_plz, to_city, to_floor, to_has_lift, preferred_date, preferred_time_slot, packing_service_needed, cleaning_service_needed, storage_needed, description, property_type")
            .eq("id", offerData.lead_id)
            .maybeSingle();
          if (leadData) {
            // Normalize service type for AGB lookup (e.g., umzug_privat -> umzug)
            normalizedServiceType = normalizeServiceTypeForAgb(leadData.service_type);
            setLeadAddress(leadData as LeadData);
          }
        }

        // Get offer items, leistungsuebersicht, email logs, AGB and checklist in parallel
        const [itemsResult, leistungResult, emailLogsResult, agbResult, checklistResult] = await Promise.all([
          supabase
            .from("offer_items")
            .select("*")
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
          normalizedServiceType ? supabase
            .from("checklist_templates")
            .select("title, subtitle, sections")
            .eq("company_id", companyData.id)
            .eq("service_type", normalizedServiceType)
            .eq("is_active", true)
            .eq("include_in_offerte", true)
            .maybeSingle() : Promise.resolve({ data: null }),
        ]);

        setItems(itemsResult.data || []);
        setEmailLogs((emailLogsResult.data || []) as EmailLog[]);
        setAgbSections(agbResult.data || []);
        if (checklistResult.data && Array.isArray((checklistResult.data as { sections: unknown }).sections)) {
          setChecklistTemplate(checklistResult.data as typeof checklistTemplate);
        }

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
  }, [user, id, navigate, toast]);

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

  /** Returns { maxSubtotal, maxVat, maxTotal } for blind offers with time estimate, or null. */
  const getBlindRange = () => {
    const te = offer?.time_estimate;
    if (offer?.offerte_type !== 'blind' || !te) return null;
    const positionsSum = Number(offer.subtotal) - te.minHours * te.hourlyRate;
    const maxSubtotal = positionsSum + te.maxHours * te.hourlyRate;
    const vatRate = Number(offer.vat_rate);
    const maxVat = maxSubtotal * (vatRate / 100);
    const maxTotal = maxSubtotal + maxVat;
    return { maxSubtotal, maxVat, maxTotal };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Entwurf</Badge>;
      case "sent":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">Gesendet</Badge>;
      case "viewed":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Angesehen</Badge>;
      case "accepted":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Angenommen</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30">Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPreferredTimeSlot = (slot: string | null | undefined) => {
    if (!slot) return "-";
    const map: Record<string, string> = {
      morning: "Vormittag (08:00-12:00)",
      afternoon: "Nachmittag (13:00-17:00)",
      evening: "Abend",
      flexible: "Flexibel",
    };
    return map[slot] || slot;
  };

  const handleDownloadPdf = async () => {
    const payload = buildOfferPayload();
    if (!payload) return;

    const { generateOfferPdf } = await import("@/lib/generateOfferPdf");
    await generateOfferPdf(payload);

    toast({
      title: "PDF erstellt",
      description: "Die Offerte wurde als PDF heruntergeladen.",
    });
  };

  const getPublicOfferUrl = () => {
    if (!offer) return "";
    return `${window.location.origin}/offerte/${offer.access_token}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getPublicOfferUrl());
    toast({
      title: "Link kopiert",
      description: "Der Offerten-Link wurde in die Zwischenablage kopiert.",
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
              },
      customer_address: leadAddress ? {
        street: leadAddress.from_street || undefined,
        house_number: leadAddress.from_house_number || undefined,
        plz: leadAddress.from_plz || undefined,
        city: leadAddress.from_city || undefined,
        floor: leadAddress.from_floor ?? undefined,
        has_lift: leadAddress.from_has_lift ?? undefined,
      } : undefined,
      customer_destination: leadAddress && (leadAddress.to_plz || leadAddress.to_city) ? {
        street: leadAddress.to_street || undefined,
        house_number: leadAddress.to_house_number || undefined,
        plz: leadAddress.to_plz || undefined,
        city: leadAddress.to_city || undefined,
        floor: leadAddress.to_floor ?? undefined,
        has_lift: leadAddress.to_has_lift ?? undefined,
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte neu einloggen und erneut versuchen.", variant: "destructive" });
        setIsSending(false);
        return;
      }

      // Generate the same PDF as the download button using @react-pdf/renderer
      const payload = buildOfferPayload();
      if (!payload) throw new Error("Offer data incomplete");

      const { generateOfferPdfBase64 } = await import("@/lib/generateOfferPdf");
      const offerPdfBase64 = await generateOfferPdfBase64(payload);
      const agbPdfBase64 =
        agbSections.length > 0
          ? await (async () => {
              const { generateAgbPdfBase64 } = await import("@/lib/generateAgbPdf");
              return generateAgbPdfBase64(agbSections, company.company_name);
            })()
          : null;

      const checklistPdfBase64 =
        checklistTemplate?.sections?.length
          ? await (async () => {
              const { getChecklistPdfBase64 } = await import("@/lib/generateChecklistPdf");
              return getChecklistPdfBase64({
                title: checklistTemplate.title,
                subtitle: checklistTemplate.subtitle ?? undefined,
                sections: checklistTemplate.sections,
                company: {
                  company_name: company.company_name,
                  street: company.street ?? undefined,
                  house_number: company.house_number ?? undefined,
                  plz: company.plz,
                  city: company.city,
                  phone: company.phone ?? undefined,
                  email: company.email,
                  website: company.website ?? undefined,
                  logo_url: company.logo_url ?? undefined,
                  primary_color: company.primary_color ?? undefined,
                },
              });
            })()
          : null;

      // Send to edge function with pre-generated PDF
      const { error: invokeError } = await supabase.functions.invoke("send-offer", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          offerId: offer.id,
          force_resend: true,
          offerPdfBase64,
          ...(agbPdfBase64 ? { agbPdfBase64 } : {}),
          ...(checklistPdfBase64 ? { checklistPdfBase64 } : {}),
        },
      });

      if (invokeError) {
        let errorMessage = "Die E-Mail konnte nicht gesendet werden.";
        try {
          const body = await (invokeError as unknown as { context?: Response }).context?.json();
          if (body?.error) errorMessage = String(body.error);
        } catch (_) { /* ignore */ }
        throw new Error(errorMessage);
      }

      setOffer({ ...offer, status: "sent", sent_at: new Date().toISOString() });
      toast({
        title: "Offerte gesendet",
        description: "Die Offerte wurde erfolgreich per E-Mail an den Kunden gesendet.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error sending offer:", error);
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
      setIsSending(false);
    }
  };

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

  const handleDeleteOffer = async () => {
    if (!offer) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from("offers").delete().eq("id", offer.id);

      if (error) throw error;

      toast({
        title: "Offerte gelöscht",
        description: "Die Offerte wurde erfolgreich gelöscht.",
      });
      navigate("/firma/offerten");
    } catch (error) {
      console.error("Error deleting offer:", error);
      toast({
        title: "Fehler",
        description: "Die Offerte konnte nicht gelöscht werden.",
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
        title: "Besichtigung bestätigt",
        description: "Der Termin wurde im Kalender eingetragen und der Kunde wurde per E-Mail benachrichtigt.",
      });
    } catch (error) {
      console.error("Error confirming besichtigung:", error);
      toast({
        title: "Fehler",
        description: "Die Besichtigung konnte nicht bestätigt werden.",
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
          <title>Offerte | Firma</title>
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
          <title>Offerte nicht gefunden | Firma</title>
        </Helmet>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Offerte nicht gefunden</h3>
            <Button onClick={() => navigate("/firma/offerten")}>Zurück zu Offerten</Button>
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{offer.title} | Firma</title>
      </Helmet>
        <div className="space-y-4 sm:space-y-6">
          {/* Mobile Header */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/firma/offerten")} className="shrink-0" aria-label="Zurück zu Offerten">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate">{offer.title}</h2>
                  {getStatusBadge(offer.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(offer.created_at)}
                  {offer.sent_at && ` • ${formatDate(offer.sent_at)}`}
                </p>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="flex-1">
                <Download className="w-4 h-4 mr-1.5" />
                PDF
              </Button>
              {offer.status === "accepted" && (
                <Button size="sm" onClick={() => setShowAuftragModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <ClipboardList className="w-4 h-4 mr-1.5" />
                  Auftrag
                </Button>
              )}
              {offer.status === "draft" && (
                <Button size="sm" onClick={handleOpenPreview} disabled={isSending} className="flex-1">
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-1.5" />
                  )}
                  Vorschau
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/firma/offerten")} aria-label="Zurück zu Offerten">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{offer.title}</h2>
                  {getStatusBadge(offer.status)}
                </div>
                <p className="text-muted-foreground">
                  Erstellt am {formatDate(offer.created_at)}
                  {offer.sent_at && ` • Gesendet am ${formatDate(offer.sent_at)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4 mr-2" />
                PDF herunterladen
              </Button>
              {offer.status === "accepted" && (
                <Button onClick={() => setShowAuftragModal(true)} className="bg-blue-600 hover:bg-blue-700">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Auftrag erstellen
                </Button>
              )}
              {offer.status === "draft" && (
                <Button onClick={handleOpenPreview} disabled={isSending}>
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Vorschau & Senden
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-1 lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Offer Details */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">Offerten-Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  {offer.description && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">Beschreibung</p>
                      <p className="text-sm sm:text-base">{offer.description}</p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Ausführung</p>
                        <p className="font-medium text-sm sm:text-base">{formatDate(offer.service_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">Gültig bis</p>
                        <p className="font-medium text-sm sm:text-base">{formatDate(offer.valid_until)}</p>
                      </div>
                    </div>
                  </div>

                  {leadAddress?.preferred_date && (
                    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2">Kundenwunsch (aus Anfrage)</p>
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
                  <CardTitle className="text-base">Positionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0 text-xs">{item.position}</Badge>
                          <span className="font-medium text-sm">{item.description}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.quantity} {item.unit} × {formatCurrency(Number(item.unit_price))}</span>
                        <span className="font-semibold text-foreground">{formatCurrency(Number(item.total))}</span>
                      </div>
                    </div>
                  ))}

                  <Separator className="my-3" />

                  <div className="space-y-2 text-sm">
                    {(() => { const range = getBlindRange(); return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Zwischensumme</span>
                          {range ? (
                            <span className="text-amber-700 font-medium">{formatCurrency(Number(offer.subtotal))} – {formatCurrency(range.maxSubtotal)}</span>
                          ) : (
                            <span>{formatCurrency(Number(offer.subtotal))}</span>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MwSt. ({offer.vat_rate}%)</span>
                          {range ? (
                            <span className="text-amber-700">{formatCurrency(Number(offer.vat_amount))} – {formatCurrency(range.maxVat)}</span>
                          ) : (
                            <span>{formatCurrency(Number(offer.vat_amount))}</span>
                          )}
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-base pt-1">
                          <span>Total</span>
                          {range ? (
                            <span className="text-amber-700">{formatCurrency(Number(offer.total))} – {formatCurrency(range.maxTotal)}</span>
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
                  <CardTitle>Positionen</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos.</TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead className="text-right w-20">Menge</TableHead>
                        <TableHead className="w-20">Einheit</TableHead>
                        <TableHead className="text-right w-28">Preis</TableHead>
                        <TableHead className="text-right w-28">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-center">{item.position}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.unit_price))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(item.total))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Separator className="my-4" />

                  <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                      {(() => { const range = getBlindRange(); return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Zwischensumme</span>
                            {range ? (
                              <span className="text-amber-700 font-medium">{formatCurrency(Number(offer.subtotal))} – {formatCurrency(range.maxSubtotal)}</span>
                            ) : (
                              <span>{formatCurrency(Number(offer.subtotal))}</span>
                            )}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>MwSt. ({offer.vat_rate}%)</span>
                            {range ? (
                              <span className="text-amber-700">{formatCurrency(Number(offer.vat_amount))} – {formatCurrency(range.maxVat)}</span>
                            ) : (
                              <span>{formatCurrency(Number(offer.vat_amount))}</span>
                            )}
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            {range ? (
                              <span className="text-amber-700">{formatCurrency(Number(offer.total))} – {formatCurrency(range.maxTotal)}</span>
                            ) : (
                              <span>{formatCurrency(Number(offer.total))}</span>
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
                    Kunde
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
                        E-Mail
                      </Button>
                    </a>
                    {offer.customer_phone && (
                      <a href={`tel:${offer.customer_phone}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          <Phone className="w-4 h-4 mr-1.5" />
                          Anrufen
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
                      E-Mail-Status
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
                            {log.email_type === "offer_sent" ? "Gesendet" : log.email_type}
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
                    Aktivitäten
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
                        <p className="text-xs sm:text-sm font-medium">Offerte erstellt</p>
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
                          <p className="text-xs sm:text-sm font-medium">Per E-Mail gesendet</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            an {offer.customer_email}
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
                          <p className="text-xs sm:text-sm font-medium">Vom Kunden angesehen</p>
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
                          <p className="text-xs sm:text-sm font-medium text-green-700">Offerte angenommen</p>
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
                          <p className="text-xs sm:text-sm font-medium text-red-700">Offerte abgelehnt</p>
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
                            Noch keine weiteren Aktivitäten
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
                        <span className="truncate">Besichtigung bestätigt</span>
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
                        <span className="truncate">Besichtigungsanfrage</span>
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
                        Bestätigen & Kalender
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
                      Kundennotiz
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
                      <span className="truncate">AGB-Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {offer.agb_accepted_at ? (
                      <>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-green-700">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">AGB akzeptiert</span>
                        </div>
                        <div className="bg-white rounded-lg p-2 sm:p-3 border border-green-200 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Akzeptiert am:</span>
                            <span className="font-medium">{formatDateTime(offer.agb_accepted_at)}</span>
                          </div>
                          {offer.agb_version && (
                            <div className="flex items-start gap-2 text-xs">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">Version:</span>
                              <span className="font-mono text-[10px] break-all">{offer.agb_version.substring(0, 50)}...</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Der Kunde hat die AGB bei Annahme der Offerte rechtsgültig akzeptiert.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium">Keine AGB vorhanden</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Diese Offerte wurde ohne AGB-Sektion angenommen. Erstellen Sie AGB-Sektionen für zukünftige Offerten.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-medium">Kunden-Link</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" onClick={handleCopyLink}>
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        Kopieren
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleOpenPublicView}>
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive text-xs sm:text-sm">
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        Offerte löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Offerte löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteOffer}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            "Löschen"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                created_at: offer.created_at,
                items: items.map((item) => ({
                  position: item.position,
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  unit_price: item.unit_price,
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
                Besichtigungstermin bestätigen
              </DialogTitle>
              <DialogDescription>
                Passen Sie bei Bedarf Datum und Uhrzeit an, bevor Sie den Termin bestätigen.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="besichtigung-date">Datum</Label>
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
                        format(besichtigungDate, "PPP", { locale: de })
                      ) : (
                        <span>Datum wählen</span>
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
                <Label htmlFor="besichtigung-time">Uhrzeit</Label>
                <Input
                  id="besichtigung-time"
                  type="time"
                  value={besichtigungTime}
                  onChange={(e) => setBesichtigungTime(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Dauer</Label>
                <Select value={besichtigungDuration} onValueChange={setBesichtigungDuration}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Dauer wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="30">30 Minuten</SelectItem>
                    <SelectItem value="60">1 Stunde</SelectItem>
                    <SelectItem value="120">2 Stunden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Besichtigungsadresse
                </Label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="bes-street" className="text-xs text-muted-foreground">Strasse</Label>
                  <Input
                    id="bes-street"
                    placeholder="Strasse"
                    value={besichtigungAddress.street}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, street: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bes-nr" className="text-xs text-muted-foreground">Nr.</Label>
                  <Input
                    id="bes-nr"
                    placeholder="Nr."
                    value={besichtigungAddress.houseNumber}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, houseNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bes-plz" className="text-xs text-muted-foreground">PLZ</Label>
                  <Input
                    id="bes-plz"
                    placeholder="PLZ"
                    value={besichtigungAddress.plz}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, plz: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="bes-city" className="text-xs text-muted-foreground">Ort</Label>
                  <Input
                    id="bes-city"
                    placeholder="Ort"
                    value={besichtigungAddress.city}
                    onChange={(e) => setBesichtigungAddress(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
              </div>

              {offer && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    <strong>Kunde:</strong> {offer.customer_first_name} {offer.customer_last_name}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>E-Mail:</strong> {offer.customer_email}
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
                Abbrechen
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
                Bestätigen & E-Mail senden
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
            toast({
              title: "Auftrag erstellt",
              description: "Der Auftrag wurde erfolgreich erstellt. Sie finden ihn unter 'Aufträge'.",
            });
            navigate("/firma/auftraege");
          }}
        />
    </>
  );
};

export default FirmaOfferteDetail;
