/**
 * Reine Entscheidungen rund um den aktiven Mandanten.
 *
 * Unter `/firma` gibt es genau eine Quelle fuer "welche Firma" — die Auswahl im
 * `CompanyProvider`. Alles, was daneben eine eigene Antwort bildet, ist ein
 * zweiter Mandant im selben Bildschirm. Diese Datei haelt die beiden Regeln
 * fest, die das verhindern, und haelt sie frei von React, damit sie pruefbar
 * bleiben.
 */

/**
 * Darf eine geladene Geschaeftszeile unter dem aktiven Mandanten gezeigt werden?
 *
 * FAIL CLOSED. Fehlt der aktive Mandant noch, oder traegt die Zeile keine
 * `company_id`, lautet die Antwort `false` — nicht "wahrscheinlich schon".
 *
 * Die aufrufende Seite behandelt `false` wie "nicht gefunden" und verraet damit
 * auch nicht, dass die Zeile existiert. Ein eigener Text "gehoert einer anderen
 * Firma" waere eine Auskunft ueber fremde Daten.
 */
export const zeileGehoertZumMandanten = (
  zeile: { company_id?: string | null } | null | undefined,
  aktiveFirmaId: string | null | undefined,
): boolean => {
  if (!aktiveFirmaId) return false;
  if (!zeile) return false;
  return zeile.company_id === aktiveFirmaId;
};

/**
 * Darf eine eingetroffene Antwort noch in den Bildschirm geschrieben werden?
 *
 * Der Mandantenwechsel ist sofort, die laufende Abfrage nicht. Wer waehrend
 * einer langsamen Abfrage von A nach B wechselt, bekommt sonst A-Daten unter
 * der Ueberschrift B — ohne Fehler, ohne Hinweis, und genau so lange, bis
 * jemand es glaubt.
 */
export const antwortGehoertNochZumMandanten = (
  angefordertFuer: string | null | undefined,
  jetztAktiv: string | null | undefined,
): boolean => {
  if (!angefordertFuer || !jetztAktiv) return false;
  return angefordertFuer === jetztAktiv;
};
