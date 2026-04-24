/**
 * CRM Upgrade Prompt Component
 * Shown when a company tries to access CRM features without an active subscription.
 * Handles three states:
 *  1. Active trial → show countdown + subscribe CTA
 *  2. Trial expired (or never used) → show "14 Tage testen" + subscribe CTA
 *  3. Already has paid CRM (edge case) → shouldn't normally be shown
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Lock,
  Calendar,
  FileText,
  Users,
  Package,
  BarChart3,
  Eye,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  CreditCard,
  Clock,
  Gift,
} from "lucide-react";

interface CrmUpgradePromptProps {
  featureName?: string;
}

interface CompanyState {
  subscription_type: string | null;
  subscription_expires_at: string | null;
  trial_used: boolean;
}

const CRM_FEATURES = [
  {
    icon: Calendar,
    title: "Kalender & Termine",
    description: "Termine verwalten, Besichtigungen planen, Team-Kalender",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: FileText,
    title: "Offerten-System",
    description: "Professionelle PDF-Offerten erstellen und versenden",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Users,
    title: "Team-Verwaltung",
    description: "Mitarbeiter hinzufügen, Aufgaben zuweisen",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon: Eye,
    title: "Besichtigungen",
    description: "Besichtigungsanfragen verwalten und bestätigen",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Package,
    title: "Umzugsboxen",
    description: "Mietboxen-Tracking und Erinnerungen",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Berichte & Analysen",
    description: "Umsatzstatistiken und Performance-Übersicht",
    color: "from-indigo-500 to-blue-500",
  },
];

const getDaysLeft = (expiresAt: string | null): number => {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export function CrmUpgradePrompt({ featureName }: CrmUpgradePromptProps) {
  const { toast } = useToast();
  const [isSubscribeLoading, setIsSubscribeLoading] = useState(false);
  const [isTrialLoading, setIsTrialLoading] = useState(false);
  const [companyState, setCompanyState] = useState<CompanyState | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("companies")
        .select("subscription_type, subscription_expires_at, trial_used")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) setCompanyState(data as CompanyState);
    };
    load();
  }, []);

  const isTrial = companyState?.subscription_type === "trial";
  const trialActive = isTrial && getDaysLeft(companyState?.subscription_expires_at ?? null) > 0;
  const trialExpired = isTrial && !trialActive;
  const trialUsed = companyState?.trial_used ?? false;
  const daysLeft = getDaysLeft(companyState?.subscription_expires_at ?? null);

  const handleSubscribe = async () => {
    setIsSubscribeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nicht angemeldet");

      const response = await supabase.functions.invoke("create-crm-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      if (response.data?.url) window.location.href = response.data.url;
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsSubscribeLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setIsTrialLoading(true);
    try {
      const { data, error } = await supabase.rpc("activate_self_trial", { p_days: 14 });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error ?? "Trial konnte nicht aktiviert werden");

      toast({
        title: "Trial aktiviert!",
        description: "Sie haben 14 Tage kostenlosen Zugang zu Offerio CRM.",
      });
      // Reload page to apply access
      window.location.reload();
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsTrialLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">

        {/* Active trial banner */}
        {trialActive && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 font-medium">
              Ihr Testzeitraum läuft noch <strong>{daysLeft} {daysLeft === 1 ? "Tag" : "Tage"}</strong>. Abonnieren Sie jetzt, um nahtlos weiterzumachen.
            </AlertDescription>
          </Alert>
        )}

        {/* Trial expired banner */}
        {trialExpired && (
          <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium">
              Ihr 14-tägiger Testzeitraum ist abgelaufen. Abonnieren Sie jetzt, um wieder Zugang zu erhalten.
            </AlertDescription>
          </Alert>
        )}

        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-6">
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {featureName ? (
              <>
                <span className="text-amber-600">{featureName}</span> ist Teil von{" "}
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Offerio CRM
                </span>
              </>
            ) : (
              <>
                Schalten Sie{" "}
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Offerio CRM
                </span>{" "}
                frei
              </>
            )}
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upgraden Sie auf unser CRM-Paket und nutzen Sie alle professionellen Funktionen
            zur Verwaltung Ihrer Aufträge, Termine und Kunden.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {CRM_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-2 hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pricing Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full blur-3xl" />

          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 px-4 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                Meistgewählt
              </Badge>
            </div>
            <CardTitle className="text-2xl">Offerio CRM</CardTitle>
            <CardDescription>Alle Funktionen für professionelles Auftragsmanagement</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Unbegrenzte Offerten",
                "Kalender & Termine",
                "Team-Verwaltung",
                "Umzugsboxen-Tracking",
                "Berichte & Analysen",
                "Prioritäts-Support",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  CHF 200 <span className="text-base font-normal text-muted-foreground">/ Monat</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Monatlich kündbar · Sichere Zahlung via Stripe</p>
              </div>

              {/* Subscribe button (always shown) */}
              <Button
                size="lg"
                onClick={handleSubscribe}
                disabled={isSubscribeLoading || isTrialLoading}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg"
              >
                {isSubscribeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {isSubscribeLoading ? "Weiterleitung..." : trialActive ? "Jetzt abonnieren (Trial umwandeln)" : "Jetzt abonnieren"}
                {!isSubscribeLoading && <ArrowRight className="w-4 h-4" />}
              </Button>

              {/* Self-serve trial button — only if trial never used */}
              {!trialUsed && !trialActive && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleStartTrial}
                  disabled={isTrialLoading || isSubscribeLoading}
                  className="w-full sm:w-auto gap-2"
                >
                  {isTrialLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  {isTrialLoading ? "Wird aktiviert..." : "14 Tage kostenlos testen"}
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                {trialActive
                  ? "Billing startet sobald Sie abonnieren. Trial-Tage verfallen."
                  : "Sie werden zu Stripe weitergeleitet. Keine Mindestlaufzeit."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <div className="text-center mt-6">
          <Link to="/firma">
            <Button variant="ghost" className="text-muted-foreground">
              Zurück zum Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CrmUpgradePrompt;
