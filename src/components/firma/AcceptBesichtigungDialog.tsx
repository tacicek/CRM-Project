import { useState, useEffect, useCallback } from "react";
import { format, addDays, parse, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  
  // Parse customer's requested date from the response note
  useEffect(() => {
    if (request?.customer_response_note && isOpen) {
      // Parse the note: "Besichtigung gewünscht am 22.12.2025 um 15:51 Uhr"
      const dateMatch = request.customer_response_note.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      const timeMatch = request.customer_response_note.match(/(\d{2}):(\d{2})/);
      
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        setAcceptDate(`${year}-${month}-${day}`);
      } else {
        setAcceptDate(format(new Date(), "yyyy-MM-dd"));
      }
      
      if (timeMatch) {
        const [, hours, minutes] = timeMatch;
        setAcceptStartTime(`${hours}:${minutes}`);
        // Default to 1 hour duration
        const endHour = (parseInt(hours) + 1).toString().padStart(2, "0");
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
      toast.error("Endzeit muss nach der Startzeit liegen");
      return;
    }

    // FIX: Validate minimum duration (at least 15 minutes)
    const [startH, startM] = acceptStartTime.split(":").map(Number);
    const [endH, endM] = acceptEndTime.split(":").map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (durationMinutes < 15) {
      toast.error("Besichtigung muss mindestens 15 Minuten dauern");
      return;
    }
    if (durationMinutes > 480) { // Max 8 hours
      toast.error("Besichtigung darf maximal 8 Stunden dauern");
      return;
    }
    
    // FIX: Immediate conflict check before submit (avoids race with debounce)
    setCheckingConflicts(true);
    const freshConflicts = await checkConflicts();
    setConflicts(freshConflicts);
    setCheckingConflicts(false);
    
    if (freshConflicts.length > 0) {
      toast.error("Es gibt Terminkonflikte. Bitte wählen Sie eine andere Zeit oder senden Sie Vorschläge.");
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
        title: `Besichtigung - ${request.customer_first_name} ${request.customer_last_name}`,
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
        toast.warning("Termin erstellt, aber E-Mail konnte nicht gesendet werden");
      } else {
        toast.success("Besichtigung bestätigt und Kunde benachrichtigt");
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error accepting besichtigung:", error);
      toast.error("Fehler beim Bestätigen der Besichtigung");
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
      toast.error("Bitte wählen Sie mindestens einen Terminvorschlag aus");
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
      
      toast.success("Terminvorschläge an Kunde gesendet");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error sending proposals:", error);
      toast.error("Fehler beim Senden der Vorschläge");
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
    return `${format(date, "EEEE, dd.MM.yyyy", { locale: de })} • ${slot.start_time} - ${slot.end_time}`;
  };
  
  if (!request) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Besichtigung bestätigen
          </DialogTitle>
          <DialogDescription>
            Anfrage von {request.customer_first_name} {request.customer_last_name}
          </DialogDescription>
        </DialogHeader>
        
        {/* Customer's requested time */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Kundenwunsch:</strong> {request.customer_response_note}
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accept" | "propose")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accept" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Termin bestätigen
            </TabsTrigger>
            <TabsTrigger value="propose" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Alternativen vorschlagen
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="accept" className="space-y-4 mt-4">
            {/* Date and time selection */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accept-date">Datum</Label>
                <Input
                  id="accept-date"
                  type="date"
                  value={acceptDate}
                  onChange={(e) => setAcceptDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-start">Start</Label>
                <Input
                  id="accept-start"
                  type="time"
                  value={acceptStartTime}
                  onChange={(e) => setAcceptStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-end">Ende</Label>
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
                Prüfe Kalender...
              </div>
            )}
            
            {/* Conflict warning */}
            {conflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Terminkonflikt!</strong> Es gibt {conflicts.length} überschneidende Termine:
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
                  Keine Konflikte - der Termin kann bestätigt werden.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Suggested alternatives when there are conflicts */}
            {conflicts.length > 0 && suggestedSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <Label className="text-sm font-medium">Automatische Vorschläge</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie die Termine aus, die Sie dem Kunden vorschlagen möchten:
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
                <Label className="text-sm font-medium">Terminvorschläge</Label>
                <Button variant="outline" size="sm" onClick={addManualSlot}>
                  <Plus className="w-4 h-4 mr-1" />
                  Hinzufügen
                </Button>
              </div>
              
              {manualSlots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Klicken Sie auf "Hinzufügen" um Terminvorschläge zu erstellen.
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
                    <Input
                      type="date"
                      value={slot.date}
                      onChange={(e) => updateManualSlot(index, "date", e.target.value)}
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
              <Label htmlFor="proposal-message">Nachricht an Kunde (optional)</Label>
              <Textarea
                id="proposal-message"
                value={proposalMessage}
                onChange={(e) => setProposalMessage(e.target.value)}
                placeholder="z.B. Leider ist der gewünschte Termin nicht verfügbar. Bitte wählen Sie einen der folgenden Termine..."
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          
          {activeTab === "accept" ? (
            conflicts.length > 0 && suggestedSlots.some((s) => s.selected) ? (
              <Button onClick={handleSendProposals} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Vorschläge senden
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
                Termin bestätigen
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
              Vorschläge senden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
