import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
// ScrollArea removed - using standard overflow instead
import {
  Loader2,
  Calendar as CalendarIcon,
  User,
  Users,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
  Save,
  X,
  Package,
  Euro,
  Home,
  Building,
  Truck,
  Piano,
  Sparkles,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAuftragStatusLabel, getServiceLabel } from "@/i18n/domain";
import { formatCurrency } from "@/i18n/format";
import { useI18n, useT } from "@/i18n/useI18n";
import { allowedAuftragTargets } from "@/lib/auftragStatus";
import { toLocale } from "@/i18n/locale";

// =============================================================================
// INTERFACES
// =============================================================================

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number | null;
  price_type?: string | null;
}

interface FullOffer {
  id: string;
  title: string;
  description: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  lead_id: string;
  service_date: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number | null;
  total: number | null;
  status: string;
  /** DOCUMENT locale, frozen on the offer — the Auftrag inherits it. */
  language?: string | null;
}

interface Lead {
  id: string;
  service_type: string;
  /** DOCUMENT locale — only used when the Auftrag is created without an offer. */
  language?: string | null;
  // Customer
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  // Origin address
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string;
  from_city: string;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  // Destination address
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  // Property
  property_type: string | null;
  // Services
  packing_service_needed: boolean | null;
  cleaning_service_needed: boolean | null;
  storage_needed: boolean | null;
  piano_transport_needed: boolean | null;
  // Distance
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  // Description
  description: string | null;
  // Reinigung fields
  bathroom_count: number | null;
  kitchen_type: string | null;
  has_balcony: boolean | null;
  has_garage: boolean | null;
  has_basement: boolean | null;
  has_attic: boolean | null;
  cleaning_windows: boolean | null;
  // Räumung fields
  clearing_type: string | null;
  estimated_volume: string | null;
  has_heavy_items: boolean | null;
  heavy_items_description: string | null;
  // Klaviertransport fields
  piano_type: string | null;
  piano_weight_kg: number | null;
  // Storage fields
  storage_duration: string | null;
  storage_volume: string | null;
}

interface ExtraService {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface Auftrag {
  id: string;
  auftrag_nummer: string;
  offer_id: string | null;
  lead_id: string | null;
  appointment_id?: string | null;
  title: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  from_address: string | null;
  to_address: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  description: string | null;
  special_instructions: string | null;
  internal_notes: string | null;
  team_leader_id: string | null;
  assigned_team_members: string[];
  reminder_days_before: number;
  status: string;
  // Service & pricing fields
  service_type?: string | null;
  pricing_type?: "fixed" | "hourly" | "estimate" | null;
  hourly_rate?: number | null;
  subtotal?: number | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
  total?: number | null;
  items?: OfferItem[];
  extra_services?: ExtraService[];
  service_details?: Record<string, unknown>;
}

interface AuftragModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  offerId?: string | null; // Pass offer ID instead of offer object
  auftrag?: Auftrag | null;
  onSuccess: () => void;
}

