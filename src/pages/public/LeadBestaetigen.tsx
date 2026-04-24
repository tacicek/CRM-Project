import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ConfirmStatus =
  | "loading"
  | "confirmed"
  | "already_confirmed"
  | "expired"
  | "not_found"
  | "invalid_token"
  | "error";

interface ConfirmResponse {
  success: boolean;
  status: ConfirmStatus;
}

export default function LeadBestaetigen() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<ConfirmStatus>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid_token");
      return;
    }

    let cancelled = false;

    const confirm = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "confirm-lead-by-token",
          { body: { token } },
        );

        if (cancelled) return;

        if (error) {
          // Edge function non-2xx — dataya düşürülebilen response varsa kullan
          const resp = (error.context as { status?: ConfirmStatus } | undefined);
          if (resp?.status) {
            setStatus(resp.status);
          } else {
            setStatus("error");
          }
          return;
        }

        const resp = data as ConfirmResponse | null;
        if (resp?.status) {
          setStatus(resp.status);
        } else {
          setStatus("error");
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[LeadBestaetigen] invoke failed", e);
          setStatus("error");
        }
      }
    };

    confirm();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isSuccess = status === "confirmed" || status === "already_confirmed";
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20 dark:to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center">
          {isLoading && (
            <>
              <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold mb-2">Wird geprüft...</h1>
              <p className="text-muted-foreground">
                Einen Moment bitte, wir bestätigen Ihre Anfrage.
              </p>
            </>
          )}

          {status === "confirmed" && (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Vielen Dank!
              </h1>
              <p className="text-muted-foreground mb-6">
                Ihre Anfrage wurde erfolgreich bestätigt und wird nun von unseren Partnerfirmen bearbeitet.
                Sie erhalten in Kürze passende Offerten.
              </p>
            </>
          )}

          {status === "already_confirmed" && (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Bereits bestätigt
              </h1>
              <p className="text-muted-foreground mb-6">
                Diese Anfrage wurde bereits bestätigt. Sie müssen nichts weiter tun.
              </p>
            </>
          )}

          {status === "expired" && (
            <>
              <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Link abgelaufen
              </h1>
              <p className="text-muted-foreground mb-6">
                Der Bestätigungs-Link ist abgelaufen (48 Stunden gültig).
                Bitte senden Sie Ihre Anfrage erneut.
              </p>
            </>
          )}

          {status === "not_found" && (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Link ungültig
              </h1>
              <p className="text-muted-foreground mb-6">
                Dieser Bestätigungs-Link ist nicht gültig.
                Bitte prüfen Sie, ob Sie den Link korrekt geöffnet haben.
              </p>
            </>
          )}

          {status === "invalid_token" && (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Ungültiger Link
              </h1>
              <p className="text-muted-foreground mb-6">
                Der Bestätigungs-Token hat ein ungültiges Format.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-2">
                Fehler
              </h1>
              <p className="text-muted-foreground mb-6">
                Bei der Bestätigung ist ein Fehler aufgetreten.
                Bitte versuchen Sie es später erneut.
              </p>
            </>
          )}

          {!isLoading && (
            <Button asChild variant={isSuccess ? "default" : "outline"}>
              <a href="https://offerio.ch">
                <Home className="w-4 h-4 mr-2" />
                Zur Startseite
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
