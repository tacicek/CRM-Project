import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { Mail, Lock, Loader2, ArrowLeft, Building2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Ungültige E-Mail-Adresse");
const passwordSchema = z.string().min(6, "Passwort muss mindestens 6 Zeichen haben");

type AuthMode = "login" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [noCompanyAccess, setNoCompanyAccess] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading, isAdmin: _isAdmin, signIn, signOut, resetPassword } = useAuth();

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      if (!isLoading && user) {
        setIsCheckingRole(true);
        setNoCompanyAccess(false);
        setPendingVerification(false);
        
        try {
          // STEP 1: Check if user has an admin or moderator role
          // This uses RLS - user can only see their own roles
          // User may have multiple roles, so we fetch all and check
          const { data: rolesData, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          
          if (roleError) {
            console.error("[Auth] Error checking user role:", roleError);
          }
          
          // Check if user has any admin role (super_admin, admin, or moderator)
          const roles = rolesData?.map(r => r.role) || [];
          const hasAdminRole = roles.includes("super_admin") || roles.includes("admin") || roles.includes("moderator");
          
          if (hasAdminRole) {
            console.log("[Auth] User has staff role, redirecting to /admin", { roles });
            navigate("/admin");
            return;
          }
          
          // STEP 2: Check if user has a company
          // Uses both user_id and email to find company
          const company = await fetchSingleCompanyForUser<{ id: string; is_verified: boolean | null }>({
            userId: user.id,
            userEmail: user.email,
            select: "id, is_verified",
          });
          
          if (company) {
            if (company.is_verified === false) {
              console.log("[Auth] Company exists but is not verified yet");
              setPendingVerification(true);
              return;
            }
            console.log("[Auth] User has company, redirecting to /firma");
            navigate("/firma");
            return;
          }
          
          // STEP 3: No role and no company - show error
          console.log("[Auth] User has no role and no company, showing error");
          setNoCompanyAccess(true);
        } catch (error) {
          console.error("[Auth] Error in checkUserRoleAndRedirect:", error);
          setNoCompanyAccess(true);
        } finally {
          setIsCheckingRole(false);
        }
      }
    };
    
    checkUserRoleAndRedirect();
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    setNoCompanyAccess(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    if (mode !== "forgot") {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: "Fehler",
            description: error.message,
            variant: "destructive",
          });
        } else {
          setResetEmailSent(true);
          toast({
            title: "E-Mail gesendet",
            description: "Prüfen Sie Ihren Posteingang für den Reset-Link.",
          });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Anmeldung fehlgeschlagen",
              description: "E-Mail oder Passwort ist falsch.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Fehler",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Willkommen zurück!",
            description: "Sie wurden erfolgreich angemeldet.",
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // Show message for users without company access
  if (noCompanyAccess && user) {
    return (
      <>
        <Helmet>
          <title>Kein Zugriff | Offerio</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="fixed inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
              alt="Swiss Alps Background" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
          </div>

          {/* Content */}
          <div className="w-full max-w-lg relative z-10">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <img 
                src="/offerio-logo-v2.png" 
                alt="Offerio" 
                className="h-12 w-auto"
              />
            </div>

            <div className="glass-card p-8 text-center space-y-6 backdrop-blur-md bg-card/95 border border-border/50 shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-warning" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Keine Firma verknüpft</h1>
                <p className="text-muted-foreground">
                  Ihr Konto <span className="font-medium text-foreground">{user.email}</span> ist nicht mit einer Firma verknüpft.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Was können Sie tun?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Kontaktieren Sie den Administrator</li>
                      <li>Warten Sie auf die Freischaltung Ihrer Firma</li>
                      <li>Prüfen Sie, ob Sie die richtige E-Mail verwenden</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Abmelden & anderen Account verwenden
                </Button>
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Zur Startseite
                </a>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                Benötigen Sie Hilfe?{" "}
                <a href="mailto:support@offerio.ch" className="text-secondary hover:underline">
                  support@offerio.ch
                </a>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show message for users whose company is not verified yet
  if (pendingVerification && user) {
    return (
      <>
        <Helmet>
          <title>Verifizierung ausstehend | Offerio</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="fixed inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
              alt="Swiss Alps Background" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
          </div>

          {/* Content */}
          <div className="w-full max-w-lg relative z-10">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <img 
                src="/offerio-logo-v2.png" 
                alt="Offerio" 
                className="h-12 w-auto"
              />
            </div>

            <div className="glass-card p-8 text-center space-y-6 backdrop-blur-md bg-card/95 border border-border/50 shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-warning" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Verifizierung ausstehend</h1>
                <p className="text-muted-foreground">
                  Ihr Konto <span className="font-medium text-foreground">{user.email}</span> ist bereits mit einer Firma verknüpft, aber noch nicht freigeschaltet.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Was passiert jetzt?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Unser Team prüft Ihr Firmenprofil</li>
                      <li>Nach Freischaltung erhalten Sie Zugriff auf das Dashboard</li>
                      <li>Bei Fragen helfen wir Ihnen gerne weiter</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Abmelden
                </Button>
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Zur Startseite
                </a>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                Benötigen Sie Hilfe?{" "}
                <a href="mailto:support@offerio.ch" className="text-secondary hover:underline">
                  support@offerio.ch
                </a>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case "login": return "Anmelden";
      case "forgot": return "Passwort vergessen";
    }
  };

  return (
    <>
      <Helmet>
        <title>{getTitle()} | Offerio</title>
        <meta name="description" content="Melden Sie sich bei Offerio an oder setzen Sie Ihr Passwort zurück." />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="fixed inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
            alt="Swiss Alps Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
        </div>

        {/* Content */}
        <div className="w-full max-w-lg relative z-10">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img 
              src="/offerio-logo-v2.png" 
              alt="Offerio" 
              className="h-12 w-auto"
            />
          </div>

          {/* Auth Card */}
          <div className="glass-card p-8 backdrop-blur-md bg-card/95 border border-border/50 shadow-2xl">
            {mode === "forgot" && resetEmailSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-accent" />
                </div>
                <h1 className="text-2xl font-bold">E-Mail gesendet!</h1>
                <p className="text-muted-foreground">
                  Wir haben Ihnen einen Link zum Zurücksetzen Ihres Passworts gesendet. 
                  Bitte prüfen Sie Ihren Posteingang.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode("login");
                    setResetEmailSent(false);
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Zurück zur Anmeldung
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-center mb-2">
                  {getTitle()}
                </h1>
                {mode === "forgot" && (
                  <p className="text-center text-muted-foreground mb-6">
                    Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.
                  </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ihre@email.ch"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) {
                            setErrors((prev) => ({ ...prev, email: "" }));
                          }
                        }}
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  {mode !== "forgot" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Passwort</Label>
                        {mode === "login" && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => {
                              setMode("forgot");
                              setErrors({});
                            }}
                            className="text-xs text-secondary hover:underline"
                          >
                            Passwort vergessen?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) {
                              setErrors((prev) => ({ ...prev, password: "" }));
                            }
                          }}
                          className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {mode === "login" ? "Anmelden..." : "Senden..."}
                      </>
                    ) : (
                      mode === "forgot" ? "Reset-Link senden" : getTitle()
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  {mode === "forgot" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setErrors({});
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" />
                      Zurück zur Anmeldung
                    </button>
                  ) : (
                    <a
                      href="/partner-werden"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Noch kein Konto? <span className="text-secondary font-medium">Als Firma registrieren</span>
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-white/80 hover:text-white transition-colors duration-200">
              ← Zurück zur Startseite
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
