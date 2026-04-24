import { Helmet } from "react-helmet-async";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Building2, MapPin, Bell, X, Plus, FileText, MessageSquare, Eye, EyeOff, CheckCircle, Mail, Shield, Users, Globe, Zap, Check, Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LogoUpload } from "@/components/firma/LogoUpload";
import { SignatureUpload } from "@/components/firma/SignatureUpload";
import { AgbSectionEditor } from "@/components/firma/AgbSectionEditor";
import { ReminderSettings } from "@/components/firma/ReminderSettings";
import { KantonPlzSelector } from "@/components/firma/KantonPlzSelector";

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

interface CompanyService {
  id: string;
  service_type: string;
  is_active: boolean | null;
}

interface PlzCoverage {
  id: string;
  plz: string;
  radius_km: number | null;
  is_active: boolean | null;
  city_name?: string;
}

interface ServiceCatalog {
  id: string;
  service_type: string;
  name_de: string;
  category: string | null;
}


const PROFILE_DRAFT_KEY = "einstellungen_profile_draft";

const PROFILE_DRAFT_FIELDS = [
  "company_name", "legal_name", "email", "phone", "website",
  "street", "house_number", "plz", "city", "canton",
  "notification_email", "notification_phone",
  "mwst_number", "iban",
  "default_terms_and_conditions", "default_payment_terms",
  "primary_color",
] as const;

