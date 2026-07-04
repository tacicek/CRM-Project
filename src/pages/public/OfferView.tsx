import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  FileText,
  Download,
  Loader2,
  Building2,
  Calendar,
  Mail,
  Phone,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Printer,
  Eye,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Fragment, useEffect, useState } from "react";
import { groupItemsByService } from "@/lib/offerServiceType";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { downloadChecklistPdf } from "@/lib/generateChecklistPdf";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import { parseSurcharges, sumSurchargeAmounts } from "@/lib/offerSurcharges";
import { hourlyRange, computeDisplayTotals, type SubtotalItem, BLIND_DISCLAIMER_LABEL, BLIND_DISCLAIMER_TEXT } from "@/lib/offerPricing";

interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  price_type?: string | null;
  service_type?: string | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
}

interface Offer {
  id: string;
  // P3b-2c-i: returned by get_offer_by_token since migration 20260704090000 — feeds
  // computeDisplayTotals so the public page discounts the max side of a blind range too.
  discount_percent?: number | null;
  title: string;
  description: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  service_date: string | null;
  valid_until: string | null;
  subtotal: number;
  surcharges?: unknown;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  viewed_at?: string | null;
  customer_response_note?: string | null;
  company_id: string;
  lead_id: string;
  checklist_url?: string | null;
  agb_accepted_at?: string | null;
  service_type?: string | null;
  is_expired?: boolean | null;
  price_model?: 'pauschal' | 'stundenansatz' | 'kostendach' | null;
  hourly_rate?: number | null;
  kostendach_max?: number | null;
  offerte_type?: 'normal' | 'blind' | null;
  payment_terms?: string | null;
  // Lead address fields (from get_offer_by_token RPC join)
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
}

interface ChecklistSection {
  id: string;
  timeline: string;
  items: string[];
  order: number;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  subtitle: string | null;
  sections: ChecklistSection[];
}

// Public company info (limited fields for security)
interface Company {
  id: string;
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email?: string;
  website?: string | null;
  logo_url: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  primary_color: string | null;
  signature_url?: string | null;
  slogan?: string | null;
}

interface LeadAddress {
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  service_type?: string | null;
}

