/**
 * Der Absage-Link in der Erinnerungsmail — und die Entscheidung, ob es ihn
 * ueberhaupt gibt.
 *
 * ── Was vorher in der Mail stand ────────────────────────────────────────────
 *
 * Zwei Links — einer auf die Absage-, einer auf die Verschieben-Seite —, und
 * beide trugen die E-Mail-Adresse des Kunden als Abfrageparameter im Klartext.
 * (Die alten Adressen stehen hier absichtlich nicht woertlich: eine
 * Abschlussmessung durchsucht den Ordner danach, und ein Kommentar waere ein
 * Fehlalarm.)
 *
 * Das war gleich doppelt falsch. Die Adresse in der Abfrage geht an den Server,
 * steht im Referer und landet in jedem Zugriffsprotokoll — und als Nachweis
 * taugte sie ohnehin nie: sie ist kein Geheimnis, sondern das, was auf dem
 * Briefkopf steht. Die Seiten dahinter lasen ausserdem direkt aus den Tabellen
 * und konnten wegen RLS gar nicht funktionieren.
 *
 * ── Was jetzt drin steht ────────────────────────────────────────────────────
 *
 *   https://<site>/termin/<appointmentId>/absagen?lang=<locale>#t=<token>
 *
 * Das Token steht im FRAGMENT — und was das genau bedeutet, ist es wert, genau
 * gesagt zu werden:
 *
 *   * Beim OEFFNEN des Links schickt der Browser das Fragment nicht mit. Es
 *     steht nicht in der Abfrage, nicht im `Referer` und damit auch nicht in
 *     der ueblichen Zugriffszeile eines Servers oder Proxys.
 *
 *   * Danach liest die Seite es aus und schickt es SEHR WOHL weiter — im
 *     Koerper der Vorschau-RPC und im Koerper der Absage-Edge-Function. Anders
 *     ginge es nicht: irgendwo muss die Berechtigung geprueft werden.
 *
 * Die Zusicherung lautet also nicht "das Token erreicht nie einen Server",
 * sondern: es erreicht ihn nur dort, wo es hingehoert, und nicht nebenbei ueber
 * Adresszeile und Protokolle. Daraus folgt unmittelbar eine Pflicht auf der
 * anderen Seite: Anfragekoerper, RPC-Parameter und die Fehlerobjekte der Edge
 * Function duerfen nicht protokolliert werden.
 *
 * ── Warum in dieser Mail kein Verschieben-Knopf steht ───────────────────────
 *
 * Weil der alte auf eine Seite fuehrte, die das Token gar nicht prueft und die
 * Kundenadresse in der Abfrage traegt. Ein Knopf, der beim Draufklicken eine
 * Fehlermeldung zeigt, ist schlechter als kein Knopf.
 *
 * Das ist eine Entscheidung ueber DIESE Mail, kein Urteil ueber das Token. Das
 * Datenmodell aus B.2.1 nennt es allgemein `customer_action_token` — eine
 * Capability fuer Kundenaktionen, nicht ausschliesslich fuer die Absage. Ob das
 * Verschieben spaeter dasselbe Token benutzt oder ein eigenes bekommt, gehoert
 * in den Entwurf des Verschiebens und wird hier nicht vorweggenommen.
 *
 * ── Warum diese Datei ohne Deno auskommt ────────────────────────────────────
 *
 * Damit man sie ausfuehren kann. `index.ts` ist ein Cron-Lauf mit
 * `https://`-Importen und Deno-Globals; was dort steht, sieht kein Test. Die
 * Entscheidung, ob ein Link entsteht und wie er aussieht, steht deshalb hier.
 */

import { escapeHtml } from "./escapeHtml.ts";
import type { Locale } from "./i18n/index.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LOCALES: readonly Locale[] = ["de", "fr", "en"];

const istUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const istLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * Ein Grund, warum kein Link entstanden ist. Bewusst nur feste Kennzeichen —
 * hier darf nie ein Wert aus den Eingaben auftauchen, schon gar nicht das
 * Token: diese Zeichenketten werden protokolliert.
 */
export type NoActionReason =
  | "missing_base_url"
  | "unparsable_base_url"
  | "unsupported_scheme"
  | "insecure_http"
  | "credentials_in_url"
  | "invalid_appointment_id"
  | "invalid_locale"
  | "missing_token"
  | "invalid_token";

export interface ReminderActionsInput {
  baseUrl: unknown;
  appointmentId: unknown;
  /** `customer_action_token` aus der Zeile. NULL heisst WIDERRUFEN. */
  actionToken: unknown;
  locale: unknown;
}

export type ReminderActions =
  | {
      /** Der fertige Link, unmaskiert — fuer Textteile und Pruefungen. */
      cancelUrl: string;
      /** Derselbe Link, fuer ein HTML-Attribut maskiert. */
      cancelHref: string;
      reason?: undefined;
    }
  | { cancelUrl: null; cancelHref: null; reason: NoActionReason };

const ohne = (reason: NoActionReason): ReminderActions => ({
  cancelUrl: null,
  cancelHref: null,
  reason,
});

