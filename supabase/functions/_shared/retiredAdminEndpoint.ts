/**
 * Der gemeinsame Grabstein der sechs `admin-*`-Endpunkte.
 *
 * ── Was diese Funktionen waren ─────────────────────────────────────────────
 *
 * Benutzerverwaltung der Offerio-Plattform: Konten anlegen und loeschen,
 * Passwoerter zuruecksetzen, E-Mail-Adressen aendern, Mitglieder zu Firmen
 * hinzufuegen und entfernen. Sie stammen aus der Zeit, in der es eine
 * Plattformverwaltung ueber vielen Firmen gab.
 *
 * Diese Oberflaeche ist mit dem Marktplatz entfernt worden. Gemessen ueber das
 * ganze Repo: keine der sechs hat noch einen Aufrufer — nicht im Frontend,
 * nicht in einer anderen Edge Function, nicht in SQL oder Cron. Uebrig sind
 * Eintraege in der Auslieferungsliste und in `config.toml`.
 *
 * ── Warum ein Grabstein und keine geloeschte Datei ─────────────────────────
 *
 * Weil das Loeschen nichts abschaltet. Der ausgelieferte Stand liegt auf dem
 * Server getrennt von der Quelle; ob diese Funktionen dort laufen, ist heute
 * NICHT gemessen — anders als bei `resend-email`, wo nachgesehen wurde. Solange
 * das offen ist, waere eine geloeschte Quelle die schlechteste Variante: die
 * alte Fassung liefe weiter, und niemand koennte sie noch ersetzen.
 *
 * Der Grabstein dagegen laesst sich ausliefern und macht aus jedem der sechs
 * Endpunkte eine Antwort ohne Wirkung. Ob und wann das geschieht, entscheidet
 * eine Bestandsaufnahme auf dem Server — nicht diese Datei.
 *
 * ── Was hier passiert ──────────────────────────────────────────────────────
 *
 * Nichts. Kein Datenbankzugriff, kein Anlegen eines Clients, kein Lesen der
 * Umgebung, kein Lesen des Anfragekoerpers, keine Protokollzeile. Die Antwort
 * haengt an genau einem Wert — der Methode.
 *
 * Es ist bewusst dieselbe Form wie in `resendEmailTombstone.ts` und trotzdem
 * eine eigene Datei: jene beschreibt einen Endpunkt, der nachweislich nicht
 * mehr existiert, diese sechs, deren Zustand offen ist. Sie zusammenzulegen
 * wuerde zwei verschiedene Aussagen in eine Datei zwingen.
 */

export interface RetiredAdminResult {
  status: number;
  /** `null` heisst: Antwort ohne Koerper. */
  body: Record<string, string> | null;
  headers: Record<string, string>;
}

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
 * Exakt und in Grossschreibung verglichen: `post` ist keine Methode, sondern
 * eine falsch gestellte Anfrage. Nichts aus der Anfrage erscheint in der
 * Antwort — auch die Methode nicht.
 */
export const retiredAdminResponse = (method: string): RetiredAdminResult => {
  if (method === "OPTIONS") {
    return { status: 200, body: null, headers: { ...GEMEINSAME_KOPFZEILEN } };
  }

  if (method === "POST") {
    // 410 statt 404: der Endpunkt hat existiert und ist absichtlich weg.
    return { status: 410, body: { error: "endpoint_retired" }, headers: { ...JSON_KOPFZEILEN } };
  }

  return {
    status: 405,
    body: { error: "method_not_allowed" },
    headers: { ...JSON_KOPFZEILEN, Allow: "POST, OPTIONS" },
  };
};

/** Die sechs Endpunkte, die diesen Grabstein tragen. Reihenfolge alphabetisch. */
export const RETIRED_ADMIN_FUNCTIONS: readonly string[] = [
  "admin-add-company-member",
  "admin-create-user",
  "admin-delete-user",
  "admin-remove-company-member",
  "admin-reset-password",
  "admin-update-user-email",
];
