import { useState, useEffect, useCallback } from "react";
import { format, addDays, parse, isWeekend } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useT } from "@/i18n/useI18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Clock,
  Send,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  title: string;
  status: string;
}

interface BesichtigungRequest {
  id: string;
  title: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_response_note: string;
  /**
   * Vom Kunden gewünschter Termin — STRUKTURIERT (offers.besichtigung_requested_*).
   * Nicht aus `customer_response_note` parsen: der Satz steht in der Sprache der Firma,
   * und eine französische Firma schreibt "15/01/2026" statt "15.01.2026".
   */
  besichtigung_requested_date?: string | null;
  besichtigung_requested_time?: string | null;
  lead_id?: string;
}

interface SuggestedSlot {
  date: string;
  start_time: string;
  end_time: string;
  selected: boolean;
}

interface AcceptBesichtigungDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: BesichtigungRequest | null;
  companyId: string | null;
  onSuccess: () => void;
}

export const AcceptBesichtigungDialog = ({
  isOpen,
  onClose,
  request,
  companyId,
  onSuccess,
}: AcceptBesichtigungDialogProps) => {
  const t = useT();
  const { dateLocale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [activeTab, setActiveTab] = useState<"accept" | "propose">("accept");
  
  // Form state for accepting
  const [acceptDate, setAcceptDate] = useState("");
  const [acceptStartTime, setAcceptStartTime] = useState("09:00");
  const [acceptEndTime, setAcceptEndTime] = useState("10:00");
  
  // Form state for manual proposal
  const [manualSlots, setManualSlots] = useState<SuggestedSlot[]>([]);
  const [proposalMessage, setProposalMessage] = useState("");
  
  // Prefill the customer's requested slot from the STRUCTURED columns.
  //
  // This used to regex the sentence in `customer_response_note`
  // (/(\d{2})\.(\d{2})\.(\d{4})/). That sentence is written in the COMPANY's language,
  // so a French company stores "15/01/2026" and the regex silently misses — the date then
  // fell back to "today" with no error. Machine data now comes from machine columns; the
  // regex survives only as a fallback for notes written before those columns existed.
  useEffect(() => {
    if (request && isOpen) {
      const legacyDate = request.customer_response_note?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const legacyTime = request.customer_response_note?.match(/(\d{2}):(\d{2})/);

      if (request.besichtigung_requested_date) {
        setAcceptDate(request.besichtigung_requested_date);
      } else if (legacyDate) {
        const [, day, month, year] = legacyDate;
        setAcceptDate(`${year}-${month}-${day}`);
      } else {
        setAcceptDate(format(new Date(), "yyyy-MM-dd"));
      }

      const startTime =
        request.besichtigung_requested_time?.slice(0, 5) ??
        (legacyTime ? `${legacyTime[1]}:${legacyTime[2]}` : null);

      if (startTime) {
        const [hours, minutes] = startTime.split(":");
        setAcceptStartTime(startTime);
        // Default to 1 hour duration
        const endHour = (parseInt(hours, 10) + 1).toString().padStart(2, "0");
        setAcceptEndTime(`${endHour}:${minutes}`);
      }
      
      // Reset other state
      setConflicts([]);
      setSuggestedSlots([]);
      setManualSlots([]);
      setActiveTab("accept");
      setProposalMessage("");
    }
  }, [request, isOpen]);
  
  const generateAlternativeSlots = useCallback(async (_existingAppointments: Appointment[]) => {
    if (!companyId) return;
    
    const slots: SuggestedSlot[] = [];
    const _duration = 60; // 1 hour default
    const workStart = 8; // 8:00
    const workEnd = 18; // 18:00
    
    // Get appointments for next 7 days
    const startDate = new Date();
    const endDate = addDays(startDate, 7);
    
    const { data: weekAppointments } = await supabase
      .from("appointments")
      .select("*")
      .eq("company_id", companyId)
      .gte("appointment_date", format(startDate, "yyyy-MM-dd"))
      .lte("appointment_date", format(endDate, "yyyy-MM-dd"))
      .neq("status", "cancelled");
    
    // Find free slots for next 7 days
    for (let i = 0; i < 7 && slots.length < 5; i++) {
      const checkDate = addDays(startDate, i);
      if (isWeekend(checkDate)) continue;
      
      const dateStr = format(checkDate, "yyyy-MM-dd");
      const dayAppointments = weekAppointments?.filter(
        (apt) => apt.appointment_date === dateStr
      ) || [];
      
      // Check each hour slot
      for (let hour = workStart; hour < workEnd - 1 && slots.length < 5; hour++) {
        const slotStart = `${hour.toString().padStart(2, "0")}:00`;
        const slotEnd = `${(hour + 1).toString().padStart(2, "0")}:00`;
        
        const hasConflict = dayAppointments.some(
          (apt) => apt.start_time < slotEnd && apt.end_time > slotStart
        );
        
        if (!hasConflict) {
          slots.push({
            date: dateStr,
            start_time: slotStart,
            end_time: slotEnd,
            selected: slots.length < 3, // Pre-select first 3
          });
        }
      }
    }
    
    setSuggestedSlots(slots);
  }, [companyId]);

  // Shared conflict check - used by both debounced effect and immediate submit check
  const checkConflicts = useCallback(async (): Promise<Appointment[]> => {
    if (!companyId || !acceptDate || !acceptStartTime || !acceptEndTime) return [];
    
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("company_id", companyId)
      .eq("appointment_date", acceptDate)
      .neq("status", "cancelled");
    
    const conflicting = data?.filter((apt) => {
      return apt.start_time < acceptEndTime && apt.end_time > acceptStartTime;
    }) || [];
    
    return conflicting as Appointment[];
  }, [companyId, acceptDate, acceptStartTime, acceptEndTime]);

  // Check for conflicts when date/time changes (debounced)
  useEffect(() => {
    const runCheck = async () => {
      if (!companyId || !acceptDate || !acceptStartTime || !acceptEndTime) return;
      
      setCheckingConflicts(true);
      
      try {
        const conflicting = await checkConflicts();
        setConflicts(conflicting);
        
        if (conflicting.length > 0) {
          await generateAlternativeSlots(conflicting);
        } else {
          setSuggestedSlots([]);
        }
      } catch (error) {
        console.error("Error checking conflicts:", error);
      } finally {
        setCheckingConflicts(false);
      }
    };
    
    const debounceTimer = setTimeout(runCheck, 300);
    return () => clearTimeout(debounceTimer);
  }, [acceptDate, acceptStartTime, acceptEndTime, companyId, checkConflicts, generateAlternativeSlots]);
  
  const handleAccept = async () => {
    if (!companyId || !request) return;
    
    // FIX: Validate that end time is after start time
    if (acceptStartTime >= acceptEndTime) {
      toast.error(t("calendar.accept.error.endBeforeStart"));
      return;
    }

    // FIX: Validate minimum duration (at least 15 minutes)
    const [startH, startM] = acceptStartTime.split(":").map(Number);
    const [endH, endM] = acceptEndTime.split(":").map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (durationMinutes < 15) {
      toast.error(t("calendar.accept.error.minDuration"));
      return;
    }
    if (durationMinutes > 480) { // Max 8 hours
      toast.error(t("calendar.accept.error.maxDuration"));
      return;
    }

    // FIX: Immediate conflict check before submit (avoids race with debounce)
    setCheckingConflicts(true);
    const freshConflicts = await checkConflicts();
    setConflicts(freshConflicts);
    setCheckingConflicts(false);

    if (freshConflicts.length > 0) {
      toast.error(t("calendar.accept.error.conflicts"));
      return;
    }
    
    setLoading(true);
    
    try {
      // Create the appointment
      const { error: aptError } = await supabase.from("appointments").insert({
        company_id: companyId,
        offer_id: request.id,
        appointment_type: "besichtigung",
        status: "confirmed",
        appointment_date: acceptDate,
        start_time: acceptStartTime,
        end_time: acceptEndTime,
        // Operator's own calendar entry — the customer's confirmation e-mail renders the
        // appointment TYPE in the customer's language and never this title.
        title: t("calendar.appointmentTitle.besichtigung", {
          name: `${request.customer_first_name} ${request.customer_last_name}`,
        }),
        customer_first_name: request.customer_first_name,
        customer_last_name: request.customer_last_name,
        customer_email: request.customer_email,
        customer_phone: request.customer_phone,
        confirmed_by_firma: true,
      });
      
      if (aptError) throw aptError;
      
      // Send confirmation email to customer
      const { error: emailError } = await supabase.functions.invoke("confirm-besichtigung", {
        body: {
          type: "confirm",
          offerId: request.id,
          appointmentDate: acceptDate,
          startTime: acceptStartTime,
          endTime: acceptEndTime,
        },
      });
      
      if (emailError) {
        console.error("Email error:", emailError);
        toast.warning(t("calendar.accept.warn.emailFailed"));
      } else {
        toast.success(t("calendar.accept.success"));
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error accepting besichtigung:", error);
      toast.error(t("calendar.accept.error.failed"));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendProposals = async () => {
    if (!request) return;
    
    const selectedSlots = activeTab === "accept" 
      ? suggestedSlots.filter((s) => s.selected)
      : manualSlots.filter((s) => s.selected);
    
    if (selectedSlots.length === 0) {
      toast.error(t("calendar.accept.error.noSlots"));
      return;
    }
    
    setLoading(true);
    
    try {
      // Send proposal email to customer
      const { error: emailError } = await supabase.functions.invoke("confirm-besichtigung", {
        body: {
          type: "propose",
          offerId: request.id,
          proposals: selectedSlots.map((s) => ({
            date: s.date,
            startTime: s.start_time,
            endTime: s.end_time,
          })),
          message: proposalMessage,
        },
      });
      
      if (emailError) throw emailError;

      toast.success(t("calendar.accept.proposalsSent"));
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error sending proposals:", error);
      toast.error(t("calendar.accept.error.proposalsFailed"));
    } finally {
      setLoading(false);
    }
  };
  
  const addManualSlot = () => {
    setManualSlots([
      ...manualSlots,
      {
        date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
        start_time: "09:00",
        end_time: "10:00",
        selected: true,
      },
    ]);
  };
  
  const removeManualSlot = (index: number) => {
    setManualSlots(manualSlots.filter((_, i) => i !== index));
  };
  
  const updateManualSlot = (index: number, field: keyof SuggestedSlot, value: string | boolean) => {
    const updated = [...manualSlots];
    updated[index] = { ...updated[index], [field]: value };
    setManualSlots(updated);
  };
  
  const toggleSuggestedSlot = (index: number) => {
    const updated = [...suggestedSlots];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setSuggestedSlots(updated);
  };
  
  const formatSlotDisplay = (slot: SuggestedSlot) => {
    const date = parse(slot.date, "yyyy-MM-dd", new Date());
    return `${format(date, "EEEE, dd.MM.yyyy", { locale: dateLocale })} • ${slot.start_time} - ${slot.end_time}`;
  };
  
  if (!request) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t("calendar.accept.title")}
          </DialogTitle>
          <DialogDescription>
            {t("calendar.accept.description", {
              name: `${request.customer_first_name} ${request.customer_last_name}`,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Customer's requested time. The note itself is prose in the company's language —
            it is rendered verbatim, never re-translated. */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{t("calendar.besichtigung.customerWish")}</strong> {request.customer_response_note}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accept" | "propose")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accept" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t("calendar.accept.tab.accept")}
            </TabsTrigger>
            <TabsTrigger value="propose" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t("calendar.accept.tab.propose")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accept" className="space-y-4 mt-4">
            {/* Date and time selection */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accept-date">{t("common.date")}</Label>
                <DatePicker
                  id="accept-date"
                  value={acceptDate}
                  onChange={(value) => setAcceptDate(value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-start">{t("calendar.modal.start")}</Label>
                <Input
                  id="accept-start"
                  type="time"
                  value={acceptStartTime}
                  onChange={(e) => setAcceptStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-end">{t("calendar.modal.end")}</Label>
                <Input
                  id="accept-end"
                  type="time"
                  value={acceptEndTime}
                  onChange={(e) => setAcceptEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Checking indicator */}
            {checkingConflicts && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("calendar.accept.checking")}
              </div>
            )}

            {/* Conflict warning */}
            {conflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t("calendar.accept.conflict.title")}</strong>{" "}
                  {t("calendar.accept.conflict.body", { count: conflicts.length })}
                  <ul className="mt-2 space-y-1">
                    {conflicts.map((c) => (
                      <li key={c.id} className="text-sm">
                        • {c.title} ({c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)})
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {/* No conflict - ready to accept */}
            {!checkingConflicts && conflicts.length === 0 && acceptDate && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t("calendar.accept.noConflict")}
                </AlertDescription>
              </Alert>
            )}

            {/* Suggested alternatives when there are conflicts */}
            {conflicts.length > 0 && suggestedSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <Label className="text-sm font-medium">{t("calendar.accept.suggestions")}</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("calendar.accept.suggestionsHint")}
                </p>
                <div className="space-y-2">
                  {suggestedSlots.map((slot, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        slot.selected
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/30 hover:bg-muted/50"
                      }`}
                      onClick={() => toggleSuggestedSlot(index)}
                    >
                      <Checkbox checked={slot.selected} />
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{formatSlotDisplay(slot)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="propose" className="space-y-4 mt-4">
            {/* Manual slot selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t("calendar.accept.proposals")}</Label>
                <Button variant="outline" size="sm" onClick={addManualSlot}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t("common.add")}
                </Button>
              </div>

              {manualSlots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("calendar.accept.proposalsEmpty")}
                </p>
              )}
              
              <div className="space-y-3">
                {manualSlots.map((slot, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      slot.selected ? "bg-primary/10 border-primary" : "bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={slot.selected}
                      onCheckedChange={(checked) =>
                        updateManualSlot(index, "selected", !!checked)
                      }
                    />
                    <DatePicker
                      value={slot.date}
                      onChange={(value) => updateManualSlot(index, "date", value)}
                      className="w-auto"
                    />
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateManualSlot(index, "start_time", e.target.value)}
                      className="w-24"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateManualSlot(index, "end_time", e.target.value)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeManualSlot(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Message to customer */}
            <div className="space-y-2">
              <Label htmlFor="proposal-message">{t("calendar.accept.message")}</Label>
              <Textarea
                id="proposal-message"
                value={proposalMessage}
                onChange={(e) => setProposalMessage(e.target.value)}
                placeholder={t("calendar.accept.messagePlaceholder")}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("common.cancel")}
          </Button>

          {activeTab === "accept" ? (
            conflicts.length > 0 && suggestedSlots.some((s) => s.selected) ? (
              <Button onClick={handleSendProposals} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {t("calendar.accept.send")}
              </Button>
            ) : (
              <Button
                onClick={handleAccept}
                disabled={loading || conflicts.length > 0 || !acceptDate}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {t("calendar.besichtigung.confirmAppointment")}
              </Button>
            )
          ) : (
            <Button
              onClick={handleSendProposals}
              disabled={loading || manualSlots.filter((s) => s.selected).length === 0}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {t("calendar.accept.send")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
