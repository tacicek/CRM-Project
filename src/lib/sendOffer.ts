import { supabase } from "@/integrations/supabase/client";
import { isoToDisplay } from "@/lib/dateInputCH";
import { buildOfferEmailAttachments } from "@/lib/buildOfferEmailAttachments";
import { ladeOfferSendReadiness } from "@/lib/offerSendReadinessInput";
import {
  evaluateAcceptanceWindow,
  heuteIso,
} from "../../supabase/functions/_shared/offerAcceptanceWindow.ts";
import type { ReadinessFinding } from "../../supabase/functions/_shared/offerSendReadiness.ts";

/**
 * Der Satz zum geschlossenen Annahmefenster — an einer Stelle, weil ihn zwei
 * Wege brauchen: die schnelle Prüfung hier und die Antwort der massgeblichen
 * Prüfung aus `send-offer`. Der Server schickt einen Schlüssel, keinen Satz;
 * gelesen wird er hier.
 *
 * Deutsch wie die übrigen Meldungen dieser Datei. Sie gehen an den Bediener,
 * nicht an den Kunden, und laufen nicht durch den i18n-Katalog.
 */
const annahmefristAbgelaufenText = (frist: string | null): string => {
  const tag = frist ? isoToDisplay(frist) : null;
  return tag
    ? `Die Annahmefrist ist am ${tag} abgelaufen. Der Kunde könnte diese Offerte nicht mehr annehmen. Prüfen Sie Ausführungsdatum und «Gültig bis».`
    : "Die Annahmefrist ist abgelaufen. Prüfen Sie Ausführungsdatum und «Gültig bis».";
};

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

  // Kann der Kunde überhaupt noch zusagen? Eine Offerte, deren Annahmefrist
  // schon abgelaufen ist, wäre beim Öffnen "abgelaufen" — sie zu senden hiesse,
  // dem Kunden etwas zu schicken, das er nicht annehmen kann. Die massgebliche
  // Prüfung steht in `send-offer`; diese hier spart Weg und sagt es früher.
  const { data: fristZeile } = await supabase
    .from("offers")
    .select("valid_until, service_date")
    .eq("id", offerId)
    .maybeSingle();
  if (fristZeile) {
    const fenster = evaluateAcceptanceWindow(
      fristZeile.valid_until,
      fristZeile.service_date,
      heuteIso(),
    );
    if (!fenster.offen) {
      return { success: false, error: annahmefristAbgelaufenText(fenster.frist) };
    }
  }
  // Keine Zeile gelesen: das ist KEINE Freigabe, sondern nur das Ende dieser
  // Abkürzung. `send-offer` prüft dasselbe noch einmal.

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
  // Die Sprache, in der die Anhänge WIRKLICH gesetzt wurden. Sie geht mit und
  // wird serverseitig gegen `offers.language` geprüft — sonst verglichen wir
  // dort einen Wert mit sich selbst, während die Bytes von hier kommen.
  let attachmentLocale: string | null = null;
  try {
    ({ offerPdfBase64, agbPdfBase64, checklistPdfBase64, documentLocale: attachmentLocale } =
      await buildOfferEmailAttachments(offerId, companyId));
  } catch {
    return { success: false, error: "Die PDF-Anhänge konnten nicht erzeugt werden." };
  }

  const { data, error } = await supabase.functions.invoke("send-offer", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      offerId,
      force_resend: forceResend,
      ...(attachmentLocale ? { attachmentLocale } : {}),
      ...(offerPdfBase64 ? { offerPdfBase64 } : {}),
      ...(agbPdfBase64 ? { agbPdfBase64 } : {}),
      ...(checklistPdfBase64 ? { checklistPdfBase64 } : {}),
    },
  });

  if (error) {
    let message = "Die E-Mail konnte nicht gesendet werden.";
    let blockers: ReadinessFinding[] | undefined;
    try {
      const body:
        | { error?: string; blockers?: ReadinessFinding[]; acceptanceDeadline?: string | null }
        | undefined = await (error as unknown as { context?: Response }).context?.json();
      if (body?.error) message = String(body.error);
      // Schlüssel der massgeblichen Prüfung in einen Satz — sonst stünde
      // "offer_acceptance_window_closed" im Toast.
      if (body?.error === "offer_acceptance_window_closed") {
        message = annahmefristAbgelaufenText(body.acceptanceDeadline ?? null);
      }
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
