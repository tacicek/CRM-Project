import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle2, XCircle, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { documentI18nFor } from "@/i18n/documentLocale";
import { toLocale } from "@/i18n/locale";
import { getAppointmentTypeLabel } from "@/i18n/domain";
import { type MessageKey } from "@/i18n/translator";

/**
 * /termin/:appointmentId/antwort — answering a reschedule REQUEST.
 *
 * ⚠️ This is the one public page that is NOT addressed at the customer. The link lives
 * in the notification e-mail that notify-appointment-reschedule sends to the COMPANY
 * (index.ts:83/84, embedded in `companyEmailHtml`); the operator confirms or declines the
 * date the customer proposed, and every string here talks *about* the customer ("Message
 * to the customer", "The customer will be notified"). Its locale is therefore
 * `companies.default_language` — driving it from `appointments.language` would render the
 * operator's page in the customer's language, which is exactly the leak src/i18n/README.md
 * warns about, only in reverse.
 */

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
  language: string;
}

type PageError = "invalid_link" | "not_found" | "already_cancelled" | "already_handled" | "load_failed";

const ERROR_KEYS: Record<PageError, MessageKey> = {
  invalid_link: "public.invalidLink",
  not_found: "public.appointment.notFound",
  already_cancelled: "public.cancel.alreadyCancelled",
  already_handled: "public.rescheduleResponse.alreadyHandled",
  load_failed: "public.error",
};

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
  const [companyLanguage, setCompanyLanguage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<PageError | null>(null);

  // OPERATOR locale — see the file header: the recipient of this page is the company.
  const { t, locale, dateLocale } = documentI18nFor(toLocale(companyLanguage));

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId || !token) {
      setError("invalid_link");
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
        setError("not_found");
        setLoading(false);
        return;
      }

      // The company's dashboard language drives this page — fetch it before any of the
      // blocking branches below, so even the error message reads in the operator's language.
      const { data: companyData } = await supabase
        .from("companies")
        .select("default_language")
        .eq("id", appointmentData.company_id)
        .maybeSingle();

      if (companyData) {
        setCompanyLanguage(companyData.default_language);
      }

      // Only block if appointment is cancelled, not if it's rescheduled
      if (appointmentData.status === "cancelled") {
        setError("already_cancelled");
        setLoading(false);
        return;
      }

      // Check if already processed (confirmed or completed)
      if (appointmentData.status === "confirmed" || appointmentData.status === "completed") {
        setError("already_handled");
        setLoading(false);
        return;
      }

      setAppointment(appointmentData);
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, token]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const isConfirm = action === "confirm";

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

      if (invokeError) throw invokeError;

      setCompleted(true);
      toast.success(
        isConfirm
          ? t("public.rescheduleResponse.confirmedTitle")
          : t("public.rescheduleResponse.rejectedTitle")
      );
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error(t("public.rescheduleResponse.toastFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // "PPPP" = locale-aware long date incl. weekday.
  const formatFullDate = (dateStr: string) =>
    format(new Date(dateStr), "PPPP", { locale: dateLocale });

  const formatTime = (timeStr: string) => timeStr.substring(0, 5);

  const timeRange = (start: string, end: string) =>
    t("doc.time.fromUntil", { start: formatTime(start), end: formatTime(end) });

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

  if (completed) {
    return (
      <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div
              className={cn(
                "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
                isConfirm ? "bg-green-100" : "bg-orange-100"
              )}
            >
              {isConfirm ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-orange-600" />
              )}
            </div>
            <CardTitle>
              {isConfirm
                ? t("public.rescheduleResponse.confirmedTitle")
                : t("public.rescheduleResponse.rejectedTitle")}
            </CardTitle>
            <CardDescription>
              {isConfirm
                ? t("public.rescheduleResponse.confirmedBody")
                : t("public.rescheduleResponse.rejectedBody")}
            </CardDescription>
          </CardHeader>
          {isConfirm && proposedDate && proposedTime && (
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-center">
                <div className="font-medium text-green-800">
                  {t("public.rescheduleResponse.newAppointment")}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  {formatFullDate(proposedDate)}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Clock className="h-4 w-4" />
                  {t("doc.time.oclock", { time: proposedTime })}
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
          <div
            className={cn(
              "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
              isConfirm ? "bg-green-100" : "bg-orange-100"
            )}
          >
            {isConfirm ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-orange-600" />
            )}
          </div>
          <CardTitle>
            {isConfirm
              ? t("public.rescheduleResponse.confirmTitle")
              : t("public.rescheduleResponse.rejectTitle")}
          </CardTitle>
          <CardDescription>
            {isConfirm
              ? t("public.rescheduleResponse.confirmIntro")
              : t("public.rescheduleResponse.rejectIntro")}
          </CardDescription>
        </CardHeader>

        {appointment && (
          <CardContent className="space-y-6">
            {/* Appointment Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="font-semibold">{appointment.title}</div>
              <div className="text-sm text-muted-foreground">
                {getAppointmentTypeLabel(appointment.appointment_type, locale)}
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
                <div className="text-xs text-red-600 font-medium mb-1">
                  {t("public.rescheduleResponse.originalAppointment")}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-red-500" />
                  {formatFullDate(appointment.appointment_date)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-red-500" />
                  {timeRange(appointment.start_time, appointment.end_time)}
                </div>
              </div>

              {/* Proposed New Date */}
              {proposedDate && proposedTime && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 font-medium mb-1">
                    {t("public.rescheduleResponse.proposedAppointment")}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <Calendar className="h-4 w-4" />
                    {formatFullDate(proposedDate)}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <Clock className="h-4 w-4" />
                    {t("doc.time.oclock", { time: proposedTime })}
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("public.rescheduleResponse.messageToCustomer")}
              </label>
              <Textarea
                placeholder={
                  isConfirm
                    ? t("public.rescheduleResponse.confirmPlaceholder")
                    : t("public.rescheduleResponse.rejectPlaceholder")
                }
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
                  ? t("public.processing")
                  : isConfirm
                    ? t("public.rescheduleResponse.confirmSubmit")
                    : t("public.rescheduleResponse.rejectSubmit")}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {t("public.rescheduleResponse.customerNotified")}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
