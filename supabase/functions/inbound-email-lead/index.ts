/**
 * Resend Inbound-Webhook → CRM-Lead.
 *
 *   Signatur → Idempotenz → Body nachladen → Normalisieren → Vorfilter →
 *   KI-Klassifizierung → Konfidenz-Entscheid → Lead | Review | Ablehnung
 *
 * Die Funktion hat ZWEI Eingänge, mit je eigener Zugangskontrolle:
 *
 *   1. Resend-Webhook — erkennbar am `svix-signature`-Header. Läuft mit
 *      `verify_jwt = false` und ohne Auth-Plugin auf Kong; die Svix-Signatur ist
 *      hier die einzige Zugangskontrolle, deshalb wird der Rohkörper geprüft,
 *      bevor irgendetwas geparst wird.
 *   2. Erneuter Versuch aus der Review-Oberfläche — ohne Signatur, dafür mit
 *      dem JWT eines angemeldeten Benutzers, der Mitglied der Firma sein muss.
 *      Ein gescheiterter Lauf lässt sich sonst nicht wiederholen: der Webhook
 *      kommt kein zweites Mal.
 *
 * Weitere Eigenheiten:
 *
 * - Der `email.received`-Webhook enthält NUR Metadaten. Body und Header kommen
 *   aus einem zweiten Aufruf (`GET /emails/receiving/{id}`). Resend hält die
 *   Nachricht vor, ein fehlgeschlagener Abruf ist also wiederholbar und wir
 *   müssen den Rohtext nirgends selbst lagern.
 * - Die Antwort ist fast immer 200. Ein 4xx/5xx lässt Resend erneut zustellen;
 *   bei einer dauerhaft unverarbeitbaren Mail erzeugt das nur Last.
 *   Nicht-Wiederholbares wird in der Zeile vermerkt, nicht im Status-Code.
 *   Ausnahme: ungültige Signatur → 401 (der Aufrufer ist nicht Resend).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/logger.ts";
import {
  parseWebhookSecrets,
  readSvixHeaders,
  verifySvixSignature,
} from "../_shared/svixWebhook.ts";
import { AI_KEY_NAMES, callAiProvider, toSettingsMap } from "../_shared/aiProvider.ts";
import { buildLeadInsert, extractedToLeadInput } from "../_shared/leadMapping.ts";
import { createClassifyInboundEmailPrompt } from "../_shared/prompts.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { toLocale } from "../_shared/i18n/locale.ts";
import {
  buildBodyPreview,
  normalizeInboundEmail,
  parseResendWebhook,
  type ResendInboundWebhookData,
  type ResendReceivedEmail,
} from "../_shared/inboundEmail/normalize.ts";
import { runPrefilters } from "../_shared/inboundEmail/prefilters.ts";
import {
  addressFromHeader,
  buildCompanyAddressSet,
  pickCustomerEmail,
} from "../_shared/inboundEmail/customerEmail.ts";
import { parseInquiryResult } from "../_shared/inboundEmail/parsedInquiry.ts";
import { decide, resolveThresholds } from "../_shared/inboundEmail/decision.ts";
import {
  decideOnDuplicateDelivery,
  decideOnOperatorRetry,
} from "../_shared/inboundEmail/idempotency.ts";
import { matchCompanyByRecipient } from "../_shared/inboundEmail/alias.ts";
import type { ParsedInquiryResult } from "../_shared/inboundEmail/types.ts";
import { loadCompanySecrets } from "../_shared/companySecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const log = createLogger("inbound-email-lead");

/** Resend's own limit is far below this; the guard is against a hostile caller. */
const MAX_WEBHOOK_BYTES = 1_000_000;
const DEFAULT_MAX_PROCESSING_ATTEMPTS = 3;
/** api_keys-Zeile: volle Adresse ("anfragen@…") oder ganze Domain ("@id.resend.app"). */
const ALIAS_KEY_NAME = "inbound_email_alias";