/**
 * Loopback erkennen. Nur dort ist `http://` in Ordnung — auf einem
 * Entwicklungsrechner gibt es kein Zertifikat, und die Verbindung verlaesst das
 * Geraet nicht. Ueberall sonst waere `http` ein Link, der ein Geheimnis im
 * Klartext durchs Netz traegt.
 */
const istLoopback = (hostname: string): boolean => {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "[::1]" || h === "::1") return true;
  // 127.0.0.0/8 — nicht nur 127.0.0.1.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
};

/**
 * Baut den Absage-Link — oder sagt, warum es keinen gibt.
 *
 * Fehlt oder taugt irgendein Teil nicht, entsteht KEIN Link. Die Erinnerung
 * geht trotzdem raus; sie zeigt dann nur keinen Absage-Knopf. Ein halber Link
 * waere das Schlechteste von beidem: der Kunde klickt, landet auf einer
 * Fehlerseite und glaubt, die Absage sei gescheitert.
 *
 * Ein fehlendes Token ist dabei kein Defekt, sondern eine Aussage: NULL heisst
 * "dieses Token wurde widerrufen". Es hier neu zu vergeben wuerde einen
 * gesperrten Link wieder aufmachen.
 */
export const buildReminderActions = (input: ReminderActionsInput): ReminderActions => {
  if (typeof input.baseUrl !== "string" || input.baseUrl.trim() === "") {
    return ohne("missing_base_url");
  }

  let basis: URL;
  try {
    basis = new URL(input.baseUrl.trim());
  } catch {
    return ohne("unparsable_base_url");
  }

  // Erlaubnisliste statt Sperrliste: `javascript:`, `data:`, `file:` und alles
  // Weitere fallen damit von selbst heraus.
  if (basis.protocol !== "https:" && basis.protocol !== "http:") {
    return ohne("unsupported_scheme");
  }
  if (basis.protocol === "http:" && !istLoopback(basis.hostname)) {
    return ohne("insecure_http");
  }
  // Zugangsdaten in der Adresse sind ein Umleitungstrick und in einer Mail nie
  // beabsichtigt.
  if (basis.username !== "" || basis.password !== "") {
    return ohne("credentials_in_url");
  }

  if (!istUuid(input.appointmentId)) return ohne("invalid_appointment_id");
  if (!istLocale(input.locale)) return ohne("invalid_locale");
  if (input.actionToken === null || input.actionToken === undefined) return ohne("missing_token");
  if (!istUuid(input.actionToken)) return ohne("invalid_token");

  // Vom Basiswert bleiben nur Herkunft und Pfad. Eine Abfrage oder ein Fragment
  // am Basiswert gehoeren nicht in diesen Link — sie kaemen aus einer ganz
  // anderen Absicht und wuerden hier still weitergetragen. Abschliessende
  // Schraegstriche fliegen weg, damit kein `//` entsteht.
  const pfad = basis.pathname.replace(/\/+$/, "");
  const cancelUrl =
    `${basis.origin}${pfad}/termin/${input.appointmentId}/absagen` +
    `?lang=${input.locale}#t=${input.actionToken}`;

  return { cancelUrl, cancelHref: escapeHtml(cancelUrl) };
};

/**
 * Gibt es einen Absage-Abschnitt in der Mail? Genau dann, wenn es einen Link
 * gibt. Ohne Link bleibt der ganze Abschnitt weg — Ueberschrift, Knopf und
 * Hinweistext.
 */
export const showsCancelAction = (actions: ReminderActions): boolean => actions.cancelUrl !== null;

export interface CancelActionTexts {
  /** Ueberschrift ueber dem Knopf. */
  title: string;
  /** Beschriftung des Knopfes. */
  cta: string;
  /** Kleingedrucktes darunter. */
  note: string;
}

/**
 * Der Aktionsabschnitt der Erinnerungsmail — als Zeichenkette, nicht als
 * Bedingung im Mail-Gerüst.
 *
 * Warum das hier steht und nicht dort: die entscheidende Zusicherung ist "ohne
 * Link kommt GAR NICHTS", und die will man ausfuehren koennen. Als
 * `${bedingung ? ... : ""}` mitten in einer 200-Zeilen-Vorlage in einer
 * Cron-Datei, die kein Test laden kann, laesst sie sich nur lesen und
 * behaupten.
 *
 * Alle Texte werden maskiert. Sie stammen heute aus dem Katalog, aber ein
 * Renderer, der auf die Herkunft seiner Eingaben vertraut, ist eine Zusage an
 * jeden kuenftigen Aufrufer.
 */
export const renderCancelAction = (actions: ReminderActions, texts: CancelActionTexts): string => {
  if (actions.cancelUrl === null) return "";
  return `
          <div class="action-section">
            <p style="margin: 0 0 15px; color: #374151; font-weight: 600;">${escapeHtml(texts.title)}</p>
            <div class="action-btns">
              <a href="${actions.cancelHref}" class="cancel-btn">❌ ${escapeHtml(texts.cta)}</a>
            </div>
            <p style="margin: 15px 0 0; font-size: 12px; color: #6B7280;">${escapeHtml(texts.note)}</p>
          </div>
`;
};
