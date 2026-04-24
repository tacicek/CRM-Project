import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, Clock, MapPin, CheckCircle2, XCircle, Building2, Download } from "lucide-react";
import { toast } from "sonner";
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

export default function AppointmentCancel() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [reason, setReason] = useState("");
  const [cancelled, setCancelled] = useState(false);
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
        setCancelled(true);
        setAppointment(appointmentData);
      } else {
        setAppointment(appointmentData);
      }

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

  const handleCancel = async () => {
    if (!appointment) return;
    
    setSubmitting(true);
    try {
      // Update appointment status
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: "customer",
          cancellation_reason: reason || "Vom Kunden abgesagt",
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      // Notify company via edge function
      await supabase.functions.invoke("notify-appointment-cancelled", {
        body: {
          appointmentId: appointment.id,
          appointmentTitle: appointment.title,
          appointmentDate: appointment.appointment_date,
          appointmentTime: appointment.start_time,
          customerName: `${appointment.customer_first_name || ""} ${appointment.customer_last_name || ""}`.trim(),
          customerEmail: appointment.customer_email,
          cancellationReason: reason,
          companyEmail: company?.notification_email || company?.email,
          companyName: company?.company_name,
        },
      });

      setCancelled(true);
      toast.success("Termin erfolgreich abgesagt");
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      toast.error("Fehler beim Absagen des Termins");
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

  if (cancelled) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle>Termin abgesagt</CardTitle>
            <CardDescription>
              Der Termin wurde erfolgreich abgesagt. {company?.company_name} wurde benachrichtigt.
            </CardDescription>
          </CardHeader>
          {appointment && (
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="font-medium">{appointment.title}</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {formatDate(appointment.appointment_date)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)} Uhr
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle>Termin absagen</CardTitle>
          <CardDescription>
            Möchten Sie diesen Termin wirklich absagen?
          </CardDescription>
        </CardHeader>
        
        {appointment && (
          <CardContent className="space-y-6">
            {/* Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-semibold text-lg">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type)}
              </div>
              
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(appointment.appointment_date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTime(appointment.start_time)} - {formatTime(appointment.end_time)} Uhr</span>
                </div>
                {appointment.location_address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {appointment.location_address}, {appointment.location_plz} {appointment.location_city}
                    </span>
                  </div>
                )}
                {company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{company.company_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Absagegrund (optional)
              </label>
              <Textarea
                placeholder="Teilen Sie uns mit, warum Sie absagen müssen..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadIcs}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Zum Kalender hinzufügen
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "Wird abgesagt..." : "Termin absagen"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {company?.company_name} wird über die Absage informiert.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}