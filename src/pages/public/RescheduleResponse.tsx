import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle2, XCircle, User } from "lucide-react";
import { toast } from "sonner";

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
  customer_phone: string | null;
  status: string;
  company_id: string;
}

export default function RescheduleResponse() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  
  const action = searchParams.get("action"); // "confirm" or "reject"
  const proposedDate = searchParams.get("date");
  const proposedTime = searchParams.get("time");
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId || !token) {
      setError("Ungültiger Link. Bitte verwenden Sie den Link aus Ihrer E-Mail.");
      setLoading(false);
      return;
    }

    try {
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();

      if (appointmentError) throw appointmentError;

      if (!appointmentData) {
        setError("Termin nicht gefunden.");
        setLoading(false);
        return;
      }

      // Only block if appointment is cancelled, not if it's rescheduled
      if (appointmentData.status === "cancelled") {
        setError("Dieser Termin wurde bereits abgesagt.");
        setLoading(false);
        return;
      }

      // Check if already processed (confirmed or completed)
      if (appointmentData.status === "confirmed" || appointmentData.status === "completed") {
        setError("Dieser Termin wurde bereits bearbeitet.");
        setLoading(false);
        return;
      }

      setAppointment(appointmentData);
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, token]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async () => {
    if (!appointment || !action) return;
    
    setSubmitting(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke("handle-reschedule-response", {
        body: {
          appointmentId: appointment.id,
          action,
          proposedDate,
          proposedTime,
          message,
          token,
        },
      });

      if (invokeError) {
        console.error("Error handling response:", invokeError);
        throw invokeError;
      }

      setCompleted(true);
      toast.success(action === "confirm" ? "Termin bestätigt" : "Anfrage abgelehnt");
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error("Fehler beim Verarbeiten der Anfrage");
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

  if (completed) {
    const isConfirm = action === "confirm";
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 ${isConfirm ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mb-4`}>
              {isConfirm ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-orange-600" />
              )}
            </div>
            <CardTitle>
              {isConfirm ? "Termin bestätigt" : "Anfrage abgelehnt"}
            </CardTitle>
            <CardDescription>
              {isConfirm 
                ? `Der neue Termin wurde bestätigt. Der Kunde wurde per E-Mail informiert.`
                : `Die Verschiebungsanfrage wurde abgelehnt. Der Kunde wurde per E-Mail informiert.`
              }
            </CardDescription>
          </CardHeader>
          {isConfirm && proposedDate && proposedTime && (
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-center">
                <div className="font-medium text-green-800">Neuer Termin</div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  {formatDate(proposedDate)}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Clock className="h-4 w-4" />
                  {proposedTime} Uhr
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  const isConfirm = action === "confirm";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className={`mx-auto w-16 h-16 ${isConfirm ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mb-4`}>
            {isConfirm ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-orange-600" />
            )}
          </div>
          <CardTitle>
            {isConfirm ? "Terminverschiebung bestätigen" : "Terminverschiebung ablehnen"}
          </CardTitle>
          <CardDescription>
            {isConfirm 
              ? "Bestätigen Sie den neuen Termin für diesen Kunden"
              : "Lehnen Sie die Verschiebungsanfrage ab"
            }
          </CardDescription>
        </CardHeader>
        
        {appointment && (
          <CardContent className="space-y-6">
            {/* Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-semibold">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type)}
              </div>
              
              {/* Customer Info */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {appointment.customer_first_name} {appointment.customer_last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{appointment.customer_email}</div>
                </div>
              </div>

              {/* Original Date */}
              <div className="bg-red-50 rounded-lg p-3 mt-3">
                <div className="text-xs text-red-600 font-medium mb-1">Ursprünglicher Termin</div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-red-500" />
                  {formatDate(appointment.appointment_date)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-red-500" />
                  {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)} Uhr
                </div>
              </div>

              {/* Proposed New Date */}
              {proposedDate && proposedTime && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 font-medium mb-1">Vorgeschlagener neuer Termin</div>
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <Calendar className="h-4 w-4" />
                    {formatDate(proposedDate)}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <Clock className="h-4 w-4" />
                    {proposedTime} Uhr
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nachricht an den Kunden (optional)
              </label>
              <Textarea
                placeholder={isConfirm 
                  ? "Wir freuen uns auf den Termin..." 
                  : "Leider können wir den vorgeschlagenen Termin nicht annehmen..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                variant={isConfirm ? "default" : "destructive"}
                className="w-full"
              >
                {submitting 
                  ? "Wird verarbeitet..." 
                  : isConfirm 
                    ? "Neuen Termin bestätigen" 
                    : "Anfrage ablehnen"
                }
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Der Kunde wird per E-Mail über Ihre Entscheidung informiert.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
