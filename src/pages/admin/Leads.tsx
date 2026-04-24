import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Loader2, RefreshCw, MapPin, User, Calendar, Package, Phone, Mail, Building2, CheckCircle, XCircle, Clock, Users, Search, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { getServiceLabel } from "@/lib/serviceLabels";
import { getServiceCategory } from "@/components/admin/leads/utils";
import { Progress } from "@/components/ui/progress";
import LeadDistributionDebug from "@/components/admin/LeadDistributionDebug";
import { toast } from "sonner";

// =============================================================================
// CONSTANTS
// =============================================================================

const PENDING_STATUSES = ["pending_verification", "pending", "new"] as const;
const VERIFIED_STATUSES = ["verified", "distributed", "completed"] as const;
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a lead status is pending
 */
const isPendingStatus = (status: string | null): boolean => {
  return status !== null && (PENDING_STATUSES as readonly string[]).includes(status);
};

/**
 * Check if a lead status is verified/distributed
 */
const isVerifiedStatus = (status: string | null): boolean => {
  return status !== null && (VERIFIED_STATUSES as readonly string[]).includes(status);
};

/**
 * Format floor number with proper German formatting (including basement)
 */
const formatFloor = (floor: number | null): string => {
  if (floor === null) return '';
  if (floor === 0) return 'EG';
  if (floor < 0) return `${Math.abs(floor)}. UG`; // Untergeschoss (basement)
  return `${floor}. Stock`;
};

/**
 * Safe date formatting with error handling
 */
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return '-';
  }
};

/**
 * Safe date formatting (date only)
 */
const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString("de-CH");
  } catch {
    return '-';
  }
};

/**
 * Safe progress calculation (prevents division by zero)
 */
const calculateProgress = (current: number | null, max: number | null): number => {
  const currentVal = current ?? 0;
  const maxVal = max ?? 1;
  if (maxVal <= 0) return 0;
  return Math.min(100, (currentVal / maxVal) * 100);
};

/**
 * Safe string concatenation for addresses
 */
const formatAddress = (plz: string | null | undefined, city: string | null | undefined): string => {
  const parts = [plz, city].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
};

interface LeadDistribution {
  id: string;
  lead_id: string;
  company_id: string;
  status: string;
  token_cost: number | null;
  sent_at: string | null;
  responded_at: string | null;
  company?: {
    company_name: string;
    email: string;
  };
}

interface Lead {
  id: string;
  slug: string;
  service_type: string;
  from_plz: string;
  from_city: string;
  from_street: string | null;
  from_house_number: string | null;
  from_floor: number | null;
  from_has_lift: boolean | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_plz: string | null;
  to_city: string | null;
  to_street: string | null;
  to_house_number: string | null;
  to_floor: number | null;
  to_has_lift: boolean | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  status: string | null;
  created_at: string;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  is_flexible_date: boolean | null;
  description: string | null;
  special_items: string[] | null;
  max_companies: number;
  token_cost: number | null;
  accepted_count: number | null;
  // Umzug fields
  packing_service_needed: boolean | null;
  cleaning_service_needed: boolean | null;
  storage_needed: boolean | null;
  // Klaviertransport fields
  piano_type: string | null;
  piano_brand: string | null;
  piano_weight_kg: number | null;
  staircase_type: string | null;
  staircase_width_cm: number | null;
  staircase_turns: number | null;
  window_access_possible: boolean | null;
  // Möbellift fields
  moebellift_floor: number | null;
  moebellift_item_description: string | null;
  moebellift_item_dimensions: string | null;
  // Reinigung fields
  property_type: string | null;
  bathroom_count: number | null;
  has_balcony: boolean | null;
  has_garage: boolean | null;
  has_basement: boolean | null;
  has_attic: boolean | null;
  // Räumung fields
  clearing_type: string | null;
  estimated_volume: string | null;
  has_heavy_items: boolean | null;
  heavy_items_description: string | null;
  // Entsorgung fields
  disposal_type: string | null;
  items_description: string | null;
  // Lagerung fields
  storage_duration: string | null;
  storage_volume: string | null;
  access_frequency: string | null;
  needs_climate_control: boolean | null;
  storage_items_description: string | null;
}

const AdminLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDistributions, setLeadDistributions] = useState<LeadDistribution[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDistributions, setIsLoadingDistributions] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // AbortController refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const distributionAbortRef = useRef<AbortController | null>(null);

  // Fetch leads with cleanup support
  const fetchLeads = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .neq("source", "import")
        .order("created_at", { ascending: false })
        .limit(500);

      // Check if request was aborted
      if (signal?.aborted) return;

      if (error) throw error;
      
      // Type-safe data handling
      if (Array.isArray(data)) {
        setLeads(data as Lead[]);
      } else {
        setLeads([]);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching leads:", error);
      toast.error("Fehler beim Laden der Leads");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Initial fetch with cleanup
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    fetchLeads(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [fetchLeads]);

  // Fetch distributions with race condition prevention
  const fetchLeadDistributions = useCallback(async (leadId: string) => {
    // Abort any previous distribution request
    if (distributionAbortRef.current) {
      distributionAbortRef.current.abort();
    }
    
    const controller = new AbortController();
    distributionAbortRef.current = controller;
    
    setIsLoadingDistributions(true);
    try {
      const { data, error } = await supabase
        .from("lead_distributions")
        .select(`
          id,
          lead_id,
          company_id,
          status,
          token_cost,
          sent_at,
          responded_at,
          company:companies(company_name, email)
        `)
        .eq("lead_id", leadId)
        .order("sent_at", { ascending: false });

      if (controller.signal.aborted) return;

      if (error) throw error;
      
      // Type-safe handling with validation
      if (Array.isArray(data)) {
        const distributions: LeadDistribution[] = data.map((d) => ({
          id: d.id,
          lead_id: d.lead_id,
          company_id: d.company_id,
          status: d.status,
          token_cost: d.token_cost,
          sent_at: d.sent_at,
          responded_at: d.responded_at,
          company: (() => {
            const raw = d.company;
            if (!raw) return undefined;
            // PostgREST may return an array for some join configurations
            const obj = Array.isArray(raw) ? raw[0] : raw;
            if (!obj) return undefined;
            return {
              company_name: (obj as { company_name?: string }).company_name || 'Unbekannt',
              email: (obj as { email?: string }).email || '',
            };
          })()
        }));
        setLeadDistributions(distributions);
      } else {
        setLeadDistributions([]);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Error fetching distributions:", error);
      toast.error("Fehler beim Laden der Firmenverteilung");
      setLeadDistributions([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingDistributions(false);
      }
    }
  }, []);

  // Open lead detail with race condition prevention
  const openLeadDetail = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setLeadDistributions([]); // Clear previous distributions immediately
    setIsDetailOpen(true);
    fetchLeadDistributions(lead.id);
  }, [fetchLeadDistributions]);

  // Handle refresh button
  const handleRefresh = useCallback(() => {
    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchLeads(controller.signal, true);
  }, [fetchLeads]);

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    let filtered = leads;
    
    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        filtered = filtered.filter(l => isPendingStatus(l.status));
      } else if (statusFilter === "verified") {
        filtered = filtered.filter(l => isVerifiedStatus(l.status));
      } else if (statusFilter === "rejected") {
        filtered = filtered.filter(l => l.status === "rejected");
      } else {
        filtered = filtered.filter(l => l.status === statusFilter);
      }
    }
    
    // Filter by service type
    if (serviceFilter !== "all") {
      filtered = filtered.filter(l => l.service_type === serviceFilter);
    }
    
    // Search filter (null-safe)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => {
        const firstName = l.customer_first_name?.toLowerCase() || '';
        const lastName = l.customer_last_name?.toLowerCase() || '';
        const email = l.customer_email?.toLowerCase() || '';
        const phone = l.customer_phone || '';
        const city = l.from_city?.toLowerCase() || '';
        const slug = l.slug?.toLowerCase() || '';
        const toCity = l.to_city?.toLowerCase() || '';
        
        return firstName.includes(query) ||
          lastName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          city.includes(query) ||
          slug.includes(query) ||
          toCity.includes(query);
      });
    }
    
    return filtered;
  }, [leads, statusFilter, serviceFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, serviceFilter, searchQuery, pageSize]);

  // Get unique service types for filter dropdown
  const serviceTypes = useMemo(() => {
    const types = new Set(leads.map(l => l.service_type));
    return Array.from(types).sort();
  }, [leads]);


  const getStatusBadge = useCallback((status: string | null) => {
    // Use helper functions for grouped statuses
    if (isPendingStatus(status)) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Ausstehend</Badge>;
    }
    
    switch (status) {
      case "verified":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Verifiziert</Badge>;
      case "distributed":
        return <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30">Verteilt</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Abgeschlossen</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Abgelaufen</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Abgelehnt</Badge>;
      case "no_matches":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Keine Firmen</Badge>;
      case "imported":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Importiert</Badge>;
      default:
        return <Badge variant="outline">{status || "Unbekannt"}</Badge>;
    }
  }, []);

  const getDistributionStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Gesendet</Badge>;
      case "accepted":
        return <Badge className="bg-green-500 text-white">Angenommen</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Abgelehnt</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Abgelaufen</Badge>;
      case "quota_full":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Kontingent voll</Badge>;
      default:
        return <Badge variant="outline">{status || "Unbekannt"}</Badge>;
    }
  }, []);

  // getServiceCategory is imported from @/components/admin/leads/utils (shared utility)

  const renderCategoryDetails = useCallback((lead: Lead) => {
    const category = getServiceCategory(lead.service_type);

    switch (category) {
      case "umzug": {
        const volLabels: Record<string, string> = {klein:"Klein",mittel:"Mittel",gross:"Gross","sehr-gross":"Sehr gross"};
        const flexLabels: Record<string, string> = {fix:"Festes Datum","3":"± 3 Tage","7":"± 1 Woche","14":"± 2 Wochen"};
        const vol = (lead.detailed_form_data as Record<string,unknown> | null)?.vol as string | undefined;
        const svc = (lead.additional_services_umzug as Record<string,unknown> | null) || {};
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Umzugsdetails</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.from_rooms && <div><span className="text-muted-foreground">Zimmer:</span> {lead.from_rooms}</div>}
              {lead.from_living_space_m2 && <div><span className="text-muted-foreground">Fläche:</span> {lead.from_living_space_m2} m²</div>}
              {vol && <div><span className="text-muted-foreground">Umfang:</span> {volLabels[vol] || vol}</div>}
              {lead.moving_flexibility && <div><span className="text-muted-foreground">Flexibilität:</span> {flexLabels[lead.moving_flexibility] || lead.moving_flexibility}</div>}
            </div>
            <div className="flex flex-wrap gap-1 text-xs mt-1">
              {lead.packing_service_needed && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">📦 Verpackung</span>}
              {(svc.moebelmontage) && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">🔧 Montage</span>}
              {lead.cleaning_service_needed && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">🧹 Reinigung</span>}
              {(svc as Record<string,Record<string,unknown>>).entsorgung?.aktiv && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">🗑️ Entsorgung</span>}
              {lead.storage_needed && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">🏭 Lagerung</span>}
              {(svc as Record<string,Record<string,unknown>>).moebellift?.aktiv && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">🏗️ Möbellift</span>}
              {(svc as Record<string,Record<string,unknown>>).sperrgut?.aktiv && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🎹 Sperrgut</span>}
            </div>
          </div>
        );
      }

      case "reinigung":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Reinigungsdetails</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.property_type && <div><span className="text-muted-foreground">Objekttyp:</span> {lead.property_type}</div>}
              {lead.from_rooms && <div><span className="text-muted-foreground">Zimmer:</span> {lead.from_rooms}</div>}
              {lead.bathroom_count && <div><span className="text-muted-foreground">Badezimmer:</span> {lead.bathroom_count}</div>}
              {lead.from_living_space_m2 && <div><span className="text-muted-foreground">Fläche:</span> {lead.from_living_space_m2} m²</div>}
              {lead.has_balcony && <div className="text-green-600">✓ Mit Balkon</div>}
              {lead.has_garage && <div className="text-green-600">✓ Mit Garage</div>}
              {lead.has_basement && <div className="text-green-600">✓ Mit Keller</div>}
              {lead.has_attic && <div className="text-green-600">✓ Mit Estrich</div>}
            </div>
          </div>
        );

      case "raeumung":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Räumungsdetails</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.clearing_type && <div><span className="text-muted-foreground">Art:</span> {lead.clearing_type}</div>}
              {lead.estimated_volume && <div><span className="text-muted-foreground">Volumen:</span> {lead.estimated_volume}</div>}
              {lead.has_heavy_items && <div className="text-orange-600">⚠ Schwere Gegenstände</div>}
              {lead.heavy_items_description && <div className="col-span-2"><span className="text-muted-foreground">Beschreibung:</span> {lead.heavy_items_description}</div>}
            </div>
          </div>
        );

      case "entsorgung":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Entsorgungsdetails</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.disposal_type && <div><span className="text-muted-foreground">Art:</span> {lead.disposal_type}</div>}
              {lead.estimated_volume && <div><span className="text-muted-foreground">Volumen:</span> {lead.estimated_volume}</div>}
              {lead.items_description && <div className="col-span-2"><span className="text-muted-foreground">Gegenstände:</span> {lead.items_description}</div>}
            </div>
          </div>
        );

      case "lagerung":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Lagerungsdetails</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.storage_duration && <div><span className="text-muted-foreground">Dauer:</span> {lead.storage_duration}</div>}
              {lead.storage_volume && <div><span className="text-muted-foreground">Volumen:</span> {lead.storage_volume}</div>}
              {lead.access_frequency && <div><span className="text-muted-foreground">Zugang:</span> {lead.access_frequency}</div>}
              {lead.needs_climate_control && <div className="text-blue-600">❄ Klimatisiert gewünscht</div>}
              {lead.storage_items_description && <div className="col-span-2"><span className="text-muted-foreground">Gegenstände:</span> {lead.storage_items_description}</div>}
            </div>
          </div>
        );

      case "klaviertransport":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Klaviertransport-Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.piano_type && <div><span className="text-muted-foreground">Typ:</span> {lead.piano_type}</div>}
              {lead.piano_brand && <div><span className="text-muted-foreground">Marke:</span> {lead.piano_brand}</div>}
              {lead.piano_weight_kg && <div><span className="text-muted-foreground">Gewicht:</span> {lead.piano_weight_kg} kg</div>}
              {lead.staircase_type && <div><span className="text-muted-foreground">Treppe:</span> {lead.staircase_type}</div>}
              {lead.staircase_width_cm && <div><span className="text-muted-foreground">Treppenbreite:</span> {lead.staircase_width_cm} cm</div>}
              {lead.staircase_turns && <div><span className="text-muted-foreground">Kurven:</span> {lead.staircase_turns}</div>}
              {lead.window_access_possible && <div className="text-green-600">✓ Fensterzugang möglich</div>}
            </div>
          </div>
        );

      case "moebellift":
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Möbellift-Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.moebellift_floor !== null && <div><span className="text-muted-foreground">Stockwerk:</span> {formatFloor(lead.moebellift_floor)}</div>}
              {lead.moebellift_item_description && <div className="col-span-2"><span className="text-muted-foreground">Gegenstand:</span> {lead.moebellift_item_description}</div>}
              {lead.moebellift_item_dimensions && <div><span className="text-muted-foreground">Masse:</span> {lead.moebellift_item_dimensions}</div>}
            </div>
          </div>
        );

      case "spezialtransport": {
        const dfd = lead.detailed_form_data as Record<string, unknown> | null;
        return (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Spezialtransport-Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {dfd?.kat && <div className="col-span-2"><span className="text-muted-foreground">Kategorie:</span> {String(dfd.kat)}</div>}
              {dfd?.detailAnswer !== undefined && dfd?.detailAnswer !== null && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Details:</span>{" "}
                  {typeof dfd.detailAnswer === "object" ? JSON.stringify(dfd.detailAnswer) : String(dfd.detailAnswer)}
                </div>
              )}
              {lead.from_floor !== null && lead.from_floor !== undefined && (
                <div><span className="text-muted-foreground">Stockwerk (Von):</span> {formatFloor(lead.from_floor as number)}</div>
              )}
              {lead.to_floor !== null && lead.to_floor !== undefined && (
                <div><span className="text-muted-foreground">Stockwerk (Nach):</span> {formatFloor(lead.to_floor as number)}</div>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Leads | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Leads</h2>
              <p className="text-muted-foreground">Alle Kundenanfragen verwalten</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={isLoading || isRefreshing}
              aria-label="Leads aktualisieren"
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),200px,220px] gap-3 md:gap-4">
                {/* Search */}
                <div className="relative md:col-span-2 xl:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen (Name, E-Mail, Telefon, Stadt, Referenz...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Leads durchsuchen"
                  />
                </div>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]" aria-label="Status filtern">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="verified">Verifiziert</SelectItem>
                    <SelectItem value="distributed">Verteilt</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                    <SelectItem value="expired">Abgelaufen</SelectItem>
                    <SelectItem value="no_matches">Keine Firmen</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Service Filter */}
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-full md:w-[200px]" aria-label="Service filtern">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Services</SelectItem>
                    {serviceTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {getServiceLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Results info */}
              <div className="mt-4 text-sm text-muted-foreground">
                {filteredLeads.length === leads.length 
                  ? `${leads.length} Leads insgesamt`
                  : `${filteredLeads.length} von ${leads.length} Leads`
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Leads</span>
                {filteredLeads.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    Seite {currentPage} von {totalPages}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {leads.length === 0 
                    ? "Noch keine Leads vorhanden"
                    : "Keine Leads gefunden für die aktuellen Filter"
                  }
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="xl:hidden space-y-3">
                    {paginatedLeads.map((lead) => (
                      <div 
                        key={`mobile-${lead.id}`}
                        className="border rounded-xl p-4 space-y-3 bg-card shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openLeadDetail(lead)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openLeadDetail(lead);
                          }
                        }}
                        role="button"
                        aria-label={`Lead ${lead.slug || lead.id.substring(0, 8)} Details öffnen`}
                      >
                        {/* Header: Reference + Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-medium break-all">
                                {lead.slug || lead.id.substring(0, 8)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getServiceLabel(lead.service_type)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(lead.created_at)}
                            </p>
                          </div>
                          {getStatusBadge(lead.status)}
                        </div>

                        {/* Route: Von → Nach */}
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="text-muted-foreground">Von: </span>
                            <span className="font-medium break-words [overflow-wrap:anywhere]">{formatAddress(lead.from_plz, lead.from_city)}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0 text-right">
                            <span className="text-muted-foreground">Nach: </span>
                            <span className="font-medium break-words [overflow-wrap:anywhere]">{lead.to_city || "-"}</span>
                          </div>
                        </div>

                        {/* Customer Info */}
                        <div className="text-sm">
                          <div className="font-medium">
                            {[lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(' ') || '-'}
                          </div>
                          <div className="text-muted-foreground break-all">
                            {lead.customer_email || '-'}
                          </div>
                        </div>

                        {/* Companies + Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Firmen:</span>
                            <span className={`font-medium ${
                              (lead.accepted_count || 0) >= (lead.max_companies || 1)
                                ? "text-green-600" 
                                : "text-muted-foreground"
                            }`}>
                              {lead.accepted_count || 0}/{lead.max_companies || 1}
                            </span>
                            {(lead.accepted_count || 0) >= (lead.max_companies || 1) && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLeadDetail(lead);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden xl:block overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Referenz</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Von</TableHead>
                          <TableHead>Nach</TableHead>
                          <TableHead className="min-w-[220px]">Kunde</TableHead>
                          <TableHead>Firmen</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Erstellt</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLeads.map((lead) => (
                          <TableRow 
                            key={lead.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openLeadDetail(lead)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openLeadDetail(lead);
                              }
                            }}
                            role="button"
                            aria-label={`Lead ${lead.slug || lead.id.substring(0, 8)} Details öffnen`}
                          >
                            <TableCell className="font-mono text-sm">
                              {lead.slug || lead.id.substring(0, 8)}
                            </TableCell>
                            <TableCell>{getServiceLabel(lead.service_type)}</TableCell>
                            <TableCell>
                              {formatAddress(lead.from_plz, lead.from_city)}
                            </TableCell>
                            <TableCell>{lead.to_city || "-"}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {[lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(' ') || '-'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {lead.customer_email || '-'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className={`font-medium ${
                                  (lead.accepted_count || 0) >= (lead.max_companies || 1)
                                    ? "text-green-600" 
                                    : "text-muted-foreground"
                                }`}>
                                  {lead.accepted_count || 0}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{lead.max_companies || 1}</span>
                                {(lead.accepted_count || 0) >= (lead.max_companies || 1) && (
                                  <CheckCircle className="w-3 h-3 text-green-600 ml-1" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[120px]">{getStatusBadge(lead.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(lead.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLeadDetail(lead);
                                }}
                                aria-label="Details anzeigen"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Zeilen pro Seite:</span>
                        <Select 
                          value={String(pageSize)} 
                          onValueChange={(v) => setPageSize(Number(v))}
                        >
                          <SelectTrigger className="w-[70px] h-8" aria-label="Zeilen pro Seite">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredLeads.length)} von {filteredLeads.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          aria-label="Vorherige Seite"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          aria-label="Nächste Seite"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lead Detail Dialog
            Note: accepted_count is derived from fresh leadDistributions to avoid stale data
            from the initial leads fetch. selectedLead.accepted_count may be outdated. */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Lead Details - {selectedLead?.slug || selectedLead?.id.substring(0, 8)}
              </DialogTitle>
            </DialogHeader>

            {selectedLead && (() => {
              // Derive accepted count from fresh distribution data (more accurate than stale selectedLead.accepted_count)
              const liveAcceptedCount = isLoadingDistributions
                ? (selectedLead.accepted_count ?? 0)
                : leadDistributions.filter(d => d.status === "accepted").length;

              return (
              <div className="space-y-6">
                {/* Status & Service */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-sm">
                      {getServiceLabel(selectedLead.service_type)}
                    </Badge>
                    {getStatusBadge(selectedLead.status)}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-amber-500">🪙</span>
                    <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {selectedLead.token_cost || 10} Token
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Kundendaten
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {selectedLead.customer_first_name} {selectedLead.customer_last_name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      {selectedLead.customer_email}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {selectedLead.customer_phone}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max. Firmen:</span> {selectedLead.max_companies}
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      Von
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="font-medium">{formatAddress(selectedLead.from_plz, selectedLead.from_city)}</div>
                      {selectedLead.from_street && (
                        <div>{[selectedLead.from_street, selectedLead.from_house_number].filter(Boolean).join(' ')}</div>
                      )}
                      {selectedLead.from_floor !== null && (
                        <div className="text-muted-foreground">
                          {formatFloor(selectedLead.from_floor)}
                          {selectedLead.from_has_lift && " (mit Lift)"}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedLead.to_city && (
                    <div className="p-4 border rounded-lg space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-500" />
                        Nach
                      </h4>
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{formatAddress(selectedLead.to_plz, selectedLead.to_city)}</div>
                        {selectedLead.to_street && (
                          <div>{[selectedLead.to_street, selectedLead.to_house_number].filter(Boolean).join(' ')}</div>
                        )}
                        {selectedLead.to_floor !== null && (
                          <div className="text-muted-foreground">
                            {formatFloor(selectedLead.to_floor)}
                            {selectedLead.to_has_lift && " (mit Lift)"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timing */}
                <div className="p-4 border rounded-lg space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Termin
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {selectedLead.preferred_date && (
                      <div>
                        <span className="text-muted-foreground">Wunschdatum:</span>{" "}
                        {formatDateOnly(selectedLead.preferred_date)}
                      </div>
                    )}
                    {selectedLead.preferred_time_slot && (
                      <div>
                        <span className="text-muted-foreground">Zeitfenster:</span> {selectedLead.preferred_time_slot}
                      </div>
                    )}
                    {selectedLead.is_flexible_date && (
                      <div className="text-green-600">✓ Flexibles Datum</div>
                    )}
                  </div>
                </div>

                {/* Category-specific details — only render wrapper if there is content */}
                {renderCategoryDetails(selectedLead) && (
                  <div className="p-4 border rounded-lg">
                    {renderCategoryDetails(selectedLead)}
                  </div>
                )}

                {/* Special Items */}
                {selectedLead.special_items && selectedLead.special_items.length > 0 && (
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Spezielle Gegenstände</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.special_items.map((item, idx) => (
                        <Badge key={`special-${item}-${idx}`} variant="outline">{item}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedLead.description && (
                  <div className="p-4 border rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Zusätzliche Bemerkungen</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedLead.description}
                    </p>
                  </div>
                )}

                  {/* Distribution Info */}
                <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Firmenverteilung
                    </h4>
                    <div className="flex items-center gap-3">
                      <LeadDistributionDebug
                        leadId={selectedLead.id}
                        serviceType={selectedLead.service_type}
                        fromPlz={selectedLead.from_plz}
                        fromCity={selectedLead.from_city}
                      />
                      <div className="text-sm">
                        <span className="font-medium text-green-600">{liveAcceptedCount}</span>
                        <span className="text-muted-foreground"> / {selectedLead.max_companies || 1} angenommen</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress 
                      value={calculateProgress(liveAcceptedCount, selectedLead.max_companies)} 
                      className="h-2"
                    />
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
                      <span>Gesendet: {leadDistributions.length}</span>
                      <span>
                        {liveAcceptedCount >= (selectedLead.max_companies || 1)
                          ? "✓ Kontingent voll" 
                          : `${Math.max(0, (selectedLead.max_companies || 1) - liveAcceptedCount)} Plätze frei`}
                      </span>
                    </div>
                  </div>

                  {/* Company List */}
                  {isLoadingDistributions ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : leadDistributions.length > 0 ? (
                    <div className="space-y-2">
                      {leadDistributions.map((dist) => (
                        <div 
                          key={dist.id} 
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                            dist.status === "accepted" 
                              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                              : "bg-background"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              dist.status === "accepted" 
                                ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {dist.status === "accepted" ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : dist.status === "rejected" || dist.status === "quota_full" ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                <Building2 className="w-3 h-3" />
                                {dist.company?.company_name || "Unbekannt"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {dist.company?.email}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {getDistributionStatusBadge(dist.status)}
                                {dist.responded_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDate(dist.responded_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Noch keine Firmen kontaktiert
                    </div>
                  )}
                </div>

                {/* Meta info */}
                <div className="text-xs text-muted-foreground border-t pt-4">
                  Erstellt am {formatDate(selectedLead.created_at)} • Lead-ID: {selectedLead.id}
                </div>
              </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </>
  );
};

export default AdminLeads;
