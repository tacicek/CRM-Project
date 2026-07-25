import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";
import { useT, useI18n } from "@/i18n/useI18n";
import { formatDate } from "@/i18n/format";
import { getServiceLabel } from "@/i18n/domain";
import { toLocale } from "@/i18n/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { ExtractedLeadForm } from "@/components/leads/ExtractedLeadForm";
import { extractedLeadToLeadData } from "@/lib/extractedLeadToLeadData";
import type { ExtractedData } from "@/types/extractedLead";

/**
 * Review queue for inbound customer emails.
 *
 * Mid-confidence mails are parked here instead of becoming leads on their own.
 * The operator sees what the model understood, corrects it and approves — or
 * rejects the mail, or re-runs a failed one.
 *
 * Two things this screen deliberately does NOT do:
 *  - It never renders the original HTML. Only the capped plain-text preview the
 *    pipeline stored; the mail is written by a stranger.
 *  - It does not insert leads itself. Approving calls `import-manual-lead`, the
 *    same function the manual import uses, so a mail-sourced lead is built by
 *    exactly the same rules.
 */

type ProcessingStatus = "needs_review" | "lead_created" | "rejected" | "failed";

const TABS = [
  { status: "needs_review", labelKey: "lead.inbox.tab.needsReview" },
  { status: "lead_created", labelKey: "lead.inbox.tab.converted" },
  { status: "rejected", labelKey: "lead.inbox.tab.rejected" },
  { status: "failed", labelKey: "lead.inbox.tab.failed" },
] as const;

/** Outcome of a retry → the message shown to the operator. */
const RETRY_STATUS_KEYS = {
  lead_created: "lead.inbox.status.leadCreated",
  needs_review: "lead.inbox.status.needsReview",
  rejected: "lead.inbox.status.rejected",
  failed: "lead.inbox.status.failed",
} as const;

interface Company {
  id: string;
  company_name: string;
  default_language: string;
  /** Eigene Adressen — nie die des Kunden, siehe isPlausibleCustomerAddress. */
  email: string | null;
  notification_email: string | null;
  resend_from_email: string | null;
}

interface InboundEmail {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_preview: string | null;
  processing_status: ProcessingStatus;
  classification: string | null;
  confidence_score: number | null;
  rejection_reason: string | null;
  missing_critical_fields: string[] | null;
  extracted_data: Record<string, unknown> | null;
  attachments: { filename: string; contentType: string; sizeBytes: number | null }[] | null;
  lead_id: string | null;
  processing_attempts: number;
  last_error: string | null;
  received_at: string;
  /** NULL = von niemandem angeschaut. Gemeinsamer Stand für das ganze Team. */
  opened_at: string | null;
}

/**
 * Senders that are never a customer. Same rule the pipeline applies before it
 * writes an address into a lead — a bounce or no-reply address in customer_email
 * poisons the follow-up mail.
 */
const SYSTEM_SENDERS = /^(noreply|no-reply|no_reply|donotreply|do-not-reply|bounce|bounces|mailer-daemon|postmaster)([+.]|$)/i;

/**
 * The sender is NOT automatically the customer: when the company forwards its
 * own mailbox to the receiving address, many forwarders replace the sender with
 * that mailbox. Filling `info@…` in as the customer would mail the offer back to
 * the company itself — an empty field that the operator completes is better.
 */
const isPlausibleCustomerAddress = (address: string, ownAddresses: string[]): boolean => {
  const candidate = address.trim().toLowerCase();
  if (!candidate.includes("@")) return false;
  if (ownAddresses.some((own) => own && own.trim().toLowerCase() === candidate)) return false;
  return !SYSTEM_SENDERS.test(candidate.split("@")[0] ?? "");
};

/**
 * The stored JSON carries the extraction schema plus the three fields the
 * pipeline copies in for exactly this purpose (service type, customer language,
 * confidence). Anything missing degrades to a usable default rather than
 * crashing the form.
 */
const toExtractedData = (
  row: InboundEmail,
  company: Company | null,
): ExtractedData | null => {
  if (!row.extracted_data) return null;
  const source = row.extracted_data as Partial<ExtractedData>;
  return {
    ...source,
    detected_service_type: source.detected_service_type ?? row.classification ?? "umzug_privat",
    language: toLocale(source.language ?? company?.default_language),
    confidence_score: source.confidence_score ?? row.confidence_score ?? 0,
    first_name: source.first_name ?? null,
    last_name: source.last_name ?? null,
    // The sender address is the most reliable fact in the whole mail. The model
    // only reports what stood in the TEXT, so it lists "email" as missing even
    // though the header carries it. The automatic path fills it in the same way;
    // without this the operator would retype an address that is on screen.
    email: source.email ??
      (isPlausibleCustomerAddress(row.from_email, [
        company?.email ?? "",
        company?.notification_email ?? "",
        company?.resend_from_email ?? "",
      ])
        ? row.from_email
        : null),
    phone: source.phone ?? null,
    preferred_date: source.preferred_date ?? null,
    preferred_time: source.preferred_time ?? null,
    special_notes: source.special_notes ?? null,
  };
};

