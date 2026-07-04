import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { detectConflicts, type ConflictResult } from "@/lib/appointmentConflicts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Eye, Truck, Clock, Users, CalendarCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { GooglePlacesAutocomplete, PlaceResult } from "@/components/ui/google-places-autocomplete";

interface Appointment {
  id: string;
  company_id: string;
  lead_id: string | null;
  offer_id: string | null;
  appointment_type: string;
  status: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
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
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  color_code: string;
}

interface Resource {
  id: string;
  name: string;
  resource_type: string;
  capacity_m3: number | null;
}

interface AcceptedLead {
  lead_id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  service_type: string;
  preferred_date: string | null;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialDate: Date | null;
  /** Default appointment type for a NEW appointment (e.g. 'service' when added from an
      accepted offer). Falls back to 'besichtigung' — the most common first-contact type. */
  initialType?: string | null;
  initialTitle?: string | null;
  companyId: string | null;
  onSaved: () => void;
  initialLeadId?: string | null;
}

const appointmentTypes = [
  { value: "besichtigung", label: "Besichtigung", icon: Eye, description: "Kundenbesichtigung" },
  { value: "service", label: "Auftrag", icon: Truck, description: "Service-Termin" },
  { value: "follow_up", label: "Nachkontrolle", icon: CalendarCheck, description: "Nachkontrolle" },
  { value: "meeting", label: "Besprechung", icon: Users, description: "Interne Besprechung" },
  { value: "blocked", label: "Zeit blockieren", icon: Clock, description: "Zeit nicht verfügbar (z.B. Urlaub, Pause)" },
];

const statusOptions = [
  { value: "pending", label: "Ausstehend" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "completed", label: "Erledigt" },
  { value: "cancelled", label: "Abgesagt" },
];