/**
 * api_keys-Zeile mit dem Svix-Signing-Secret des jeweiligen Resend-Kontos.
 *
 * Warum in der Datenbank und nicht in der Umgebung: der Edge-Container bekommt
 * seine Variablen aus einer festen `environment:`-Liste im Compose-File. Eine
 * neue Variable erreicht ihn nur über eine Änderung an dieser Datei — und sie
 * wäre global, obwohl jedes Resend-Konto sein eigenes Secret hat. `api_keys` ist
 * in diesem System ohnehin der firmenbezogene Einstellungs-Store (AI-Schlüssel,
 * Inbound-Alias). RESEND_WEBHOOK_SECRET aus der Umgebung wird zusätzlich
 * akzeptiert, falls doch einmal global konfiguriert wird.
 */
const WEBHOOK_SECRET_KEY_NAME = "inbound_webhook_secret";

/**
 * Not-Aus je Firma: `api_keys`-Zeile mit dem Wert 'false'.
 *
 * INBOUND_EMAIL_ENABLED aus der Umgebung bleibt bestehen, ist auf diesem Server
 * aber NICHT setzbar — der Edge-Container bekommt eine feste `environment:`-Liste
 * aus dem Compose-File, in der die Variable nicht vorkommt. Ein Schalter, den man
 * im Ernstfall nicht umlegen kann, ist keiner; deshalb liegt er dort, wo er ohne
 * Deployment erreichbar ist. Firmenbezogen ist ausserdem das feinere Werkzeug:
 * eine Firma kann abgeschaltet werden, ohne die andere zu treffen.
 */
const ENABLED_KEY_NAME = "inbound_email_enabled";

const env = (key: string): string | undefined => Deno.env.get(key);

type ServiceClient = ReturnType<typeof createClient>;

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isFeatureEnabled = (): boolean => {
  const raw = env("INBOUND_EMAIL_ENABLED")?.trim().toLowerCase();
  // Unset means enabled: without a webhook secret nothing is processed anyway,
  // so the flag exists to switch the feature OFF, not to arm it.
  return raw !== "false" && raw !== "0" && raw !== "off";
};

