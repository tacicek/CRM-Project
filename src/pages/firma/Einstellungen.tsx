import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Building2, Bell, FileText, MessageSquare, Eye, EyeOff, CheckCircle, Mail, Bot, Languages } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/useI18n";
import { LOCALES, LOCALE_NAMES, toLocale } from "@/i18n/locale";
import { getServiceLabel } from "@/i18n/domain";
import { LogoUpload } from "@/components/firma/LogoUpload";
import { SignatureUpload } from "@/components/firma/SignatureUpload";
import { AgbSectionEditor } from "@/components/firma/AgbSectionEditor";
import { ReminderSettings } from "@/components/firma/ReminderSettings";
import { cn } from "@/lib/utils";
interface Company {
  id: string;
  company_name: string;
  legal_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  street: string | null;
  house_number: string | null;
  plz: string;
  city: string;
  canton: string | null;
  notification_email: string | null;
  notification_phone: string | null;
  logo_url: string | null;
  signature_url: string | null;
  mwst_number: string | null;
  iban: string | null;
  default_terms_and_conditions: string | null;
  default_payment_terms: string | null;
  primary_color: string | null;
  pdf_template: string | null;
  /** Dashboard-Sprache der Firma (de | fr | en) — NICHT die Sprache der Kundendokumente. */
  default_language: string | null;
  twilio_enabled: boolean | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_phone_number: string | null;
  sms_reminders_enabled: boolean | null;
  resend_enabled: boolean | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  lead_sharing_preference: 'only_1' | 'only_3' | 'only_5' | 'both' | null;
}





const PROFILE_DRAFT_KEY = "einstellungen_profile_draft";

const PROFILE_DRAFT_FIELDS = [
  "company_name", "legal_name", "email", "phone", "website",
  "street", "house_number", "plz", "city", "canton",
  "notification_email", "notification_phone",
  "mwst_number", "iban",
  "default_terms_and_conditions", "default_payment_terms",
  "primary_color", "pdf_template", "default_language",
] as const;