export const AppointmentModal = ({
  isOpen,
  onClose,
  appointment,
  initialDate,
  companyId,
  onSaved,
  initialLeadId,
  initialType,
  initialTitle,
}: AppointmentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictResult<Appointment>[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [_leadLoading, setLeadLoading] = useState(false);
  const [acceptedLeads, setAcceptedLeads] = useState<AcceptedLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    appointment_type: "besichtigung",
    status: "pending",
    appointment_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "10:00",
    all_day: false,
    title: "",
    description: "",
    internal_notes: "",
    location_address: "",
    location_plz: "",
    location_city: "",
    location_notes: "",
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    customer_phone: "",
    assigned_team_member_ids: [] as string[],
    required_vehicles: [] as string[],
    required_equipment: [] as string[],
    is_recurring: false,
    recurrence_pattern: "weekly" as "daily" | "weekly" | "biweekly" | "monthly",
    recurrence_end_date: "",
  });

  // Initialize form with appointment data or defaults
  useEffect(() => {
    if (appointment) {
      setFormData({
        appointment_type: appointment.appointment_type,
        status: appointment.status,
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time.slice(0, 5),
        end_time: appointment.end_time.slice(0, 5),
        all_day: appointment.all_day,
        title: appointment.title,
        description: appointment.description || "",
        internal_notes: appointment.internal_notes || "",
        location_address: appointment.location_address || "",
        location_plz: appointment.location_plz || "",
        location_city: appointment.location_city || "",
        location_notes: appointment.location_notes || "",
        customer_first_name: appointment.customer_first_name || "",
        customer_last_name: appointment.customer_last_name || "",
        customer_email: appointment.customer_email || "",
        customer_phone: appointment.customer_phone || "",
        assigned_team_member_ids: appointment.assigned_team_member_ids || [],
        required_vehicles: appointment.required_vehicles || [],
        required_equipment: appointment.required_equipment || [],
        is_recurring: false,
        recurrence_pattern: "weekly" as const,
        recurrence_end_date: "",
      });
    } else if (initialDate) {
      setFormData((prev) => ({
        ...prev,
        appointment_type: initialType || "besichtigung",
        appointment_date: format(initialDate, "yyyy-MM-dd"),
        title: initialTitle || "",
        description: "",
        internal_notes: "",
        location_address: "",
        location_plz: "",
        location_city: "",
        location_notes: "",
        customer_first_name: "",
        customer_last_name: "",
        customer_email: "",
        customer_phone: "",
        assigned_team_member_ids: [],
        required_vehicles: [],
        required_equipment: [],
      }));
    }
  }, [appointment, initialDate, initialType, initialTitle, isOpen]);

  // Load team members, resources, and accepted leads
  useEffect(() => {
    const loadResources = async () => {
      if (!companyId) return;

      const [teamRes, resourceRes, leadsRes] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, first_name, last_name, role, color_code")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("firma_resources")
          .select("id, name, resource_type, capacity_m3")
          .eq("company_id", companyId)
          .eq("is_available", true),
        // Fetch accepted leads for this company
        supabase
          .from("lead_distributions")
          .select(`
            lead_id,
            leads (
              customer_first_name,
              customer_last_name,
              customer_email,
              customer_phone,
              from_street,
              from_house_number,
              from_plz,
              from_city,
              service_type,
              preferred_date
            )
          `)
          .eq("company_id", companyId)
          .eq("status", "accepted")
          .order("accepted_at", { ascending: false })
          .limit(50),
      ]);

      if (teamRes.data) setTeamMembers(teamRes.data);
      if (resourceRes.data) setResources(resourceRes.data);
      if (leadsRes.data) {
        // Transform the nested data structure
        const leads: AcceptedLead[] = leadsRes.data
          .filter(d => d.leads)
          .map(d => ({
            lead_id: d.lead_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(d.leads as any),
          }));
        setAcceptedLeads(leads);
      }
    };

    if (isOpen) {
      loadResources();
      // Set selected lead if initialLeadId is provided
      if (initialLeadId) {
        setSelectedLeadId(initialLeadId);
      } else {
        setSelectedLeadId(null);
      }
    }
  }, [isOpen, companyId, initialLeadId]);

  // Check for conflicts - debounced to avoid race conditions on rapid changes
  const conflictRequestIdRef = useRef(0);
  useEffect(() => {
    if (!companyId || !formData.appointment_date) {
      setConflicts([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const requestId = ++conflictRequestIdRef.current;

      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("company_id", companyId)
        .eq("appointment_date", formData.appointment_date)
        .neq("status", "cancelled")
        .neq("id", appointment?.id || "00000000-0000-0000-0000-000000000000");

      if (requestId !== conflictRequestIdRef.current) return;

      const conflicting = detectConflicts(
        {
          id: appointment?.id ?? null,
          start_time: formData.start_time,
          end_time: formData.end_time,
          assigned_team_member_ids: formData.assigned_team_member_ids,
          required_vehicles: formData.required_vehicles,
        },
        (data ?? []) as Appointment[],
      );

      setConflicts(conflicting);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.appointment_date, formData.start_time, formData.end_time, formData.assigned_team_member_ids, formData.required_vehicles, companyId, appointment]);

  // Fetch lead data when initialLeadId is provided
  useEffect(() => {
    const fetchLeadData = async () => {
      if (!initialLeadId || !isOpen) return;
      
      setLeadLoading(true);
      try {
        const { data: lead, error } = await supabase
          .from("leads")
          .select(`
            id,
            customer_first_name,
            customer_last_name,
            customer_email,
            customer_phone,
            from_street,
            from_house_number,
            from_plz,
            from_city,
            service_type,
            preferred_date
          `)
          .eq("id", initialLeadId)
          .maybeSingle();
        
        if (error) throw error;
        
        if (lead) {
          // Pre-fill form with lead data
          const fullAddress = [lead.from_street, lead.from_house_number].filter(Boolean).join(" ");
          const customerName = [lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(" ");
          
          setFormData(prev => ({
            ...prev,
            appointment_type: "besichtigung",
            title: `Besichtigung - ${customerName}`,
            location_address: fullAddress,
            location_plz: lead.from_plz || "",
            location_city: lead.from_city || "",
            customer_first_name: lead.customer_first_name || "",
            customer_last_name: lead.customer_last_name || "",
            customer_email: lead.customer_email || "",
            customer_phone: lead.customer_phone || "",
            appointment_date: lead.preferred_date 
              ? format(new Date(lead.preferred_date), "yyyy-MM-dd")
              : format(new Date(), "yyyy-MM-dd"),
          }));
        }
      } catch (e) {
        console.error("Error fetching lead data:", e);
        toast.error("Fehler beim Laden der Anfragedaten");
      } finally {
        setLeadLoading(false);
      }
    };
    
    fetchLeadData();
  }, [initialLeadId, isOpen]);

  const handleSubmit = async () => {
    if (!companyId) return;
    if (!formData.title.trim()) {
      toast.error("Bitte geben Sie einen Titel ein");
      return;
    }

    // Time validation - only if not all-day
    if (!formData.all_day) {
      if (formData.start_time >= formData.end_time) {
        toast.error("Endzeit muss nach Startzeit liegen");
        return;
      }
      
      // Calculate duration
      const [startH, startM] = formData.start_time.split(":").map(Number);
      const [endH, endM] = formData.end_time.split(":").map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      
      if (durationMinutes < 15) {
        toast.error("Termin muss mindestens 15 Minuten dauern");
        return;
      }
      if (durationMinutes > 720) {
        toast.error("Termin darf maximal 12 Stunden dauern");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        company_id: companyId,
        lead_id: selectedLeadId || initialLeadId || null,
        appointment_type: formData.appointment_type as "besichtigung" | "service" | "follow_up" | "meeting" | "blocked",
        status: formData.status as "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show",
        appointment_date: formData.appointment_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        all_day: formData.all_day,
        title: formData.title,
        description: formData.description || null,
        internal_notes: formData.internal_notes || null,
        location_address: formData.location_address || null,
        location_plz: formData.location_plz || null,
        location_city: formData.location_city || null,
        location_notes: formData.location_notes || null,
        customer_first_name: formData.customer_first_name || null,
        customer_last_name: formData.customer_last_name || null,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        assigned_team_member_ids:
          formData.assigned_team_member_ids.length > 0
            ? formData.assigned_team_member_ids
            : null,
        required_vehicles:
          formData.required_vehicles.length > 0 ? formData.required_vehicles : null,
        required_equipment:
          formData.required_equipment.length > 0 ? formData.required_equipment : null,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
      };

      if (appointment) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", appointment.id);

        if (error) throw error;
        toast.success("Termin aktualisiert");
      } else {
        const { data: insertedAppointment, error } = await supabase
          .from("appointments")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;

        // Send confirmation email to customer (await + visible diagnostics)
        if (
          insertedAppointment?.id &&
          formData.appointment_type !== "blocked" &&
          formData.appointment_type !== "meeting"
        ) {
          if (!formData.customer_email?.trim()) {
            toast.warning("Termin erstellt, aber keine Kunden-E-Mail vorhanden");
          } else {
            try {
              const {
                data: { session: initialSession },
                error: sessionError,
              } = await supabase.auth.getSession();
              if (sessionError) throw sessionError;

              let activeSession = initialSession;
              if (!activeSession?.access_token) {
                const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) throw refreshError;
                activeSession = refreshed.session;
              }

              if (!activeSession?.access_token) {
                throw new Error("Keine aktive Sitzung für E-Mail-Versand");
              }

              const { data: emailData, error: emailErr } = await supabase.functions.invoke(
                "send-appointment-confirmation",
                {
                  body: { appointmentId: insertedAppointment.id },
                  headers: {
                    Authorization: `Bearer ${activeSession.access_token}`,
                  },
                }
              );

              if (emailErr) {
                console.error("Appointment email failed:", emailErr);
                toast.warning("Termin erstellt, aber Bestätigungs-E-Mail konnte nicht gesendet werden");
              } else if (emailData?.skipped) {
                const reason = emailData.reason || "unbekannt";
                toast.warning(`Termin erstellt, E-Mail übersprungen (${reason})`);
              } else {
                toast.success("Termin erstellt – Bestätigungs-E-Mail wurde gesendet");
              }
            } catch (emailError) {
              console.error("Appointment email invocation error:", emailError);
              toast.warning("Termin erstellt, aber E-Mail-Versand ist fehlgeschlagen");
            }
          }
        }

        // Generate recurring appointments if needed
        if (formData.is_recurring && insertedAppointment?.id) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: countResult, error: recurringError } = await (supabase as any)
              .rpc("generate_recurring_appointments", {
                p_parent_id: insertedAppointment.id,
                p_end_date: formData.recurrence_end_date || null,
              });
            
            if (recurringError) {
              console.error("Error generating recurring appointments:", recurringError);
              toast.warning("Termin erstellt, aber wiederkehrende Termine konnten nicht generiert werden");
            } else {
              toast.success(`Termin erstellt mit ${countResult || 0} Wiederholungen`);
            }
          } catch (recurringErr) {
            console.error("Error generating recurring appointments:", recurringErr);
            toast.success("Termin erstellt");
          }
        } else {
          toast.success("Termin erstellt");
        }
      }

      onSaved();
    } catch (e) {
      console.error("Error saving appointment:", e);
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const vehicles = resources.filter((r) => r.resource_type === "vehicle");
  const equipment = resources.filter((r) => r.resource_type === "equipment");

  // Handle lead selection from dropdown
  const handleLeadSelect = (leadId: string) => {
    if (leadId === "manual") {
      setSelectedLeadId(null);
      // Clear customer fields for manual entry
      setFormData(prev => ({
        ...prev,
        customer_first_name: "",
        customer_last_name: "",
        customer_email: "",
        customer_phone: "",
        location_address: "",
        location_plz: "",
        location_city: "",
        title: "",
      }));
      return;
    }

    const lead = acceptedLeads.find(l => l.lead_id === leadId);
    if (!lead) return;

    setSelectedLeadId(leadId);
    const fullAddress = [lead.from_street, lead.from_house_number].filter(Boolean).join(" ");
    const customerName = [lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(" ");

    setFormData(prev => ({
      ...prev,
      appointment_type: "besichtigung",
      title: customerName ? `Besichtigung - ${customerName}` : prev.title,
      location_address: fullAddress,
      location_plz: lead.from_plz || "",
      location_city: lead.from_city || "",
      customer_first_name: lead.customer_first_name || "",
      customer_last_name: lead.customer_last_name || "",
      customer_email: lead.customer_email || "",
      customer_phone: lead.customer_phone || "",
      appointment_date: lead.preferred_date
        ? format(new Date(lead.preferred_date), "yyyy-MM-dd")
        : prev.appointment_date,
    }));
  };

  // Get display name for lead in dropdown
  const getLeadDisplayName = (lead: AcceptedLead) => {
    const name = [lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(" ");
    const location = lead.from_city || "";
    return name ? `${name}${location ? ` - ${location}` : ""}` : `Anfrage in ${location || "unbekannt"}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointment ? "Termin bearbeiten" : "Neuer Termin"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Termin-Typ</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {appointmentTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.appointment_type === type.value ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col h-auto py-3 gap-1"
                    onClick={() =>
                      setFormData({ ...formData, appointment_type: type.value })
                    }
                    title={type.description}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
            {formData.appointment_type === "blocked" && (
              <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded border border-blue-200">
                💡 <strong>Zeit blockieren:</strong> Diese Zeit wird im Kalender als nicht verfügbar markiert. 
                Keine Kundeninformationen erforderlich. Nützlich für Urlaub, Pausen, Wartung, etc.
              </div>
            )}
          </div>

          {/* Title & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Besichtigung 3.5 Zimmer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum *</Label>
              <Input
                id="date"
                type="date"
                value={formData.appointment_date}
                onChange={(e) =>
                  setFormData({ ...formData, appointment_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                disabled={formData.all_day}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Ende</Label>
              <Input
                id="end"
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                disabled={formData.all_day}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="all_day"
                checked={formData.all_day}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, all_day: !!checked })
                }
              />
              <Label htmlFor="all_day" className="cursor-pointer">
                Ganztägig
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_recurring: !!checked })
                }
              />
              <Label htmlFor="is_recurring" className="cursor-pointer">
                Wiederkehrend
              </Label>
            </div>
          </div>

          {/* Recurring Options */}
          {formData.is_recurring && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="recurrence_pattern">Wiederholung</Label>
                <Select
                  value={formData.recurrence_pattern}
                  onValueChange={(v) => setFormData({ ...formData, recurrence_pattern: v as "daily" | "weekly" | "biweekly" | "monthly" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Täglich</SelectItem>
                    <SelectItem value="weekly">Wöchentlich</SelectItem>
                    <SelectItem value="biweekly">Alle 2 Wochen</SelectItem>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence_end">Ende der Wiederholung</Label>
                <Input
                  id="recurrence_end"
                  type="date"
                  value={formData.recurrence_end_date}
                  onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                  min={formData.appointment_date}
                />
              </div>
            </div>
          )}

          {/* Conflict Warning */}
          {conflicts.length > 0 && (() => {
            // A real conflict = shared team/vehicle. A candidate without resources yields
            // time-only overlaps (informational, weaker wording).
            const hasResourceConflict = conflicts.some((c) => c.sharedTeam || c.sharedVehicles);
            return (
              <Alert variant={hasResourceConflict ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{hasResourceConflict ? "Ressourcenkonflikt!" : "Zeitliche Überschneidung"}</strong>{" "}
                  {hasResourceConflict
                    ? "Mitarbeiter oder Fahrzeug sind bereits verplant:"
                    : `${conflicts.length} Termin(e) zur gleichen Zeit:`}
                  <ul className="mt-1 text-sm">
                    {conflicts.slice(0, 3).map((c) => {
                      const tags = [c.sharedTeam && "Mitarbeiter", c.sharedVehicles && "Fahrzeug"].filter(Boolean).join(" + ");
                      return (
                        <li key={c.appointment.id}>
                          • {c.appointment.title} ({c.appointment.start_time.slice(0, 5)} – {c.appointment.end_time.slice(0, 5)})
                          {tags ? ` — ${tags}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            );
          })()}

          {/* Customer Info */}
          {formData.appointment_type !== "blocked" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Kunde</Label>
                {acceptedLeads.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Aus Anfrage übernehmen</span>
                  </div>
                )}
              </div>
              
              {/* Lead Selector - Only show if there are accepted leads */}
              {acceptedLeads.length > 0 && (
                <Select
                  value={selectedLeadId || "manual"}
                  onValueChange={handleLeadSelect}
                >
                  <SelectTrigger className="bg-blue-50/50 border-blue-200">
                    <SelectValue placeholder="Anfrage auswählen oder manuell eingeben" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <span className="text-muted-foreground">Manuell eingeben</span>
                    </SelectItem>
                    {acceptedLeads.map((lead) => (
                      <SelectItem key={lead.lead_id} value={lead.lead_id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-green-600" />
                          <span>{getLeadDisplayName(lead)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Vorname"
                  value={formData.customer_first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_first_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Nachname"
                  value={formData.customer_last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_last_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Telefon"
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_phone: e.target.value })
                  }
                />
                <Input
                  placeholder="E-Mail"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_email: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Standort</Label>
            
            {/* Google Places Autocomplete */}
            <div>
              <Label className="text-xs text-muted-foreground">Adresse suchen</Label>
              <GooglePlacesAutocomplete
                value={formData.location_address ? `${formData.location_address}, ${formData.location_plz} ${formData.location_city}` : ""}
                onPlaceSelect={(place: PlaceResult) => {
                  setFormData({
                    ...formData,
                    location_address: `${place.street} ${place.houseNumber}`.trim(),
                    location_plz: place.plz,
                    location_city: place.city,
                  });
                }}
                placeholder="Adresse eingeben..."
              />
            </div>

            <Input
              placeholder="Strasse und Hausnummer"
              value={formData.location_address}
              onChange={(e) =>
                setFormData({ ...formData, location_address: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="PLZ"
                value={formData.location_plz}
                onChange={(e) =>
                  setFormData({ ...formData, location_plz: e.target.value })
                }
              />
              <Input
                placeholder="Ort"
                value={formData.location_city}
                onChange={(e) =>
                  setFormData({ ...formData, location_city: e.target.value })
                }
              />
            </div>
            <Input
              placeholder="Hinweise (z.B. Parkplatz hinten, 2x klingeln)"
              value={formData.location_notes}
              onChange={(e) =>
                setFormData({ ...formData, location_notes: e.target.value })
              }
            />
          </div>

          {/* Team Assignment */}
          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Team zuweisen</Label>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`team-${member.id}`}
                      checked={formData.assigned_team_member_ids.includes(member.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            assigned_team_member_ids: [
                              ...formData.assigned_team_member_ids,
                              member.id,
                            ],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            assigned_team_member_ids:
                              formData.assigned_team_member_ids.filter((id) => id !== member.id),
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor={`team-${member.id}`}
                      className="text-sm cursor-pointer flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: member.color_code }}
                      />
                      {member.first_name} {member.last_name}
                      {member.role && (
                        <span className="text-muted-foreground">({member.role})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles */}
          {vehicles.length > 0 && formData.appointment_type === "service" && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Fahrzeuge</Label>
              <div className="grid grid-cols-2 gap-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`vehicle-${v.id}`}
                      checked={formData.required_vehicles.includes(v.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            required_vehicles: [...formData.required_vehicles, v.name],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            required_vehicles: formData.required_vehicles.filter(
                              (name) => name !== v.name
                            ),
                          });
                        }
                      }}
                    />
                    <label htmlFor={`vehicle-${v.id}`} className="text-sm cursor-pointer">
                      {v.name} {v.capacity_m3 && `(${v.capacity_m3}m³)`}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {equipment.length > 0 && formData.appointment_type === "service" && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Ausrüstung</Label>
              <div className="grid grid-cols-2 gap-2">
                {equipment.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`equip-${e.id}`}
                      checked={formData.required_equipment.includes(e.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            required_equipment: [...formData.required_equipment, e.name],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            required_equipment: formData.required_equipment.filter(
                              (name) => name !== e.name
                            ),
                          });
                        }
                      }}
                    />
                    <label htmlFor={`equip-${e.id}`} className="text-sm cursor-pointer">
                      {e.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Zusätzliche Informationen..."
              rows={3}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="internal_notes">Interne Notizen</Label>
            <Textarea
              id="internal_notes"
              value={formData.internal_notes}
              onChange={(e) =>
                setFormData({ ...formData, internal_notes: e.target.value })
              }
              placeholder="Nur für interne Verwendung..."
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {appointment ? "Aktualisieren" : "Erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
