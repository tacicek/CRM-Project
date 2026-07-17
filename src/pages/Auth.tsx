import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { validateAuthForm, type AuthMode, type AuthFormErrors } from "@/lib/authUtils";
import {
  Mail,
  Lock,
  Loader2,
  ArrowLeft,
  Building2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Auth page — login + forgot-password
// CRM-FORK: removed admin redirect (no /admin route), portal branding, signup link
// ---------------------------------------------------------------------------

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [noCompanyAccess, setNoCompanyAccess] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading, signIn, signOut, resetPassword } = useAuth();

  // -------------------------------------------------------------------------
  // Post-login redirect
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isLoading || !user) return;

    const redirect = async () => {
      setIsCheckingRole(true);
      setNoCompanyAccess(false);
      setPendingVerification(false);

      try {
        const company = await fetchSingleCompanyForUser<{ id: string; is_verified: boolean | null }>({
          userId: user.id,
          userEmail: user.email,
          select: "id, is_verified",
        });

        if (!company) {
          setNoCompanyAccess(true);
          return;
        }

        if (company.is_verified === false) {
          setPendingVerification(true);
          return;
        }

        navigate("/firma");
      } catch (err) {
        console.error("[Auth] redirect error:", err);
        setNoCompanyAccess(true);
      } finally {
        setIsCheckingRole(false);
      }
    };

    redirect();
  }, [user, isLoading, navigate]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleSignOut = async () => {
    await signOut();
    setNoCompanyAccess(false);
    setPendingVerification(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formErrors = validateAuthForm(email, password, mode);
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast({ title: "Fehler", description: error.message, variant: "destructive" });
        } else {
          setResetEmailSent(true);
          toast({ title: "E-Mail gesendet", description: "Prüfen Sie Ihren Posteingang für den Reset-Link." });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          const description = error.message.includes("Invalid login credentials")
            ? "E-Mail oder Passwort ist falsch."
            : error.message;
          toast({ title: "Anmeldung fehlgeschlagen", description, variant: "destructive" });
        } else {
          toast({ title: "Willkommen!", description: "Sie wurden erfolgreich angemeldet." });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (isLoading || isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // No company linked
  // -------------------------------------------------------------------------

  if (noCompanyAccess && user) {
    return (
      <>
        <Helmet><title>Kein Zugriff | CRM</title></Helmet>
        <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
          <div className="w-full max-w-lg">
            <div className="rounded-xl border border-border bg-card p-8 text-center space-y-6 shadow-lg">
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-warning" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Keine Firma verknüpft</h1>
                <p className="text-muted-foreground">
                  Ihr Konto{" "}
                  <span className="font-medium text-foreground">{user.email}</span>{" "}
                  ist nicht mit einer Firma verknüpft.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Was können Sie tun?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Kontaktieren Sie den Administrator</li>
                      <li>Prüfen Sie, ob Sie die richtige E-Mail verwenden</li>
                    </ul>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Abmelden &amp; anderen Account verwenden
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Pending verification
  // -------------------------------------------------------------------------

  if (pendingVerification && user) {
    return (
      <>
        <Helmet><title>Verifizierung ausstehend | CRM</title></Helmet>
        <div className="min-h-screen flex items-center justify-center px-4 bg-muted/20">
          <div className="w-full max-w-lg">
            <div className="rounded-xl border border-border bg-card p-8 text-center space-y-6 shadow-lg">
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-warning" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Verifizierung ausstehend</h1>
                <p className="text-muted-foreground">
                  Ihr Konto{" "}
                  <span className="font-medium text-foreground">{user.email}</span>{" "}
                  ist noch nicht freigeschaltet.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Was passiert jetzt?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Ihr Firmenprofil wird geprüft</li>
                      <li>Nach Freischaltung erhalten Sie Zugriff auf das Dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Login / Forgot-password form
  // -------------------------------------------------------------------------

  const title = mode === "forgot" ? "Passwort vergessen" : "Anmelden";

  return (
    <>
      <Helmet>
        <title>{title} | CRM</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-background to-secondary/5">
        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center mx-auto mb-4 shadow-md">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">CRM Dashboard</p>
          </div>

          {/* Card */}
          <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
            {mode === "forgot" && resetEmailSent ? (
              /* ── Email sent confirmation ── */
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-accent" />
                </div>
                <h1 className="text-2xl font-bold">E-Mail gesendet!</h1>
                <p className="text-muted-foreground">
                  Wir haben Ihnen einen Reset-Link zugeschickt. Bitte prüfen Sie Ihren
                  Posteingang.
                </p>
                <Button
                  variant="outline"
                  onClick={() => { setMode("login"); setResetEmailSent(false); }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Zurück zur Anmeldung
                </Button>
              </div>
            ) : (
              /* ── Form ── */
              <>
                <h1 className="text-2xl font-bold text-center mb-1">{title}</h1>
                {mode === "forgot" && (
                  <p className="text-center text-sm text-muted-foreground mb-5">
                    Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Reset-Link.
                  </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 mt-5" noValidate>
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-Mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="ihre@email.ch"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                        }}
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>

                  {/* Password (login only) */}
                  {mode !== "forgot" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Passwort</Label>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => { setMode("forgot"); setErrors({}); }}
                          className="text-xs text-secondary hover:underline"
                        >
                          Passwort vergessen?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                          }}
                          className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive">{errors.password}</p>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full mt-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {mode === "login" ? "Anmelden…" : "Senden…"}
                      </>
                    ) : (
                      mode === "forgot" ? "Reset-Link senden" : "Anmelden"
                    )}
                  </Button>
                </form>

                {/* Mode toggle */}
                {mode === "forgot" && (
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setErrors({}); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" />
                      Zurück zur Anmeldung
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
