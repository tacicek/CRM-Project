import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  Check,
  ArrowLeft,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Package,
  Home,
  Trash2,
  Piano,
  Warehouse,
  Building,
  Languages
} from "lucide-react";
import { LOCALES, LOCALE_NAMES, toLocale, type Locale } from "@/i18n/locale";
import { useI18n, useT } from "@/i18n/useI18n";
import type { Translator } from "@/i18n/translator";
import { getAddressLabels, getServiceLabel } from "@/i18n/domain";
import { formatNumber } from "@/i18n/format";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import VoiceRecorder from "@/components/firma/VoiceRecorder";

// =============================================================================
// Constants
// =============================================================================
const MAX_RAW_TEXT_LENGTH = 10000; // Maximum character limit for input
const MIN_RAW_TEXT_LENGTH = 20; // Minimum characters required

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sanitize user input to prevent XSS and clean up text
 */
const sanitizeText = (text: string): string => {
  return text
    // Remove potential script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove other HTML tags but keep content
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
};

/**
 * Validate Swiss phone number format
 * Accepts: +41 XX XXX XX XX, 0XX XXX XX XX, etc.
 */
const isValidSwissPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return true; // Empty is valid (optional field)
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  // Swiss mobile: +41 7X or 07X
  // Swiss landline: +41 XX or 0XX
  const swissPattern = /^(\+41|0041|0)[1-9]\d{8}$/;
  return swissPattern.test(cleaned);
};

/**
 * Format phone number for display
 */
const formatSwissPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  // Convert to +41 format
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    return '+41 ' + cleaned.substring(1);
  }
  if (cleaned.startsWith('0041')) {
    return '+41 ' + cleaned.substring(4);
  }
  return phone;
};

/**
 * Validate date string format (YYYY-MM-DD)
 */
const isValidDateFormat = (date: string | null | undefined): boolean => {
  if (!date) return true;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
};

/**
 * Get user-friendly error message in the OPERATOR's dashboard language.
 */
const getUserFriendlyError = (error: unknown, t: Translator): string => {
  if (error instanceof Error) {
    const msg = error.message;
    // Pass through specific errors thrown by our own code
    if (msg.startsWith('Funktion:') || msg.startsWith('Import:') || msg.startsWith('Datenbankfehler:')) {
      return msg;
    }
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('network') || msgLower.includes('fetch')) {
      return t('lead.error.network');
    }
    if (msgLower.includes('timeout')) {
      return t('lead.error.timeout');
    }
    if (msgLower.includes('unauthorized') || msgLower.includes('401')) {
      return t('lead.error.unauthorized');
    }
    if (msgLower.includes('rate limit') || msgLower.includes('429')) {
      return t('lead.error.rateLimit');
    }
  }
  return t('lead.error.unexpected');
};

// Generic extracted data interface that can hold any service type fields
interface ExtractedData {
  // Base fields (all service types)
  detected_service_type: string;
  /**
   * DOCUMENT locale — the language the CUSTOMER wrote in (AI-detected, operator-editable).
   * NOT the operator's dashboard language. Start of the propagation chain:
   * leads.language → offers.language → auftraege / rechnungen / quittungen / appointments.
   */
  language: Locale;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  special_notes: string | null;
  confidence_score: number;

  // Umzug fields
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_elevator?: boolean;
  from_has_estrich?: boolean | null;
  from_has_keller?: boolean | null;
  from_rooms?: number | null;
  from_living_space_m2?: number | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_elevator?: boolean;
  packing_service_needed?: boolean;
  furniture_assembly_needed?: boolean;
  cleaning_service_needed?: boolean;
  storage_needed?: boolean;
  piano_transport_needed?: boolean;

  // Reinigung fields
  address_street?: string | null;
  address_house_number?: string | null;
  address_plz?: string | null;
  address_city?: string | null;
  property_type?: string | null;
  number_of_rooms?: number | null;
  living_space_m2?: number | null;
  bathroom_count?: number | null;
  kitchen_type?: string | null;
  has_balcony?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;
  has_attic?: boolean;
  cleaning_type?: string | null;

  // Räumung fields
  clearing_type?: string | null;
  estimated_volume?: string | null;
  has_heavy_items?: boolean;
  heavy_items_description?: string | null;

  // Entsorgung fields
  disposal_type?: string | null;
  items_description?: string | null;

  // Lagerung fields
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_plz?: string | null;
  pickup_city?: string | null;
  pickup_floor?: number | null;
  pickup_has_elevator?: boolean;
  storage_duration?: string | null;
  storage_volume?: string | null;
  access_frequency?: string | null;
  needs_climate_control?: boolean;
  storage_items_description?: string | null;

  // Klaviertransport fields
  piano_type?: string | null;
  piano_brand?: string | null;
  piano_weight_kg?: number | null;
  staircase_type?: string | null;
  staircase_width_cm?: number | null;
  window_access_possible?: boolean;

  // Möbellift fields
  moebellift_floor?: number | null;
  moebellift_item_description?: string | null;
  moebellift_item_dimensions?: string | null;
  direction?: string | null;
}

interface Company {
  id: string;
  company_name: string;
  manual_import_monthly_fee: number;
  crm_enabled?: boolean;
  /** Dashboard default — used as the fallback customer language when the AI is unsure. */
  default_language: string;
}