const PublicOfferView = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<"network" | "not_found" | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [items, setItems] = useState<OfferItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBesichtigungDialog, setShowBesichtigungDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [besichtigungDate, setBesichtigungDate] = useState("");
  const [besichtigungTime, setBesichtigungTime] = useState("");
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [agbSections, setAgbSections] = useState<Array<{
    id: string;
    title: string;
    content: string;
    display_order: number;
  }>>([]);
  const [leadAddress, setLeadAddress] = useState<LeadAddress | null>(null);

  useEffect(() => {
    const fetchOffer = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Get offer by access token using the secure RPC function
        const { data: offerDataArray, error: offerError } = await supabase
          .rpc("get_offer_by_token", { offer_access_token: token });

        if (offerError) {
          console.error("Error fetching offer:", offerError);
          setLoadError("network");
          setIsLoading(false);
          return;
        }
        if (!offerDataArray || offerDataArray.length === 0) {
          setLoadError("not_found");
          setIsLoading(false);
          return;
        }
        
        const offerData = offerDataArray[0] as Offer;
        setOffer(offerData);

        // Populate lead address from RPC join fields for PDF generation
        if (offerData.from_plz || offerData.from_city || offerData.to_plz || offerData.to_city) {
          setLeadAddress({
            from_street: offerData.from_street,
            from_house_number: offerData.from_house_number,
            from_plz: offerData.from_plz,
            from_city: offerData.from_city,
            from_floor: offerData.from_floor,
            from_has_lift: offerData.from_has_lift,
            to_street: offerData.to_street,
            to_house_number: offerData.to_house_number,
            to_plz: offerData.to_plz,
            to_city: offerData.to_city,
            to_floor: offerData.to_floor,
            to_has_lift: offerData.to_has_lift,
            service_type: offerData.service_type,
          });
        }

        // Mark as viewed if sent using secure RPC function
        if (offerData.status === "sent") {
          await supabase.rpc("update_offer_by_token", {
            offer_access_token: token,
            new_status: "viewed",
            new_viewed_at: new Date().toISOString()
          });
          setOffer({ ...offerData, status: "viewed" });
        }

        // Get company using secure function
        const { data: companyData } = await supabase
          .rpc("get_public_company_info", { company_uuid: offerData.company_id });

        if (companyData && companyData.length > 0) {
          setCompany(companyData[0] as Company);
        }

        // Get offer items via SECURITY DEFINER RPC (bypasses RLS for anon users)
        const { data: itemsData } = await supabase
          .rpc("get_offer_items_by_token", { p_access_token: token });

        // RPC time_estimate: returns Json; cast because OfferItem expects a structural type.
        // hourlyRange is defensive (malformed shape → null), safe at render runtime.
        setItems((itemsData as OfferItem[]) || []);

        // Get lead to determine service type and address
        if (offerData.lead_id && companyData && companyData.length > 0) {
          // Checkliste und AGB werden über SECURITY DEFINER RPCs geladen (anon-safe),
          // gefiltert nach dem Service-Typ der Offerte, damit der Kunde nur die
          // relevanten Bedingungen sieht (nicht alle Services zusammengeführt).
          const normalizedServiceType = offerData.service_type
            ? normalizeServiceTypeForAgb(offerData.service_type)
            : null;

          const [checklistResult, agbResult] = await Promise.all([
            supabase.rpc("get_checklist_by_offer_token", {
              p_access_token: token,
              p_service_type: normalizedServiceType ?? null,
            }),
            supabase.rpc("get_agb_sections_by_offer_token", {
              p_access_token: token,
              p_service_type: normalizedServiceType ?? null,
            }),
          ]);

          // RPC returns an array; pick first row
          const checklistRow = Array.isArray(checklistResult.data) ? checklistResult.data[0] : checklistResult.data;
          if (checklistRow) {
            const sections = Array.isArray(checklistRow.sections)
              ? (checklistRow.sections as unknown as ChecklistSection[])
              : [];
            setChecklist({ ...checklistRow, sections });
          }

          setAgbSections(agbResult.data || []);
        }
      } catch (error) {
        console.error("Error fetching offer:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffer();
  }, [token]);

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

  const formatDateObj = (date: Date) => {
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const parseDateOnly = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getAcceptanceDeadline = () => {
    if (!offer) return null;

    const candidates: Date[] = [];
    if (offer.valid_until) {
      candidates.push(parseDateOnly(offer.valid_until));
    }
    if (offer.service_date) {
      const serviceMinusOne = parseDateOnly(offer.service_date);
      serviceMinusOne.setDate(serviceMinusOne.getDate() - 1);
      candidates.push(serviceMinusOne);
    }

    if (candidates.length === 0) return null;
    return candidates.reduce((min, current) => (current < min ? current : min));
  };

  const isExpired = () => {
    const deadline = getAcceptanceDeadline();
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > deadline;
  };

  const canRespond = () => {
    if (!offer) return false;
    return ["sent", "viewed"].includes(offer.status) && !isExpired();
  };

  const sendNotification = async (responseType: "accepted" | "rejected") => {
    if (!offer || !company || !token) return;

    try {
      await supabase.functions.invoke("notify-offer-response", {
        body: {
          offerId: offer.id,
          accessToken: token,
          offerTitle: offer.title,
          customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
          customerEmail: offer.customer_email,
          responseType,
          responseNote: responseNote || null,
          companyEmail: company.email,
          companyName: company.company_name,
          companyId: company.id,
          offerTotal: offer.total,
        },
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const handleAccept = async () => {
    if (!offer || !token) return;
    if (isExpired()) {
      toast({
        title: "Annahmefrist abgelaufen",
        description: "Diese Offerte kann nicht mehr angenommen werden. Bitte kontaktieren Sie die Firma.",
        variant: "destructive",
      });
      return;
    }

    setIsResponding(true);
    try {
      // Create AGB version hash from section IDs and titles
      const agbVersion = agbSections.length > 0 
        ? agbSections.map(s => `${s.id}:${s.title}`).join('|')
        : null;

      // Use secure RPC function to update offer
      const { data: success, error } = await supabase.rpc("update_offer_by_token", {
        offer_access_token: token,
        new_status: "accepted",
        new_accepted_at: new Date().toISOString(),
        new_customer_response_note: responseNote || null,
        new_agb_accepted_at: agbSections.length > 0 ? new Date().toISOString() : null,
        new_agb_version: agbVersion,
      });

      if (error || !success) {
        throw error || new Error("ANNAHMEFRIST_ABGELAUFEN");
      }

      await sendNotification("accepted");

      setOffer({
        ...offer,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        customer_response_note: responseNote || null,
      });
      setShowAcceptDialog(false);
      toast({
        title: "Offerte angenommen",
        description: agbSections.length > 0 
          ? "Vielen Dank! Sie haben die Offerte und die AGB akzeptiert. Die Firma wurde benachrichtigt."
          : "Vielen Dank! Die Firma wurde benachrichtigt.",
      });
    } catch (error) {
      console.error("Error accepting offer:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error && error.message.includes("ANNAHMEFRIST_ABGELAUFEN")
            ? "Die Annahmefrist ist abgelaufen. Bitte kontaktieren Sie die Firma."
            : "Die Antwort konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleReject = async () => {
    if (!offer || !token) return;

    setIsResponding(true);
    try {
      // Use secure RPC function to update offer
      const { data: success, error } = await supabase.rpc("update_offer_by_token", {
        offer_access_token: token,
        new_status: "rejected",
        new_rejected_at: new Date().toISOString(),
        new_customer_response_note: responseNote || null,
      });

      if (error || !success) throw error || new Error("Update failed");

      await sendNotification("rejected");

      setOffer({
        ...offer,
        status: "rejected",
        rejected_at: new Date().toISOString(),
        customer_response_note: responseNote || null,
      });
      setShowRejectDialog(false);
      toast({
        title: "Offerte abgelehnt",
        description: "Die Firma wurde über Ihre Entscheidung informiert.",
      });
    } catch (error) {
      console.error("Error rejecting offer:", error);
      toast({
        title: "Fehler",
        description: "Die Antwort konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!offer || !company) return;

    const { generateOfferPdf } = await import("@/lib/generateOfferPdf");
    await generateOfferPdf({
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
        iban: company.iban || undefined,
        logo_url: company.logo_url || undefined,
        primary_color: company.primary_color || undefined,
        signature_url: company.signature_url || undefined,
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
      agbSections: agbSections.length > 0 ? agbSections : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!offer || !company) {
    const isNetworkError = loadError === "network";
    return (
      <>
        <Helmet>
          <title>{isNetworkError ? "Verbindungsproblem" : "Offerte nicht gefunden"}</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <Card className="max-w-md mx-4">
            <CardContent className="pt-6 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              {isNetworkError ? (
                <>
                  <h1 className="text-xl font-bold mb-2">Verbindungsproblem</h1>
                  <p className="text-muted-foreground mb-4">
                    Die Offerte konnte nicht geladen werden. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    Seite neu laden
                  </button>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold mb-2">Offerte nicht gefunden</h1>
                  <p className="text-muted-foreground">
                    Diese Offerte existiert nicht oder ist nicht mehr verfügbar.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const getStatusDisplay = () => {
    switch (offer.status) {
      case "accepted":
        return (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Sie haben diese Offerte am {formatDate(offer.accepted_at)} angenommen</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <XCircle className="w-5 h-5" />
            <span className="font-medium">Sie haben diese Offerte am {formatDate(offer.rejected_at)} abgelehnt</span>
          </div>
        );
      default:
        if (isExpired()) {
          const deadline = getAcceptanceDeadline();
          return (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
              <Clock className="w-5 h-5" />
              <span className="font-medium">
                Diese Offerte ist abgelaufen{deadline ? ` (Annahme bis ${formatDateObj(deadline)})` : ""}
              </span>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>{offer.title} | Offerte von {company.company_name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.company_name}
                      className="w-16 h-16 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-secondary" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold">{company.company_name}</h1>
                    <p className="text-muted-foreground">
                      {company.street && company.house_number
                        ? `${company.street} ${company.house_number}, `
                        : ""}
                      {company.plz} {company.city}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className="flex items-center gap-1 hover:text-secondary">
                      <Phone className="w-4 h-4" />
                      {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="flex items-center gap-1 hover:text-secondary">
                      <Mail className="w-4 h-4" />
                      {company.email}
                    </a>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-secondary"
                    >
                      <Globe className="w-4 h-4" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Banner */}
          {getStatusDisplay()}

          {/* Offer Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{offer.title}</CardTitle>
                  <p className="text-muted-foreground mt-1">
                    Offerte erstellt am {formatDate(offer.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Drucken
                  </Button>
                  <Button variant="outline" onClick={handleDownloadPdf}>
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {offer.description && (
                <p className="text-muted-foreground">{offer.description}</p>
              )}
              <div className="flex flex-wrap gap-6">
                {offer.service_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ausführungsdatum</p>
                      <p className="font-medium">{formatDate(offer.service_date)}</p>
                    </div>
                  </div>
                )}
                {offer.valid_until && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Gültig bis</p>
                      <p className={`font-medium ${isExpired() ? "text-destructive" : ""}`}>
                        {formatDate(offer.valid_until)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Positionen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                    {(() => {
                      const groups = groupItemsByService(items);
                      const multi = groups.length > 1;
                      return groups.map((group) => (
                        <Fragment key={group.serviceType ?? "allgemein"}>
                          {multi && (
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={6} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">
                                {group.label}
                              </TableCell>
                            </TableRow>
                          )}
                          {group.items.map((item) => {
                            const r = hourlyRange(item.time_estimate);
                            return (
                            <TableRow key={item.id}>
                              <TableCell className="text-center">{item.position}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              {r ? (
                                <>
                                  <TableCell className="text-right">
                                    {item.time_estimate!.minHours}–{item.time_estimate!.maxHours} Std.
                                  </TableCell>
                                  <TableCell>Std.</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(Number(item.time_estimate!.hourlyRate))}/Std.
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-amber-700">
                                    {formatCurrency(r.min)} – {formatCurrency(r.max)}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(Number(item.unit_price))}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(Number(item.total))}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                            );
                          })}
                        </Fragment>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-6" />

              {/* Blind-Offerte Hinweis (nur bei offerte_type='blind') */}
              {offer.offerte_type === 'blind' && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <p className="font-semibold uppercase tracking-wide text-xs text-amber-700 mb-1">
                    {BLIND_DISCLAIMER_LABEL}
                  </p>
                  <p>{BLIND_DISCLAIMER_TEXT}</p>
                </div>
              )}

              {/* Price model info block */}
              {offer.price_model === 'stundenansatz' && offer.hourly_rate !== null && offer.hourly_rate !== undefined && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <span className="font-medium">Stundenansatz:</span>{" "}
                  CHF {Number(offer.hourly_rate).toLocaleString('de-CH')} / Std.
                </div>
              )}
              {offer.price_model === 'kostendach' && offer.hourly_rate !== null && offer.hourly_rate !== undefined && offer.kostendach_max !== null && offer.kostendach_max !== undefined && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 space-y-1">
                  <div>
                    <span className="font-medium">Stundenansatz:</span>{" "}
                    CHF {Number(offer.hourly_rate).toLocaleString('de-CH')} / Std.
                  </div>
                  <div>
                    <span className="font-medium">Kostendach:</span>{" "}
                    max. CHF {Number(offer.kostendach_max).toLocaleString('de-CH')}
                  </div>
                  <p className="text-emerald-700 text-xs pt-0.5">
                    Sie zahlen maximal CHF {Number(offer.kostendach_max).toLocaleString('de-CH')}, unabhängig vom tatsächlichen Zeitaufwand.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <div className="w-72 space-y-3">
                  {(() => {
                    const surchargeList = parseSurcharges(offer.surcharges);
                    const surchargesSum = sumSurchargeAmounts(surchargeList);
                    // P3b-2a: Zwischensumme comes from the ITEMS (raw, undiscounted) — never
                    // derived back from offers.subtotal (which stores the discounted base).
                    const subtotalItems = items.map((it): SubtotalItem => ({
                      priceType: it.price_type ?? "",
                      quantity: Number(it.quantity),
                      unitPrice: Number(it.unit_price),
                      timeEstimate: it.time_estimate ?? null,
                    }));
                    const minTotals = computeDisplayTotals(
                      subtotalItems, surchargesSum, Number(offer.vat_rate), offer.discount_percent, "min",
                    );
                    const maxTotals = computeDisplayTotals(
                      subtotalItems, surchargesSum, Number(offer.vat_rate), offer.discount_percent, "max",
                    );
                    const minItemsSub = minTotals.subtotal;
                    const maxItemsSub = maxTotals.subtotal;
                    const isRange = offer.offerte_type === "blind" && maxItemsSub !== minItemsSub;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Zwischensumme</span>
                          <span>
                            {isRange
                              ? `${formatCurrency(minItemsSub)} – ${formatCurrency(maxItemsSub)}`
                              : formatCurrency(minItemsSub)}
                          </span>
                        </div>
                        {surchargeList.map((s, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-muted-foreground truncate">{s.label || "Zuschlag"}</span>
                            <span>{formatCurrency(s.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MwSt. ({offer.vat_rate}%)</span>
                          <span>
                            {isRange
                              ? `${formatCurrency(Number(offer.vat_amount))} – ${formatCurrency(maxTotals.vatAmount)}`
                              : formatCurrency(Number(offer.vat_amount))}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-xl font-bold">
                          <span>Total</span>
                          <span className="text-secondary">
                            {isRange
                              ? `${formatCurrency(Number(offer.total))} – ${formatCurrency(maxTotals.total)}`
                              : formatCurrency(Number(offer.total))}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zahlungskondition */}
          {offer.payment_terms && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <span className="font-semibold text-sm whitespace-nowrap">Zahlungskondition:</span>
                  <span className="text-sm text-muted-foreground">{offer.payment_terms}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist Section */}
          {checklist && checklist.sections.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowChecklist(!showChecklist)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CheckSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{checklist.title}</CardTitle>
                      {checklist.subtitle && (
                        <p className="text-sm text-muted-foreground mt-0.5">{checklist.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    {showChecklist ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showChecklist && (
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    {checklist.sections.map((section, index) => (
                      <div key={section.id || index}>
                        <div className="bg-muted/50 px-4 py-2 rounded-lg mb-3">
                          <h4 className="font-semibold text-sm">{section.timeline}</h4>
                        </div>
                        <ul className="space-y-2 pl-2">
                          {section.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-3">
                              <div className="mt-1 w-4 h-4 rounded border border-muted-foreground/30 shrink-0" />
                              <span className="text-sm text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                      Diese Checkliste wurde von {company.company_name} für Sie zusammengestellt.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        downloadChecklistPdf({
                          title: checklist.title,
                          subtitle: checklist.subtitle || "",
                          sections: checklist.sections,
                          company: {
                            company_name: company.company_name,
                            street: company.street,
                            house_number: company.house_number,
                            plz: company.plz,
                            city: company.city,
                            phone: company.phone,
                            email: company.email,
                            website: company.website,
                          }
                        });
                      }}
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Checkliste als PDF
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Action Buttons */}
          {canRespond() && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                  <p className="text-muted-foreground">Wie möchten Sie auf diese Offerte reagieren?</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Ablehnen
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowContactDialog(true)}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Frage stellen
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowBesichtigungDialog(true)}
                    >
                      <Eye className="w-5 h-5 mr-2" />
                      Besichtigung anfragen
                    </Button>
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setShowAcceptDialog(true)}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Offerte annehmen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            Bei Fragen wenden Sie sich bitte an{" "}
            <a href={`mailto:${company.email}`} className="text-secondary hover:underline">
              {company.email}
            </a>
          </p>
        </div>
      </div>

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Offerte annehmen
            </DialogTitle>
            <DialogDescription>
              Möchten Sie diese Offerte verbindlich annehmen? {company.company_name} wird über Ihre Entscheidung informiert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
              <p className="text-2xl font-bold text-secondary">{formatCurrency(Number(offer.total))}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Nachricht (optional)</Label>
              <Textarea
                id="note"
                placeholder="Möchten Sie der Firma etwas mitteilen?"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Abbrechen
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
              disabled={isResponding}
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Verbindlich annehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Offerte ablehnen
            </DialogTitle>
            <DialogDescription>
              Möchten Sie diese Offerte ablehnen? {company.company_name} wird über Ihre Entscheidung informiert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectNote">Grund für die Ablehnung (optional)</Label>
              <Textarea
                id="rejectNote"
                placeholder="Teilen Sie der Firma mit, warum Sie die Offerte ablehnen..."
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isResponding}
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Offerte ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-secondary" />
              Frage stellen
            </DialogTitle>
            <DialogDescription>
              Haben Sie eine Frage zu dieser Offerte? {company.company_name} wird sich bei Ihnen melden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contactMessage">Ihre Frage oder Nachricht *</Label>
              <Textarea
                id="contactMessage"
                placeholder="Schreiben Sie hier Ihre Frage oder Nachricht..."
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                rows={5}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p>Ihre Kontaktdaten:</p>
              <p className="font-medium text-foreground mt-1">
                {offer.customer_first_name} {offer.customer_last_name}
              </p>
              <p>{offer.customer_email}</p>
              {offer.customer_phone && <p>{offer.customer_phone}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                if (!contactMessage.trim()) {
                  toast({
                    title: "Bitte geben Sie eine Nachricht ein",
                    variant: "destructive",
                  });
                  return;
                }
                
                setIsResponding(true);
                try {
                  // Send email notification to company
                  await supabase.functions.invoke("notify-offer-response", {
                    body: {
                      offerId: offer.id,
                      accessToken: token,
                      offerTitle: offer.title,
                      customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
                      customerEmail: offer.customer_email,
                      customerPhone: offer.customer_phone,
                      responseType: "question",
                      responseNote: contactMessage,
                      companyEmail: company.email,
                      companyName: company.company_name,
                      companyId: company.id,
                      offerTotal: offer.total,
                    },
                  });

                  setShowContactDialog(false);
                  setContactMessage("");
                  
                  toast({
                    title: "Nachricht gesendet",
                    description: "Die Firma wurde über Ihre Frage informiert und wird sich bei Ihnen melden.",
                  });
                } catch (error) {
                  console.error("Error sending contact message:", error);
                  toast({
                    title: "Fehler",
                    description: "Die Nachricht konnte nicht gesendet werden.",
                    variant: "destructive",
                  });
                } finally {
                  setIsResponding(false);
                }
              }}
              disabled={isResponding || !contactMessage.trim()}
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Nachricht senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Besichtigung Dialog */}
      <Dialog open={showBesichtigungDialog} onOpenChange={setShowBesichtigungDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-secondary" />
              Besichtigung anfragen
            </DialogTitle>
            <DialogDescription>
              Schlagen Sie einen Termin für eine Besichtigung vor. {company.company_name} wird sich bei Ihnen melden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="besichtigungDate">Wunschdatum</Label>
                <Input
                  id="besichtigungDate"
                  type="date"
                  value={besichtigungDate}
                  onChange={(e) => setBesichtigungDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="besichtigungTime">Wunschzeit</Label>
                <Input
                  id="besichtigungTime"
                  type="time"
                  value={besichtigungTime}
                  onChange={(e) => setBesichtigungTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="besichtigungNote">Nachricht (optional)</Label>
              <Textarea
                id="besichtigungNote"
                placeholder="Gibt es etwas, das wir vor der Besichtigung wissen sollten?"
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBesichtigungDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                if (!offer || !company || !besichtigungDate) {
                  toast({
                    title: "Bitte wählen Sie ein Datum",
                    variant: "destructive",
                  });
                  return;
                }
                
                setIsResponding(true);
                try {
                  const besichtigungInfo = `Besichtigung gewünscht am ${new Date(besichtigungDate).toLocaleDateString("de-CH")}${besichtigungTime ? " um " + besichtigungTime + " Uhr" : ""}. ${responseNote || ""}`;

                  // Use RPC (SECURITY DEFINER) — anon cannot write directly to offers
                  const { data: updated, error } = await supabase
                    .rpc("update_offer_by_token", {
                      offer_access_token: token,
                      new_customer_response_note: besichtigungInfo,
                    });

                  if (error) throw error;
                  if (!updated) throw new Error("Aktualisierung fehlgeschlagen");

                  // Send email notification to company
                  try {
                    await supabase.functions.invoke("notify-besichtigung", {
                      body: {
                        offerTitle: offer.title,
                        customerName: `${offer.customer_first_name} ${offer.customer_last_name}`,
                        customerEmail: offer.customer_email,
                        customerPhone: offer.customer_phone,
                        besichtigungDate,
                        besichtigungTime: besichtigungTime || null,
                        customerNote: responseNote || null,
                        companyEmail: company.email,
                        companyName: company.company_name,
                        companyId: company.id,
                        offerTotal: offer.total,
                        offerId: offer.id,
                      },
                    });
                  } catch (emailError) {
                    console.error("Error sending besichtigung notification:", emailError);
                  }

                  setOffer({
                    ...offer,
                    customer_response_note: besichtigungInfo,
                  });
                  setShowBesichtigungDialog(false);
                  setBesichtigungDate("");
                  setBesichtigungTime("");
                  setResponseNote("");
                  
                  toast({
                    title: "Besichtigung angefragt",
                    description: "Die Firma wurde über Ihren Terminwunsch informiert.",
                  });
                } catch (error) {
                  console.error("Error requesting besichtigung:", error);
                  toast({
                    title: "Fehler",
                    description: "Die Anfrage konnte nicht gespeichert werden.",
                    variant: "destructive",
                  });
                } finally {
                  setIsResponding(false);
                }
              }}
              disabled={isResponding || !besichtigungDate}
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Termin vorschlagen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublicOfferView;
