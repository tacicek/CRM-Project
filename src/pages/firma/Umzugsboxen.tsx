import { useState, useEffect, useMemo, useCallback } from "react";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import FirmaLayout from "@/components/firma/FirmaLayout";
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
  Truck,
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
    <FirmaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-orange-500" />
              Umzugsboxen-Verwaltung
            </h1>
            <p className="text-muted-foreground">
              Verwalten Sie Mietboxen und planen Sie Abholungen
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              Neue Box-Vermietung
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Aktive Vermietungen</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {stats?.total_active || 0}
                  </p>
                </div>
                <Package className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400">Überfällig</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {stats?.overdue || 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Heute abholen</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {stats?.pickup_today || 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">Diese Woche</p>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    {stats?.pickup_this_week || 0}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400">Boxen im Umlauf</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {stats?.total_boxes_out || 0}
                  </p>
                </div>
                <Truck className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Urgent Alerts */}
        {urgentRentals.length > 0 && (
          <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <BellRing className="w-5 h-5" />
                Dringende Abholungen ({urgentRentals.length})
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                Diese Boxen sind überfällig oder heute zur Rückgabe fällig
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {urgentRentals.slice(0, 5).map((rental) => (
                  <div
                    key={rental.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {rental.customer_first_name} {rental.customer_last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getTotalBoxQuantity(rental)} Boxen • {rental.delivery_city}
                        </p>
                      </div>
                      {getUrgencyIndicator(rental)}
                    </div>
                    <div className="flex items-center gap-2">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Boxen</TableHead>
                      <TableHead>Ort</TableHead>
                      <TableHead>Lieferdatum</TableHead>
                      <TableHead>Rückgabe fällig</TableHead>
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
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
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
                        <div className="flex items-center gap-4">
                          {rental.expected_return_date && (
                            <div className="text-right">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Boxen</TableHead>
                      <TableHead>Geliefert</TableHead>
                      <TableHead>Zurückgegeben</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* FIX: Use historyRentals instead of filtering from rentals */}
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
    </FirmaLayout>
  );
}

