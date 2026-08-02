/**
 * Die beiden Absage-Mails.
 *
 * Inhaltlich unveraendert gegenueber der bisherigen Fassung — es sind dieselben
 * Bausteine, dieselben Farben, dieselben Katalogschluessel. Zwei Dinge sind
 * anders:
 *
 *   * Die WERTE stammen jetzt aus der Datenbank, nicht aus dem Anfragekoerper.
 *     Wer den Endpunkt aufruft, kann keinen Namen, keinen Titel und keinen
 *     Empfaenger mehr vorgeben. Der Zusammenhang, den diese Datei bekommt,
 *     enthaelt deshalb auch kein Token: was hier nicht ankommt, kann in keinen
 *     Betreff und in kein Feld geraten.
 *
 *   * JEDER eingesetzte Text wird maskiert. Vorher waren zwei Stellen roh im
 *     HTML — der Kundenname im Fliesstext der Firmenmail und derselbe Name im
 *     Betreff. Ein Kunde, der `<img src=x onerror=...>` in sein Namensfeld
 *     schreibt, hat damit HTML in die Mail geschrieben, die die Firma oeffnet.
 *
 * Keine Deno-Globals, keine `https://`-Importe: diese Datei laeuft in Vitest.
 */

import { escapeHtml } from "./escapeHtml.ts";
import { createTranslator, formatDateLong, type Locale } from "./i18n/index.ts";
import type { CancellationRenderContext } from "./appointmentCancellationGuard.ts";

/**
 * Betreffzeilen sind Kopfzeilen. Ein `\r\n` darin beendet den Betreff und
 * beginnt eine neue Kopfzeile — auf diesem Weg liesse sich ein `Bcc:`
 * einschmuggeln. Der Wert kommt aus einem Feld, das ein Kunde ausfuellt, also
 * fliegen alle Steuerzeichen raus und Leerraum wird zusammengezogen.
 */
export const sanitizeSubject = (value: string): string =>
  value
    // Steuerzeichen und ALLE Zeilentrenner, nicht nur CR/LF: U+0085,
    // U+2028 und U+2029 trennen in manchen Verarbeitungsketten ebenfalls
    // Zeilen, und `\s` erfasst U+0085 nicht.
    .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatTime = (timeStr: string): string => (timeStr || "").substring(0, 5);

const kundenName = (ctx: CancellationRenderContext): string =>
  `${ctx.appointment.customer_first_name ?? ""} ${ctx.appointment.customer_last_name ?? ""}`.trim();

/**
 * ── Eine Regel, zwei Namensendungen ─────────────────────────────────────────
 *
 * Jeder dynamische Wert wird GENAU EINMAL maskiert, und zwar dort, wo er ins
 * HTML geht. Damit man einer Hilfsfunktion ansieht, was sie liefert, tragen
 * alle einen Hinweis im Namen:
 *
 *   * `…Text`  — reiner Text, NICHT maskiert. Die Einsetzstelle maskiert.
 *   * `…Html`  — fertiges HTML. Die Einsetzstelle setzt es roh ein.
 *
 * Der erste Anlauf hatte hier gemischt: `absenderName` maskierte selbst, die
 * Einsetzstelle maskierte noch einmal. Aus `Müller & Söhne` wurde
 * `Müller &amp;amp; Söhne` — in der Mail sichtbar als `&amp;`. Kein Loch, aber
 * falscher Text, und genau die Art Fehler, die eine gemischte Zustaendigkeit
 * immer wieder erzeugt.
 *
 * Die Katalogtexte sind unsere eigenen und duerfen Auszeichnung enthalten
 * (`<strong>` im Intro). Sie werden deshalb nie maskiert — maskiert werden nur
 * die Werte, die IN sie hineingehen.
 */
const absenderNameText = (ctx: CancellationRenderContext, t: ReturnType<typeof createTranslator>): string =>
  ctx.isCompanyEmail
    ? (ctx.company.company_name ?? "")
    : t("common.teamSignature", { appName: ctx.appName });

