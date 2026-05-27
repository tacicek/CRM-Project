import { CheckCircle, Home, FileText, Clock, Phone } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTracking } from "@/components/TrackingProvider";

export default function AnfrageErfolg() {
  const location = useLocation();
  const { loaded, trackConversion } = useTracking();
  const state = location.state as { anfrage_nummer?: string; service_type?: string } | null;
  
  // Try to get ID from URL params or state
  const searchParams = new URLSearchParams(location.search);
  const anfrageId = state?.anfrage_nummer || searchParams.get('id') || null;

  useEffect(() => {
    if (!loaded) return;
    trackConversion("lead");
  }, [loaded, trackConversion]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <nav className="container mx-auto px-4 py-4">
          <a href="https://offerio.ch" className="flex items-center gap-2">
            <img 
              src="/offerio-logo.png" 
              alt="Offerio" 
              className="h-8"
            />
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-14 h-14 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Vielen Dank für Ihre Anfrage! 🎉
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Ihre Anfrage wurde erfolgreich übermittelt. Sie erhalten in Kürze bis zu 5 
            kostenlose und unverbindliche Offerten von unseren verifizierten Partnern.
          </p>

          {/* Anfrage Number */}
          {anfrageId && (
            <div className="bg-card border border-border rounded-lg p-4 mb-8 inline-block">
              <p className="text-sm text-muted-foreground mb-1">Ihre Anfrage-Nummer</p>
              <p className="text-lg font-mono font-semibold text-primary">
                {anfrageId}
              </p>
            </div>
          )}

          {/* What Happens Next */}
          <Card className="mb-8 text-left">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Was passiert als nächstes?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Anfrage wird geprüft</h3>
                    <p className="text-sm text-muted-foreground">
                      Wir überprüfen Ihre Anfrage und leiten sie an passende Partner weiter.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Offerten erhalten</h3>
                    <p className="text-sm text-muted-foreground">
                      Innerhalb von 24 Stunden erhalten Sie bis zu 5 Offerten per E-Mail.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Vergleichen & Entscheiden</h3>
                    <p className="text-sm text-muted-foreground">
                      Vergleichen Sie die Angebote und wählen Sie den besten Partner.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <a href="https://offerio.ch">
                <Home className="w-4 h-4 mr-2" />
                Zur Startseite
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://offerio.ch/anfrage">
                Weitere Anfrage stellen
              </a>
            </Button>
          </div>

          {/* Contact Info */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Haben Sie Fragen? Kontaktieren Sie uns unter{" "}
              <a href="mailto:info@offerio.ch" className="text-primary hover:underline">
                info@offerio.ch
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