const FirmaEinstellungen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalog[]>([]);
  const [plzCoverage, setPlzCoverage] = useState<PlzCoverage[]>([]);
  const [selectedTemplateService, setSelectedTemplateService] = useState<string>("umzug");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [newPlz, setNewPlz] = useState("");
  const [newRadius, setNewRadius] = useState(20);

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
  const availableServices = [
    { type: "umzug", label: "Umzug" },
    { type: "reinigung", label: "Reinigung" },
    { type: "raeumung", label: "Räumung" },
    { type: "renovation", label: "Renovation" },
    { type: "entsorgung", label: "Entsorgung" },
    { type: "malerarbeit", label: "Malerarbeit" },
    { type: "klaviertransport", label: "Klaviertransport" },
    { type: "transport", label: "Transport" },
    { type: "lagerung", label: "Lagerung" },
    { type: "moebellift", label: "Möbellift" },
  ];

  // Category labels for service catalog
  const categoryLabels: Record<string, string> = {
    umzug: "Umzug",
    reinigung: "Reinigung",
    raeumung: "Räumung",
    transport: "Transport",
    lagerung: "Lagerung",
    entsorgung: "Entsorgung",
    sonstige: "Sonstige",
  };

  // Group services by category
  const groupedServices = serviceCatalog.reduce((acc, service) => {
    const category = service.category || "sonstige";
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceCatalog[]>);

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

        // Get service catalog (all available services)
        const { data: catalogData } = await supabase
          .from("service_catalog")
          .select("id, service_type, name_de, category")
          .eq("is_active", true)
          .order("sort_order");

        setServiceCatalog(catalogData || []);

        // Get company's selected services
        const { data: servicesData } = await supabase
          .from("company_services")
          .select("*")
          .eq("company_id", companyData.id);

        setServices(servicesData || []);

        // Get PLZ coverage with city names
        const { data: plzData } = await supabase
          .from("company_plz_coverage")
          .select("*")
          .eq("company_id", companyData.id)
          .order("plz", { ascending: true });

        // Fetch city names for each PLZ
        if (plzData && plzData.length > 0) {
          const plzList = plzData.map(p => p.plz);
          const { data: swissPlzData } = await supabase
            .from("swiss_plz")
            .select("plz, city")
            .in("plz", plzList);

          const plzCityMap = new Map(swissPlzData?.map(p => [p.plz, p.city]) || []);
          const enrichedPlzData = plzData.map(p => ({
            ...p,
            city_name: plzCityMap.get(p.plz) || undefined
          }));
          setPlzCoverage(enrichedPlzData);
        } else {
          setPlzCoverage([]);
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
        })
        .eq("id", company.id);

      if (error) throw error;

      // Clear draft — changes are now saved to DB
      sessionStorage.removeItem(PROFILE_DRAFT_KEY);
      setIsDirty(false);

      toast({
        title: "Gespeichert",
        description: "Ihre Änderungen wurden gespeichert.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Fehler",
        description: "Die Änderungen konnten nicht gespeichert werden.",
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
        title: "Gespeichert",
        description: "Twilio-Einstellungen wurden gespeichert.",
      });
    } catch (error) {
      console.error("Error saving Twilio settings:", error);
      toast({
        title: "Fehler",
        description: "Die Twilio-Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTwilio(false);
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
        title: "Gespeichert",
        description: "E-Mail-Einstellungen wurden gespeichert.",
      });
    } catch (error) {
      console.error("Error saving Resend settings:", error);
      toast({
        title: "Fehler",
        description: "Die E-Mail-Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSavingResend(false);
    }
  };

  const handleTestResendEmail = async () => {
    if (!company || !company.resend_api_key || !company.resend_from_email) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie zuerst API-Key und Absender-E-Mail aus.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte neu einloggen und erneut versuchen.", variant: "destructive" });
        setIsTestingEmail(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('test-resend-email', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          resend_api_key: company.resend_api_key,
          from_email: company.resend_from_email,
          from_name: company.resend_from_name || company.company_name,
          to_email: company.notification_email || company.email,
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Test erfolgreich!",
        description: `Eine Test-E-Mail wurde an ${company.notification_email || company.email} gesendet.`,
      });
    } catch (error: unknown) {
      console.error("Error testing Resend email:", error);
      toast({
        title: "Test fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Test-E-Mail konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const toggleService = async (serviceType: string) => {
    if (!company) return;

    const existingService = services.find((s) => s.service_type === serviceType);
    const newIsActive = existingService ? !existingService.is_active : true;

    try {
      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from("company_services")
        .upsert({
          company_id: company.id,
          service_type: serviceType,
          is_active: newIsActive,
        }, {
          onConflict: 'company_id,service_type',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      setServices((prev) => {
        const exists = prev.some((s) => s.service_type === serviceType);
        if (exists) {
          return prev.map((s) =>
            s.service_type === serviceType ? { ...s, is_active: newIsActive, id: data.id } : s
          );
        }
        return [...prev, data];
      });

      toast({
        title: "Aktualisiert",
        description: "Service-Einstellungen wurden gespeichert.",
      });
    } catch (error) {
      console.error("Error toggling service:", error);
      toast({
        title: "Fehler",
        description: "Die Änderung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const addPlzCoverage = async () => {
    if (!company || !newPlz || newPlz.length !== 4) {
      toast({
        title: "Ungültige PLZ",
        description: "Bitte geben Sie eine gültige 4-stellige PLZ ein.",
        variant: "destructive",
      });
      return;
    }

    // Check if PLZ already exists
    if (plzCoverage.some(p => p.plz === newPlz)) {
      toast({
        title: "PLZ existiert bereits",
        description: `PLZ ${newPlz} ist bereits in Ihrer Abdeckung.`,
        variant: "destructive",
      });
      return;
    }

    // Validate PLZ exists in Swiss PLZ database
    const { data: swissPlz } = await supabase
      .from("swiss_plz")
      .select("city")
      .eq("plz", newPlz)
      .limit(1)
      .single();

    if (!swissPlz) {
      toast({
        title: "PLZ nicht gefunden",
        description: `PLZ ${newPlz} existiert nicht in der Schweiz.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("company_plz_coverage")
        .insert({
          company_id: company.id,
          plz: newPlz,
          radius_km: newRadius,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPlzCoverage([...plzCoverage, { ...data, city_name: swissPlz.city }]);
      setNewPlz("");
      toast({
        title: "Hinzugefügt",
        description: `PLZ ${newPlz} (${swissPlz.city}) wurde hinzugefügt.`,
      });
    } catch (error) {
      console.error("Error adding PLZ:", error);
      toast({
        title: "Fehler",
        description: "Die PLZ konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const removePlzCoverage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("company_plz_coverage")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPlzCoverage(plzCoverage.filter((p) => p.id !== id));
      toast({
        title: "Entfernt",
        description: "PLZ wurde entfernt.",
      });
    } catch (error) {
      console.error("Error removing PLZ:", error);
      toast({
        title: "Fehler",
        description: "Die PLZ konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };

  const refreshPlzCoverage = async () => {
    if (!company) return;
    
    const { data: plzData } = await supabase
      .from("company_plz_coverage")
      .select("*")
      .eq("company_id", company.id)
      .order("plz", { ascending: true });

    if (plzData && plzData.length > 0) {
      const plzList = plzData.map(p => p.plz);
      const { data: swissPlzData } = await supabase
        .from("swiss_plz")
        .select("plz, city")
        .in("plz", plzList);

      const plzCityMap = new Map(swissPlzData?.map(p => [p.plz, p.city]) || []);
      const enrichedPlzData = plzData.map(p => ({
        ...p,
        city_name: plzCityMap.get(p.plz) || undefined
      }));
      setPlzCoverage(enrichedPlzData);
    } else {
      setPlzCoverage([]);
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Einstellungen | Firma</title>
        </Helmet>
        <FirmaLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        </FirmaLayout>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Helmet>
          <title>Einstellungen | Firma</title>
        </Helmet>
        <FirmaLayout>
          <div className="text-center py-12 text-muted-foreground">
            Firma nicht gefunden
          </div>
        </FirmaLayout>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Einstellungen | Firma</title>
      </Helmet>
      <FirmaLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Einstellungen</h2>
            <p className="text-muted-foreground">Verwalten Sie Ihr Firmenprofil</p>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="profile">Profil</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="coverage">Abdeckung</TabsTrigger>
              <TabsTrigger value="notifications">Benachrichtigungen</TabsTrigger>
              <TabsTrigger value="email">E-Mail (Resend)</TabsTrigger>
              <TabsTrigger value="sms">SMS (Twilio)</TabsTrigger>
              <TabsTrigger value="reminders">Erinnerungen</TabsTrigger>
              <TabsTrigger value="offerten">AGB</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Unternehmensprofil
                  </CardTitle>
                  <CardDescription>
                    Ihre Firmeninformationen bearbeiten
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
                      <Label htmlFor="primary_color">Firmenfarbe (für Offerten)</Label>
                      <p className="text-sm text-muted-foreground">
                        Diese Farbe wird in Ihren PDF-Offerten verwendet
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

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Unternehmensdaten</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Firmenname</Label>
                        <Input
                          value={company.company_name}
                          onChange={(e) =>
                            setProfileField("company_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Rechtlicher Name</Label>
                        <Input
                          value={company.legal_name || ""}
                          onChange={(e) =>
                            setProfileField("legal_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>E-Mail</Label>
                        <Input
                          type="email"
                          value={company.email}
                          onChange={(e) =>
                            setProfileField("email", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        <Input
                          value={company.phone || ""}
                          onChange={(e) =>
                            setProfileField("phone", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Website</Label>
                        <Input
                          value={company.website || ""}
                          onChange={(e) =>
                            setProfileField("website", e.target.value)
                          }
                          placeholder="https://"
                        />
                      </div>
                      <div>
                        <Label>MwSt-Nummer</Label>
                        <Input
                          value={company.mwst_number || ""}
                          onChange={(e) =>
                            setProfileField("mwst_number", e.target.value)
                          }
                          placeholder="CHE-XXX.XXX.XXX"
                        />
                      </div>
                      <div>
                        <Label>IBAN</Label>
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
                    <h4 className="font-medium mb-3">Adresse</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label>Strasse</Label>
                        <Input
                          value={company.street || ""}
                          onChange={(e) =>
                            setProfileField("street", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Nr.</Label>
                        <Input
                          value={company.house_number || ""}
                          onChange={(e) =>
                            setProfileField("house_number", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>PLZ</Label>
                        <Input
                          value={company.plz}
                          onChange={(e) =>
                            setProfileField("plz", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Ort</Label>
                        <Input
                          value={company.city}
                          onChange={(e) =>
                            setProfileField("city", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Kanton</Label>
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
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                        Ungespeicherte Änderungen
                      </span>
                    )}
                    <div className="ml-auto">
                      <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Speichern
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Angebotene Services</CardTitle>
                    <CardDescription>
                      Wählen Sie die Services die Sie anbieten. Nur aktivierte Services werden bei Lead-Matching berücksichtigt.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {serviceCatalog.length > 0 ? (
                      <div className="space-y-6">
                        {Object.entries(groupedServices).map(([category, categoryServices]) => {
                          const allActive = categoryServices.every(s => 
                            services.some(cs => cs.service_type === s.service_type && cs.is_active)
                          );
                          const _someActive = categoryServices.some(s => 
                            services.some(cs => cs.service_type === s.service_type && cs.is_active)
                          );
                          
                          return (
                            <div key={category} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                  {categoryLabels[category] || category}
                                </Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-6"
                                  onClick={() => {
                                    // Toggle all services in this category
                                    categoryServices.forEach(s => {
                                      const isActive = services.some(cs => cs.service_type === s.service_type && cs.is_active);
                                      if (allActive && isActive) {
                                        // Deactivate all
                                        toggleService(s.service_type);
                                      } else if (!allActive && !isActive) {
                                        // Activate all
                                        toggleService(s.service_type);
                                      }
                                    });
                                  }}
                                >
                                  {allActive ? "Alle abwählen" : "Alle auswählen"}
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {categoryServices.map((service) => {
                                  const isActive = services.some(
                                    (s) => s.service_type === service.service_type && s.is_active
                                  );

                                  return (
                                    <div
                                      key={service.id}
                                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/5 ${
                                        isActive 
                                          ? "border-primary bg-primary/5" 
                                          : "border-border bg-card"
                                      }`}
                                      onClick={() => toggleService(service.service_type)}
                                    >
                                      <Switch
                                        checked={isActive}
                                        onCheckedChange={() => toggleService(service.service_type)}
                                      />
                                      <Label className="text-sm cursor-pointer flex-1">
                                        {service.name_de}
                                      </Label>
                                      {isActive && (
                                        <Badge variant="secondary" className="text-xs">
                                          Aktiv
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Service-Katalog wird geladen...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lead Sharing Preference */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
                  <div className="p-5 md:p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Lead-Verteilung</h3>
                        <p className="text-[11px] text-slate-500">Wählen Sie welche Art von Anfragen Sie erhalten möchten</p>
                      </div>
                    </div>

                    {/* Options — 4 tiers matching pricing multipliers: 1x, 1.3x, 1.15x, 1.0x */}
                    <div className="grid gap-3">
                      {([
                        {
                          value: 'only_1' as const,
                          label: 'Nur Exklusiv-Anfragen',
                          sublabel: '1 Firma',
                          desc: 'Keine Konkurrenz — garantierter Kundenkontakt, höchste Kosten.',
                          icon: Shield,
                          color: { border: 'border-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30', iconBg: 'bg-violet-500', iconBgOff: 'bg-slate-100 dark:bg-slate-800', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 text-violet-700 border-violet-200', check: 'bg-violet-500', hover: 'hover:border-violet-300 dark:hover:border-violet-700' },
                          tag: null,
                        },
                        {
                          value: 'only_3' as const,
                          label: 'Premium-Anfragen',
                          sublabel: 'bis 3 Firmen',
                          desc: 'Exklusiv + Premium — max. 3 Mitbewerber, höherer Preis pro Lead.',
                          icon: Users,
                          color: { border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', iconBg: 'bg-amber-500', iconBgOff: 'bg-slate-100 dark:bg-slate-800', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 border-amber-200', check: 'bg-amber-500', hover: 'hover:border-amber-300 dark:hover:border-amber-700' },
                          tag: null,
                        },
                        {
                          value: 'only_4' as const,
                          label: 'Standard+ Anfragen',
                          sublabel: 'bis 4 Firmen',
                          desc: 'Exklusiv, Premium + Standard-4 — gute Balance aus Reichweite und Preis.',
                          icon: Globe,
                          color: { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', iconBg: 'bg-blue-500', iconBgOff: 'bg-slate-100 dark:bg-slate-800', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-700 border-blue-200', check: 'bg-blue-500', hover: 'hover:border-blue-300 dark:hover:border-blue-700' },
                          tag: null,
                        },
                        {
                          value: 'both' as const,
                          label: 'Alle Anfragen',
                          sublabel: 'bis 5 Firmen',
                          desc: 'Alle Lead-Typen — maximale Reichweite, günstigster Token-Preis.',
                          icon: Zap,
                          color: { border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', iconBg: 'bg-emerald-500', iconBgOff: 'bg-slate-100 dark:bg-slate-800', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', check: 'bg-emerald-500', hover: 'hover:border-emerald-300 dark:hover:border-emerald-700' },
                          tag: 'Empfohlen',
                        },
                      ] as const).map((opt) => {
                        const IconComp = opt.icon;
                        const isSelected = opt.value === 'both'
                          ? (company?.lead_sharing_preference === 'both' || company?.lead_sharing_preference === 'only_5' || !company?.lead_sharing_preference)
                          : company?.lead_sharing_preference === opt.value;
                        return (
                          <label key={opt.value} className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? `${opt.color.border} ${opt.color.bg} shadow-sm`
                              : `border-slate-200 dark:border-slate-700 ${opt.color.hover} hover:bg-slate-50 dark:hover:bg-slate-800/50`
                          }`}>
                            <input type="radio" name="lead_sharing" value={opt.value} checked={isSelected}
                              onChange={async () => {
                                if (!company) return;
                                const { error } = await supabase.from('companies').update({ lead_sharing_preference: opt.value }).eq('id', company.id);
                                if (!error) { setCompany({ ...company, lead_sharing_preference: opt.value }); toast({ title: "Gespeichert", description: "Lead-Präferenz aktualisiert" }); }
                              }}
                              className="sr-only"
                            />
                            <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? opt.color.iconBg : opt.color.iconBgOff}`}>
                              <IconComp className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className={`text-sm font-semibold ${isSelected ? opt.color.text : 'text-slate-900 dark:text-white'}`}>
                                  {opt.label}
                                </p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold border ${opt.color.badge}`}>
                                  {opt.sublabel}
                                </span>
                                {opt.tag && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-emerald-500 text-white">
                                    {opt.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{opt.desc}</p>
                            </div>
                            {isSelected && (
                              <div className={`shrink-0 w-5 h-5 rounded-full ${opt.color.check} flex items-center justify-center`}>
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Hinweis */}
                    <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Je weniger Firmen konkurrieren, desto höher der Token-Preis pro Lead — aber desto grösser Ihre Gewinnchance.
                        Bei <strong className="text-slate-600 dark:text-slate-300">Exklusiv</strong> kein Wettbewerb,
                        bei <strong className="text-slate-600 dark:text-slate-300">Alle</strong> günstigster Preis mit max. 5 Mitbewerbern.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="coverage">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Regionale Abdeckung
                  </CardTitle>
                  <CardDescription>
                    Definieren Sie Ihre Einsatzgebiete. Sie erhalten nur Anfragen aus diesen Regionen.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Info Box */}
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      So funktioniert die Lead-Verteilung
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Geben Sie PLZ-Codes ein, in denen Sie tätig sind</li>
                      <li>Der Radius erweitert Ihre Abdeckung auf umliegende Gebiete</li>
                      <li>Sie erhalten nur Anfragen von Kunden aus Ihren definierten Gebieten</li>
                      <li>Aktivieren Sie Ihre Services im "Services"-Tab um Leads zu erhalten</li>
                    </ul>
                  </div>

                  {/* Add PLZ Form */}
                  <div className="border rounded-lg p-4 bg-card">
                    <Label className="mb-2 block font-medium">Neues Gebiet hinzufügen</Label>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <Label className="text-xs text-muted-foreground mb-1 block">PLZ</Label>
                        <Input
                          placeholder="z.B. 8001"
                          value={newPlz}
                          onChange={(e) => setNewPlz(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          maxLength={4}
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs text-muted-foreground mb-1 block">Radius (km)</Label>
                        <Input
                          type="number"
                          placeholder="20"
                          value={newRadius}
                          onChange={(e) => setNewRadius(parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addPlzCoverage}>
                          <Plus className="w-4 h-4 mr-1" />
                          Hinzufügen
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Radius 0 = nur exakte PLZ | Radius 20 = alle PLZ im Umkreis von 20km
                    </p>
                  </div>

                  {/* Kanton-based PLZ Selection */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        oder PLZ nach Kanton auswählen
                      </span>
                    </div>
                  </div>

                  {company && (
                    <KantonPlzSelector
                      companyId={company.id}
                      existingCoverages={plzCoverage}
                      onCoverageChange={refreshPlzCoverage}
                    />
                  )}

                  {/* Current Coverage */}
                  <div>
                    <Label className="mb-3 block font-medium">
                      Aktuelle Abdeckung ({plzCoverage.length} {plzCoverage.length === 1 ? 'Gebiet' : 'Gebiete'})
                    </Label>
                    {plzCoverage.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {plzCoverage.map((coverage) => (
                          <div
                            key={coverage.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              <div>
                                <div className="font-medium">
                                  {coverage.plz}
                                  {coverage.city_name && (
                                    <span className="font-normal text-muted-foreground ml-1">
                                      {coverage.city_name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {coverage.radius_km && coverage.radius_km > 0 
                                    ? `+${coverage.radius_km} km Radius` 
                                    : 'Nur exakte PLZ'}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePlzCoverage(coverage.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border rounded-lg bg-muted/30">
                        <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          Noch keine PLZ-Abdeckung definiert
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Fügen Sie PLZ-Codes hinzu, um Leads zu erhalten
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Benachrichtigungen
                  </CardTitle>
                  <CardDescription>
                    Konfigurieren Sie Ihre Benachrichtigungseinstellungen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Benachrichtigungs-E-Mail</Label>
                    <Input
                      type="email"
                      value={company.notification_email || ""}
                      onChange={(e) =>
                        setProfileField("notification_email", e.target.value)
                      }
                      placeholder="Falls abweichend von Haupt-E-Mail"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Leer lassen um Haupt-E-Mail zu verwenden
                    </p>
                  </div>
                  <div>
                    <Label>Benachrichtigungs-Telefon (SMS)</Label>
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
                      Speichern
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
                    Eigene E-Mail-Adresse (Resend)
                  </CardTitle>
                  <CardDescription>
                    Senden Sie Offerten mit Ihrer eigenen E-Mail-Adresse anstatt über das System
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="font-medium mb-2">So richten Sie Ihre eigene E-Mail ein:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Erstellen Sie ein Konto auf <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a></li>
                      <li>Verifizieren Sie Ihre Domain unter <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline">Domains</a></li>
                      <li>Erstellen Sie einen API-Key unter <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">API Keys</a></li>
                      <li>Tragen Sie die Daten hier ein</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Eigene E-Mail-Adresse verwenden</p>
                      <p className="text-sm text-muted-foreground">
                        Offerten werden mit Ihrer eigenen Absender-Adresse gesendet
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
                          <Label>Resend API-Key</Label>
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
                            <Label>Absender-Name</Label>
                            <Input
                              value={company.resend_from_name || ""}
                              onChange={(e) =>
                                setCompany({ ...company, resend_from_name: e.target.value })
                              }
                              placeholder={company.company_name}
                            />
                          </div>
                          <div>
                            <Label>Absender-E-Mail</Label>
                            <Input
                              type="email"
                              value={company.resend_from_email || ""}
                              onChange={(e) =>
                                setCompany({ ...company, resend_from_email: e.target.value })
                              }
                              placeholder="offerten@ihredomain.ch"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Muss eine verifizierte Domain sein
                            </p>
                          </div>
                        </div>
                      </div>

                      {company.resend_api_key && company.resend_from_email && (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm">E-Mail-Konfiguration vollständig - Offerten werden mit Ihrer Adresse gesendet</span>
                        </div>
                      )}

                      {/* Test Email Button */}
                      {company.resend_api_key && company.resend_from_email && (
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">E-Mail-Konfiguration testen</p>
                              <p className="text-sm text-muted-foreground">
                                Eine Test-E-Mail an {company.notification_email || company.email} senden
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
                              Test senden
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!company.resend_enabled && (
                    <div className="p-3 bg-muted/50 border rounded-lg text-muted-foreground text-sm">
                      Wenn deaktiviert, werden Offerten über die System-E-Mail-Adresse (noreply@offerio.ch) gesendet.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={handleSaveResendSettings} disabled={isSavingResend}>
                      {isSavingResend ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Speichern
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
                    SMS-Erinnerungen (Twilio)
                  </CardTitle>
                  <CardDescription>
                    Konfigurieren Sie Twilio für SMS-Erinnerungen an Ihre Kunden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="font-medium mb-2">So erhalten Sie Twilio-Zugangsdaten:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Erstellen Sie ein Konto auf <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com</a></li>
                      <li>Gehen Sie zur Console und kopieren Sie Ihre Account SID und Auth Token</li>
                      <li>Kaufen Sie eine Telefonnummer für SMS-Versand</li>
                      <li>Tragen Sie die Daten hier ein</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Twilio aktivieren</p>
                      <p className="text-sm text-muted-foreground">
                        SMS-Funktionalität für Ihre Firma aktivieren
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
                          <Label>Account SID</Label>
                          <Input
                            value={company.twilio_account_sid || ""}
                            onChange={(e) =>
                              setCompany({ ...company, twilio_account_sid: e.target.value })
                            }
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                        </div>
                        <div>
                          <Label>Auth Token</Label>
                          <div className="relative">
                            <Input
                              type={showTwilioToken ? "text" : "password"}
                              value={company.twilio_auth_token || ""}
                              onChange={(e) =>
                                setCompany({ ...company, twilio_auth_token: e.target.value })
                              }
                              placeholder="Ihr Auth Token"
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
                          <Label>Twilio Telefonnummer</Label>
                          <Input
                            value={company.twilio_phone_number || ""}
                            onChange={(e) =>
                              setCompany({ ...company, twilio_phone_number: e.target.value })
                            }
                            placeholder="+1234567890"
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Die Telefonnummer, von der SMS gesendet werden (im E.164-Format)
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">SMS-Erinnerungen aktivieren</p>
                          <p className="text-sm text-muted-foreground">
                            Kunden erhalten zusätzlich zur E-Mail auch SMS-Erinnerungen
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
                          <span className="text-sm">Twilio-Konfiguration vollständig</span>
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
                      Speichern
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
                    Allgemeine Geschäftsbedingungen (AGB)
                  </CardTitle>
                  <CardDescription>
                    Erstellen Sie strukturierte AGB-Abschnitte mit Titel und Inhalt für jeden Service-Typ. 
                    Diese werden automatisch in jede Offerte als PDF-Anhang übernommen und bei Annahme rechtsgültig akzeptiert.
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
          </Tabs>
        </div>
      </FirmaLayout>
    </>
  );
};

export default FirmaEinstellungen;
