import { supabase } from "@/integrations/supabase/client";
import { buildOfferEmailAttachments } from "@/lib/buildOfferEmailAttachments";
import { ladeOfferSendReadiness } from "@/lib/offerSendReadinessInput";
import type { ReadinessFinding } from "../../supabase/functions/_shared/offerSendReadiness.ts";

interface SendOfferOptions {
  offerId: string;
  companyId: string;
  /** false: neuer Entwurf · true: erneutes Senden / nach Bearbeitung. Default: false. */
  forceResend?: boolean;
}

interface SendOfferResult {
  success: boolean;
  error?: string;
  /**
   * Strukturierte Blocker der Sendebereitschaft — kein Wahrheitswert, damit die
   * Oberflaeche sagen kann, WELCHES Feld welcher Zeile in welcher Sprache fehlt.
   * Sie stammen entweder aus der Vorpruefung hier oder aus der massgeblichen
   * Pruefung in `send-offer` (HTTP 422) — beide aus derselben Funktion.
   */
  blockers?: ReadinessFinding[];
}

/**
 * Einziger Weg, eine Offerte per E-Mail zu versenden — Seiten rufen die
 * send-offer Edge Function NICHT direkt auf.
 *
 * Ablauf:
 * 1. Session prüfen (Auth-Token für die Edge Function).
 * 2. Sendebereitschaft prüfen — BEVOR PDFs erzeugt werden.
 * 3. PDFs (Offerte / AGB / Checkliste) über buildOfferEmailAttachments erzeugen.
 * 4. send-offer mit force_resend aufrufen.
 * 5. Fehler der Edge Function parsen und als Ergebnis zurückgeben.
 *
 * Die Bereitschaftsprüfung hier ist die SCHNELLE, nicht die massgebliche. Die
 * massgebliche sitzt in `send-offer` und antwortet mit HTTP 422 — daran kommt
 * weder ein veralteter Bundle noch ein direkter Aufruf vorbei. Beide rufen
 * dieselbe Funktion auf; es gibt genau eine Regel.
 *
 * Den Status-Übergang ("sent" + sent_at) setzt die Edge Function selbst, nur bei
 * erfolgreichem Versand — Seiten dürfen den Status nicht vorab schreiben.
 *
 * UI (Toast / Navigation / State) bleibt Sache der aufrufenden Seite; diese
 * Funktion gibt ausschliesslich { success, error } zurück.
 */
export async function sendOffer({
  offerId,
  companyId,
  forceResend = false,
}: SendOfferOptions): Promise<SendOfferResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { success: false, error: "Sitzung abgelaufen. Bitte neu einloggen und erneut versuchen." };
  }

  // Zuerst die Sprache und die Vorlagen prüfen. Eine französische Offerte, der
  // die französischen AGB fehlen, soll nicht erst ein PDF erzeugen und dann am
  // Server scheitern — und schon gar nicht mit deutschem Anhang hinausgehen.
  try {
    const bereitschaft = await ladeOfferSendReadiness(offerId);
    if (!bereitschaft.ok) {
      return {
        success: false,
        error: "offer_not_ready",
        blockers: bereitschaft.blockers,
      };
    }
  } catch {
    // Die Prüfung selbst ist ausgefallen — das ist KEINE Freigabe. Weiter geht
    // es trotzdem: die massgebliche Prüfung in `send-offer` steht noch davor,
    // und sie hält, was diese hier nicht mehr konnte.
  }

  let offerPdfBase64: string | null = null;
  let agbPdfBase64: string | null = null;
  let checklistPdfBase64: string | null = null;
  try {
    ({ offerPdfBase64, agbPdfBase64, checklistPdfBase64 } = await buildOfferEmailAttachments(offerId, companyId));
  } catch {
    return { success: false, error: "Die PDF-Anhänge konnten nicht erzeugt werden." };
  }

  const { data, error } = await supabase.functions.invoke("send-offer", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      offerId,
      force_resend: forceResend,
      ...(offerPdfBase64 ? { offerPdfBase64 } : {}),
      ...(agbPdfBase64 ? { agbPdfBase64 } : {}),
      ...(checklistPdfBase64 ? { checklistPdfBase64 } : {}),
    },
  });

  if (error) {
    let message = "Die E-Mail konnte nicht gesendet werden.";
    let blockers: ReadinessFinding[] | undefined;
    try {
      const body: { error?: string; blockers?: ReadinessFinding[] } | undefined =
        await (error as unknown as { context?: Response }).context?.json();
      if (body?.error) message = String(body.error);
      // 422 der massgeblichen Prüfung: die Blocker durchreichen, statt sie zu
      // einer Standardmeldung zu verflachen.
      if (Array.isArray(body?.blockers)) blockers = body.blockers;
    } catch {
      // Antwort-Body nicht lesbar — Standardmeldung behalten.
    }
    return { success: false, error: message, ...(blockers ? { blockers } : {}) };
  }

  // send-offer liefert bei Logikfehlern teilweise 200 + { error }.
  const dataError = (data as { error?: string } | null)?.error;
  if (dataError) {
    return { success: false, error: dataError };
  }

  return { success: true };
}