/**
 * Service types this import screen supports. The stored VALUE stays a German DB token;
 * the visible label comes from getServiceLabel(value, locale) in the operator's language.
 */
const SERVICE_TYPES = [
  "umzug_privat",
  "umzug_firma",
  "reinigung",
  "raeumung",
  "entsorgung",
  "lagerung",
  "klaviertransport",
  "moebellift",
] as const;

const SERVICE_TYPE_ICONS: Record<string, React.ReactNode> = {
  umzug_privat: <Home className="w-4 h-4" />,
  umzug_firma: <Building className="w-4 h-4" />,
  reinigung: <Sparkles className="w-4 h-4" />,
  raeumung: <Trash2 className="w-4 h-4" />,
  entsorgung: <Trash2 className="w-4 h-4" />,
  lagerung: <Warehouse className="w-4 h-4" />,
  klaviertransport: <Piano className="w-4 h-4" />,
  moebellift: <Package className="w-4 h-4" />,
};

const FirmaManualImport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useT();
  // Dashboard locale — the operator reads this screen. The CUSTOMER's language is a
  // separate, captured value (extractedData.language) and never comes from here.
  const { locale } = useI18n();

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // State
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>(""); // For granular loading
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) {
        if (isMountedRef.current) setIsLoading(false);
        return;
      }

      try {
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name, manual_import_monthly_fee, crm_enabled, default_language",
        });

        if (isMountedRef.current && companyData) {
          setCompany(companyData);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("Error fetching company:", error);
          toast({
            title: t("common.error"),
            description: t("lead.import.companyLoadFailed"),
            variant: "destructive",
          });
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    fetchCompany();
  }, [user, toast, t]);

  const processWithAI = useCallback(async () => {
    const trimmedText = rawText.trim();
    
    // Validation
    if (!trimmedText || !company) return;
    
    if (trimmedText.length < MIN_RAW_TEXT_LENGTH) {
      toast({
        title: t("lead.import.textTooShort"),
        description: t("lead.import.textTooShortHint", { count: MIN_RAW_TEXT_LENGTH }),
        variant: "destructive",
      });
      return;
    }

    if (trimmedText.length > MAX_RAW_TEXT_LENGTH) {
      toast({
        title: t("lead.import.textTooLong"),
        description: t("lead.import.textTooLongHint", {
          count: formatNumber(MAX_RAW_TEXT_LENGTH, locale),
        }),
        variant: "destructive",
      });
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setProcessingStep(t("lead.import.stepAnalyzing"));

    try {
      // Sanitize the input
      const sanitizedText = sanitizeText(trimmedText);

      setProcessingStep(t("lead.import.stepExtracting"));
      
      const { data, error } = await supabase.functions.invoke("extract-anfrage-ai", {
        body: { raw_text: sanitizedText, company_id: company.id },
      });

      // Check if component is still mounted
      if (!isMountedRef.current) return;

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.error || "Extraktion fehlgeschlagen");
      }

      // Validate extracted data
      if (!data.extracted_data || typeof data.extracted_data !== 'object') {
        throw new Error("Ungültige AI-Antwort erhalten");
      }

      // Ensure required fields exist
      const extractedWithDefaults: ExtractedData = {
        detected_service_type: data.extracted_data.detected_service_type || 'umzug_privat',
        first_name: data.extracted_data.first_name || null,
        last_name: data.extracted_data.last_name || null,
        email: data.extracted_data.email || null,
        phone: data.extracted_data.phone || null,
        preferred_date: data.extracted_data.preferred_date || null,
        preferred_time: data.extracted_data.preferred_time || null,
        special_notes: data.extracted_data.special_notes || null,
        confidence_score: typeof data.extracted_data.confidence_score === 'number'
          ? data.extracted_data.confidence_score
          : 0,
        ...data.extracted_data,
        // AFTER the spread on purpose: the AI-detected customer language is untrusted input
        // and must be narrowed. Falls back to the company default when the model is unsure.
        language: toLocale(data.extracted_data.language ?? company.default_language),
      };

      // Validate date format if provided
      if (extractedWithDefaults.preferred_date && !isValidDateFormat(extractedWithDefaults.preferred_date)) {
        extractedWithDefaults.preferred_date = null;
      }

      setExtractedData(extractedWithDefaults);
      setPreviewMode(true);
      setHasUnsavedChanges(false);
      
      toast({
        title: t("lead.import.extracted"),
        description: t("lead.import.extractedHint", {
          service: getServiceLabel(extractedWithDefaults.detected_service_type, locale),
          score: extractedWithDefaults.confidence_score,
        }),
      });
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') return;

      toast({
        title: t("lead.import.extractFailed"),
        description: getUserFriendlyError(error, t),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setProcessingStep("");
      }
    }
  }, [rawText, company, toast, t, locale]);

  const updateExtractedData = useCallback((field: keyof ExtractedData, value: string | number | boolean | null) => {
    setHasUnsavedChanges(true);
    setExtractedData(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const saveAndCreateOfferte = useCallback(async () => {
    if (!extractedData || !company || !user) return;

    // Prevent double submission
    if (isSaving) return;

    // ===================
    // Validation
    // ===================
    
    // Validate email format
    if (extractedData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedData.email)) {
      toast({
        title: t("lead.validation.invalidEmail"),
        description: t("lead.validation.invalidEmailHint"),
        variant: "destructive",
      });
      return;
    }

    // Validate phone format
    if (extractedData.phone && !isValidSwissPhone(extractedData.phone)) {
      toast({
        title: t("lead.validation.invalidPhone"),
        description: t("lead.validation.invalidPhoneHint"),
        variant: "destructive",
      });
      return;
    }

    // Validate Swiss PLZ (4 digits)
    const validatePLZ = (plz: string | null | undefined, fieldName: string): boolean => {
      if (plz && !/^\d{4}$/.test(plz)) {
        toast({
          title: t("lead.validation.invalidPlz"),
          description: t("lead.validation.invalidPlzValue", { field: fieldName, plz }),
          variant: "destructive",
        });
        return false;
      }
      return true;
    };

    const plzFields = [
      { value: extractedData.from_plz, name: t("lead.plz.from") },
      { value: extractedData.to_plz, name: t("lead.plz.to") },
      { value: extractedData.address_plz, name: t("lead.plz.address") },
      { value: extractedData.pickup_plz, name: t("lead.plz.pickup") },
    ];

    for (const field of plzFields) {
      if (!validatePLZ(field.value, field.name)) {
        return;
      }
    }

    // Require PLZ based on service type (backend requires from_plz)
    const serviceType = extractedData.detected_service_type;
    const requiredPlzField =
      serviceType === "lagerung"
        ? extractedData.pickup_plz
        : serviceType === "umzug_privat" || serviceType === "klaviertransport"
          ? extractedData.from_plz
          : extractedData.address_plz; // reinigung, raeumung, entsorgung, moebellift
    if (!requiredPlzField?.trim() || !/^\d{4}$/.test(requiredPlzField.trim())) {
      const fieldLabel =
        serviceType === "lagerung"
          ? t("lead.plz.pickup")
          : serviceType === "umzug_privat" || serviceType === "klaviertransport"
            ? t("lead.plz.from")
            : t("lead.plz.address");
      toast({
        title: t("lead.validation.plzRequired"),
        description: t("lead.validation.plzRequiredHint", { field: fieldLabel }),
        variant: "destructive",
      });
      return;
    }

    // Validate date format
    if (extractedData.preferred_date && !isValidDateFormat(extractedData.preferred_date)) {
      toast({
        title: t("lead.validation.invalidDate"),
        description: t("lead.validation.invalidDateHint"),
        variant: "destructive",
      });
      return;
    }

    // Validate required customer info for low confidence
    if (extractedData.confidence_score < 50) {
      if (!extractedData.first_name && !extractedData.last_name) {
        toast({
          title: t("lead.validation.missingCustomer"),
          description: t("lead.validation.missingCustomerHint"),
          variant: "destructive",
        });
        return;
      }
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSaving(true);
    
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (!freshSession) {
        toast({
          title: t("lead.import.sessionExpired"),
          description: t("lead.import.sessionExpiredHint"),
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const serviceType = extractedData.detected_service_type;
      
      // Format phone number before saving
      const formattedPhone = formatSwissPhone(extractedData.phone);
      
      // Build lead data based on service type
      const baseLeadData = {
        customer_first_name: extractedData.first_name?.trim() || null,
        customer_last_name: extractedData.last_name?.trim() || null,
        customer_email: extractedData.email?.trim().toLowerCase() || null,
        customer_phone: formattedPhone || null,
        preferred_date: extractedData.preferred_date || null,
        preferred_time_slot: extractedData.preferred_time || null,
        description: extractedData.special_notes?.trim() || null,
        service_type: serviceType,
        // Customer language — persisted to leads.language by import-manual-lead and
        // frozen onto the offer from there.
        language: extractedData.language,
      };

      let leadData: Record<string, unknown> = { ...baseLeadData };

      // Add service-specific fields
      if (serviceType === "umzug_privat" || serviceType === "umzug_firma") {
        leadData = {
          ...leadData,
          from_street: extractedData.from_street?.trim() || null,
          from_house_number: extractedData.from_house_number?.trim() || null,
          from_plz: extractedData.from_plz?.trim() || null,
          from_city: extractedData.from_city?.trim() || null,
          from_floor: extractedData.from_floor,
          from_has_lift: extractedData.from_has_elevator,
          from_has_estrich: extractedData.from_has_estrich ?? null,
          from_has_keller: extractedData.from_has_keller ?? null,
          from_rooms: extractedData.from_rooms,
          from_living_space_m2: extractedData.from_living_space_m2,
          to_street: extractedData.to_street?.trim() || null,
          to_house_number: extractedData.to_house_number?.trim() || null,
          to_plz: extractedData.to_plz?.trim() || null,
          to_city: extractedData.to_city?.trim() || null,
          to_floor: extractedData.to_floor,
          to_has_lift: extractedData.to_has_elevator,
          packing_service_needed: extractedData.packing_service_needed,
          cleaning_service_needed: extractedData.cleaning_service_needed,
          storage_needed: extractedData.storage_needed,
        };
      } else if (serviceType === "reinigung") {
        leadData = {
          ...leadData,
          from_street: extractedData.address_street?.trim() || null,
          from_house_number: extractedData.address_house_number?.trim() || null,
          from_plz: extractedData.address_plz?.trim() || null,
          from_city: extractedData.address_city?.trim() || null,
          from_rooms: extractedData.number_of_rooms,
          from_living_space_m2: extractedData.living_space_m2,
          property_type: extractedData.property_type,
          bathroom_count: extractedData.bathroom_count,
          kitchen_type: extractedData.kitchen_type,
          has_balcony: extractedData.has_balcony,
          has_garage: extractedData.has_garage,
          has_basement: extractedData.has_basement,
          has_attic: extractedData.has_attic,
        };
      } else if (serviceType === "raeumung") {
        leadData = {
          ...leadData,
          from_street: extractedData.address_street?.trim() || null,
          from_house_number: extractedData.address_house_number?.trim() || null,
          from_plz: extractedData.address_plz?.trim() || null,
          from_city: extractedData.address_city?.trim() || null,
          from_rooms: extractedData.number_of_rooms,
          property_type: extractedData.property_type,
          clearing_type: extractedData.clearing_type,
          estimated_volume: extractedData.estimated_volume,
          has_heavy_items: extractedData.has_heavy_items,
          heavy_items_description: extractedData.heavy_items_description?.trim() || null,
        };
      } else if (serviceType === "entsorgung") {
        leadData = {
          ...leadData,
          from_street: extractedData.address_street?.trim() || null,
          from_house_number: extractedData.address_house_number?.trim() || null,
          from_plz: extractedData.address_plz?.trim() || null,
          from_city: extractedData.address_city?.trim() || null,
          disposal_type: extractedData.disposal_type,
          items_description: extractedData.items_description?.trim() || null,
          estimated_volume: extractedData.estimated_volume,
        };
      } else if (serviceType === "lagerung") {
        leadData = {
          ...leadData,
          pickup_street: extractedData.pickup_street?.trim() || null,
          pickup_house_number: extractedData.pickup_house_number?.trim() || null,
          from_plz: extractedData.pickup_plz?.trim() || null,
          from_city: extractedData.pickup_city?.trim() || null,
          pickup_floor: extractedData.pickup_floor,
          pickup_has_lift: extractedData.pickup_has_elevator,
          storage_duration: extractedData.storage_duration,
          storage_volume: extractedData.storage_volume,
          access_frequency: extractedData.access_frequency,
          needs_climate_control: extractedData.needs_climate_control,
          storage_items_description: extractedData.storage_items_description?.trim() || null,
        };
      } else if (serviceType === "klaviertransport") {
        leadData = {
          ...leadData,
          from_street: extractedData.from_street?.trim() || null,
          from_house_number: extractedData.from_house_number?.trim() || null,
          from_plz: extractedData.from_plz?.trim() || null,
          from_city: extractedData.from_city?.trim() || null,
          from_floor: extractedData.from_floor,
          from_has_lift: extractedData.from_has_elevator,
          to_street: extractedData.to_street?.trim() || null,
          to_house_number: extractedData.to_house_number?.trim() || null,
          to_plz: extractedData.to_plz?.trim() || null,
          to_city: extractedData.to_city?.trim() || null,
          to_floor: extractedData.to_floor,
          to_has_lift: extractedData.to_has_elevator,
          piano_type: extractedData.piano_type,
          piano_brand: extractedData.piano_brand?.trim() || null,
          piano_weight_kg: extractedData.piano_weight_kg,
          staircase_type: extractedData.staircase_type,
          staircase_width_cm: extractedData.staircase_width_cm,
          window_access_possible: extractedData.window_access_possible,
        };
      } else if (serviceType === "moebellift") {
        leadData = {
          ...leadData,
          from_street: extractedData.address_street?.trim() || null,
          from_house_number: extractedData.address_house_number?.trim() || null,
          from_plz: extractedData.address_plz?.trim() || null,
          from_city: extractedData.address_city?.trim() || null,
          moebellift_floor: extractedData.moebellift_floor,
          moebellift_item_description: extractedData.moebellift_item_description?.trim() || null,
          moebellift_item_dimensions: extractedData.moebellift_item_dimensions?.trim() || null,
        };
      }

      // Sanitize raw text before sending
      const sanitizedRawText = sanitizeText(rawText);

      const response = await supabase.functions.invoke("import-manual-lead", {
        body: {
          company_id: company.id,
          lead_data: leadData,
          raw_text: sanitizedRawText,
          confidence_score: extractedData.confidence_score,
          user_id: user.id,
        },
      });

      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      if (response.error) {
        throw new Error(`Funktion: ${response.error.message || response.error}`);
      }
      
      const data = response.data;
      
      if (!data || !data.success) {
        throw new Error(`Import: ${data?.error || t("lead.error.importFailed")}`);
      }

      // Reset form state before navigation
      setRawText("");
      setExtractedData(null);
      setPreviewMode(false);
      setHasUnsavedChanges(false);

      toast({
        title: t("lead.import.imported"),
        description: t("lead.import.importedHint"),
      });

      navigate("/firma/anfragen");
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') return;

      toast({
        title: t("lead.import.saveFailed"),
        description: getUserFriendlyError(error, t),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [extractedData, company, user, isSaving, rawText, toast, navigate, t]);

  // Handle back button with confirmation
  const handleBackClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowBackConfirm(true);
    } else {
      setPreviewMode(false);
      setExtractedData(null);
    }
  }, [hasUnsavedChanges]);

  // Confirm going back (discard changes)
  const confirmGoBack = useCallback(() => {
    setShowBackConfirm(false);
    setPreviewMode(false);
    setExtractedData(null);
    setHasUnsavedChanges(false);
  }, []);

  // Handle raw text change with character limit
  const handleRawTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_RAW_TEXT_LENGTH) {
      setRawText(value);
    }
  }, []);

  // Reset form
  const handleReset = useCallback(() => {
    setRawText("");
    setExtractedData(null);
    setPreviewMode(false);
    setHasUnsavedChanges(false);
  }, []);

  const pendingVoiceRef = useRef(false);

  const handleVoiceTranscript = useCallback((text: string) => {
    setRawText(text);
    pendingVoiceRef.current = true;
  }, []);

  useEffect(() => {
    if (pendingVoiceRef.current && rawText.trim().length >= MIN_RAW_TEXT_LENGTH) {
      pendingVoiceRef.current = false;
      processWithAI();
    }
  }, [rawText, processWithAI]);

  // Render service-specific form fields
  const renderServiceFields = () => {
    if (!extractedData) return null;

    const serviceType = extractedData.detected_service_type;

    switch (serviceType) {
      case "umzug_privat":
      case "umzug_firma":
        return renderUmzugFields();
      case "reinigung":
        return renderReinigungFields();
      case "raeumung":
        return renderRaeumungFields();
      case "entsorgung":
        return renderEntsorgungFields();
      case "lagerung":
        return renderLagerungFields();
      case "klaviertransport":
        return renderKlaviertransportFields();
      case "moebellift":
        return renderMoebelliftFields();
      default:
        return renderUmzugFields(); // Default fallback
    }
  };

  const renderUmzugFields = () => (
    <>
      {/* From Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("umzug", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.hasEstrich")}</Label>
            <Select
              value={extractedData?.from_has_estrich === true ? "yes" : extractedData?.from_has_estrich === false ? "no" : "unknown"}
              onValueChange={(v) => updateExtractedData("from_has_estrich", v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t("common.unknown")}</SelectItem>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.hasKellerGarage")}</Label>
            <Select
              value={extractedData?.from_has_keller === true ? "yes" : extractedData?.from_has_keller === false ? "no" : "unknown"}
              onValueChange={(v) => updateExtractedData("from_has_keller", v === "unknown" ? null : v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">{t("common.unknown")}</SelectItem>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.from_rooms ?? ""}
              onChange={(e) => updateExtractedData("from_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.livingSpace")}</Label>
            <Input
              type="number"
              value={extractedData?.from_living_space_m2 ?? ""}
              onChange={(e) => updateExtractedData("from_living_space_m2", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* To Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("umzug", locale).secondary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Services */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.extras")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "packing_service_needed", label: t("lead.extra.packing") },
            { key: "furniture_assembly_needed", label: t("lead.extra.furnitureAssembly") },
            { key: "cleaning_service_needed", label: t("lead.extra.cleaning") },
            { key: "storage_needed", label: t("lead.extra.storage") },
            { key: "piano_transport_needed", label: t("lead.extra.piano") },
          ].map((service) => (
            <div key={service.key} className="flex items-center space-x-2">
              <Checkbox
                id={service.key}
                checked={!!extractedData?.[service.key as keyof ExtractedData]}
                onCheckedChange={(checked) =>
                  updateExtractedData(service.key as keyof ExtractedData, !!checked)
                }
              />
              <label htmlFor={service.key} className="text-sm cursor-pointer">
                {service.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderReinigungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("reinigung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Property Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Home className="w-4 h-4" />
          {t("lead.section.propertyDetails")}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{t("lead.field.propertyType")}</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">{t("lead.option.property.wohnung")}</SelectItem>
                <SelectItem value="Haus">{t("lead.option.property.haus")}</SelectItem>
                <SelectItem value="Studio">{t("lead.option.property.studio")}</SelectItem>
                <SelectItem value="Büro">{t("lead.option.property.buero")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.livingSpace")}</Label>
            <Input
              type="number"
              value={extractedData?.living_space_m2 ?? ""}
              onChange={(e) => updateExtractedData("living_space_m2", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.bathrooms")}</Label>
            <Input
              type="number"
              value={extractedData?.bathroom_count ?? ""}
              onChange={(e) => updateExtractedData("bathroom_count", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.kitchenType")}</Label>
            <Select
              value={extractedData?.kitchen_type || ""}
              onValueChange={(v) => updateExtractedData("kitchen_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offen">{t("lead.option.kitchen.offen")}</SelectItem>
                <SelectItem value="geschlossen">{t("lead.option.kitchen.geschlossen")}</SelectItem>
                <SelectItem value="kochnische">{t("lead.option.kitchen.kochnische")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.cleaningType")}</Label>
            <Select
              value={extractedData?.cleaning_type || ""}
              onValueChange={(v) => updateExtractedData("cleaning_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Endreinigung">{t("lead.option.cleaning.end")}</SelectItem>
                <SelectItem value="Grundreinigung">{t("lead.option.cleaning.grund")}</SelectItem>
                <SelectItem value="Unterhaltsreinigung">{t("lead.option.cleaning.unterhalt")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Areas */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.additionalAreas")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "has_balcony", label: t("lead.extra.balcony") },
            { key: "has_garage", label: t("lead.extra.garage") },
            { key: "has_basement", label: t("lead.extra.basement") },
            { key: "has_attic", label: t("lead.extra.attic") },
          ].map((area) => (
            <div key={area.key} className="flex items-center space-x-2">
              <Checkbox
                id={area.key}
                checked={!!extractedData?.[area.key as keyof ExtractedData]}
                onCheckedChange={(checked) =>
                  updateExtractedData(area.key as keyof ExtractedData, !!checked)
                }
              />
              <label htmlFor={area.key} className="text-sm cursor-pointer">
                {area.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderRaeumungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("raeumung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Clearing Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {t("lead.section.clearingDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.clearingType")}</Label>
            <Select
              value={extractedData?.clearing_type || ""}
              onValueChange={(v) => updateExtractedData("clearing_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnungsräumung">{t("lead.option.clearing.wohnung")}</SelectItem>
                <SelectItem value="Hausräumung">{t("lead.option.clearing.haus")}</SelectItem>
                <SelectItem value="Kellerräumung">{t("lead.option.clearing.keller")}</SelectItem>
                <SelectItem value="Dachbodenräumung">{t("lead.option.clearing.dachboden")}</SelectItem>
                <SelectItem value="Büroräumung">{t("lead.option.clearing.buero")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.propertyType")}</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">{t("lead.option.property.wohnung")}</SelectItem>
                <SelectItem value="Haus">{t("lead.option.property.haus")}</SelectItem>
                <SelectItem value="Keller">{t("lead.option.property.keller")}</SelectItem>
                <SelectItem value="Estrich">{t("lead.option.property.estrich")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.rooms")}</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.estimatedVolume")}</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.clearingVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.clearingVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.clearingVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.clearingVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="has_heavy_items"
                checked={!!extractedData?.has_heavy_items}
                onCheckedChange={(checked) => updateExtractedData("has_heavy_items", !!checked)}
              />
              <label htmlFor="has_heavy_items" className="text-sm cursor-pointer">
                {t("lead.field.heavyItems")}
              </label>
            </div>
            {extractedData?.has_heavy_items && (
              <Textarea
                placeholder={t("lead.placeholder.heavyItems")}
                value={extractedData?.heavy_items_description || ""}
                onChange={(e) => updateExtractedData("heavy_items_description", e.target.value)}
                rows={2}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderEntsorgungFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("entsorgung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Disposal Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          {t("lead.section.disposalDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.disposalType")}</Label>
            <Select
              value={extractedData?.disposal_type || ""}
              onValueChange={(v) => updateExtractedData("disposal_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sperrmüll">{t("lead.option.disposal.sperrmuell")}</SelectItem>
                <SelectItem value="Elektroschrott">{t("lead.option.disposal.elektroschrott")}</SelectItem>
                <SelectItem value="Bauschutt">{t("lead.option.disposal.bauschutt")}</SelectItem>
                <SelectItem value="Hausrat">{t("lead.option.disposal.hausrat")}</SelectItem>
                <SelectItem value="Möbel">{t("lead.option.disposal.moebel")}</SelectItem>
                <SelectItem value="Gemischt">{t("lead.option.disposal.gemischt")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.estimatedVolume")}</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.disposalVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.disposalVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.disposalVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.disposalVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.itemsDescription")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.disposalItems")}
              value={extractedData?.items_description || ""}
              onChange={(e) => updateExtractedData("items_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderLagerungFields = () => (
    <>
      {/* Pickup Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("lagerung", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.pickup_street || ""}
              onChange={(e) => updateExtractedData("pickup_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.pickup_house_number || ""}
              onChange={(e) => updateExtractedData("pickup_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.pickup_plz || ""}
              onChange={(e) => updateExtractedData("pickup_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.pickup_city || ""}
              onChange={(e) => updateExtractedData("pickup_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.pickup_floor ?? ""}
              onChange={(e) => updateExtractedData("pickup_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.pickup_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("pickup_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Storage Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Warehouse className="w-4 h-4" />
          {t("lead.section.storageDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.storageDuration")}</Label>
            <Select
              value={extractedData?.storage_duration || ""}
              onValueChange={(v) => updateExtractedData("storage_duration", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kurzfristig">{t("lead.option.storageDuration.kurzfristig")}</SelectItem>
                <SelectItem value="1-3_monate">{t("lead.option.storageDuration.m1_3")}</SelectItem>
                <SelectItem value="3-6_monate">{t("lead.option.storageDuration.m3_6")}</SelectItem>
                <SelectItem value="6-12_monate">{t("lead.option.storageDuration.m6_12")}</SelectItem>
                <SelectItem value="langfristig">{t("lead.option.storageDuration.langfristig")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.storageVolume")}</Label>
            <Select
              value={extractedData?.storage_volume || ""}
              onValueChange={(v) => updateExtractedData("storage_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">{t("lead.option.storageVolume.klein")}</SelectItem>
                <SelectItem value="mittel">{t("lead.option.storageVolume.mittel")}</SelectItem>
                <SelectItem value="gross">{t("lead.option.storageVolume.gross")}</SelectItem>
                <SelectItem value="sehr_gross">{t("lead.option.storageVolume.sehrGross")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.accessFrequency")}</Label>
            <Select
              value={extractedData?.access_frequency || ""}
              onValueChange={(v) => updateExtractedData("access_frequency", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nie">{t("lead.option.access.nie")}</SelectItem>
                <SelectItem value="selten">{t("lead.option.access.selten")}</SelectItem>
                <SelectItem value="monatlich">{t("lead.option.access.monatlich")}</SelectItem>
                <SelectItem value="wöchentlich">{t("lead.option.access.woechentlich")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="needs_climate_control"
              checked={!!extractedData?.needs_climate_control}
              onCheckedChange={(checked) => updateExtractedData("needs_climate_control", !!checked)}
            />
            <label htmlFor="needs_climate_control" className="text-sm cursor-pointer">
              {t("lead.field.climateControl")}
            </label>
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.storageItems")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.storageItems")}
              value={extractedData?.storage_items_description || ""}
              onChange={(e) => updateExtractedData("storage_items_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderKlaviertransportFields = () => (
    <>
      {/* From Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("klaviertransport", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* To Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("klaviertransport", locale).secondary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("lead.field.floor")}</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.hasLift")}</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{t("domain.yes")}</SelectItem>
                <SelectItem value="no">{t("domain.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Piano Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Piano className="w-4 h-4" />
          {t("lead.section.pianoDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.pianoType")}</Label>
            <Select
              value={extractedData?.piano_type || ""}
              onValueChange={(v) => updateExtractedData("piano_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klavier">{t("lead.option.piano.klavier")}</SelectItem>
                <SelectItem value="fluegel">{t("lead.option.piano.fluegel")}</SelectItem>
                <SelectItem value="e_piano">{t("lead.option.piano.ePiano")}</SelectItem>
                <SelectItem value="keyboard">{t("lead.option.piano.keyboard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.pianoBrand")}</Label>
            <Input
              value={extractedData?.piano_brand || ""}
              onChange={(e) => updateExtractedData("piano_brand", e.target.value)}
              placeholder={t("lead.placeholder.pianoBrand")}
            />
          </div>
          <div>
            <Label>{t("lead.field.pianoWeight")}</Label>
            <Input
              type="number"
              value={extractedData?.piano_weight_kg ?? ""}
              onChange={(e) => updateExtractedData("piano_weight_kg", e.target.value ? parseInt(e.target.value) : null)}
              placeholder={t("lead.placeholder.pianoWeight")}
            />
          </div>
          <div>
            <Label>{t("lead.field.staircaseType")}</Label>
            <Select
              value={extractedData?.staircase_type || ""}
              onValueChange={(v) => updateExtractedData("staircase_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keine">{t("lead.option.staircase.keine")}</SelectItem>
                <SelectItem value="gerade">{t("lead.option.staircase.gerade")}</SelectItem>
                <SelectItem value="kurvig">{t("lead.option.staircase.kurvig")}</SelectItem>
                <SelectItem value="wendel">{t("lead.option.staircase.wendel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.staircaseWidth")}</Label>
            <Input
              type="number"
              value={extractedData?.staircase_width_cm ?? ""}
              onChange={(e) => updateExtractedData("staircase_width_cm", e.target.value ? parseInt(e.target.value) : null)}
              placeholder={t("lead.placeholder.staircaseWidth")}
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="window_access_possible"
              checked={!!extractedData?.window_access_possible}
              onCheckedChange={(checked) => updateExtractedData("window_access_possible", !!checked)}
            />
            <label htmlFor="window_access_possible" className="text-sm cursor-pointer">
              {t("lead.field.windowAccess")}
            </label>
          </div>
        </div>
      </div>
    </>
  );

  const renderMoebelliftFields = () => (
    <>
      {/* Address */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {getAddressLabels("moebellift", locale).primary}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("common.street")}</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.houseNumber")}</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("common.plz")}</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>{t("common.city")}</Label>
            <Input
              value={extractedData?.address_city || ""}
              onChange={(e) => updateExtractedData("address_city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Lift Details */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          {t("lead.section.liftDetails")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("lead.field.liftFloor")}</Label>
            <Input
              type="number"
              value={extractedData?.moebellift_floor ?? ""}
              onChange={(e) => updateExtractedData("moebellift_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("lead.field.direction")}</Label>
            <Select
              value={extractedData?.direction || ""}
              onValueChange={(v) => updateExtractedData("direction", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoch">{t("lead.option.direction.hoch")}</SelectItem>
                <SelectItem value="runter">{t("lead.option.direction.runter")}</SelectItem>
                <SelectItem value="beides">{t("lead.option.direction.beides")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("lead.field.dimensions")}</Label>
            <Input
              value={extractedData?.moebellift_item_dimensions || ""}
              onChange={(e) => updateExtractedData("moebellift_item_dimensions", e.target.value)}
              placeholder={t("lead.placeholder.dimensions")}
            />
          </div>
          <div className="col-span-2">
            <Label>{t("lead.field.liftItems")}</Label>
            <Textarea
              placeholder={t("lead.placeholder.liftItems")}
              value={extractedData?.moebellift_item_description || ""}
              onChange={(e) => updateExtractedData("moebellift_item_description", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </>
  );

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("lead.import.pageTitle", { company: company.company_name })}</title>
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Folk-style header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📥</span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-folk-ink">{t("lead.import.title")}</h1>
            <p className="mt-1 text-[15px] text-folk-ink2">
              {t("lead.import.subtitle")}
            </p>
          </div>
        </div>

        {/* Step 1: Input */}
        {!previewMode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("lead.import.step1")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Input */}
              <VoiceRecorder
                onTranscriptReady={handleVoiceTranscript}
                disabled={isProcessing}
              />

              <div className="space-y-2">
                <Textarea
                  id="raw-text-input"
                  placeholder={t("lead.import.textPlaceholder")}
                  value={rawText}
                  onChange={handleRawTextChange}
                  rows={20}
                  className="font-mono text-sm"
                  aria-label={t("lead.import.textAria")}
                  aria-describedby="raw-text-helper"
                  maxLength={MAX_RAW_TEXT_LENGTH}
                />
                <div
                  id="raw-text-helper"
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>
                    {t("lead.import.minChars", { count: MIN_RAW_TEXT_LENGTH })}
                  </span>
                  <span className={rawText.length > MAX_RAW_TEXT_LENGTH * 0.9 ? 'text-amber-600 font-medium' : ''}>
                    {t("lead.import.charCount", {
                      current: formatNumber(rawText.length, locale),
                      max: formatNumber(MAX_RAW_TEXT_LENGTH, locale),
                    })}
                  </span>
                </div>
              </div>

              {/* Validation warning */}
              {rawText.length > 0 && rawText.trim().length < MIN_RAW_TEXT_LENGTH && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    {t("lead.import.moreDetails", {
                      count: MIN_RAW_TEXT_LENGTH - rawText.trim().length,
                    })}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 sm:gap-4">
                <Button
                  onClick={processWithAI}
                  disabled={!rawText.trim() || rawText.trim().length < MIN_RAW_TEXT_LENGTH || isProcessing}
                  size="lg"
                  className="min-w-0 flex-1 max-sm:px-0 sm:px-8"
                  aria-busy={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {processingStep || t("lead.import.processing")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t("lead.import.extract")}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isProcessing || !rawText}
                  aria-label={t("lead.import.resetAria")}
                  className="min-w-0 shrink-0 max-sm:px-0 sm:px-4"
                >
                  {t("common.reset")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Preview & Edit */}
        {previewMode && extractedData && (
          <>
            {/* Service Type & AI Confidence */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {SERVICE_TYPE_ICONS[extractedData.detected_service_type] || <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("lead.import.detectedService")}</p>
                      <p className="font-semibold text-lg">
                        {getServiceLabel(extractedData.detected_service_type, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t("lead.import.confidence")}</p>
                    <p className="font-bold text-2xl">{extractedData.confidence_score}%</p>
                  </div>
                </div>
                <Progress value={extractedData.confidence_score} className="h-2" />
                {extractedData.confidence_score < 80 && (
                  <Alert className="mt-4 bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      {t("lead.import.lowConfidence")}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{t("lead.import.step2")}</CardTitle>
                    <CardDescription>
                      {t("lead.import.step2Hint")}
                    </CardDescription>
                  </div>
                  <Select
                    value={extractedData.detected_service_type}
                    onValueChange={(v) => updateExtractedData("detected_service_type", v)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getServiceLabel(value, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Contact Information (Common for all) */}
                <div>
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t("lead.import.contactInfo")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t("common.firstName")}</Label>
                      <Input
                        value={extractedData.first_name || ""}
                        onChange={(e) => updateExtractedData("first_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("common.lastName")}</Label>
                      <Input
                        value={extractedData.last_name || ""}
                        onChange={(e) => updateExtractedData("last_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("common.email")}</Label>
                      <Input
                        type="email"
                        value={extractedData.email || ""}
                        onChange={(e) => updateExtractedData("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("common.phone")}</Label>
                      <Input
                        value={extractedData.phone || ""}
                        onChange={(e) => updateExtractedData("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Customer language (DOCUMENT locale) — explicitly NOT the operator's
                    dashboard language. Everything the customer receives is written in it. */}
                <div>
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {t("lead.import.languageSection")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer-language">{t("lead.import.languageLabel")}</Label>
                      <Select
                        value={extractedData.language}
                        onValueChange={(v) => updateExtractedData("language", v)}
                      >
                        <SelectTrigger id="customer-language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* The option list is the CUSTOMER's language axis — the endonym
                              (LOCALE_NAMES) is intentionally not routed through useT(). */}
                          {LOCALES.map((customerLocale) => (
                            <SelectItem key={customerLocale} value={customerLocale}>
                              {LOCALE_NAMES[customerLocale]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="self-end pb-2 text-xs text-muted-foreground">
                      {t("lead.import.languageHint")}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Date & Time (Common for all) */}
                <div>
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {t("lead.import.appointment")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t("lead.import.preferredDate")}</Label>
                      <DatePicker
                        value={extractedData.preferred_date || ""}
                        onChange={(value) => updateExtractedData("preferred_date", value)}
                      />
                    </div>
                    <div>
                      <Label>{t("lead.import.preferredTime")}</Label>
                      <Input
                        type="text"
                        placeholder={t("lead.placeholder.preferredTime")}
                        value={extractedData.preferred_time || ""}
                        onChange={(e) => updateExtractedData("preferred_time", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Service-specific fields */}
                {renderServiceFields()}

                <Separator />

                {/* Special Notes (Common for all) */}
                <div>
                  <Label>{t("lead.import.specialNotes")}</Label>
                  <Textarea
                    value={extractedData.special_notes || ""}
                    onChange={(e) => updateExtractedData("special_notes", e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleBackClick}
                    disabled={isSaving}
                    aria-label={t("lead.import.backAria")}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t("common.back")}
                  </Button>
                  <Button
                    onClick={saveAndCreateOfferte}
                    disabled={isSaving}
                    size="lg"
                    className="flex-1"
                    aria-busy={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("lead.import.saving")}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {t("lead.import.save")}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Back Confirmation Dialog */}
      <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lead.import.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("lead.import.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGoBack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("lead.import.discardConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FirmaManualImport;
