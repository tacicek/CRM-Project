import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { getCachedCompany } from "@/hooks/useCachedCompany";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Eye,
  Calendar,
  Clock,
  Phone,
  Mail,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  CalendarCheck,
  CalendarX,
  Sparkles,
  FileText,
  ExternalLink,
  Bell,
  Hourglass,
  Edit2,
  Camera,
  Image,
  Copy,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, differenceInHours } from "date-fns";
import { de } from "date-fns/locale";
import { AcceptBesichtigungDialog } from "@/components/firma/AcceptBesichtigungDialog";
import { AppointmentModal } from "@/components/firma/AppointmentModal";
import { CreateVirtualBesichtigungDialog } from "@/components/firma/CreateVirtualBesichtigungDialog";
import { BesichtigungAnalysisView } from "@/components/firma/BesichtigungAnalysisView";

interface BesichtigungRequest {
  id: string;
  notification_id: string;
  offer_id: string;
  title: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  besichtigung_date: string;
  besichtigung_time: string | null;
  customer_note: string | null;
  created_at: string;
  read: boolean;
}

interface ConfirmedBesichtigung {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  title: string;
  status: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  location_address: string | null;
  location_city: string | null;
  location_plz: string | null;
  offer_id: string | null;
  lead_id?: string | null;
  confirmed_by_customer: boolean | null;
  confirmed_by_firma: boolean | null;
  confirmed_at?: string | null;
  completed_at?: string | null;
  created_at: string | null;
  internal_notes: string | null;
  description?: string | null;
  duration_minutes?: number | null;
}

