import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputCH } from "@/components/ui/date-input-ch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  FileText,
  Plus,
  Send,
  Save,
  Loader2,
  User,
  ArrowLeft,
  Eye,
  Building2,
  PackagePlus,
  Info,
  ClipboardList,
  Calculator,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  CalendarDays,
  Home,
  Package,
  Ruler,
  MessageSquare,
  CheckCircle,
  Route,
  AlertCircle,
} from "lucide-react";
import { MovingCalculatorWithLead, CalculationResult, formatCHF as formatCalculatorCHF, formatTime } from "@/components/offers/moving-calculator";
import { useEffect, useState, useCallback, useRef } from "react";
import { useCompanyPricing } from "@/hooks/useCompanyPricing";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import { normalizeToCatalogBase, groupItemsByService } from "@/lib/offerServiceType";
import { formatFloorLabel } from "@/lib/floorUtils";
import type { ServiceItem } from "@/types/leistungskatalog";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { sendOffer } from "@/lib/sendOffer";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { OfferteItemRow, type OfferItem, type ItemTimeEstimate } from "@/components/offerte/OfferteItemRow";
import { ServiceMetaFields } from "@/components/offerte/ServiceMetaFields";
import { metaKindForService, buildMetaPayload, EMPTY_META_DRAFT, type GroupMetaDraft } from "@/lib/offerItemMeta";
import { ItemChip } from "@/components/offerte/ItemChip";
import { OfferteLivePreview } from "@/components/offerte/OfferteLivePreview";
import { SurchargeEditor } from "@/components/offerte/SurchargeEditor";
import { computeSurchargeAmount, surchargesTotal, withComputedAmounts, type OfferSurcharge } from "@/lib/offerSurcharges";
import { applyDiscount, computeDiscountAmount, computeItemsSubtotal, derivePriceTypeFromCatalog, defaultAmountBasisForPriceType, isFreeItem, offerHasRateItem, type SubtotalItem, RATE_AGGREGATE_NOTE } from "@/lib/offerPricing";
import { ServiceDetailsSection } from "@/components/offerte/ServiceDetailsSection";
import { CatalogServiceSelector } from "@/components/offerte/CatalogServiceSelector";
import { BesichtigungAIPanel, type AIOfferItem } from "@/components/offerte/BesichtigungAIPanel";
import { OfferteDetailsSection, DEFAULT_OFFER_DETAILS } from "@/components/offerte/OfferteDetailsSection";
import SpellCheckModal from "@/components/offerte/SpellCheckModal";
import { runSpellCheck, type SpellCheckFields } from "@/lib/spellCheckService";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Company {
  id: string;
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email: string;
  website?: string | null;
  mwst_number?: string | null;
  logo_url?: string | null;
  default_terms_and_conditions?: string | null;
  default_payment_terms?: string | null;
}

interface Lead {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz: string;
  from_city: string;
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
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  property_type?: string | null;
  packing_service_needed?: boolean | null;
  cleaning_service_needed?: boolean | null;
  storage_needed?: boolean | null;
  piano_transport_needed?: boolean | null;
  description?: string | null;
  // Distance info
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  // Reinigung fields
  bathroom_count?: number | null;
  kitchen_type?: string | null;
  has_balcony?: boolean | null;
  has_garage?: boolean | null;
  has_basement?: boolean | null;
  has_attic?: boolean | null;
  // Räumung fields
  clearing_type?: string | null;
  estimated_volume?: string | null;
  has_heavy_items?: boolean | null;
  heavy_items_description?: string | null;
  // Entsorgung fields
  disposal_type?: string | null;
  items_description?: string | null;
  // Lagerung fields
  storage_duration?: string | null;
  storage_volume?: string | null;
  access_frequency?: string | null;
  needs_climate_control?: boolean | null;
  storage_items_description?: string | null;
  // Klaviertransport fields
  piano_type?: string | null;
  piano_brand?: string | null;
  piano_weight_kg?: number | null;
  staircase_type?: string | null;
  staircase_width_cm?: number | null;
  staircase_turns?: number | null;
  window_access_possible?: boolean | null;
  // Möbellift fields
  moebellift_floor?: number | null;
  moebellift_item_description?: string | null;
  moebellift_item_dimensions?: string | null;
  // Others
  special_items?: string[] | null;
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_floor?: number | null;
  pickup_has_lift?: boolean | null;
  // Detailed wizard form data
  detailed_form_data?: Record<string, unknown> | null;
  form_version?: number | null;
  cleaning_windows?: boolean | null;
  // Source tracking
  source?: string | null;
  status?: string | null;
}

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createEmptyItem = (position: number): OfferItem => ({
  id: generateItemId(),
  position,
  description: "",
  quantity: 1,
  unit: "Pauschal",
  unit_price: 0,
  priceType: "pauschale",
  highlighted: false,
  details: [],
  serviceType: null, // default Allgemein; the real primary-base is set in addItem in 2.3
});

/** Gültig bis kürzer als 7 Tage ab heute — nur Hinweis im Formular */
const isValidUntilShorterThanSevenDays = (isoDate: string): boolean => {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const end = new Date(y, m - 1, d);
  const min = new Date();
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + 7);
  end.setHours(0, 0, 0, 0);
  return end < min;
};

