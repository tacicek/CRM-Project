// =============================================================================
// FIRMA DATENARCHIV PAGE
// Company-specific data archive and data management (GDPR compliant)
// =============================================================================

import { useState, useEffect, useCallback } from "react";
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
import { useT } from "@/i18n/useI18n";
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
  const t = useT();
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
      toast.error(t("archive.stats.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, retentionDays, t]);

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

      toast.success(t("archive.export.success"));
      setShowExportDialog(false);
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error(t("archive.export.failed"));
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

      toast.success(t("archive.delete.success"));
      setShowDeleteDialog(false);
      setDeleteConfirmed(false);

      // Reload stats
      await loadStats();
    } catch (error) {
      console.error("Error deleting data:", error);
      toast.error(t("archive.delete.failed"));
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
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!companyId && !isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Archive className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t("archive.noCompany.title")}</h2>
          <p className="text-muted-foreground">
            {t("archive.noCompany.description")}
          </p>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Folk-style header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">🗂️</span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-folk-ink">{t("archive.title")}</h1>
            <p className="mt-1 text-[15px] text-folk-ink2">
              {t("archive.subtitle")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadStats}
            className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("misc.action.refresh")}
          </Button>
        </div>

        {/* GDPR Info Alert */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>{t("archive.gdpr.title")}</AlertTitle>
          <AlertDescription>
            {t("archive.gdpr.description")}
          </AlertDescription>
        </Alert>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t("archive.stats.leads")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.leads_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {t("archive.stats.olderThan", { count: stats?.leads_old || 0, days: retentionDays })}
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
                {t("archive.stats.offers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.offers_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {t("archive.stats.olderThan", { count: stats?.offers_old || 0, days: retentionDays })}
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
                {t("archive.stats.appointments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.appointments_total || 0}</div>
              <p className="text-sm text-muted-foreground">
                {t("archive.stats.olderThan", { count: stats?.appointments_old || 0, days: retentionDays })}
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
                {t("archive.stats.team")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.team_members || 0}</div>
              <p className="text-sm text-muted-foreground">
                {t("archive.stats.activeMembers")}
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
                {t("archive.export.title")}
              </CardTitle>
              <CardDescription>
                {t("archive.export.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 p-4 border rounded-lg text-center">
                  <FileJson className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="font-medium">JSON</p>
                  <p className="text-xs text-muted-foreground">{t("archive.export.jsonHint")}</p>
                </div>
                <div className="flex-1 p-4 border rounded-lg text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">CSV</p>
                  <p className="text-xs text-muted-foreground">{t("archive.export.csvHint")}</p>
                </div>
              </div>

              <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    {t("archive.export.title")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("archive.export.title")}</DialogTitle>
                    <DialogDescription>
                      {t("archive.export.dialogDescription")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t("archive.export.formatLabel")}</Label>
                      <Select
                        value={exportFormat}
                        onValueChange={(v) => setExportFormat(v as "json" | "csv")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">{t("archive.format.json")}</SelectItem>
                          <SelectItem value="csv">{t("archive.format.csv")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>{t("archive.export.selectData")}</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-leads"
                            checked={exportTypes.leads}
                            onCheckedChange={(c) => setExportTypes((prev) => ({ ...prev, leads: !!c }))}
                          />
                          <Label htmlFor="export-leads" className="cursor-pointer">
                            {t("archive.stats.leads")} ({stats?.leads_total || 0})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-offers"
                            checked={exportTypes.offers}
                            onCheckedChange={(c) => setExportTypes((prev) => ({ ...prev, offers: !!c }))}
                          />
                          <Label htmlFor="export-offers" className="cursor-pointer">
                            {t("archive.stats.offers")} ({stats?.offers_total || 0})
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="export-appointments"
                            checked={exportTypes.appointments}
                            onCheckedChange={(c) => setExportTypes((prev) => ({ ...prev, appointments: !!c }))}
                          />
                          <Label htmlFor="export-appointments" className="cursor-pointer">
                            {t("archive.stats.appointments")} ({stats?.appointments_total || 0})
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                      {isExporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("archive.export.running")}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          {t("archive.export.submit")}
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
                {t("archive.delete.title")}
              </CardTitle>
              <CardDescription>
                {t("archive.delete.description", { days: retentionDays })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("archive.delete.retention")}</Label>
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
                    {[30, 60, 90, 180].map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {t("archive.delete.retentionDays", { count: days })}
                      </SelectItem>
                    ))}
                    <SelectItem value="365">{t("archive.delete.retentionYear")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>{t("archive.delete.deletable")}</strong>
                </p>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  <li>• {stats?.leads_old || 0} {t("archive.stats.leads")}</li>
                  <li>• {stats?.offers_old || 0} {t("archive.stats.offers")}</li>
                  <li>• {stats?.appointments_old || 0} {t("archive.stats.appointments")}</li>
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
                    {t("archive.delete.title")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      {t("archive.delete.confirmTitle")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("archive.delete.confirmDescription")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{t("archive.delete.warning")}</AlertTitle>
                      <AlertDescription>
                        {t("archive.delete.warningIntro")}
                        <ul className="mt-2 space-y-1">
                          <li>• {t("archive.delete.leadsDetail", { count: stats?.leads_old || 0 })}</li>
                          <li>• {t("archive.delete.offersDetail", { count: stats?.offers_old || 0 })}</li>
                          <li>• {t("archive.delete.appointmentsDetail", { count: stats?.appointments_old || 0 })}</li>
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
                        {t("archive.delete.confirmCheckbox")}
                      </Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setShowDeleteDialog(false);
                      setDeleteConfirmed(false);
                    }}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteOldData}
                      disabled={!deleteConfirmed || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("archive.delete.running")}
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("archive.delete.submit")}
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
              {t("archive.info.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">{t("archive.info.export.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("archive.info.export.text")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("archive.info.deletion.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("archive.info.deletion.text")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("archive.info.retention.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("archive.info.retention.text")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("archive.info.security.title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("archive.info.security.text")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}

