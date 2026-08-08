/**
 * Der Anzeigename eines Kunden — und die Frage, wann er nachgezogen werden darf.
 *
 * BEFUND
 * `customers.display_name` wird beim Anlegen aus Vor-/Nachname bzw. Firmenname
 * gebildet (Trigger `customers_set_display_name`, 20260728100000). Der Trigger
 * füllt aber nur, was LEER ist — absichtlich, denn der Bediener darf
 * "Familie Müller" eintragen und das soll stehen bleiben.
 *
 * Folge: wer den Nachnamen korrigiert, sieht in Liste und Karte weiterhin den
 * alten Namen. Wer stattdessen bei jedem Speichern neu bildet, überschreibt
 * "Familie Müller".
 *
 * ABHILFE
 * Die Unterscheidung ist entscheidbar, ohne sie zu speichern: trägt der Kunde
 * genau den Namen, den die Regel aus seinen HEUTIGEN Feldern bilden würde, dann
 * folgt er dem Namen und wird nachgezogen. Weicht er ab, ist er von Hand
 * gesetzt und bleibt unangetastet — es sei denn, der Bediener sagt im Formular
 * ausdrücklich etwas anderes.
 *
 * Diese Datei ist die BEDIENER-SEITIGE Spiegelung des Triggers und dient der
 * Vorschau. Geschrieben wird der Name weiterhin von der Datenbank: das Formular
 * sendet einen leeren `display_name`, und der Trigger bildet ihn aus den neuen
 * Werten. So gibt es genau eine Regel und nicht zwei, die auseinanderlaufen.
 */

export type NamensFelder = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  primary_email?: string | null;
  primary_phone?: string | null;
};

const sauber = (wert: string | null | undefined): string => (wert ?? "").trim();

/**
 * Zeichengleich zu `customers_set_display_name()`: Vor- und Nachname, sonst
 * Firmenname, sonst E-Mail, sonst Telefonnummer.
 *
 * Die Normalisierung von E-Mail und Telefon (lower/E.164) wird hier NICHT
 * nachgebaut — sie ist nur der letzte Notnagel des Triggers, und ein Kunde ohne
 * jeden Namen ist in der Oberfläche ohnehin ein Sonderfall. Für die Vorschau
 * genügt der Rohwert; geschrieben wird der Name von der Datenbank.
 */
export const abgeleiteterAnzeigename = (felder: NamensFelder): string => {
  const person = [sauber(felder.first_name), sauber(felder.last_name)].filter(Boolean).join(" ");
  return (
    person ||
    sauber(felder.company_name) ||
    sauber(felder.primary_email).toLowerCase() ||
    sauber(felder.primary_phone)
  );
};

/**
 * Folgt der aktuelle Anzeigename der Regel — oder hat ihn jemand gesetzt?
 *
 * Verglichen wird gegen die HEUTIGEN Feldwerte, nicht gegen die künftigen:
 * die Frage lautet "war der Name bisher abgeleitet?", nicht "wäre er es
 * nachher?".
 */
export const folgtDemNamen = (
  anzeigename: string | null | undefined,
  aktuelleFelder: NamensFelder,
): boolean => {
  const ist = sauber(anzeigename);
  if (!ist) return true; // leer heisst: die Datenbank bildet ihn ohnehin
  return ist.toLowerCase() === abgeleiteterAnzeigename(aktuelleFelder).toLowerCase();
};