/**
 * Farbe des Sicherheitswerts — dieselben Statusfarben wie in Aufträgen und
 * Offerten, damit "grün heisst erledigt" überall dasselbe bedeutet. Die Grenzen
 * entsprechen den Entscheidungsschwellen: grün = automatisch übernommen,
 * gelb = zur Prüfung, rot = abgelehnt.
 */
const confidenceTone = (score: number | null): string => {
  if (score === null) return "bg-folk-bg-warm text-folk-ink3";
  if (score >= 0.85) return "bg-folk-mint-bg text-folk-mint";
  if (score >= 0.6) return "bg-folk-lemon-bg text-folk-lemon";
  return "bg-folk-coral-bg text-folk-coral";
};

const FirmaEmailImport = () => {
  const { user } = useAuth();
  const t = useT();
  // Dashboard locale — the operator reads this screen. The CUSTOMER's language is
  // a separate, captured value (extractedData.language) and never comes from here.
  const { locale } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isMountedRef = useRef(true);

  const [company, setCompany] = useState<Company | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>("needs_review");
  const [rows, setRows] = useState<InboundEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<InboundEmail | null>(null);
  const [draft, setDraft] = useState<ExtractedData | null>(null);
  const [busy, setBusy] = useState(false);
  /** Ungelesene je Tab — die Zahl neben dem Reiter. */
  const [unreadPerStatus, setUnreadPerStatus] = useState<Record<string, number>>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        if (isMountedRef.current) setIsLoading(false);
        return;
      }
      try {
        const companyData = await fetchSingleCompanyForUser<Company>({
          userId: user.id,
          userEmail: user.email,
          select: "id, company_name, default_language, email, notification_email, resend_from_email",
        });
        if (isMountedRef.current) setCompany(companyData ?? null);
      } catch {
        // Not swallowed: the operator sees the failure and the screen stays empty
        // rather than pretending there is nothing in the inbox.
        if (isMountedRef.current) {
          toast({
            title: t("common.error"),
            description: t("lead.import.companyLoadFailed"),
            variant: "destructive",
          });
        }
      }
    };
    load();
  }, [user, t, toast]);

  const loadRows = useCallback(async () => {
    if (!company) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select(
          "id, from_email, from_name, subject, body_preview, processing_status, classification, confidence_score, rejection_reason, missing_critical_fields, extracted_data, attachments, lead_id, processing_attempts, last_error, received_at, opened_at",
        )
        .eq("company_id", company.id)
        .eq("processing_status", status)
        .order("received_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!isMountedRef.current) return;
      setRows((data ?? []) as unknown as InboundEmail[]);
    } catch {
      if (!isMountedRef.current) return;
      toast({
        title: t("common.error"),
        description: t("lead.inbox.loadFailed"),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [company, status, t, toast]);

  /**
   * Ungelesene je Status — eine Abfrage für alle vier Reiter. Ohne diese Zahlen
   * merkt niemand, dass unter "Übernommen" etwas Neues liegt: der Reiter sieht
   * immer gleich aus, egal was passiert ist.
   */
  const loadUnreadCounts = useCallback(async () => {
    if (!company) return;
    const { data, error } = await supabase
      .from("inbound_emails")
      .select("processing_status")
      .eq("company_id", company.id)
      .is("opened_at", null);

    if (error || !isMountedRef.current) return;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const key = (row as { processing_status: string }).processing_status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    setUnreadPerStatus(counts);
  }, [company]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadUnreadCounts();
  }, [loadUnreadCounts]);

  const openItem = useCallback(
    (row: InboundEmail) => {
      setSelected(row);
      setDraft(toExtractedData(row, company));

      // Einmal angeschaut, für alle angeschaut. Der Zeitstempel wird nur beim
      // ERSTEN Öffnen gesetzt — sonst würde jeder Blick die Spur des ersten
      // überschreiben. Schlägt es fehl, bleibt die Mail ungelesen: das ist der
      // harmlosere Fehler.
      if (row.opened_at) return;
      const openedAt = new Date().toISOString();
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, opened_at: openedAt } : r)));
      setUnreadPerStatus((prev) => ({
        ...prev,
        [row.processing_status]: Math.max(0, (prev[row.processing_status] ?? 1) - 1),
      }));
      void supabase
        .from("inbound_emails")
        .update({ opened_at: openedAt })
        .eq("id", row.id)
        .is("opened_at", null);
    },
    [company],
  );

  const closeItem = useCallback(() => {
    setSelected(null);
    setDraft(null);
  }, []);

  const updateDraft = useCallback(
    (field: keyof ExtractedData, value: string | number | boolean | null) => {
      setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  /** Approve, with or without edits — the payload is whatever is in the form. */
  const approve = useCallback(async () => {
    if (!selected || !draft || !company || !user || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-manual-lead", {
        body: {
          company_id: company.id,
          lead_data: extractedLeadToLeadData(draft),
          raw_text: selected.body_preview ?? "",
          confidence_score: selected.confidence_score,
          user_id: user.id,
          source: "email",
          inbound_email_id: selected.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? t("lead.error.importFailed"));

      toast({
        title: t("lead.inbox.approved"),
        description: data.warning ?? t("lead.inbox.approvedHint"),
      });
      closeItem();
      await Promise.all([loadRows(), loadUnreadCounts()]);
    } catch (error) {
      toast({
        title: t("lead.inbox.approveFailed"),
        description: error instanceof Error ? error.message : t("lead.error.unexpected"),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  }, [selected, draft, company, user, busy, t, toast, closeItem, loadRows, loadUnreadCounts]);

  const reject = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      // Direct update: RLS scopes inbound_emails to company members, so this
      // needs no privileged function.
      const { error } = await supabase
        .from("inbound_emails")
        .update({
          processing_status: "rejected",
          rejection_reason: t("lead.inbox.rejectedByOperator"),
          processed_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      if (error) throw error;
      toast({ title: t("lead.inbox.rejected") });
      closeItem();
      await Promise.all([loadRows(), loadUnreadCounts()]);
    } catch (error) {
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("lead.error.unexpected"),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  }, [selected, busy, t, toast, closeItem, loadRows, loadUnreadCounts]);

  /**
   * Re-run the pipeline. The webhook does not come a second time, so this calls
   * the function's authenticated entry point, which fetches the message from
   * Resend again.
   */
  const retry = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("inbound-email-lead", {
        body: { inbound_email_id: selected.id },
      });
      if (error) throw error;

      const outcome = (data?.status ?? "failed") as keyof typeof RETRY_STATUS_KEYS;
      toast({
        title: t("lead.inbox.retried"),
        description: t(RETRY_STATUS_KEYS[outcome] ?? RETRY_STATUS_KEYS.failed),
      });
      closeItem();
      await Promise.all([loadRows(), loadUnreadCounts()]);
    } catch (error) {
      toast({
        title: t("lead.inbox.retryFailed"),
        description: error instanceof Error ? error.message : t("lead.error.unexpected"),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  }, [selected, busy, t, toast, closeItem, loadRows, loadUnreadCounts]);

  const senderLabel = (row: InboundEmail): string =>
    row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email;

  return (
    <>
      <Helmet>
        <title>{t("lead.inbox.pageTitle")}</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Inbox className="w-6 h-6" />
            {t("lead.inbox.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("lead.inbox.subtitle")}</p>
        </div>

        {!selected && (
          <>
            <Tabs value={status} onValueChange={(value) => setStatus(value as ProcessingStatus)}>
              <TabsList>
                {TABS.map((tab) => {
                  const unread = unreadPerStatus[tab.status] ?? 0;
                  return (
                    <TabsTrigger key={tab.status} value={tab.status} className="gap-2">
                      {t(tab.labelKey)}
                      {unread > 0 && (
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-folk-coral px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                          {unread}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            {isLoading ? (
              <div className="flex items-center justify-center min-h-[240px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Mail className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  {t("lead.inbox.empty")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => openItem(row)}
                    // Dezenter Hover wie in den übrigen Listen (folk-bg-warm). Ein
                    // flächiges bg-accent färbt die ganze Zeile ein und macht den
                    // Absender unlesbar, weil die Textfarbe nicht mitgeht.
                    className={`group w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink4/30 hover:bg-folk-bg-warm ${
                      row.opened_at
                        ? "border-folk-line bg-folk-card hover:border-folk-ink4/30"
                        : // Ungelesen: kräftigerer Rahmen und ein Streifen links.
                          // Nur Fettschrift genügt nicht — in einer langen Liste
                          // sieht man den Unterschied sonst nicht.
                          "border-folk-line border-l-4 border-l-folk-coral bg-folk-card hover:border-folk-ink4/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div
                          className={`truncate text-folk-ink ${
                            row.opened_at ? "font-medium" : "font-semibold"
                          }`}
                        >
                          {row.subject || t("lead.inbox.noSubject")}
                        </div>
                        <div
                          className={`truncate text-sm ${
                            row.opened_at ? "text-folk-ink3" : "text-folk-ink2"
                          }`}
                        >
                          {senderLabel(row)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {row.classification && (
                          <Badge variant="secondary">{getServiceLabel(row.classification, locale)}</Badge>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceTone(row.confidence_score)}`}
                        >
                          {row.confidence_score === null
                            ? "—"
                            : `${Math.round(row.confidence_score * 100)}%`}
                        </span>
                        <span className="text-xs tabular-nums text-folk-ink4">
                          {formatDate(row.received_at, locale)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selected && (
          <>
            <Button variant="outline" onClick={closeItem} disabled={busy}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common.back")}
            </Button>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selected.subject || t("lead.inbox.noSubject")}
                </CardTitle>
                <CardDescription>
                  {senderLabel(selected)} · {formatDate(selected.received_at, locale)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceTone(selected.confidence_score)}`}
                  >
                    {t("lead.inbox.confidence")}:{" "}
                    {selected.confidence_score === null
                      ? "—"
                      : `${Math.round(selected.confidence_score * 100)}%`}
                  </span>
                  {selected.classification && (
                    <Badge variant="secondary">{getServiceLabel(selected.classification, locale)}</Badge>
                  )}
                  {selected.processing_attempts > 1 && (
                    <Badge variant="outline">
                      {t("lead.inbox.attempts", { count: selected.processing_attempts })}
                    </Badge>
                  )}
                </div>

                {/* Der Grund wiederholt bei "needs_review" nur die Liste unten —
                    dann bringt die zweite Anzeige nichts. */}
                {selected.rejection_reason &&
                  !selected.rejection_reason.startsWith("missing:") && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{selected.rejection_reason}</AlertDescription>
                  </Alert>
                )}

                {selected.last_error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{selected.last_error}</AlertDescription>
                  </Alert>
                )}

                {(selected.missing_critical_fields?.length ?? 0) > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("lead.inbox.missingFields")}: </span>
                    {selected.missing_critical_fields?.join(", ")}
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium mb-1">{t("lead.inbox.preview")}</div>
                  {/* Plain text only — the original HTML is neither stored nor rendered. */}
                  <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">
                    {selected.body_preview || t("lead.inbox.noPreview")}
                  </pre>
                </div>

                {(selected.attachments?.length ?? 0) > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {t("lead.inbox.attachments")}:{" "}
                    {selected.attachments?.map((a) => a.filename).join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>

            {draft && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("lead.inbox.extractedTitle")}</CardTitle>
                  <CardDescription>{t("lead.inbox.extractedHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <ExtractedLeadForm data={draft} onChange={updateDraft} />

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    {/* Ohne diesen Weg ist die Detailansicht einer übernommenen
                        Mail eine Sackgasse: der Lead existiert, ist von hier aus
                        aber nicht erreichbar. */}
                    {selected.lead_id && (
                      <Button variant="outline" onClick={() => navigate("/firma/anfragen")}>
                        {t("lead.inbox.openLead")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                    {selected.processing_status !== "lead_created" && (
                      <Button onClick={approve} disabled={busy} size="lg" className="flex-1">
                        {busy ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {t("lead.inbox.approve")}
                      </Button>
                    )}
                    {selected.processing_status !== "rejected" &&
                      selected.processing_status !== "lead_created" && (
                      <Button variant="outline" onClick={reject} disabled={busy}>
                        <X className="w-4 h-4 mr-2" />
                        {t("lead.inbox.reject")}
                      </Button>
                    )}
                    {(selected.processing_status === "failed" ||
                      selected.processing_status === "rejected") && (
                      <Button variant="outline" onClick={retry} disabled={busy}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t("lead.inbox.retry")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!draft && selected.processing_status === "failed" && (
              <Card>
                <CardContent className="py-8 space-y-4 text-center">
                  <p className="text-muted-foreground">{t("lead.inbox.noExtraction")}</p>
                  <Button variant="outline" onClick={retry} disabled={busy}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t("lead.inbox.retry")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default FirmaEmailImport;
