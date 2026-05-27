import { useState, useEffect, useMemo, useCallback } from "react";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Package,
  Plus,
  Search,
  Filter,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  MapPin,
  Bell,
  BellRing,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { UmzugsboxModal, UmzugsboxRental } from "@/components/firma/UmzugsboxModal";
import { generateBoxRentalPdf } from "@/lib/generateBoxRentalPdf";

interface CompanyForPdf {
  id: string;
  company_name: string;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  phone?: string | null;
  email: string;
  website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  color_code: string;
}

// Helper function to calculate total box quantity from box_items
const getTotalBoxQuantity = (rental: UmzugsboxRental): number => {
  if (rental.box_items && Array.isArray(rental.box_items)) {
    return rental.box_items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }
  // Fallback to legacy box_quantity
  return rental.box_quantity || 0;
};

// Helper function to format box items for display
const formatBoxItems = (rental: UmzugsboxRental): string => {
  if (rental.box_items && Array.isArray(rental.box_items) && rental.box_items.length > 0) {
    const boxTypes = [
      { value: "standard", label: "Standard" },
      { value: "wardrobe", label: "Kleider" },
      { value: "book", label: "Bücher" },
      { value: "fragile", label: "Fragile" },
      { value: "archive", label: "Archiv" },
      { value: "other", label: "Andere" },
    ];
    
    return rental.box_items
      .map(item => {
        const typeLabel = boxTypes.find(t => t.value === item.type)?.label || item.type;
        return `${item.quantity}x ${typeLabel}`;
      })
      .join(", ");
  }
  // Fallback to legacy format
  if (rental.box_quantity) {
    return `${rental.box_quantity}x ${rental.box_type || "Standard"}`;
  }
  return "-";
};

interface BoxStats {
  total_active: number;
  overdue: number;
  pickup_today: number;
  pickup_this_week: number;
  total_boxes_out: number;
}

const statusOptions = [
  { value: "reserved", label: "Reserviert", color: "bg-blue-500", textColor: "text-blue-700" },
  { value: "delivered", label: "Geliefert", color: "bg-green-500", textColor: "text-green-700" },
  { value: "in_use", label: "In Gebrauch", color: "bg-yellow-500", textColor: "text-yellow-700" },
  { value: "pickup_requested", label: "Abholung angefragt", color: "bg-orange-500", textColor: "text-orange-700" },
  { value: "pickup_scheduled", label: "Abholung geplant", color: "bg-purple-500", textColor: "text-purple-700" },
  { value: "returned", label: "Zurückgegeben", color: "bg-gray-500", textColor: "text-gray-700" },
  { value: "lost", label: "Verloren", color: "bg-red-500", textColor: "text-red-700" },
  { value: "damaged", label: "Beschädigt", color: "bg-red-300", textColor: "text-red-700" },
];