const fusszeileHtml = (ctx: CancellationRenderContext, t: ReturnType<typeof createTranslator>): string =>
  t("common.autoSentBy", {
    sender: escapeHtml(ctx.isCompanyEmail ? ctx.company.company_name : ctx.appName),
  });

/**
 * An die Firma. Deutschsprachiges Geruest wie bisher; die uebersetzten Teile
 * folgen `companies.default_language`, nicht der Sprache des Kunden.
 */
export const renderCompanyCancellationEmail = (
  ctx: CancellationRenderContext,
): { subject: string; html: string } => {
  const t = createTranslator(ctx.locale);
  const name = kundenName(ctx) || "Unbekannt";
  const { appointment } = ctx;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ❌ Termin abgesagt
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">Guten Tag,</p>

          <p>Der Kunde <strong>${escapeHtml(name)}</strong> hat den folgenden Termin abgesagt:</p>

          <div style="background: #FEE2E2; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #991B1B; font-size: 16px;">${escapeHtml(appointment.title)}</h3>
            <p style="margin: 0; font-size: 16px; color: #7F1D1D;">
              📅 ${formatDateLong(appointment.appointment_date, ctx.locale)}<br>
              🕐 ${t("common.timeValue", { time: escapeHtml(formatTime(appointment.start_time)) })}
            </p>
          </div>

          ${
            ctx.cancellationReason
              ? `
            <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400E;">📝 Absagegrund:</p>
              <p style="margin: 0; color: #78350F;">${escapeHtml(ctx.cancellationReason)}</p>
            </div>
          `
              : ""
          }

          ${
            appointment.customer_email
              ? `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Kundenkontakt:</p>
              <p style="margin: 0;">
                <a href="mailto:${encodeURIComponent(appointment.customer_email)}" style="color: #3b82f6;">${escapeHtml(appointment.customer_email)}</a>
              </p>
            </div>
          `
              : ""
          }

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${t("common.regards")}<br>
            <strong>${escapeHtml(absenderNameText(ctx, t))}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${fusszeileHtml(ctx, t)}</p>
        </div>
      </body>
    </html>
  `;

  return {
    subject: sanitizeSubject(`❌ Termin abgesagt: "${appointment.title}" von ${kundenName(ctx) || "Kunde"}`),
    html,
  };
};

/**
 * An den Kunden. Folgt `appointments.language` — der Sprache, in der mit
 * diesem Kunden von Anfang an gesprochen wurde.
 */
export const renderCustomerCancellationEmail = (
  ctx: CancellationRenderContext,
): { subject: string; html: string } => {
  const t = createTranslator(ctx.locale);
  const { appointment } = ctx;
  const firma = ctx.company.company_name ?? "";

  const html = `
    <!DOCTYPE html>
    <html lang="${escapeHtml(ctx.locale as Locale)}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:16px 14px;background-color:#e4e4e8;">
        <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ✅ ${t("email.appointmentCancelled.headerTitle")}
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin-top: 0;">${t("common.greeting", { name: escapeHtml(kundenName(ctx)) })}</p>

          <p>${t("email.appointmentCancelled.intro", { companyName: `<strong>${escapeHtml(firma)}</strong>` })}</p>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">${t("email.appointmentCancelled.cancelledTitle")}</h3>
            <p style="margin: 0; color: #6B7280;">
              <strong>${escapeHtml(appointment.title)}</strong><br>
              📅 ${formatDateLong(appointment.appointment_date, ctx.locale)}<br>
              🕐 ${t("common.timeValue", { time: escapeHtml(formatTime(appointment.start_time)) })}
            </p>
          </div>

          <p>${t("email.appointmentCancelled.outro", { companyName: `<strong>${escapeHtml(firma)}</strong>` })}</p>

          <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
            ${t("common.regards")}<br>
            <strong>${escapeHtml(absenderNameText(ctx, t))}</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>${fusszeileHtml(ctx, t)}</p>
        </div>
      </body>
    </html>
  `;

  // Der Emoji-Vorsatz bleibt: die Katalogwerte sind absichtlich emoji-frei.
  return {
    subject: sanitizeSubject(`✅ ${t("email.appointmentCancelled.subject", { title: appointment.title })}`),
    html,
  };
};
