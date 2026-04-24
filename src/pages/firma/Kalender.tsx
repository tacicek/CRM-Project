import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { de } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Eye,
  Truck,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  X,
  CheckCircle,
  XCircle,
  Edit2,
  Users,
  CalendarDays,
  CalendarRange,
  List,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { AppointmentModal } from "@/components/firma/AppointmentModal";
import { TeamWeekView } from "@/components/firma/TeamWeekView";
import { CalendarExportMenu } from "@/components/firma/CalendarExportMenu";
import { CalendarEvent as ICSCalendarEvent } from "@/lib/calendarSync";
import { MobileCalendarNav } from "@/components/firma/MobileCalendarNav";
import { cn } from "@/lib/utils";

const locales = { "de-CH": de };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Create drag-and-drop calendar
const DnDCalendar = withDragAndDrop(Calendar);

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  color_code: string;
  role: string | null;
}

interface Appointment {
  id: string;
  company_id: string;
  lead_id: string | null;
  offer_id: string | null;
  appointment_type: "besichtigung" | "service" | "follow_up" | "meeting" | "blocked";
  status: "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  all_day: boolean;
  location_address: string | null;
  location_plz: string | null;
  location_city: string | null;
  location_notes: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  title: string;
  description: string | null;
  internal_notes: string | null;
  assigned_team_member_ids: string[] | null;
  required_vehicles: string[] | null;
  required_equipment: string[] | null;
  reminder_sent_firma: boolean;
  reminder_sent_customer: boolean;
  confirmed_by_firma: boolean;
  confirmed_by_customer: boolean;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    appointment: Appointment;
    type: string;
    status: string;
    teamMembers: TeamMember[];
  };
}

const typeColors: Record<string, { bg: string; border: string; label: string; icon: typeof Eye; gradient: string }> = {
  besichtigung: { bg: "#8B5CF6", border: "#7C3AED", label: "Besichtigung", icon: Eye, gradient: "from-violet-500 to-purple-500" },
  service: { bg: "#10B981", border: "#059669", label: "Auftrag", icon: Truck, gradient: "from-emerald-500 to-green-500" },
  follow_up: { bg: "#F59E0B", border: "#D97706", label: "Nachkontrolle", icon: Clock, gradient: "from-amber-500 to-orange-500" },
  meeting: { bg: "#3B82F6", border: "#2563EB", label: "Besprechung", icon: Users, gradient: "from-blue-500 to-cyan-500" },
  blocked: { bg: "#6B7280", border: "#4B5563", label: "Blockiert", icon: XCircle, gradient: "from-slate-500 to-slate-600" },
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string; icon: typeof Clock }> = {
  pending: { label: "Ausstehend", color: "text-amber-700", bgColor: "bg-amber-100", textColor: "text-amber-700", icon: Clock },
  confirmed: { label: "Bestätigt", color: "text-emerald-700", bgColor: "bg-emerald-100", textColor: "text-emerald-700", icon: CheckCircle },
  completed: { label: "Erledigt", color: "text-slate-600", bgColor: "bg-slate-100", textColor: "text-slate-600", icon: CheckCircle },
  cancelled: { label: "Abgesagt", color: "text-red-600", bgColor: "bg-red-100", textColor: "text-red-600", icon: XCircle },
  rescheduled: { label: "Verschoben", color: "text-blue-600", bgColor: "bg-blue-100", textColor: "text-blue-600", icon: CalendarIcon },
  no_show: { label: "Nicht erschienen", color: "text-rose-600", bgColor: "bg-rose-100", textColor: "text-rose-600", icon: XCircle },
};