const FirmaEinstellungen = () => {
  const { user } = useAuth();
  const { refresh: refreshCompanyContext } = useCompanyContext();
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedTemplateService, setSelectedTemplateService] = useState<string>("umzug");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai" | "gemini">("anthropic");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicKeyMasked, setAnthropicKeyMasked] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyMasked, setGeminiKeyMasked] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState("");
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  // Draft tracking: user's unsaved profile changes persist across navigation
  const [isDirty, setIsDirty] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Update a profile field and mark form as dirty
  const setProfileField = useCallback(<K extends keyof Company>(field: K, value: Company[K]) => {
    setCompany(prev => prev ? { ...prev, [field]: value } : null);
    setIsDirty(true);
  }, []);

  // Save draft to sessionStorage (debounced 600ms) when form is dirty
  useEffect(() => {
    if (!isDirty || !company) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const draft = Object.fromEntries(
        PROFILE_DRAFT_FIELDS.map(f => [f, company[f as keyof Company]])
      );
      sessionStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(draft));
    }, 600);
    return () => clearTimeout(draftTimerRef.current);
  }, [company, isDirty]);

  // For AGB template selector only — keys must match the service_type values
  // stored on leads (e.g. "malerarbeit" singular, NOT "malerarbeiten").

  // Category labels for service catalog


  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get company
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "*",
        });

        if (!companyData) return;

        // Load existing AI settings
        const { data: aiRows } = await supabase
          .from("api_keys")
          .select("key_name, key_value")
          .eq("company_id", companyData.id)
          .in("key_name", [
            "ai_provider",
            "anthropic_api_key", "anthropic_model",
            "openai_api_key",    "openai_model",
            "gemini_api_key",    "gemini_model",
          ]);
        for (const row of (aiRows ?? [])) {
          if (row.key_name === "ai_provider")     setAiProvider(row.key_value as "anthropic" | "openai" | "gemini");
          if (row.key_name === "anthropic_api_key") { setAnthropicKey(row.key_value); setAnthropicKeyMasked(true); }
          if (row.key_name === "anthropic_model")   setAnthropicModel(row.key_value);
          if (row.key_name === "openai_api_key")    { setOpenaiKey(row.key_value); setOpenaiKeyMasked(true); }
          if (row.key_name === "openai_model")      setOpenaiModel(row.key_value);
          if (row.key_name === "gemini_api_key")    { setGeminiKey(row.key_value); setGeminiKeyMasked(true); }
          if (row.key_name === "gemini_model")      setGeminiModel(row.key_value);
        }

        // Restore unsaved draft if user navigated away before saving
        const savedDraft = sessionStorage.getItem(PROFILE_DRAFT_KEY);
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            setCompany({ ...companyData, ...draft });
            setIsDirty(true);
          } catch {
            setCompany(companyData);
          }
        } else {
          setCompany(companyData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!company) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          company_name: company.company_name,
          legal_name: company.legal_name,
          email: company.email,
          phone: company.phone,
          website: company.website,
          street: company.street,
          house_number: company.house_number,
          plz: company.plz,
          city: company.city,
          canton: company.canton,
          notification_email: company.notification_email,
          notification_phone: company.notification_phone,
          mwst_number: company.mwst_number,
          iban: company.iban,
          default_terms_and_conditions: company.default_terms_and_conditions,
          default_payment_terms: company.default_payment_terms,
          primary_color: company.primary_color,
          // Spalte ist NOT NULL DEFAULT 'classic' — null (z. B. alter Draft) fällt auf den Default zurück
          pdf_template: company.pdf_template ?? "classic",
          // Spalte ist NOT NULL DEFAULT 'de'; toLocale() verwirft unbekannte Werte
          default_language: toLocale(company.default_language),
        })
        .eq("id", company.id);

      if (error) throw error;

      // Clear draft — changes are now saved to DB
      sessionStorage.removeItem(PROFILE_DRAFT_KEY);
      setIsDirty(false);

      // Die Dashboard-Sprache kommt aus dem CompanyContext (activeCompany.default_language).
      // Ohne dieses Refresh bliebe der Context auf dem alten Wert und die soeben gespeicherte
      // Firmensprache würde erst nach einem Reload sichtbar.
      await refreshCompanyContext();

      toast({
        title: t("common.success"),
        description: t("settings.profile.saved"),
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: t("common.error"),
        description: t("settings.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTwilioSettings = async () => {
    if (!company) return;
    setIsSavingTwilio(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          twilio_enabled: company.twilio_enabled,
          twilio_account_sid: company.twilio_account_sid,
          twilio_auth_token: company.twilio_auth_token,
          twilio_phone_number: company.twilio_phone_number,
          sms_reminders_enabled: company.sms_reminders_enabled,
        })
        .eq("id", company.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("settings.sms.saved"),
      });
    } catch (error) {
      console.error("Error saving Twilio settings:", error);
      toast({
        title: t("common.error"),
        description: t("settings.sms.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const upsertApiKey = async (keyName: string, keyValue: string) => {
    if (!company) return;
    const { error } = await supabase
      .from("api_keys")
      .upsert({ company_id: company.id, key_name: keyName, key_value: keyValue }, { onConflict: "company_id,key_name" });
    if (error) throw error;
  };

  const deleteApiKey = async (keyName: string) => {
    if (!company) return;
    await supabase.from("api_keys").delete().eq("company_id", company.id).eq("key_name", keyName);
  };

  const handleSaveAiSettings = async () => {
    if (!company) return;
    setIsSavingAiSettings(true);
    try {
      await upsertApiKey("ai_provider", aiProvider);
      if (anthropicKey.trim() && !anthropicKeyMasked) await upsertApiKey("anthropic_api_key", anthropicKey.trim());
      if (anthropicModel.trim()) await upsertApiKey("anthropic_model", anthropicModel.trim());
      if (openaiKey.trim() && !openaiKeyMasked) await upsertApiKey("openai_api_key", openaiKey.trim());
      if (openaiModel.trim()) await upsertApiKey("openai_model", openaiModel.trim());
      if (geminiKey.trim() && !geminiKeyMasked) await upsertApiKey("gemini_api_key", geminiKey.trim());
      if (geminiModel.trim()) await upsertApiKey("gemini_model", geminiModel.trim());
      setAnthropicKeyMasked(!!anthropicKey.trim());
      setOpenaiKeyMasked(!!openaiKey.trim());
      setGeminiKeyMasked(!!geminiKey.trim());
      setShowAnthropicKey(false); setShowOpenaiKey(false); setShowGeminiKey(false);
      toast({ title: t("common.success"), description: t("settings.ki.saved") });
    } catch (err) {
      console.error("Error saving AI settings:", err);
      toast({ title: t("common.error"), description: t("settings.ki.saveFailed"), variant: "destructive" });
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const handleSaveResendSettings = async () => {
    if (!company) return;
    setIsSavingResend(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          resend_enabled: company.resend_enabled,
          resend_api_key: company.resend_api_key,
          resend_from_email: company.resend_from_email,
          resend_from_name: company.resend_from_name,
        })
        .eq("id", company.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("settings.email.saved"),
      });
    } catch (error) {
      console.error("Error saving Resend settings:", error);
      toast({
        title: t("common.error"),
        description: t("settings.email.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSavingResend(false);
    }
  };

  const handleTestResendEmail = async () => {
    if (!company || !company.resend_api_key || !company.resend_from_email) {
      toast({
        title: t("common.error"),
        description: t("settings.email.testMissingConfig"),
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: t("settings.email.sessionExpired"),
          description: t("settings.email.sessionExpiredDescription"),
          variant: "destructive",
        });
        setIsTestingEmail(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('test-resend-email', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          company_id: company.id,
          to_email: company.notification_email || company.resend_from_email || company.email,
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: t("settings.email.testSuccess"),
        description: t("settings.email.testSuccessDescription", {
          email: company.notification_email || company.resend_from_email || company.email,
        }),
      });
    } catch (error: unknown) {
      console.error("Error testing Resend email:", error);
      toast({
        title: t("settings.email.testFailed"),
        description: error instanceof Error ? error.message : t("settings.email.testFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  // AGB-Vorlagen sind nach service_type geschlüsselt; die Anzeige folgt der Dashboard-Sprache.
  const availableServices = useMemo(
    () =>
      ["umzug", "reinigung", "raeumung", "transport", "lagerung", "entsorgung", "sonstige"].map(
        (type) => ({ type, label: getServiceLabel(type, locale) })
      ),
    [locale]
  );

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>{t("settings.pageTitle")}</title>
        </Helmet>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Helmet>
          <title>{t("settings.pageTitle")}</title>
        </Helmet>
          <div className="text-center py-12 text-muted-foreground">
            {t("settings.companyNotFound")}
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("settings.pageTitle")}</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">⚙️</span>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">{t("settings.title")}</h1>
              <p className="mt-1 text-[15px] text-folk-ink2">
                {t("settings.subtitle")}
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="profile">{t("settings.tab.profile")}</TabsTrigger>
              <TabsTrigger value="notifications">{t("settings.tab.notifications")}</TabsTrigger>
              <TabsTrigger value="email">{t("settings.tab.email")} (Resend)</TabsTrigger>
              <TabsTrigger value="sms">{t("settings.tab.sms")} (Twilio)</TabsTrigger>
              <TabsTrigger value="reminders">{t("settings.tab.reminders")}</TabsTrigger>
              <TabsTrigger value="offerten">{t("settings.tab.agb")}</TabsTrigger>
              <TabsTrigger value="ki">{t("settings.tab.ki")}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {t("settings.profile.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.profile.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo Upload */}
                  {user && (
                    <LogoUpload
                      currentLogoUrl={company.logo_url}
                      userId={user.id}
                      companyId={company.id}
                      onLogoChange={(newUrl) =>
                        setCompany({ ...company, logo_url: newUrl })
                      }
                    />
                  )}

                  <Separator />

                  {/* Signature Upload */}
                  {user && (
                    <SignatureUpload
                      currentSignatureUrl={company.signature_url}
                      userId={user.id}
                      companyId={company.id}
                      onSignatureChange={(newUrl) =>
                        setCompany({ ...company, signature_url: newUrl })
                      }
                    />
                  )}

                  <Separator />

                  {/* Primary Color */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="primary_color">{t("settings.profile.primaryColor")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.profile.primaryColorHint")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="primary_color"
                        type="color"
                        value={company.primary_color || "#3b82f6"}
                        onChange={(e) =>
                          setProfileField("primary_color", e.target.value)
                        }
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={company.primary_color || "#3b82f6"}
                        onChange={(e) =>
                          setProfileField("primary_color", e.target.value)
                        }
                        className="w-24 font-mono text-sm"
                        maxLength={7}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Offerte PDF-Vorlage */}
                  <div className="space-y-3">
                    <div>
                      <Label>{t("settings.pdf.offerTitle")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.pdf.hint")}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        { id: "classic", label: t("settings.pdf.classic"), desc: t("settings.pdf.classicDesc") },
                        { id: "modern", label: t("settings.pdf.modern"), desc: t("settings.pdf.modernDesc") },
                      ] as const).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setProfileField("pdf_template", template.id)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                            (company.pdf_template ?? "classic") === template.id
                              ? "bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300"
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span className="font-medium text-sm">{template.label}</span>
                          <span className="text-xs text-muted-foreground mt-0.5">{template.desc}</span>
                          {(company.pdf_template ?? "classic") === template.id && (
                            <CheckCircle className="w-4 h-4 mt-1 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Firmensprache — Dashboard-Sprache der Firma, NICHT die Sprache der Kundendokumente */}
                  <div className="space-y-3">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Languages className="w-4 h-4" />
                        {t("settings.language.default")}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.language.defaultHint")}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {LOCALES.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setProfileField("default_language", l)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all",
                            toLocale(company.default_language) === l
                              ? "bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300"
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span className="font-medium text-sm">{LOCALE_NAMES[l]}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs uppercase text-muted-foreground">{l}</span>
                            {toLocale(company.default_language) === l && (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                      {t("settings.language.customerNotice")}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">{t("settings.profile.companyData")}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>{t("settings.profile.companyName")}</Label>
                        <Input
                          value={company.company_name}
                          onChange={(e) =>
                            setProfileField("company_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("settings.profile.legalName")}</Label>
                        <Input
                          value={company.legal_name || ""}
                          onChange={(e) =>
                            setProfileField("legal_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("common.email")}</Label>
                        <Input
                          type="email"
                          value={company.email}
                          onChange={(e) =>
                            setProfileField("email", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("common.phone")}</Label>
                        <Input
                          value={company.phone || ""}
                          onChange={(e) =>
                            setProfileField("phone", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>{t("settings.profile.website")}</Label>
                        <Input
                          value={company.website || ""}
                          onChange={(e) =>
                            setProfileField("website", e.target.value)
                          }
                          placeholder="https://"
                        />
                      </div>
                      <div>
                        <Label>{t("settings.profile.vatNumber")}</Label>
                        <Input
                          value={company.mwst_number || ""}
                          onChange={(e) =>
                            setProfileField("mwst_number", e.target.value)
                          }
                          placeholder="CHE-XXX.XXX.XXX"
                        />
                      </div>
                      <div>
                        <Label>{t("settings.profile.iban")}</Label>
                        <Input
                          value={company.iban || ""}
                          onChange={(e) =>
                            setProfileField("iban", e.target.value)
                          }
                          placeholder="CH00 0000 0000 0000 0000 0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">{t("common.address")}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label>{t("common.street")}</Label>
                        <Input
                          value={company.street || ""}
                          onChange={(e) =>
                            setProfileField("street", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("common.houseNumber")}</Label>
                        <Input
                          value={company.house_number || ""}
                          onChange={(e) =>
                            setProfileField("house_number", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("common.plz")}</Label>
                        <Input
                          value={company.plz}
                          onChange={(e) =>
                            setProfileField("plz", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>{t("common.city")}</Label>
                        <Input
                          value={company.city}
                          onChange={(e) =>
                            setProfileField("city", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>{t("common.canton")}</Label>
                        <Input
                          value={company.canton || ""}
                          onChange={(e) =>
                            setProfileField("canton", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {isDirty && (
                      <span className="text-xs text-amber-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                        {t("settings.unsavedChanges")}
                      </span>
                    )}
                    <div className="ml-auto">
                      <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {isSaving ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>



            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    {t("settings.tab.notifications")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.notifications.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t("settings.notifications.email")}</Label>
                    <Input
                      type="email"
                      value={company.notification_email || ""}
                      onChange={(e) =>
                        setProfileField("notification_email", e.target.value)
                      }
                      placeholder={t("settings.notifications.emailPlaceholder")}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("settings.notifications.emailHint")}
                    </p>
                  </div>
                  <div>
                    <Label>{t("settings.notifications.phoneLabel")}</Label>
                    <Input
                      value={company.notification_phone || ""}
                      onChange={(e) =>
                        setProfileField("notification_phone", e.target.value)
                      }
                      placeholder="+41 79 xxx xx xx"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {isSaving ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    {t("settings.email.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.email.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{t("settings.email.setupTitle")}</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>{t("settings.email.step1")} <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a></li>
                      <li>{t("settings.email.step2")} <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline">Domains</a></li>
                      <li>{t("settings.email.step3")} <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">API Keys</a></li>
                      <li>{t("settings.email.step4")}</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{t("settings.email.useOwn")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.email.useOwnHint")}
                      </p>
                    </div>
                    <Switch
                      checked={company.resend_enabled || false}
                      onCheckedChange={(checked) =>
                        setCompany({ ...company, resend_enabled: checked })
                      }
                    />
                  </div>

                  {company.resend_enabled && (
                    <>
                      <div className="space-y-4">
                        <div>
                          <Label>{t("settings.email.apiKey")}</Label>
                          <div className="relative">
                            <Input
                              type={showResendKey ? "text" : "password"}
                              value={company.resend_api_key || ""}
                              onChange={(e) =>
                                setCompany({ ...company, resend_api_key: e.target.value })
                              }
                              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowResendKey(!showResendKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>{t("settings.email.fromName")}</Label>
                            <Input
                              value={company.resend_from_name || ""}
                              onChange={(e) =>
                                setCompany({ ...company, resend_from_name: e.target.value })
                              }
                              placeholder={company.company_name}
                            />
                          </div>
                          <div>
                            <Label>{t("settings.email.fromEmail")}</Label>
                            <Input
                              type="email"
                              value={company.resend_from_email || ""}
                              onChange={(e) =>
                                setCompany({ ...company, resend_from_email: e.target.value })
                              }
                              placeholder="offerten@ihredomain.ch"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("settings.email.fromEmailHint")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {company.resend_api_key && company.resend_from_email && (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm">{t("settings.email.configComplete")}</span>
                        </div>
                      )}

                      {/* Test Email Button */}
                      {company.resend_api_key && company.resend_from_email && (
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{t("settings.email.testTitle")}</p>
                              <p className="text-sm text-muted-foreground">
                                {t("settings.email.testHint", {
                                  email: company.notification_email || company.resend_from_email || company.email,
                                })}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={handleTestResendEmail}
                              disabled={isTestingEmail}
                            >
                              {isTestingEmail ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4 mr-2" />
                              )}
                              {t("settings.email.testButton")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!company.resend_enabled && (
                    <div className="p-3 bg-muted/50 border rounded-lg text-muted-foreground text-sm">
                      {t("settings.email.disabledNote")}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={handleSaveResendSettings} disabled={isSavingResend}>
                      {isSavingResend ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {isSavingResend ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sms">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {t("settings.sms.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.sms.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{t("settings.sms.setupTitle")}</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>{t("settings.sms.step1")} <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com</a></li>
                      <li>{t("settings.sms.step2")}</li>
                      <li>{t("settings.sms.step3")}</li>
                      <li>{t("settings.sms.step4")}</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{t("settings.sms.enable")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.sms.enableHint")}
                      </p>
                    </div>
                    <Switch
                      checked={company.twilio_enabled || false}
                      onCheckedChange={(checked) =>
                        setCompany({ ...company, twilio_enabled: checked })
                      }
                    />
                  </div>

                  {company.twilio_enabled && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t("settings.sms.accountSidLabel")}</Label>
                          <Input
                            value={company.twilio_account_sid || ""}
                            onChange={(e) =>
                              setCompany({ ...company, twilio_account_sid: e.target.value })
                            }
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                        </div>
                        <div>
                          <Label>{t("settings.sms.authTokenLabel")}</Label>
                          <div className="relative">
                            <Input
                              type={showTwilioToken ? "text" : "password"}
                              value={company.twilio_auth_token || ""}
                              onChange={(e) =>
                                setCompany({ ...company, twilio_auth_token: e.target.value })
                              }
                              placeholder={t("settings.sms.authTokenPlaceholder")}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowTwilioToken(!showTwilioToken)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <Label>{t("settings.sms.phoneNumber")}</Label>
                          <Input
                            value={company.twilio_phone_number || ""}
                            onChange={(e) =>
                              setCompany({ ...company, twilio_phone_number: e.target.value })
                            }
                            placeholder="+1234567890"
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("settings.sms.phoneNumberHint")}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">{t("settings.sms.remindersEnable")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("settings.sms.remindersHint")}
                          </p>
                        </div>
                        <Switch
                          checked={company.sms_reminders_enabled || false}
                          onCheckedChange={(checked) =>
                            setCompany({ ...company, sms_reminders_enabled: checked })
                          }
                        />
                      </div>

                      {company.twilio_account_sid && company.twilio_auth_token && company.twilio_phone_number && (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm">{t("settings.sms.configComplete")}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={handleSaveTwilioSettings} disabled={isSavingTwilio}>
                      {isSavingTwilio ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {isSavingTwilio ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reminders">
              <ReminderSettings companyId={company.id} />
            </TabsContent>

            <TabsContent value="offerten">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {t("settings.agb.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.agb.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 pb-2">
                    {availableServices.map((service) => (
                      <Button
                        key={service.type}
                        variant={selectedTemplateService === service.type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTemplateService(service.type)}
                      >
                        {service.label}
                      </Button>
                    ))}
                  </div>

                  <Separator />

                  <AgbSectionEditor
                    companyId={company.id}
                    serviceType={selectedTemplateService}
                    serviceLabel={availableServices.find(s => s.type === selectedTemplateService)?.label || selectedTemplateService}
                    allServiceTypes={availableServices}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ki">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    {t("settings.tab.ki")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.ki.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Provider selector */}
                  <div className="space-y-3">
                    <Label>{t("settings.ki.provider")}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        { id: "anthropic", label: "Anthropic Claude", desc: "claude-haiku-4-5", color: "from-orange-50 to-amber-50 border-orange-200" },
                        { id: "openai",    label: "OpenAI",           desc: "gpt-4o-mini",      color: "from-green-50 to-emerald-50 border-green-200" },
                        { id: "gemini",    label: "Google Gemini",    desc: "gemini-2.0-flash",  color: "from-blue-50 to-sky-50 border-blue-200" },
                      ] as const).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAiProvider(p.id)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                            aiProvider === p.id
                              ? `bg-gradient-to-br ${p.color} border-current`
                              : "border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span className="font-medium text-sm">{p.label}</span>
                          <span className="text-xs text-muted-foreground font-mono mt-0.5">{p.desc}</span>
                          {aiProvider === p.id && <CheckCircle className="w-4 h-4 mt-1 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Anthropic key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("settings.ki.apiKeyFor", { provider: "Anthropic" })}
                      {aiProvider === "anthropic" && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t("settings.ki.active")}</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showAnthropicKey ? "text" : "password"}
                        value={anthropicKeyMasked && !showAnthropicKey ? "sk-ant-••••••••••••••••••••••••••••••" : anthropicKey}
                        onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicKeyMasked(false); }}
                        placeholder="sk-ant-api03-..."
                        className="pr-10 font-mono text-sm"
                      />
                      <button type="button" onClick={() => setShowAnthropicKey(!showAnthropicKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {anthropicKeyMasked ? `✓ ${t("settings.ki.keySet")}` : t("settings.ki.keyMissingFallback")}{" "}
                      <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.anthropic.com</a>
                    </p>
                    {anthropicKeyMasked && (
                      <button type="button" onClick={() => { deleteApiKey("anthropic_api_key"); setAnthropicKey(""); setAnthropicKeyMasked(false); }} className="text-xs text-destructive underline">{t("common.remove")}</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">{t("settings.ki.model")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></Label>
                    <Input
                      value={anthropicModel}
                      onChange={(e) => setAnthropicModel(e.target.value)}
                      placeholder="claude-haiku-4-5"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.ki.modelHint", { model: "claude-haiku-4-5" })} <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("settings.ki.allModels")}</a></p>
                  </div>

                  {/* OpenAI key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("settings.ki.apiKeyFor", { provider: "OpenAI" })}
                      {aiProvider === "openai" && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t("settings.ki.active")}</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showOpenaiKey ? "text" : "password"}
                        value={openaiKeyMasked && !showOpenaiKey ? "sk-••••••••••••••••••••••••••••••••••" : openaiKey}
                        onChange={(e) => { setOpenaiKey(e.target.value); setOpenaiKeyMasked(false); }}
                        placeholder="sk-proj-..."
                        className="pr-10 font-mono text-sm"
                      />
                      <button type="button" onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {openaiKeyMasked ? `✓ ${t("settings.ki.keySet")}` : t("settings.ki.keyMissing")}{" "}
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">platform.openai.com</a>
                    </p>
                    {openaiKeyMasked && (
                      <button type="button" onClick={() => { deleteApiKey("openai_api_key"); setOpenaiKey(""); setOpenaiKeyMasked(false); }} className="text-xs text-destructive underline">{t("common.remove")}</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">{t("settings.ki.model")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></Label>
                    <Input
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.ki.modelHint", { model: "gpt-4o-mini" })} <a href="https://platform.openai.com/docs/models" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("settings.ki.allModels")}</a></p>
                  </div>

                  {/* Gemini key */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {t("settings.ki.apiKeyFor", { provider: "Google Gemini" })}
                      {aiProvider === "gemini" && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t("settings.ki.active")}</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showGeminiKey ? "text" : "password"}
                        value={geminiKeyMasked && !showGeminiKey ? "AIza••••••••••••••••••••••••••••••••••" : geminiKey}
                        onChange={(e) => { setGeminiKey(e.target.value); setGeminiKeyMasked(false); }}
                        placeholder="AIzaSy..."
                        className="pr-10 font-mono text-sm"
                      />
                      <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {geminiKeyMasked ? `✓ ${t("settings.ki.keySet")}` : t("settings.ki.keyMissing")}{" "}
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com</a>
                    </p>
                    {geminiKeyMasked && (
                      <button type="button" onClick={() => { deleteApiKey("gemini_api_key"); setGeminiKey(""); setGeminiKeyMasked(false); }} className="text-xs text-destructive underline">{t("common.remove")}</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">{t("settings.ki.model")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></Label>
                    <Input
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      placeholder="gemini-2.0-flash"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.ki.modelHint", { model: "gemini-2.0-flash" })} <a href="https://ai.google.dev/gemini-api/docs/models" target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("settings.ki.allModels")}</a></p>
                  </div>

                  <Button onClick={handleSaveAiSettings} disabled={isSavingAiSettings}>
                    {isSavingAiSettings
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.saving")}</>
                      : <><Save className="w-4 h-4 mr-2" />{t("settings.ki.save")}</>}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </>
  );
};

export default FirmaEinstellungen;
