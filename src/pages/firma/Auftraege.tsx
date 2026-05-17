import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  User,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Mail,
  Phone,
  Loader2,
  ClipboardList,
  Eye,
  Download,
  Package,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { AuftragModal } from "@/components/firma/AuftragModal";
import { SahaExtrasModal } from "@/components/firma/SahaExtrasModal";
import { generateAuftragPdf } from "@/lib/generateAuftragPdf";
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

interface OfferItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number | null;
}

interface ExtraService {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface Auftrag {
  id: string;
  auftrag_nummer: string;
  offer_id: string | null;
  lead_id: string | null;
  title: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  from_address: string | null;
  to_address: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  description: string | null;
  special_instructions: string | null;
  internal_notes: string | null;
  team_leader_id: string | null;
  assigned_team_members: string[];
  reminder_days_before: number;
  team_reminder_sent: boolean;
  status: string;
  created_at: string;
  // Pricing & service data
  service_type?: string | null;
  pricing_type?: "fixed" | "hourly" | "estimate" | null;
  hourly_rate?: number | null;
  subtotal?: number | null;
  vat_rate?: number | null;
  vat_amount?: number | null;
  total?: number | null;
  items?: OfferItem[];
  extra_services?: ExtraService[];
  service_details?: Record<string, unknown>;
  // Relations
  team_leader?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  offer?: {
    id: string;
    title: string;
  };
}

interface Stats {
  total: number;
  geplant: number;
  bestaetigt: number;
  in_bearbeitung: number;
  abgeschlossen: number;
  today: number;
  tomorrow: number;
  this_week: number;
  overdue: number;
}

const FirmaAuftraege = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("alle");
  const [stats, setStats] = useState<Stats>({
    total: 0,
    geplant: 0,
    bestaetigt: 0,
    in_bearbeitung: 0,
    abgeschlossen: 0,
    today: 0,
    tomorrow: 0,
    this_week: 0,
    overdue: 0,
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAuftrag, setSelectedAuftrag] = useState<Auftrag | null>(null);
  const [deleteAuftrag, setDeleteAuftrag] = useState<Auftrag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [extrasAuftragId, setExtrasAuftragId] = useState<string | null>(null);

  // PDF Download function
  const handleDownloadPdf = async (auftrag: Auftrag) => {
    setIsDownloadingPdf(auftrag.id);

    try {
      // Fetch complete company data for the PDF
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select(`
          company_name,
          street,
          house_number,
          plz,
          city,
          phone,
          email,
          website,
          mwst_number,
          iban,
          logo_url,
          primary_color,
          signature_url
        `)
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      // Fetch team members data if assigned
      let teamMembersData: { first_name: string; last_name: string; email: string | null; phone: string | null }[] = [];
      if (auftrag.assigned_team_members && auftrag.assigned_team_members.length > 0) {
        const { data: membersData } = await supabase
          .from("team_members")
          .select("id, first_name, last_name, email, phone")
          .in("id", auftrag.assigned_team_members);

        if (membersData) {
          teamMembersData = membersData;
        }
      }

      // Generate PDF with complete data
      await generateAuftragPdf({
        id: auftrag.id,
        auftrag_nummer: auftrag.auftrag_nummer,
        title: auftrag.title,
        customer_name: auftrag.customer_name,
        customer_email: auftrag.customer_email,
        customer_phone: auftrag.customer_phone,
        from_address: auftrag.from_address,
        to_address: auftrag.to_address,
        scheduled_date: auftrag.scheduled_date,
        scheduled_time: auftrag.scheduled_time,
        estimated_duration_minutes: auftrag.estimated_duration_minutes,
        description: auftrag.description,
        special_instructions: auftrag.special_instructions,
        status: auftrag.status,
        service_type: auftrag.service_type,
        pricing_type: auftrag.pricing_type,
        hourly_rate: auftrag.hourly_rate,
        subtotal: auftrag.subtotal,
        vat_rate: auftrag.vat_rate,
        vat_amount: auftrag.vat_amount,
        total: auftrag.total,
        items: auftrag.items,
        extra_services: auftrag.extra_services,
        service_details: auftrag.service_details,
        team_leader: auftrag.team_leader,
        assigned_team_members_data: teamMembersData,
        company: companyData,
      });

      toast({
        title: "Erfolg",
        description: "PDF wurde heruntergeladen.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Fehler",
        description: "PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      const company = await fetchSingleCompanyForUser<{ id: string }>({
        userId: user.id,
        userEmail: user.email,
        select: "id",
      });

      if (!company) return;
      setCompanyId(company.id);

      const { data, error } = await supabase
        .from("auftraege")
        .select(`
          *,
          team_leader:team_leader_id (first_name, last_name, email, phone),
          offer:offer_id (id, title)
        `)
        .eq("company_id", company.id)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;

      const auftraegeData = (data || []) as Auftrag[];
      setAuftraege(auftraegeData);

      // Calculate stats
      const today = new Date();
      const weekEnd = addDays(today, 7);

      const newStats: Stats = {
        total: auftraegeData.length,
        geplant: auftraegeData.filter((a) => a.status === "geplant").length,
        bestaetigt: auftraegeData.filter((a) => a.status === "bestaetigt").length,
        in_bearbeitung: auftraegeData.filter((a) => a.status === "in_bearbeitung").length,
        abgeschlossen: auftraegeData.filter((a) => a.status === "abgeschlossen").length,
        today: auftraegeData.filter((a) => isToday(new Date(a.scheduled_date))).length,
        tomorrow: auftraegeData.filter((a) => isTomorrow(new Date(a.scheduled_date))).length,
        this_week: auftraegeData.filter((a) => {
          const date = new Date(a.scheduled_date);
          return date >= today && date <= weekEnd;
        }).length,
        overdue: auftraegeData.filter((a) => {
          const date = new Date(a.scheduled_date);
          return isPast(date) && !isToday(date) && a.status !== "abgeschlossen" && a.status !== "storniert";
        }).length,
      };
      setStats(newStats);
    } catch (error) {
      console.error("Error fetching auftraege:", error);
      toast({
        title: "Fehler",
        description: "Aufträge konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteAuftrag || isDeleting) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("auftraege")
        .delete()
        .eq("id", deleteAuftrag.id);

      if (error) throw error;

      setAuftraege((prev) => prev.filter((a) => a.id !== deleteAuftrag.id));
      setStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        [deleteAuftrag.status]: Math.max(0, (prev[deleteAuftrag.status as keyof Stats] || 0) - 1),
      }));

      toast({
        title: "Erfolg",
        description: "Auftrag wurde gelöscht.",
      });
    } catch (error) {
      console.error("Error deleting auftrag:", error);
      toast({
        title: "Fehler",
        description: "Auftrag konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      fetchData();
    } finally {
      setIsDeleting(false);
      setDeleteAuftrag(null);
    }
  };

  const handleStatusChange = async (auftragId: string, newStatus: string) => {
    if (updatingIds.has(auftragId)) return;

    const original = auftraege.find((a) => a.id === auftragId);
    if (!original) return;

    setUpdatingIds((prev) => new Set(prev).add(auftragId));

    setAuftraege((prev) =>
      prev.map((a) => (a.id === auftragId ? { ...a, status: newStatus } : a))
    );

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        completed_at: newStatus === "abgeschlossen" ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("auftraege")
        .update(updateData)
        .eq("id", auftragId);

      if (error) throw error;

      const statusKeys: (keyof Stats)[] = ["geplant", "bestaetigt", "in_bearbeitung", "abgeschlossen"];
      setStats((prev) => {
        const next = { ...prev };
        if (statusKeys.includes(original.status as keyof Stats)) {
          next[original.status as keyof Stats] = Math.max(0, (next[original.status as keyof Stats] || 0) - 1);
        }
        if (statusKeys.includes(newStatus as keyof Stats)) {
          next[newStatus as keyof Stats] = (next[newStatus as keyof Stats] || 0) + 1;
        }
        return next;
      });

      toast({
        title: "Erfolg",
        description: "Status wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Error updating status:", error);
      setAuftraege((prev) =>
        prev.map((a) => (a.id === auftragId ? original : a))
      );
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(auftragId);
        return next;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      geplant: { label: "Geplant", className: "bg-blue-100 text-blue-700" },
      bestaetigt: { label: "Bestätigt", className: "bg-green-100 text-green-700" },
      in_bearbeitung: { label: "In Bearbeitung", className: "bg-amber-100 text-amber-700" },
      abgeschlossen: { label: "Abgeschlossen", className: "bg-emerald-100 text-emerald-700" },
      storniert: { label: "Storniert", className: "bg-red-100 text-red-700" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
  };

  const getDateBadge = (dateStr: string, status: string) => {
    const date = new Date(dateStr);

    // Completed or cancelled orders should not show date badges
    if (status === "abgeschlossen" || status === "storniert") {
      return null;
    }

    if (isToday(date)) {
      return <Badge className="bg-red-500 text-white">Heute</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge className="bg-amber-500 text-white">Morgen</Badge>;
    }
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">Überfällig</Badge>;
    }
    return null;
  };

  // Filter auftraege
  const filteredAuftraege = auftraege.filter((a) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (a.title || "").toLowerCase().includes(searchLower) ||
      (a.customer_name || "").toLowerCase().includes(searchLower) ||
      (a.auftrag_nummer || "").toLowerCase().includes(searchLower) ||
      a.from_address?.toLowerCase().includes(searchLower) ||
      a.to_address?.toLowerCase().includes(searchLower);

    // Tab filter
    let matchesTab = true;
    if (activeTab === "heute") {
      matchesTab = isToday(new Date(a.scheduled_date));
    } else if (activeTab === "morgen") {
      matchesTab = isTomorrow(new Date(a.scheduled_date));
    } else if (activeTab === "geplant") {
      matchesTab = a.status === "geplant" || a.status === "bestaetigt";
    } else if (activeTab === "abgeschlossen") {
      matchesTab = a.status === "abgeschlossen";
    } else if (activeTab === "storniert") {
      matchesTab = a.status === "storniert";
    }

    return matchesSearch && matchesTab;
  });

  return (
    <>
      <Helmet>
        <title>Aufträge | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" />
                Aufträge
              </h1>
              <p className="text-muted-foreground text-sm">
                Verwalten Sie Ihre Arbeitsaufträge und Team-Zuweisungen
              </p>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => {
              setSelectedAuftrag(null);
              setIsModalOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Neuer Auftrag
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={stats.today > 0 ? "border-red-300 bg-red-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.today}</p>
                    <p className="text-xs text-muted-foreground">Heute</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={stats.tomorrow > 0 ? "border-amber-300 bg-amber-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.tomorrow}</p>
                    <p className="text-xs text-muted-foreground">Morgen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.geplant + stats.bestaetigt}</p>
                    <p className="text-xs text-muted-foreground">Geplant</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.abgeschlossen}</p>
                    <p className="text-xs text-muted-foreground">Abgeschlossen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Warning */}
          {stats.overdue > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">
                  {stats.overdue} überfällige{stats.overdue === 1 ? "r" : ""} Auftrag{stats.overdue === 1 ? "" : "e"}
                </span>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto -mx-1 px-1">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-max min-w-full sm:w-full">
                      <TabsTrigger value="alle" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none">Alle ({stats.total})</TabsTrigger>
                      <TabsTrigger value="heute" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none">Heute ({stats.today})</TabsTrigger>
                      <TabsTrigger value="morgen" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none">Morgen ({stats.tomorrow})</TabsTrigger>
                      <TabsTrigger value="geplant" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none">Geplant ({stats.geplant + stats.bestaetigt})</TabsTrigger>
                      <TabsTrigger value="abgeschlossen" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-none">
                        <span className="hidden sm:inline">Erledigt</span>
                        <span className="sm:hidden">Erled.</span>
                        {" "}({stats.abgeschlossen})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredAuftraege.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Aufträge gefunden</p>
                  <Button variant="outline" className="mt-4" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ersten Auftrag erstellen
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auftrag</TableHead>
                        <TableHead className="hidden sm:table-cell">Kunde</TableHead>
                        <TableHead className="hidden md:table-cell">Datum/Zeit</TableHead>
                        <TableHead className="hidden lg:table-cell">Team</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAuftraege.map((auftrag) => (
                        <TableRow key={auftrag.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">{auftrag.title}</p>
                              <p className="text-xs text-muted-foreground">{auftrag.auftrag_nummer}</p>
                              {/* Mobile: show date inline */}
                              <div className="flex items-center gap-1.5 mt-1 md:hidden">
                                <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(auftrag.scheduled_date), "dd.MM.yy", { locale: de })}
                                  {auftrag.scheduled_time && ` · ${auftrag.scheduled_time.substring(0, 5)}`}
                                </p>
                                {getDateBadge(auftrag.scheduled_date, auftrag.status)}
                              </div>
                              {/* Mobile: show customer name */}
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 sm:hidden">
                                <User className="w-3 h-3" />
                                {auftrag.customer_name}
                              </p>
                              {auftrag.from_address && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hidden sm:flex">
                                  <MapPin className="w-3 h-3" />
                                  {auftrag.from_address.split("\n")[0]}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{auftrag.customer_name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {auftrag.customer_phone && (
                                    <a href={`tel:${auftrag.customer_phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {auftrag.customer_phone}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {format(new Date(auftrag.scheduled_date), "dd.MM.yyyy", { locale: de })}
                                </p>
                                {getDateBadge(auftrag.scheduled_date, auftrag.status)}
                              </div>
                              {auftrag.scheduled_time && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {auftrag.scheduled_time.substring(0, 5)} Uhr
                                </p>
                              )}
                              {auftrag.estimated_duration_minutes && (
                                <p className="text-xs text-muted-foreground">
                                  ~{Math.floor(auftrag.estimated_duration_minutes / 60)}h
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {auftrag.team_leader ? (
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="font-medium text-sm">{auftrag.team_leader.first_name} {auftrag.team_leader.last_name}</p>
                                  {auftrag.team_reminder_sent && (
                                    <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                                      <Mail className="w-2.5 h-2.5 mr-1" />
                                      Benachrichtigt
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Nicht zugewiesen</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(auftrag.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Auftrag Optionen">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedAuftrag(auftrag);
                                  setIsModalOpen(true);
                                }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setExtrasAuftragId(auftrag.id)}
                                  className="text-purple-600"
                                >
                                  <Package className="w-4 h-4 mr-2" />
                                  Saha Extras
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadPdf(auftrag)}
                                  disabled={isDownloadingPdf === auftrag.id}
                                >
                                  {isDownloadingPdf === auftrag.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                  )}
                                  PDF herunterladen
                                </DropdownMenuItem>
                                {auftrag.offer && (
                                  <DropdownMenuItem onClick={() => window.open(`/firma/offerten/${auftrag.offer?.id}`, "_blank")}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Offerte anzeigen
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {auftrag.status === "geplant" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "bestaetigt")}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                    Als bestätigt markieren
                                  </DropdownMenuItem>
                                )}
                                {(auftrag.status === "geplant" || auftrag.status === "bestaetigt") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "in_bearbeitung")}>
                                    <Clock className="w-4 h-4 mr-2 text-amber-600" />
                                    In Bearbeitung
                                  </DropdownMenuItem>
                                )}
                                {auftrag.status !== "abgeschlossen" && auftrag.status !== "storniert" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "abgeschlossen")}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                                    Als erledigt markieren
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => setDeleteAuftrag(auftrag)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Auftrag Modal */}
        <AuftragModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAuftrag(null);
          }}
          companyId={companyId}
          auftrag={selectedAuftrag}
          onSuccess={fetchData}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteAuftrag} onOpenChange={() => setDeleteAuftrag(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie den Auftrag "{deleteAuftrag?.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird gelöscht...
                  </>
                ) : (
                  "Löschen"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Saha Extras Modal */}
        <SahaExtrasModal
          open={!!extrasAuftragId}
          onOpenChange={(open) => !open && setExtrasAuftragId(null)}
          auftragId={extrasAuftragId || ''}
          onSaved={fetchData}
        />
    </>
  );
};

export default FirmaAuftraege;

