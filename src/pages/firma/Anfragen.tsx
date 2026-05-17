import { Helmet } from "react-helmet-async";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Plus,
  Search,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react";
import { getServiceLabel } from "@/lib/serviceLabels";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Lead {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  from_plz: string | null;
  from_city: string | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_plz: string | null;
  to_city: string | null;
  preferred_date: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
  detailed_form_data: Record<string, unknown> | null;
}

const SERVICE_COLORS: Record<string, string> = {
  umzug: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reinigung: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  raeumung: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  transport: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  lagerung: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  entsorgung: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function getServiceColor(serviceType: string): string {
  const key = Object.keys(SERVICE_COLORS).find((k) =>
    serviceType?.toLowerCase().includes(k)
  );
  return key ? SERVICE_COLORS[key] : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd. MMM yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

function getCustomerName(lead: Lead): string {
  const name = `${lead.customer_first_name || ""} ${lead.customer_last_name || ""}`.trim();
  return name || "Unbekannter Kunde";
}

export default function FirmaAnfragen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useCachedCompany("id");
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads((data as Lead[]) || []);
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast({
        title: "Fehler",
        description: "Anfragen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleDelete = async (leadId: string) => {
    if (!confirm("Diese Anfrage wirklich löschen?")) return;
    setIsDeleting(leadId);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId)
        .eq("company_id", companyId!);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      if (selectedLead?.id === leadId) setSelectedLead(null);
      toast({ title: "Gelöscht", description: "Anfrage wurde entfernt." });
    } catch (err) {
      console.error(err);
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateOffer = (lead: Lead) => {
    navigate(`/firma/offerten/neu?lead=${lead.id}`);
  };

  // Collect unique service types from leads
  const serviceTypes = Array.from(new Set(leads.map((l) => l.service_type).filter(Boolean)));

  const filtered = leads.filter((lead) => {
    const name = getCustomerName(lead).toLowerCase();
    const city = `${lead.from_city || ""} ${lead.to_city || ""}`.toLowerCase();
    const search = searchQuery.toLowerCase();
    const matchesSearch = !search || name.includes(search) || city.includes(search) ||
      lead.customer_email?.toLowerCase().includes(search) ||
      lead.customer_phone?.includes(search) ||
      lead.from_plz?.includes(search) ||
      lead.to_plz?.includes(search);
    const matchesService = serviceFilter === "all" || lead.service_type === serviceFilter;
    return matchesSearch && matchesService;
  });

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Anfragen | Firma</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">Anfragen</h2>
            <p className="text-muted-foreground text-sm">
              {leads.length} importierte Anfrage{leads.length !== 1 ? "n" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLeads} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
            <Button size="sm" onClick={() => navigate("/firma/manual-import")}>
              <Plus className="w-4 h-4 mr-2" />
              Neue Anfrage
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Ort, E-Mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alle Dienste" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Dienste</SelectItem>
              {serviceTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getServiceLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {leads.length === 0 ? (
              <div className="space-y-3">
                <Package className="w-12 h-12 mx-auto opacity-30" />
                <p className="font-medium">Noch keine Anfragen importiert</p>
                <p className="text-sm">Importieren Sie Anfragen aus Ihren E-Mails oder Webformularen.</p>
                <Button onClick={() => navigate("/firma/manual-import")} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Erste Anfrage importieren
                </Button>
              </div>
            ) : (
              <p>Keine Anfragen entsprechen Ihrer Suche.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead) => (
              <div
                key={lead.id}
                className="border rounded-xl bg-card shadow-sm overflow-hidden"
              >
                {/* Top colored bar */}
                <div className={`h-1 w-full ${getServiceColor(lead.service_type).includes('blue') ? 'bg-blue-400' : getServiceColor(lead.service_type).includes('green') ? 'bg-green-400' : getServiceColor(lead.service_type).includes('orange') ? 'bg-orange-400' : getServiceColor(lead.service_type).includes('purple') ? 'bg-purple-400' : 'bg-gray-400'}`} />

                <div className="p-4 space-y-3">
                  {/* Header: service type + date badge */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs font-medium ${getServiceColor(lead.service_type)}`}>
                        {getServiceLabel(lead.service_type)}
                      </Badge>
                      {lead.preferred_date && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(lead.preferred_date)}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {lead.from_rooms && <span>{lead.from_rooms} Zimmer</span>}
                    {lead.from_living_space_m2 && <span>{lead.from_living_space_m2} m²</span>}
                    {(lead.from_city || lead.from_plz) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {lead.from_plz} {lead.from_city}
                        {lead.to_city && <> → {lead.to_plz} {lead.to_city}</>}
                      </span>
                    )}
                  </div>

                  {/* Customer info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {(lead.customer_first_name?.[0] || lead.customer_last_name?.[0] || "?").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{getCustomerName(lead)}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {lead.customer_phone && (
                          <a href={`tel:${lead.customer_phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="w-3 h-3" />{lead.customer_phone}
                          </a>
                        )}
                        {lead.customer_email && (
                          <a href={`mailto:${lead.customer_email}`} className="flex items-center gap-1 hover:text-foreground">
                            <Mail className="w-3 h-3" />{lead.customer_email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleCreateOffer(lead)}
                      className="gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      Offerte erstellen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/firma/besichtigungen?lead_id=${lead.id}`)}
                      className="gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      V. Besichtigung
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedLead(lead)}
                      className="gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive ml-auto"
                      onClick={() => handleDelete(lead.id)}
                      disabled={isDeleting === lead.id}
                    >
                      {isDeleting === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedLead && (
        <Dialog open onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{getCustomerName(selectedLead)}</DialogTitle>
              <DialogDescription>
                {getServiceLabel(selectedLead.service_type)} · Importiert am{" "}
                {formatDate(selectedLead.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Contact */}
              <div>
                <p className="font-medium mb-2">Kontakt</p>
                <div className="space-y-1 text-muted-foreground">
                  {selectedLead.customer_email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4 shrink-0" />
                      <a href={`mailto:${selectedLead.customer_email}`} className="hover:underline">
                        {selectedLead.customer_email}
                      </a>
                    </p>
                  )}
                  {selectedLead.customer_phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0" />
                      <a href={`tel:${selectedLead.customer_phone}`} className="hover:underline">
                        {selectedLead.customer_phone}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Locations */}
              {(selectedLead.from_city || selectedLead.to_city) && (
                <>
                  <div>
                    <p className="font-medium mb-2">Adresse</p>
                    <div className="space-y-1 text-muted-foreground">
                      {selectedLead.from_city && (
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 shrink-0" />
                          Von: {selectedLead.from_plz} {selectedLead.from_city}
                        </p>
                      )}
                      {selectedLead.to_city && (
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 shrink-0" />
                          Nach: {selectedLead.to_plz} {selectedLead.to_city}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Date & details */}
              <div className="space-y-1 text-muted-foreground">
                {selectedLead.preferred_date && (
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    Datum: {formatDate(selectedLead.preferred_date)}
                  </p>
                )}
                {selectedLead.from_rooms && <p>Zimmer: {selectedLead.from_rooms}</p>}
                {selectedLead.from_living_space_m2 && <p>Fläche: {selectedLead.from_living_space_m2} m²</p>}
              </div>

              {selectedLead.description && (
                <>
                  <Separator />
                  <div>
                    <p className="font-medium mb-1">Beschreibung</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedLead.description}</p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => handleCreateOffer(selectedLead)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Offerte erstellen
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedLead.id)}
                  disabled={isDeleting === selectedLead.id}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