const FirmaBesichtigungen = () => {
  // Use cached company ID for instant page load - no database call needed
  const cachedCompany = getCachedCompany();
  const companyId = cachedCompany?.id || null;
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  
  const [pendingRequests, setPendingRequests] = useState<BesichtigungRequest[]>([]);
  const [confirmedBesichtigungen, setConfirmedBesichtigungen] = useState<ConfirmedBesichtigung[]>([]);
  const [completedBesichtigungen, setCompletedBesichtigungen] = useState<ConfirmedBesichtigung[]>([]);
  const [cancelledBesichtigungen, setCancelledBesichtigungen] = useState<ConfirmedBesichtigung[]>([]);
  
  const [selectedRequest, setSelectedRequest] = useState<BesichtigungRequest | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<ConfirmedBesichtigung | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<ConfirmedBesichtigung | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isVirtualBesichtigungOpen, setIsVirtualBesichtigungOpen] = useState(false);

  // Virtual Besichtigung sessions state
  interface VirtualSession {
    id: string;
    token: string;
    status: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    from_address: string | null;
    from_plz: string | null;
    from_city: string | null;
    expires_at: string;
    created_at: string;
    uploaded_at: string | null;
    customer_notes: string | null;
    photo_count: number;
    photos: Array<{
      id: string;
      room_type: string;
      filename: string;
      storage_path: string;
      uploaded_at: string;
    }>;
  }
  const [virtualSessions, setVirtualSessions] = useState<VirtualSession[]>([]);
  const [selectedVirtualSession, setSelectedVirtualSession] = useState<VirtualSession | null>(null);
  const [isVirtualDetailOpen, setIsVirtualDetailOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // Company ID is loaded from cache - no useEffect needed for company fetch

  // FIX: Added isMounted flag to prevent memory leaks from async operations
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!companyId) return;
      setLoading(true);
      
      try {
        // Fetch virtual besichtigung sessions via RPC
        try {
          const { data: sessionsRaw, error: sessionsError } = await supabase
            .rpc("get_company_besichtigung_sessions" as never, { p_company_id: companyId } as never);

          if (!sessionsError && sessionsRaw && isMounted) {
            // RPC returns JSON - may be parsed as array or still be a JSON string
            const parsed = typeof sessionsRaw === "string" ? JSON.parse(sessionsRaw) : sessionsRaw;
            if (Array.isArray(parsed)) {
              setVirtualSessions(parsed as VirtualSession[]);
            }
          }
        } catch (rpcErr) {
          // RPC function may not exist yet - silently skip
          console.warn("Virtual besichtigung RPC not available:", rpcErr);
        }

        // Fetch pending besichtigung requests from notifications table
        const { data: notifications } = await supabase
          .from("notifications")
          .select("id, type, title, body, metadata, created_at, read")
          .eq("company_id", companyId)
          .eq("type", "besichtigung_request")
          .order("created_at", { ascending: false });

        // Get appointments to filter out already scheduled ones
        const { data: appointmentsForOffers } = await supabase
          .from("appointments")
          .select("offer_id")
          .eq("company_id", companyId)
          .eq("appointment_type", "besichtigung")
          .neq("status", "cancelled");

        // Only update state if component is still mounted
        if (!isMounted) return;

        const confirmedOfferIds = new Set(
          appointmentsForOffers?.map(a => a.offer_id).filter(Boolean) || []
        );
        
        // Transform notifications to BesichtigungRequest format
        const pendingFromNotifications = (notifications || [])
          .filter(n => {
            const metadata = n.metadata as Record<string, unknown> | null;
            const offerId = metadata?.offer_id as string;
            return !confirmedOfferIds.has(offerId);
          })
          .map(n => {
            const metadata = n.metadata as Record<string, unknown> | null;
            return {
              id: metadata?.offer_id as string || n.id,
              notification_id: n.id,
              offer_id: metadata?.offer_id as string || "",
              title: metadata?.offer_title as string || "Besichtigung",
              customer_name: metadata?.customer_name as string || "",
              customer_email: metadata?.customer_email as string || "",
              customer_phone: metadata?.customer_phone as string || null,
              besichtigung_date: metadata?.besichtigung_date as string || "",
              besichtigung_time: metadata?.besichtigung_time as string || null,
              customer_note: metadata?.customer_note as string || null,
              created_at: n.created_at,
              read: n.read || false,
            };
          });

        setPendingRequests(pendingFromNotifications);

        // Fetch all besichtigung appointments
        const { data: allAppointments } = await supabase
          .from("appointments")
          .select("*")
          .eq("company_id", companyId)
          .eq("appointment_type", "besichtigung")
          .order("appointment_date", { ascending: true });

        if (!isMounted) return;

        if (allAppointments) {
          const now = new Date();
          const today = format(now, "yyyy-MM-dd");
          
          // Confirmed (upcoming)
          const confirmed = allAppointments.filter(a => 
            a.status === "confirmed" || a.status === "pending"
          ).filter(a => a.appointment_date >= today);
          
          // Completed
          const completed = allAppointments.filter(a => 
            a.status === "completed" || 
            (a.status === "confirmed" && a.appointment_date < today)
          );
          
          // Cancelled
          const cancelled = allAppointments.filter(a => a.status === "cancelled");
          
          setConfirmedBesichtigungen(confirmed as ConfirmedBesichtigung[]);
          setCompletedBesichtigungen(completed as ConfirmedBesichtigung[]);
          setCancelledBesichtigungen(cancelled as ConfirmedBesichtigung[]);
        }
      } catch (error) {
        console.error("Error fetching besichtigungen:", error);
        if (isMounted) {
          toast.error("Fehler beim Laden der Besichtigungen");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [companyId]);

  // Keep fetchData callable for refresh purposes
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    try {
      // Refresh virtual sessions
      try {
        const { data: sessionsRaw, error: sessionsError } = await supabase
          .rpc("get_company_besichtigung_sessions" as never, { p_company_id: companyId } as never);
        if (!sessionsError && sessionsRaw) {
          const parsed = typeof sessionsRaw === "string" ? JSON.parse(sessionsRaw) : sessionsRaw;
          if (Array.isArray(parsed)) {
            setVirtualSessions(parsed as VirtualSession[]);
          }
        }
      } catch (rpcErr) {
        console.warn("Virtual besichtigung RPC not available:", rpcErr);
      }

      const { data: notifications } = await supabase
        .from("notifications")
        .select("id, type, title, body, metadata, created_at, read")
        .eq("company_id", companyId)
        .eq("type", "besichtigung_request")
        .order("created_at", { ascending: false });

      const { data: appointmentsForOffers } = await supabase
        .from("appointments")
        .select("offer_id")
        .eq("company_id", companyId)
        .eq("appointment_type", "besichtigung")
        .neq("status", "cancelled");

      const confirmedOfferIds = new Set(
        appointmentsForOffers?.map(a => a.offer_id).filter(Boolean) || []
      );
      
      const pendingFromNotifications = (notifications || [])
        .filter(n => {
          const metadata = n.metadata as Record<string, unknown> | null;
          const offerId = metadata?.offer_id as string;
          return !confirmedOfferIds.has(offerId);
        })
        .map(n => {
          const metadata = n.metadata as Record<string, unknown> | null;
          return {
            id: metadata?.offer_id as string || n.id,
            notification_id: n.id,
            offer_id: metadata?.offer_id as string || "",
            title: metadata?.offer_title as string || "Besichtigung",
            customer_name: metadata?.customer_name as string || "",
            customer_email: metadata?.customer_email as string || "",
            customer_phone: metadata?.customer_phone as string || null,
            besichtigung_date: metadata?.besichtigung_date as string || "",
            besichtigung_time: metadata?.besichtigung_time as string || null,
            customer_note: metadata?.customer_note as string || null,
            created_at: n.created_at,
            read: n.read || false,
          };
        });

      setPendingRequests(pendingFromNotifications);

      const { data: allAppointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", companyId)
        .eq("appointment_type", "besichtigung")
        .order("appointment_date", { ascending: true });

      if (allAppointments) {
        const now = new Date();
        const today = format(now, "yyyy-MM-dd");
        
        const confirmed = allAppointments.filter(a => 
          a.status === "confirmed" || a.status === "pending"
        ).filter(a => a.appointment_date >= today);
        
        const completed = allAppointments.filter(a => 
          a.status === "completed" || 
          (a.status === "confirmed" && a.appointment_date < today)
        );
        
        const cancelled = allAppointments.filter(a => a.status === "cancelled");
        
        setConfirmedBesichtigungen(confirmed as ConfirmedBesichtigung[]);
        setCompletedBesichtigungen(completed as ConfirmedBesichtigung[]);
        setCancelledBesichtigungen(cancelled as ConfirmedBesichtigung[]);
      }
    } catch (error) {
      console.error("Error fetching besichtigungen:", error);
      toast.error("Fehler beim Laden der Besichtigungen");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // FIX: Single transformation function to avoid duplicate code
  const transformToDialogRequest = (request: BesichtigungRequest | null) => {
    if (!request) return null;
    return {
      id: request.offer_id,
      title: request.title,
      customer_first_name: request.customer_name.split(" ")[0] || "",
      customer_last_name: request.customer_name.split(" ").slice(1).join(" ") || "",
      customer_email: request.customer_email,
      customer_phone: request.customer_phone,
      customer_response_note: `Besichtigung gewünscht am ${request.besichtigung_date ? new Date(request.besichtigung_date).toLocaleDateString("de-CH") : ""}${request.besichtigung_time ? ` um ${request.besichtigung_time} Uhr` : ""}${request.customer_note ? `. ${request.customer_note}` : ""}`,
    };
  };

  const handleAcceptClick = (request: BesichtigungRequest) => {
    setSelectedRequest(request);
    setIsAcceptDialogOpen(true);
  };

  const handleSuccess = () => {
    setIsAcceptDialogOpen(false);
    setSelectedRequest(null);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = parseISO(dateString);
    return format(date, "dd.MM.yyyy", { locale: de });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    return timeString.slice(0, 5);
  };

  const formatRelativeDate = (dateString: string) => {
    if (!dateString) return "";
    const date = parseISO(dateString);
    if (isToday(date)) return "Heute";
    if (isTomorrow(date)) return "Morgen";
    return format(date, "EEEE, dd. MMMM", { locale: de });
  };

  const getRequestAge = (createdAt: string) => {
    const hours = differenceInHours(new Date(), parseISO(createdAt));
    if (hours < 1) return "Gerade eben";
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  };

  const isNewRequest = (createdAt: string) => {
    const hours = differenceInHours(new Date(), parseISO(createdAt));
    return hours < 24;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Ausstehend",
          icon: Hourglass,
          color: "from-amber-500 to-orange-500",
          bgColor: "bg-amber-50",
          textColor: "text-amber-700",
          borderColor: "border-amber-200",
        };
      case "confirmed":
        return {
          label: "Bestätigt",
          icon: CheckCircle,
          color: "from-emerald-500 to-green-500",
          bgColor: "bg-emerald-50",
          textColor: "text-emerald-700",
          borderColor: "border-emerald-200",
        };
      case "completed":
        return {
          label: "Abgeschlossen",
          icon: CalendarCheck,
          color: "from-blue-500 to-indigo-500",
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          borderColor: "border-blue-200",
        };
      case "cancelled":
        return {
          label: "Abgesagt",
          icon: CalendarX,
          color: "from-slate-400 to-slate-500",
          bgColor: "bg-slate-50",
          textColor: "text-slate-600",
          borderColor: "border-slate-200",
        };
      default:
        return {
          label: status,
          icon: Calendar,
          color: "from-gray-500 to-gray-600",
          bgColor: "bg-gray-50",
          textColor: "text-gray-700",
          borderColor: "border-gray-200",
        };
    }
  };

  const filterPendingItems = (items: BesichtigungRequest[]): BesichtigungRequest[] => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.title?.toLowerCase().includes(term) ||
      item.customer_name?.toLowerCase().includes(term) ||
      item.customer_email?.toLowerCase().includes(term)
    );
  };
  
  const filterAppointments = (items: ConfirmedBesichtigung[]): ConfirmedBesichtigung[] => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.title?.toLowerCase().includes(term) ||
      item.customer_first_name?.toLowerCase().includes(term) ||
      item.customer_last_name?.toLowerCase().includes(term)
    );
  };

  const filteredPending = filterPendingItems(pendingRequests);
  const filteredConfirmed = filterAppointments(confirmedBesichtigungen);
  const filteredCompleted = filterAppointments(completedBesichtigungen);
  const filteredCancelled = filterAppointments(cancelledBesichtigungen);

  // Exclude expired sessions from display and count
  const activeVirtualSessions = virtualSessions.filter(
    s => new Date(s.expires_at) >= new Date()
  );

  const totalPending = pendingRequests.length;
  const totalConfirmed = confirmedBesichtigungen.length;
  const totalCompleted = completedBesichtigungen.length;
  const totalCancelled = cancelledBesichtigungen.length;
  const newRequestsCount = pendingRequests.filter(r => !r.read || isNewRequest(r.created_at)).length;

  if (loading && !pendingRequests.length) {
    return (
      <>
        <Helmet>
          <title>Besichtigungen | Firma</title>
        </Helmet>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Besichtigungen | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">🔎</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Besichtigungen</h1>
                {newRequestsCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-folk-coral-bg px-2 py-0.5 text-[13px] font-semibold text-folk-coral">
                    <Bell className="h-3 w-3" />
                    <span className="font-mono">{newRequestsCount}</span> neu
                  </span>
                )}
              </div>
              <p className="mt-1 text-[15px] text-folk-ink2">
                Terminanfragen und geplante Besichtigungen verwalten — vor Ort und virtuell.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setIsVirtualBesichtigungOpen(true)}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Virtuelle Besichtigung</span>
                <span className="sm:hidden">Virtuell</span>
              </Button>
              <Link to="/firma/kalender">
                <Button
                  className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Kalender öffnen
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            {[
              { key: 'pending',   emoji: '📬', label: 'Anfragen',     value: totalPending,                                           badge: newRequestsCount, highlight: newRequestsCount > 0 },
              { key: 'confirmed', emoji: '📅', label: 'Geplant',      value: totalConfirmed,                                         badge: 0, highlight: false },
              { key: 'virtual',   emoji: '📷', label: 'Virtuell',     value: activeVirtualSessions.length,                           badge: activeVirtualSessions.filter(s => s.status === 'uploaded').length, highlight: false },
              { key: 'completed', emoji: '✅', label: 'Abgeschlossen', value: totalCompleted,                                         badge: 0, highlight: false },
              { key: 'cancelled', emoji: '❌', label: 'Abgesagt',     value: totalCancelled,                                         badge: 0, highlight: false },
            ].map((tile) => {
              const isActive = activeTab === tile.key;
              return (
                <button
                  key={tile.key}
                  onClick={() => setActiveTab(tile.key)}
                  className={`group relative overflow-hidden rounded-xl border bg-folk-card p-3 text-left transition-all sm:p-4 ${
                    isActive ? 'border-folk-coral/30 ring-1 ring-folk-coral/20' : tile.highlight ? 'border-folk-coral/30' : 'border-folk-line'
                  } hover:border-folk-ink5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                    <span className="text-lg leading-none">{tile.emoji}</span>
                  </div>
                  <div className="mt-2 font-sans text-2xl font-bold tracking-tight text-folk-ink sm:text-3xl">
                    {tile.value}
                  </div>
                  {tile.badge > 0 && (
                    <span className="mt-1.5 inline-flex items-center rounded-md bg-folk-coral-bg px-1.5 py-0.5 text-[10px] font-semibold text-folk-coral">
                      <span className="font-mono">{tile.badge}</span> neu
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search and Filter Bar */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Nach Kunde oder Titel suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 h-auto p-1.5 bg-muted/50">
              <TabsTrigger value="pending" className="gap-1.5 py-2.5 data-[state=active]:shadow-md text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Anfragen</span>
                {totalPending > 0 && (
                  <Badge variant="secondary" className="ml-1">{totalPending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="gap-1.5 py-2.5 data-[state=active]:shadow-md text-xs sm:text-sm">
                <CalendarCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Geplant</span>
                {totalConfirmed > 0 && (
                  <Badge variant="secondary" className="ml-1">{totalConfirmed}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="virtual" className="gap-1.5 py-2.5 data-[state=active]:shadow-md text-xs sm:text-sm">
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Virtuell</span>
                {activeVirtualSessions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{activeVirtualSessions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5 py-2.5 data-[state=active]:shadow-md text-xs sm:text-sm">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Abgeschlossen</span>
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="gap-1.5 py-2.5 data-[state=active]:shadow-md text-xs sm:text-sm">
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Abgesagt</span>
              </TabsTrigger>
            </TabsList>

            {/* Pending Requests */}
            <TabsContent value="pending" className="mt-6">
              {filteredPending.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Eye className="w-10 h-10 text-teal-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Keine Anfragen</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Es gibt momentan keine offenen Besichtigungsanfragen
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredPending.map((request) => {
                    const isNew = !request.read || isNewRequest(request.created_at);
                    const initials = request.customer_name
                      .split(" ")
                      .map(n => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    
                    const formattedDate = request.besichtigung_date 
                      ? format(parseISO(request.besichtigung_date), "dd.MM.yyyy", { locale: de })
                      : "";
                    
                    return (
                      <Card 
                        key={request.notification_id} 
                        className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${
                          isNew 
                            ? 'border-2 border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 animate-pulse-slow' 
                            : 'hover:border-primary/20'
                        }`}
                      >
                        <CardContent className="p-0">
                          <div className="flex flex-col lg:flex-row">
                            {/* Left: Status indicator */}
                            <div className={`w-full lg:w-2 ${isNew ? 'bg-gradient-to-b from-teal-500 to-cyan-500' : 'bg-gradient-to-b from-amber-500 to-orange-500'}`} />
                            
                            {/* Main content */}
                            <div className="flex-1 p-5">
                              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                <div className="space-y-3">
                                  {/* Header with badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isNew && (
                                      <Badge className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-0 gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        NEU
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {getRequestAge(request.created_at)}
                                    </Badge>
                                  </div>
                                  
                                  {/* Customer info */}
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                                      {initials}
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-lg">
                                        {request.customer_name}
                                      </h3>
                                      <p className="text-sm text-muted-foreground">{request.title}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Customer's request note */}
                                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                      <Calendar className="w-4 h-4" />
                                      Kundenwunsch:
                                    </p>
                                    <p className="text-sm text-blue-700 mt-1">
                                      Besichtigung gewünscht am {formattedDate}
                                      {request.besichtigung_time && ` um ${request.besichtigung_time} Uhr`}
                                      {request.customer_note && `. ${request.customer_note}`}
                                    </p>
                                  </div>
                                  
                                  {/* Contact buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    {request.customer_phone && (
                                      <Button variant="outline" size="sm" asChild className="gap-2">
                                        <a href={`tel:${request.customer_phone}`}>
                                          <Phone className="w-4 h-4" />
                                          {request.customer_phone}
                                        </a>
                                      </Button>
                                    )}
                                    {request.customer_email && (
                                      <Button variant="outline" size="sm" asChild className="gap-2">
                                        <a href={`mailto:${request.customer_email}`}>
                                          <Mail className="w-4 h-4" />
                                          {request.customer_email}
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex flex-col gap-2 lg:items-end">
                                  <Button 
                                    onClick={() => handleAcceptClick(request)}
                                    className="gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                                  >
                                    <CalendarCheck className="w-4 h-4" />
                                    Termin bestätigen
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleAcceptClick(request)}
                                    className="gap-2"
                                    title="Termin anpassen und bestätigen"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Termin anpassen
                                  </Button>
                                  {request.offer_id && (
                                    <Button variant="outline" asChild className="gap-2">
                                      <Link to={`/firma/offerten/${request.offer_id}`}>
                                        <FileText className="w-4 h-4" />
                                        Offerte anzeigen
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Confirmed Appointments */}
            <TabsContent value="confirmed" className="mt-6">
              {filteredConfirmed.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                      <CalendarCheck className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Keine geplanten Besichtigungen</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Bestätigen Sie Anfragen, um Besichtigungstermine zu planen
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredConfirmed.map((apt) => {
                    const statusConfig = getStatusConfig(apt.status);
                    const StatusIcon = statusConfig.icon;
                    const isUpcoming = isToday(parseISO(apt.appointment_date)) || isTomorrow(parseISO(apt.appointment_date));
                    
                    return (
                      <Card 
                        key={apt.id} 
                        className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${
                          isUpcoming ? 'border-2 border-emerald-400' : 'hover:border-primary/20'
                        }`}
                      >
                        <CardContent className="p-0">
                          <div className="flex flex-col lg:flex-row">
                            {/* Left: Date display */}
                            <div className={`w-full lg:w-28 bg-gradient-to-br ${statusConfig.color} p-4 flex flex-col items-center justify-center text-white`}>
                              <p className="text-3xl font-bold">{format(parseISO(apt.appointment_date), "dd")}</p>
                              <p className="text-sm uppercase">{format(parseISO(apt.appointment_date), "MMM", { locale: de })}</p>
                              <p className="text-xs opacity-80">{formatTime(apt.start_time)}</p>
                            </div>
                            
                            {/* Main content */}
                            <div className="flex-1 p-5">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="space-y-3">
                                  {/* Header */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border gap-1`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {statusConfig.label}
                                    </Badge>
                                    {isUpcoming && (
                                      <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0">
                                        {formatRelativeDate(apt.appointment_date)}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Title and time */}
                                  <div>
                                    <h3 className="font-semibold text-lg">{apt.title}</h3>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      {formatRelativeDate(apt.appointment_date)} • {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                                    </p>
                                  </div>
                                  
                                  {/* Customer and location */}
                                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                    {apt.customer_first_name && (
                                      <span className="flex items-center gap-1.5">
                                        <User className="w-4 h-4" />
                                        {apt.customer_first_name} {apt.customer_last_name}
                                      </span>
                                    )}
                                    {apt.location_city && (
                                      <span className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4" />
                                        {apt.location_plz} {apt.location_city}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDetails(apt);
                                      setIsDetailsDialogOpen(true);
                                    }}
                                    className="gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Details
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingAppointment(apt);
                                      setIsEditModalOpen(true);
                                    }}
                                    className="gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  {apt.offer_id && (
                                    <Button variant="outline" size="sm" asChild className="gap-2">
                                      <Link to={`/firma/offerten/${apt.offer_id}`}>
                                        <ExternalLink className="w-4 h-4" />
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Completed */}
            <TabsContent value="completed" className="mt-6">
              {filteredCompleted.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Keine abgeschlossenen Besichtigungen</h3>
                    <p className="text-muted-foreground">Abgeschlossene Termine werden hier angezeigt</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCompleted.map((apt) => (
                    <Card key={apt.id} className="hover:shadow-md transition-shadow group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Abgeschlossen
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(apt.appointment_date)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setSelectedDetails(apt);
                                setIsDetailsDialogOpen(true);
                              }}
                              title="Details anzeigen"
                            >
                              <Eye className="w-4 h-4 text-primary" />
                            </Button>
                          </div>
                        </div>
                        <h4 className="font-medium mb-1">{apt.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {apt.customer_first_name} {apt.customer_last_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                        </p>
                        {/* Quick action footer */}
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedDetails(apt);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </Button>
                          {apt.offer_id && (
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                              <Link to={`/firma/offerten/${apt.offer_id}`}>
                                <ExternalLink className="w-3.5 h-3.5" />
                                Offerte
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Cancelled */}
            <TabsContent value="cancelled" className="mt-6">
              {filteredCancelled.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Keine abgesagten Besichtigungen</h3>
                    <p className="text-muted-foreground">Abgesagte Termine werden hier archiviert</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCancelled.map((apt) => (
                    <Card key={apt.id} className="opacity-60 hover:opacity-100 transition-opacity group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="w-3 h-3 mr-1" />
                            Abgesagt
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(apt.appointment_date)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setSelectedDetails(apt);
                                setIsDetailsDialogOpen(true);
                              }}
                              title="Details anzeigen"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        <h4 className="font-medium mb-1 line-through">{apt.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {apt.customer_first_name} {apt.customer_last_name}
                        </p>
                        {/* Quick action footer */}
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedDetails(apt);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Virtual Besichtigungen Tab */}
            <TabsContent value="virtual" className="mt-6">
              {activeVirtualSessions.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Keine virtuellen Besichtigungen</h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-4">
                      Erstellen Sie einen Link, den Sie an Ihren Kunden senden können, um Fotos hochzuladen.
                    </p>
                    <Button
                      className="gap-2"
                      onClick={() => setIsVirtualBesichtigungOpen(true)}
                    >
                      <Camera className="w-4 h-4" />
                      Virtuelle Besichtigung erstellen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeVirtualSessions.map((session) => {
                    const isExpired = new Date(session.expires_at) < new Date();
                    const statusLabel =
                      session.status === "uploaded" ? "Fotos hochgeladen" :
                      session.status === "uploading" ? "Wird hochgeladen..." :
                      isExpired ? "Abgelaufen" :
                      session.status === "pending" ? "Link gesendet" :
                      session.status === "completed" ? "Abgeschlossen" :
                      session.status;

                    const statusColor =
                      session.status === "uploaded" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                      session.status === "uploading" ? "bg-blue-100 text-blue-700 border-blue-200" :
                      isExpired ? "bg-red-100 text-red-700 border-red-200" :
                      session.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                      session.status === "completed" ? "bg-blue-100 text-blue-700 border-blue-200" :
                      "bg-gray-100 text-gray-700 border-gray-200";

                    const initials = session.customer_name
                      .split(" ")
                      .map(n => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <Card 
                        key={session.id} 
                        className="group hover:shadow-md transition-all cursor-pointer border-l-4"
                        style={{
                          borderLeftColor: session.status === "uploaded" ? "#10b981" :
                            session.status === "uploading" ? "#3b82f6" :
                            isExpired ? "#ef4444" :
                            session.status === "pending" ? "#f59e0b" : "#6b7280"
                        }}
                        onClick={() => {
                          setSelectedVirtualSession(session);
                          setIsVirtualDetailOpen(true);
                          // Load public photo URLs (bucket is public, paths contain random tokens)
                          if (session.photos?.length > 0) {
                            const newUrls: Record<string, string> = {};
                            for (const photo of session.photos) {
                              if (photoUrls[photo.id]) continue;
                              const { data } = supabase.storage
                                .from("besichtigung-uploads")
                                .getPublicUrl(photo.storage_path);
                              if (data?.publicUrl) {
                                newUrls[photo.id] = data.publicUrl;
                              }
                            }
                            if (Object.keys(newUrls).length > 0) {
                              setPhotoUrls(prev => ({ ...prev, ...newUrls }));
                            }
                          }
                        }}
                      >
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex items-center justify-between mb-3">
                            <Badge className={`${statusColor} border`}>
                              {session.status === "uploaded" ? <Image className="w-3 h-3 mr-1" /> :
                               session.status === "uploading" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> :
                               isExpired ? <XCircle className="w-3 h-3 mr-1" /> :
                               <Hourglass className="w-3 h-3 mr-1" />}
                              {statusLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(session.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-base truncate">{session.customer_name}</h4>
                              {session.from_city && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {session.from_address ? `${session.from_address}, ` : ""}{session.from_plz} {session.from_city}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Photo count indicator */}
                          {session.photo_count > 0 && (
                            <div className="flex items-center gap-2 mb-3 p-2 bg-emerald-50 rounded-lg">
                              <Image className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-medium text-emerald-700">
                                {session.photo_count} Foto{session.photo_count > 1 ? "s" : ""} hochgeladen
                              </span>
                            </div>
                          )}

                          {/* Contact & Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {session.customer_phone && (
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              >
                                <a href={`tel:${session.customer_phone}`}>
                                  <Phone className="w-3.5 h-3.5" />
                                  Anrufen
                                </a>
                              </Button>
                            )}
                            {session.customer_email && (
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              >
                                <a href={`mailto:${session.customer_email}`}>
                                  <Mail className="w-3.5 h-3.5" />
                                  E-Mail
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 ml-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/besichtigung/${session.token}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link kopiert!");
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Link kopieren
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Virtual Session Detail Dialog */}
        <Dialog open={isVirtualDetailOpen} onOpenChange={setIsVirtualDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-600" />
                Virtuelle Besichtigung
              </DialogTitle>
              <DialogDescription>
                Details und hochgeladene Fotos
              </DialogDescription>
            </DialogHeader>
            {selectedVirtualSession && (
              <div className="space-y-5">
                {/* Customer Info */}
                <div className="flex items-start justify-between gap-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedVirtualSession.customer_name}</h3>
                    {selectedVirtualSession.from_city && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedVirtualSession.from_address ? `${selectedVirtualSession.from_address}, ` : ""}
                        {selectedVirtualSession.from_plz} {selectedVirtualSession.from_city}
                      </p>
                    )}
                  </div>
                  <Badge className={`${
                    selectedVirtualSession.status === "uploaded" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    selectedVirtualSession.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    "bg-gray-100 text-gray-700 border-gray-200"
                  } border`}>
                    {selectedVirtualSession.status === "uploaded" ? "Fotos vorhanden" :
                     selectedVirtualSession.status === "pending" ? "Wartend" :
                     selectedVirtualSession.status === "completed" ? "Abgeschlossen" :
                     selectedVirtualSession.status}
                  </Badge>
                </div>

                {/* Contact */}
                <div className="flex flex-wrap gap-2">
                  {selectedVirtualSession.customer_phone && (
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <a href={`tel:${selectedVirtualSession.customer_phone}`}>
                        <Phone className="w-4 h-4" />
                        {selectedVirtualSession.customer_phone}
                      </a>
                    </Button>
                  )}
                  {selectedVirtualSession.customer_email && (
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <a href={`mailto:${selectedVirtualSession.customer_email}`}>
                        <Mail className="w-4 h-4" />
                        {selectedVirtualSession.customer_email}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const url = `${window.location.origin}/besichtigung/${selectedVirtualSession.token}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Link kopiert!");
                    }}
                  >
                    <Link2 className="w-4 h-4" />
                    Link kopieren
                  </Button>
                </div>

                {/* Customer Notes */}
                {selectedVirtualSession.customer_notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <h4 className="font-medium text-sm text-amber-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Kundennotiz
                    </h4>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">
                      {selectedVirtualSession.customer_notes}
                    </p>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">Erstellt</h4>
                    <p className="text-sm font-medium">
                      {format(parseISO(selectedVirtualSession.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">Gültig bis</h4>
                    <p className={`text-sm font-medium ${new Date(selectedVirtualSession.expires_at) < new Date() ? 'text-red-500' : ''}`}>
                      {format(parseISO(selectedVirtualSession.expires_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                </div>

                {/* Data retention warning */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <span className="text-base shrink-0">⏰</span>
                  <div>
                    <p className="font-medium mb-0.5">Automatische Datenlöschung</p>
                    <p>Fotos und Analysedaten werden <strong>3 Tage nach Versand der Offerte</strong> automatisch gelöscht. Ohne Offerte werden die Daten nach 30 Tagen entfernt.</p>
                  </div>
                </div>

                {/* Photos Grid */}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Hochgeladene Fotos ({selectedVirtualSession.photos?.length || 0})
                  </h4>
                  {selectedVirtualSession.photos && selectedVirtualSession.photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedVirtualSession.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative group rounded-xl overflow-hidden border bg-muted aspect-square"
                        >
                          {photoUrls[photo.id] ? (
                            <a href={photoUrls[photo.id]} target="_blank" rel="noopener noreferrer">
                              <img
                                src={photoUrls[photo.id]}
                                alt={photo.filename}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </a>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {photo.room_type && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1">
                              {photo.room_type}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed">
                      <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Noch keine Fotos hochgeladen</p>
                    </div>
                  )}
                </div>

                {/* AI Analysis Section (modular component) */}
                <div className="border-t pt-5">
                  <BesichtigungAnalysisView
                    sessionId={selectedVirtualSession.id}
                    photoCount={selectedVirtualSession.photo_count || 0}
                    sessionStatus={selectedVirtualSession.status}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Accept Dialog */}
        <AcceptBesichtigungDialog
          isOpen={isAcceptDialogOpen}
          onClose={() => {
            setIsAcceptDialogOpen(false);
            setSelectedRequest(null);
          }}
          request={transformToDialogRequest(selectedRequest)}
          companyId={companyId}
          onSuccess={handleSuccess}
        />

        {/* Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Besichtigung Details
              </DialogTitle>
              <DialogDescription>
                Alle Informationen zur Besichtigung auf einen Blick
              </DialogDescription>
            </DialogHeader>
            {selectedDetails && (
              <div className="space-y-5">
                {/* Title and Status Header */}
                <div className="flex items-start justify-between gap-4 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedDetails.title}</h3>
                    {selectedDetails.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedDetails.description}</p>
                    )}
                  </div>
                  <Badge 
                    className={`${
                      selectedDetails.status === 'completed' 
                        ? 'bg-blue-100 text-blue-700 border-blue-200' 
                        : selectedDetails.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : selectedDetails.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    } border`}
                  >
                    {selectedDetails.status === 'completed' ? 'Abgeschlossen' :
                     selectedDetails.status === 'cancelled' ? 'Abgesagt' :
                     selectedDetails.status === 'confirmed' ? 'Bestätigt' : 'Ausstehend'}
                  </Badge>
                </div>

                {/* Date, Time, Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Termin</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="font-medium">{formatRelativeDate(selectedDetails.appointment_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        <span>{formatTime(selectedDetails.start_time)} - {formatTime(selectedDetails.end_time)}</span>
                        {selectedDetails.duration_minutes && (
                          <span className="text-xs text-muted-foreground">
                            ({selectedDetails.duration_minutes} Min.)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Ort</h4>
                    {selectedDetails.location_city ? (
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-5 h-5 text-primary mt-0.5" />
                          <div>
                            {selectedDetails.location_address && (
                              <p className="font-medium">{selectedDetails.location_address}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {selectedDetails.location_plz} {selectedDetails.location_city}
                            </p>
                          </div>
                        </div>
                        {selectedDetails.location_address && (
                          <Button variant="link" size="sm" className="p-0 h-auto text-xs" asChild>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${selectedDetails.location_address}, ${selectedDetails.location_plz} ${selectedDetails.location_city}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Auf Google Maps öffnen
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Kein Ort angegeben</p>
                    )}
                  </div>
                </div>
                
                {/* Customer Info */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Kunde
                  </h4>
                  <p className="text-lg font-semibold">
                    {selectedDetails.customer_first_name} {selectedDetails.customer_last_name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDetails.customer_phone && (
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <a href={`tel:${selectedDetails.customer_phone}`}>
                          <Phone className="w-4 h-4" />
                          {selectedDetails.customer_phone}
                        </a>
                      </Button>
                    )}
                    {selectedDetails.customer_email && (
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <a href={`mailto:${selectedDetails.customer_email}`}>
                          <Mail className="w-4 h-4" />
                          {selectedDetails.customer_email}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Internal Notes */}
                {selectedDetails.internal_notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <h4 className="font-medium text-sm text-amber-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Interne Notizen
                    </h4>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">
                      {selectedDetails.internal_notes}
                    </p>
                  </div>
                )}
                
                {/* Confirmation Status and Metadata */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t gap-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedDetails.confirmed_by_firma && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Von Ihnen bestätigt
                      </Badge>
                    )}
                    {selectedDetails.confirmed_by_customer && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Vom Kunden bestätigt
                      </Badge>
                    )}
                  </div>
                  {selectedDetails.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Erstellt: {format(parseISO(selectedDetails.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      setEditingAppointment(selectedDetails);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Bearbeiten
                  </Button>
                  {selectedDetails.offer_id && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <Link to={`/firma/offerten/${selectedDetails.offer_id}`}>
                        <FileText className="w-4 h-4" />
                        Offerte anzeigen
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 ml-auto"
                    asChild
                  >
                    <Link to="/firma/kalender">
                      <Calendar className="w-4 h-4" />
                      Im Kalender anzeigen
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Appointment Modal */}
        {companyId && (
          <AppointmentModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingAppointment(null);
            }}
            appointment={editingAppointment ? {
              id: editingAppointment.id,
              company_id: companyId,
              lead_id: editingAppointment.lead_id || null,
              offer_id: editingAppointment.offer_id || null,
              appointment_type: "besichtigung",
              status: editingAppointment.status,
              appointment_date: editingAppointment.appointment_date,
              start_time: editingAppointment.start_time,
              end_time: editingAppointment.end_time,
              all_day: false,
              location_address: editingAppointment.location_address || null,
              location_plz: editingAppointment.location_plz || null,
              location_city: editingAppointment.location_city || null,
              location_notes: null,
              customer_first_name: editingAppointment.customer_first_name || null,
              customer_last_name: editingAppointment.customer_last_name || null,
              customer_email: editingAppointment.customer_email || null,
              customer_phone: editingAppointment.customer_phone || null,
              title: editingAppointment.title,
              description: editingAppointment.description || null,
              internal_notes: editingAppointment.internal_notes || null,
              assigned_team_member_ids: null,
              required_vehicles: null,
              required_equipment: null,
            } : null}
            initialDate={editingAppointment ? new Date(editingAppointment.appointment_date) : null}
            companyId={companyId}
            onSaved={() => {
              fetchData();
              setIsEditModalOpen(false);
              setEditingAppointment(null);
              toast.success("Termin wurde aktualisiert");
            }}
          />
        )}
        
        {/* Virtual Besichtigung Dialog */}
        {companyId && (
          <CreateVirtualBesichtigungDialog
            open={isVirtualBesichtigungOpen}
            onOpenChange={setIsVirtualBesichtigungOpen}
            companyId={companyId}
          />
        )}
    </>
  );
};

export default FirmaBesichtigungen;

