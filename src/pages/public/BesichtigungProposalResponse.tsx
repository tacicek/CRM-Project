import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, Building2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { documentI18nFor } from "@/i18n/documentLocale";
import { toLocale } from "@/i18n/locale";
import { type MessageKey } from "@/i18n/translator";

/**
 * /besichtigung/:leadId/antwort — the customer picks one of the viewing dates the company
 * proposed.
 *
 * This page reads EVERYTHING from the query string — the link is built by `responseParams`
 * / `responseLink` in supabase/functions/confirm-besichtigung/index.ts — and never touches
 * the DB, so there is no row to read a `language` from. The locale therefore has to travel
 * in the link as `&lang=`, exactly like the other proposal data.
 */

interface ProposalData {
  leadId: string;
  companyId: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  address: string;
  proposals: {
    date: string;
    time: string;
  }[];
}

type PageError = "invalid_link" | "invalid_proposals" | "parse_error" | "load_error";

const ERROR_KEYS: Record<PageError, MessageKey> = {
  invalid_link: "public.invalidLink",
  invalid_proposals: "public.viewingProposal.invalidProposals",
  parse_error: "public.viewingProposal.parseError",
  load_error: "public.viewingProposal.loadError",
};

export default function BesichtigungProposalResponse() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<string>("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [action, setAction] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<PageError | null>(null);

  // DOCUMENT locale — carried in the link, because this page has no row to read it from.
  // An absent or unknown value degrades to German rather than to a broken page.
  const { t, locale, dateLocale } = documentI18nFor(toLocale(searchParams.get("lang")));

  const parseProposalData = useCallback(() => {
    if (!leadId || !token) {
      setError("invalid_link");
      setLoading(false);
      return;
    }

    try {
      // Parse proposal data from URL params
      const companyId = searchParams.get("companyId");
      const companyName = searchParams.get("companyName");
      const customerName = searchParams.get("customerName");
      const customerEmail = searchParams.get("customerEmail");
      const address = searchParams.get("address");
      const proposalsParam = searchParams.get("proposals");

      if (!companyId || !companyName || !proposalsParam) {
        setError("invalid_proposals");
        setLoading(false);
        return;
      }

      let proposals: { date: string; time: string }[];
      try {
        proposals = JSON.parse(decodeURIComponent(proposalsParam));
        if (!Array.isArray(proposals)) {
          throw new Error("Invalid proposals format");
        }
      } catch (parseErr) {
        console.error("Error parsing proposal data:", parseErr);
        setError("parse_error");
        setLoading(false);
        return;
      }

      setProposalData({
        leadId,
        companyId,
        companyName: decodeURIComponent(companyName),
        customerName: customerName ? decodeURIComponent(customerName) : "",
        customerEmail: customerEmail ? decodeURIComponent(customerEmail) : "",
        address: address ? decodeURIComponent(address) : "",
        proposals,
      });
    } catch (err) {
      console.error("Error parsing proposal data:", err);
      setError("load_error");
    } finally {
      setLoading(false);
    }
  }, [leadId, token, searchParams]);

  useEffect(() => {
    parseProposalData();
  }, [parseProposalData]);

  const handleAccept = async () => {
    if (!proposalData || !selectedProposal) {
      toast.error(t("public.viewingProposal.selectRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const selectedIndex = parseInt(selectedProposal);
      const selected = proposalData.proposals[selectedIndex];

      const { error: invokeError } = await supabase.functions.invoke("handle-proposal-response", {
        body: {
          leadId: proposalData.leadId,
          companyId: proposalData.companyId,
          action: "accept",
          selectedDate: selected.date,
          selectedTime: selected.time,
          customerMessage: message,
          customerName: proposalData.customerName,
          customerEmail: proposalData.customerEmail,
          companyName: proposalData.companyName,
          address: proposalData.address,
          token,
        },
      });

      if (invokeError) throw invokeError;

      setAction("accepted");
      setCompleted(true);
      toast.success(t("public.viewingProposal.confirmedTitle"));
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error(t("public.viewingProposal.confirmFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke("handle-proposal-response", {
        body: {
          leadId: proposalData?.leadId,
          companyId: proposalData?.companyId,
          action: "reject",
          customerMessage: message,
          customerName: proposalData?.customerName,
          customerEmail: proposalData?.customerEmail,
          companyName: proposalData?.companyName,
          token,
        },
      });

      if (invokeError) throw invokeError;

      setAction("rejected");
      setCompleted(true);
      toast.success(t("public.viewingProposal.rejectedTitle"));
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error(t("public.viewingProposal.rejectFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // "PPPP" = locale-aware long date incl. weekday.
  const formatFullDate = (dateStr: string) =>
    format(new Date(dateStr), "PPPP", { locale: dateLocale });

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
    const isAccepted = action === "accepted";
    const selected = isAccepted && selectedProposal
      ? proposalData?.proposals[parseInt(selectedProposal)]
      : null;

    return (
      <div lang={locale} className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div
              className={cn(
                "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
                isAccepted ? "bg-green-100" : "bg-orange-100"
              )}
            >
              {isAccepted ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-orange-600" />
              )}
            </div>
            <CardTitle>
              {isAccepted
                ? t("public.viewingProposal.confirmedTitle")
                : t("public.viewingProposal.rejectedTitle")}
            </CardTitle>
            <CardDescription>
              {isAccepted
                ? t("public.viewingProposal.confirmedBody", {
                    company: proposalData?.companyName ?? "",
                  })
                : t("public.viewingProposal.rejectedBody", {
                    company: proposalData?.companyName ?? "",
                  })}
            </CardDescription>
          </CardHeader>
          {isAccepted && selected && (
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-center">
                <div className="font-medium text-green-800">
                  {t("public.viewingProposal.yourAppointment")}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  {formatFullDate(selected.date)}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Clock className="h-4 w-4" />
                  {t("doc.time.oclock", { time: selected.time })}
                </div>
                {proposalData?.address && (
                  <div className="flex items-center justify-center gap-2 text-green-700 pt-2 border-t border-green-200 mt-2">
                    <MapPin className="h-4 w-4" />
                    {proposalData.address}
                  </div>
                )}
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
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>{t("public.viewingProposal.title")}</CardTitle>
          <CardDescription>
            {t("public.viewingProposal.introCompany", {
              company: proposalData?.companyName ?? "",
            })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Company Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{proposalData?.companyName}</span>
            </div>
            {proposalData?.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{proposalData.address}</span>
              </div>
            )}
          </div>

          {/* Proposal Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("public.viewingProposal.intro")}</Label>
            <RadioGroup value={selectedProposal} onValueChange={setSelectedProposal}>
              {proposalData?.proposals.map((proposal, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedProposal === index.toString()
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedProposal(index.toString())}
                >
                  <RadioGroupItem value={index.toString()} id={`proposal-${index}`} />
                  <Label htmlFor={`proposal-${index}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium">{formatFullDate(proposal.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{t("doc.time.oclock", { time: proposal.time })}</span>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("public.messageOptional")}</Label>
            <Textarea
              placeholder={t("public.viewingProposal.messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleAccept}
              disabled={submitting || !selectedProposal}
              className="w-full"
            >
              {submitting ? t("public.processing") : t("public.viewingProposal.confirmSubmit")}
            </Button>
            <Button
              onClick={handleReject}
              disabled={submitting}
              variant="outline"
              className="w-full"
            >
              {t("public.viewingProposal.none")}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {t("public.viewingProposal.companyNotified")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
