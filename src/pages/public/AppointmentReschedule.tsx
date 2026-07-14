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
import { format, addDays } from "date-fns";
import { downloadIcsFile } from "@/lib/generateIcsFile";
import { documentI18nFor, resolveDocumentLocale } from "@/i18n/documentLocale";
import { getAppointmentTypeLabel } from "@/i18n/domain";
import { type MessageKey } from "@/i18n/translator";

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
  // The customer's language, inherited from the lead — this page addresses the customer.
  language: string;
}

interface Company {
  company_name: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
  default_language: string;
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

/**
 * Blocking conditions are kept as CODES, not as translated strings: the locale is only
 * known once the appointment row has arrived, so the message is translated at render.
 */
type PageError = "invalid_link" | "not_found" | "already_cancelled" | "already_requested" | "load_failed";

const ERROR_KEYS: Record<PageError, MessageKey> = {
  invalid_link: "public.invalidLink",
  not_found: "public.appointment.notFoundOrEmailMismatch",
  already_cancelled: "public.cancel.alreadyCancelled",
  already_requested: "public.reschedule.alreadyRequested",
  load_failed: "public.error",
};

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
  const [error, setError] = useState<PageError | null>(null);
  // The blocking states above short-circuit before the row is stored, so the locale of
  // their message would be lost — keep the row around for them as well.
  const [blockedLanguage, setBlockedLanguage] = useState<string | null>(null);

  // DOCUMENT locale — appointments.language, company default as the fallback.
  const { t, locale, dateLocale } = documentI18nFor(
    resolveDocumentLocale(appointment ?? { language: blockedLanguage }, company)
  );

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId || !email) {
      setError("invalid_link");
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
        setError("not_found");
        setLoading(false);
        return;
      }

      if (appointmentData.status === "cancelled") {
        setBlockedLanguage(appointmentData.language);
        setError("already_cancelled");
        setLoading(false);
        return;
      }

      if (appointmentData.status === "rescheduled") {
        setBlockedLanguage(appointmentData.language);
        setError("already_requested");
        setLoading(false);
        return;
      }

      setAppointment(appointmentData);

      // Fetch company info — default_language is the fallback locale for this page.
      const { data: companyData } = await supabase
        .from("companies")
        .select("company_name, email, notification_email, phone, default_language")
        .eq("id", appointmentData.company_id)
        .maybeSingle();

      if (companyData) {
        setCompany(companyData);
      }
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, email]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async () => {
    if (!appointment || !selectedDate || !selectedTime) {
      toast.error(t("public.reschedule.pickDateTime"));
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

      // The DB row is already flipped to "rescheduled" at this point; a failed notification
      // must not tell the customer their request was lost. Logged, not thrown — unchanged.
      if (invokeError) {
        console.error("Error invoking reschedule function:", invokeError);
      }

      setSubmitted(true);
      toast.success(t("public.reschedule.toastSent"));
    } catch (err) {
      console.error("Error submitting reschedule request:", err);
      toast.error(t("public.reschedule.toastFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // "PPPP" = locale-aware long date incl. weekday.
  const formatFullDate = (value: Date | string) =>
    format(value instanceof Date ? value : new Date(value), "PPPP", { locale: dateLocale });

  const formatTime = (timeStr: string) => timeStr.substring(0, 5);

  const timeRange = (start: string, end: string) =>
    t("doc.time.fromUntil", { start: formatTime(start), end: formatTime(end) });

  const handleDownloadIcs = () => {
    if (!appointment) return;

    const location = [
      appointment.location_address,
      appointment.location_plz,
      appointment.location_city,
    ].filter(Boolean).join(", ");

    downloadIcsFile({
      title: appointment.title,
      description: t("public.appointment.icsDescription", {
        company: company?.company_name || "",
      }),
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
      <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>{t("common.error")}</CardTitle>
            <CardDescription>{t(ERROR_KEYS[error])}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>{t("public.reschedule.doneTitle")}</CardTitle>
            <CardDescription>
              {t("public.reschedule.doneBody", { company: company?.company_name || "" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-medium text-center">{t("public.reschedule.proposed")}</div>
              <div className="flex items-center justify-center gap-2 text-primary">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate && formatFullDate(selectedDate)}
              </div>
              <div className="flex items-center justify-center gap-2 text-primary">
                <Clock className="h-4 w-4" />
                {t("doc.time.oclock", { time: selectedTime })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <CalendarClock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>{t("public.reschedule.title")}</CardTitle>
          <CardDescription>{t("public.reschedule.intro")}</CardDescription>
        </CardHeader>

        {appointment && (
          <CardContent className="space-y-6">
            {/* Current Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                {t("public.reschedule.current")}
              </div>
              <div className="font-semibold">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type, locale)}
              </div>

              <div className="space-y-2 pt-2 border-t text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{formatFullDate(appointment.appointment_date)}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{timeRange(appointment.start_time, appointment.end_time)}</span>
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
                {t("public.appointment.addToCalendar")}
              </Button>
            </div>

            {/* New Date Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t("public.reschedule.pickNewDate")}</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={dateLocale}
                  disabled={(date) => date < minDate}
                  className="rounded-md border"
                />
              </div>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("public.reschedule.newTime")}</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder={t("public.reschedule.pickTime")} />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {t("doc.time.oclock", { time })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("public.reschedule.message")}</label>
              <Textarea
                placeholder={t("public.reschedule.placeholder")}
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
                {submitting ? t("common.sending") : t("public.reschedule.submit")}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {t("public.reschedule.companyInformed", { company: company?.company_name || "" })}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