const FirmaOfferteErstellen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("lead");
  const distributionId = searchParams.get("distribution");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);

  // Company-specific pricing configuration
  const { pricingConfig, loadConfig: loadPricingConfig } = useCompanyPricing();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [vatRate, setVatRate] = useState(8.1);
  const [mwstEnabled, setMwstEnabled] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("Barzahlung nach der Ausführung");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [items, setItems] = useState<OfferItem[]>([]);

  // Leistungsübersicht state
  const [selectedLeistungen, setSelectedLeistungen] = useState<Array<{ id: string; name: string; category?: string }>>([]);
  const [excludedLeistungen, _setExcludedLeistungen] = useState<string[]>([]);
  const [leistungNotes, _setLeistungNotes] = useState("");
  // Track only IDs explicitly added via catalog in this session (for "Bereits hinzugefügt")
  const [catalogAddedIds, setCatalogAddedIds] = useState<Set<string>>(new Set());

  // AGB sections state
  const [, setAgbSections] = useState<Array<{ title: string; content: string }>>([]);

  // Optional services state
  const [optionalServices, setOptionalServices] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());
  const [showOptionalDialog, setShowOptionalDialog] = useState(false);

  // Catalog selector state
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);
  // AGB section collapsed by default
  const [showAgb, setShowAgb] = useState(false);

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    bar: "Barzahlung nach der Ausführung",
    rechnung_14: "Zahlung innerhalb 14 Tagen netto",
    rechnung_30: "Zahlung innerhalb 30 Tagen netto",
    twint: "TWINT – Zahlung nach Ausführung",
    vorauskasse: "Vorauskasse vor dem Termin",
    teilzahlung: "50% Anzahlung vor dem Termin, Rest nach Ausführung",
  };

  // Enhanced offer details state
  const [offerDetails, setOfferDetails] = useState(DEFAULT_OFFER_DETAILS);

  // Spell check state
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [spellCheckOpen, setSpellCheckOpen] = useState(false);
  const [spellCheckOriginal, setSpellCheckOriginal] = useState<SpellCheckFields>({});
  const [spellCheckCorrected, setSpellCheckCorrected] = useState<SpellCheckFields>({});
  // pendingSpellSave stores the sendAfterSave arg so we can continue after modal
  const pendingSpellSaveRef = useRef<boolean>(false);
  // Ref to handleSave — lets spell-check callbacks call it without causing a TDZ error
  // (handleSave is defined later in the file, but ref is initialised immediately)
  const handleSaveRef = useRef<(sendAfterSave?: boolean) => void>(() => {});

  const handleOfferDetailsChange = (newDetails: typeof DEFAULT_OFFER_DETAILS) => {
    setOfferDetails(newDetails);
    // Auto-fill paymentTerms when paymentMethod changes
    if (newDetails.paymentMethod !== offerDetails.paymentMethod && newDetails.paymentMethod) {
      const label = PAYMENT_METHOD_LABELS[newDetails.paymentMethod];
      if (label) setPaymentTerms(label);
    }
  };
  const [offerNumber, setOfferNumber] = useState<number | undefined>(undefined);

  // Price model state
  const [priceModel, setPriceModel] = useState<'pauschal' | 'stundenansatz' | 'kostendach'>('pauschal');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [kostendachMax, setKostendachMax] = useState<string>('');
  // Offer-level Rabatt (%). F1a: only captured+saved; totals integration is F3.
  const [discountPercent, setDiscountPercent] = useState<string>('');
  // Per-service dates (multi-service offers): ONE date per service group, keyed by the
  // normalized service key. On save the value is copied to every item of the group
  // (invariant: all items of a group carry the same scheduled_* values).
  const [groupDates, setGroupDates] = useState<Record<string, { date: string; startTime: string; endTime: string }>>({});

  const serviceGroupKey = (serviceType: string | null | undefined): string => {
    const raw = (serviceType ?? "").trim().toLowerCase();
    return raw === "" ? "null" : raw;
  };

  const updateGroupDate = (key: string, field: "date" | "startTime" | "endTime", value: string) => {
    setGroupDates((prev) => ({
      ...prev,
      [key]: { date: "", startTime: "", endTime: "", ...prev[key], [field]: value },
    }));
  };

  // Per-group service meta (effort/area/volume) — shares the group-keyed pattern of
  // groupDates; attached to the group's first billable item at save (replace_offer_items).
  const [groupMeta, setGroupMeta] = useState<Record<string, GroupMetaDraft>>({});
  const updateGroupMeta = (key: string, patch: Partial<GroupMetaDraft>) => {
    setGroupMeta((prev) => ({
      ...prev,
      [key]: { ...EMPTY_META_DRAFT, ...prev[key], ...patch },
    }));
    // Top-down: the group's Stundensatz is the single hourly rate — fill each group item's
    // pricing rate (Zeitschätzung CHF/Std, or per_hour Preis/Einheit) so it isn't re-typed.
    if (patch.hourlyRate !== undefined && patch.hourlyRate.trim() !== "") {
      const rate = patch.hourlyRate;
      const n = Number(rate.replace(",", "."));
      setItems((prev) =>
        prev.map((it) => {
          if (serviceGroupKey(it.serviceType) !== key) return it;
          if (it.timeEstimate) return { ...it, timeEstimate: { ...it.timeEstimate, hourlyRate: rate } };
          if (it.priceType === "per_hour" && Number.isFinite(n)) return { ...it, unit_price: n, amountBasis: "rate" as const };
          return it;
        }),
      );
    }
  };

  // Offer-level Stundenansatz (Preismodell) — same top-down idea, offer-wide: fills every
  // hourly position (Zeitschätzung / per_hour) AND mirrors into each effort group's
  // Service-Details Stundensatz, so the single rate drives price and PDF badge alike.
  const applyGlobalHourlyRate = (value: string) => {
    setHourlyRate(value);
    if (value.trim() === "") return;
    const n = Number(value.replace(",", "."));
    setItems((prev) =>
      prev.map((it) => {
        if (it.timeEstimate) return { ...it, timeEstimate: { ...it.timeEstimate, hourlyRate: value } };
        if (it.priceType === "per_hour" && Number.isFinite(n)) return { ...it, unit_price: n, amountBasis: "rate" as const };
        return it;
      }),
    );
    setGroupMeta((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (metaKindForService(it.serviceType) !== "effort") continue;
        const k = serviceGroupKey(it.serviceType);
        next[k] = { ...EMPTY_META_DRAFT, ...next[k], hourlyRate: value };
      }
      return next;
    });
  };
  const [surcharges, setSurcharges] = useState<OfferSurcharge[]>([]);
  const [briefLayout, setBriefLayout] = useState<boolean>(false);
  const [offerteType, setOfferteType] = useState<'normal' | 'blind'>('normal');

  // Moving Calculator state
  const [showMovingCalculator, setShowMovingCalculator] = useState(false);
  const [calculatorResult, setCalculatorResult] = useState<CalculationResult | null>(null);
  const [pendingCalculatorResult, setPendingCalculatorResult] = useState<CalculationResult | null>(null);
  const [showCalculatorReplaceDialog, setShowCalculatorReplaceDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !leadId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get company
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name, street, house_number, plz, city, phone, email, website, mwst_number, logo_url, default_terms_and_conditions, default_payment_terms",
        });

        if (!companyData) {
          navigate("/firma");
          return;
        }
        setCompany(companyData);

        // Load company-specific pricing configuration
        loadPricingConfig(companyData.id);

        // Get lead with all fields
        // First try direct fetch, then fallback via distribution (ensures company access)
        const { data: directLead, error: directError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .maybeSingle();

        if (directError) {
          console.error("Lead fetch error:", directError);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let leadData: any = directLead ?? null;

        if (!leadData && distributionId) {
          // Fallback: fetch lead via distribution join (ensures company has access to this lead)
          const { data: distData } = await supabase
            .from("lead_distributions")
            .select("lead:leads(*)")
            .eq("id", distributionId)
            .eq("company_id", companyData.id)
            .maybeSingle();

          const joinedLead = distData?.lead;
          if (joinedLead && !Array.isArray(joinedLead)) {
            leadData = joinedLead;
          }
        }

        if (!leadData) {
          toast({
            title: "Anfrage nicht gefunden",
            description: "Die Anfrage konnte nicht geladen werden. Bitte gehen Sie zu den Anfragen zurück.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        setLead(leadData as Lead);

        // Set default title based on service type - comprehensive mapping
        const serviceLabels: Record<string, string> = {
          // Umzug
          umzug: "Umzugsofferte",
          umzug_privat: "Privatumzug",
          umzug_buero: "Büroumzug",
          umzug_firmen: "Firmenumzug",

          // Reinigung - alle Varianten
          reinigung: "Reinigungsofferte",
          reinigung_end: "Übergabereinigung",
          reinigung_bau: "Baureinigung",
          reinigung_unterhalts: "Unterhaltsreinigung",
          reinigung_glas: "Glasreinigung",
          reinigung_fassade: "Fassadenreinigung",
          reinigung_teppich: "Teppichreinigung",
          reinigung_praxis: "Praxisreinigung",
          cleaning: "Reinigungsofferte",

          // Räumung/Entsorgung
          raeumung: "Räumungsofferte",
          raeumung_haushalt: "Haushaltsauflösung",
          raeumung_todesfall: "Todesfallräumung",
          raeumung_messie: "Messieräumung",
          raeumung_zwang: "Zwangsräumung",
          entsorgung: "Entsorgungsofferte",
          entrümpelung: "Entrümpelungsofferte",

          // Lagerung
          lagerung: "Lagerungsofferte",
          storage: "Lagerungsofferte",

          // Spezialtransporte
          klaviertransport: "Klaviertransport-Offerte",
          piano: "Klaviertransport-Offerte",
          klavier: "Klaviertransport-Offerte",

          // Möbellift
          moebellift: "Möbellift-Offerte",
          moebellift_mieten: "Möbellift-Mietofferte",
          lift: "Möbellift-Offerte",

          // Möbeltransport
          moebeltransport: "Möbeltransport-Offerte",
          furniture: "Möbeltransport-Offerte",

          // Malerarbeiten
          maler: "Malerofferte",
          malerarbeit: "Malerofferte",
          painting: "Malerofferte",
        };

        // Generate professional title with location if available
        const baseTitle = serviceLabels[leadData.service_type] || serviceLabels[leadData.service_type?.toLowerCase()] || "Offerte";
        let generatedTitle = baseTitle;

        // Add location for Umzug (use "nach" instead of "→" for PDF compatibility)
        if (leadData.service_type?.includes('umzug') && leadData.from_city && leadData.to_city) {
          generatedTitle = `${baseTitle} ${leadData.from_city} nach ${leadData.to_city}`;
        } else if (leadData.from_city) {
          generatedTitle = `${baseTitle} in ${leadData.from_city}`;
        }

        setTitle(generatedTitle);

        if (leadData.preferred_date) {
          setServiceDate(leadData.preferred_date);
          // Offer validity = 14 days before service date (customer must decide in time),
          // but never in the past — minimum today + 3 days.
          const svcDate = new Date(leadData.preferred_date);
          const validity = new Date(svcDate);
          validity.setDate(validity.getDate() - 14);
          const minValidity = new Date();
          minValidity.setDate(minValidity.getDate() + 3);
          setValidUntil((validity > minValidity ? validity : minValidity).toISOString().split("T")[0]);
        } else {
          // Fallback for offers without a fixed execution date.
          const validDate = new Date();
          validDate.setDate(validDate.getDate() + 14);
          setValidUntil(validDate.toISOString().split("T")[0]);
        }

        // Fetch service-specific template if exists
        const { data: serviceTemplate } = await supabase
          .from("company_offer_templates")
          .select("*")
          .eq("company_id", companyData.id)
          .eq("service_type", leadData.service_type)
          .maybeSingle();

        // Pre-fill terms and conditions (service-specific takes priority)
        if (serviceTemplate?.terms_and_conditions) {
          setTermsAndConditions(serviceTemplate.terms_and_conditions);
        } else if (companyData.default_terms_and_conditions) {
          setTermsAndConditions(companyData.default_terms_and_conditions);
        }

        // Pre-fill payment terms (service-specific takes priority)
        if (serviceTemplate?.payment_terms) {
          setPaymentTerms(serviceTemplate.payment_terms);
        } else if (companyData.default_payment_terms) {
          setPaymentTerms(companyData.default_payment_terms);
        }

        // Fetch company service items for automatic offer item creation
        const { data: _serviceItems } = await supabase
          .from("company_service_items")
          .select("*")
          .eq("company_id", companyData.id)
          .eq("service_type", leadData.service_type)
          .eq("is_default_included", true)
          .order("category")
          .order("display_order");

        // Note: Items are NOT auto-populated anymore.
        // User manually adds positions via "+ Position hinzufügen" button which opens the catalog.
        // Service items from catalog are available via the CatalogServiceSelector dialog.

        // Keep serviceItems query for optional services dialog (future feature)
        // but don't auto-add them to the offer

        // Fetch AGB sections for this service type (normalize for lookup)
        const normalizedServiceType = normalizeServiceTypeForAgb(leadData.service_type);
        const { data: agbData } = await supabase
          .from("agb_sections")
          .select("*")
          .eq("company_id", companyData.id)
          .eq("service_type", normalizedServiceType)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (agbData && agbData.length > 0) {
          setAgbSections(agbData);
          // Clear text-based terms if we have structured sections
          setTermsAndConditions("");
        }

        // Auto-select default included services for Leistungsübersicht
        const { data: allServiceItems } = await supabase
          .from("company_service_items")
          .select("*")
          .eq("company_id", companyData.id)
          .eq("service_type", leadData.service_type)
          .order("category")
          .order("display_order");

        if (allServiceItems && allServiceItems.length > 0) {
          const defaultIncluded = allServiceItems
            .filter(item => item.is_default_included)
            .map(item => ({
              id: item.id,
              name: item.name,
              description: item.description,
              category: item.category,
            }));
          setSelectedLeistungen(defaultIncluded);

          // Store optional services for later selection
          const optionalItems = allServiceItems.filter(item => item.is_optional && !item.is_default_included);
          setOptionalServices(optionalItems);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, leadId, navigate, toast, loadPricingConfig, distributionId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0 || title.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [items, title]);

  // Multi-service: the offer's primary base (from the lead). Sourceless paths are stamped with it (D-C).
  const primaryBase = normalizeToCatalogBase(lead?.service_type ?? null);

  const addItem = () => {
    setItems([...items, { ...createEmptyItem(items.length + 1), serviceType: primaryBase }]);
  };

  // Handle AI Besichtigung items → inject as offer positions
  const handleAIItems = useCallback((aiItems: AIOfferItem[]) => {
    const newItems: OfferItem[] = aiItems.map((ai, idx) => ({
      id: generateItemId(),
      position: items.length + idx + 1,
      description: ai.description,
      quantity: ai.quantity,
      unit: ai.unit || "Stück",
      unit_price: 0, // User fills price manually
      priceType: "pauschale" as const,
      highlighted: false,
      details: ai.note ? [ai.note] : [],
      // D-B: if there is an AI category, reduce to the clean base; if unrecognized, use primary.
      serviceType: ai.category ? (normalizeToCatalogBase(ai.category) ?? primaryBase) : primaryBase,
    }));
    setItems(prev => [...prev, ...newItems]);
  }, [items.length, primaryBase]);

  // Handle Moving Calculator result - convert to offer items
  const handleCalculatorResult = (result: CalculationResult) => {
    if (items.length > 0) {
      // Ask user whether to replace or append
      setPendingCalculatorResult(result);
      setShowCalculatorReplaceDialog(true);
    } else {
      applyCalculatorItemsFromResult(result, true);
    }
  };

  const applyCalculatorItemsFromResult = (result: CalculationResult, replace: boolean) => {
    const newItems: OfferItem[] = [];
    let position = replace ? 0 : items.length;

    const vehicleNames: Record<string, string> = {
      transporter: 'Transporter', truck_3_5t: 'LKW 3.5t',
      truck_7_5t: 'LKW 7.5t', truck_18t: 'LKW 18t',
    };

    const descriptionLines = [
      `Umzugsservice mit ${vehicleNames[result.recommendedVehicle]} und ${result.recommendedCrew} Mitarbeiter`,
      `• Volumen: ${result.netVolume.toFixed(1)} m³`,
      `• Geschätzte Arbeitszeit: ${formatTime(result.timeBreakdown.totalTime)}`,
      `• Tragezeit: ${formatTime(result.timeBreakdown.carryingTime)}`,
      `• Montage/Demontage: ${formatTime(result.timeBreakdown.assemblyTime)}`,
      `• Fahrzeit: ${formatTime(result.timeBreakdown.drivingTime)}`,
      `• Pufferzeit: ${formatTime(result.timeBreakdown.bufferTime)}`,
    ];

    newItems.push({
      id: generateItemId(), position: ++position,
      description: descriptionLines.join('\n'),
      quantity: 1, unit: "Pauschale",
      unit_price: result.costBreakdown.laborCost + result.costBreakdown.vehicleCost,
      priceType: "pauschale", highlighted: true, details: [],
      serviceType: primaryBase,
    });

    if (result.costBreakdown.distanceSurcharge > 0) {
      newItems.push({
        id: generateItemId(), position: ++position,
        description: `Distanz-Zuschlag (${result.movingDetails.distanceKm} km)`,
        quantity: 1, unit: "Pauschale", unit_price: result.costBreakdown.distanceSurcharge,
        priceType: "pauschale", highlighted: false, details: [],
        serviceType: primaryBase,
      });
    }
    if (result.extraServices.packingService) newItems.push({ id: generateItemId(), position: ++position, description: "Verpackungsservice", quantity: 1, unit: "Pauschale", unit_price: result.netVolume * (pricingConfig?.packingServiceRate ?? 50), priceType: "pauschale", highlighted: false, details: ["Professionelles Verpacken Ihres Umzugsguts"], serviceType: primaryBase });
    if (result.extraServices.externalLift) newItems.push({ id: generateItemId(), position: ++position, description: "Außenlift / Möbellift", quantity: 1, unit: "Pauschale", unit_price: pricingConfig?.externalLiftCost ?? 600, priceType: "pauschale", highlighted: false, details: [], serviceType: "umzug" });
    if (result.extraServices.disposal) newItems.push({ id: generateItemId(), position: ++position, description: "Entsorgung / Sperrgut", quantity: 1, unit: "Pauschale", unit_price: pricingConfig?.disposalCost ?? 300, priceType: "pauschale", highlighted: false, details: [], serviceType: "entsorgung" });
    if (result.extraServices.pianoTransport) newItems.push({ id: generateItemId(), position: ++position, description: "Klaviertransport", quantity: 1, unit: "Pauschale", unit_price: pricingConfig?.pianoTransportCost ?? 400, priceType: "pauschale", highlighted: false, details: ["Spezialtransport für Klavier/Flügel"], serviceType: "transport" });
    if (result.extraServices.storage) newItems.push({ id: generateItemId(), position: ++position, description: `Zwischenlagerung (${result.netVolume.toFixed(1)} m³)`, quantity: 1, unit: "Pauschale", unit_price: result.netVolume * (pricingConfig?.storageCostPerM3 ?? 80), priceType: "pauschale", highlighted: false, details: ["Sichere Lagerung Ihres Umzugsguts"], serviceType: "lagerung" });

    setItems(replace ? newItems : [...items, ...newItems]);
    setCalculatorResult(result);
    setShowMovingCalculator(false);
    setPendingCalculatorResult(null);
    setShowCalculatorReplaceDialog(false);

    toast({
      title: "Kalkulation übernommen",
      description: `${newItems.length} Position${newItems.length > 1 ? 'en' : ''} ${replace ? 'ersetzt' : 'hinzugefügt'}.`,
    });
  };

  const handleCalculatorDialogChoice = (replace: boolean) => {
    if (pendingCalculatorResult) {
      applyCalculatorItemsFromResult(pendingCalculatorResult, replace);
    }
  };

  // Add services from catalog selector
  const handleCatalogServicesSelected = (services: ServiceItem[]) => {
    if (services.length === 0) return;

    const newItems: OfferItem[] = services.map((service, index) => {
      const pt = derivePriceTypeFromCatalog(service);
      return {
        id: generateItemId(),
        position: items.length + index + 1,
        description: service.name + (service.description ? `\n${service.description}` : ""),
        quantity: 1,
        unit: service.unit || "Pauschale",
        unit_price: service.default_price || 0,
        priceType: pt,
        // per_hour (Stundenansatz) → rate: nicht in der Summe, zeigt "CHF X / Std".
        amountBasis: defaultAmountBasisForPriceType(pt),
        highlighted: false,
        details: [],
        // A catalog row's service_type may be RAW → reduce to the clean base (Lesson #2); otherwise primary.
        serviceType: normalizeToCatalogBase(service.service_type) ?? primaryBase,
      };
    });

    setItems([...items, ...newItems]);

    // Track explicitly added IDs so catalog shows them as "Bereits hinzugefügt"
    setCatalogAddedIds(prev => {
      const next = new Set(prev);
      services.forEach(s => next.add(s.id));
      return next;
    });

    // Also add to Leistungsübersicht if not already there
    const newLeistungen = services
      .filter(s => !selectedLeistungen.find(l => l.id === s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
      }));

    if (newLeistungen.length > 0) {
      setSelectedLeistungen([...selectedLeistungen, ...newLeistungen]);
    }

    toast({
      title: "Leistungen hinzugefügt",
      description: `${services.length} Leistung${services.length > 1 ? 'en' : ''} wurde${services.length > 1 ? 'n' : ''} zur Offerte hinzugefügt.`,
    });
  };

  const toggleOptionalService = (serviceId: string) => {
    setSelectedOptionalIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const addSelectedOptionalServices = () => {
    const servicesToAdd = optionalServices.filter(s => selectedOptionalIds.has(s.id));

    if (servicesToAdd.length === 0) {
      toast({
        title: "Keine Auswahl",
        description: "Bitte wählen Sie mindestens eine optionale Leistung aus.",
        variant: "destructive",
      });
      return;
    }

    const newItems: OfferItem[] = servicesToAdd.map((item, index) => {
      const pt = derivePriceTypeFromCatalog(item);
      return {
        id: generateItemId(),
        position: items.length + index + 1,
        description: item.name + (item.description ? `\n${item.description}` : ""),
        quantity: 1,
        unit: item.unit || "Pauschale",
        unit_price: item.default_price || 0,
        priceType: pt,
        amountBasis: defaultAmountBasisForPriceType(pt),
        highlighted: false,
        details: [],
        // An optional catalog item's service_type may be RAW → clean base (Lesson #2); otherwise primary.
        serviceType: normalizeToCatalogBase(item.service_type) ?? primaryBase,
      };
    });

    setItems([...items, ...newItems]);

    // Also add to Leistungsübersicht
    const newLeistungen = servicesToAdd.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
    }));
    setSelectedLeistungen([...selectedLeistungen, ...newLeistungen]);

    // Remove added services from optional list
    setOptionalServices(prev => prev.filter(s => !selectedOptionalIds.has(s.id)));
    setSelectedOptionalIds(new Set());
    setShowOptionalDialog(false);

    toast({
      title: "Leistungen hinzugefügt",
      description: `${servicesToAdd.length} optionale Leistung${servicesToAdd.length > 1 ? 'en' : ''} wurde${servicesToAdd.length > 1 ? 'n' : ''} hinzugefügt.`,
    });
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  const updateItem = useCallback((index: number, field: keyof OfferItem, value: unknown) => {
    setItems((prev) => {
      const newItems = [...prev];
      let v = value;
      // A freshly added Zeitschätzung inherits the known Stundensatz (global Preismodell
      // rate, else the group's Service-Details rate). Without this the top-down fill only
      // works for fields that already exist when the rate is typed — ordering trap.
      if (field === "timeEstimate" && v && typeof v === "object" && !(v as ItemTimeEstimate).hourlyRate) {
        const seed =
          (priceModel === "stundenansatz" || priceModel === "kostendach") && hourlyRate.trim() !== ""
            ? hourlyRate
            : groupMeta[serviceGroupKey(prev[index]?.serviceType)]?.hourlyRate ?? "";
        if (seed.trim() !== "") v = { ...(v as ItemTimeEstimate), hourlyRate: seed };
      }
      newItems[index] = { ...newItems[index], [field]: v };
      return newItems;
    });
  }, [priceModel, hourlyRate, groupMeta]);

  const addDetail = (itemIndex: number) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        details: [...newItems[itemIndex].details, ""],
      };
      return newItems;
    });
  };

  const updateDetail = (itemIndex: number, detailIndex: number, value: string) => {
    setItems((prev) => {
      const newItems = [...prev];
      const newDetails = [...newItems[itemIndex].details];
      newDetails[detailIndex] = value;
      newItems[itemIndex] = { ...newItems[itemIndex], details: newDetails };
      return newItems;
    });
  };

  const removeDetail = (itemIndex: number, detailIndex: number) => {
    setItems((prev) => {
      const newItems = [...prev];
      const newDetails = newItems[itemIndex].details.filter((_, i) => i !== detailIndex);
      newItems[itemIndex] = { ...newItems[itemIndex], details: newDetails };
      return newItems;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    // F2: items render grouped by service (one Droppable per group, droppableId = `group-<key>`).
    // Only within-group reordering is supported — cross-group drag is out of scope.
    if (source.droppableId !== destination.droppableId || source.index === destination.index) return;

    const key = source.droppableId.replace(/^group-/, "");

    setItems((prev) => {
      const byId = new Map(prev.map((it) => [it.id, it]));
      const groups = groupItemsByService(
        prev.map((it) => ({ ...it, service_type: it.serviceType ?? null })),
      );
      // Rebuild the flat list in grouped visual order (billable rows first, then free chips),
      // moving the dragged item inside its own group's billable list.
      const rebuilt: OfferItem[] = [];
      for (const group of groups) {
        const groupKey = group.serviceType ?? "null";
        const billable = group.items
          .filter((it) => !isFreeItem(it.priceType))
          .map((it) => byId.get(it.id)!);
        const free = group.items
          .filter((it) => isFreeItem(it.priceType))
          .map((it) => byId.get(it.id)!);
        if (groupKey === key && source.index < billable.length) {
          const [moved] = billable.splice(source.index, 1);
          billable.splice(destination.index, 0, moved);
        }
        rebuilt.push(...billable, ...free);
      }
      return rebuilt.map((item, i) => ({ ...item, position: i + 1 }));
    });
  };

  // Convert the form item shape (timeEstimate string) into the helper's SubtotalItem (in the parse map).
  const toSubtotalItems = (): SubtotalItem[] =>
    items.map((item) => ({
      priceType: item.priceType,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      timeEstimate: item.timeEstimate
        ? {
            minHours: parseFloat(item.timeEstimate.minHours),
            maxHours: parseFloat(item.timeEstimate.maxHours),
            hourlyRate: parseFloat(item.timeEstimate.hourlyRate),
          }
        : null,
      amountBasis: item.amountBasis ?? null,
    }));

  const calculateSubtotal = () => computeItemsSubtotal(toSubtotalItems(), "min");

  // Blind/Stunden-Spanne (nur fixed+range). rate-Posten → gar keine Aggregatsumme (Box ausgeblendet).
  const calculateMaxSubtotal = (): number | null => {
    const hasAny = items.some(i => i.timeEstimate && i.timeEstimate.maxHours && i.timeEstimate.hourlyRate);
    if (!hasAny) return null;
    return computeItemsSubtotal(toSubtotalItems(), "max");
  };

  const hasRateItem = () => offerHasRateItem(toSubtotalItems());

  // Steuerbare Basis = Positionen + Zuschläge. Entspricht offers.subtotal →
  // GENERATED vat_amount/total (subtotal * vat_rate / 100). Vorschau = gespeicherte Offerte.
  // P3b-2b: EINZIGE Parse-Quelle für den Offerten-Rabatt — Preview und Save (P3b-1)
  // leiten sich vom selben Wert ab (kein doppeltes Parsen).
  const parsedDiscountPercent = discountPercent.trim() !== "" ? Number(discountPercent) : null;

  const calculateTaxableBase = () =>
    calculateSubtotal() + surchargesTotal(surcharges, calculateSubtotal(), lead?.distance_km ?? null);


  // P3b-2b: MwSt/Total im Live-Preview rechnen ab der RABATTIERTEN Basis — exakt das, was
  // der Save-Flow (P3b-1) nach offers.subtotal schreibt. Die Zwischensumme bleibt ROH;
  // die sichtbare Rabatt-Zeile folgt in P3b-2c.
  const calculateDiscountedBase = () => applyDiscount(calculateTaxableBase(), parsedDiscountPercent);

  const calculateVat = () => {
    if (!mwstEnabled) return 0;
    return calculateDiscountedBase() * (vatRate / 100);
  };

  const calculateMaxTaxableBase = (): number | null => {
    const maxSub = calculateMaxSubtotal();
    if (maxSub === null) return null;
    return maxSub + surchargesTotal(surcharges, maxSub, lead?.distance_km ?? null);
  };

  const calculateMaxDiscountedBase = (): number | null => {
    const maxBase = calculateMaxTaxableBase();
    return maxBase === null ? null : applyDiscount(maxBase, parsedDiscountPercent);
  };

  const calculateMaxVat = (): number | null => {
    const maxBase = calculateMaxDiscountedBase();
    if (maxBase === null || !mwstEnabled) return null;
    return maxBase * (vatRate / 100);
  };

  const calculateTotal = () => calculateDiscountedBase() + calculateVat();

  const calculateMaxTotal = (): number | null => {
    const maxBase = calculateMaxDiscountedBase();
    if (maxBase === null) return null;
    return maxBase + (calculateMaxVat() ?? 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
    }).format(amount);
  };

  /** Convert YYYY-MM-DD to dd.MM.yyyy for display hint */

  /** Apply corrected field values back to form state, then save. */
  const applySpellCorrections = useCallback(
    (corrected: SpellCheckFields) => {
      if (corrected["title"] !== undefined) setTitle(corrected["title"]);
      if (corrected["description"] !== undefined) setDescription(corrected["description"]);
      if (corrected["termsAndConditions"] !== undefined) setTermsAndConditions(corrected["termsAndConditions"]);
      if (corrected["internalNotes"] !== undefined) {
        setOfferDetails((prev) => ({ ...prev, internalNotes: corrected["internalNotes"] }));
      }
      setItems((prev) =>
        prev.map((item, idx) => {
          const descKey = `item_${idx + 1}_description`;
          const newDesc = corrected[descKey] !== undefined ? corrected[descKey] : item.description;
          const newDetails = item.details.map((detail, dIdx) => {
            const detailKey = `item_${idx + 1}_detail_${dIdx + 1}`;
            return corrected[detailKey] !== undefined ? corrected[detailKey] : detail;
          });
          return { ...item, description: newDesc, details: newDetails };
        })
      );
    },
    [setTitle, setDescription, setTermsAndConditions, setOfferDetails, setItems]
  );

  const handleSpellCheckAccept = useCallback(() => {
    setSpellCheckOpen(false);
    applySpellCorrections(spellCheckCorrected);
    // Use setTimeout so React flushes state updates before save runs.
    // Call via ref to avoid TDZ — handleSave is defined below this block.
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, [applySpellCorrections, spellCheckCorrected]);

  const handleSpellCheckKeepOriginal = useCallback(() => {
    setSpellCheckOpen(false);
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, []);

  const handleSpellCheckDismiss = useCallback(() => {
    setSpellCheckOpen(false);
    setTimeout(() => handleSaveRef.current(pendingSpellSaveRef.current), 0);
  }, []);

  const handleSave = async (sendAfterSave: boolean = false) => {
    if (!company?.id || !lead || !leadId) return;

    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte fügen Sie mindestens eine Position hinzu",
        variant: "destructive",
      });
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Positionen aus",
        variant: "destructive",
      });
      return;
    }

    if (priceModel === 'stundenansatz' || priceModel === 'kostendach') {
      if (!hourlyRate || Number(hourlyRate) <= 0) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie einen gültigen Stundenansatz ein",
          variant: "destructive",
        });
        return;
      }
    }

    if (priceModel === 'kostendach') {
      if (!kostendachMax || Number(kostendachMax) <= 0) {
        toast({
          title: "Fehler",
          description: "Bitte geben Sie ein gültiges Kostendach ein",
          variant: "destructive",
        });
        return;
      }
      if (Number(kostendachMax) < Number(hourlyRate)) {
        toast({
          title: "Fehler",
          description: "Das Kostendach muss mindestens so hoch sein wie der Stundenansatz",
          variant: "destructive",
        });
        return;
      }
    }

    // Blind Offerte — per-item time estimate validation
    for (const item of items) {
      const te = item.timeEstimate;
      if (!te) continue;
      if (!te.minHours || !te.maxHours || !te.hourlyRate) {
        toast({ title: "Fehler", description: `Zeitschätzung für "${item.description || 'Position'}" unvollständig`, variant: "destructive" });
        return;
      }
      if (parseFloat(te.maxHours) < parseFloat(te.minHours)) {
        toast({ title: "Fehler", description: `Max. Stunden müssen ≥ Min. Stunden sein (${item.description || 'Position'})`, variant: "destructive" });
        return;
      }
    }

    // ── Spell check intercept ──
    // Collect all free-text fields (skip empty ones)
    const spellFields: SpellCheckFields = {};
    if (title.trim()) spellFields["title"] = title;
    if (description.trim()) spellFields["description"] = description;
    if (termsAndConditions.trim()) spellFields["termsAndConditions"] = termsAndConditions;
    if (offerDetails.internalNotes?.trim()) spellFields["internalNotes"] = offerDetails.internalNotes;
    items.forEach((item, idx) => {
      if (item.description.trim()) spellFields[`item_${idx + 1}_description`] = item.description;
      item.details.forEach((detail, dIdx) => {
        if (detail.trim()) spellFields[`item_${idx + 1}_detail_${dIdx + 1}`] = detail;
      });
    });

    if (Object.keys(spellFields).length > 0) {
      setIsSpellChecking(true);
      const result = await runSpellCheck(spellFields);
      setIsSpellChecking(false);

      if (result && result.hasCorrections) {
        const changed = Object.entries(result.fields).some(
          ([k, v]) => spellFields[k] !== undefined && spellFields[k] !== v
        );
        if (changed) {
          pendingSpellSaveRef.current = sendAfterSave;
          setSpellCheckOriginal(spellFields);
          setSpellCheckCorrected(result.fields);
          setSpellCheckOpen(true);
          return; // wait for modal
        }
      }
      // no corrections or error → fall through to save
    }

    setIsSaving(true);

    try {
      const itemsSubtotal = calculateSubtotal();
      const distanceKm = lead?.distance_km ?? null;
      const computedSurcharges = withComputedAmounts(surcharges, itemsSubtotal, distanceKm);
      // Steuerbare Basis = Positionen + Zuschläge. P3b-1: offers.subtotal erhält die
      // RABATTIERTE Basis (applyDiscount) — die GENERATED vat_amount/total leiten sich damit
      // automatisch korrekt ab. Die Zwischensumme wird NIE aus offers.subtotal zurückgerechnet,
      // sondern immer aus computeItemsSubtotal (Regel P3b).
      const taxableBase = itemsSubtotal + surchargesTotal(surcharges, itemsSubtotal, distanceKm);
      const subtotal = applyDiscount(taxableBase, parsedDiscountPercent);

      // Create offer (vat_amount and total are generated columns, so we don't include them)
      // Core fields that exist in the original schema
      // Always save as draft first; update to "sent" only after email succeeds
      const coreOfferData = {
        company_id: company.id,
        lead_id: leadId,
        lead_distribution_id: distributionId || null,
        customer_first_name: lead.customer_first_name,
        customer_last_name: lead.customer_last_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        // Layer 2a: FREEZE the address into the offer (create-time) — preserved even if the lead is deleted, not dependent on backfill.
        frozen_from_street: lead.from_street ?? null,
        frozen_from_house_number: lead.from_house_number ?? null,
        frozen_from_plz: lead.from_plz ?? null,
        frozen_from_city: lead.from_city ?? null,
        frozen_from_floor: lead.from_floor ?? null,
        frozen_from_has_lift: lead.from_has_lift ?? null,
        frozen_to_street: lead.to_street ?? null,
        frozen_to_house_number: lead.to_house_number ?? null,
        frozen_to_plz: lead.to_plz ?? null,
        frozen_to_city: lead.to_city ?? null,
        frozen_to_floor: lead.to_floor ?? null,
        frozen_to_has_lift: lead.to_has_lift ?? null,
        // Estrich/Keller (Auszug side) — revived fork-remnant columns, frozen from the lead.
        frozen_has_estrich: lead.from_has_estrich ?? null,
        frozen_has_keller: lead.from_has_keller ?? null,
        frozen_address_at: new Date().toISOString(),
        title,
        description,
        service_date: serviceDate || null,
        valid_until: validUntil || null,
        subtotal,
        // H1: persist the distance so OfferteBearbeiten can recompute per-km surcharges.
        // Without it, editing an offer recomputes per_km amounts against a null distance → 0.
        moving_distance_km: distanceKm,
        surcharges: computedSurcharges,
        vat_rate: mwstEnabled ? vatRate : 0,
        // F1a: Kundennummer + Offerten-Rabatt (P3b-1: fliesst in subtotal via applyDiscount).
        customer_number: offerDetails.customerNumber?.trim() || null,
        discount_percent: parsedDiscountPercent,
        status: "draft",
        sent_at: null,
      };

      // Enhanced offer fields — the live DB has all these columns.
      const enhancedOfferData = {
        ...coreOfferData,
        company_reference: offerDetails.companyReference || null,
        customer_salutation: offerDetails.customerSalutation || null,
        service_start_time: offerDetails.serviceStartTime || null,
        service_end_time: offerDetails.serviceEndTime || null,
        // secondary_service_date/type: retired half-feature (one extra date, max 2 services,
        // never reached PDF/edit/customer view). Superseded by per-group scheduled_* on
        // offer_items (N services). Columns stay in the DB but are no longer written.
        service_details: offerDetails.serviceDetails || {},
        highlighted_items: offerDetails.highlightedItems || [],
        payment_method: offerDetails.paymentMethod || null,
        payment_terms: paymentTerms?.trim() || null,
        internal_notes: offerDetails.internalNotes || null,
        price_model: priceModel,
        hourly_rate: (priceModel === 'stundenansatz' || priceModel === 'kostendach') && hourlyRate
          ? Number(hourlyRate) : null,
        kostendach_max: priceModel === 'kostendach' && kostendachMax
          ? Number(kostendachMax) : null,
        brief_layout: briefLayout,
        offerte_type: offerteType,
      };

      // Insert directly. The old "core fields only" fallback was dead code that masked real
      // insert errors — and coreOfferData itself now carries newer columns than some of the
      // "enhanced" ones, so the fallback insert would fail identically and never recover.
      const { data: offer, error: offerError } = await supabase
        .from("offers")
        .insert(enhancedOfferData)
        .select()
        .single();

      if (offerError) throw offerError;

      // Update offer number in state for preview (if column exists)
      if (offer?.offer_number) {
        setOfferNumber(offer.offer_number);
      }

      // Create offer items (convert to simple format for DB)
      // #7b: build the item payload for replace_offer_items (offer_id comes from the RPC
      // parameter, not each row). Same RPC the edit flow uses → atomic (delete+insert in
      // one transaction, no partial items) and no duplicated insert logic.
      // Meta attaches to the FIRST billable item of each service group (matches the PDF,
      // which draws the meta card under the group's leading priced position).
      const firstBillableIdByGroup = new Map<string, string>();
      for (const it of items) {
        if (isFreeItem(it.priceType)) continue;
        const gk = serviceGroupKey(it.serviceType);
        if (!firstBillableIdByGroup.has(gk)) firstBillableIdByGroup.set(gk, it.id);
      }

      const itemsPayload = items.map((item) => {
        const te = item.timeEstimate;
        const teValid = te && te.minHours && te.maxHours && te.hourlyRate;
        const gk = serviceGroupKey(item.serviceType);
        const metaPayload = firstBillableIdByGroup.get(gk) === item.id
          ? buildMetaPayload(metaKindForService(item.serviceType), groupMeta[gk])
          : {};
        return {
          position: item.position,
          description: item.details.length > 0
            ? `${item.description}\n${item.details.filter(Boolean).map((d) => `• ${d}`).join("\n")}`
            : item.description,
          // M2: blind (time-estimate) items are priced as minHours*hourlyRate for the whole
          // position, so quantity must be 1 — otherwise the GENERATED total (quantity*unit_price)
          // double-counts. Mirrors the "inkl" handling.
          quantity: item.priceType === "inkl" || teValid || item.amountBasis === "rate" ? 1 : item.quantity,
          unit: item.priceType === "inkl" ? "inkl." : item.unit,
          unit_price: teValid
            ? parseFloat(te!.minHours) * parseFloat(te!.hourlyRate)
            : item.priceType === "inkl" ? 0 : item.unit_price,
          price_type: item.priceType,
          is_highlighted: item.highlighted,
          is_optional: item.priceType === "optional",
          time_estimate: teValid
            ? { minHours: parseFloat(te!.minHours), maxHours: parseFloat(te!.maxHours), hourlyRate: parseFloat(te!.hourlyRate) }
            : null,
          service_type: item.serviceType ?? null,
          // Per-service date: the group's value is copied onto every item of the group.
          scheduled_date: groupDates[serviceGroupKey(item.serviceType)]?.date || null,
          scheduled_start_time: groupDates[serviceGroupKey(item.serviceType)]?.startTime || null,
          scheduled_end_time: groupDates[serviceGroupKey(item.serviceType)]?.endTime || null,
          amount_basis: item.amountBasis ?? "fixed",
          kostendach_max: item.amountBasis === "rate" ? (item.kostendachMax ?? null) : null,
          ...metaPayload,
        };
      });

      const { error: itemsError } = await supabase.rpc("replace_offer_items", {
        p_offer_id: offer.id,
        p_items: itemsPayload,
      });

      if (itemsError) {
        // Items failed — the RPC is atomic (no partial rows), but the offer header was
        // already inserted, so clean it up to avoid an orphan zero-item draft.
        try {
          const { error: deleteError } = await supabase
            .from("offers")
            .delete()
            .eq("id", offer.id);
          if (deleteError) {
            console.error("Orphaned offer cleanup failed — offer may remain as draft:", deleteError, { offerId: offer.id });
          }
        } catch (deleteException) {
          console.error("Orphaned offer cleanup threw:", deleteException, { offerId: offer.id });
        }
        throw itemsError;
      }

      // Save Leistungsübersicht if any services selected
      if (selectedLeistungen.length > 0 || excludedLeistungen.filter(Boolean).length > 0) {
        // Format included services with necessary fields for PDF
        const formattedIncludedServices = selectedLeistungen.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description || undefined,
          category: s.category || undefined,
        }));

        const { error: leistungError } = await supabase
          .from("offer_leistungsuebersicht")
          .insert({
            offer_id: offer.id,
            included_services: formattedIncludedServices,
            excluded_services: excludedLeistungen.filter(Boolean),
            special_notes: leistungNotes || null,
          });

        if (leistungError) {
          // D12: leistung error is non-fatal — offer + items already saved, just log it
          console.error("Error saving Leistungsübersicht (non-fatal, offer already saved):", leistungError);
        }
      }

      // Send email if requested — den Status-Übergang ("sent") setzt die
      // send-offer Edge Function selbst, nur bei erfolgreichem Versand.
      if (sendAfterSave) {
        const result = await sendOffer({ offerId: offer.id, companyId: company.id, forceResend: false });
        if (!result.success) {
          toast({
            title: "E-Mail nicht gesendet",
            description: `Die Offerte wurde gespeichert, aber: ${result.error ?? "Die E-Mail konnte nicht gesendet werden."} Sie können sie unter Offerten erneut versenden.`,
            variant: "destructive",
          });
          navigate("/firma/offerten");
          return;
        }
      }

      toast({
        title: sendAfterSave ? "Offerte gesendet" : "Offerte gespeichert",
        description: sendAfterSave
          ? "Die Offerte wurde erfolgreich per E-Mail an den Kunden gesendet."
          : "Die Offerte wurde als Entwurf gespeichert.",
        variant: sendAfterSave ? "success" : "default",
      });

      navigate("/firma/offerten");
    } catch (error) {
      console.error("Error saving offer:", error);
      toast({
        title: "Fehler",
        description: "Die Offerte konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  // Keep ref in sync every render so spell-check callbacks always invoke the latest closure
  handleSaveRef.current = handleSave;

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Offerte erstellen | Firma</title>
        </Helmet>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Helmet>
          <title>Offerte erstellen | Firma</title>
        </Helmet>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Kein Lead ausgewählt</h3>
            <p className="text-muted-foreground mb-4">
              Bitte wählen Sie einen akzeptierten Lead aus, um eine Offerte zu erstellen.
            </p>
            <Button onClick={() => navigate("/firma/anfragen")}>
              Zu den Anfragen
            </Button>
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Offerte erstellen | Firma</title>
      </Helmet>
        <div className="space-y-4 sm:space-y-6">
          {/* Folk-style header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 shrink-0 rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink2"
              aria-label="Zurück"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-2xl leading-none">📄</span>
                <h1 className="text-xl font-bold tracking-tight text-folk-ink sm:text-2xl">Offerte erstellen</h1>
              </div>
              <p className="mt-1 text-[15px] text-folk-ink2">
                Für <span className="font-semibold text-folk-ink">{lead.customer_first_name} {lead.customer_last_name}</span> — Positionen hinzufügen, Versandkanal wählen, senden.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 min-w-0">
            {/* Main Form */}
            <div className="md:col-span-1 lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              {/* ─── Anfrage-Übersicht ─── */}
              <Card>
                {/* Header */}
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <User className="w-4 h-4 text-secondary" />
                      Anfrage-Übersicht
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      Aus Anfrage übernommen
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 space-y-4">

                  {/* ── 1. Kontakt ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Kunde</p>
                        <p className="font-semibold text-sm truncate">
                          {lead.customer_first_name} {lead.customer_last_name}
                        </p>
                      </div>
                    </div>
                    <a href={`tel:${lead.customer_phone}`} className="flex items-center gap-2 min-w-0 hover:text-primary">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Telefon</p>
                        <p className="font-medium text-sm truncate">{lead.customer_phone}</p>
                      </div>
                    </a>
                    <a href={`mailto:${lead.customer_email}`} className="flex items-center gap-2 min-w-0 hover:text-primary">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">E-Mail</p>
                        <p className="font-medium text-sm truncate">{lead.customer_email}</p>
                      </div>
                    </a>
                  </div>

                  <Separator />

                  {/* ── 2. Route (Von → Nach) ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-start">
                    {/* Von */}
                    <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                      <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Auszug
                      </p>
                      <p className="font-semibold text-sm">
                        {lead.from_street}{lead.from_house_number ? ` ${lead.from_house_number}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">{lead.from_plz} {lead.from_city}</p>
                      {(lead.from_floor !== null || lead.from_has_lift !== null) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {lead.from_floor !== null && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {formatFloorLabel(lead.from_floor)}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 px-1.5 ${lead.from_has_lift ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-red-300 text-red-600'}`}
                          >
                            {lead.from_has_lift ? '✓ Lift' : '✗ Kein Lift'}
                          </Badge>
                          {lead.from_has_estrich !== null && lead.from_has_estrich !== undefined && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {lead.from_has_estrich ? '✓ Estrich' : '✗ Kein Estrich'}
                            </Badge>
                          )}
                          {lead.from_has_keller !== null && lead.from_has_keller !== undefined && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {lead.from_has_keller ? '✓ Keller' : '✗ Kein Keller'}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center py-3 sm:py-4">
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    {/* Nach */}
                    {lead.to_city ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Einzug
                        </p>
                        <p className="font-semibold text-sm">
                          {lead.to_street}{lead.to_house_number ? ` ${lead.to_house_number}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">{lead.to_plz} {lead.to_city}</p>
                        {(lead.to_floor !== null || lead.to_has_lift !== null) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {lead.to_floor !== null && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {formatFloorLabel(lead.to_floor)}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-1.5 ${lead.to_has_lift ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-red-300 text-red-600'}`}
                            >
                              {lead.to_has_lift ? '✓ Lift' : '✗ Kein Lift'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-muted/40 border border-dashed p-3 flex items-center justify-center text-xs text-muted-foreground">
                        Kein Einzugsort
                      </div>
                    )}
                  </div>

                  {/* ── 3. Objektdetails ── */}
                  {(lead.from_rooms || lead.from_living_space_m2 || lead.property_type || lead.distance_km) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {lead.from_rooms && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                          <p className="text-lg font-bold">{lead.from_rooms}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <Home className="w-2.5 h-2.5" /> Zimmer
                          </p>
                        </div>
                      )}
                      {lead.from_living_space_m2 && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                          <p className="text-lg font-bold">{lead.from_living_space_m2}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <Ruler className="w-2.5 h-2.5" /> m²
                          </p>
                        </div>
                      )}
                      {lead.property_type && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                          <p className="text-sm font-semibold capitalize">{lead.property_type}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <Building2 className="w-2.5 h-2.5" /> Objekt
                          </p>
                        </div>
                      )}
                      {lead.distance_km && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                          <p className="text-lg font-bold">{lead.distance_km}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <Route className="w-2.5 h-2.5" /> km
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 4. Termin ── */}
                  {lead.preferred_date && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs text-blue-600 font-medium">Wunschtermin: </span>
                        <span className="text-sm font-semibold">
                          {new Date(lead.preferred_date).toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        {lead.preferred_time_slot && (
                          <span className="text-xs text-muted-foreground ml-2">({lead.preferred_time_slot})</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── 5. Gewünschte Zusatzleistungen ── */}
                  {(lead.packing_service_needed || lead.cleaning_service_needed || lead.storage_needed || lead.piano_transport_needed) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Package className="w-3 h-3" /> Gewünschte Zusatzleistungen
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.packing_service_needed && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-normal gap-1">
                            <CheckCircle className="w-3 h-3" /> Verpackungsservice
                          </Badge>
                        )}
                        {lead.cleaning_service_needed && (
                          <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-xs font-normal gap-1">
                            <CheckCircle className="w-3 h-3" /> Reinigung
                          </Badge>
                        )}
                        {lead.storage_needed && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-normal gap-1">
                            <CheckCircle className="w-3 h-3" /> Lagerung
                          </Badge>
                        )}
                        {lead.piano_transport_needed && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-xs font-normal gap-1">
                            <CheckCircle className="w-3 h-3" /> Klaviertransport
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── 6. Kundenbemerkung ── */}
                  {lead.description && (
                    <div className="rounded-lg bg-muted/40 border border-dashed px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Kundenbemerkung
                      </p>
                      <p className="text-sm italic text-foreground/80 leading-relaxed">
                        &ldquo;{lead.description}&rdquo;
                      </p>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* ── AI Besichtigung Panel (modular - only shows if session exists) ── */}
              {company && (
                <BesichtigungAIPanel
                  companyId={company.id}
                  leadId={leadId}
                  customerName={`${lead.customer_first_name} ${lead.customer_last_name}`}
                  onApplyItems={handleAIItems}
                />
              )}

              {/* Moving Calculator for Umzug leads */}
              {lead.service_type?.toLowerCase().includes('umzug') && (
                <Card className="border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
                  <CardHeader
                    className="cursor-pointer px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4"
                    onClick={() => setShowMovingCalculator(!showMovingCalculator)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Calculator className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            Umzugsrechner
                            <Badge variant="secondary" className="text-xs">NEU</Badge>
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            Berechnen Sie Volumen, Zeit und Kosten automatisch
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={showMovingCalculator ? "Umzugsrechner schließen" : "Umzugsrechner öffnen"} aria-expanded={showMovingCalculator}>
                        {showMovingCalculator ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {calculatorResult && !showMovingCalculator && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 text-green-700 text-sm">
                          <span className="font-medium">Letzte Berechnung:</span>
                          <span>{calculatorResult.netVolume.toFixed(1)} m³</span>
                          <span>•</span>
                          <span>{formatTime(calculatorResult.timeBreakdown.totalTime)}</span>
                          <span>•</span>
                          <span className="font-semibold">{formatCalculatorCHF(calculatorResult.costBreakdown.total)}</span>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  {showMovingCalculator && (
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                      <MovingCalculatorWithLead
                        leadId={leadId!}
                        companyId={company?.id}
                        onCalculate={handleCalculatorResult}
                        pricingConfig={pricingConfig}
                      />
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Enhanced Offer Details */}
              {company && (
                <OfferteDetailsSection
                  companyId={company.id}
                  serviceType={lead.service_type}
                  leadData={{
                    from_floor: lead.from_floor,
                    from_has_lift: lead.from_has_lift,
                    from_rooms: lead.from_rooms,
                    from_living_space_m2: lead.from_living_space_m2,
                    to_floor: lead.to_floor,
                    to_has_lift: lead.to_has_lift,
                  }}
                  details={offerDetails}
                  onChange={handleOfferDetailsChange}
                />
              )}

              {/* Leistungsuebersicht - REMOVED: Firmen fanden diesen Bereich verwirrend */}
              {/* Notiz: Leistungsübersicht wurde auf Kundenwunsch entfernt */}

              {/* Offerte Details */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                    Offerten-Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="title" className="text-xs sm:text-sm">Titel</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="z.B. Umzugsofferte"
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="serviceDate" className="text-xs sm:text-sm">Ausführungsdatum</Label>
                      <DateInputCH
                        id="serviceDate"
                        value={serviceDate}
                        onChange={setServiceDate}
                      />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="validUntil" className="text-xs sm:text-sm">Gültig bis</Label>
                        {validUntil && (
                          <button
                            type="button"
                            onClick={() => setValidUntil("")}
                            className="text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                      {validUntil ? (
                        <DateInputCH
                          id="validUntil"
                          value={validUntil}
                          onChange={setValidUntil}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 30);
                            setValidUntil(d.toISOString().split("T")[0]);
                          }}
                          className="w-full h-9 sm:h-10 border border-dashed border-input rounded-md text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
                        >
                          + Gültig bis hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                  {validUntil && isValidUntilShorterThanSevenDays(validUntil) && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-sm">
                        Hinweis: «Gültig bis» liegt weniger als 7 Tage ab heute. Üblich sind mindestens 7 Tage Gültigkeit.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="description" className="text-xs sm:text-sm">Beschreibung / Anmerkungen</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Zusätzliche Informationen..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Preismodell */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Preismodell</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { value: 'pauschal', label: 'Pauschalpreis' },
                        { value: 'stundenansatz', label: 'Stundenansatz' },
                        { value: 'kostendach', label: 'Stundenansatz mit Kostendach' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriceModel(opt.value)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                          priceModel === opt.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {(priceModel === 'stundenansatz' || priceModel === 'kostendach') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">Stundenansatz (CHF / Std.)</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={hourlyRate}
                          onChange={(e) => applyGlobalHourlyRate(e.target.value)}
                          placeholder="z.B. 120"
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      {priceModel === 'kostendach' && (
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Kostendach (max. CHF)</Label>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={kostendachMax}
                            onChange={(e) => setKostendachMax(e.target.value)}
                            placeholder="z.B. 1800"
                            className="h-9 sm:h-10 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Der Kunde zahlt maximal diesen Betrag, unabhängig vom Zeitaufwand.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Offer-level Rabatt (%) — F1a: captured+saved, totals integration is F3 */}
                  <div className="space-y-1 pt-1 sm:max-w-[50%]">
                    <Label className="text-xs sm:text-sm">Rabatt gesamt (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="z.B. 10 (optional)"
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Zuschläge */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
                  <SurchargeEditor
                    surcharges={surcharges}
                    onChange={setSurcharges}
                    itemsSubtotal={calculateSubtotal()}
                    distanceKm={lead?.distance_km ?? null}
                  />
                </CardContent>
              </Card>

              {/* Offerte-Art: Normal / Blind */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-sm font-medium">Offerte-Art</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'normal' as const, label: 'Normal Offerte', sub: 'Nach Besichtigung' },
                        { value: 'blind'  as const, label: 'Blind Offerte',  sub: 'Ohne Besichtigung' },
                      ]
                    ).map(({ value, label, sub }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOfferteType(value)}
                        className={`rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                          offerteType === value
                            ? value === 'blind'
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[10px] mt-0.5">{sub}</p>
                      </button>
                    ))}
                  </div>
                  {offerteType === 'blind' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung.
                      Preise sind Schätzungen und können nach Besichtigung angepasst werden.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Briefversand (SN 010 130) toggle */}
              <Card>
                <CardContent className="px-3 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="brief-layout-toggle" className="text-sm font-medium cursor-pointer">
                        Als Brief versenden
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        PDF im Schweizer Briefstandard SN 010 130 (mit Absenderblock, Empfängeradresse und korrekter Anrede)
                      </p>
                    </div>
                    <Switch
                      id="brief-layout-toggle"
                      checked={briefLayout}
                      onCheckedChange={setBriefLayout}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Positions with Drag & Drop */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Positionen & Preise</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Fügen Sie Leistungen aus Ihrem Katalog hinzu oder erstellen Sie neue Positionen
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  {items.length === 0 ? (
                    /* Empty State */
                    <div className="text-center py-8 sm:py-12 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/20">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 text-secondary/60" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-2">Keine Positionen</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                        Fügen Sie Positionen aus Ihrem Leistungskatalog hinzu oder erstellen Sie eine leere Position.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowCatalogSelector(true)}
                          className="gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Aus Katalog hinzufügen
                        </Button>
                        <Button variant="outline" size="sm" onClick={addItem}>
                          <Plus className="w-4 h-4 mr-1" />
                          Manuell eingeben
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <div className="space-y-5">
                          {groupItemsByService(
                            items.map((it) => ({ ...it, service_type: it.serviceType ?? null })),
                          ).map((group, _gi, allGroups) => {
                            const serviceKey = group.serviceType ?? "null";
                            const billable = group.items.filter((it) => !isFreeItem(it.priceType));
                            const free = group.items.filter((it) => isFreeItem(it.priceType));

                            return (
                              <div key={serviceKey} className="space-y-3">
                                {/* Service group header + per-group date (multi-service only:
                                    with a single service the offer-level date is sufficient) */}
                                <div className="flex flex-wrap items-center gap-2 px-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {group.label}
                                  </span>
                                  {allGroups.length > 1 && (
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      <span className="text-[10px] text-muted-foreground">Termin</span>
                                      <DatePicker
                                        value={groupDates[serviceKey]?.date ?? ""}
                                        onChange={(value) => updateGroupDate(serviceKey, "date", value)}
                                        className="h-7 w-[8.5rem] text-xs"
                                      />
                                      <Input
                                        type="time"
                                        value={groupDates[serviceKey]?.startTime ?? ""}
                                        onChange={(e) => updateGroupDate(serviceKey, "startTime", e.target.value)}
                                        className="h-7 w-[5.5rem] text-xs"
                                      />
                                      <span className="text-[10px] text-muted-foreground">–</span>
                                      <Input
                                        type="time"
                                        value={groupDates[serviceKey]?.endTime ?? ""}
                                        onChange={(e) => updateGroupDate(serviceKey, "endTime", e.target.value)}
                                        className="h-7 w-[5.5rem] text-xs"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Per-group service meta (effort/area/volume) — shown on the PDF
                                    under the group's first priced position. */}
                                {(() => {
                                  const metaKind = metaKindForService(group.serviceType);
                                  if (!metaKind) return null;
                                  return (
                                    <div className="rounded-lg border border-dashed px-3 py-2">
                                      <ServiceMetaFields
                                        kind={metaKind}
                                        draft={groupMeta[serviceKey] ?? EMPTY_META_DRAFT}
                                        onChange={(patch) => updateGroupMeta(serviceKey, patch)}
                                        idPrefix={`meta-new-${serviceKey}`}
                                      />
                                    </div>
                                  );
                                })()}

                                {/* Billable positions — full editable cards, drag-sortable within the group */}
                                <Droppable droppableId={`group-${serviceKey}`}>
                                  {(provided) => (
                                    <div
                                      {...provided.droppableProps}
                                      ref={provided.innerRef}
                                      className="space-y-3 sm:space-y-4"
                                    >
                                      {billable.map((item, localIndex) => {
                                        const originalIndex = items.findIndex((i) => i.id === item.id);
                                        return (
                                          <OfferteItemRow
                                            key={item.id}
                                            item={items[originalIndex]}
                                            index={localIndex}
                                            onUpdate={(_i, field, value) => updateItem(originalIndex, field, value)}
                                            onRemove={() => removeItem(originalIndex)}
                                            onAddDetail={() => addDetail(originalIndex)}
                                            onUpdateDetail={(_i, di, v) => updateDetail(originalIndex, di, v)}
                                            onRemoveDetail={(_i, di) => removeDetail(originalIndex, di)}
                                            canRemove={true}
                                            formatCurrency={formatCurrency}
                                            offerteType={offerteType}
                                          />
                                        );
                                      })}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>

                                {/* Free (inkl / optional) items — compact ✓ chips; add a price to promote to a card */}
                                {free.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pl-3">
                                    {free.map((item) => {
                                      const originalIndex = items.findIndex((i) => i.id === item.id);
                                      return (
                                        <ItemChip
                                          key={item.id}
                                          item={items[originalIndex]}
                                          onRemove={() => removeItem(originalIndex)}
                                          onPromote={() => updateItem(originalIndex, "priceType", "pauschale")}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </DragDropContext>

                      {/* Add Position Buttons - At Bottom */}
                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-dashed">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowCatalogSelector(true)}
                          className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Position hinzufügen
                        </Button>
                        <Button variant="outline" size="sm" onClick={addItem} className="text-xs sm:text-sm h-8 sm:h-9">
                          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                          Manuell eingeben
                        </Button>
                        {optionalServices.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowOptionalDialog(true)}
                            className="text-secondary border-secondary/30 hover:bg-secondary/10 text-xs sm:text-sm h-8 sm:h-9"
                          >
                            <PackagePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                            Optionale ({optionalServices.length})
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  <Separator className="my-4 sm:my-6" />

                  {/* Hourly Rate Notice */}
                  {items.some(item => item.priceType === "per_hour" || item.unit === "Stunden") && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs sm:text-sm text-amber-800">
                        <span className="font-medium">⏱️ Hinweis zu Stundenarbeiten:</span>{" "}
                        Die angegebenen Stunden sind eine Schätzung basierend auf unserer Erfahrung.
                        Die tatsächliche Arbeitszeit kann je nach Gegebenheiten vor Ort (Zugänglichkeit,
                        Stockwerk, Parkplatzsituation etc.) variieren. Die Abrechnung erfolgt nach
                        effektivem Aufwand.
                      </p>
                    </div>
                  )}

                  {/* Totals — bei rate-Posten keine Aggregat-Box, nur Hinweis */}
                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 space-y-2">
                      {hasRateItem() ? (
                        <div className="text-right text-xs sm:text-sm text-muted-foreground leading-snug">
                          {RATE_AGGREGATE_NOTE}
                        </div>
                      ) : (
                      <>
                      {/* Zwischensumme */}
                      <div className="flex justify-between items-start text-xs sm:text-sm">
                        <span className="shrink-0">Zwischensumme</span>
                        {calculateMaxSubtotal() !== null ? (
                          <div className="text-right text-amber-700 font-medium leading-snug">
                            <div>{formatCurrency(calculateSubtotal())}</div>
                            <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxSubtotal()!)}</div>
                          </div>
                        ) : (
                          <span>{formatCurrency(calculateSubtotal())}</span>
                        )}
                      </div>
                      {/* Zuschläge (zwischen Zwischensumme und MwSt) */}
                      {surcharges.map((s, i) => (
                        <div key={i} className="flex justify-between items-center text-xs sm:text-sm text-slate-600">
                          <span className="shrink-0 truncate">{s.label || "Zuschlag"}</span>
                          <span>{formatCurrency(computeSurchargeAmount(s, calculateSubtotal(), lead?.distance_km ?? null))}</span>
                        </div>
                      ))}
                      {/* Rabatt + Total exkl. MwSt (P3b-2c-ii, new_offer.png) — nur bei aktivem Rabatt */}
                      {parsedDiscountPercent !== null && parsedDiscountPercent > 0 && (
                        <>
                          <div className="flex justify-between items-start text-xs sm:text-sm text-slate-600">
                            <span className="shrink-0">Rabatt {parsedDiscountPercent.toLocaleString("de-CH")} %</span>
                            {calculateMaxTaxableBase() !== null ? (
                              <div className="text-right text-amber-700 leading-snug">
                                <div>- {formatCurrency(computeDiscountAmount(calculateTaxableBase(), parsedDiscountPercent))}</div>
                                <div className="text-[10px] text-amber-600">– - {formatCurrency(computeDiscountAmount(calculateMaxTaxableBase()!, parsedDiscountPercent))}</div>
                              </div>
                            ) : (
                              <span>- {formatCurrency(computeDiscountAmount(calculateTaxableBase(), parsedDiscountPercent))}</span>
                            )}
                          </div>
                          <div className="flex justify-between items-start text-xs sm:text-sm">
                            <span className="shrink-0">Total exkl. MwSt</span>
                            {calculateMaxDiscountedBase() !== null ? (
                              <div className="text-right text-amber-700 font-medium leading-snug">
                                <div>{formatCurrency(calculateDiscountedBase())}</div>
                                <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxDiscountedBase()!)}</div>
                              </div>
                            ) : (
                              <span>{formatCurrency(calculateDiscountedBase())}</span>
                            )}
                          </div>
                        </>
                      )}
                      {/* MwSt row */}
                      <div className="flex justify-between items-start text-xs sm:text-sm gap-2">
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={mwstEnabled}
                            onCheckedChange={setMwstEnabled}
                          />
                          <span>MwSt.</span>
                          {mwstEnabled && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-14 sm:w-16 h-7 text-xs"
                                value={vatRate}
                                onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                              />
                              <span className="text-xs">%</span>
                            </div>
                          )}
                        </div>
                        {calculateMaxVat() !== null ? (
                          <div className="text-right text-amber-700 leading-snug">
                            <div>{formatCurrency(calculateVat())}</div>
                            <div className="text-[10px] text-amber-600">– {formatCurrency(calculateMaxVat()!)}</div>
                          </div>
                        ) : (
                          <span>{formatCurrency(calculateVat())}</span>
                        )}
                      </div>
                      <Separator />
                      {/* Total */}
                      <div className="flex justify-between items-start font-bold text-base sm:text-lg">
                        <span className="shrink-0">Total</span>
                        {calculateMaxTotal() !== null ? (
                          <div className="text-right text-amber-700 leading-snug">
                            <div>{formatCurrency(calculateTotal())}</div>
                            <div className="text-sm font-semibold text-amber-600">– {formatCurrency(calculateMaxTotal()!)}</div>
                          </div>
                        ) : (
                          <span className="text-secondary">{formatCurrency(calculateTotal())}</span>
                        )}
                      </div>
                      </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Terms */}
              <Card>
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Zahlungskondition</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <Textarea
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="z.B. Barzahlung nach dem Umzug an den Teamchef"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Barzahlung nach der Ausführung")}
                    >
                      Barzahlung
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Zahlung innerhalb 10 Tagen netto")}
                    >
                      10 Tage netto
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("50% Anzahlung, Rest bei Fertigstellung")}
                    >
                      50% Anzahlung
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Zahlung innerhalb 30 Tagen")}
                    >
                      30 Tage
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Zahlung per Rechnung innerhalb 30 Tagen")}
                    >
                      Rechnung
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Zahlung per TWINT nach der Ausführung")}
                    >
                      TWINT
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/10 text-xs"
                      onClick={() => setPaymentTerms("Zahlung per Kreditkarte nach der Ausführung")}
                    >
                      Kreditkarte
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Terms and Conditions - collapsible */}
              <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAgb(!showAgb)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold">Allgemeine Geschäftsbedingungen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {termsAndConditions
                        ? `${termsAndConditions.slice(0, 50)}…`
                        : "Erscheinen auf Seite 2 der Offerte · Optional"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {showAgb ? "Einklappen ↑" : "Bearbeiten ↓"}
                  </span>
                </button>

                {showAgb && (
                  <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t">
                    <div className="pt-3">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="w-full mb-3 gap-2"
                        onClick={() => setTermsAndConditions(`Versicherung\nDie Firma verfügt über eine Betriebs- und Transportversicherung. Alle Schäden müssen sofort nach Feststellung, spätestens jedoch innerhalb von 24 Stunden, schriftlich gemeldet werden.\n\nHaftung\nDie Haftung für Schäden an transportierten Gütern richtet sich nach den gesetzlichen Bestimmungen des Schweizerischen Obligationenrechts.\n\nStornierung\nBei Stornierung weniger als 48 Stunden vor dem vereinbarten Termin werden 50% des Offertbetrages in Rechnung gestellt.\n\nZahlungsbedingungen\nDie Rechnung ist sofort nach Abschluss der Arbeiten zahlbar. Bei Zahlungsverzug wird ein Verzugszins von 5% pro Jahr berechnet.\n\nGerichtsstand\nGerichtsstand ist der Sitz unserer Firma.`)}
                      >
                        <Plus className="w-4 h-4" />
                        Standard-AGB automatisch einfügen
                      </Button>
                      <Textarea
                        value={termsAndConditions}
                        onChange={(e) => setTermsAndConditions(e.target.value)}
                        placeholder="Geben Sie hier Ihre allgemeinen Geschäftsbedingungen ein…"
                        rows={6}
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              {/* Company Info - Hidden on mobile, shown on md+ */}
              <Card className="hidden md:block">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4" />
                    Ihre Firma
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {company?.logo_url && (
                    <img
                      src={company.logo_url}
                      alt="Logo"
                      className="h-10 object-contain mb-2"
                    />
                  )}
                  <p className="font-medium text-sm">{company?.company_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {company?.street} {company?.house_number}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {company?.plz} {company?.city}
                  </p>
                  {company?.mwst_number && (
                    <p className="text-muted-foreground text-xs">
                      MwSt: {company.mwst_number}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons - Fixed at BOTTOM on mobile/tablet */}
              <div className="fixed bottom-0 inset-x-0 p-3 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:hidden z-50 safe-area-inset-bottom">
                <div className="flex gap-2">
                  {/* Mobile Preview Button */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 flex-shrink-0"
                      >
                        <Eye className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-4 sm:p-6">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <Eye className="w-5 h-5" />
                          Live-Vorschau
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">
                        <OfferteLivePreview
                          company={company}
                          lead={lead}
                          title={title}
                          items={items}
                          subtotal={calculateSubtotal()}
                          surcharges={surcharges.map((s) => ({ label: s.label, amount: computeSurchargeAmount(s, calculateSubtotal(), lead?.distance_km ?? null) }))}
                          vatRate={mwstEnabled ? vatRate : 0}
                          vatAmount={calculateVat()}
                          total={calculateTotal()}
                          maxSubtotal={calculateMaxSubtotal()}
                          maxVat={calculateMaxVat()}
                          maxTotal={calculateMaxTotal()}
                          hasRateItem={hasRateItem()}
                          priceModel={priceModel}
                          hourlyRate={hourlyRate ? Number(hourlyRate) : null}
                          kostendachMax={kostendachMax ? Number(kostendachMax) : null}
                          serviceDate={serviceDate}
                          validUntil={validUntil}
                          paymentTerms={paymentTerms}
                          termsAndConditions={termsAndConditions}
                          offerNumber={offerNumber}
                          offerDetails={offerDetails}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Mobile Inquiry Details Button */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 flex-shrink-0 border-secondary text-secondary hover:bg-secondary/10"
                      >
                        <FileText className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <Info className="w-5 h-5 text-secondary" />
                          Original-Anfrage
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <ServiceDetailsSection lead={lead} />
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Send Button - Primary action, takes most space */}
                  <Button
                    className="flex-1 h-11 text-sm font-medium"
                    onClick={() => handleSave(true)}
                    disabled={isSaving || isSpellChecking}
                  >
                    {isSpellChecking ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Text wird geprüft...</>
                    ) : isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {!isSpellChecking && "Offerte senden"}
                  </Button>

                  {/* Save Draft Button */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 flex-shrink-0"
                    onClick={() => handleSave(false)}
                    disabled={isSaving || isSpellChecking}
                  >
                    {isSaving || isSpellChecking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
              {/* Spacer for fixed bottom bar on mobile */}
              <div className="h-20 md:hidden" />

              {/* Desktop Sticky Container - Live Preview FIRST, then Actions */}
              <div className="hidden md:block sticky top-4 space-y-4">
                {/* Live Preview (Desktop) - Now at top of sticky container */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Live-Vorschau
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OfferteLivePreview
                      company={company}
                      lead={lead}
                      title={title}
                      items={items}
                      subtotal={calculateSubtotal()}
                      surcharges={surcharges.map((s) => ({ label: s.label, amount: computeSurchargeAmount(s, calculateSubtotal(), lead?.distance_km ?? null) }))}
                      vatRate={mwstEnabled ? vatRate : 0}
                      vatAmount={calculateVat()}
                      total={calculateTotal()}
                      maxSubtotal={calculateMaxSubtotal()}
                      maxVat={calculateMaxVat()}
                      maxTotal={calculateMaxTotal()}
                      hasRateItem={hasRateItem()}
                      priceModel={priceModel}
                      hourlyRate={hourlyRate ? Number(hourlyRate) : null}
                      kostendachMax={kostendachMax ? Number(kostendachMax) : null}
                      serviceDate={serviceDate}
                      validUntil={validUntil}
                      paymentTerms={paymentTerms}
                      termsAndConditions={termsAndConditions}
                      offerNumber={offerNumber}
                      offerDetails={offerDetails}
                    />
                  </CardContent>
                </Card>

                {/* Action Buttons (Desktop) - Below Live Preview */}
                <Card>
                  <CardContent className="pt-4 px-4 pb-4">
                    <div className="flex flex-col gap-3">
                      {/* Inquiry Details Button */}
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-10 text-sm border-secondary text-secondary hover:bg-secondary/10"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Anfrage-Details
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                              <Info className="w-5 h-5 text-secondary" />
                              Original-Anfrage
                            </SheetTitle>
                          </SheetHeader>
                          <div className="mt-6">
                            <ServiceDetailsSection lead={lead} />
                          </div>
                        </SheetContent>
                      </Sheet>

                      <Button
                        className="w-full h-10 text-sm"
                        onClick={() => handleSave(true)}
                        disabled={isSaving || isSpellChecking}
                      >
                        {isSpellChecking ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Text wird geprüft...</>
                        ) : isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {!isSpellChecking && "Offerte senden"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full h-10 text-sm"
                        onClick={() => handleSave(false)}
                        disabled={isSaving || isSpellChecking}
                      >
                        {isSaving || isSpellChecking ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Als Entwurf speichern
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Calculator Replace/Append Dialog */}
        <Dialog open={showCalculatorReplaceDialog} onOpenChange={setShowCalculatorReplaceDialog}>
          <DialogContent className="max-w-sm p-6">
            <DialogHeader>
              <DialogTitle>Positionen ersetzen?</DialogTitle>
              <DialogDescription className="text-sm pt-1">
                Sie haben bereits <strong>{items.length} Position{items.length !== 1 ? 'en' : ''}</strong> in der Offerte.
                Sollen die Positionen aus dem Rechner diese ersetzen oder hinzugefügt werden?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => handleCalculatorDialogChoice(false)} className="flex-1">
                Hinzufügen
              </Button>
              <Button variant="destructive" onClick={() => handleCalculatorDialogChoice(true)} className="flex-1">
                Ersetzen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Catalog Service Selector */}
        {company && lead && (
          <CatalogServiceSelector
            open={showCatalogSelector}
            onOpenChange={setShowCatalogSelector}
            companyId={company.id}
            serviceType={lead.service_type}
            onServicesSelected={handleCatalogServicesSelected}
            excludeServiceIds={Array.from(catalogAddedIds)}
          />
        )}

        {/* Optional Services Dialog */}
        <Dialog open={showOptionalDialog} onOpenChange={setShowOptionalDialog}>
          <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PackagePlus className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                Optionale Leistungen
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Wählen Sie die optionalen Leistungen aus.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-3 sm:py-4 space-y-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {optionalServices.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  Keine optionalen Leistungen verfügbar
                </p>
              ) : (
                optionalServices.map((service) => (
                  <div
                    key={service.id}
                    className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors ${selectedOptionalIds.has(service.id)
                        ? "bg-secondary/10 border-secondary"
                        : "hover:bg-muted/50"
                      }`}
                    onClick={() => toggleOptionalService(service.id)}
                  >
                    <div
                      className="shrink-0 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedOptionalIds.has(service.id)}
                        onCheckedChange={() => toggleOptionalService(service.id)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
                        <span className="font-medium text-sm">{service.name}</span>
                        {service.default_price > 0 && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            CHF {service.default_price.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          {service.category}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {service.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="border-t pt-3 sm:pt-4">
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {selectedOptionalIds.size} ausgewählt
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowOptionalDialog(false)} className="text-xs sm:text-sm">
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={addSelectedOptionalServices} disabled={selectedOptionalIds.size === 0} className="text-xs sm:text-sm">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Hinzufügen
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Spell Check Review Modal */}
        <SpellCheckModal
          open={spellCheckOpen}
          originalFields={spellCheckOriginal}
          correctedFields={spellCheckCorrected}
          onAccept={handleSpellCheckAccept}
          onKeepOriginal={handleSpellCheckKeepOriginal}
          onDismiss={handleSpellCheckDismiss}
        />
    </>
  );
};

export default FirmaOfferteErstellen;
