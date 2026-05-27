import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Clock, MapPin, Calendar, CheckCircle, XCircle, AlertCircle, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Import shared types and constants
import type { TeamAvailability, Appointment, AvailabilityFormState } from "@/types/team";
import { APPOINTMENT_TYPE_COLORS, DEFAULT_WORK_HOURS } from "@/constants/team";
import { calculateHoursBetween, isValidTimeRange, getInitials } from "@/lib/validation";

// Simplified TeamMember for this view
interface TeamMemberView {
  id: string;
  first_name: string;
  last_name: string;
  color_code: string;
  role: string | null;
}

interface TeamWeekViewProps {
  companyId: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentClick?: (appointmentId: string) => void;
}

interface AvailabilityEditState {
  memberId: string;
  memberName: string;
  date: Date;
  existingAvailability: TeamAvailability | null;
}

const statusIcons: Record<string, React.ReactNode> = {
  confirmed: <CheckCircle className="h-3 w-3 text-emerald-500" />,
  pending: <AlertCircle className="h-3 w-3 text-amber-500" />,
  cancelled: <XCircle className="h-3 w-3 text-red-500" />,
};

export function TeamWeekView({ companyId, currentDate, onDateChange, onAppointmentClick }: TeamWeekViewProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<TeamAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit availability state
  const [editState, setEditState] = useState<AvailabilityEditState | null>(null);
  const [editForm, setEditForm] = useState<AvailabilityFormState>({
    isAvailable: true,
    startTime: DEFAULT_WORK_HOURS.START,
    endTime: DEFAULT_WORK_HOURS.END,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  // FIX: Refactored to avoid nested async query anti-pattern
  const fetchData = useCallback(async (isMounted = true) => {
    if (!companyId) return;
    setLoading(true);

    try {
      // First fetch team members and appointments in parallel
      const [teamRes, apptRes] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, first_name, last_name, color_code, role")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("appointments")
          .select("id, appointment_type, status, appointment_date, start_time, end_time, title, location_city, customer_first_name, customer_last_name, assigned_team_member_ids")
          .eq("company_id", companyId)
          .gte("appointment_date", format(weekStart, "yyyy-MM-dd"))
          .lte("appointment_date", format(weekEnd, "yyyy-MM-dd"))
          .not("status", "eq", "cancelled"),
      ]);

      if (!isMounted) return;
      
      if (teamRes.error) throw teamRes.error;
      if (apptRes.error) throw apptRes.error;

      const members = (teamRes.data as TeamMemberView[]) || [];
      const memberIds = members.map(t => t.id);

      // Then fetch availability only if we have member IDs
      let availData: TeamAvailability[] = [];
      if (memberIds.length > 0) {
        const availRes = await supabase
          .from("team_availability")
          .select("*")
          .in("team_member_id", memberIds);
        
        if (!isMounted) return;
        if (availRes.error) throw availRes.error;
        availData = (availRes.data as TeamAvailability[]) || [];
      }

      setTeamMembers(members);
      setAppointments((apptRes.data as Appointment[]) || []);
      setAvailability(availData);
    } catch (e) {
      if (isMounted) console.error("Error fetching team week data:", e);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [companyId, weekStart, weekEnd]);

  // FIX: Add cleanup to prevent memory leak
  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);
    return () => { isMounted = false; };
  }, [fetchData]);

  const getAppointmentsForMemberOnDay = (memberId: string, day: Date): Appointment[] => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.appointment_date);
      return isSameDay(aptDate, day) && apt.assigned_team_member_ids?.includes(memberId);
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getAvailabilityForMemberOnDay = (memberId: string, day: Date): TeamAvailability | null => {
    const dayOfWeek = day.getDay();
    const dateStr = format(day, "yyyy-MM-dd");
    
    // First check for specific date availability
    const specificAvail = availability.find(
      a => a.team_member_id === memberId && a.specific_date === dateStr
    );
    if (specificAvail) return specificAvail;
    
    // Then check for regular day availability
    return availability.find(
      a => a.team_member_id === memberId && a.day_of_week === dayOfWeek && !a.specific_date
    ) || null;
  };

  // FIX: Use validation helper for safe time parsing
  const getTotalHoursForMember = (memberId: string): number => {
    const memberAppts = appointments.filter(apt => apt.assigned_team_member_ids?.includes(memberId));
    return memberAppts.reduce((total, apt) => {
      return total + calculateHoursBetween(apt.start_time, apt.end_time);
    }, 0);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = addDays(currentDate, direction === "prev" ? -7 : 7);
    onDateChange(newDate);
  };

  const openEditAvailability = (member: TeamMemberView, day: Date) => {
    const existing = getAvailabilityForMemberOnDay(member.id, day);
    setEditState({
      memberId: member.id,
      memberName: `${member.first_name} ${member.last_name}`,
      date: day,
      existingAvailability: existing,
    });
    setEditForm({
      isAvailable: existing ? existing.is_available : true,
      startTime: existing?.start_time?.slice(0, 5) || DEFAULT_WORK_HOURS.START,
      endTime: existing?.end_time?.slice(0, 5) || DEFAULT_WORK_HOURS.END,
      notes: existing?.notes || "",
    });
  };

  const saveAvailability = async () => {
    if (!editState || saving) return;
    
    // FIX: Validate time range
    if (editForm.isAvailable && !isValidTimeRange(editForm.startTime, editForm.endTime)) {
      toast.error("Endzeit muss nach Startzeit sein");
      return;
    }
    
    setSaving(true);

    try {
      const dateStr = format(editState.date, "yyyy-MM-dd");
      const specificAvail = availability.find(
        a => a.team_member_id === editState.memberId && a.specific_date === dateStr
      );

      if (specificAvail) {
        // Update existing specific date entry
        const { error } = await supabase
          .from("team_availability")
          .update({
            is_available: editForm.isAvailable,
            start_time: editForm.isAvailable ? editForm.startTime : null,
            end_time: editForm.isAvailable ? editForm.endTime : null,
            notes: editForm.notes.trim() || null,
          })
          .eq("id", specificAvail.id);

        if (error) throw error;
      } else {
        // Insert new specific date entry
        const { error } = await supabase
          .from("team_availability")
          .insert({
            team_member_id: editState.memberId,
            specific_date: dateStr,
            is_available: editForm.isAvailable,
            start_time: editForm.isAvailable ? editForm.startTime : null,
            end_time: editForm.isAvailable ? editForm.endTime : null,
            notes: editForm.notes.trim() || null,
          });

        if (error) throw error;
      }

      toast.success("Verfügbarkeit gespeichert");
      setEditState(null);
      fetchData();
    } catch (e) {
      console.error("Error saving availability:", e);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deleteAvailability = async () => {
    if (!editState || deleting) return;
    setDeleting(true);

    try {
      const dateStr = format(editState.date, "yyyy-MM-dd");
      const specificAvail = availability.find(
        a => a.team_member_id === editState.memberId && a.specific_date === dateStr
      );

      if (specificAvail) {
        const { error } = await supabase
          .from("team_availability")
          .delete()
          .eq("id", specificAvail.id);

        if (error) throw error;
        toast.success("Verfügbarkeit gelöscht");
      }

      setEditState(null);
      fetchData();
    } catch (e) {
      console.error("Error deleting availability:", e);
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Laden...
        </CardContent>
      </Card>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine Team-Mitglieder gefunden. Fügen Sie zuerst Team-Mitglieder hinzu.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Başlık — sadece sm ve üstünde göster */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm sm:text-base whitespace-nowrap">Team-Wochenübersicht</CardTitle>
            </div>
            {/* Mobilde sadece ikon */}
            <div className="flex sm:hidden items-center shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Hafta navigasyonu — ml-auto ile sağa yasla */}
            <div className="flex items-center gap-1.5 ml-auto">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateWeek("prev")} aria-label="Vorherige Woche">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap px-1">
                {format(weekStart, "d. MMM", { locale: de })} – {format(weekEnd, "d. MMM yyyy", { locale: de })}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateWeek("next")} aria-label="Nächste Woche">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              {/* Header Row */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b bg-muted/50">
                <div className="p-3 font-medium text-sm border-r">Mitarbeiter</div>
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`p-3 text-center border-r last:border-r-0 ${
                      isSameDay(day, new Date()) ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE", { locale: de })}
                    </div>
                    <div className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                      {format(day, "d. MMM", { locale: de })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Team Member Rows */}
              {teamMembers.map((member) => (
                <div key={member.id} className="grid grid-cols-[200px_repeat(7,1fr)] border-b last:border-b-0">
                  {/* Member Info */}
                  <div className="p-3 border-r flex items-start gap-3 bg-muted/30">
                    <Avatar className="h-8 w-8" style={{ backgroundColor: member.color_code }}>
                      <AvatarFallback className="text-white text-xs font-medium" style={{ backgroundColor: member.color_code }}>
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {member.first_name} {member.last_name}
                      </div>
                      {member.role && (
                        <div className="text-xs text-muted-foreground truncate">{member.role}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {getTotalHoursForMember(member.id).toFixed(1)}h diese Woche
                      </div>
                    </div>
                  </div>

                  {/* Day Cells */}
                  {weekDays.map((day) => {
                    const dayAppointments = getAppointmentsForMemberOnDay(member.id, day);
                    const dayAvailability = getAvailabilityForMemberOnDay(member.id, day);
                    const isUnavailable = dayAvailability && !dayAvailability.is_available;

                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-2 border-r last:border-r-0 min-h-[100px] relative group ${
                          isSameDay(day, new Date()) ? "bg-primary/5" : ""
                        } ${isUnavailable ? "bg-gray-100" : ""}`}
                      >
                        {/* Edit Button - FIX: Added aria-label and focus styles */}
                        <button
                          onClick={() => openEditAvailability(member, day)}
                          className="absolute top-1 right-1 p-1 rounded bg-background/80 border opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={`${member.first_name} ${member.last_name} Verfügbarkeit für ${format(day, "d. MMMM", { locale: de })} bearbeiten`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>

                        {isUnavailable ? (
                          <div className="text-xs text-muted-foreground italic text-center py-2">
                            Nicht verfügbar
                            {dayAvailability.notes && (
                              <div className="text-[10px] mt-1">{dayAvailability.notes}</div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {dayAvailability && dayAvailability.start_time && (
                              <div className="text-[10px] text-muted-foreground text-center mb-1">
                                {dayAvailability.start_time.slice(0, 5)} - {dayAvailability.end_time?.slice(0, 5)}
                              </div>
                            )}
                            {dayAppointments.map((apt) => (
                              <TooltipProvider key={apt.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => onAppointmentClick?.(apt.id)}
                                      className={`w-full text-left p-1.5 rounded text-xs text-white ${APPOINTMENT_TYPE_COLORS[apt.appointment_type]?.bg || "bg-gray-500"} hover:opacity-90 transition-opacity`}
                                    >
                                      <div className="flex items-center gap-1 mb-0.5">
                                        {statusIcons[apt.status]}
                                        <span className="font-medium truncate">{apt.start_time.slice(0, 5)}</span>
                                      </div>
                                      <div className="truncate">{apt.title}</div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[250px]">
                                    <div className="space-y-1">
                                      <div className="font-medium">{apt.title}</div>
                                      <div className="flex items-center gap-1 text-xs">
                                        <Clock className="h-3 w-3" />
                                        {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                                      </div>
                                      {apt.location_city && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <MapPin className="h-3 w-3" />
                                          {apt.location_city}
                                        </div>
                                      )}
                                      {apt.customer_first_name && (
                                        <div className="text-xs text-muted-foreground">
                                          {apt.customer_first_name} {apt.customer_last_name}
                                        </div>
                                      )}
                                      <Badge variant="outline" className="text-[10px]">
                                        {APPOINTMENT_TYPE_COLORS[apt.appointment_type]?.label || apt.appointment_type}
                                      </Badge>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {dayAppointments.length === 0 && !isUnavailable && (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                Keine Termine
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Availability Dialog */}
      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verfügbarkeit bearbeiten</DialogTitle>
          </DialogHeader>
          {editState && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{editState.memberName}</span>
                {" – "}
                {format(editState.date, "EEEE, d. MMMM yyyy", { locale: de })}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="available">Verfügbar</Label>
                <Switch
                  id="available"
                  checked={editForm.isAvailable}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isAvailable: checked }))}
                />
              </div>

              {editForm.isAvailable && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Von</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Bis</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notiz (optional)</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={editForm.isAvailable ? "z.B. Homeoffice" : "z.B. Urlaub, Krank"}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editState?.existingAvailability?.specific_date && (
              <Button
                variant="destructive"
                onClick={deleteAvailability}
                disabled={saving || deleting}
                className="sm:mr-auto gap-2"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Löschen..." : "Löschen"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditState(null)} disabled={saving || deleting}>
              Abbrechen
            </Button>
            <Button onClick={saveAvailability} disabled={saving || deleting} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