const maxAttempts = (): number => {
  const parsed = Number(env("INBOUND_EMAIL_MAX_PROCESSING_ATTEMPTS"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_PROCESSING_ATTEMPTS;
};

const maxBodyChars = (): number => {
  const parsed = Number(env("INBOUND_EMAIL_MAX_BODY_CHARS"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();

  try {
    if (!isFeatureEnabled()) {
      log.logStep("Feature disabled — request ignored");
      return json({ ignored: true, reason: "feature_disabled" });
    }

    // Genau EINMAL gelesen: die Signatur deckt exakt diese Bytes ab, ein Parsen
    // und erneutes Serialisieren bricht sie.
    const rawBody = await req.text();
    if (rawBody.length > MAX_WEBHOOK_BYTES) {
      log.warn("Payload too large", { bytes: rawBody.length });
      return json({ error: "Payload too large" }, 413);
    }

    const supabase = createClient(
      env("SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const svixHeaders = readSvixHeaders(req);
    return svixHeaders.signature
      ? await handleWebhook({ req, rawBody, supabase, startedAt })
      : await handleRetry({ req, rawBody, supabase, startedAt });
  } catch (error) {
    // Kein Body, keine Kopfzeilen im Log — nur der Fehler selbst.
    log.error("Unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Internal error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Eingang 1 — Resend-Webhook
// ---------------------------------------------------------------------------

const handleWebhook = async (ctx: {
  req: Request;
  rawBody: string;
  supabase: ServiceClient;
  startedAt: number;
}): Promise<Response> => {
  const { req, rawBody, supabase, startedAt } = ctx;

  // Welches Resend-Konto zugestellt hat, ist vor der Prüfung unbekannt — der
  // Rumpf ist bis dahin unglaubwürdig. Also sind alle hinterlegten Secrets
  // Kandidaten: die aus der Datenbank und, falls gesetzt, das aus der Umgebung.
  const stored = await supabase
    .from("api_keys")
    .select("key_value")
    .eq("key_name", WEBHOOK_SECRET_KEY_NAME);

  const secrets = [
    ...parseWebhookSecrets(env("RESEND_WEBHOOK_SECRET")),
    ...(stored.data ?? []).flatMap((row: { key_value: string }) =>
      parseWebhookSecrets(row.key_value)
    ),
  ];

  const verification = await verifySvixSignature({
    payload: rawBody,
    headers: readSvixHeaders(req),
    secret: secrets,
    nowMs: Date.now(),
  });
  if (!verification.ok) {
    // Grund wird protokolliert, aber nicht zurückgegeben — ein Angreifer soll
    // nicht erfahren, ob das Secret fehlt oder die Signatur falsch war.
    //
    // Für die Diagnose wird der Empfänger mitgeschrieben: bei mehreren
    // Resend-Konten ist "signature_mismatch" sonst nicht zuzuordnen — man sieht
    // nicht, welches Konto ein Secret hat, das wir nicht kennen. Der Wert ist
    // UNGEPRÜFT und wird ausschliesslich geloggt, nie verarbeitet.
    log.warn("Signature rejected", {
      reason: verification.reason,
      candidateSecrets: secrets.length,
      unverifiedRecipient: unverifiedRecipientForDiagnostics(rawBody),
    });
    return json({ error: "Invalid signature" }, 401);
  }

  const parsed = parseResendWebhook(rawBody);
  if (!parsed.ok) {
    log.logStep("Event ignored", { reason: parsed.reason });
    return json({ ignored: true, reason: parsed.reason });
  }

  // Empfänger → Firma. Genau dieser Schritt wird beim Offerio-Ausbau zur
  // Mehrmandanten-Auflösung, ohne dass sich irgendetwas dahinter ändert.
  const recipients = [
    ...(Array.isArray(parsed.data.to) ? parsed.data.to : []),
    ...(Array.isArray(parsed.data.received_for) ? parsed.data.received_for : []),
  ]
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.toLowerCase());

  const companyId = await resolveCompanyId(supabase, recipients);
  if (!companyId) {
    // Ohne Firma gibt es keine Zeile, in der wir das festhalten könnten
    // (company_id ist NOT NULL). Bewusst 200: eine Mail an eine unbekannte
    // Adresse wird durch Wiederholung nicht zustellbarer.
    log.warn("No company for recipients", { recipients });
    return json({ ignored: true, reason: "unroutable_recipient" });
  }

  // Not-Aus je Firma. Bewusst NACH der Auflösung: vorher ist nicht bekannt, wen
  // die Mail betrifft. Bewusst 200 — Resend soll nicht wiederholen, die
  // Nachricht bleibt dort ohnehin abrufbar.
  if (!(await isInboundEnabledForCompany(supabase, companyId))) {
    log.logStep("Inbound disabled for company — ignored", { companyId });
    return json({ ignored: true, reason: "disabled_for_company" });
  }

  // Idempotenz: die Zeile wird per Unique-Constraint beansprucht, nicht per
  // "erst lesen, dann schreiben" — zwei gleichzeitige Zustellungen kämen sonst
  // beide durch.
  const fromWebhook = typeof parsed.data.from === "string" ? parsed.data.from : "";
  const claim = await supabase
    .from("inbound_emails")
    .insert({
      company_id: companyId,
      provider: "resend",
      provider_message_id: parsed.emailId,
      from_email: fromWebhook.slice(0, 320),
      to_emails: recipients,
      subject: typeof parsed.data.subject === "string" ? parsed.data.subject.slice(0, 500) : "",
      received_at: typeof parsed.data.created_at === "string"
        ? parsed.data.created_at
        : new Date().toISOString(),
      processing_status: "received",
    })
    .select("id, processing_status, processing_attempts, lead_id")
    .maybeSingle();

  let record = claim.data;
  // Frisch beanspruchte Zeile → erster Versuch. Bei einer Kollision entscheidet
  // decideOnDuplicateDelivery(), ob und als wievielter Versuch weitergemacht wird.
  let attempt = 1;

  if (claim.error) {
    if (claim.error.code !== "23505") {
      log.error("Claim failed", { code: claim.error.code, message: claim.error.message });
      return json({ error: "Storage error" }, 500);
    }

    // Bereits bekannt. Nur ein zuvor gescheiterter Lauf darf erneut starten —
    // und niemals, wenn schon ein Lead existiert.
    const existing = await supabase
      .from("inbound_emails")
      .select("id, processing_status, processing_attempts, lead_id")
      .eq("provider", "resend")
      .eq("provider_message_id", parsed.emailId)
      .maybeSingle();

    const row = existing.data;
    if (!row) {
      log.error("Conflict without a matching row");
      return json({ error: "Storage error" }, 500);
    }

    const verdict = decideOnDuplicateDelivery(row, maxAttempts());
    if (verdict.action === "refuse") {
      log.logStep("Duplicate delivery ignored", {
        providerMessageId: parsed.emailId,
        status: row.processing_status,
        reason: verdict.reason,
      });
      return json({ duplicate: true, status: row.processing_status, reason: verdict.reason });
    }
    record = row;
    attempt = verdict.attempt;
  }

  if (!record) {
    log.error("No record after claim");
    return json({ error: "Storage error" }, 500);
  }

  return await processInbound({
    supabase,
    companyId,
    inboundId: record.id,
    emailId: parsed.emailId,
    webhookData: parsed.data,
    attempt,
    startedAt,
  });
};

// ---------------------------------------------------------------------------
// Eingang 2 — erneuter Versuch aus der Review-Oberfläche
// ---------------------------------------------------------------------------

const handleRetry = async (ctx: {
  req: Request;
  rawBody: string;
  supabase: ServiceClient;
  startedAt: number;
}): Promise<Response> => {
  const { req, rawBody, supabase, startedAt } = ctx;

  let body: { inbound_email_id?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const inboundId = typeof body.inbound_email_id === "string" ? body.inbound_email_id : "";
  if (!inboundId) {
    // Ohne Signatur UND ohne Retry-Ziel ist das kein erkennbarer Aufruf.
    log.warn("Unsigned request without retry target");
    return json({ error: "Invalid signature" }, 401);
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) return json({ error: "Authorization required" }, 401);

  const token = authHeader.replace(/^bearer /i, "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    log.warn("Retry authentication failed");
    return json({ error: "Invalid or expired token" }, 401);
  }

  const { data: row } = await supabase
    .from("inbound_emails")
    .select("id, company_id, provider_message_id, processing_status, processing_attempts, lead_id, from_email, subject, to_emails, received_at")
    .eq("id", inboundId)
    .maybeSingle();

  if (!row) return json({ error: "Not found" }, 404);

  // Der Service-Role-Client umgeht RLS — die Mitgliedschaft muss hier explizit
  // geprüft werden, sonst wäre jede fremde Zeile über ihre ID erreichbar.
  const isMember = await verifyCompanyMembership(supabase, user.id, row.company_id);
  if (!isMember) {
    log.warn("Retry denied — not a member", { userId: user.id, companyId: row.company_id });
    return json({ error: "Forbidden" }, 403);
  }

  const verdict = decideOnOperatorRetry(row, maxAttempts());
  if (verdict.action === "refuse") {
    log.logStep("Retry refused", { inboundId, reason: verdict.reason });
    return json({ error: "Nicht wiederholbar", reason: verdict.reason }, 409);
  }

  log.logStep("Manual retry", { inboundId, userId: user.id, attempt: verdict.attempt });

  // Der ursprüngliche Webhook-Body existiert nicht mehr; was daraus gebraucht
  // wird, steht in der Zeile. Der Mailtext kommt ohnehin frisch von Resend.
  return await processInbound({
    supabase,
    companyId: row.company_id,
    inboundId: row.id,
    emailId: row.provider_message_id,
    webhookData: {
      email_id: row.provider_message_id,
      created_at: row.received_at,
      from: row.from_email,
      to: row.to_emails,
      subject: row.subject,
    },
    attempt: verdict.attempt,
    startedAt,
  });
};

// ---------------------------------------------------------------------------
// Gemeinsame Verarbeitung
// ---------------------------------------------------------------------------

const processInbound = async (ctx: {
  supabase: ServiceClient;
  companyId: string;
  inboundId: string;
  emailId: string;
  webhookData: ResendInboundWebhookData;
  attempt: number;
  startedAt: number;
}): Promise<Response> => {
  const { supabase, companyId, inboundId, emailId, webhookData, attempt, startedAt } = ctx;

  await supabase
    .from("inbound_emails")
    .update({ processing_status: "processing", processing_attempts: attempt })
    .eq("id", inboundId);

  const company = await supabase
    .from("companies")
    .select(
      "id, default_language, resend_enabled, email, notification_email, resend_from_email",
    )
    .eq("id", companyId)
    .single();

  // Zugangsdaten aus company_secrets (nicht mehr aus `companies`, siehe dort).
  const secrets = await loadCompanySecrets(supabase, companyId);
  const resendKey = company.data?.resend_enabled && secrets.resend_api_key
    ? secrets.resend_api_key
    : env("RESEND_API_KEY");

  const fetched = await fetchReceivedEmail(emailId, resendKey);
  if (!fetched.ok) {
    // Transient: Resend hält die Mail, ein erneuter Versuch holt sie ab.
    await markFailed(supabase, inboundId, `fetch_body: ${fetched.detail}`);
    log.error("Body fetch failed", { inboundId, detail: fetched.detail });
    return json({ status: "failed", reason: "body_fetch_failed" });
  }

  const email = normalizeInboundEmail({
    webhookData,
    fetched: fetched.value,
    maxBodyChars: maxBodyChars(),
  });

  await supabase
    .from("inbound_emails")
    .update({
      from_email: email.fromEmail || String(webhookData.from ?? "").slice(0, 320),
      from_name: email.fromName,
      subject: email.subject,
      body_preview: buildBodyPreview(email),
      attachments: email.attachments,
    })
    .eq("id", inboundId);

  // Deterministische Vorfilter — vor jedem Modellaufruf.
  const prefilter = runPrefilters(email);
  if (prefilter) {
    await supabase
      .from("inbound_emails")
      .update({
        processing_status: "rejected",
        classification: prefilter.reason,
        rejection_reason: prefilter.detail,
        confidence_score: 0,
        processed_at: new Date().toISOString(),
      })
      .eq("id", inboundId);

    log.logStep("Rejected by prefilter", {
      inboundId,
      reason: prefilter.reason,
      durationMs: Date.now() - startedAt,
    });
    return json({ status: "rejected", reason: prefilter.reason });
  }

  const apiKeys = await supabase
    .from("api_keys")
    .select("key_name, key_value")
    .eq("company_id", companyId)
    .in("key_name", [...AI_KEY_NAMES]);

  const inquiry = await classifyWithOneRetry(
    toSettingsMap(apiKeys.data),
    createClassifyInboundEmailPrompt(email),
  );
  if (!inquiry.ok) {
    await markFailed(supabase, inboundId, inquiry.detail);
    log.error("Classification failed", { inboundId, detail: inquiry.detail });
    return json({ status: "failed", reason: "classification_failed" });
  }

  const result = inquiry.value;

  // Der Entscheid fällt hier, nicht im Modell.
  const decision = decide(result, resolveThresholds(env));

  const shared = {
    classification: result.serviceType,
    confidence_score: result.confidenceScore,
    missing_critical_fields: result.missingCriticalFields,
    // Service-Typ, Kundensprache und Konfidenz werden hier MIT in extracted_data
    // geschrieben, obwohl sie eigene Spalten haben: die Review-Oberfläche lädt
    // dieses Objekt direkt in dasselbe Formular wie der manuelle Import, und das
    // erwartet ein vollständiges ExtractedData. Die Spalten bleiben die Quelle
    // für Filter und Auswertung.
    extracted_data: {
      ...result.extracted,
      detected_service_type: result.serviceType,
      language: result.language,
      confidence_score: result.confidenceScore,
    },
    processed_at: new Date().toISOString(),
    last_error: null,
  };

  if (decision.outcome !== "lead_created") {
    await supabase
      .from("inbound_emails")
      .update({
        ...shared,
        processing_status: decision.outcome,
        rejection_reason: decision.reason,
      })
      .eq("id", inboundId);

    if (decision.outcome === "needs_review") {
      await notifyCompany(supabase, {
        companyId,
        title: "📧 Neue E-Mail-Anfrage zur Prüfung",
        body: `${email.subject || "(kein Betreff)"} — von ${email.fromEmail}. ` +
          `Sicherheit ${Math.round(result.confidenceScore * 100)}%.`,
        inboundId,
      });
    }

    log.logStep("Processed", {
      inboundId,
      status: decision.outcome,
      confidenceScore: result.confidenceScore,
      durationMs: Date.now() - startedAt,
    });
    return json({ status: decision.outcome, confidenceScore: result.confidenceScore });
  }

  const leadInput = extractedToLeadInput(result.serviceType!, result.extracted);

  // Kundenadresse bestimmen. Der Absender ist NICHT automatisch der Kunde: leitet
  // die Firma ihr eigenes Postfach hierher weiter, steht dort ihre eigene Adresse.
  leadInput.customer_email = pickCustomerEmail({
    extracted: typeof leadInput.customer_email === "string" ? leadInput.customer_email : null,
    replyTo: addressFromHeader(email.headers["reply-to"]),
    fromEmail: email.fromEmail,
    companyAddresses: buildCompanyAddressSet([
      company.data?.email,
      company.data?.notification_email,
      company.data?.resend_from_email,
    ]),
  });

  const leadInsert = buildLeadInsert(leadInput, {
    companyId,
    language: toLocale(result.language ?? company.data?.default_language),
    source: "email",
  });

  // Lead anlegen UND verknüpfen in einer Transaktion. Zwei getrennte Anweisungen
  // hinterlassen bei einem Abbruch dazwischen einen Lead ohne Verknüpfung, dessen
  // Mail auf 'processing' hängen bleibt — sichtbar in keinem Tab und für keinen
  // der beiden Eingänge wiederholbar.
  const lead = await supabase.rpc("create_lead_from_inbound_email", {
    p_inbound_id: inboundId,
    p_company_id: companyId,
    p_lead: leadInsert,
    p_outcome: shared,
  });

  if (lead.error) {
    await markFailed(supabase, inboundId, `lead_insert: ${lead.error.message}`);
    log.error("Lead insert failed", { inboundId, message: lead.error.message });
    return json({ status: "failed", reason: "lead_insert_failed" });
  }

  await notifyCompany(supabase, {
    companyId,
    title: "📧 Anfrage aus E-Mail erstellt",
    body: `${email.subject || "(kein Betreff)"} — von ${email.fromEmail}. ` +
      `Automatisch übernommen (Sicherheit ${Math.round(result.confidenceScore * 100)}%).`,
    inboundId,
    leadId: lead.data as string,
  });

  log.logStep("Processed", {
    inboundId,
    status: "lead_created",
    leadId: lead.data,
    confidenceScore: result.confidenceScore,
    durationMs: Date.now() - startedAt,
  });
  return json({ status: "lead_created", leadId: lead.data });
};

/**
 * Empfängeradresse → Firma. Der Alias steht als `inbound_email_alias` in
 * `api_keys`, dem bestehenden firmenbezogenen Einstellungs-Store; eine eigene
 * Spalte (und damit eine Migration) braucht es dafür nicht. Ohne Treffer greift
 * INBOUND_EMAIL_DEFAULT_COMPANY_ID.
 */
const resolveCompanyId = async (
  supabase: ServiceClient,
  recipients: string[],
): Promise<string | null> => {
  if (recipients.length > 0) {
    const aliases = await supabase
      .from("api_keys")
      .select("company_id, key_value")
      .eq("key_name", ALIAS_KEY_NAME);

    const match = matchCompanyByRecipient(recipients, aliases.data ?? []);
    if (match) return match;
  }

  return env("INBOUND_EMAIL_DEFAULT_COMPANY_ID")?.trim() || null;
};

/**
 * Empfänger aus einem NICHT verifizierten Rumpf — nur fürs Log.
 *
 * Ohne diese Angabe ist bei mehreren Resend-Konten nicht erkennbar, welches
 * Konto mit einem unbekannten Secret zustellt. Der Wert wird gekappt und
 * niemals für eine Entscheidung verwendet.
 */
const unverifiedRecipientForDiagnostics = (rawBody: string): string => {
  try {
    const payload = JSON.parse(rawBody) as { data?: { to?: unknown } };
    const to = payload?.data?.to;
    const first = Array.isArray(to) ? to[0] : to;
    return typeof first === "string" ? first.slice(0, 120) : "unknown";
  } catch {
    return "unparsable";
  }
};

/**
 * Ist der Eingang für diese Firma eingeschaltet?
 *
 * Fehlt die Zeile, gilt "an" — sonst müsste man den Schalter erst anlegen, damit
 * etwas funktioniert. Er existiert zum Abschalten, nicht zum Scharfmachen.
 */
const isInboundEnabledForCompany = async (
  supabase: ServiceClient,
  companyId: string,
): Promise<boolean> => {
  const { data } = await supabase
    .from("api_keys")
    .select("key_value")
    .eq("company_id", companyId)
    .eq("key_name", ENABLED_KEY_NAME)
    .maybeSingle();

  const raw = (data?.key_value ?? "").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
};

const fetchReceivedEmail = async (
  emailId: string,
  apiKey: string | undefined,
): Promise<{ ok: true; value: ResendReceivedEmail } | { ok: false; detail: string }> => {
  if (!apiKey) return { ok: false, detail: "no Resend API key configured" };

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
  return { ok: true, value: await response.json() as ResendReceivedEmail };
};

/**
 * Ein Modell, das kein gültiges JSON liefert, bekommt genau EINEN weiteren
 * Versuch mit einer schärferen Formatanweisung. Mehr wäre bei einer dauerhaft
 * unverständlichen Mail nur teurer.
 */
const classifyWithOneRetry = async (
  settings: Record<string, string>,
  prompt: string,
): Promise<{ ok: true; value: ParsedInquiryResult } | { ok: false; detail: string }> => {
  const attempts = [
    prompt,
    `${prompt}\n\nDeine letzte Antwort war kein gültiges JSON. Antworte NUR mit dem JSON-Objekt.`,
  ];

  let detail = "unknown";
  for (const attemptPrompt of attempts) {
    const call = await callAiProvider({ settings, env, prompt: attemptPrompt, maxTokens: 4096 });
    if (!call.ok) {
      detail = `ai_${call.error}${call.status ? `_${call.status}` : ""}`;
      // Ein fehlender Schlüssel wird auch beim zweiten Versuch fehlen.
      if (call.error === "missing_api_key") break;
      continue;
    }

    const parsedResult = parseInquiryResult(call.text);
    if (parsedResult.ok) return { ok: true, value: parsedResult.value };
    detail = `parse_${parsedResult.reason}`;
  }

  return { ok: false, detail };
};

/**
 * Eintrag für die Glocke im Dashboard.
 *
 * Ohne ihn merkt niemand, dass eine Mail eingetroffen ist — man müsste die Seite
 * von sich aus aufsuchen. Die Zeile in `notifications` löst ausserdem das
 * Realtime-Ereignis aus, an dem die Oberfläche den Zähler neben "E-Mail-Eingang"
 * nachzieht.
 *
 * Deutsch, wie alle firmeninternen Benachrichtigungen — siehe Kopfkommentar von
 * _shared/i18n/catalog.ts. Der Fehlerfall wird geloggt, aber nicht eskaliert: die
 * Mail ist verarbeitet, eine fehlende Glocken-Zeile darf das nicht rückgängig
 * machen.
 */
const notifyCompany = async (
  supabase: ServiceClient,
  entry: {
    companyId: string;
    title: string;
    body: string;
    inboundId: string;
    leadId?: string;
  },
): Promise<void> => {
  const { error } = await supabase.from("notifications").insert({
    company_id: entry.companyId,
    type: "inbound_email",
    title: entry.title,
    body: entry.body.slice(0, 500),
    metadata: { inbound_email_id: entry.inboundId, lead_id: entry.leadId ?? null },
  });

  if (error) log.warn("Notification not stored", { message: error.message });
};

const markFailed = async (
  supabase: ServiceClient,
  inboundId: string,
  detail: string,
): Promise<void> => {
  await supabase
    .from("inbound_emails")
    .update({ processing_status: "failed", last_error: detail.slice(0, 500) })
    .eq("id", inboundId);
};