// Interface for approved offers in the selection list
interface ApprovedOffer {
  id: string;
  title: string;
  customer_first_name: string;
  customer_last_name: string;
  service_date: string | null;
  total: number | null;
  status: string;
  created_at: string;
  lead_id: string;
  leads?: {
    service_type: string;
    from_city: string;
    to_city: string | null;
  } | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AuftragModal({
  isOpen,
  onClose,
  companyId,
  offerId,
  auftrag,
  onSuccess,
}: AuftragModalProps) {
  const { toast } = useToast();
  const t = useT();
  const { locale, dateLocale } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Offer selection state (for new orders without pre-selected offer)
  const [showOfferSelection, setShowOfferSelection] = useState(false);
  const [approvedOffers, setApprovedOffers] = useState<ApprovedOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  
  // Full data from offer and lead
  const [offer, setOffer] = useState<FullOffer | null>(null);
  const [_offerItems, setOfferItems] = useState<OfferItem[]>([]);
  // No longer unused: the lead is the language source when an Auftrag is created without an offer.
  const [lead, setLead] = useState<Lead | null>(null);
  
  // UI state
  const [showOfferDetails, setShowOfferDetails] = useState(true);
  const [showServiceDetails, setShowServiceDetails] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    from_address: "",
    to_address: "",
    scheduled_date: new Date(),
    scheduled_time: "",
    estimated_duration_minutes: 120,
    description: "",
    special_instructions: "",
    internal_notes: "",
    team_leader_id: "",
    assigned_team_members: [] as string[],
    reminder_days_before: 1,
    status: "geplant",
    // Pricing
    service_type: "",
    pricing_type: "fixed" as "fixed" | "hourly" | "estimate",
    hourly_rate: 0,
    subtotal: 0,
    vat_rate: 8.1,
    vat_amount: 0,
    total: 0,
    items: [] as OfferItem[],
    extra_services: [] as ExtraService[],
    service_details: {} as Record<string, unknown>,
  });

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Fetch team members
  useEffect(() => {
    let isMounted = true;
    
    const fetchTeamMembers = async () => {
      if (!companyId) return;

      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, email, phone, role")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("first_name");

      if (!error && data && isMounted) {
        setTeamMembers(data);
      }
    };

    if (isOpen) {
      fetchTeamMembers();
    }
    
    return () => { isMounted = false; };
  }, [isOpen, companyId]);

  // Fetch approved offers when modal opens for new order without pre-selected offer
  useEffect(() => {
    const fetchApprovedOffers = async () => {
      if (!companyId || offerId || auftrag) return;
      
      setIsLoadingOffers(true);
      setShowOfferSelection(true);
      
      try {
        const { data, error } = await supabase
          .from("offers")
          .select(`
            id,
            title,
            customer_first_name,
            customer_last_name,
            service_date,
            total,
            status,
            created_at,
            lead_id,
            leads (
              service_type,
              from_city,
              to_city
            )
          `)
          .eq("company_id", companyId)
          .eq("status", "accepted")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        setApprovedOffers((data as ApprovedOffer[]) || []);
      } catch (error) {
        console.error("Error fetching approved offers:", error);
        toast({
          title: t("common.error"),
          description: t("auftrag.toast.offersLoadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsLoadingOffers(false);
      }
    };

    if (isOpen && !offerId && !auftrag) {
      fetchApprovedOffers();
    } else {
      setShowOfferSelection(false);
    }
  }, [isOpen, companyId, offerId, auftrag, toast, t]);

  // Handle offer selection from the list
  const handleOfferSelect = (selectedId: string) => {
    setSelectedOfferId(selectedId);
    setShowOfferSelection(false);
    // The existing useEffect will fetch the full offer data
  };

  // Fetch complete offer and lead data when modal opens
  useEffect(() => {
    const fetchOfferData = async () => {
      // Use selectedOfferId if user selected from list, otherwise use prop
      const effectiveOfferId = selectedOfferId || offerId;
      
      if (!effectiveOfferId || auftrag) return; // Skip if editing existing or no offer ID
      
      setIsLoading(true);
      
      try {
        // Fetch offer
        const { data: offerData, error: offerError } = await supabase
          .from("offers")
          .select("*")
          .eq("id", effectiveOfferId)
          .single();
        
        if (offerError) throw offerError;
        setOffer(offerData);
        
        // Fetch offer items
        const { data: itemsData } = await supabase
          .from("offer_items")
          .select("*")
          .eq("offer_id", effectiveOfferId)
          .order("position");
        
        setOfferItems(itemsData || []);
        
        // Fetch lead data
        if (offerData.lead_id) {
          const { data: leadData, error: leadError } = await supabase
            .from("leads")
            .select("*")
            .eq("id", offerData.lead_id)
            .single();
          
          if (!leadError && leadData) {
            setLead(leadData as Lead);
            
            // Build addresses from lead
            const fromAddress = buildAddress(
              leadData.from_street,
              leadData.from_house_number,
              leadData.from_plz,
              leadData.from_city,
              leadData.from_floor,
              leadData.from_has_lift
            );
            
            const toAddress = buildAddress(
              leadData.to_street,
              leadData.to_house_number,
              leadData.to_plz,
              leadData.to_city,
              leadData.to_floor,
              leadData.to_has_lift
            );
            
            // Build service details based on service type
            const serviceDetails = buildServiceDetails(leadData as Lead);
            
            // Pre-populate form with all data
            setFormData({
              title: offerData.title,
              customer_name: `${offerData.customer_first_name} ${offerData.customer_last_name}`,
              customer_email: offerData.customer_email,
              customer_phone: offerData.customer_phone || "",
              from_address: fromAddress,
              to_address: toAddress,
              scheduled_date: offerData.service_date ? new Date(offerData.service_date) : new Date(),
              scheduled_time: "",
              estimated_duration_minutes: leadData.estimated_duration_minutes || 120,
              description: offerData.description || leadData.description || "",
              special_instructions: "",
              internal_notes: "",
              team_leader_id: "",
              assigned_team_members: [],
              reminder_days_before: 1,
              status: "geplant",
              // Pricing from offer
              service_type: leadData.service_type,
              pricing_type: "fixed", // Default to fixed, can be changed to hourly
              hourly_rate: 0,
              subtotal: offerData.subtotal || 0,
              vat_rate: offerData.vat_rate || 8.1,
              vat_amount: offerData.vat_amount || 0,
              total: offerData.total || 0,
              items: itemsData || [],
              extra_services: [],
              service_details: serviceDetails,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching offer data:", error);
        toast({
          title: t("common.error"),
          description: t("auftrag.toast.offerLoadFailed"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && (offerId || selectedOfferId) && !auftrag) {
      fetchOfferData();
    }
  }, [isOpen, offerId, selectedOfferId, auftrag, toast, t]);

  // Initialize form for editing existing auftrag
  useEffect(() => {
    if (auftrag) {
      setFormData({
        title: auftrag.title,
        customer_name: auftrag.customer_name,
        customer_email: auftrag.customer_email || "",
        customer_phone: auftrag.customer_phone || "",
        from_address: auftrag.from_address || "",
        to_address: auftrag.to_address || "",
        scheduled_date: new Date(auftrag.scheduled_date),
        scheduled_time: auftrag.scheduled_time || "",
        estimated_duration_minutes: auftrag.estimated_duration_minutes || 120,
        description: auftrag.description || "",
        special_instructions: auftrag.special_instructions || "",
        internal_notes: auftrag.internal_notes || "",
        team_leader_id: auftrag.team_leader_id || "",
        assigned_team_members: auftrag.assigned_team_members || [],
        reminder_days_before: auftrag.reminder_days_before || 1,
        status: auftrag.status,
        service_type: auftrag.service_type || "",
        pricing_type: auftrag.pricing_type || "fixed",
        hourly_rate: auftrag.hourly_rate || 0,
        subtotal: auftrag.subtotal || 0,
        vat_rate: auftrag.vat_rate || 8.1,
        vat_amount: auftrag.vat_amount || 0,
        total: auftrag.total || 0,
        items: auftrag.items || [],
        extra_services: auftrag.extra_services || [],
        service_details: auftrag.service_details || {},
      });
    } else if (!offerId && !selectedOfferId) {
      // Reset form for new auftrag without offer
      setSelectedOfferId(null);
      setOffer(null);
      setOfferItems([]);
      setLead(null);
      setFormData({
        title: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        from_address: "",
        to_address: "",
        scheduled_date: new Date(),
        scheduled_time: "",
        estimated_duration_minutes: 120,
        description: "",
        special_instructions: "",
        internal_notes: "",
        team_leader_id: "",
        assigned_team_members: [],
        reminder_days_before: 1,
        status: "geplant",
        service_type: "",
        pricing_type: "fixed",
        hourly_rate: 0,
        subtotal: 0,
        vat_rate: 8.1,
        vat_amount: 0,
        total: 0,
        items: [],
        extra_services: [],
        service_details: {},
      });
    }
  }, [auftrag, offerId, selectedOfferId, isOpen]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  // NOT operator chrome: the result is stored in auftraege.from_address / to_address and is
  // later printed on the customer's work order. It must stay in the DATA language, so it is
  // deliberately not routed through useT() (the dashboard locale).
  const buildAddress = (
    street: string | null,
    houseNumber: string | null,
    plz: string | null,
    city: string | null,
    floor: number | null,
    hasLift: boolean | null
  ): string => {
    const parts: string[] = [];
    if (street) {
      parts.push(`${street} ${houseNumber || ""}`.trim());
    }
    if (plz || city) {
      parts.push(`${plz || ""} ${city || ""}`.trim());
    }
    if (floor !== null) {
      parts.push(`${floor}. Stock${hasLift ? " (mit Lift)" : " (ohne Lift)"}`);
    }
    return parts.join("\n");
  };

  const buildServiceDetails = (leadData: Lead): Record<string, unknown> => {
    const details: Record<string, unknown> = {};
    
    switch (leadData.service_type) {
      case "umzug":
        details.from_rooms = leadData.from_rooms;
        details.from_living_space_m2 = leadData.from_living_space_m2;
        details.from_floor = leadData.from_floor;
        details.from_has_lift = leadData.from_has_lift;
        details.to_floor = leadData.to_floor;
        details.to_has_lift = leadData.to_has_lift;
        details.property_type = leadData.property_type;
        details.distance_km = leadData.distance_km;
        details.packing_service_needed = leadData.packing_service_needed;
        details.cleaning_service_needed = leadData.cleaning_service_needed;
        details.storage_needed = leadData.storage_needed;
        details.piano_transport_needed = leadData.piano_transport_needed;
        break;
        
      case "reinigung":
        details.from_rooms = leadData.from_rooms;
        details.from_living_space_m2 = leadData.from_living_space_m2;
        details.bathroom_count = leadData.bathroom_count;
        details.kitchen_type = leadData.kitchen_type;
        details.has_balcony = leadData.has_balcony;
        details.has_garage = leadData.has_garage;
        details.has_basement = leadData.has_basement;
        details.has_attic = leadData.has_attic;
        details.cleaning_windows = leadData.cleaning_windows;
        break;
        
      case "klaviertransport":
        details.piano_type = leadData.piano_type;
        details.piano_weight_kg = leadData.piano_weight_kg;
        details.from_floor = leadData.from_floor;
        details.from_has_lift = leadData.from_has_lift;
        details.to_floor = leadData.to_floor;
        details.to_has_lift = leadData.to_has_lift;
        details.distance_km = leadData.distance_km;
        break;
        
      case "raeumung":
        details.clearing_type = leadData.clearing_type;
        details.estimated_volume = leadData.estimated_volume;
        details.has_heavy_items = leadData.has_heavy_items;
        details.heavy_items_description = leadData.heavy_items_description;
        break;
        
      case "lagerung":
        details.storage_duration = leadData.storage_duration;
        details.storage_volume = leadData.storage_volume;
        break;
    }
    
    return details;
  };

  // "HH:MM" + Minuten → "HH:MM:SS" (für appointment end_time)
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const total = (h * 60 + m + minutes) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}:00`;
  };

  // Schedule-Felder für den kanonischen Termin (appointments) aus dem Formular
  const buildAppointmentSchedule = () => {
    const start = (formData.scheduled_time || "09:00").slice(0, 5);
    const dur = formData.estimated_duration_minutes || 120;
    return {
      appointment_date: format(formData.scheduled_date, "yyyy-MM-dd"),
      start_time: `${start}:00`,
      end_time: addMinutesToTime(start, dur),
      duration_minutes: dur,
    };
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case "umzug":
        return <Truck className="w-4 h-4" />;
      case "reinigung":
        return <Sparkles className="w-4 h-4" />;
      case "klaviertransport":
        return <Piano className="w-4 h-4" />;
      case "raeumung":
        return <Trash2 className="w-4 h-4" />;
      case "lagerung":
        return <Package className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // =============================================================================
  // FORM HANDLERS
  // =============================================================================

  const handleSubmit = async () => {
    if (!companyId) return;

    if (!formData.title || !formData.customer_name || !formData.scheduled_date) {
      toast({
        title: t("common.error"),
        description: t("auftrag.toast.requiredFields"),
        variant: "destructive",
      });
      return;
    }

    // E16: offer_id is required when creating a new Auftrag
    // (this check is skipped in edit mode or when offerId is already provided)
    const resolvedOfferId = selectedOfferId || offerId || auftrag?.offer_id || null;
    if (!auftrag && !resolvedOfferId) {
      toast({
        title: t("auftrag.toast.offerRequired"),
        description: t("auftrag.toast.offerRequiredHint"),
        variant: "destructive",
      });
      return;
    }

    // E-Mail-Format prüfen
    if (formData.customer_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customer_email)) {
        toast({
          title: t("auftrag.toast.invalidEmail"),
          description: t("auftrag.toast.invalidEmailHint"),
          variant: "destructive",
        });
        return;
      }
    }

    // Negative Preise verhindern
    if (formData.pricing_type === "hourly" && (formData.hourly_rate ?? 0) < 0) {
      toast({
        title: t("auftrag.toast.invalidPrice"),
        description: t("auftrag.toast.negativeHourlyRate"),
        variant: "destructive",
      });
      return;
    }
    if (formData.pricing_type === "fixed" && (formData.subtotal ?? 0) < 0) {
      toast({
        title: t("auftrag.toast.invalidPrice"),
        description: t("auftrag.toast.negativePrice"),
        variant: "destructive",
      });
      return;
    }

    // Vergangenes Datum warnen (nur bei Neuanlage)
    if (!auftrag && formData.scheduled_date < new Date(new Date().toDateString())) {
      toast({
        title: t("auftrag.toast.pastDate"),
        description: t("auftrag.toast.pastDateHint"),
        variant: "destructive",
      });
      return;
    }

    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const auftragData = {
        company_id: companyId,
        auftrag_nummer: "", // Will be auto-generated by database trigger
        offer_id: selectedOfferId || offerId || auftrag?.offer_id || null,
        lead_id: offer?.lead_id || auftrag?.lead_id || null,
        title: formData.title,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        from_address: formData.from_address || null,
        to_address: formData.to_address || null,
        scheduled_date: format(formData.scheduled_date, "yyyy-MM-dd"),
        scheduled_time: formData.scheduled_time || null,
        estimated_duration_minutes: formData.estimated_duration_minutes,
        description: formData.description || null,
        special_instructions: formData.special_instructions || null,
        internal_notes: formData.internal_notes || null,
        team_leader_id: formData.team_leader_id || null,
        assigned_team_members: formData.assigned_team_members,
        reminder_days_before: formData.reminder_days_before,
        status: formData.status,
        // Pricing & service data
        service_type: formData.service_type || null,
        pricing_type: formData.pricing_type,
        hourly_rate: formData.pricing_type === "hourly" ? formData.hourly_rate : null,
        subtotal: formData.pricing_type === "hourly" ? null : formData.subtotal,
        vat_rate: formData.vat_rate,
        vat_amount: formData.pricing_type === "hourly" ? null : formData.vat_amount,
        total: formData.pricing_type === "hourly" ? null : formData.total,
        items: formData.items,
        extra_services: formData.extra_services,
        service_details: formData.service_details,
        completed_at: formData.status === "abgeschlossen" ? new Date().toISOString() : null,
      };

      if (auftrag) {
        // Update existing — auftrag_nummer and company_id must NOT be updated.
        const { auftrag_nummer: _nr, company_id: _cid, ...updateData } = auftragData;

        const dateChanged = auftrag.scheduled_date !== auftragData.scheduled_date;

        // Reschedule: if the date changed, reset the reminder flags.
        const rescheduleReset = dateChanged
          ? {
              team_reminder_sent: false,
              reminder_sent_at: null,
              customer_reminder_sent: false,
              customer_reminder_sent_at: null,
            }
          : {};

        // #7 Single source: time (Datum/Zeit/Dauer) lives canonically in appointments.
        // If a linked appointment exists, write the time THERE — a trigger mirrors auftrag.scheduled_*.
        // That is why we strip the schedule fields out of the auftrag update.
        if (auftrag.appointment_id) {
          const { error: apptError } = await supabase
            .from("appointments")
            .update(buildAppointmentSchedule())
            .eq("id", auftrag.appointment_id);
          if (apptError) throw apptError;

          delete (updateData as Record<string, unknown>).scheduled_date;
          delete (updateData as Record<string, unknown>).scheduled_time;
          delete (updateData as Record<string, unknown>).estimated_duration_minutes;
        }

        const { error } = await supabase
          .from("auftraege")
          .update({ ...updateData, ...rescheduleReset })
          .eq("id", auftrag.id);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("auftrag.toast.updated"),
        });
      } else {
        // Create new — jeder aktive Auftrag bekommt einen kanonischen service-Termin.
        const linkedOfferId = auftragData.offer_id;
        let appointmentId: string | null = null;

        // DOCUMENT locale: inherited from the offer (which froze it from the lead), or
        // straight from the lead when the Auftrag is created without an offer. Set at
        // CREATION only — like the offer's frozen fields, it must not silently flip on a
        // later edit (where offer/lead are not even loaded).
        const documentLanguage = toLocale(offer?.language ?? lead?.language);

        // Vorhandenen service-Termin der Offerte wiederverwenden (vom Accept-Flow)
        if (linkedOfferId) {
          const { data: existingAppt } = await supabase
            .from("appointments")
            .select("id")
            .eq("offer_id", linkedOfferId)
            .eq("appointment_type", "service")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          appointmentId = existingAppt?.id ?? null;
        }

        // Sonst neuen service-Termin erstellen
        if (!appointmentId) {
          const schedule = buildAppointmentSchedule();
          const [firstName, ...rest] = formData.customer_name.trim().split(" ");
          const { data: newAppt, error: apptError } = await supabase
            .from("appointments")
            .insert({
              company_id: companyId,
              offer_id: linkedOfferId,
              lead_id: auftragData.lead_id,
              appointment_type: "service",
              status: "pending",
              ...schedule,
              all_day: false,
              location_address: formData.from_address || null,
              customer_first_name: firstName || formData.customer_name,
              customer_last_name: rest.join(" ") || null,
              customer_email: formData.customer_email || null,
              customer_phone: formData.customer_phone || null,
              title: formData.title,
              description: formData.description || null,
              language: documentLanguage,
            })
            .select("id")
            .single();
          if (apptError) throw apptError;
          appointmentId = newAppt.id;
        }

        const { error } = await supabase
          .from("auftraege")
          .insert({ ...auftragData, appointment_id: appointmentId, language: documentLanguage });

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("auftrag.toast.created"),
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving auftrag:", error);
      let errorMessage = t("auftrag.toast.saveFailedDefault");
      if (error && typeof error === "object" && "code" in error) {
        const pgError = error as { code: string; message?: string };
        if (pgError.code === "23503") {
          errorMessage = t("auftrag.toast.saveFailedForeignKey");
        } else if (pgError.code === "23505") {
          errorMessage = t("auftrag.toast.saveFailedDuplicate");
        } else if (pgError.code === "23514") {
          errorMessage = t("auftrag.toast.saveFailedCheck", {
            message: pgError.message || t("auftrag.toast.saveFailedCheckFallback"),
          });
        } else if (pgError.message) {
          errorMessage = pgError.message;
        }
      }
      toast({
        title: t("auftrag.toast.saveFailed"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const toggleTeamMember = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      assigned_team_members: prev.assigned_team_members.includes(memberId)
        ? prev.assigned_team_members.filter((id) => id !== memberId)
        : [...prev.assigned_team_members, memberId],
    }));
  };

  // Visual only — the label comes from getAuftragStatusLabel(value, locale), so the
  // operator's dashboard language decides it (same source as the Aufträge list).
  const statusOptions = [
    { value: "geplant", color: "bg-blue-100 text-blue-700" },
    { value: "bestaetigt", color: "bg-green-100 text-green-700" },
    { value: "in_bearbeitung", color: "bg-amber-100 text-amber-700" },
    { value: "abgeschlossen", color: "bg-emerald-100 text-emerald-700" },
    { value: "storniert", color: "bg-red-100 text-red-700" },
  ];

  // State machine: beim Bearbeiten nur erlaubte Zielstatus anzeigen.
  // Bei Neuanlage nur "geplant" (Aufträge starten immer als geplant).
  // "abgeschlossen" wird hier NICHT angeboten — der Abschluss läuft über den
  // Abschluss-Dialog (erfasst tatsächliche Stunden / Endpreis / Notizen).
  const visibleStatusOptions = auftrag
    ? statusOptions.filter((o) => {
        if (!allowedAuftragTargets(auftrag.status).includes(o.value as never)) return false;
        if (o.value === "abgeschlossen" && auftrag.status !== "abgeschlossen") return false;
        return true;
      })
    : statusOptions.filter((o) => o.value === "geplant");

  // =============================================================================
  // RENDER SERVICE-SPECIFIC DETAILS
  // =============================================================================

  const renderServiceDetails = () => {
    if (!formData.service_type || Object.keys(formData.service_details).length === 0) {
      return null;
    }

    const details = formData.service_details;

    switch (formData.service_type) {
      case "umzug":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {details.from_rooms && (
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                <span>{t("auftrag.details.rooms", { count: details.from_rooms as number })}</span>
              </div>
            )}
            {details.from_living_space_m2 && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span>{details.from_living_space_m2 as number} m²</span>
              </div>
            )}
            {details.distance_km && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>{details.distance_km as number} km</span>
              </div>
            )}
            {details.packing_service_needed && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">{t("auftrag.details.packing")}</Badge>
            )}
            {details.cleaning_service_needed && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">{t("auftrag.details.cleaning")}</Badge>
            )}
            {details.piano_transport_needed && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">{t("auftrag.details.piano")}</Badge>
            )}
          </div>
        );

      case "reinigung":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {details.from_rooms && (
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                <span>{t("auftrag.details.rooms", { count: details.from_rooms as number })}</span>
              </div>
            )}
            {details.from_living_space_m2 && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span>{details.from_living_space_m2 as number} m²</span>
              </div>
            )}
            {details.bathroom_count && (
              <Badge variant="secondary">
                {t("auftrag.details.bathrooms", { count: details.bathroom_count as number })}
              </Badge>
            )}
            {details.cleaning_windows && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">{t("auftrag.details.windows")}</Badge>
            )}
            {details.has_balcony && (
              <Badge variant="secondary">{t("auftrag.details.balcony")}</Badge>
            )}
            {details.has_garage && (
              <Badge variant="secondary">{t("auftrag.details.garage")}</Badge>
            )}
          </div>
        );
        
      case "klaviertransport":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {details.piano_type && (
              <div className="flex items-center gap-2">
                <Piano className="w-4 h-4 text-muted-foreground" />
                <span>{details.piano_type as string}</span>
              </div>
            )}
            {details.piano_weight_kg && (
              <Badge variant="secondary">{details.piano_weight_kg as number} kg</Badge>
            )}
            {details.distance_km && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>{details.distance_km as number} km</span>
              </div>
            )}
          </div>
        );

      case "raeumung":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {details.clearing_type && (
              <Badge variant="secondary">{details.clearing_type as string}</Badge>
            )}
            {details.estimated_volume && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span>{details.estimated_volume as string}</span>
              </div>
            )}
            {details.has_heavy_items && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">{t("auftrag.details.heavyItems")}</Badge>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto [&_*]:pointer-events-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {auftrag
              ? t("auftrag.modal.edit", { number: auftrag.auftrag_nummer })
              : t("auftrag.modal.new")}
          </DialogTitle>
          <DialogDescription>
            {(offerId || selectedOfferId) && offer ? (
              <span className="flex items-center gap-2">
                {t("auftrag.modal.fromOffer")} <strong>{offer.title}</strong>
                {formData.service_type && (
                  <Badge variant="secondary" className="ml-2">
                    {getServiceIcon(formData.service_type)}
                    <span className="ml-1">{getServiceLabel(formData.service_type, locale)}</span>
                  </Badge>
                )}
              </span>
            ) : showOfferSelection ? (
              t("auftrag.modal.selectOffer")
            ) : (
              t("auftrag.modal.createAndAssign")
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Offer Selection Step */}
        {showOfferSelection && !auftrag ? (
          <div className="py-4">
            {isLoadingOffers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-muted-foreground">{t("auftrag.modal.loadingOffers")}</span>
              </div>
            ) : approvedOffers.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">{t("auftrag.modal.noApprovedOffers")}</h3>
                  <p className="text-muted-foreground mt-1">
                    {t("auftrag.modal.noApprovedOffersHint")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("auftrag.modal.manualHint")}
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={onClose}>
                    {t("common.close")}
                  </Button>
                  <Button onClick={() => setShowOfferSelection(false)}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t("auftrag.modal.createManually")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("auftrag.modal.offersAvailable", { count: approvedOffers.length })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOfferSelection(false)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t("auftrag.modal.createManually")}
                  </Button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {approvedOffers.map((approvedOffer) => (
                    <div
                      key={approvedOffer.id}
                      className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
                      onClick={() => handleOfferSelect(approvedOffer.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {approvedOffer.leads && getServiceIcon(approvedOffer.leads.service_type)}
                            <span className="font-medium">{approvedOffer.title}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {approvedOffer.customer_first_name} {approvedOffer.customer_last_name}
                          </div>
                          {approvedOffer.leads && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {approvedOffer.leads.from_city}
                                {approvedOffer.leads.to_city && ` → ${approvedOffer.leads.to_city}`}
                              </span>
                            </div>
                          )}
                          {approvedOffer.service_date && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{format(new Date(approvedOffer.service_date), "dd.MM.yyyy", { locale: dateLocale })}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 mb-2">
                            {t("auftrag.modal.approved")}
                          </Badge>
                          {approvedOffer.total && (
                            <div className="font-bold text-blue-600">
                              {formatCurrency(approvedOffer.total, locale)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
              {/* Pricing Type Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Euro className="w-4 h-4 text-blue-600" />
                    {t("auftrag.pricing.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t("auftrag.pricing.type")}</Label>
                      <Select
                        value={formData.pricing_type}
                        onValueChange={(value: "fixed" | "hourly" | "estimate") =>
                          setFormData((prev) => ({ ...prev, pricing_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-700">{t("auftrag.pricing.fixed")}</Badge>
                            </span>
                          </SelectItem>
                          <SelectItem value="hourly">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700">{t("auftrag.pricing.hourly")}</Badge>
                            </span>
                          </SelectItem>
                          <SelectItem value="estimate">
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">{t("auftrag.pricing.estimate")}</Badge>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.pricing_type === "hourly" && (
                      <div className="space-y-2">
                        <Label>{t("auftrag.pricing.hourlyRate")}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={formData.hourly_rate || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              hourly_rate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder={t("auftrag.pricing.hourlyRatePlaceholder")}
                        />
                      </div>
                    )}

                    {formData.pricing_type === "hourly" && (
                      <div className="flex items-end">
                        <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {t("auftrag.pricing.finalPriceNote")}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Offer Details Section - Only show if creating from offer and fixed/estimate price */}
              {formData.items.length > 0 && formData.pricing_type !== "hourly" && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader 
                    className="pb-3 cursor-pointer"
                    onClick={() => setShowOfferDetails(!showOfferDetails)}
                  >
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Euro className="w-4 h-4 text-blue-600" />
                        {t("auftrag.offerItems.title")}
                      </span>
                      {showOfferDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {showOfferDetails && (
                    <CardContent className="space-y-3">
                      {/* Items table */}
                      <div className="bg-white rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-2 font-medium">{t("common.description")}</th>
                              <th className="text-right p-2 font-medium w-20">{t("common.quantity")}</th>
                              <th className="text-right p-2 font-medium w-24">{t("common.price")}</th>
                              <th className="text-right p-2 font-medium w-24">{t("common.total")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.items.map((item, idx) => (
                              <tr key={item.id || idx} className="border-t">
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                                <td className="p-2 text-right">{formatCurrency(item.unit_price, locale)}</td>
                                <td className="p-2 text-right font-medium">
                                  {formatCurrency(item.total || item.quantity * item.unit_price, locale)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end">
                        <div className="w-64 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>{t("common.subtotal")}:</span>
                            <span>{formatCurrency(formData.subtotal, locale)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("auftrag.vatWithRate", { rate: formData.vat_rate })}:</span>
                            <span>{formatCurrency(formData.vat_amount, locale)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-base">
                            <span>{t("common.total")}:</span>
                            <span className="text-blue-600">{formatCurrency(formData.total, locale)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Extra Services Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600" />
                      {t("auftrag.extras.title")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newService: ExtraService = {
                          id: crypto.randomUUID(),
                          description: "",
                          quantity: 1,
                          unit: "Stk.",
                          unit_price: 0,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          extra_services: [...prev.extra_services, newService],
                        }));
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t("common.add")}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.extra_services.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("auftrag.extras.empty")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formData.extra_services.map((service, idx) => (
                        <div key={service.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                          <div className="col-span-5 space-y-1">
                            <Label className="text-xs">{t("common.description")}</Label>
                            <Input
                              placeholder={t("auftrag.extras.descriptionPlaceholder")}
                              value={service.description}
                              onChange={(e) => {
                                const updated = [...formData.extra_services];
                                updated[idx].description = e.target.value;
                                setFormData((prev) => ({ ...prev, extra_services: updated }));
                              }}
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">{t("common.quantity")}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={service.quantity}
                              onChange={(e) => {
                                const updated = [...formData.extra_services];
                                updated[idx].quantity = parseInt(e.target.value) || 1;
                                setFormData((prev) => ({ ...prev, extra_services: updated }));
                              }}
                            />
                          </div>
                          {/* Unit tokens are DATA: they are stored on the Auftrag row and printed
                              on the customer's work order / receipt, so they stay in the data
                              language and are NOT routed through useT(). */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">{t("common.unit")}</Label>
                            <Select
                              value={service.unit}
                              onValueChange={(value) => {
                                const updated = [...formData.extra_services];
                                updated[idx].unit = value;
                                setFormData((prev) => ({ ...prev, extra_services: updated }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Stk.">Stk.</SelectItem>
                                <SelectItem value="Std.">Std.</SelectItem>
                                <SelectItem value="Pausch.">Pausch.</SelectItem>
                                <SelectItem value="m³">m³</SelectItem>
                                <SelectItem value="km">km</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">{t("auftrag.extras.priceChf")}</Label>
                            <Input
                              type="number"
                              min={0}
                              step={5}
                              value={service.unit_price || ""}
                              onChange={(e) => {
                                const updated = [...formData.extra_services];
                                updated[idx].unit_price = parseFloat(e.target.value) || 0;
                                setFormData((prev) => ({ ...prev, extra_services: updated }));
                              }}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  extra_services: prev.extra_services.filter((_, i) => i !== idx),
                                }));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Service Details Section */}
              {formData.service_type && Object.keys(formData.service_details).length > 0 && (
                <Card>
                  <CardHeader 
                    className="pb-3 cursor-pointer"
                    onClick={() => setShowServiceDetails(!showServiceDetails)}
                  >
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {getServiceIcon(formData.service_type)}
                        {t("auftrag.serviceDetails", {
                          service: getServiceLabel(formData.service_type, locale),
                        })}
                      </span>
                      {showServiceDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {showServiceDetails && (
                    <CardContent>
                      {renderServiceDetails()}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Title & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("auftrag.field.title")}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={t("auftrag.field.titlePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.status")}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStatusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <Badge variant="secondary" className={status.color}>
                            {getAuftragStatusLabel(status.value, locale)}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t("auftrag.field.customerData")}
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder={t("auftrag.field.namePlaceholder")}
                    value={formData.customer_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))}
                  />
                  <Input
                    placeholder={t("common.email")}
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))}
                  />
                  <Input
                    placeholder={t("common.phone")}
                    value={formData.customer_phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    {t("auftrag.field.fromAddress")}
                  </Label>
                  <Textarea
                    placeholder={t("auftrag.field.addressPlaceholder")}
                    rows={3}
                    value={formData.from_address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, from_address: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-600" />
                    {t("auftrag.field.toAddress")}
                  </Label>
                  <Textarea
                    placeholder={t("auftrag.field.addressPlaceholder")}
                    rows={3}
                    value={formData.to_address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, to_address: e.target.value }))}
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {t("auftrag.field.date")}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.scheduled_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.scheduled_date
                          ? format(formData.scheduled_date, "PPP", { locale: dateLocale })
                          : t("common.selectDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.scheduled_date}
                        onSelect={(date) => date && setFormData((prev) => ({ ...prev, scheduled_date: date }))}
                        locale={dateLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t("common.time")}
                  </Label>
                  <Input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("auftrag.field.duration")}</Label>
                  <Select
                    value={formData.estimated_duration_minutes.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        estimated_duration_minutes: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("auftrag.field.durationPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">{t("auftrag.duration.min30")}</SelectItem>
                      <SelectItem value="60">{t("auftrag.duration.h1")}</SelectItem>
                      <SelectItem value="90">{t("auftrag.duration.h1_5")}</SelectItem>
                      <SelectItem value="120">{t("auftrag.duration.h2")}</SelectItem>
                      <SelectItem value="180">{t("auftrag.duration.h3")}</SelectItem>
                      <SelectItem value="240">{t("auftrag.duration.h4")}</SelectItem>
                      <SelectItem value="300">{t("auftrag.duration.h5")}</SelectItem>
                      <SelectItem value="360">{t("auftrag.duration.h6")}</SelectItem>
                      <SelectItem value="420">{t("auftrag.duration.h7")}</SelectItem>
                      <SelectItem value="480">{t("auftrag.duration.h8")}</SelectItem>
                      <SelectItem value="600">{t("auftrag.duration.h10")}</SelectItem>
                      <SelectItem value="720">{t("auftrag.duration.h12")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Team Assignment */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t("auftrag.team.title")}
                </Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t("auftrag.team.leader")}</Label>
                    <Select
                      value={formData.team_leader_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, team_leader_id: value === "none" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("auftrag.team.leaderPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("auftrag.team.noLeader")}</SelectItem>
                        {teamMembers
                          .filter((m) => m.email)
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.first_name} {member.last_name} {member.role && `(${member.role})`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {!teamMembers.some((m) => m.email) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {t("auftrag.team.noEmailWarning")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t("auftrag.team.reminder")}</Label>
                    <Select
                      value={formData.reminder_days_before.toString()}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, reminder_days_before: parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t("auftrag.reminder.d1")}</SelectItem>
                        <SelectItem value="2">{t("auftrag.reminder.d2")}</SelectItem>
                        <SelectItem value="3">{t("auftrag.reminder.d3")}</SelectItem>
                        <SelectItem value="7">{t("auftrag.reminder.w1")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Team Members Selection */}
                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t("auftrag.team.members")}</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                            formData.assigned_team_members.includes(member.id)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                          onClick={() => toggleTeamMember(member.id)}
                        >
                        <Checkbox
                          checked={formData.assigned_team_members.includes(member.id)}
                          onCheckedChange={() => toggleTeamMember(member.id)}
                        />
                          <span className="text-sm">{member.first_name} {member.last_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("common.description")}</Label>
                  <Textarea
                    placeholder={t("auftrag.field.descriptionPlaceholder")}
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("auftrag.field.internalNotes")}</Label>
                  <Textarea
                    placeholder={t("auftrag.field.internalNotesPlaceholder")}
                    rows={3}
                    value={formData.internal_notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, internal_notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  {t("auftrag.field.specialInstructions")}
                </Label>
                <Textarea
                  placeholder={t("auftrag.field.specialInstructionsPlaceholder")}
                  rows={2}
                  className="border-amber-200 focus:border-amber-400"
                  value={formData.special_instructions}
                  onChange={(e) => setFormData((prev) => ({ ...prev, special_instructions: e.target.value }))}
                />
              </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {auftrag ? t("common.save") : t("auftrag.action.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
