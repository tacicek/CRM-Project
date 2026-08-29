/**
 * Wohin nach der Anmeldung?
 *
 * Bis 2026-08-28 stellte `Auth.tsx` die Frage "welche EINE Firma ist meine?" —
 * über denselben ratenden Helfer wie die /firma-Seiten. Die Antwort entschied
 * dann über den Bildschirm, den der Benutzer zu sehen bekam.
 *
 * Bei mehreren Mitgliedschaften war das nicht nur unscharf, sondern falsch:
 * wer in einer verifizierten Firma A und einer noch nicht verifizierten Firma B
 * Mitglied ist, konnte "Verifizierung ausstehend" zu lesen bekommen, weil B
 * zufällig die zuletzt angelegte war. Die eigene, freigeschaltete Firma A lag
 * daneben und wurde nicht gefragt.
 *
 * Die richtige Frage lautet nicht "welche eine", sondern "gibt es überhaupt
 * eine, die mich hereinlässt?". Genau das entscheidet diese Funktion — rein,
 * ohne Netz, ohne Kontext. Die AUSWAHL des aktiven Mandanten trifft danach der
 * `CompanyProvider`; hier geht es nur um die Weiche.
 */

export type AnmeldeZiel =
  /** Keine Mitgliedschaft — es gibt nichts zu betreten. */
  | "keine-firma"
  /** Mitgliedschaften vorhanden, aber keine davon freigeschaltet. */
  | "verifizierung-ausstehend"
  /** Mindestens eine freigeschaltete Firma — weiter ins Dashboard. */
  | "dashboard";

export const entscheideAnmeldeZiel = (
  firmen: ReadonlyArray<{ is_verified: boolean | null }>,
): AnmeldeZiel => {
  if (firmen.length === 0) return "keine-firma";
  // `is_verified === true`, nicht `!== false`: ein NULL ist keine Freischaltung,
  // sondern eine fehlende Angabe. Wer daraus "wahrscheinlich ja" macht, öffnet
  // das Dashboard für eine Firma, die niemand geprüft hat.
  if (firmen.some((f) => f.is_verified === true)) return "dashboard";
  return "verifizierung-ausstehend";
};
