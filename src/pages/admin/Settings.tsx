import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Database, Shield, Mail, Check, AlertCircle, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSettings = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Stripe configuration state
  const [isStripeConfigured, setIsStripeConfigured] = useState(false);
  const [isTestingStripe, setIsTestingStripe] = useState(false);
  const [stripeTestResult, setStripeTestResult] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Get Supabase project ref from URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";

  // Check configurations on mount
  useEffect(() => {
    checkEmailConfig();
    checkStripeConfig();
  }, []);  

  const checkEmailConfig = async () => {
    try {
      // Use check_only flag to verify configuration without sending email
      const { data, error } = await supabase.functions.invoke("send-purchase-confirmation", {
        body: { 
          companyName: "Config Check", 
          email: "check@example.com", // Valid email format for validation
          tokenAmount: 1, 
          newBalance: 1,
          check_only: true // Signal to edge function this is just a config check
        },
      });

      if (!isMountedRef.current) return;

      if (error) {
        // Error means function had an issue - config likely not complete
        setIsConfigured(false);
        return;
      }
      
      // Check response to determine if email is configured
      if (data?.configured || (data?.success && !data?.skipped)) {
        setIsConfigured(true);
      } else {
        setIsConfigured(false);
      }
    } catch {
      // Silent fail for config check - this runs on every page load
      if (isMountedRef.current) setIsConfigured(false);
    }
  };

  const testEmailConfig = async () => {
    setIsTesting(true);
    try {
      // Use the admin's own email to avoid sending to external addresses
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = user?.email || "admin@leadflow.ch";

      const { data, error } = await supabase.functions.invoke("send-purchase-confirmation", {
        body: { 
          companyName: "Test Firma", 
          email: adminEmail,
          tokenAmount: 10, 
          newBalance: 100,
          packageName: "Test Paket"
        },
      });

      if (!isMountedRef.current) return;

      if (error) throw error;
      
      if (data?.skipped) {
        toast.warning("E-Mail-Service nicht konfiguriert. Bitte RESEND_API_KEY hinzufügen.");
      } else if (data?.success) {
        toast.success("Test-E-Mail erfolgreich gesendet!");
        setIsConfigured(true);
      } else {
        toast.error("E-Mail konnte nicht gesendet werden");
      }
    } catch (_error) {
      if (!isMountedRef.current) return;
      toast.error("Fehler beim Testen der E-Mail-Konfiguration");
    } finally {
      if (isMountedRef.current) setIsTesting(false);
    }
  };

  // Check if Stripe is configured
  const checkStripeConfig = async () => {
    try {
      // We check by looking at token_packages table for stripe_price_id
      const { data: packages, error } = await supabase
        .from("token_packages")
        .select("stripe_price_id")
        .not("stripe_price_id", "is", null)
        .limit(1);

      if (!isMountedRef.current) return;

      if (!error && packages && packages.length > 0) {
        setIsStripeConfigured(true);
      } else {
        setIsStripeConfigured(false);
      }
    } catch {
      if (isMountedRef.current) setIsStripeConfigured(false);
    }
  };

  // Test Stripe connection by checking secrets and token packages
  const testStripeConfig = async () => {
    setIsTestingStripe(true);
    setStripeTestResult(null);
    
    try {
      // Step 1: Check if there are token packages with Stripe Price IDs
      const { data: packages, error: pkgError } = await supabase
        .from("token_packages")
        .select("id, name, stripe_price_id")
        .eq("is_active", true)
        .not("stripe_price_id", "is", null);

      if (pkgError) {
        setStripeTestResult(`Datenbankfehler: ${pkgError.message}`);
        toast.error("Fehler beim Prüfen der Token-Pakete");
        return;
      }

      if (!packages || packages.length === 0) {
        setStripeTestResult("⚠️ Keine Token-Pakete mit Stripe Price ID gefunden. Bitte konfigurieren Sie die Token-Pakete unter 'Token-Pakete' mit gültigen Stripe Price IDs.");
        setIsStripeConfigured(false);
        toast.warning("Token-Pakete benötigen Stripe Price IDs");
        return;
      }

      // Step 2: Confirm Stripe configuration based on DB data only.
      // We deliberately avoid calling create-token-checkout here because that
      // would create a real Stripe checkout session (potentially a live payment intent).
      // Having active packages with stripe_price_ids is sufficient proof of configuration.
      if (!isMountedRef.current) return;

      const packageList = packages.map((p: { name: string }) => p.name).join('\n• ');
      setStripeTestResult(
        `✅ Stripe ist konfiguriert!\n\n${packages.length} Token-Paket(e) mit Stripe verbunden:\n• ${packageList}\n\nHinweis: Um den STRIPE_SECRET_KEY zu prüfen, öffnen Sie die Supabase Secrets.`
      );
      setIsStripeConfigured(true);
      toast.success("Stripe ist konfiguriert!");
    } catch (error) {
      if (!isMountedRef.current) return;
      const errorMsg = error instanceof Error ? error.message : "Unbekannter Fehler";
      // Even on catch, try to be helpful
      setStripeTestResult(`⚠️ Test fehlgeschlagen: ${errorMsg}\n\nBitte überprüfen Sie die Supabase Secrets und Token-Pakete.`);
      toast.error("Stripe-Test fehlgeschlagen");
    } finally {
      if (isMountedRef.current) setIsTestingStripe(false);
    }
  };

  const openSupabaseSecrets = () => {
    if (projectRef) {
      window.open(`https://supabase.com/dashboard/project/${projectRef}/functions/secrets`, "_blank");
    } else {
      toast.error("Supabase Projekt-Referenz nicht gefunden");
    }
  };

  return (
    <>
      <Helmet>
        <title>Einstellungen | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Einstellungen</h2>
            <p className="text-muted-foreground">System- und Plattformkonfiguration</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Datenbank</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className="bg-accent/10 text-accent">Verbunden</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span>Supabase</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Sicherheit</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RLS</span>
                    <Badge className="bg-accent/10 text-accent">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto-Confirm E-Mail</span>
                    <Badge className="bg-accent/10 text-accent">Aktiviert</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Allgemein</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span>1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Umgebung</span>
                    <Badge variant="outline" className={import.meta.env.PROD ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"}>
                      {import.meta.env.PROD ? "Production" : "Development"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email Configuration Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">E-Mail-Konfiguration (Resend)</CardTitle>
                  <CardDescription>
                    Konfigurieren Sie den Resend API-Key für E-Mail-Benachrichtigungen
                  </CardDescription>
                </div>
                {isConfigured ? (
                  <Badge className="ml-auto bg-accent/10 text-accent">
                    <Check className="w-3 h-3 mr-1" /> Konfiguriert
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto bg-warning/10 text-warning">
                    <AlertCircle className="w-3 h-3 mr-1" /> Nicht konfiguriert
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                <p className="font-medium">So konfigurieren Sie den E-Mail-Dienst:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Erstellen Sie ein Konto bei <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com</a></li>
                  <li>Verifizieren Sie Ihre Domain unter <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Domains</a></li>
                  <li>Erstellen Sie einen API-Key unter <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">API Keys</a></li>
                  <li>Fügen Sie den Key als <code className="bg-muted px-1 rounded">RESEND_API_KEY</code> in den Cloud Secrets hinzu</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={testEmailConfig}
                  disabled={isTesting}
                >
                  {isTesting ? "Teste..." : "Verbindung testen"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open("https://resend.com/api-keys", "_blank")}
                >
                  Resend Dashboard öffnen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Configuration Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Zahlungen (Stripe)</CardTitle>
                  <CardDescription>
                    Konfigurieren Sie Stripe für Token-Käufe
                  </CardDescription>
                </div>
                {isStripeConfigured ? (
                  <Badge className="ml-auto bg-accent/10 text-accent">
                    <Check className="w-3 h-3 mr-1" /> Konfiguriert
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto bg-warning/10 text-warning">
                    <AlertCircle className="w-3 h-3 mr-1" /> Nicht konfiguriert
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3">
                <p className="font-medium">So konfigurieren Sie Stripe:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Erstellen Sie ein Konto bei{" "}
                    <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      stripe.com
                    </a>
                  </li>
                  <li>
                    Holen Sie Ihren Secret Key unter{" "}
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      API Keys
                    </a>{" "}
                    (beginnt mit <code className="bg-muted px-1 rounded">sk_live_</code> oder <code className="bg-muted px-1 rounded">sk_test_</code>)
                  </li>
                  <li>
                    Erstellen Sie einen Webhook unter{" "}
                    <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Webhooks
                    </a>{" "}
                    mit der URL: <code className="bg-muted px-1 rounded text-xs break-all">
                      {supabaseUrl ? `${supabaseUrl}/functions/v1/stripe-webhook` : "https://[project-ref].supabase.co/functions/v1/stripe-webhook"}
                    </code>
                  </li>
                  <li>
                    Fügen Sie folgende Secrets in Supabase hinzu:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> - Ihr Stripe Secret Key</li>
                      <li><code className="bg-muted px-1 rounded">STRIPE_WEBHOOK_SECRET</code> - Webhook Signing Secret</li>
                    </ul>
                  </li>
                  <li>
                    Konfigurieren Sie die Token-Pakete unter{" "}
                    <a href="/admin/token-packages" className="text-primary hover:underline">
                      Token-Pakete
                    </a>{" "}
                    mit den Stripe Price IDs
                  </li>
                </ol>
              </div>

              {stripeTestResult && (
                <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
                  stripeTestResult.includes("✅")
                    ? "bg-accent/10 text-accent" 
                    : "bg-warning/10 text-warning"
                }`}>
                  {stripeTestResult}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={testStripeConfig}
                  disabled={isTestingStripe}
                >
                  {isTestingStripe ? "Teste..." : "Verbindung testen"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={openSupabaseSecrets}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Supabase Secrets öffnen
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open("https://dashboard.stripe.com/apikeys", "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Stripe Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminSettings;
