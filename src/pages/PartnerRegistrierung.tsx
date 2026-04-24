import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Mail,
  Lock,
  User,
  Loader2,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Ungültige E-Mail-Adresse");
const passwordSchema = z.string().min(6, "Passwort muss mindestens 6 Zeichen haben");

type Step = 1 | 2 | 3;

interface FormData {
  // Step 1: Account
  email: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  // Step 2: Company
  companyName: string;
  legalName: string;
  street: string;
  houseNumber: string;
  plz: string;
  city: string;
  // Step 3: Contact
  phone: string;
  companyEmail: string;
  website: string;
  agbAccepted: boolean;
}

const PartnerRegistrierung = () => {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    passwordConfirm: "",
    firstName: "",
    lastName: "",
    companyName: "",
    legalName: "",
    street: "",
    houseNumber: "",
    plz: "",
    city: "",
    phone: "",
    companyEmail: "",
    website: "",
    agbAccepted: false,
  });

  const { toast } = useToast();
  const navigate = useNavigate();

  const updateFormData = (field: keyof FormData, value: string | string[] | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "Vorname ist erforderlich";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Nachname ist erforderlich";
    }

    const emailResult = emailSchema.safeParse(formData.email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(formData.password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = "Passwörter stimmen nicht überein";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Firmenname ist erforderlich";
    }
    if (!formData.plz.trim()) {
      newErrors.plz = "PLZ ist erforderlich";
    } else if (!/^\d{4}$/.test(formData.plz)) {
      newErrors.plz = "Ungültige PLZ (4 Ziffern)";
    }
    if (!formData.city.trim()) {
      newErrors.city = "Ort ist erforderlich";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phone.trim()) {
      newErrors.phone = "Telefonnummer ist erforderlich";
    }
    if (!formData.companyEmail.trim()) {
      newErrors.companyEmail = "E-Mail ist erforderlich";
    } else {
      const emailResult = emailSchema.safeParse(formData.companyEmail);
      if (!emailResult.success) {
        newErrors.companyEmail = emailResult.error.errors[0].message;
      }
    }
    if (!formData.agbAccepted) {
      newErrors.agbAccepted = "Sie müssen die AGB akzeptieren";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;

    switch (step) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
    }

    if (isValid && step < 3) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);

    try {
      // 1. Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/firma`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Benutzer konnte nicht erstellt werden");

      // Supabase bazı durumlarda hata vermeden mevcut (onaysız) kullanıcıyı döndürür
      // Bu durumda identities dizisi boş gelir → kullanıcı zaten mevcut demektir
      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error("User already registered");
      }

      // 2. Create company, services and coverage via SECURITY DEFINER function
      // Reason: signUp with email confirmation returns session:null → anon key → RLS blocks direct INSERT
      const { data: companyId, error: companyError } = await supabase
        .rpc("create_company_after_signup", {
          p_user_id: authData.user.id,
          p_company_name: formData.companyName,
          p_legal_name: formData.legalName || null,
          p_street: formData.street || null,
          p_house_number: formData.houseNumber || null,
          p_plz: formData.plz,
          p_city: formData.city,
          p_phone: formData.phone || null,
          p_email: formData.companyEmail,
          p_website: formData.website || null,
          p_services: [],
          p_coverage_plz: null,
          p_coverage_radius: 0,
        });

      if (companyError) throw companyError;
      if (!companyId) throw new Error("Firma konnte nicht erstellt werden");

      // Admin bildirimi + hoşgeldin emaili (hata olursa kayıt yine de tamamlandı sayılır)
      try {
        await supabase.functions.invoke("notify-admin-new-company", {
          body: {
            company_id: companyId,
            company_name: formData.companyName,
            email: formData.companyEmail,
            plz: formData.plz || null,
            city: formData.city || null,
          },
        });
      } catch (notifyError) {
        console.warn("Admin notification failed:", notifyError);
      }

      toast({
        title: "Registrierung erfolgreich!",
        description: "Ihr Firmenkonto wurde erstellt. Bitte bestätigen Sie Ihre E-Mail-Adresse.",
      });

      navigate("/auth");
    } catch (error: unknown) {
      console.error("Registration error:", error);
      // PostgrestError (.message) veya normal Error (.message) her ikisini de yakala
      const errorMessage =
        (error as { message?: string })?.message || "";

      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already been registered") ||
        errorMessage.includes("User already registered")
      ) {
        toast({
          title: "E-Mail bereits registriert",
          description:
            "Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("Company already exists")) {
        toast({
          title: "Firma bereits registriert",
          description:
            "Für dieses Konto existiert bereits eine Firma. Bitte melden Sie sich an.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fehler bei der Registrierung",
          description: errorMessage || "Ein unerwarteter Fehler ist aufgetreten.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = {
    1: "Benutzerkonto",
    2: "Firmendaten",
    3: "Kontaktdaten",
  };

  return (
    <>
      <Helmet>
        <title>Anbieter werden | Offerio — Mehr Aufträge für Ihr Unternehmen</title>
        <meta name="description" content="Als Umzugs- oder Reinigungsunternehmen bei Offerio Partner werden. Erhalten Sie täglich qualifizierte Kundenanfragen aus Ihrer Region." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Partner werden","item":"https://offerio.ch/partner-werden"}]}`}</script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/5 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <a href="/" className="inline-block mb-6">
              <span className="text-3xl font-bold text-primary">Offerio</span>
            </a>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Partner werden</h1>
            <p className="text-muted-foreground">
              Registrieren Sie Ihre Firma und erhalten Sie qualifizierte Kundenanfragen
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${s < step
                      ? "bg-accent text-accent-foreground"
                      : s === step
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                >
                  {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 md:w-20 h-1 ${s < step ? "bg-accent" : "bg-muted"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="glass-card p-6 md:p-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              {step === 1 && <User className="w-5 h-5 text-secondary" />}
              {step === 2 && <Building2 className="w-5 h-5 text-secondary" />}
              {step === 3 && <Phone className="w-5 h-5 text-secondary" />}
              {stepTitles[step]}
            </h2>

            {/* Step 1: Account */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateFormData("firstName", e.target.value)}
                      placeholder="Max"
                      className={errors.firstName ? "border-destructive" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateFormData("lastName", e.target.value)}
                      placeholder="Muster"
                      className={errors.lastName ? "border-destructive" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder="ihre@email.ch"
                      className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Passwort *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                      className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">Passwort bestätigen *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="passwordConfirm"
                      type="password"
                      value={formData.passwordConfirm}
                      onChange={(e) => updateFormData("passwordConfirm", e.target.value)}
                      placeholder="Passwort wiederholen"
                      className={`pl-10 ${errors.passwordConfirm ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.passwordConfirm && (
                    <p className="text-sm text-destructive">{errors.passwordConfirm}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Company */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Firmenname *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => updateFormData("companyName", e.target.value)}
                      placeholder="Muster GmbH"
                      className={`pl-10 ${errors.companyName ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-sm text-destructive">{errors.companyName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalName">Rechtlicher Name (optional)</Label>
                  <Input
                    id="legalName"
                    value={formData.legalName}
                    onChange={(e) => updateFormData("legalName", e.target.value)}
                    placeholder="Muster Transport GmbH"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="street">Strasse</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => updateFormData("street", e.target.value)}
                      placeholder="Musterstrasse"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="houseNumber">Nr.</Label>
                    <Input
                      id="houseNumber"
                      value={formData.houseNumber}
                      onChange={(e) => updateFormData("houseNumber", e.target.value)}
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plz">PLZ *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="plz"
                        value={formData.plz}
                        onChange={(e) => updateFormData("plz", e.target.value)}
                        placeholder="8000"
                        maxLength={4}
                        className={`pl-10 ${errors.plz ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.plz && (
                      <p className="text-sm text-destructive">{errors.plz}</p>
                    )}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="city">Ort *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                      placeholder="Zürich"
                      className={errors.city ? "border-destructive" : ""}
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateFormData("phone", e.target.value)}
                      placeholder="+41 44 123 45 67"
                      className={`pl-10 ${errors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Firmen E-Mail *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="companyEmail"
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) => updateFormData("companyEmail", e.target.value)}
                      placeholder="info@muster-gmbh.ch"
                      className={`pl-10 ${errors.companyEmail ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.companyEmail && (
                    <p className="text-sm text-destructive">{errors.companyEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    An diese Adresse werden Benachrichtigungen gesendet
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website (optional)</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => updateFormData("website", e.target.value)}
                      placeholder="https://www.muster-gmbh.ch"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg border ${errors.agbAccepted ? "border-destructive" : "border-border"
                      }`}
                  >
                    <Checkbox
                      id="agbAccepted"
                      checked={formData.agbAccepted}
                      onCheckedChange={(checked) => updateFormData("agbAccepted", checked as boolean)}
                    />
                    <label htmlFor="agbAccepted" className="text-sm cursor-pointer">
                      Ich akzeptiere die{" "}
                      <a href="/agb" target="_blank" className="text-secondary hover:underline">
                        Allgemeinen Geschäftsbedingungen
                      </a>{" "}
                      und die{" "}
                      <a href="/datenschutz" target="_blank" className="text-secondary hover:underline">
                        Datenschutzerklärung
                      </a>
                    </label>
                  </div>
                  {errors.agbAccepted && (
                    <p className="text-sm text-destructive mt-1">{errors.agbAccepted}</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Zurück
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button onClick={handleNext} variant="hero">
                  Weiter
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  variant="hero"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Registrierung...
                    </>
                  ) : (
                    <>
                      Registrierung abschliessen
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Bereits registriert?{" "}
              <a href="/auth" className="text-secondary hover:underline">
                Jetzt anmelden
              </a>
            </p>
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors block">
              ← Zurück zur Startseite
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default PartnerRegistrierung;