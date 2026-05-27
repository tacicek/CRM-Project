import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Building2, Bell, FileText, MessageSquare, Eye, EyeOff, CheckCircle, Mail, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LogoUpload } from "@/components/firma/LogoUpload";
import { SignatureUpload } from "@/components/firma/SignatureUpload";
import { AgbSectionEditor } from "@/components/firma/AgbSectionEditor";
import { ReminderSettings } from "@/components/firma/ReminderSettings";
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
  const [selectedTemplateService, setSelectedTemplateService] = useState<string>("umzug");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);

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

  const availableServices = [
    { type: "umzug", label: "Umzug" },
    { type: "reinigung", label: "Reinigung" },
    { type: "raeumung", label: "Räumung" },
    { type: "transport", label: "Transport" },
    { type: "lagerung", label: "Lagerung" },
    { type: "entsorgung", label: "Entsorgung" },
    { type: "sonstige", label: "Sonstige" },
  ];

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Einstellungen | Firma</title>
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
          <title>Einstellungen | Firma</title>
        </Helmet>
          <div className="text-center py-12 text-muted-foreground">
            Firma nicht gefunden
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Einstellungen | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">⚙️</span>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Einstellungen</h1>
              <p className="mt-1 text-[13px] text-folk-ink2">
                Firmenprofil, Benachrichtigungen, E-Mail-Versand und AGB konfigurieren.
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="profile">Profil</TabsTrigger>
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
                      Wenn deaktiviert, werden Offerten über die konfigurierte System-E-Mail-Adresse gesendet.
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
    </>
  );
};

export default FirmaEinstellungen;
