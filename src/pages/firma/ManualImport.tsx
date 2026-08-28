import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Package,
  Home,
  Trash2,
  Piano,
  Warehouse,
  Building,
} from "lucide-react";
import { toLocale } from "@/i18n/locale";
import { useI18n, useT } from "@/i18n/useI18n";
import type { Translator } from "@/i18n/translator";
import { getServiceLabel } from "@/i18n/domain";
import { formatNumber } from "@/i18n/format";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { fetchCompanyById } from "@/lib/fetchCompanyById";
import { useCompanyContext } from "@/hooks/useCompanyContext";
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
import { ExtractedLeadForm } from "@/components/leads/ExtractedLeadForm";
import { extractedLeadToLeadData } from "@/lib/extractedLeadToLeadData";
import type { ExtractedData } from "@/types/extractedLead";

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
  // Der ausgewaehlte Mandant ist die einzige Firmenquelle unter /firma.
  const { companyId: activeCompanyId } = useCompanyContext();
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
      // Ohne aufgeloesten Mandanten wird nicht geladen — der Bildschirm
      // bleibt im Ladezustand, statt eine Firma zu waehlen.
      if (!activeCompanyId) return;

      try {
        const companyData = await fetchCompanyById<Company>({
          companyId: activeCompanyId,
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
  }, [user, activeCompanyId, toast, t]);

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

      const leadData = extractedLeadToLeadData(extractedData);

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
                    <div className="p-2 bg-folk-card rounded-lg shadow-sm">
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
          <ExtractedLeadForm data={extractedData} onChange={updateExtractedData} />

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
