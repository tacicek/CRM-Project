// =============================================================================
// FIRMA DATENARCHIV PAGE
// Company-specific data archive and data management (GDPR compliant)
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import {
  Archive,
  Download,
  Trash2,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
  FileText,
  Users,
  Mail,
} from "lucide-react";

interface DataStats {
  leads_total: number;
  leads_old: number;
  offers_total: number;
  offers_old: number;
  appointments_total: number;
  appointments_old: number;
  team_members: number;
}

interface ExportableData {
  leads: Record<string, unknown>[];
  offers: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
}

export default function FirmaDatenarchiv() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [stats, setStats] = useState<DataStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [exportTypes, setExportTypes] = useState({
    leads: true,
    offers: true,
    appointments: true,
  });
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);

  // Load company data
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const company = await fetchSingleCompanyForUser<{ id: string; company_name: string }>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name",
        });

        if (company) {
          setCompanyId(company.id);
          setCompanyName(company.company_name);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching company:", error);
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Fetch leads statistics
      const { count: leadsTotal } = await supabase
        .from("lead_distributions")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { count: leadsOld } = await supabase
        .from("lead_distributions")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["accepted", "rejected", "expired"]);

      // Fetch offers statistics
      const { count: offersTotal } = await supabase
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { count: offersOld } = await supabase
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["sent", "accepted", "rejected", "expired"]);

      // Fetch appointments statistics
      const { count: appointmentsTotal } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { count: appointmentsOld } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["completed", "cancelled"]);

      // Fetch team members count
      const { count: teamMembers } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      setStats({
        leads_total: leadsTotal || 0,
        leads_old: leadsOld || 0,
        offers_total: offersTotal || 0,
        offers_old: offersOld || 0,
        appointments_total: appointmentsTotal || 0,
        appointments_old: appointmentsOld || 0,
        team_members: teamMembers || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Fehler beim Laden der Statistiken");
    } finally {
      setIsLoading(false);
    }
  }, [companyId, retentionDays]);

  // Load company data statistics
  useEffect(() => {
    if (companyId) {
      loadStats();
    }
  }, [companyId, loadStats]);

  const handleExport = async () => {
    if (!companyId) return;

    setIsExporting(true);
    try {
      const exportData: ExportableData = {
        leads: [],
        offers: [],
        appointments: [],
      };

      // Export leads
      if (exportTypes.leads) {
        const { data: leads } = await supabase
          .from("lead_distributions")
          .select(`
            *,
            lead:leads (*)
          `)
          .eq("company_id", companyId);
        
        exportData.leads = leads || [];
      }

      // Export offers
      if (exportTypes.offers) {
        const { data: offers } = await supabase
          .from("offers")
          .select(`
            *,
            offer_items (*)
          `)
          .eq("company_id", companyId);
        
        exportData.offers = offers || [];
      }

      // Export appointments
      if (exportTypes.appointments) {
        const { data: appointments } = await supabase
          .from("appointments")
          .select("*")
          .eq("company_id", companyId);
        
        exportData.appointments = appointments || [];
      }

      // Convert to selected format
      let fileContent: string;
      let mimeType: string;
      let fileExtension: string;

      if (exportFormat === "csv") {
        // Combine all data for CSV
        const allData = [
          ...exportData.leads.map(d => ({ type: "lead", ...d })),
          ...exportData.offers.map(d => ({ type: "offer", ...d })),
          ...exportData.appointments.map(d => ({ type: "appointment", ...d })),
        ];
        fileContent = convertToCSV(allData);
        mimeType = "text/csv";
        fileExtension = "csv";
      } else {
        fileContent = JSON.stringify({
          export_date: new Date().toISOString(),
          company_id: companyId,
          company_name: companyName,
          data: exportData,
        }, null, 2);
        mimeType = "application/json";
        fileExtension = "json";
      }

      // Download file
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${companyName.replace(/\s+/g, "_")}_daten_${new Date().toISOString().split("T")[0]}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Daten erfolgreich exportiert");
      setShowExportDialog(false);
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Fehler beim Exportieren");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteOldData = async () => {
    if (!companyId || !deleteConfirmed) return;

    setIsDeleting(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old lead distributions
      const { error: leadsError } = await supabase
        .from("lead_distributions")
        .delete()
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["accepted", "rejected", "expired"]);

      if (leadsError) throw leadsError;

      // Delete old offers (first delete offer_items)
      const { data: oldOffers } = await supabase
        .from("offers")
        .select("id")
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["sent", "accepted", "rejected", "expired"]);

      if (oldOffers && oldOffers.length > 0) {
        const offerIds = oldOffers.map(o => o.id);
        
        await supabase
          .from("offer_items")
          .delete()
          .in("offer_id", offerIds);

        await supabase
          .from("offers")
          .delete()
          .in("id", offerIds);
      }

      // Delete old appointments
      const { data: oldAppointments } = await supabase
        .from("appointments")
        .select("id")
        .eq("company_id", companyId)
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["completed", "cancelled"]);

      if (oldAppointments && oldAppointments.length > 0) {
        const appointmentIds = oldAppointments.map(a => a.id);
        
        // Delete appointment history first
        await supabase
          .from("appointment_history")
          .delete()
          .in("appointment_id", appointmentIds);

        await supabase
          .from("appointments")
          .delete()
          .in("id", appointmentIds);
      }

      toast.success("Alte Daten wurden erfolgreich gelöscht");
      setShowDeleteDialog(false);
      setDeleteConfirmed(false);
      
      // Reload stats
      await loadStats();
    } catch (error) {
      console.error("Error deleting data:", error);
      toast.error("Fehler beim Löschen der Daten");
    } finally {
      setIsDeleting(false);
    }
  };

  const convertToCSV = (data: Record<string, unknown>[]): string => {
    if (data.length === 0) return "";

    const allKeys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (typeof item[key] !== "object" || item[key] === null) {
          allKeys.add(key);
        }
      });
    });

    const headers = Array.from(allKeys);
    const csvRows = [headers.join(",")];

    data.forEach(item => {
      const values = headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(","));
    });

    return csvRows.join("\n");
  };

  if (isLoading) {
    return (
      <FirmaLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </FirmaLayout>
    );
  }

  if (!companyId && !isLoading) {
    return (
      <FirmaLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Archive className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Keine Firma verknüpft</h2>
          <p className="text-muted-foreground">
            Um das Datenarchiv zu nutzen, muss Ihr Konto mit einer Firma verknüpft sein.
          </p>
        </div>
      </FirmaLayout>
    );
  }

  return (
    <FirmaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="w-7 h-7" />
              Datenarchiv & Datenschutz
            </h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Ihre Firmendaten gemäss DSGVO/DSG
            </p>
          </div>
          <Button variant="outline" onClick={loadStats}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
        </div>

        {/* GDPR Info Alert */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Datenschutz-Grundverordnung (DSGVO/DSG)</AlertTitle>
          <AlertDescription>
            Sie haben das Recht, Ihre Daten zu exportieren (Datenportabilität) und zu löschen 
            (Recht auf Vergessenwerden). Alle Aktionen werden protokolliert.
          </AlertDescription>
        </Alert>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.leads_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {stats?.leads_old || 0} älter als {retentionDays} Tage
              </p>
              {stats && stats.leads_old > 0 && (
                <Progress 
                  value={(stats.leads_old / stats.leads_total) * 100} 
                  className="h-1 mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Offerten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.offers_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {stats?.offers_old || 0} älter als {retentionDays} Tage
              </p>
              {stats && stats.offers_old > 0 && (
                <Progress 
                  value={(stats.offers_old / stats.offers_total) * 100} 
                  className="h-1 mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Termine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.appointments_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {stats?.appointments_old || 0} älter als {retentionDays} Tage
              </p>
              {stats && stats.appointments_old > 0 && (
                <Progress 
                  value={(stats.appointments_old / stats.appointments_total) * 100} 
                  className="h-1 mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.team_members || 0}</div>
              <p className="text-sm text-muted-foreground">
                Aktive Teammitglieder
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Daten exportieren
              </CardTitle>
              <CardDescription>
                Exportieren Sie alle Ihre Firmendaten als JSON oder CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 p-4 border rounded-lg text-center">
                  <FileJson className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="font-medium">JSON</p>
                  <p className="text-xs text-muted-foreground">Vollständig, strukturiert</p>
                </div>
                <div className="flex-1 p-4 border rounded-lg text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">CSV</p>
                  <p className="text-xs text-muted-foreground">Excel-kompatibel</p>
                </div>
              </div>

              <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Daten exportieren
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Daten exportieren</DialogTitle>
                    <DialogDescription>
                      Wählen Sie die zu exportierenden Daten und das Format
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Export-Format</Label>
                      <Select
                        value={exportFormat}
                        onValueChange={(v) => setExportFormat(v as "json" | "csv")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">JSON (Vollständig)</SelectItem>
                          <SelectItem value="csv">CSV (Excel)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Daten auswählen</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-leads"
                            checked={exportTypes.leads}
                            onCheckedChange={(c) => setExportTypes(t => ({ ...t, leads: !!c }))}
                          />
                          <Label htmlFor="export-leads" className="cursor-pointer">
                            Leads ({stats?.leads_total || 0})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-offers"
                            checked={exportTypes.offers}
                            onCheckedChange={(c) => setExportTypes(t => ({ ...t, offers: !!c }))}
                          />
                          <Label htmlFor="export-offers" className="cursor-pointer">
                            Offerten ({stats?.offers_total || 0})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-appointments"
                            checked={exportTypes.appointments}
                            onCheckedChange={(c) => setExportTypes(t => ({ ...t, appointments: !!c }))}
                          />
                          <Label htmlFor="export-appointments" className="cursor-pointer">
                            Termine ({stats?.appointments_total || 0})
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                      {isExporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Exportiert...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Exportieren
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Delete Card */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Alte Daten löschen
              </CardTitle>
              <CardDescription>
                Löschen Sie abgeschlossene Daten älter als {retentionDays} Tage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Aufbewahrungsfrist</Label>
                <Select
                  value={String(retentionDays)}
                  onValueChange={(v) => {
                    setRetentionDays(parseInt(v));
                    // Reload stats with new retention days
                    setTimeout(loadStats, 100);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Tage</SelectItem>
                    <SelectItem value="60">60 Tage</SelectItem>
                    <SelectItem value="90">90 Tage</SelectItem>
                    <SelectItem value="180">180 Tage</SelectItem>
                    <SelectItem value="365">1 Jahr</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Löschbare Datensätze:</strong>
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-1 space-y-1">
                  <li>• {stats?.leads_old || 0} Leads</li>
                  <li>• {stats?.offers_old || 0} Offerten</li>
                  <li>• {stats?.appointments_old || 0} Termine</li>
                </ul>
              </div>

              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    disabled={(stats?.leads_old || 0) + (stats?.offers_old || 0) + (stats?.appointments_old || 0) === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Alte Daten löschen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      Daten unwiderruflich löschen?
                    </DialogTitle>
                    <DialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden!
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warnung</AlertTitle>
                      <AlertDescription>
                        Folgende Daten werden permanent gelöscht:
                        <ul className="mt-2 space-y-1">
                          <li>• {stats?.leads_old || 0} Leads (abgeschlossen/abgelehnt)</li>
                          <li>• {stats?.offers_old || 0} Offerten (gesendet/akzeptiert/abgelehnt)</li>
                          <li>• {stats?.appointments_old || 0} Termine (abgeschlossen/abgesagt)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center space-x-2 mt-4">
                      <Checkbox
                        id="delete-confirm"
                        checked={deleteConfirmed}
                        onCheckedChange={(c) => setDeleteConfirmed(!!c)}
                      />
                      <Label htmlFor="delete-confirm" className="cursor-pointer text-sm">
                        Ich verstehe, dass diese Daten unwiderruflich gelöscht werden und habe 
                        bei Bedarf einen Export erstellt.
                      </Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setShowDeleteDialog(false);
                      setDeleteConfirmed(false);
                    }}>
                      Abbrechen
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteOldData}
                      disabled={!deleteConfirmed || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Löscht...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Endgültig löschen
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Datenschutz-Hinweise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">📤 Datenexport (Art. 20 DSGVO)</h4>
                <p className="text-sm text-muted-foreground">
                  Sie können jederzeit alle Ihre Daten in einem maschinenlesbaren Format 
                  (JSON/CSV) exportieren. Dies ermöglicht die Übertragung zu anderen Diensten.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🗑️ Recht auf Löschung (Art. 17 DSGVO)</h4>
                <p className="text-sm text-muted-foreground">
                  Sie können abgeschlossene und nicht mehr benötigte Daten löschen. 
                  Aktive Geschäftsdaten unterliegen gesetzlichen Aufbewahrungsfristen.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📋 Aufbewahrungsfristen</h4>
                <p className="text-sm text-muted-foreground">
                  Geschäftsdokumente müssen gemäss OR 10 Jahre aufbewahrt werden. 
                  Wir empfehlen, Daten vor der Löschung zu exportieren.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🔒 Datensicherheit</h4>
                <p className="text-sm text-muted-foreground">
                  Alle Daten werden in der Schweiz/EU gespeichert und verschlüsselt. 
                  Löschungen sind unwiderruflich und werden protokolliert.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FirmaLayout>
  );
}

