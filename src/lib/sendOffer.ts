import { supabase } from "@/integrations/supabase/client";
import { buildOfferEmailAttachments } from "@/lib/buildOfferEmailAttachments";

interface SendOfferOptions {
  offerId: string;
  companyId: string;
  /** false: neuer Entwurf · true: erneutes Senden / nach Bearbeitung. Default: false. */
  forceResend?: boolean;
}

interface SendOfferResult {
  success: boolean;
  error?: string;
}

/**
 * Einziger Weg, eine Offerte per E-Mail zu versenden — Seiten rufen die
 * send-offer Edge Function NICHT direkt auf.
 *
 * Ablauf:
 * 1. Session prüfen (Auth-Token für die Edge Function).
 * 2. PDFs (Offerte / AGB / Checkliste) über buildOfferEmailAttachments erzeugen.
 * 3. send-offer mit force_resend aufrufen.
 * 4. Fehler der Edge Function parsen und als Ergebnis zurückgeben.
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
    try {
      const body: { error?: string } | undefined =
        await (error as unknown as { context?: Response }).context?.json();
      if (body?.error) message = String(body.error);
    } catch {
      // Antwort-Body nicht lesbar — Standardmeldung behalten.
    }
    return { success: false, error: message };
  }

  // send-offer liefert bei Logikfehlern teilweise 200 + { error }.
  const dataError = (data as { error?: string } | null)?.error;
  if (dataError) {
    return { success: false, error: dataError };
  }

  return { success: true };
}
