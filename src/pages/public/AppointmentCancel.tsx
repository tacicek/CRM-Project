import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, Clock, MapPin, CheckCircle2, XCircle, Building2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadIcsFile } from "@/lib/generateIcsFile";
import { documentI18nFor, resolveDocumentLocale } from "@/i18n/documentLocale";
import { toLocale } from "@/i18n/locale";
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
  // The customer's language, inherited from the lead. This page is addressed at the
  // customer, so it is the only correct source for the page's copy.
  language: string;
}

interface Company {
  company_name: string;
  email: string;
  notification_email: string | null;
  phone: string | null;
  default_language: string;
}

/**
 * Load/blocking conditions are kept as CODES rather than translated strings: the locale
 * is only known once the appointment row has arrived, so the message must be translated
 * at render time, not at the moment the error is discovered.
 */
type PageError = "invalid_link" | "not_found" | "load_failed";

const ERROR_KEYS: Record<PageError, MessageKey> = {
  invalid_link: "public.invalidLink",
  not_found: "public.appointment.notFoundOrEmailMismatch",
  load_failed: "public.error",
};

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
  const [error, setError] = useState<PageError | null>(null);

  // DOCUMENT locale — appointments.language, falling back to the company default for
  // rows written before the column existed.
  const { t, locale, dateLocale } = documentI18nFor(resolveDocumentLocale(appointment, company));

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
        setCancelled(true);
      }
      setAppointment(appointmentData);

      // Fetch company info — default_language is the fallback locale for this page and
      // the language of the cancellation reason we write back for the company to read.
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

  const handleCancel = async () => {
    if (!appointment) return;

    setSubmitting(true);
    try {
      // cancellation_reason is read by the COMPANY in the dashboard, so the default text
      // follows the company's language, not the customer's.
      const { t: companyT } = documentI18nFor(toLocale(company?.default_language));

      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: "customer",
          cancellation_reason: reason || companyT("public.cancel.defaultReason"),
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
      toast.success(t("public.cancel.toastSuccess"));
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      toast.error(t("public.cancel.toastFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // "PPPP" = locale-aware long date incl. weekday (Freitag, 14. Juli 2026 ·
  // vendredi 14 juillet 2026 · Friday, 14 July 2026).
  const formatFullDate = (dateStr: string) =>
    format(new Date(dateStr), "PPPP", { locale: dateLocale });

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

  if (cancelled) {
    return (
      <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle>{t("public.cancel.doneTitle")}</CardTitle>
            <CardDescription>
              {t("public.cancel.doneBody", { company: company?.company_name || "" })}
            </CardDescription>
          </CardHeader>
          {appointment && (
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="font-medium">{appointment.title}</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {formatFullDate(appointment.appointment_date)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {timeRange(appointment.start_time, appointment.end_time)}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle>{t("public.cancel.title")}</CardTitle>
          <CardDescription>{t("public.cancel.question")}</CardDescription>
        </CardHeader>

        {appointment && (
          <CardContent className="space-y-6">
            {/* Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-semibold text-lg">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type, locale)}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatFullDate(appointment.appointment_date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{timeRange(appointment.start_time, appointment.end_time)}</span>
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
              <label className="text-sm font-medium">{t("public.cancel.reason")}</label>
              <Textarea
                placeholder={t("public.cancel.placeholder")}
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
                {t("public.appointment.addToCalendar")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? t("public.cancel.submitting") : t("public.cancel.submit")}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {t("public.cancel.companyInformed", { company: company?.company_name || "" })}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
