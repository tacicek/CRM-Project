/**
 * Der Grabstein von `resend-email`.
 *
 * ── Warum die Funktion stillgelegt wird ─────────────────────────────────────
 *
 * Sie hiess „Wiederversand", war aber keiner. `email_logs` speichert Empfaenger,
 * Betreff, Typ, Status und Metadaten — es speichert NICHT den Text der Mail und
 * keine Anhaenge. Was die Funktion verschickte, war deshalb eine allgemeine
 * Vorlage mit dem alten Betreff darin: keine Offerte, kein PDF, keine Rechnung,
 * keine Quittung. Zwei Saetze darin waren sogar schlicht falsch — sie
 * behaupteten, die urspruengliche Zustellung sei fehlgeschlagen, und baten den
 * Kunden, sich „in seinem Konto anzumelden". Kunden haben hier kein Konto.
 *
 * Dazu kam die Angriffsflaeche: kein JWT, keine Firmenzugehoerigkeit, kein
 * Methodenriegel, keine Groessengrenze — und als Erstes ein Client mit dem
 * Service-Role-Schluessel. Wer irgendeine Protokoll-id in die Hand bekam, konnte
 * damit Mail an den Kunden einer fremden Firma ausloesen, deren Protokollzeile
 * veraendern und eine neue anlegen, die sich ihrerseits wieder verwenden liess.
 *
 * Ein Guard haette das abgesichert — und danach immer noch das falsche Produkt
 * geliefert. Das Produkt hat den echten Weg bereits: `sendOffer` mit
 * `forceResend`, das die Offerte samt PDF neu erzeugt.
 *
 * ── Was in der Produktion tatsaechlich steht ────────────────────────────────
 *
 * NICHTS. Am 2026-08-03 wurde lesend nachgesehen: unter dem Pfad, den der
 * Edge-Container als Funktionsverzeichnis eingehaengt hat, liegen 41 Ordner —
 * `resend-email` ist keiner davon. Weder die alte Fassung noch dieser Grabstein
 * sind dort ausgeliefert.
 *
 * Daraus folgen zwei Dinge:
 *
 *   1. Dieser Grabstein wird NICHT ausgeliefert. Es gibt nichts zu ersetzen,
 *      und eine Auslieferung wuerde eine Route wieder anlegen, die es nicht
 *      gibt. Der Eintrag ist deshalb aus `migration-scripts/deploy-functions.sh`
 *      entfernt worden.
 *
 *   2. Er bleibt trotzdem im Quelltext stehen — als Sicherung. Laeuft das
 *      Auslieferungsskript eines Tages doch ueber diesen Ordner, entsteht eine
 *      wirkungslose 410-Route und nicht die alte, ungeschuetzte Funktion. Die
 *      Datei ersatzlos zu loeschen haette genau diese Sicherung entfernt: der
 *      alte Stand stuende dann wieder eine `git revert`-Laenge entfernt vom
 *      naechsten Auslieferungslauf.
 *
 * Die urspruengliche Ueberlegung — erst Grabstein ausliefern, dann entfernen —
 * galt fuer den Fall, dass die alte Fassung noch laeuft. Sie tut es nicht.
 *
 * ── Was hier NICHT mehr passiert ────────────────────────────────────────────
 *
 * Nichts. Kein Datenbankzugriff, kein Mailversand, kein Lesen der Umgebung,
 * kein Lesen des Anfragekoerpers, keine Protokollzeile. Die Antwort haengt an
 * genau einem Wert — der Methode — und ist sonst fuer jede Anfrage dieselbe.
 * Deshalb steht sie hier und laesst sich ausfuehren, statt in einer Datei zu
 * stehen, die kein Test laden kann.
 */

export interface TombstoneResult {
  status: number;
  /** `null` heisst: Antwort ohne Koerper. */
  body: Record<string, string> | null;
  headers: Record<string, string>;
}

/**
 * Fuer alle Antworten dieselben Kopfzeilen — keine davon haengt an der
 * Anfrage. Die offene CORS-Freigabe bleibt wie bisher; sie war schon vorher da
 * und ist an einem Endpunkt ohne jede Wirkung ohne Belang.
 *
 * `no-store`, damit kein Zwischenspeicher eine Antwort dieses Endpunkts
 * aufbewahrt — er wird verschwinden, und eine gespeicherte 410 waere danach
 * genauso irrefuehrend wie eine gespeicherte 200.
 */
const GEMEINSAME_KOPFZEILEN: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const JSON_KOPFZEILEN: Record<string, string> = {
  ...GEMEINSAME_KOPFZEILEN,
  "Content-Type": "application/json",
};

/**
 * Methode rein, feste Antwort raus.
 *
 * Verglichen wird EXAKT und in Grossschreibung. HTTP-Methoden sind
 * gross geschrieben; `post` ist keine Methode, sondern eine falsch gestellte
 * Anfrage, und die bekommt `405`. Kleinschreibung stillschweigend zu
 * normalisieren waere Entgegenkommen an einer Stelle, an der es nichts
 * entgegenzukommen gibt.
 */
export const tombstoneResponse = (method: string): TombstoneResult => {
  if (method === "OPTIONS") {
    return { status: 200, body: null, headers: { ...GEMEINSAME_KOPFZEILEN } };
  }

  if (method === "POST") {
    // 410 und nicht 404: der Endpunkt hat existiert, er ist absichtlich weg und
    // kommt nicht wieder. Das ist die Auskunft, die ein Aufrufer braucht.
    return { status: 410, body: { error: "endpoint_retired" }, headers: { ...JSON_KOPFZEILEN } };
  }

  return {
    status: 405,
    body: { error: "method_not_allowed" },
    headers: { ...JSON_KOPFZEILEN, Allow: "POST, OPTIONS" },
  };
};
