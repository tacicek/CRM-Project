import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Building
} from "lucide-react";
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
 * Get user-friendly error message
 */
const getUserFriendlyError = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message;
    // Pass through specific errors thrown by our own code
    if (msg.startsWith('Funktion:') || msg.startsWith('Import:') || msg.startsWith('Datenbankfehler:')) {
      return msg;
    }
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('network') || msgLower.includes('fetch')) {
      return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
    }
    if (msgLower.includes('timeout')) {
      return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
    }
    if (msgLower.includes('unauthorized') || msgLower.includes('401')) {
      return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
    }
    if (msgLower.includes('rate limit') || msgLower.includes('429')) {
      return 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
    }
  }
  return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
};

// Generic extracted data interface that can hold any service type fields
interface ExtractedData {
  // Base fields (all service types)
  detected_service_type: string;
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
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  umzug_privat: "Privatumzug",
  umzug_firma: "Firmenumzug",
  reinigung: "Reinigung",
  raeumung: "Räumung",
  entsorgung: "Entsorgung",
  lagerung: "Lagerung",
  klaviertransport: "Klaviertransport",
  moebellift: "Möbellift",
};

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
          select: "id, company_name, manual_import_monthly_fee, crm_enabled",
        });

        if (isMountedRef.current && companyData) {
          setCompany(companyData);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error("Error fetching company:", error);
          toast({
            title: "Fehler",
            description: "Firmendaten konnten nicht geladen werden.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    fetchCompany();
  }, [user, toast]);

  const processWithAI = useCallback(async () => {
    const trimmedText = rawText.trim();
    
    // Validation
    if (!trimmedText || !company) return;
    
    if (trimmedText.length < MIN_RAW_TEXT_LENGTH) {
      toast({
        title: "Text zu kurz",
        description: `Bitte geben Sie mindestens ${MIN_RAW_TEXT_LENGTH} Zeichen ein.`,
        variant: "destructive",
      });
      return;
    }

    if (trimmedText.length > MAX_RAW_TEXT_LENGTH) {
      toast({
        title: "Text zu lang",
        description: `Bitte kürzen Sie den Text auf maximal ${MAX_RAW_TEXT_LENGTH.toLocaleString('de-CH')} Zeichen.`,
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
    setProcessingStep("Analysiere Text...");

    try {
      // Sanitize the input
      const sanitizedText = sanitizeText(trimmedText);
      
      setProcessingStep("Extrahiere Daten mit AI...");
      
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
      };

      // Validate date format if provided
      if (extractedWithDefaults.preferred_date && !isValidDateFormat(extractedWithDefaults.preferred_date)) {
        extractedWithDefaults.preferred_date = null;
      }

      setExtractedData(extractedWithDefaults);
      setPreviewMode(true);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Daten extrahiert",
        description: `Service: ${SERVICE_TYPE_LABELS[extractedWithDefaults.detected_service_type] || extractedWithDefaults.detected_service_type} | AI-Konfidenz: ${extractedWithDefaults.confidence_score}%`,
      });
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') return;
      
      toast({
        title: "Extraktion fehlgeschlagen",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setProcessingStep("");
      }
    }
  }, [rawText, company, toast]);

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
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    // Validate phone format
    if (extractedData.phone && !isValidSwissPhone(extractedData.phone)) {
      toast({
        title: "Ungültige Telefonnummer",
        description: "Bitte geben Sie eine gültige Schweizer Telefonnummer ein (z.B. +41 79 123 45 67).",
        variant: "destructive",
      });
      return;
    }

    // Validate Swiss PLZ (4 digits)
    const validatePLZ = (plz: string | null | undefined, fieldName: string): boolean => {
      if (plz && !/^\d{4}$/.test(plz)) {
        toast({
          title: "Ungültige PLZ",
          description: `${fieldName}: "${plz}" ist keine gültige Schweizer PLZ (4 Ziffern).`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    };

    const plzFields = [
      { value: extractedData.from_plz, name: "Von PLZ" },
      { value: extractedData.to_plz, name: "Nach PLZ" },
      { value: extractedData.address_plz, name: "Adresse PLZ" },
      { value: extractedData.pickup_plz, name: "Abhol-PLZ" },
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
          ? "Abhol-PLZ"
          : serviceType === "umzug_privat" || serviceType === "klaviertransport"
            ? "Von PLZ"
            : "Adresse PLZ";
      toast({
        title: "PLZ erforderlich",
        description: `${fieldLabel} ist für diesen Servicetyp erforderlich. Bitte geben Sie eine gültige Schweizer PLZ (4 Ziffern) ein.`,
        variant: "destructive",
      });
      return;
    }

    // Validate date format
    if (extractedData.preferred_date && !isValidDateFormat(extractedData.preferred_date)) {
      toast({
        title: "Ungültiges Datum",
        description: "Bitte geben Sie ein gültiges Datum ein.",
        variant: "destructive",
      });
      return;
    }

    // Validate required customer info for low confidence
    if (extractedData.confidence_score < 50) {
      if (!extractedData.first_name && !extractedData.last_name) {
        toast({
          title: "Fehlende Kundendaten",
          description: "Bei niedriger AI-Konfidenz muss mindestens ein Name angegeben werden.",
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
          title: "Sitzung abgelaufen",
          description: "Bitte laden Sie die Seite neu oder melden Sie sich erneut an.",
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
        throw new Error(`Import: ${data?.error || "Import fehlgeschlagen"}`);
      }

      // Reset form state before navigation
      setRawText("");
      setExtractedData(null);
      setPreviewMode(false);
      setHasUnsavedChanges(false);

      toast({
        title: "Anfrage importiert",
        description: "Die Anfrage wurde erfolgreich importiert und ist jetzt in Ihren Anfragen sichtbar.",
      });

      navigate("/firma/anfragen");
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') return;
      
      toast({
        title: "Fehler beim Speichern",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [extractedData, company, user, isSaving, rawText, toast, navigate]);

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
          Auszugadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>Etage</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Lift vorhanden?</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zimmer</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.from_rooms ?? ""}
              onChange={(e) => updateExtractedData("from_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Wohnfläche (m²)</Label>
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
          Einzugadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>Etage</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Lift vorhanden?</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
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
          Zusatzleistungen
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "packing_service_needed", label: "Einpackservice" },
            { key: "furniture_assembly_needed", label: "Möbelmontage" },
            { key: "cleaning_service_needed", label: "Reinigung" },
            { key: "storage_needed", label: "Einlagerung" },
            { key: "piano_transport_needed", label: "Klaviertransport" },
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
          Reinigungsadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
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
          Objektdetails
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Objekttyp</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">Wohnung</SelectItem>
                <SelectItem value="Haus">Haus</SelectItem>
                <SelectItem value="Studio">Studio</SelectItem>
                <SelectItem value="Büro">Büro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zimmer</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Wohnfläche (m²)</Label>
            <Input
              type="number"
              value={extractedData?.living_space_m2 ?? ""}
              onChange={(e) => updateExtractedData("living_space_m2", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Badezimmer</Label>
            <Input
              type="number"
              value={extractedData?.bathroom_count ?? ""}
              onChange={(e) => updateExtractedData("bathroom_count", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Küchentyp</Label>
            <Select
              value={extractedData?.kitchen_type || ""}
              onValueChange={(v) => updateExtractedData("kitchen_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offen">Offene Küche</SelectItem>
                <SelectItem value="geschlossen">Geschlossene Küche</SelectItem>
                <SelectItem value="kochnische">Kochnische</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reinigungsart</Label>
            <Select
              value={extractedData?.cleaning_type || ""}
              onValueChange={(v) => updateExtractedData("cleaning_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Endreinigung">Endreinigung</SelectItem>
                <SelectItem value="Grundreinigung">Grundreinigung</SelectItem>
                <SelectItem value="Unterhaltsreinigung">Unterhaltsreinigung</SelectItem>
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
          Zusätzliche Bereiche
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "has_balcony", label: "Balkon/Terrasse" },
            { key: "has_garage", label: "Garage" },
            { key: "has_basement", label: "Keller" },
            { key: "has_attic", label: "Estrich/Dachboden" },
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
          Räumungsadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
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
          Räumungsdetails
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Räumungsart</Label>
            <Select
              value={extractedData?.clearing_type || ""}
              onValueChange={(v) => updateExtractedData("clearing_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnungsräumung">Wohnungsräumung</SelectItem>
                <SelectItem value="Hausräumung">Hausräumung</SelectItem>
                <SelectItem value="Kellerräumung">Kellerräumung</SelectItem>
                <SelectItem value="Dachbodenräumung">Dachbodenräumung</SelectItem>
                <SelectItem value="Büroräumung">Büroräumung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Objekttyp</Label>
            <Select
              value={extractedData?.property_type || ""}
              onValueChange={(v) => updateExtractedData("property_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wohnung">Wohnung</SelectItem>
                <SelectItem value="Haus">Haus</SelectItem>
                <SelectItem value="Keller">Keller</SelectItem>
                <SelectItem value="Estrich">Estrich</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zimmer</Label>
            <Input
              type="number"
              step="0.5"
              value={extractedData?.number_of_rooms ?? ""}
              onChange={(e) => updateExtractedData("number_of_rooms", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Geschätztes Volumen</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">Klein (wenige Gegenstände)</SelectItem>
                <SelectItem value="mittel">Mittel (teilmöbliert)</SelectItem>
                <SelectItem value="gross">Gross (vollmöbliert)</SelectItem>
                <SelectItem value="sehr_gross">Sehr gross (überfüllt)</SelectItem>
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
                Schwere Gegenstände vorhanden
              </label>
            </div>
            {extractedData?.has_heavy_items && (
              <Textarea
                placeholder="Beschreibung der schweren Gegenstände..."
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
          Entsorgungsadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
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
          Entsorgungsdetails
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Entsorgungsart</Label>
            <Select
              value={extractedData?.disposal_type || ""}
              onValueChange={(v) => updateExtractedData("disposal_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sperrmüll">Sperrmüll</SelectItem>
                <SelectItem value="Elektroschrott">Elektroschrott</SelectItem>
                <SelectItem value="Bauschutt">Bauschutt</SelectItem>
                <SelectItem value="Hausrat">Hausrat</SelectItem>
                <SelectItem value="Möbel">Möbel</SelectItem>
                <SelectItem value="Gemischt">Gemischt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Geschätztes Volumen</Label>
            <Select
              value={extractedData?.estimated_volume || ""}
              onValueChange={(v) => updateExtractedData("estimated_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">Klein (1-2 m³)</SelectItem>
                <SelectItem value="mittel">Mittel (3-5 m³)</SelectItem>
                <SelectItem value="gross">Gross (6-10 m³)</SelectItem>
                <SelectItem value="sehr_gross">Sehr gross (10+ m³)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Beschreibung der Gegenstände</Label>
            <Textarea
              placeholder="Was soll entsorgt werden..."
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
          Abholadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.pickup_street || ""}
              onChange={(e) => updateExtractedData("pickup_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.pickup_house_number || ""}
              onChange={(e) => updateExtractedData("pickup_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.pickup_plz || ""}
              onChange={(e) => updateExtractedData("pickup_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={extractedData?.pickup_city || ""}
              onChange={(e) => updateExtractedData("pickup_city", e.target.value)}
            />
          </div>
          <div>
            <Label>Etage</Label>
            <Input
              type="number"
              value={extractedData?.pickup_floor ?? ""}
              onChange={(e) => updateExtractedData("pickup_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Lift vorhanden?</Label>
            <Select
              value={extractedData?.pickup_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("pickup_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
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
          Lagerungsdetails
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Lagerdauer</Label>
            <Select
              value={extractedData?.storage_duration || ""}
              onValueChange={(v) => updateExtractedData("storage_duration", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kurzfristig">Kurzfristig (wenige Tage)</SelectItem>
                <SelectItem value="1-3_monate">1-3 Monate</SelectItem>
                <SelectItem value="3-6_monate">3-6 Monate</SelectItem>
                <SelectItem value="6-12_monate">6-12 Monate</SelectItem>
                <SelectItem value="langfristig">Langfristig (1+ Jahr)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Volumen</Label>
            <Select
              value={extractedData?.storage_volume || ""}
              onValueChange={(v) => updateExtractedData("storage_volume", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klein">Klein (1-5 m³)</SelectItem>
                <SelectItem value="mittel">Mittel (5-15 m³)</SelectItem>
                <SelectItem value="gross">Gross (15-30 m³)</SelectItem>
                <SelectItem value="sehr_gross">Sehr gross (30+ m³)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zugriffshäufigkeit</Label>
            <Select
              value={extractedData?.access_frequency || ""}
              onValueChange={(v) => updateExtractedData("access_frequency", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nie">Kein Zugriff nötig</SelectItem>
                <SelectItem value="selten">Selten</SelectItem>
                <SelectItem value="monatlich">Monatlich</SelectItem>
                <SelectItem value="wöchentlich">Wöchentlich</SelectItem>
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
              Klimatisierter Lagerraum benötigt
            </label>
          </div>
          <div className="col-span-2">
            <Label>Was wird eingelagert?</Label>
            <Textarea
              placeholder="Beschreibung der Lagergüter..."
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
          Abholadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.from_street || ""}
              onChange={(e) => updateExtractedData("from_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.from_house_number || ""}
              onChange={(e) => updateExtractedData("from_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.from_plz || ""}
              onChange={(e) => updateExtractedData("from_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={extractedData?.from_city || ""}
              onChange={(e) => updateExtractedData("from_city", e.target.value)}
            />
          </div>
          <div>
            <Label>Etage</Label>
            <Input
              type="number"
              value={extractedData?.from_floor ?? ""}
              onChange={(e) => updateExtractedData("from_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Lift vorhanden?</Label>
            <Select
              value={extractedData?.from_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("from_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
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
          Lieferadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.to_street || ""}
              onChange={(e) => updateExtractedData("to_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.to_house_number || ""}
              onChange={(e) => updateExtractedData("to_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.to_plz || ""}
              onChange={(e) => updateExtractedData("to_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input
              value={extractedData?.to_city || ""}
              onChange={(e) => updateExtractedData("to_city", e.target.value)}
            />
          </div>
          <div>
            <Label>Etage</Label>
            <Input
              type="number"
              value={extractedData?.to_floor ?? ""}
              onChange={(e) => updateExtractedData("to_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Lift vorhanden?</Label>
            <Select
              value={extractedData?.to_has_elevator ? "yes" : "no"}
              onValueChange={(v) => updateExtractedData("to_has_elevator", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nein</SelectItem>
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
          Klavierdetails
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Klaviertyp</Label>
            <Select
              value={extractedData?.piano_type || ""}
              onValueChange={(v) => updateExtractedData("piano_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="klavier">Klavier (aufrecht)</SelectItem>
                <SelectItem value="fluegel">Flügel</SelectItem>
                <SelectItem value="e_piano">E-Piano</SelectItem>
                <SelectItem value="keyboard">Keyboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marke</Label>
            <Input
              value={extractedData?.piano_brand || ""}
              onChange={(e) => updateExtractedData("piano_brand", e.target.value)}
              placeholder="z.B. Steinway, Yamaha"
            />
          </div>
          <div>
            <Label>Gewicht (kg)</Label>
            <Input
              type="number"
              value={extractedData?.piano_weight_kg ?? ""}
              onChange={(e) => updateExtractedData("piano_weight_kg", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="ca. 200-500 kg"
            />
          </div>
          <div>
            <Label>Treppentyp</Label>
            <Select
              value={extractedData?.staircase_type || ""}
              onValueChange={(v) => updateExtractedData("staircase_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keine">Keine Treppe</SelectItem>
                <SelectItem value="gerade">Gerade Treppe</SelectItem>
                <SelectItem value="kurvig">Kurvige Treppe</SelectItem>
                <SelectItem value="wendel">Wendeltreppe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Treppenbreite (cm)</Label>
            <Input
              type="number"
              value={extractedData?.staircase_width_cm ?? ""}
              onChange={(e) => updateExtractedData("staircase_width_cm", e.target.value ? parseInt(e.target.value) : null)}
              placeholder="z.B. 90, 100"
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="window_access_possible"
              checked={!!extractedData?.window_access_possible}
              onCheckedChange={(checked) => updateExtractedData("window_access_possible", !!checked)}
            />
            <label htmlFor="window_access_possible" className="text-sm cursor-pointer">
              Fensterzugang möglich (für Kran)
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
          Einsatzadresse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Strasse</Label>
            <Input
              value={extractedData?.address_street || ""}
              onChange={(e) => updateExtractedData("address_street", e.target.value)}
            />
          </div>
          <div>
            <Label>Hausnummer</Label>
            <Input
              value={extractedData?.address_house_number || ""}
              onChange={(e) => updateExtractedData("address_house_number", e.target.value)}
            />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input
              value={extractedData?.address_plz || ""}
              onChange={(e) => updateExtractedData("address_plz", e.target.value)}
              maxLength={4}
            />
          </div>
          <div>
            <Label>Ort</Label>
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
          Möbellift-Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Stockwerk</Label>
            <Input
              type="number"
              value={extractedData?.moebellift_floor ?? ""}
              onChange={(e) => updateExtractedData("moebellift_floor", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Richtung</Label>
            <Select
              value={extractedData?.direction || ""}
              onValueChange={(v) => updateExtractedData("direction", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoch">Hoch (Einzug)</SelectItem>
                <SelectItem value="runter">Runter (Auszug)</SelectItem>
                <SelectItem value="beides">Beides</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Masse (ca.)</Label>
            <Input
              value={extractedData?.moebellift_item_dimensions || ""}
              onChange={(e) => updateExtractedData("moebellift_item_dimensions", e.target.value)}
              placeholder="z.B. 200x100x50 cm"
            />
          </div>
          <div className="col-span-2">
            <Label>Beschreibung der Gegenstände</Label>
            <Textarea
              placeholder="Was soll mit dem Möbellift transportiert werden..."
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
        <title>Manuelle Anfrage Import | {company.company_name}</title>
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Folk-style header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📥</span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Anfrage importieren</h1>
            <p className="mt-1 text-[13px] text-folk-ink2">
              Anfrage aus E-Mail oder Webformular einfügen — die KI erkennt Service-Typ und extrahiert alle Informationen.
            </p>
          </div>
        </div>

        {/* Step 1: Input */}
        {!previewMode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schritt 1: Anfrage-Text einfügen</CardTitle>
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
                  placeholder={`Kopieren Sie hier die gesamte Anfrage aus Ihrer E-Mail oder Webformular...

Beispiele für verschiedene Anfragen:

📦 UMZUG:
Von: max.mustermann@email.com
Ich brauche einen Umzug von Zürich nach Bern.
Auszug: Hauptstrasse 123, 8001 Zürich, 3. OG
Einzug: Bahnhofplatz 5, 3011 Bern, EG
3.5 Zimmer, 80m², Datum: 15.02.2025

🧹 REINIGUNG:
Guten Tag, ich brauche eine Endreinigung.
Adresse: Seestrasse 45, 8800 Thalwil
4 Zimmer Wohnung, 95m², 2 Bäder
Mit Balkon und Keller

🎹 KLAVIERTRANSPORT:
Wir möchten einen Flügel transportieren.
Von: Bahnhofstr. 10, 8001 Zürich (2. Stock)
Nach: Seeweg 5, 6300 Zug (Erdgeschoss)
Steinway Flügel, ca. 350kg`}
                  value={rawText}
                  onChange={handleRawTextChange}
                  rows={20}
                  className="font-mono text-sm"
                  aria-label="Anfrage-Text eingeben"
                  aria-describedby="raw-text-helper"
                  maxLength={MAX_RAW_TEXT_LENGTH}
                />
                <div 
                  id="raw-text-helper" 
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>
                    Mindestens {MIN_RAW_TEXT_LENGTH} Zeichen erforderlich
                  </span>
                  <span className={rawText.length > MAX_RAW_TEXT_LENGTH * 0.9 ? 'text-amber-600 font-medium' : ''}>
                    {rawText.length.toLocaleString('de-CH')} / {MAX_RAW_TEXT_LENGTH.toLocaleString('de-CH')} Zeichen
                  </span>
                </div>
              </div>

              {/* Validation warning */}
              {rawText.length > 0 && rawText.trim().length < MIN_RAW_TEXT_LENGTH && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Bitte geben Sie mehr Details ein ({MIN_RAW_TEXT_LENGTH - rawText.trim().length} Zeichen fehlen).
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
                      {processingStep || 'Verarbeite...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Mit AI extrahieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isProcessing || !rawText}
                  aria-label="Text zurücksetzen"
                  className="min-w-0 shrink-0 max-sm:px-0 sm:px-4"
                >
                  Zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Preview & Edit */}
        {previewMode && extractedData && (
          <>
            {/* Service Type & AI Confidence */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-card rounded-lg shadow-sm">
                      {SERVICE_TYPE_ICONS[extractedData.detected_service_type] || <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Erkannter Service-Typ</p>
                      <p className="font-semibold text-lg">
                        {SERVICE_TYPE_LABELS[extractedData.detected_service_type] || extractedData.detected_service_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">AI Konfidenz</p>
                    <p className="font-bold text-2xl">{extractedData.confidence_score}%</p>
                  </div>
                </div>
                <Progress value={extractedData.confidence_score} className="h-2" />
                {extractedData.confidence_score < 80 && (
                  <Alert className="mt-4 bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      Bitte überprüfen Sie die extrahierten Daten sorgfältig.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Schritt 2: Extrahierte Daten überprüfen</CardTitle>
                    <CardDescription>
                      Überprüfen und korrigieren Sie die extrahierten Daten
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
                      {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
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
                    Kontaktinformation
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Vorname</Label>
                      <Input
                        value={extractedData.first_name || ""}
                        onChange={(e) => updateExtractedData("first_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Nachname</Label>
                      <Input
                        value={extractedData.last_name || ""}
                        onChange={(e) => updateExtractedData("last_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>E-Mail</Label>
                      <Input
                        type="email"
                        value={extractedData.email || ""}
                        onChange={(e) => updateExtractedData("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Telefon</Label>
                      <Input
                        value={extractedData.phone || ""}
                        onChange={(e) => updateExtractedData("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Date & Time (Common for all) */}
                <div>
                  <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Termin
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Wunschdatum</Label>
                      <Input
                        type="date"
                        value={extractedData.preferred_date || ""}
                        onChange={(e) => updateExtractedData("preferred_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Uhrzeit / Zeitraum</Label>
                      <Input
                        type="text"
                        placeholder="z.B. 09:00, Morgen, Nachmittag"
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
                  <Label>Besondere Hinweise</Label>
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
                    aria-label="Zurück zur Texteingabe"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück
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
                        Speichere...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Anfrage speichern
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
            <AlertDialogTitle>Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben ungespeicherte Änderungen. Wenn Sie zurückgehen, gehen alle 
              Änderungen verloren. Möchten Sie wirklich fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGoBack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwerfen & Zurück
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FirmaManualImport;
