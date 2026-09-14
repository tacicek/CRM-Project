import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useT } from "@/i18n/useI18n";
import { getAppointmentLabel } from "@/i18n/domain";
import { formatDate } from "@/i18n/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { manualAcceptanceFailure, manualAcceptanceWarning } from "@/lib/manualAcceptance";
import {
  buildAcceptanceTermine,
  type AcceptanceItemRow,
} from "../../../supabase/functions/_shared/acceptanceTermine.ts";
import { heuteIso } from "../../../supabase/functions/_shared/offerAcceptanceWindow.ts";

export interface ManualAcceptOffer {
  id: string;
  customer_email: string | null;
  valid_until: string | null;
  service_date: string | null;
  service_start_time: string | null;
}

interface ManualAcceptOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: ManualAcceptOffer;
  items: ReadonlyArray<AcceptanceItemRow>;
  onAccepted: () => Promise<void>;
}

const SKIP_REASONS = ["already_sent", "no_email", "no_api_key"] as const;
type SkipReason = (typeof SKIP_REASONS)[number];
const isSkipReason = (value: unknown): value is SkipReason =>
  typeof value === "string" && (SKIP_REASONS as readonly string[]).includes(value);

/**
 * Die Firma erfasst eine Zusage, die nicht ueber den Kundenlink kam — meist am
 * Telefon. Angenommen wird in der Datenbank (`accept_offer_manually`): derselbe
 * Weg wie beim Kunden, also derselbe Auftrag und dieselben Kalendertermine.
 *
 * Die Termine, die hier stehen, rechnet `buildAcceptanceTermine` — dieselbe
 * Funktion, mit der die Auftragsbestaetigung sie dem Kunden nennt.
 */
export const ManualAcceptOfferDialog = ({
  open,
  onOpenChange,
  offer,
  items,
  onAccepted,
}: ManualAcceptOfferDialogProps) => {
  const t = useT();
  const { locale } = useI18n();
  const hasEmail = Boolean(offer.customer_email?.trim());
  const [sendEmail, setSendEmail] = useState(hasEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSendEmail(hasEmail);
  }, [open, hasEmail]);

  const termine = buildAcceptanceTermine(items, offer);
  const warning = manualAcceptanceWarning(offer.valid_until, offer.service_date, items, heuteIso());

  const sendConfirmation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-offer-acceptance-confirmation", {
        body: { offerId: offer.id },
      });
      if (error) throw error;
      if (data?.skipped) {
        const reason: unknown = data.reason;
        // Der Endpunkt kennt genau diese drei Gruende. Ein anderer heisst: nicht
        // gesendet, aus einem Grund, den diese Oberflaeche nicht kennt.
        if (!isSkipReason(reason)) throw new Error(`unknown skip reason: ${String(reason)}`);
        toast.warning(t(`offer.detail.manualAccept.toast.emailSkipped.${reason}`));
        return;
      }
      toast.success(t("offer.detail.manualAccept.toast.emailSent"));
    } catch (error) {
      console.error("Acceptance confirmation email failed:", error);
      toast.error(t("offer.detail.manualAccept.toast.emailFailed"));
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("accept_offer_manually", { p_offer_id: offer.id });
      if (error) throw error;
    } catch (error) {
      console.error("Manual offer acceptance failed:", error);
      toast.error(t(`offer.detail.manualAccept.error.${manualAcceptanceFailure(error)}`));
      setIsSubmitting(false);
      return;
    }

    toast.success(t("offer.detail.manualAccept.toast.accepted.title"), {
      description: t("offer.detail.manualAccept.toast.accepted.description"),
    });

    if (sendEmail && hasEmail) {
      await sendConfirmation();
    }

    try {
      await onAccepted();
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            {t("offer.detail.manualAccept.title")}
          </DialogTitle>
          <DialogDescription>{t("offer.detail.manualAccept.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {warning.kind !== "none" && (
            <Alert
              className={cn(
                warning.kind === "workDatePassed"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-amber-300 bg-amber-50 text-amber-800",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                {warning.kind === "workDatePassed"
                  ? t("offer.detail.manualAccept.workDatePassed", { date: formatDate(warning.workDate, locale) })
                  : t("offer.detail.manualAccept.deadlinePassed", { date: formatDate(warning.deadline, locale) })}
              </AlertDescription>
            </Alert>
          )}

          {termine.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                {t("offer.detail.manualAccept.termine")}
              </p>
              <ul className="divide-y rounded-lg border bg-muted/30">
                {termine.map((termin) => (
                  <li
                    key={`${termin.serviceType ?? "offer"}-${termin.date}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-xs sm:text-sm"
                  >
                    <span className="text-muted-foreground">{getAppointmentLabel(termin.serviceType, locale)}</span>
                    <span className="font-medium">
                      {formatDate(termin.date, locale)}
                      {termin.startTime ? ` · ${t("doc.time.from", { start: termin.startTime })}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground sm:text-sm">{t("offer.detail.manualAccept.noTermin")}</p>
          )}

          {hasEmail ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="manual-accept-send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="manual-accept-send-email" className="text-xs font-normal leading-snug sm:text-sm">
                {t("offer.detail.manualAccept.sendEmail", { email: offer.customer_email ?? "" })}
              </Label>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground sm:text-sm">{t("offer.detail.manualAccept.noEmail")}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t("offer.detail.manualAccept.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