const KalenderPage = () => {
  const { companyId } = useCachedCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [_loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"calendar" | "team">("calendar");
  const [initialLeadId, setInitialLeadId] = useState<string | null>(null);

  const [view, setView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);

  const [filters, setFilters] = useState({
    types: ["besichtigung", "service", "follow_up", "meeting", "blocked"],
    statuses: ["pending", "confirmed"],
    teamMemberIds: [] as string[],
  });

  // Handle URL parameters for creating appointment from lead
  useEffect(() => {
    const newAppointment = searchParams.get("newAppointment");
    const leadId = searchParams.get("leadId");

    if (newAppointment === "true" && companyId) {
      setInitialLeadId(leadId);
      setEditingAppointment(null);
      setModalInitialDate(new Date());
      setIsModalOpen(true);

      // Clear URL parameters
      setSearchParams({});
    }
  }, [searchParams, companyId, setSearchParams]);

  // Company ID loaded from cache - no additional fetch needed

  const fetchAppointments = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", companyId)
        .order("appointment_date", { ascending: true });

      if (error) throw error;
      setAppointments((data as Appointment[]) || []);
    } catch (e) {
      console.error("Error fetching appointments:", e);
      toast.error("Fehler beim Laden der Termine");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchTeamMembers = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, color_code, role")
        .eq("company_id", companyId)
        .eq("is_active", true);

      if (error) throw error;
      setTeamMembers((data as TeamMember[]) || []);
    } catch (e) {
      console.error("Error fetching team members:", e);
    }
  }, [companyId]);

  useEffect(() => {
    fetchAppointments();
    fetchTeamMembers();
  }, [fetchAppointments, fetchTeamMembers]);

  const events: CalendarEvent[] = useMemo(() => {
    return appointments
      .filter((apt) => {
        const typeMatch = filters.types.includes(apt.appointment_type);
        const statusMatch = filters.statuses.includes(apt.status);
        const teamMatch = filters.teamMemberIds.length === 0 ||
          (apt.assigned_team_member_ids?.some(id => filters.teamMemberIds.includes(id)) ?? false);
        return typeMatch && statusMatch && teamMatch;
      })
      .map((apt) => {
        const startDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
        const endDate = new Date(`${apt.appointment_date}T${apt.end_time}`);
        const assignedMembers = teamMembers.filter(tm =>
          apt.assigned_team_member_ids?.includes(tm.id)
        );
        return {
          id: apt.id,
          title: apt.title,
          start: startDate,
          end: endDate,
          resource: {
            appointment: apt,
            type: apt.appointment_type,
            status: apt.status,
            teamMembers: assignedMembers,
          },
        };
      });
  }, [appointments, filters, teamMembers]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const { type, status, teamMembers: eventTeam } = event.resource;
    const colors = typeColors[type] || typeColors.meeting;

    // Use first team member's color if assigned, otherwise use type color
    let backgroundColor = eventTeam.length > 0 ? eventTeam[0].color_code : colors.bg;
    let borderColor = eventTeam.length > 0 ? eventTeam[0].color_code : colors.border;

    if (status === "pending") {
      backgroundColor = backgroundColor + "CC";
    } else if (status === "cancelled") {
      backgroundColor = "#EF4444";
      borderColor = "#DC2626";
    } else if (status === "completed") {
      backgroundColor = "#94A3B8";
      borderColor = "#64748B";
    }

    return {
      style: {
        backgroundColor,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: "6px",
        opacity: status === "cancelled" ? 0.6 : 1,
        color: "#fff",
        fontSize: "12px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
    };
  }, []);

  // Handle drag and drop - optimistic update + rollback on error
  const handleEventDrop = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      const appointment = event.resource.appointment;
      const originalDate = appointment.appointment_date;
      const originalStartTime = appointment.start_time;
      const originalEndTime = appointment.end_time;

      const newDate = format(start as Date, "yyyy-MM-dd");
      const newStartTime = format(start as Date, "HH:mm:ss");
      const newEndTime = format(end as Date, "HH:mm:ss");

      // Optimistic update
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointment.id
            ? { ...apt, appointment_date: newDate, start_time: newStartTime, end_time: newEndTime }
            : apt
        )
      );

      try {
        const { error } = await supabase
          .from("appointments")
          .update({
            appointment_date: newDate,
            start_time: newStartTime,
            end_time: newEndTime,
          })
          .eq("id", appointment.id);

        if (error) throw error;
        toast.success("Termin verschoben");
      } catch (e) {
        console.error("Error moving appointment:", e);
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointment.id
              ? { ...apt, appointment_date: originalDate, start_time: originalStartTime, end_time: originalEndTime }
              : apt
          )
        );
        toast.error("Fehler beim Verschieben");
      }
    },
    []
  );

  // Handle resize - optimistic update + rollback, appointment_date when date changes
  const handleEventResize = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      const appointment = event.resource.appointment;
      const originalDate = appointment.appointment_date;
      const originalStartTime = appointment.start_time;
      const originalEndTime = appointment.end_time;

      const newDate = format(start as Date, "yyyy-MM-dd");
      const newStartTime = format(start as Date, "HH:mm:ss");
      const newEndTime = format(end as Date, "HH:mm:ss");

      // Optimistic update
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointment.id
            ? { ...apt, appointment_date: newDate, start_time: newStartTime, end_time: newEndTime }
            : apt
        )
      );

      try {
        const { error } = await supabase
          .from("appointments")
          .update({
            appointment_date: newDate,
            start_time: newStartTime,
            end_time: newEndTime,
          })
          .eq("id", appointment.id);

        if (error) throw error;
        toast.success("Termindauer geändert");
      } catch (e) {
        console.error("Error resizing appointment:", e);
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointment.id
              ? { ...apt, appointment_date: originalDate, start_time: originalStartTime, end_time: originalEndTime }
              : apt
          )
        );
        toast.error("Fehler beim Ändern der Dauer");
      }
    },
    []
  );

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  // Left click on slot - show day's appointments in sidebar
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    setSelectedDate(start);
    setSelectedEvent(null); // Clear selected event to show day view
  }, []);

  // Right click context menu handler
  const handleSlotContextMenu = useCallback((date: Date, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, date });
  }, []);

  // Create new appointment from context menu
  const handleCreateFromContextMenu = useCallback(() => {
    if (contextMenu) {
      setEditingAppointment(null);
      setModalInitialDate(contextMenu.date);
      setIsModalOpen(true);
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Get appointments for selected date (apply same filters as calendar)
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return appointments
      .filter((apt) => apt.appointment_date === dateStr)
      .filter((apt) => {
        const typeMatch = filters.types.includes(apt.appointment_type);
        const statusMatch = filters.statuses.includes(apt.status);
        const teamMatch =
          filters.teamMemberIds.length === 0 ||
          (apt.assigned_team_member_ids?.some((id) => filters.teamMemberIds.includes(id)) ?? false);
        return typeMatch && statusMatch && teamMatch;
      });
  }, [selectedDate, appointments, filters]);

  const calendarSidePanelOpen = Boolean(selectedEvent || selectedDate);

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
    if (view === Views.DAY && selectedDate) {
      setSelectedDate(newDate);
    }
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const handleNewAppointment = () => {
    setEditingAppointment(null);
    setModalInitialDate(new Date());
    setIsModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setModalInitialDate(null);
    setIsModalOpen(true);
    setSelectedEvent(null);
  };

  const handleConfirmAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "confirmed",
          confirmed_by_firma: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Termin bestätigt");
      fetchAppointments();
      setSelectedEvent(null);
    } catch (e) {
      console.error("Error confirming appointment:", e);
      toast.error("Fehler beim Bestätigen");
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_by: "firma",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Termin abgesagt");
      fetchAppointments();
      setSelectedEvent(null);
    } catch (e) {
      console.error("Error cancelling appointment:", e);
      toast.error("Fehler beim Absagen");
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Termin als erledigt markiert");
      fetchAppointments();
      setSelectedEvent(null);
    } catch (e) {
      console.error("Error completing appointment:", e);
      toast.error("Fehler beim Abschliessen");
    }
  };

  const toggleFilter = (
    category: "types" | "statuses" | "teamMemberIds",
    value: string
  ) => {
    setFilters((prev) => {
      const current = prev[category];
      if (current.includes(value)) {
        return { ...prev, [category]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [category]: [...current, value] };
      }
    });
  };

  // Custom event component with team member avatars
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { teamMembers: eventTeam } = event.resource;
    return (
      <div className="flex items-center gap-1.5 overflow-hidden min-h-0 px-1.5 py-0.5">
        {eventTeam.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0">
            {eventTeam.slice(0, 2).map((tm) => (
              <div
                key={tm.id}
                className="w-5 h-5 rounded-full border-2 border-white/50 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                style={{ backgroundColor: tm.color_code }}
                title={`${tm.first_name || ""} ${tm.last_name || ""}`.trim() || "Team"}
              >
                {(tm.first_name || "?")[0]}
              </div>
            ))}
            {eventTeam.length > 2 && (
              <div className="w-5 h-5 rounded-full bg-slate-600 border-2 border-white/50 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                +{eventTeam.length - 2}
              </div>
            )}
          </div>
        )}
        <span className="truncate text-xs font-medium">{event.title}</span>
      </div>
    );
  };

  const messages = {
    today: "Heute",
    previous: "Zurück",
    next: "Weiter",
    month: "Monat",
    week: "Woche",
    day: "Tag",
    agenda: "Liste",
    date: "Datum",
    time: "Zeit",
    event: "Termin",
    noEventsInRange: "Keine Termine in diesem Zeitraum",
    showMore: (total: number) => `+${total} mehr`,
  };

  // Stats - using useMemo to avoid recalculation on every render
  const todayAppointments = useMemo(() =>
    appointments.filter(a => a.appointment_date === format(new Date(), "yyyy-MM-dd")).length,
    [appointments]
  );
  const pendingAppointments = useMemo(() =>
    appointments.filter(a => a.status === "pending").length,
    [appointments]
  );
  // FIX: Week calculation was mutating the Date object causing incorrect results
  const thisWeekAppointments = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday end

    return appointments.filter(a => {
      const aptDate = new Date(a.appointment_date);
      return aptDate >= weekStart && aptDate <= weekEnd;
    }).length;
  }, [appointments]);

  return (
    <>
      <Helmet>
        <title>Kalender | Firma</title>
      </Helmet>
      <FirmaLayout>
        <div className="space-y-4">
          {/* Compact Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 px-4 py-3 md:px-6 md:py-4 text-white">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-2">
              {/* ── Satır 1: Başlık + istatistik + Neuer Termin ── */}
              <div className="flex items-center gap-2">
                {/* Icon + Title */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm md:text-base font-bold leading-tight truncate">Kalender</h1>
                    <p className="text-white/70 text-[10px] leading-tight truncate">
                      {format(currentDate, "EEE, dd. MMM yyyy", { locale: de })}
                    </p>
                  </div>
                </div>

                {/* Compact stats — hidden on very small screens */}
                <div className="hidden xs:flex sm:flex items-center gap-2 text-[11px] shrink-0">
                  <span className="flex items-center gap-0.5">
                    <span className="font-bold text-white tabular-nums">{todayAppointments}</span>
                    <span className="text-white/60">H</span>
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <span className="font-bold text-white tabular-nums">{pendingAppointments}</span>
                    <span className="text-white/60">O</span>
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <span className="font-bold text-white tabular-nums">{thisWeekAppointments}</span>
                    <span className="text-white/60">W</span>
                  </span>
                </div>

                {/* New appointment button */}
                <Button
                  onClick={handleNewAppointment}
                  size="sm"
                  className="shrink-0 bg-white text-indigo-600 hover:bg-white/90 shadow-md shadow-black/10 h-8 px-2.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1">Neuer Termin</span>
                </Button>
              </div>

              {/* ── Satır 2: Kontroller (tek satır, yatay kaydırmalı) ── */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [-webkit-overflow-scrolling:touch]">
                {/* Ansicht / Team */}
                <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label="Kalenderansicht"
                    onClick={() => setActiveTab("calendar")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === "calendar" ? "bg-white text-indigo-700 shadow-sm" : "text-white/90 hover:bg-white/10"}`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Ansicht</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("team")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === "team" ? "bg-white text-indigo-700 shadow-sm" : "text-white/90 hover:bg-white/10"}`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Team</span>
                  </button>
                </div>

                {/* View switcher */}
                {activeTab === "calendar" && (
                  <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 shrink-0">
                    {[
                      { view: Views.MONTH,  label: "Monat", icon: CalendarRange },
                      { view: Views.WEEK,   label: "Woche", icon: CalendarDays },
                      { view: Views.DAY,    label: "Tag",   icon: CalendarIcon },
                      { view: Views.AGENDA, label: "Liste", icon: List },
                    ].map(({ view: v, label, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setView(v)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${view === v ? "bg-white text-indigo-700 shadow-sm" : "text-white/90 hover:bg-white/10"}`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0 h-8 px-2.5 bg-white/15 border-white/30 text-white hover:bg-white/25 hover:text-white whitespace-nowrap">
                      <Filter className="w-3.5 h-3.5" />
                      <span className="ml-1 text-xs">Filter</span>
                      {(filters.types.length < 5 || filters.statuses.length < 6 || filters.teamMemberIds.length > 0) && (
                        <span className="ml-1 w-4 h-4 rounded-full bg-amber-300 text-indigo-900 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {5 - filters.types.length + 6 - filters.statuses.length + filters.teamMemberIds.length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="end">
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />Termin-Typ
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(typeColors).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => toggleFilter("types", key)}>
                              <Checkbox id={`type-${key}`} checked={filters.types.includes(key)} onCheckedChange={() => toggleFilter("types", key)} />
                              <label htmlFor={`type-${key}`} className="text-sm flex items-center gap-2 cursor-pointer flex-1">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: val.bg }} />
                                {val.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Status
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => toggleFilter("statuses", key)}>
                              <Checkbox id={`status-${key}`} checked={filters.statuses.includes(key)} onCheckedChange={() => toggleFilter("statuses", key)} />
                              <label htmlFor={`status-${key}`} className={`text-sm cursor-pointer flex-1 ${config.color}`}>{config.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                      {teamMembers.length > 0 && (
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Team
                          </h4>
                          <div className="space-y-2 max-h-36 overflow-y-auto">
                            {teamMembers.map((member) => (
                              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => toggleFilter("teamMemberIds", member.id)}>
                                <Checkbox id={`team-${member.id}`} checked={filters.teamMemberIds.includes(member.id)} onCheckedChange={() => toggleFilter("teamMemberIds", member.id)} />
                                <label htmlFor={`team-${member.id}`} className="text-sm flex items-center gap-2 cursor-pointer flex-1">
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: member.color_code }}>
                                    {(member.first_name || "?")[0]}
                                  </span>
                                  {member.first_name} {member.last_name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Active filter chips — yatay kaydırmalı */}
                {(filters.types.length < 5 || filters.statuses.length < 6 || filters.teamMemberIds.length > 0) && (
                  <>
                    {filters.types.map((type) => (
                      <button key={type} type="button" onClick={() => toggleFilter("types", type)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-white/20 text-white hover:bg-white/30 border border-white/15 transition-colors whitespace-nowrap">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: typeColors[type]?.bg }} />
                        {typeColors[type]?.label}
                        <X className="w-2.5 h-2.5 shrink-0 opacity-70" />
                      </button>
                    ))}
                    {filters.teamMemberIds.map((id) => {
                      const member = teamMembers.find(m => m.id === id);
                      return member ? (
                        <button key={id} type="button" onClick={() => toggleFilter("teamMemberIds", id)}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-white/20 text-white hover:bg-white/30 border border-white/15 transition-colors whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: member.color_code }} />
                          {member.first_name}
                          <X className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </button>
                      ) : null;
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Team Week View */}
          {activeTab === "team" && companyId && (
            <TeamWeekView
              companyId={companyId}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onAppointmentClick={(appointmentId) => {
                const apt = appointments.find(a => a.id === appointmentId);
                if (apt) {
                  const startDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
                  const endDate = new Date(`${apt.appointment_date}T${apt.end_time}`);
                  const assignedMembers = teamMembers.filter(tm =>
                    apt.assigned_team_member_ids?.includes(tm.id)
                  );
                  setSelectedEvent({
                    id: apt.id,
                    title: apt.title,
                    start: startDate,
                    end: endDate,
                    resource: {
                      appointment: apt,
                      type: apt.appointment_type,
                      status: apt.status,
                      teamMembers: assignedMembers,
                    },
                  });
                  setActiveTab("calendar");
                }
              }}
            />
          )}

          {/* Calendar + optional detail sidebar (only when a day or event is selected) */}
          {activeTab === "calendar" && (
            <div
              className={cn(
                "flex flex-col gap-4 md:gap-6 lg:items-stretch",
                calendarSidePanelOpen ? "lg:grid lg:grid-cols-4" : "lg:grid lg:grid-cols-1"
              )}
            >
              {/* Mobile Calendar Navigation */}
              <div className="col-span-full order-1">
                <MobileCalendarNav
                  currentDate={currentDate}
                  onDateChange={handleNavigate}
                  view={view === Views.MONTH ? "month" : view === Views.WEEK ? "week" : view === Views.DAY ? "day" : "agenda"}
                  appointmentDates={appointments.map(a => a.appointment_date)}
                />
              </div>

              {/* Calendar */}
              <div
                className={cn(
                  "order-2 lg:order-1 min-w-0",
                  calendarSidePanelOpen ? "lg:col-span-3" : "col-span-full"
                )}
              >
                <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 rounded-t-2xl" />
                  <div className="p-3 sm:p-4 md:p-6">
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mb-2 sm:mb-3 leading-snug">
                      Tag anklicken für Terminliste · Rechtsklick: neuer Termin
                    </p>
                    <div
                      className="h-[580px] sm:h-[680px] md:h-[780px] lg:h-[min(820px,calc(100vh-14rem))] calendar-mobile calendar-modern"
                      onContextMenu={(e) => {
                        // Get clicked date from target element
                        const target = e.target as HTMLElement;
                        const dateCell = target.closest('[role="cell"]') || target.closest('.rbc-day-bg');
                        if (dateCell) {
                          const dateAttr = dateCell.getAttribute('data-date');
                          if (dateAttr) {
                            handleSlotContextMenu(new Date(dateAttr), e);
                          } else {
                            // Fallback: use selected date or current date
                            handleSlotContextMenu(selectedDate || currentDate, e);
                          }
                        }
                      }}
                    >
                      <DnDCalendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        view={view}
                        onView={handleViewChange}
                        date={currentDate}
                        onNavigate={handleNavigate}
                        onSelectEvent={handleSelectEvent}
                        onSelectSlot={handleSelectSlot}
                        onEventDrop={handleEventDrop}
                        onEventResize={handleEventResize}
                        selectable
                        resizable
                        draggableAccessor={() => true}
                        eventPropGetter={eventStyleGetter}
                        messages={messages}
                        culture="de-CH"
                        scrollToTime={(() => { const t = new Date(); t.setHours(7, 0, 0, 0); return t; })()}
                        popup
                        showAllEvents
                        components={{
                          event: EventComponent,
                          toolbar: ({ date, onNavigate, view: toolbarView }) => {
                            // View-aware navigation
                            const navigatePrev = () => {
                              if (toolbarView === Views.DAY) {
                                onNavigate('DATE', subDays(date, 1));
                              } else if (toolbarView === Views.WEEK) {
                                onNavigate('DATE', subWeeks(date, 1));
                              } else {
                                onNavigate('DATE', subMonths(date, 1));
                              }
                            };

                            const navigateNext = () => {
                              if (toolbarView === Views.DAY) {
                                onNavigate('DATE', addDays(date, 1));
                              } else if (toolbarView === Views.WEEK) {
                                onNavigate('DATE', addWeeks(date, 1));
                              } else {
                                onNavigate('DATE', addMonths(date, 1));
                              }
                            };

                            const navigateToday = () => {
                              onNavigate('TODAY');
                            };

                            // Format header based on view
                            const getHeaderText = () => {
                              if (toolbarView === Views.DAY) {
                                return format(date, "EEEE, d. MMMM yyyy", { locale: de });
                              } else if (toolbarView === Views.WEEK) {
                                return `KW ${format(date, "w", { locale: de })} - ${format(date, "MMMM yyyy", { locale: de })}`;
                              } else {
                                return format(date, "MMMM yyyy", { locale: de });
                              }
                            };

                            return (
                              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-xl"
                                    onClick={navigatePrev}
                                    aria-label="Vorherige Ansicht"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={navigateToday}
                                    className="h-9 rounded-xl px-4"
                                  >
                                    Heute
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-xl"
                                    onClick={navigateNext}
                                    aria-label="Nächste Ansicht"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                  {getHeaderText()}
                                </h2>
                              </div>
                            );
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail sidebar: Tag- oder Terminauswahl */}
              {calendarSidePanelOpen && (
              <div className="lg:col-span-1 order-1 lg:order-2 lg:h-full min-w-0">
                {selectedEvent ? (
                  <AppointmentDetailCard
                    appointment={selectedEvent.resource.appointment}
                    teamMembers={teamMembers}
                    onClose={() => setSelectedEvent(null)}
                    onEdit={() => handleEditAppointment(selectedEvent.resource.appointment)}
                    onConfirm={() => handleConfirmAppointment(selectedEvent.id)}
                    onCancel={() => handleCancelAppointment(selectedEvent.id)}
                    onComplete={() => handleCompleteAppointment(selectedEvent.id)}
                  />
                ) : selectedDate ? (
                  /* Selected Day's Appointments */
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col lg:h-full max-h-[70vh] lg:max-h-none">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500" />
                    <div className="p-4 flex flex-col flex-1 min-h-0">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {format(selectedDate, "EEEE", { locale: de })}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {format(selectedDate, "d. MMMM yyyy", { locale: de })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedDate(null)}
                          className="h-8 w-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Add New Button */}
                      <Button
                        onClick={() => {
                          setEditingAppointment(null);
                          setModalInitialDate(selectedDate);
                          setIsModalOpen(true);
                        }}
                        className="w-full mb-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Neuer Termin
                      </Button>

                      {/* Appointments List */}
                      <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                        {selectedDateAppointments.length === 0 ? (
                          <div className="text-center py-8">
                            <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-500">Keine Termine an diesem Tag</p>
                          </div>
                        ) : (
                          selectedDateAppointments.map((apt) => {
                            const typeInfo = typeColors[apt.appointment_type] || typeColors.meeting;
                            const statusInfo = statusConfig[apt.status] || statusConfig.pending;
                            const StatusIcon = statusInfo.icon;

                            return (
                              <div
                                key={apt.id}
                                onClick={() => {
                                  const startDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
                                  const endDate = new Date(`${apt.appointment_date}T${apt.end_time}`);
                                  const assignedMembers = teamMembers.filter(tm =>
                                    apt.assigned_team_member_ids?.includes(tm.id)
                                  );
                                  setSelectedEvent({
                                    id: apt.id,
                                    title: apt.title,
                                    start: startDate,
                                    end: endDate,
                                    resource: {
                                      appointment: apt,
                                      type: apt.appointment_type,
                                      status: apt.status,
                                      teamMembers: assignedMembers,
                                    },
                                  });
                                }}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all hover:shadow-md"
                                style={{ borderLeftColor: typeInfo.bg, borderLeftWidth: '3px' }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                      {apt.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-500">
                                        {apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] px-1.5 py-0 ${statusInfo.bgColor} ${statusInfo.textColor}`}
                                      >
                                        <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                                        {statusInfo.label}
                                      </Badge>
                                    </div>
                                    {apt.customer_first_name && (
                                      <p className="text-xs text-slate-400 mt-1 truncate">
                                        {apt.customer_first_name} {apt.customer_last_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              )}

              {/* Context Menu */}
              {contextMenu && (
                <div
                  className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 min-w-[180px]"
                  style={{
                    left: Math.min(contextMenu.x, window.innerWidth - 190),
                    top: Math.min(contextMenu.y, window.innerHeight - 90),
                  }}
                >
                  <button
                    onClick={handleCreateFromContextMenu}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Neuer Termin
                  </button>
                  <button
                    onClick={() => {
                      if (contextMenu) {
                        setSelectedDate(contextMenu.date);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Tag anzeigen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Appointment Modal */}
          <AppointmentModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setInitialLeadId(null);
            }}
            appointment={editingAppointment}
            initialDate={modalInitialDate}
            companyId={companyId}
            initialLeadId={initialLeadId}
            onSaved={() => {
              fetchAppointments();
              setIsModalOpen(false);
            }}
          />
        </div>
      </FirmaLayout>
    </>
  );
};

// Modern Appointment Detail Card Component
const AppointmentDetailCard = ({
  appointment,
  teamMembers,
  onClose,
  onEdit,
  onConfirm,
  onCancel,
  onComplete,
}: {
  appointment: Appointment;
  teamMembers: TeamMember[];
  onClose: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onComplete: () => void;
}) => {
  const typeInfo = typeColors[appointment.appointment_type] || typeColors.meeting;
  const statusInfo = statusConfig[appointment.status] || statusConfig.pending;
  const assignedMembers = teamMembers.filter(tm => appointment.assigned_team_member_ids?.includes(tm.id));

  // Create CalendarEvent for ICS export
  const calendarEvent: ICSCalendarEvent = {
    title: appointment.title,
    description: appointment.description || undefined,
    startDate: new Date(`${appointment.appointment_date}T${appointment.start_time}`),
    endDate: new Date(`${appointment.appointment_date}T${appointment.end_time}`),
    location: [
      appointment.location_address,
      appointment.location_plz,
      appointment.location_city
    ].filter(Boolean).join(", ") || undefined,
    allDay: appointment.all_day,
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-w-0">
      {/* Header with gradient */}
      <div className={`relative overflow-hidden p-4 bg-gradient-to-r ${typeInfo.gradient} text-white`}>
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <typeInfo.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-white/90">{typeInfo.label}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <h3 className="font-bold text-lg break-words">{appointment.title}</h3>
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
            <Circle className="w-2 h-2 fill-current" />
            {statusInfo.label}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Date & Time */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {format(new Date(appointment.appointment_date), "EEEE, dd.MM.yyyy", { locale: de })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)} Uhr
            </p>
          </div>
        </div>

        {/* Location */}
        {appointment.location_address && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {appointment.location_address}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {appointment.location_plz} {appointment.location_city}
              </p>
              {appointment.location_notes && (
                <p className="text-xs text-slate-400 mt-1 italic">
                  {appointment.location_notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Customer */}
        {appointment.customer_first_name && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kunde</p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {appointment.customer_first_name} {appointment.customer_last_name}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {appointment.customer_phone && (
                    <a
                      href={`tel:${appointment.customer_phone}`}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {appointment.customer_phone}
                    </a>
                  )}
                  {appointment.customer_email && (
                    <a
                      href={`mailto:${appointment.customer_email}`}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      Mail
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Members */}
        {assignedMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team</p>
            <div className="flex flex-wrap gap-2">
              {assignedMembers.map(member => (
                <div
                  key={member.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: member.color_code }}
                  >
                    {(member.first_name || "?")[0]}
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {member.first_name || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {appointment.description && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Beschreibung</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{appointment.description}</p>
          </div>
        )}

        {/* Internal Notes */}
        {appointment.internal_notes && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
              🔒 Interne Notizen
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{appointment.internal_notes}</p>
          </div>
        )}

        {/* Calendar Export */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <CalendarExportMenu event={calendarEvent} triggerClassName="w-full" />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {appointment.status === "pending" && (
            <Button
              onClick={onConfirm}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
            >
              <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
              Bestätigen
            </Button>
          )}
          {appointment.status === "confirmed" && (
            <Button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-sm"
            >
              <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
              <span className="truncate">Erledigt</span>
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit} className="h-9 flex-1 min-w-0 text-sm">
              <Edit2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="truncate">Bearbeiten</span>
            </Button>
            {appointment.status !== "cancelled" && appointment.status !== "completed" && (
              <Button variant="destructive" onClick={onCancel} className="h-9 flex-1 min-w-0 text-sm">
                <XCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="truncate">Absagen</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KalenderPage;
