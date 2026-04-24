// =============================================================================
// ARCHIVE MANAGEMENT PAGE
// Admin page for managing data archives
// =============================================================================

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Archive,
  Download,
  RefreshCw,
  Settings,
  Calendar,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  History,
  RotateCcw,
  Info,
} from "lucide-react";

import {
  ArchiveType,
  ArchiveLog,
  ArchiveSettings,
  ArchiveStatistics,
  ARCHIVE_TYPE_LABELS,
} from "@/types/archive";
import {
  getArchiveSettings,
  updateArchiveSettings,
  getArchiveLogs,
  getArchiveStatistics,
  createArchive,
  downloadFile,
  formatFileSize,
  formatArchiveDate,
} from "@/lib/archiveUtils";

export default function ArchiveManagement() {
  // State
  const [settings, setSettings] = useState<ArchiveSettings | null>(null);
  const [logs, setLogs] = useState<ArchiveLog[]>([]);
  const [statistics, setStatistics] = useState<ArchiveStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedArchiveType, setSelectedArchiveType] = useState<ArchiveType>("leads");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteAfterArchive, setDeleteAfterArchive] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, logsData, statsData] = await Promise.all([
        getArchiveSettings(),
        getArchiveLogs(1, 20),
        getArchiveStatistics(),
      ]);

      if (settingsData) setSettings(settingsData);
      setLogs(logsData.logs);
      setStatistics(statsData);
    } catch (error) {
      console.error("Error loading archive data:", error);
      toast.error("Fehler beim Laden der Archivdaten");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const success = await updateArchiveSettings(settings);
      if (success) {
        toast.success("Einstellungen gespeichert");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateArchive = async () => {
    setIsArchiving(true);
    try {
      const result = await createArchive({
        archive_type: selectedArchiveType,
        storage_type: "local",
        export_format: settings?.default_export_format || "json",
        delete_after_archive: deleteAfterArchive,
      });

      if (result.success) {
        toast.success(
          `${result.records_archived} Datensätze archiviert`
        );

        // Download file if URL provided
        if (result.download_url) {
          const filename = `archive_${selectedArchiveType}_${new Date().toISOString().split("T")[0]}.${
            settings?.default_export_format || "json"
          }`;
          
          // Fetch the blob and download
          const response = await fetch(result.download_url);
          const blob = await response.blob();
          const text = await blob.text();
          downloadFile(
            text,
            filename,
            settings?.default_export_format === "csv" ? "text/csv" : "application/json"
          );
        }

        // Reload data
        await loadData();
      } else {
        toast.error(result.error || "Archivierung fehlgeschlagen");
      }
    } catch (error) {
      console.error("Error creating archive:", error);
      toast.error("Fehler bei der Archivierung");
    } finally {
      setIsArchiving(false);
      setShowCreateDialog(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Abgeschlossen</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Bearbeitung</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Fehlgeschlagen</Badge>;
      case "restored":
        return <Badge className="bg-purple-100 text-purple-800"><RotateCcw className="w-3 h-3 mr-1" />Wiederhergestellt</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Ausstehend</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="w-6 h-6 shrink-0" />
              Datenarchivierung
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Verwalten Sie Ihre Datenarchive und optimieren Sie Speicherkosten
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} className="flex-1 sm:flex-none">
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Aktualisieren</span>
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none">
                  <Archive className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Neues Archiv erstellen</span>
                  <span className="sm:hidden">Neues Archiv</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neues Archiv erstellen</DialogTitle>
                  <DialogDescription>
                    Wählen Sie die zu archivierenden Daten und das Exportformat
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Datentyp</Label>
                    <Select
                      value={selectedArchiveType}
                      onValueChange={(v) => setSelectedArchiveType(v as ArchiveType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ARCHIVE_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Nach Archivierung löschen</Label>
                      <p className="text-sm text-muted-foreground">
                        Quelldaten nach erfolgreichem Export löschen
                      </p>
                    </div>
                    <Switch
                      checked={deleteAfterArchive}
                      onCheckedChange={setDeleteAfterArchive}
                    />
                  </div>

                  {deleteAfterArchive && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warnung</AlertTitle>
                      <AlertDescription>
                        Die Quelldaten werden nach der Archivierung unwiderruflich gelöscht.
                        Stellen Sie sicher, dass Sie das Archiv sicher gespeichert haben.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreateArchive} disabled={isArchiving}>
                    {isArchiving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Archiviert...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Archiv erstellen & herunterladen
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statistics.map((stat) => (
            <Card key={stat.table_name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {ARCHIVE_TYPE_LABELS[stat.table_name as ArchiveType] || stat.table_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-bold">{stat.total_records.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">
                      {stat.estimated_size_mb.toFixed(2)} MB
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {stat.archivable_records.toLocaleString()} archivierbar
                    </Badge>
                  </div>
                  {stat.archivable_records > 0 && (
                    <Progress 
                      value={(stat.archivable_records / stat.total_records) * 100} 
                      className="h-1"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="history" className="gap-2 flex-1 sm:flex-none">
              <History className="w-4 h-4" />
              Archiv-Verlauf
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 flex-1 sm:flex-none">
              <Settings className="w-4 h-4" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          {/* Archive History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Archiv-Verlauf</CardTitle>
                <CardDescription>
                  Übersicht aller erstellten Archive
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Noch keine Archive vorhanden</p>
                    <p className="text-sm">Erstellen Sie Ihr erstes Archiv mit dem Button oben</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Typ</TableHead>
                        <TableHead className="hidden sm:table-cell">Datensätze</TableHead>
                        <TableHead className="hidden md:table-cell">Größe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Erstellt</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sm">{log.archive_name}</p>
                              <div className="flex gap-1 mt-1 sm:hidden">
                                <Badge variant="outline" className="text-[10px] px-1">
                                  {ARCHIVE_TYPE_LABELS[log.archive_type]}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">
                              {ARCHIVE_TYPE_LABELS[log.archive_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{log.records_archived.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatFileSize(log.file_size_bytes)}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {formatArchiveDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {log.storage_url && (
                                <Button variant="ghost" size="sm">
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              {log.is_restorable && !log.restored_at && (
                                <Button variant="ghost" size="sm">
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-6">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Allgemeine Einstellungen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Automatische Archivierung</Label>
                      <p className="text-sm text-muted-foreground">
                        Daten automatisch am ersten Tag jedes Monats archivieren
                      </p>
                    </div>
                    <Switch
                      checked={settings?.is_enabled ?? true}
                      onCheckedChange={(checked) =>
                        setSettings(s => s ? { ...s, is_enabled: checked } : null)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Standard Exportformat</Label>
                      <Select
                        value={settings?.default_export_format || "json"}
                        onValueChange={(v) =>
                          setSettings(s => s ? { ...s, default_export_format: v as "json" | "csv" } : null)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">
                            <div className="flex items-center gap-2">
                              <FileJson className="w-4 h-4" />
                              JSON (Vollständig)
                            </div>
                          </SelectItem>
                          <SelectItem value="csv">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4" />
                              CSV (Excel)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Archivierungstag</Label>
                      <Select
                        value={String(settings?.auto_archive_day || 1)}
                        onValueChange={(v) =>
                          setSettings(s => s ? { ...s, auto_archive_day: parseInt(v) } : null)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 5, 10, 15, 20, 25].map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              {day}. des Monats
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Retention Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Aufbewahrungsfristen
                  </CardTitle>
                  <CardDescription>
                    Daten älter als diese Zeiträume werden archiviert
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Leads (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.leads_retention_days || 90}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, leads_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Offerten (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.offers_retention_days || 90}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, offers_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-Mail Logs (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.email_logs_retention_days || 90}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, email_logs_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Benachrichtigungen (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.notifications_retention_days || 30}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, notifications_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Analytics (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.analytics_retention_days || 180}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, analytics_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Termine (Tage)</Label>
                      <Input
                        type="number"
                        value={settings?.appointments_retention_days || 90}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, appointments_retention_days: parseInt(e.target.value) } : null)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Benachrichtigungen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>E-Mail nach Archivierung</Label>
                      <p className="text-sm text-muted-foreground">
                        Benachrichtigung nach jeder automatischen Archivierung
                      </p>
                    </div>
                    <Switch
                      checked={settings?.notify_on_archive ?? true}
                      onCheckedChange={(checked) =>
                        setSettings(s => s ? { ...s, notify_on_archive: checked } : null)
                      }
                    />
                  </div>

                  {settings?.notify_on_archive && (
                    <div className="space-y-2">
                      <Label>Benachrichtigungs-E-Mail</Label>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={settings?.notify_email || ""}
                        onChange={(e) =>
                          setSettings(s => s ? { ...s, notify_email: e.target.value } : null)
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Speichert...
                    </>
                  ) : (
                    "Einstellungen speichern"
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

