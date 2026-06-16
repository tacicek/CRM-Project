import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
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
  Eye,
  Download,
  Package,
  FileText,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { AuftragModal } from "@/components/firma/AuftragModal";
import { AuftragAbschlussDialog } from "@/components/firma/AuftragAbschlussDialog";
import { SahaExtrasModal } from "@/components/firma/SahaExtrasModal";
import { generateAuftragPdf } from "@/lib/generateAuftragPdf";
import { canTransitionAuftrag } from "@/lib/auftragStatus";
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
  appointment_id?: string | null;
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

// Folk status mapping
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  geplant:        { label: "Geplant",        color: "text-folk-sky",    bg: "bg-folk-sky-bg" },
  bestaetigt:     { label: "Bestätigt",      color: "text-folk-mint",   bg: "bg-folk-mint-bg" },
  in_bearbeitung: { label: "In Bearbeitung", color: "text-folk-lemon",  bg: "bg-folk-lemon-bg" },
  abgeschlossen:  { label: "Abgeschlossen",  color: "text-folk-mint",   bg: "bg-folk-mint-bg" },
  storniert:      { label: "Storniert",      color: "text-folk-coral",  bg: "bg-folk-coral-bg" },
};

const FirmaAuftraege = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAuftrag, setSelectedAuftrag] = useState<Auftrag | null>(null);
  const [deleteAuftrag, setDeleteAuftrag] = useState<Auftrag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [extrasAuftragId, setExtrasAuftragId] = useState<string | null>(null);
  const [completionAuftrag, setCompletionAuftrag] = useState<Auftrag | null>(null);

  const handleDownloadPdf = async (auftrag: Auftrag) => {
    setIsDownloadingPdf(auftrag.id);

    try {
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
        .is("deleted_at", null)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;

      const auftraegeData = (data || []) as Auftrag[];
      setAuftraege(auftraegeData);

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
      // Soft-delete: Audit-Trail bleibt erhalten, Zeile wird nur archiviert/ausgeblendet.
      const { error } = await supabase
        .from("auftraege")
        .update({ deleted_at: new Date().toISOString() })
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
        description: "Auftrag wurde archiviert.",
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

  const handleCreateQuittung = (auftrag: Auftrag) => {
    navigate("/firma/quittungen/neu", {
      state: {
        fromAuftrag: {
          offerId: auftrag.offer_id ?? null,
          customerName: auftrag.customer_name,
          customerAddress: auftrag.from_address ?? "",
          customerDestination: auftrag.to_address ?? "",
          customerEmail: auftrag.customer_email ?? "",
          customerPhone: auftrag.customer_phone ?? "",
          items: auftrag.items ?? [],
          extraServices: auftrag.extra_services ?? [],
        },
      },
    });
  };

  const getStatusChip = (status: string) => {
    const meta = STATUS_META[status] ?? { label: status, color: "text-folk-ink3", bg: "bg-folk-bg-warm" };
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
        {meta.label}
      </span>
    );
  };

  const getDateBadge = (dateStr: string, status: string) => {
    const date = new Date(dateStr);

    if (status === "abgeschlossen" || status === "storniert") {
      return null;
    }

    if (isToday(date)) {
      return <span className="inline-flex items-center rounded-md bg-folk-coral px-2 py-0.5 text-[11px] font-semibold text-white">Heute</span>;
    }
    if (isTomorrow(date)) {
      return <span className="inline-flex items-center rounded-md bg-folk-lemon-bg px-2 py-0.5 text-[11px] font-semibold text-folk-lemon">Morgen</span>;
    }
    if (isPast(date) && !isToday(date)) {
      return <span className="inline-flex items-center rounded-md bg-folk-coral-bg px-2 py-0.5 text-[11px] font-semibold text-folk-coral">Überfällig</span>;
    }
    return null;
  };

  const filteredAuftraege = auftraege.filter((a) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (a.title || "").toLowerCase().includes(searchLower) ||
      (a.customer_name || "").toLowerCase().includes(searchLower) ||
      (a.auftrag_nummer || "").toLowerCase().includes(searchLower) ||
      a.from_address?.toLowerCase().includes(searchLower) ||
      a.to_address?.toLowerCase().includes(searchLower);

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

  const kpiTiles = [
    { emoji: "📅", label: "Heute",        value: stats.today,                       highlight: stats.today > 0 },
    { emoji: "⏰", label: "Morgen",       value: stats.tomorrow,                    highlight: false },
    { emoji: "📋", label: "Geplant",      value: stats.geplant + stats.bestaetigt,  highlight: false },
    { emoji: "✅", label: "Abgeschlossen", value: stats.abgeschlossen,              highlight: false },
  ];

  return (
    <>
      <Helmet>
        <title>Aufträge · CRM</title>
      </Helmet>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">✅</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Aufträge</h1>
              <span className="text-[13px] text-folk-ink3">
                <span className="font-mono">{stats.total}</span> insgesamt · <span className="font-mono">{stats.today}</span> heute · <span className="font-mono">{stats.this_week}</span> diese Woche
              </span>
            </div>
            <p className="mt-1 text-[13px] text-folk-ink2">
              Arbeitsaufträge und Team-Zuweisungen — Übersicht über alle geplanten Einsätze.
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedAuftrag(null);
              setIsModalOpen(true);
            }}
            className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[13px] font-semibold text-white hover:bg-folk-ink2"
          >
            <Plus className="h-3.5 w-3.5" />
            Neuer Auftrag
          </Button>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {kpiTiles.map((tile) => (
            <div
              key={tile.label}
              className={`rounded-xl border bg-folk-card p-4 transition-all md:p-5 ${
                tile.highlight ? "border-folk-coral/30 ring-1 ring-folk-coral/20" : "border-folk-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                <span className="text-xl leading-none">{tile.emoji}</span>
              </div>
              <div className="mt-3 font-sans text-3xl font-bold tracking-tight text-folk-ink">{tile.value}</div>
            </div>
          ))}
        </div>

        {/* Overdue warning */}
        {stats.overdue > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-folk-coral/30 bg-folk-coral-bg px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-folk-coral" />
            <span className="text-[13px] font-semibold text-folk-coral">
              <span className="font-mono">{stats.overdue}</span> überfällige{stats.overdue === 1 ? "r" : ""} Auftrag{stats.overdue === 1 ? "" : "e"}
            </span>
          </div>
        )}

        {/* Tabs + search */}
        <section className="rounded-xl border border-folk-line bg-folk-card">
          <div className="border-b border-folk-line p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div className="-mx-1 overflow-x-auto px-1">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="h-auto w-max min-w-full gap-1 bg-folk-bg-warm p-1 sm:w-full">
                    {[
                      { v: "alle",          label: "Alle",         count: stats.total },
                      { v: "heute",         label: "Heute",        count: stats.today },
                      { v: "morgen",        label: "Morgen",       count: stats.tomorrow },
                      { v: "geplant",       label: "Geplant",      count: stats.geplant + stats.bestaetigt },
                      { v: "abgeschlossen", label: "Erledigt",     count: stats.abgeschlossen },
                    ].map((tab) => (
                      <TabsTrigger
                        key={tab.v}
                        value={tab.v}
                        className="h-8 flex-1 gap-1.5 rounded-md px-3 text-[12.5px] text-folk-ink2 data-[state=active]:bg-folk-card data-[state=active]:font-semibold data-[state=active]:text-folk-ink data-[state=active]:shadow-[0_1px_2px_rgba(24,24,26,0.04)] sm:flex-none"
                      >
                        <span>{tab.label}</span>
                        <span className="font-mono text-[11px] text-folk-ink3">{tab.count}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-folk-ink3" />
                <Input
                  placeholder="In Aufträgen suchen …"
                  className="h-9 rounded-lg border-folk-line bg-folk-card pl-8 text-[13px] text-folk-ink placeholder:text-folk-ink4 focus-visible:ring-folk-coral/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
              </div>
            ) : filteredAuftraege.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">📋</div>
                <p className="text-[13px] text-folk-ink3">Keine Aufträge gefunden</p>
                <Button
                  variant="outline"
                  className="mt-3 h-9 rounded-lg border-folk-line bg-folk-card text-[13px] text-folk-ink2 hover:bg-folk-bg-warm"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ersten Auftrag erstellen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-folk-line hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">Auftrag</TableHead>
                      <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wider text-folk-ink3 sm:table-cell">Kunde</TableHead>
                      <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wider text-folk-ink3 md:table-cell">Datum/Zeit</TableHead>
                      <TableHead className="hidden text-[11px] font-semibold uppercase tracking-wider text-folk-ink3 lg:table-cell">Team</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuftraege.map((auftrag) => (
                      <TableRow key={auftrag.id} className="group cursor-pointer border-folk-line-soft transition-colors hover:bg-folk-bg-warm">
                        <TableCell>
                          <div>
                            <p className="text-[13px] font-semibold tracking-tight text-folk-ink">{auftrag.title}</p>
                            <p className="font-mono text-[11px] text-folk-ink4">{auftrag.auftrag_nummer}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                              <Calendar className="h-3 w-3 shrink-0 text-folk-ink4" />
                              <p className="font-mono text-[11px] text-folk-ink3">
                                {format(new Date(auftrag.scheduled_date), "dd.MM.yy", { locale: de })}
                                {auftrag.scheduled_time && ` · ${auftrag.scheduled_time.substring(0, 5)}`}
                              </p>
                              {getDateBadge(auftrag.scheduled_date, auftrag.status)}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-folk-ink3 sm:hidden">
                              <User className="h-3 w-3" />
                              {auftrag.customer_name}
                            </p>
                            {auftrag.from_address && (
                              <p className="mt-0.5 hidden items-center gap-1 text-[11px] text-folk-ink4 sm:flex">
                                <MapPin className="h-3 w-3" />
                                {auftrag.from_address.split("\n")[0]}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-start gap-2">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink4" />
                            <div>
                              <p className="text-[13px] font-medium text-folk-ink">{auftrag.customer_name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                {auftrag.customer_phone && (
                                  <a href={`tel:${auftrag.customer_phone}`} className="flex items-center gap-1 font-mono text-[11px] text-folk-ink2 hover:text-folk-coral">
                                    <Phone className="h-3 w-3 text-folk-ink4" />
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
                              <p className="font-mono text-[13px] font-medium text-folk-ink">
                                {format(new Date(auftrag.scheduled_date), "dd.MM.yyyy", { locale: de })}
                              </p>
                              {getDateBadge(auftrag.scheduled_date, auftrag.status)}
                            </div>
                            {auftrag.scheduled_time && (
                              <p className="flex items-center gap-1 text-[11px] text-folk-ink3">
                                <Clock className="h-3 w-3" />
                                <span className="font-mono">{auftrag.scheduled_time.substring(0, 5)}</span> Uhr
                              </p>
                            )}
                            {auftrag.estimated_duration_minutes && (
                              <p className="text-[11px] text-folk-ink4">
                                ~<span className="font-mono">{Math.floor(auftrag.estimated_duration_minutes / 60)}</span>h
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {auftrag.team_leader ? (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 shrink-0 text-folk-ink4" />
                              <div>
                                <p className="text-[13px] font-medium text-folk-ink">{auftrag.team_leader.first_name} {auftrag.team_leader.last_name}</p>
                                {auftrag.team_reminder_sent && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-folk-mint-bg px-1.5 py-0.5 text-[10px] font-semibold text-folk-mint">
                                    <Mail className="h-2.5 w-2.5" />
                                    Benachrichtigt
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-folk-ink4">Nicht zugewiesen</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusChip(auftrag.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-folk-ink3 hover:bg-folk-card hover:text-folk-ink2" aria-label="Auftrag Optionen">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedAuftrag(auftrag);
                                setIsModalOpen(true);
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setExtrasAuftragId(auftrag.id)}
                                className="text-folk-violet"
                              >
                                <Package className="mr-2 h-4 w-4" />
                                Saha Extras
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownloadPdf(auftrag)}
                                disabled={isDownloadingPdf === auftrag.id}
                              >
                                {isDownloadingPdf === auftrag.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                PDF herunterladen
                              </DropdownMenuItem>
                              {auftrag.offer && (
                                <DropdownMenuItem onClick={() => window.open(`/firma/offerten/${auftrag.offer?.id}`, "_blank")}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Offerte anzeigen
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleCreateQuittung(auftrag)}
                                className="text-folk-mint"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Quittung erstellen
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {canTransitionAuftrag(auftrag.status, "bestaetigt") && (
                                <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "bestaetigt")}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-folk-mint" />
                                  Als bestätigt markieren
                                </DropdownMenuItem>
                              )}
                              {canTransitionAuftrag(auftrag.status, "in_bearbeitung") && (
                                <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "in_bearbeitung")}>
                                  <Clock className="mr-2 h-4 w-4 text-folk-lemon" />
                                  In Bearbeitung
                                </DropdownMenuItem>
                              )}
                              {canTransitionAuftrag(auftrag.status, "abgeschlossen") && (
                                <DropdownMenuItem onClick={() => setCompletionAuftrag(auftrag)}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-folk-mint" />
                                  Abschliessen …
                                </DropdownMenuItem>
                              )}
                              {auftrag.status === "storniert" && canTransitionAuftrag(auftrag.status, "geplant") && (
                                <DropdownMenuItem onClick={() => handleStatusChange(auftrag.id, "geplant")}>
                                  <RotateCcw className="mr-2 h-4 w-4 text-folk-sky" />
                                  Reaktivieren
                                </DropdownMenuItem>
                              )}
                              {canTransitionAuftrag(auftrag.status, "storniert") && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(auftrag.id, "storniert")}
                                  className="text-folk-coral"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Stornieren
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-folk-coral"
                                onClick={() => setDeleteAuftrag(auftrag)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Archivieren
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
          </div>
        </section>
      </div>

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

      <AlertDialog open={!!deleteAuftrag} onOpenChange={() => setDeleteAuftrag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Auftrag "{deleteAuftrag?.title}" wirklich archivieren? Der Auftrag wird aus der Liste entfernt, bleibt aber für die Nachvollziehbarkeit gespeichert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-folk-coral hover:bg-folk-coral/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gelöscht...
                </>
              ) : (
                "Löschen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SahaExtrasModal
        open={!!extrasAuftragId}
        onOpenChange={(open) => !open && setExtrasAuftragId(null)}
        auftragId={extrasAuftragId || ''}
        onSaved={fetchData}
      />

      <AuftragAbschlussDialog
        open={!!completionAuftrag}
        onOpenChange={(open) => !open && setCompletionAuftrag(null)}
        auftrag={completionAuftrag}
        onCompleted={fetchData}
      />
    </>
  );
};

export default FirmaAuftraege;
