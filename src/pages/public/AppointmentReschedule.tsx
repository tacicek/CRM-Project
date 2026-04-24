import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, XCircle, Building2, Download } from "lucide-react";
import { toast } from "sonner";
import { de } from "date-fns/locale";
import { format, addDays } from "date-fns";
import { downloadIcsFile } from "@/lib/generateIcsFile";

interface Appointment {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  location_address: string | null;
  location_plz: string | null;
  location_city: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  status: string;
  company_id: string;
}

interface Company {
  company_name: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

export default function AppointmentReschedule() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId || !email) {
      setError("Ungültiger Link. Bitte verwenden Sie den Link aus Ihrer E-Mail.");
      setLoading(false);
      return;
    }

    try {
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .eq("customer_email", email)
        .maybeSingle();

      if (appointmentError) throw appointmentError;

      if (!appointmentData) {
        setError("Termin nicht gefunden oder E-Mail-Adresse stimmt nicht überein.");
        setLoading(false);
        return;
      }

      if (appointmentData.status === "cancelled") {
        setError("Dieser Termin wurde bereits abgesagt.");
        setLoading(false);
        return;
      }

      if (appointmentData.status === "rescheduled") {
        setError("Für diesen Termin wurde bereits eine Verschiebung angefragt.");
        setLoading(false);
        return;
      }

      setAppointment(appointmentData);

      // Fetch company info
      const { data: companyData } = await supabase
        .from("companies")
        .select("company_name, email, notification_email, phone")
        .eq("id", appointmentData.company_id)
        .maybeSingle();

      if (companyData) {
        setCompany(companyData);
      }
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, email]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async () => {
    if (!appointment || !selectedDate || !selectedTime) {
      toast.error("Bitte wählen Sie ein Datum und eine Uhrzeit aus.");
      return;
    }
    
    setSubmitting(true);
    try {
      // Update appointment status to rescheduled
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "rescheduled",
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      // Notify company via edge function
      const { error: invokeError } = await supabase.functions.invoke("notify-appointment-reschedule", {
        body: {
          appointmentId: appointment.id,
          appointmentTitle: appointment.title,
          originalDate: appointment.appointment_date,
          originalTime: appointment.start_time,
          proposedDate: format(selectedDate, "yyyy-MM-dd"),
          proposedTime: selectedTime,
          customerName: `${appointment.customer_first_name || ""} ${appointment.customer_last_name || ""}`.trim(),
          customerEmail: appointment.customer_email,
          customerMessage: message,
          companyEmail: company?.notification_email || company?.email,
          companyName: company?.company_name,
          companyId: appointment.company_id,
        },
      });

      if (invokeError) {
        console.error("Error invoking reschedule function:", invokeError);
      }

      setSubmitted(true);
      toast.success("Terminvorschlag gesendet");
    } catch (err) {
      console.error("Error submitting reschedule request:", err);
      toast.error("Fehler beim Senden des Terminvorschlags");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const getAppointmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      besichtigung: "Besichtigung",
      service: "Auftrag",
      follow_up: "Nachkontrolle",
      meeting: "Besprechung",
    };
    return labels[type] || type;
  };

  const handleDownloadIcs = () => {
    if (!appointment) return;
    
    const location = [
      appointment.location_address,
      appointment.location_plz,
      appointment.location_city,
    ].filter(Boolean).join(", ");

    downloadIcsFile({
      title: appointment.title,
      description: `Termin bei ${company?.company_name || ""}`,
      date: appointment.appointment_date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      location: location || undefined,
      organizerName: company?.company_name,
      organizerEmail: company?.email,
    });
  };

  // Disable past dates and the next 24 hours
  const minDate = addDays(new Date(), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Fehler</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Terminvorschlag gesendet</CardTitle>
            <CardDescription>
              Ihr Terminvorschlag wurde an {company?.company_name} gesendet. Sie erhalten eine Bestätigung per E-Mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-medium text-center">Vorgeschlagener Termin</div>
              <div className="flex items-center justify-center gap-2 text-primary">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate && format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}
              </div>
              <div className="flex items-center justify-center gap-2 text-primary">
                <Clock className="h-4 w-4" />
                {selectedTime} Uhr
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <CalendarClock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>Termin verschieben</CardTitle>
          <CardDescription>
            Schlagen Sie einen neuen Termin vor
          </CardDescription>
        </CardHeader>
        
        {appointment && (
          <CardContent className="space-y-6">
            {/* Current Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Aktueller Termin</div>
              <div className="font-semibold">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type)}
              </div>
              
              <div className="space-y-2 pt-2 border-t text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{formatDate(appointment.appointment_date)}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(appointment.start_time)} - {formatTime(appointment.end_time)} Uhr</span>
                </div>
                {appointment.location_address && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {appointment.location_address}, {appointment.location_plz} {appointment.location_city}
                    </span>
                  </div>
                )}
                {company && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{company.company_name}</span>
                  </div>
                )}
              </div>
              
              {/* Calendar Download */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadIcs}
                className="w-full mt-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Zum Kalender hinzufügen
              </Button>
            </div>

            {/* New Date Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Neues Datum auswählen</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={de}
                  disabled={(date) => date < minDate}
                  className="rounded-md border"
                />
              </div>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gewünschte Uhrzeit</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Uhrzeit wählen" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time} Uhr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nachricht (optional)
              </label>
              <Textarea
                placeholder="Teilen Sie uns mit, warum Sie verschieben möchten..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedDate || !selectedTime}
                className="w-full"
              >
                {submitting ? "Wird gesendet..." : "Terminvorschlag senden"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {company?.company_name} wird über Ihren Terminvorschlag informiert und wird sich bei Ihnen melden.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
