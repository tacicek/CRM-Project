import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  MoreVertical,
  Upload,
  Coins,
  Building2,
  BarChart3,
  AlertCircle,
  Pencil
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CompanyWithSubscription {
  id: string;
  company_name: string;
  email: string;
  token_balance: number;
  manual_import_enabled: boolean;
  manual_import_activated_at: string | null;
  manual_import_monthly_fee: number;
  manual_import_next_billing_at: string | null;
  total_imports?: number;
}

interface SubscriptionStats {
  active_subscriptions: number;
  total_imports: number;
  monthly_revenue: number;
}

const AdminManualImportSubscriptions = () => {
  const [companies, setCompanies] = useState<CompanyWithSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SubscriptionStats>({
    active_subscriptions: 0,
    total_imports: 0,
    monthly_revenue: 0
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [editFeeDialogOpen, setEditFeeDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithSubscription | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [newMonthlyFee, setNewMonthlyFee] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setCurrentUserId(data.user?.id || null);
    }).catch(() => { /* silent – auth state handled by router guard */ });
    return () => { isMounted = false; };
  }, []);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch companies with subscription data
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select(`
          id,
          company_name,
          email,
          token_balance,
          manual_import_enabled,
          manual_import_activated_at,
          manual_import_monthly_fee,
          manual_import_next_billing_at
        `)
        .order("company_name", { ascending: true });

      if (companiesError) throw companiesError;

      // Fetch import counts per company
      const { data: importsData } = await supabase
        .from("manual_imported_leads")
        .select("company_id");

      // Count imports per company
      const importCounts: Record<string, number> = {};
      importsData?.forEach(item => {
        importCounts[item.company_id] = (importCounts[item.company_id] || 0) + 1;
      });

      // Merge data
      const merged = companiesData?.map(company => ({
        ...company,
        total_imports: importCounts[company.id] || 0
      })) || [];

      setCompanies(merged);

      // Calculate stats
      const activeCompanies = merged.filter(c => c.manual_import_enabled);
      const activeCount = activeCompanies.length;
      const totalImports = Object.values(importCounts).reduce((a, b) => a + b, 0);
      const monthlyRevenue = activeCompanies.reduce((sum, c) => sum + (c.manual_import_monthly_fee || 20), 0);
      
      setStats({
        active_subscriptions: activeCount,
        total_imports: totalImports,
        monthly_revenue: monthlyRevenue
      });
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleActivate = async () => {
    if (!selectedCompany || !currentUserId) return;
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('activate_manual_import', {
        p_company_id: selectedCompany.id,
        p_admin_id: currentUserId
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        toast({
          title: "Aktivierung fehlgeschlagen",
          description: result.error || "Unbekannter Fehler",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Erfolgreich aktiviert",
        description: `Manuelle Import-Funktion für ${selectedCompany.company_name} wurde aktiviert. ${selectedCompany.manual_import_monthly_fee || 20} Tokens wurden abgezogen.`,
      });

      setActivateDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error: unknown) {
      console.error("Error activating:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Aktivierung fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditFee = async () => {
    if (!selectedCompany) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ manual_import_monthly_fee: newMonthlyFee })
        .eq("id", selectedCompany.id);

      if (error) throw error;

      toast({
        title: "Gebühr aktualisiert",
        description: `Monatliche Gebühr für ${selectedCompany.company_name} wurde auf ${newMonthlyFee} Tokens gesetzt.`,
      });

      setEditFeeDialogOpen(false);
      setSelectedCompany(null);
      setNewMonthlyFee(20);
      fetchCompanies();
    } catch (error: unknown) {
      console.error("Error updating fee:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedCompany) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('deactivate_manual_import', {
        p_company_id: selectedCompany.id,
        p_reason: deactivateReason || 'Admin deaktiviert'
      });

      if (error) throw error;

      toast({
        title: "Erfolgreich deaktiviert",
        description: `Manuelle Import-Funktion für ${selectedCompany.company_name} wurde deaktiviert.`,
      });

      setDeactivateDialogOpen(false);
      setSelectedCompany(null);
      setDeactivateReason("");
      fetchCompanies();
    } catch (error: unknown) {
      console.error("Error deactivating:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Deaktivierung fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Manuelle Import Abonnements | Admin</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Manuelle Anfrage Import
            </h1>
            <p className="text-muted-foreground">
              Premium-Funktion für Firmen (20 Tokens/Monat)
            </p>
          </div>
          <Button onClick={fetchCompanies} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktive Abonnements</p>
                  <p className="text-2xl font-bold">{stats.active_subscriptions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gesamte Imports</p>
                  <p className="text-2xl font-bold">{stats.total_imports}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Coins className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monatliche Einnahmen</p>
                  <p className="text-2xl font-bold">{stats.monthly_revenue} Tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Firmen Übersicht</CardTitle>
            <CardDescription>
              Verwalten Sie die manuelle Import-Funktion für alle Firmen
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Token-Guthaben</TableHead>
                    <TableHead>Imports</TableHead>
                    <TableHead>Aktiviert seit</TableHead>
                    <TableHead>Nächste Abrechnung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{company.company_name}</p>
                            <p className="text-xs text-muted-foreground">{company.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.manual_import_enabled ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inaktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-amber-500" />
                          <span className={company.token_balance < (company.manual_import_monthly_fee || 20) ? "text-red-500 font-medium" : ""}>
                            {Number(company.token_balance).toLocaleString("de-CH")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.total_imports || 0}
                      </TableCell>
                      <TableCell>
                        {company.manual_import_activated_at 
                          ? format(new Date(company.manual_import_activated_at), "dd.MM.yyyy", { locale: de })
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {company.manual_import_next_billing_at 
                          ? format(new Date(company.manual_import_next_billing_at), "dd.MM.yyyy", { locale: de })
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedCompany(company);
                                setNewMonthlyFee(company.manual_import_monthly_fee || 20);
                                setEditFeeDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Gebühr anpassen
                            </DropdownMenuItem>
                            {!company.manual_import_enabled ? (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedCompany(company);
                                  setActivateDialogOpen(true);
                                }}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Aktivieren
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedCompany(company);
                                  setDeactivateDialogOpen(true);
                                }}
                                className="text-red-600"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Deaktivieren
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activate Dialog */}
      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manuelle Import-Funktion aktivieren</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die manuelle Import-Funktion für <strong>{selectedCompany?.company_name}</strong> aktivieren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <Coins className="w-5 h-5" />
                <span className="font-medium">Kosten: {selectedCompany?.manual_import_monthly_fee || 20} Tokens/Monat</span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                Die Tokens werden sofort vom Firmenkonto abgezogen.
              </p>
            </div>

            {selectedCompany && selectedCompany.token_balance < (selectedCompany.manual_import_monthly_fee || 20) && (
              <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Unzureichendes Guthaben!</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-500 mt-1">
                  Die Firma hat nur {selectedCompany.token_balance} Tokens. Mindestens {selectedCompany.manual_import_monthly_fee || 20} Tokens erforderlich.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm text-muted-foreground">Aktuelles Guthaben:</span>
              <span className="font-medium">{selectedCompany?.token_balance} Tokens</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              disabled={isProcessing || (selectedCompany?.token_balance || 0) < (selectedCompany?.manual_import_monthly_fee || 20)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aktiviere...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aktivieren ({selectedCompany?.manual_import_monthly_fee || 20} Tokens)
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manuelle Import-Funktion deaktivieren</DialogTitle>
            <DialogDescription>
              Möchten Sie die manuelle Import-Funktion für <strong>{selectedCompany?.company_name}</strong> deaktivieren?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Grund für Deaktivierung (optional)</Label>
              <Textarea
                id="reason"
                placeholder="z.B. Auf Kundenwunsch, Zahlungsrückstand, etc."
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deaktiviere...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Deaktivieren
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fee Dialog */}
      <Dialog open={editFeeDialogOpen} onOpenChange={setEditFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monatliche Gebühr anpassen</DialogTitle>
            <DialogDescription>
              Ändern Sie die monatliche Token-Gebühr für <strong>{selectedCompany?.company_name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="monthlyFee">Monatliche Gebühr (Tokens)</Label>
              <Input
                id="monthlyFee"
                type="number"
                min="1"
                max="1000"
                value={newMonthlyFee}
                onChange={(e) => setNewMonthlyFee(parseInt(e.target.value) || 20)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Diese Gebühr wird bei der nächsten Aktivierung oder Verlängerung angewendet.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
              <span className="text-sm">Aktuelle Gebühr:</span>
              <span className="font-medium">{selectedCompany?.manual_import_monthly_fee || 20} Tokens</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeeDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleEditFee}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichere...
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminManualImportSubscriptions;

