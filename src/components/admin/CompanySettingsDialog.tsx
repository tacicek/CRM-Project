import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Loader2, Plus, Trash2, MapPin, Briefcase, Mail, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ServiceCatalog {
  id: string;
  service_type: string;
  name_de: string;
  category: string | null;
}

interface CompanyService {
  id: string;
  service_type: string;
  is_active: boolean;
}

interface PlzCoverage {
  id: string;
  plz: string;
  radius_km: number | null;
  is_active: boolean;
}

interface CompanySettingsDialogProps {
  companyId: string;
  companyName: string;
  companyEmail?: string;
  userId?: string;
  onEmailUpdated?: () => void;
}

const CompanySettingsDialog = ({ companyId, companyName, companyEmail, userId, onEmailUpdated }: CompanySettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalog[]>([]);
  const [companyServices, setCompanyServices] = useState<CompanyService[]>([]);
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [plzCoverages, setPlzCoverages] = useState<PlzCoverage[]>([]);
  const [newPlz, setNewPlz] = useState("");
  const [newRadius, setNewRadius] = useState("25");
  const [newEmail, setNewEmail] = useState(companyEmail || "");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catalogRes, servicesRes, coverageRes] = await Promise.all([
        supabase.from("service_catalog").select("id, service_type, name_de, category").eq("is_active", true).order("sort_order"),
        supabase.from("company_services").select("id, service_type, is_active").eq("company_id", companyId),
        supabase.from("company_plz_coverage").select("id, plz, radius_km, is_active").eq("company_id", companyId),
      ]);

      if (catalogRes.error) throw catalogRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (coverageRes.error) throw coverageRes.error;

      setServiceCatalog(catalogRes.data || []);
      setCompanyServices(servicesRes.data || []);
      setPlzCoverages(coverageRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    if (open) {
      fetchData();
      setNewEmail(companyEmail || "");
    }
     
  }, [open, companyEmail, fetchData]);

  const updateEmail = async () => {
    if (!userId) {
      toast({
        title: "Fehler",
        description: "Benutzer-ID nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      toast({
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    if (newEmail.trim() === companyEmail) {
      toast({
        title: "Keine Änderung",
        description: "Die E-Mail-Adresse ist identisch.",
      });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error("No valid session for admin-update-user-email");
        toast({
          title: "Sitzung abgelaufen",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-update-user-email", {
        body: {
          userId,
          newEmail: newEmail.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || data?.error) {
        let errorMessage = "E-Mail konnte nicht aktualisiert werden.";

        if (data?.error) {
          errorMessage = typeof data.error === "string" ? data.error : errorMessage;
        } else if (error) {
          // FunctionsHttpError body'sinden gerçek mesajı çek
          try {
            const errBody = await (error as { context?: { json(): Promise<{ error?: string }> } }).context?.json?.();
            errorMessage = errBody?.error || error.message || errorMessage;
          } catch {
            errorMessage = error.message || errorMessage;
          }
        }

        if (
          errorMessage.includes("already been registered") ||
          errorMessage.includes("already exists") ||
          errorMessage.includes("already registered")
        ) {
          errorMessage = "Diese E-Mail-Adresse ist bereits registriert.";
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "E-Mail aktualisiert",
        description: `Die Login-E-Mail wurde zu ${newEmail.trim()} geändert.`,
      });

      onEmailUpdated?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "E-Mail konnte nicht aktualisiert werden.";
      console.error("Error updating email:", error);
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const isServiceEnabled = (serviceType: string) => {
    return companyServices.some((s) => s.service_type === serviceType && s.is_active);
  };

  const toggleService = async (serviceType: string) => {
    // Guard against rapid double-clicks: skip if this service is already in-flight
    if (pendingToggles.has(serviceType)) return;
    setPendingToggles(prev => new Set(prev).add(serviceType));

    const existing = companyServices.find((s) => s.service_type === serviceType);
    const newIsActive = existing ? !existing.is_active : true;

    // Optimistic local update — no full refetch to avoid loading spinner on every click
    if (existing) {
      setCompanyServices(prev =>
        prev.map(s => s.service_type === serviceType ? { ...s, is_active: newIsActive } : s)
      );
    } else {
      setCompanyServices(prev => [
        ...prev,
        { id: `temp-${serviceType}`, service_type: serviceType, is_active: true },
      ]);
    }

    try {
      if (existing) {
        const { error } = await supabase
          .from("company_services")
          .update({ is_active: newIsActive })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("company_services").insert({
          company_id: companyId,
          service_type: serviceType,
          is_active: true,
        }).select("id, service_type, is_active").single();

        if (error) throw error;

        // Replace temp entry with real DB row
        if (data) {
          setCompanyServices(prev =>
            prev.map(s => s.id === `temp-${serviceType}` ? data : s)
          );
        }
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      // Rollback optimistic update
      if (existing) {
        setCompanyServices(prev =>
          prev.map(s => s.service_type === serviceType ? { ...s, is_active: existing.is_active } : s)
        );
      } else {
        setCompanyServices(prev => prev.filter(s => s.id !== `temp-${serviceType}`));
      }
      toast({
        title: "Fehler",
        description: "Service konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setPendingToggles(prev => {
        const next = new Set(prev);
        next.delete(serviceType);
        return next;
      });
    }
  };

  const addPlzCoverage = async () => {
    const trimmedPlz = newPlz.trim();

    if (!trimmedPlz || !/^\d{4}$/.test(trimmedPlz)) {
      toast({
        title: "Ungültige PLZ",
        description: "Bitte geben Sie eine gültige 4-stellige Schweizer PLZ ein.",
        variant: "destructive",
      });
      return;
    }

    // Client-side duplicate check
    if (plzCoverages.some(p => p.plz === trimmedPlz)) {
      toast({
        title: "PLZ bereits vorhanden",
        description: `PLZ ${trimmedPlz} ist bereits in der Abdeckung eingetragen.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("company_plz_coverage").insert({
        company_id: companyId,
        plz: trimmedPlz,
        radius_km: parseInt(newRadius) || 25,
        is_active: true,
      });

      if (error) throw error;

      setNewPlz("");
      setNewRadius("25");
      await fetchData();
      toast({
        title: "PLZ hinzugefügt",
        description: `PLZ ${trimmedPlz} mit ${newRadius}km Radius wurde hinzugefügt.`,
      });
    } catch (error) {
      console.error("Error adding PLZ coverage:", error);
      toast({
        title: "Fehler",
        description: "PLZ-Abdeckung konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const removePlzCoverage = async (id: string) => {
    try {
      const { error } = await supabase.from("company_plz_coverage").delete().eq("id", id);

      if (error) throw error;

      await fetchData();
      toast({
        title: "PLZ entfernt",
        description: "Die PLZ-Abdeckung wurde entfernt.",
      });
    } catch (error) {
      console.error("Error removing PLZ coverage:", error);
      toast({
        title: "Fehler",
        description: "PLZ-Abdeckung konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };

  const groupedServices = serviceCatalog.reduce((acc, service) => {
    const category = service.category || "sonstige";
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceCatalog[]>);

  const categoryLabels: Record<string, string> = {
    umzug: "Umzug",
    reinigung: "Reinigung",
    raeumung: "Räumung",
    transport: "Transport",
    lagerung: "Lagerung",
    entsorgung: "Entsorgung",
    sonstige: "Sonstige",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Services & PLZ verwalten">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Einstellungen: {companyName}</DialogTitle>
          <DialogDescription>
            Services, PLZ-Abdeckung und Login-E-Mail verwalten.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Email Section */}
            {userId && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-secondary" />
                    <h3 className="text-lg font-semibold">Login E-Mail</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ändern Sie die E-Mail-Adresse, mit der sich die Firma einloggt.
                  </p>
                  <div className="flex items-end gap-3 p-4 rounded-lg border bg-muted/30">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="new-email" className="text-sm">
                        E-Mail-Adresse
                      </Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full"
                      />
                    </div>
                    <Button 
                      onClick={updateEmail} 
                      size="sm" 
                      disabled={isUpdatingEmail || newEmail.trim() === companyEmail}
                    >
                      {isUpdatingEmail ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Speichern
                    </Button>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Services Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-secondary" />
                <h3 className="text-lg font-semibold">Services</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Wählen Sie die Services, die diese Firma anbietet.
              </p>

              <div className="space-y-4">
                {Object.entries(groupedServices).map(([category, services]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {categoryLabels[category] || category}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center space-x-2 p-2 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                        >
                          <Checkbox
                            id={service.service_type}
                            checked={isServiceEnabled(service.service_type)}
                            disabled={pendingToggles.has(service.service_type)}
                            onCheckedChange={() => toggleService(service.service_type)}
                          />
                          <Label
                            htmlFor={service.service_type}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {service.name_de}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* PLZ Coverage Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                <h3 className="text-lg font-semibold">PLZ-Abdeckung</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Definieren Sie die Postleitzahlen und Radius, in denen die Firma Leads empfangen soll.
              </p>

              {/* Add new PLZ */}
              <div className="flex items-end gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-plz" className="text-sm">
                    PLZ
                  </Label>
                  <Input
                    id="new-plz"
                    value={newPlz}
                    onChange={(e) => setNewPlz(e.target.value)}
                    placeholder="z.B. 8001"
                    maxLength={4}
                    className="w-full"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label htmlFor="new-radius" className="text-sm">
                    Radius (km)
                  </Label>
                  <Input
                    id="new-radius"
                    type="number"
                    value={newRadius}
                    onChange={(e) => setNewRadius(e.target.value)}
                    min="0"
                    max="100"
                    className="w-full"
                  />
                </div>
                <Button onClick={addPlzCoverage} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Hinzufügen
                </Button>
              </div>

              {/* Current PLZ coverages */}
              {plzCoverages.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Noch keine PLZ-Abdeckung definiert
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {plzCoverages.map((coverage) => (
                    <Badge
                      key={coverage.id}
                      variant="outline"
                      className={`px-3 py-1.5 flex items-center gap-2 ${
                        coverage.is_active
                          ? "bg-accent/10 text-accent border-accent/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      {coverage.plz}
                      {coverage.radius_km ? ` (+${coverage.radius_km}km)` : ""}
                      <button
                        onClick={() => removePlzCoverage(coverage.id)}
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompanySettingsDialog;