export default function Umzugsboxen() {
  const { company } = useCachedCompany();
  const [rentals, setRentals] = useState<UmzugsboxRental[]>([]);
  const [historyRentals, setHistoryRentals] = useState<UmzugsboxRental[]>([]); // FIX: Separate state for history
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<BoxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<UmzugsboxRental | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rentalToDelete, setRentalToDelete] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);

    try {
      // Fetch rentals (exclude archived boxes)
      let query = supabase
        .from("umzugsbox_rentals")
        .select("*")
        .eq("company_id", company.id)
        .is("archived_at", null) // Only show non-archived boxes
        .order("expected_return_date", { ascending: true, nullsFirst: false });

      // Apply status filter
      if (statusFilter === "active") {
        query = query.in("status", ["reserved", "delivered", "in_use", "pickup_requested", "pickup_scheduled"]);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: rentalsData, error: rentalsError } = await query;

      if (rentalsError) throw rentalsError;
      setRentals(rentalsData as UmzugsboxRental[] || []);

      // FIX: Fetch history rentals separately (returned, lost, damaged)
      const { data: historyData, error: historyError } = await supabase
        .from("umzugsbox_rentals")
        .select("*")
        .eq("company_id", company.id)
        .in("status", ["returned", "lost", "damaged"])
        .is("archived_at", null)
        .order("actual_return_date", { ascending: false, nullsFirst: false })
        .limit(50); // Limit history to recent 50 entries

      if (!historyError && historyData) {
        setHistoryRentals(historyData as UmzugsboxRental[]);
      }

      // Fetch team members
      const { data: teamData } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, color_code")
        .eq("company_id", company.id)
        .eq("is_active", true);

      if (teamData) setTeamMembers(teamData);

      // Fetch stats using RPC
      const { data: statsData } = await supabase
        .rpc("get_box_rental_stats", { p_company_id: company.id });

      if (statsData && statsData.length > 0) {
        setStats(statsData[0] as BoxStats);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [company?.id, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered rentals
  const filteredRentals = useMemo(() => {
    if (!searchTerm) return rentals;
    const term = searchTerm.toLowerCase();
    return rentals.filter(
      (r) =>
        r.customer_first_name.toLowerCase().includes(term) ||
        r.customer_last_name.toLowerCase().includes(term) ||
        r.delivery_city?.toLowerCase().includes(term) ||
        r.customer_phone?.includes(term)
    );
  }, [rentals, searchTerm]);

  // Urgent rentals (overdue or due today)
  const urgentRentals = useMemo(() => {
    return rentals.filter((r) => {
      if (!r.expected_return_date) return false;
      if (["returned", "lost", "damaged"].includes(r.status)) return false;
      const daysUntil = differenceInDays(new Date(r.expected_return_date), new Date());
      return daysUntil <= 0;
    });
  }, [rentals]);

  // Due this week
  const dueThisWeek = useMemo(() => {
    return rentals.filter((r) => {
      if (!r.expected_return_date) return false;
      if (["returned", "lost", "damaged"].includes(r.status)) return false;
      const daysUntil = differenceInDays(new Date(r.expected_return_date), new Date());
      return daysUntil > 0 && daysUntil <= 7;
    });
  }, [rentals]);

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find((s) => s.value === status);
    if (!opt) return null;
    return (
      <Badge className={`${opt.color} text-white`}>
        {opt.label}
      </Badge>
    );
  };

  const getUrgencyIndicator = (rental: UmzugsboxRental) => {
    if (!rental.expected_return_date) return null;
    if (["returned", "lost", "damaged"].includes(rental.status)) return null;

    const daysUntil = differenceInDays(new Date(rental.expected_return_date), new Date());

    if (daysUntil < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-medium">{Math.abs(daysUntil)} Tage überfällig</span>
        </div>
      );
    }
    if (daysUntil === 0) {
      return (
        <div className="flex items-center gap-1 text-orange-600">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium">Heute fällig</span>
        </div>
      );
    }
    if (daysUntil <= 3) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <Bell className="w-4 h-4" />
          <span className="text-xs font-medium">In {daysUntil} Tagen</span>
        </div>
      );
    }
    return null;
  };

  const getTeamMemberName = (memberId: string | null) => {
    if (!memberId) return "-";
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return "-";
    return (
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: member.color_code }}
        />
        <span>{member.first_name} {member.last_name}</span>
      </div>
    );
  };

  const handleQuickStatusChange = async (rentalId: string, newStatus: string) => {
    try {
      const updatePayload: Record<string, unknown> = { status: newStatus };
      
      // Set actual return date if returned
      if (newStatus === "returned") {
        updatePayload.actual_return_date = format(new Date(), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("umzugsbox_rentals")
        .update(updatePayload)
        .eq("id", rentalId);

      if (error) throw error;
      toast.success("Status aktualisiert");
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDelete = async () => {
    if (!rentalToDelete) return;
    try {
      const { error } = await supabase
        .from("umzugsbox_rentals")
        .delete()
        .eq("id", rentalToDelete);

      if (error) throw error;
      toast.success("Eintrag gelöscht");
      fetchData();
    } catch (error) {
      console.error("Error deleting rental:", error);
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleteDialogOpen(false);
      setRentalToDelete(null);
    }
  };

  const handleEdit = (rental: UmzugsboxRental) => {
    setSelectedRental(rental);
    setModalOpen(true);
  };

  const handleDownloadPdf = async (rental: UmzugsboxRental) => {
    if (!company?.id) {
      toast.error("Firmendaten nicht verfügbar");
      return;
    }

    try {
      toast.info("PDF wird erstellt...");
      
      // Fetch full company data for PDF
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, company_name, street, house_number, plz, city, phone, email, website, logo_url, primary_color")
        .eq("id", company.id)
        .single();

      if (companyError || !companyData) {
        throw new Error("Firmendaten konnten nicht geladen werden");
      }

      const fullCompany = companyData as CompanyForPdf;
      
      await generateBoxRentalPdf({
        ...rental,
        company: {
          company_name: fullCompany.company_name,
          street: fullCompany.street,
          house_number: fullCompany.house_number,
          plz: fullCompany.plz,
          city: fullCompany.city,
          phone: fullCompany.phone,
          email: fullCompany.email,
          website: fullCompany.website,
          logo_url: fullCompany.logo_url,
          primary_color: fullCompany.primary_color,
        },
      });
      
      toast.success("PDF wurde heruntergeladen");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Fehler beim Erstellen des PDFs");
    }
  };

  const handleNew = () => {
    setSelectedRental(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedRental(null);
  };

  const handleModalSaved = () => {
    handleModalClose();
    fetchData();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Folk-style header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📦</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Umzugsboxen</h1>
              <span className="text-[13px] text-folk-ink3 whitespace-nowrap">
                <span className="font-mono">{stats?.total_active || 0}</span> aktiv · <span className="font-mono">{stats?.overdue || 0}</span> überfällig · <span className="font-mono">{stats?.total_boxes_out || 0}</span> im Umlauf
              </span>
            </div>
            <p className="mt-1 text-[13px] text-folk-ink2">
              Mietboxen verwalten und Abholungen planen.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={fetchData}
              className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[13px] font-medium text-folk-ink2 hover:bg-folk-bg-warm hover:text-folk-ink2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aktualisieren</span>
            </Button>
            <Button
              onClick={handleNew}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[13px] font-semibold text-white hover:bg-folk-ink2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Neue Vermietung</span>
            </Button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {[
            { emoji: '📦', label: 'Aktiv',          value: stats?.total_active || 0,       highlight: false },
            { emoji: '⚠️', label: 'Überfällig',    value: stats?.overdue || 0,            highlight: (stats?.overdue || 0) > 0 },
            { emoji: '🚛', label: 'Heute abholen', value: stats?.pickup_today || 0,       highlight: false },
            { emoji: '📅', label: 'Diese Woche',   value: stats?.pickup_this_week || 0,   highlight: false },
            { emoji: '🚚', label: 'Im Umlauf',     value: stats?.total_boxes_out || 0,    highlight: false },
          ].map((tile) => (
            <div
              key={tile.label}
              className={`rounded-xl border bg-folk-card p-4 md:p-5 ${
                tile.highlight ? 'border-folk-coral/30 ring-1 ring-folk-coral/20' : 'border-folk-line'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                <span className="text-xl leading-none">{tile.emoji}</span>
              </div>
              <div className={`mt-3 font-sans text-3xl font-bold tracking-tight ${tile.highlight ? 'text-folk-coral' : 'text-folk-ink'}`}>{tile.value}</div>
            </div>
          ))}
        </div>

        {/* Urgent Alerts */}
        {urgentRentals.length > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <BellRing className="w-5 h-5" />
                Dringende Abholungen ({urgentRentals.length})
              </CardTitle>
              <CardDescription className="text-red-600">
                Diese Boxen sind überfällig oder heute zur Rückgabe fällig
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {urgentRentals.slice(0, 5).map((rental) => (
                  <div
                    key={rental.id}
                    className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-red-200 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="font-medium">
                          {rental.customer_first_name} {rental.customer_last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getTotalBoxQuantity(rental)} Boxen • {rental.delivery_city}
                        </p>
                        <div className="mt-1">{getUrgencyIndicator(rental)}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {rental.customer_phone && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={`tel:${rental.customer_phone}`}>
                            <Phone className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rental)}>
                        Bearbeiten
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickStatusChange(rental.id, "pickup_scheduled")}
                      >
                        Abholung planen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="due-soon" className="relative">
              Bald fällig
              {dueThisWeek.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs justify-center">
                  {dueThisWeek.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Verlauf</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Suchen nach Name, Ort, Telefon..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktive Vermietungen</SelectItem>
                      <SelectItem value="all">Alle anzeigen</SelectItem>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Boxen</TableHead>
                      <TableHead>Ort</TableHead>
                      <TableHead>Lieferdatum</TableHead>
                      <TableHead className="whitespace-nowrap">Rückgabe fällig</TableHead>
                      <TableHead>Zuständig</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Lade Daten...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredRentals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Keine Einträge gefunden
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRentals.map((rental) => (
                        <TableRow key={rental.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {rental.customer_first_name} {rental.customer_last_name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {rental.customer_phone && (
                                  <a href={`tel:${rental.customer_phone}`} className="flex items-center gap-1 hover:text-foreground">
                                    <Phone className="w-3 h-3" />
                                    {rental.customer_phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{getTotalBoxQuantity(rental)}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatBoxItems(rental)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {rental.delivery_city || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(rental.delivery_date), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {rental.expected_return_date ? (
                                <>
                                  <p>{format(new Date(rental.expected_return_date), "dd.MM.yyyy", { locale: de })}</p>
                                  {getUrgencyIndicator(rental)}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getTeamMemberName(rental.assigned_team_member_id)}</TableCell>
                          <TableCell>{getStatusBadge(rental.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(rental)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPdf(rental)}>
                                  <FileDown className="w-4 h-4 mr-2" />
                                  PDF herunterladen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleQuickStatusChange(rental.id, "pickup_scheduled")}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Abholung planen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickStatusChange(rental.id, "returned")}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Als zurückgegeben markieren
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setRentalToDelete(rental.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="due-soon" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Diese Woche fällig</CardTitle>
                <CardDescription>
                  Boxen, die in den nächsten 7 Tagen zurückgegeben werden sollten
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dueThisWeek.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Keine Boxen diese Woche fällig
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dueThisWeek.map((rental) => (
                      <div
                        key={rental.id}
                        className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {rental.customer_first_name} {rental.customer_last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getTotalBoxQuantity(rental)} Boxen • {rental.delivery_city}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                          {rental.expected_return_date && (
                            <div className="text-left sm:text-right">
                              <p className="font-medium">
                                {format(new Date(rental.expected_return_date), "dd.MM.yyyy", { locale: de })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                In {differenceInDays(new Date(rental.expected_return_date), new Date())} Tagen
                              </p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {rental.customer_phone && (
                              <Button variant="outline" size="icon" asChild>
                                <a href={`tel:${rental.customer_phone}`}>
                                  <Phone className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            {rental.customer_email && (
                              <Button variant="outline" size="icon" asChild>
                                <a href={`mailto:${rental.customer_email}`}>
                                  <Mail className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button onClick={() => handleEdit(rental)}>
                              Bearbeiten
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verlauf</CardTitle>
                <CardDescription>
                  Zurückgegebene und abgeschlossene Vermietungen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Boxen</TableHead>
                      <TableHead className="whitespace-nowrap">Geliefert</TableHead>
                      <TableHead className="whitespace-nowrap">Zurückgegeben</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRentals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Keine abgeschlossenen Vermietungen
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyRentals.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell>
                            {rental.customer_first_name} {rental.customer_last_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{getTotalBoxQuantity(rental)}</span>
                              <span className="text-xs text-muted-foreground">{formatBoxItems(rental)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(rental.delivery_date), "dd.MM.yyyy", { locale: de })}
                          </TableCell>
                          <TableCell>
                            {rental.actual_return_date
                              ? format(new Date(rental.actual_return_date), "dd.MM.yyyy", { locale: de })
                              : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(rental.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal */}
      <UmzugsboxModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        rental={selectedRental}
        companyId={company?.id || null}
        onSaved={handleModalSaved}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

