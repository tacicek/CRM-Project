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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle, XCircle, ExternalLink, Crown, Lock, Search, ChevronLeft, ChevronRight, AlertTriangle, Mail, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import AddCompanyDialog from "@/components/admin/AddCompanyDialog";
import CompanySettingsDialog from "@/components/admin/CompanySettingsDialog";
import TokenManagementDialog from "@/components/admin/TokenManagementDialog";
import ResetPasswordDialog from "@/components/admin/ResetPasswordDialog";
import DeleteCompanyDialog from "@/components/admin/DeleteCompanyDialog";

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safe date formatting with error handling
 */
const formatDateSafe = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

/**
 * Safe address formatting
 */
const formatAddress = (plz: string | null | undefined, city: string | null | undefined): string => {
  const parts = [plz, city].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
};

/**
 * Validate company data from realtime payload
 */
const isValidCompanyPayload = (payload: unknown): payload is Company => {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.company_name === 'string';
};

interface Company {
  id: string;
  company_name: string;
  email: string;
  city: string;
  plz: string;
  phone: string | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  token_balance: number | null;
  created_at: string | null;
  user_id: string;
  crm_enabled: boolean | null;
  subscription_type: string | null;
  subscription_expires_at: string | null;
}

const AdminCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const { toast } = useToast();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [crmFilter, setCrmFilter] = useState<string>("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // Toggle loading states
  const [togglingVerification, setTogglingVerification] = useState<string | null>(null);
  const [togglingCrm, setTogglingCrm] = useState<string | null>(null);
  
  // CRM confirmation dialog
  const [crmConfirmDialog, setCrmConfirmDialog] = useState<{
    open: boolean;
    companyId: string;
    companyName: string;
    currentValue: boolean;
  } | null>(null);
  
  // Realtime connection status
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  
  // AbortController ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch current user first
  useEffect(() => {
    let mounted = true;
    
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) {
          setCurrentUserId(data.user?.id || null);
          setIsAuthLoaded(true);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        if (mounted) {
          setIsAuthLoaded(true);
        }
      }
    };
    
    loadUser();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch companies with cleanup
  const fetchCompanies = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (signal?.aborted) return;
      if (error) throw error;
      
      // Type-safe data handling
      if (Array.isArray(data)) {
        setCompanies(data as Company[]);
      } else {
        setCompanies([]);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error fetching companies:", error);
      toast({
        title: "Fehler",
        description: "Firmen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [toast]);

  // Initial fetch after auth is loaded
  useEffect(() => {
    if (!isAuthLoaded) return;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    fetchCompanies(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [isAuthLoaded, fetchCompanies]);

  // Handle refresh button
  const handleRefresh = useCallback(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchCompanies(controller.signal, true);
  }, [fetchCompanies]);

  // Real-time subscription for company updates (token balance, status changes)
  useEffect(() => {
    let isComponentActive = true;

    const channel = supabase
      .channel("admin-companies-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            // Type-safe update handling
            if (isValidCompanyPayload(payload.new)) {
              const updatedCompany = payload.new;
              setCompanies(prev => 
                prev.map(c => c.id === updatedCompany.id ? { ...c, ...updatedCompany } : c)
              );
            }
          } else if (payload.eventType === "INSERT") {
            // Type-safe insert handling
            if (isValidCompanyPayload(payload.new)) {
              setCompanies(prev => [payload.new as Company, ...prev]);
            }
          } else if (payload.eventType === "DELETE") {
            // Type-safe delete handling
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setCompanies(prev => prev.filter(c => c.id !== deletedId));
            }
          }
        }
      )
      .subscribe((status) => {
        // Ignore status updates during page unmount/navigation
        if (!isComponentActive) return;

        // Track realtime connection status
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsRealtimeConnected(false);
          toast({
            title: "Verbindung unterbrochen",
            description: "Echtzeit-Updates sind momentan nicht verfügbar.",
            variant: "destructive",
          });
        } else if (status === 'CLOSED') {
          // CLOSED is expected during normal navigation/unsubscribe
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      isComponentActive = false;
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const toggleVerification = useCallback(async (companyId: string, currentStatus: boolean | null) => {
    setTogglingVerification(companyId);
    
    // Optimistic update
    const newStatus = !currentStatus;
    setCompanies(prev =>
      prev.map(c => c.id === companyId ? { ...c, is_verified: newStatus } : c)
    );
    
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_verified: newStatus })
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Verifizierung aufgehoben" : "Firma verifiziert",
        description: "Status wurde erfolgreich aktualisiert.",
      });
      // No need to refetch - realtime will handle it or optimistic update is enough
    } catch (error) {
      console.error("Error updating verification:", error);
      // Rollback optimistic update
      setCompanies(prev =>
        prev.map(c => c.id === companyId ? { ...c, is_verified: currentStatus } : c)
      );
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setTogglingVerification(null);
    }
  }, [toast]);


  // Open CRM confirmation dialog
  const openCrmConfirmDialog = useCallback((companyId: string, companyName: string, currentValue: boolean) => {
    setCrmConfirmDialog({
      open: true,
      companyId,
      companyName,
      currentValue,
    });
  }, []);

  // Handle CRM toggle confirmation
  const handleCrmToggleConfirm = useCallback(async () => {
    if (!crmConfirmDialog) return;
    
    const { companyId, currentValue } = crmConfirmDialog;
    setCrmConfirmDialog(null);
    setTogglingCrm(companyId);

    // Snapshot current subscription_type before optimistic update for correct rollback
    const currentCompanySnapshot = companies.find(c => c.id === companyId);
    const previousSubscriptionType = currentCompanySnapshot?.subscription_type ?? null;
    
    // Optimistic update
    const newValue = !currentValue;
    const newSubscriptionType = newValue ? "crm" : "basic";
    setCompanies(prev =>
      prev.map(c =>
        c.id === companyId
          ? { ...c, crm_enabled: newValue, subscription_type: newSubscriptionType }
          : c
      )
    );
    
    try {
      // When enabling CRM, set expiry to 1 year from now if not already set or expired
      const now = new Date();
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
      const currentCompany = companies.find(c => c.id === companyId);
      const currentExpiry = currentCompany?.subscription_expires_at;
      const isExpired = !currentExpiry || new Date(currentExpiry) < now;

      const updateData: Record<string, unknown> = {
        crm_enabled: newValue,
        crm_enabled_at: newValue ? now.toISOString() : null,
        crm_enabled_by: newValue ? currentUserId : null,
        subscription_type: newSubscriptionType,
      };

      // Auto-set expiry when enabling CRM and subscription is missing/expired
      if (newValue && isExpired) {
        updateData.subscription_expires_at = oneYearFromNow;
      }

      const { error } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", companyId);

      if (error) throw error;

      // Update local state with new expiry if set
      if (newValue && isExpired) {
        setCompanies(prev =>
          prev.map(c =>
            c.id === companyId
              ? { ...c, subscription_expires_at: oneYearFromNow }
              : c
          )
        );
      }

      toast({
        title: newValue ? "CRM aktiviert" : "CRM deaktiviert",
        description: newValue
          ? `Die Firma hat jetzt Zugriff auf alle CRM-Funktionen.${isExpired ? " Abo-Laufzeit: 1 Jahr." : ""}`
          : "Die Firma hat nur noch Zugriff auf Basis-Funktionen.",
      });
    } catch (error) {
      console.error("Error toggling CRM access:", error);
      // Rollback optimistic update using the actual previous values
      setCompanies(prev =>
        prev.map(c =>
          c.id === companyId
            ? { ...c, crm_enabled: currentValue, subscription_type: previousSubscriptionType }
            : c
        )
      );
      toast({
        title: "Fehler",
        description: "CRM-Status konnte nicht geändert werden.",
        variant: "destructive",
      });
    } finally {
      setTogglingCrm(null);
    }
  }, [crmConfirmDialog, currentUserId, companies, toast]);

  // Filter and search companies
  const filteredCompanies = useMemo(() => {
    let filtered = companies;
    
    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "verified") {
        filtered = filtered.filter(c => c.is_verified === true);
      } else if (statusFilter === "unverified") {
        filtered = filtered.filter(c => !c.is_verified);
      } else if (statusFilter === "active") {
        filtered = filtered.filter(c => c.is_active === true);
      } else if (statusFilter === "inactive") {
        filtered = filtered.filter(c => !c.is_active);
      }
    }
    
    // Filter by CRM
    if (crmFilter !== "all") {
      if (crmFilter === "crm") {
        filtered = filtered.filter(c => c.crm_enabled === true);
      } else if (crmFilter === "basic") {
        filtered = filtered.filter(c => !c.crm_enabled);
      }
    }
    
    // Search filter (null-safe)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const companyName = c.company_name?.toLowerCase() || '';
        const email = c.email?.toLowerCase() || '';
        const phone = c.phone?.toLowerCase() || '';
        const city = c.city?.toLowerCase() || '';
        const plz = c.plz?.toLowerCase() || '';
        
        return companyName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          city.includes(query) ||
          plz.includes(query);
      });
    }
    
    return filtered;
  }, [companies, statusFilter, crmFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCompanies.length / pageSize);
  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCompanies.slice(startIndex, startIndex + pageSize);
  }, [filteredCompanies, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, crmFilter, searchQuery, pageSize]);

  return (
    <>
      <Helmet>
        <title>Firmen | LeadFlow Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Firmen</h2>
              <p className="text-muted-foreground">Registrierte Unternehmen verwalten</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isRealtimeConnected && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                disabled={isLoading || isRefreshing}
                aria-label="Firmen aktualisieren"
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Aktualisieren
              </Button>
              <AddCompanyDialog onSuccess={handleRefresh} />
            </div>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),180px,160px] gap-3 md:gap-4">
                {/* Search */}
                <div className="relative md:col-span-2 xl:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen (Firma, E-Mail, Telefon, Stadt...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Firmen durchsuchen"
                  />
                </div>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[160px]" aria-label="Status filtern">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="verified">Verifiziert</SelectItem>
                    <SelectItem value="unverified">Nicht verifiziert</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* CRM Filter */}
                <Select value={crmFilter} onValueChange={setCrmFilter}>
                  <SelectTrigger className="w-full md:w-[140px]" aria-label="CRM filtern">
                    <SelectValue placeholder="CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="crm">CRM aktiv</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Results info */}
              <div className="mt-4 text-sm text-muted-foreground">
                {filteredCompanies.length === companies.length 
                  ? `${companies.length} Firmen insgesamt`
                  : `${filteredCompanies.length} von ${companies.length} Firmen`
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Firmen</span>
                {filteredCompanies.length > 0 && (
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
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {companies.length === 0 
                    ? "Noch keine Firmen registriert"
                    : "Keine Firmen gefunden für die aktuellen Filter"
                  }
                </div>
              ) : (
                <>
                {/* Mobile Card View */}
                <div className="xl:hidden space-y-3">
                  {paginatedCompanies.map((company) => (
                    <div 
                      key={`mobile-${company.id}`}
                      className="border rounded-xl p-4 space-y-3 bg-card shadow-sm"
                    >
                      {/* Header: Name + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium break-words [overflow-wrap:anywhere]">{company.company_name || '-'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatAddress(company.plz, company.city)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {company.is_verified ? (
                            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
                              Verifiziert
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                              Nicht verifiziert
                            </Badge>
                          )}
                          {company.crm_enabled ? (
                            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700 text-xs gap-1">
                              <Crown className="w-3 h-3" />
                              CRM
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-xs gap-1">
                              <Lock className="w-3 h-3" />
                              Basic
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="text-sm space-y-1">
                        {company.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4 shrink-0" />
                            <span className="break-all">{company.email}</span>
                          </div>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4 shrink-0" />
                            <span>{company.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Token + CRM Toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-accent/10 text-accent text-xs">
                            {company.token_balance || 0} Token
                          </Badge>
                          <TokenManagementDialog
                            companyId={company.id}
                            companyName={company.company_name}
                            currentBalance={company.token_balance || 0}
                            onSuccess={handleRefresh}
                          />
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span className="text-xs text-muted-foreground">CRM</span>
                          <Switch
                            checked={company.crm_enabled === true}
                            onCheckedChange={() => openCrmConfirmDialog(company.id, company.company_name, company.crm_enabled === true)}
                            disabled={togglingCrm === company.id}
                            aria-label={`CRM für ${company.company_name} ${company.crm_enabled ? 'deaktivieren' : 'aktivieren'}`}
                          />
                          {togglingCrm === company.id && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                        <Button
                          variant={company.is_verified ? "ghost" : "outline"}
                          size="sm"
                          onClick={() => toggleVerification(company.id, company.is_verified)}
                          disabled={togglingVerification === company.id}
                          className={company.is_verified 
                            ? "text-destructive hover:text-destructive hover:bg-destructive/10" 
                            : "text-accent hover:text-accent hover:bg-accent/10 border-accent/30"
                          }
                        >
                          {togglingVerification === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : company.is_verified ? (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Sperren
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verifizieren
                            </>
                          )}
                        </Button>
                        {company.user_id && (
                          <ResetPasswordDialog
                            userId={company.user_id}
                            companyName={company.company_name}
                            userEmail={company.email}
                            currentUserId={currentUserId || undefined}
                          />
                        )}
                        <CompanySettingsDialog
                          companyId={company.id}
                          companyName={company.company_name}
                          companyEmail={company.email}
                          userId={company.user_id}
                          onEmailUpdated={handleRefresh}
                        />
                        <DeleteCompanyDialog
                          companyId={company.id}
                          companyName={company.company_name}
                          userId={company.user_id}
                          onSuccess={handleRefresh}
                        />
                      </div>

                      {/* Footer: Created date */}
                      <div className="text-xs text-muted-foreground">
                        Erstellt: {formatDateSafe(company.created_at)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden xl:block overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Firma</TableHead>
                        <TableHead>Standort</TableHead>
                        <TableHead>Kontakt</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>CRM</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erstellt</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCompanies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium max-w-[200px] truncate" title={company.company_name}>
                            {company.company_name || '-'}
                          </TableCell>
                          <TableCell>
                            {formatAddress(company.plz, company.city)}
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="text-sm">
                              <div className="truncate" title={company.email || "-"}>{company.email || '-'}</div>
                              {company.phone && (
                                <div className="text-muted-foreground">{company.phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-accent/10 text-accent">
                                {company.token_balance || 0} Token
                              </Badge>
                              <TokenManagementDialog
                                companyId={company.id}
                                companyName={company.company_name}
                                currentBalance={company.token_balance || 0}
                                onSuccess={handleRefresh}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={company.crm_enabled === true}
                                onCheckedChange={() => openCrmConfirmDialog(company.id, company.company_name, company.crm_enabled === true)}
                                disabled={togglingCrm === company.id}
                                aria-label={`CRM für ${company.company_name} ${company.crm_enabled ? 'deaktivieren' : 'aktivieren'}`}
                              />
                              {togglingCrm === company.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : company.crm_enabled ? (
                                <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700 text-xs gap-1">
                                  <Crown className="w-3 h-3" />
                                  CRM
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-xs gap-1">
                                  <Lock className="w-3 h-3" />
                                  Basic
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {company.is_verified ? (
                                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
                                  Verifiziert
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                                  Nicht verifiziert
                                </Badge>
                              )}
                              {company.is_active ? (
                                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
                                  Aktiv
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                                  Inaktiv
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateSafe(company.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant={company.is_verified ? "ghost" : "outline"}
                                size="sm"
                                onClick={() => toggleVerification(company.id, company.is_verified)}
                                disabled={togglingVerification === company.id}
                                className={company.is_verified 
                                  ? "text-destructive hover:text-destructive hover:bg-destructive/10" 
                                  : "text-accent hover:text-accent hover:bg-accent/10 border-accent/30"
                                }
                                aria-label={company.is_verified ? `${company.company_name} Verifizierung aufheben` : `${company.company_name} verifizieren`}
                              >
                                {togglingVerification === company.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : company.is_verified ? (
                                  <>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Sperren</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Verifizieren</span>
                                  </>
                                )}
                              </Button>
                              {company.user_id && (
                                <ResetPasswordDialog
                                  userId={company.user_id}
                                  companyName={company.company_name}
                                  userEmail={company.email}
                                  currentUserId={currentUserId || undefined}
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // TODO: Implement impersonation or company-specific link
                                  toast({
                                    title: "Hinweis",
                                    description: `Dashboard für "${company.company_name}" öffnen erfordert Impersonation-Funktion.`,
                                  });
                                }}
                                title={`Dashboard für ${company.company_name} öffnen`}
                                aria-label={`Dashboard für ${company.company_name} öffnen`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <CompanySettingsDialog
                                companyId={company.id}
                                companyName={company.company_name}
                                companyEmail={company.email}
                                userId={company.user_id}
                                onEmailUpdated={handleRefresh}
                              />
                              <DeleteCompanyDialog
                                companyId={company.id}
                                companyName={company.company_name}
                                userId={company.user_id}
                                onSuccess={handleRefresh}
                              />
                            </div>
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
                        {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredCompanies.length)} von {filteredCompanies.length}
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

        {/* CRM Toggle Confirmation Dialog */}
        <AlertDialog 
          open={crmConfirmDialog?.open ?? false} 
          onOpenChange={(open) => !open && setCrmConfirmDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                CRM-Zugang {crmConfirmDialog?.currentValue ? 'deaktivieren' : 'aktivieren'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {crmConfirmDialog?.currentValue ? (
                  <>
                    Möchten Sie den CRM-Zugang für <strong>"{crmConfirmDialog?.companyName}"</strong> wirklich deaktivieren?
                    <br /><br />
                    Die Firma verliert Zugriff auf alle CRM-Funktionen und wird auf den Basic-Plan zurückgestuft.
                  </>
                ) : (
                  <>
                    Möchten Sie den CRM-Zugang für <strong>"{crmConfirmDialog?.companyName}"</strong> aktivieren?
                    <br /><br />
                    Die Firma erhält Zugriff auf alle CRM-Funktionen (Offerten, Aufträge, Kalender, etc.).
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCrmToggleConfirm}
                className={crmConfirmDialog?.currentValue 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-violet-600 text-white hover:bg-violet-700"
                }
              >
                {crmConfirmDialog?.currentValue ? (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    CRM deaktivieren
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    CRM aktivieren
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </>
  );
};

export default AdminCompanies;
