/**
 * Welche Termine nennt die Auftragsbestaetigung?
 *
 * GENAU DIE, DIE IM KALENDER STEHEN
 *
 * Die Termine einer Zusage legt `create_appointments_for_auftrag` an (Trigger
 * auf `auftraege`). Die Bestaetigung an den Kunden muss dieselben Tage nennen,
 * sonst bestaetigt sie etwas anderes, als die Firma im Kalender sieht und als
 * die Erinnerung spaeter schickt. SQL kann diese Datei nicht importieren; die
 * Doppelung ist bewusst und traegt hier dieselben Regeln wie der Trigger:
 *
 *   * Gruppen sind die verschiedenen `service_type`-Werte ungleich NULL,
 *     roh verglichen, geordnet nach der kleinsten Position.
 *   * Ab ZWEI Gruppen: je Gruppe ein Termin — ihr eigenes (fruehestes) Datum,
 *     sonst das Auftragsdatum; Beginn ihre (frueheste) Startzeit, sonst die
 *     der Offerte.
 *   * Sonst EIN Termin am Auftragsdatum mit der Startzeit der Offerte.
 *   * Das Auftragsdatum ist der erste Arbeitstag nach `offer_arbeitsbeginn()`:
 *     je Gruppe (Servicetyp getrimmt, klein) das KLEINSTE eigene Datum, sonst
 *     das globale Feld; davon das frueheste.
 *
 * Das Auftragsdatum rechnet `earliestTermin` aus `offerTermin.ts` — seit
 * 2026-10-08 mit demselben Wortlaut wie die SQL-Funktion (kleinstes Datum je
 * Gruppe). Davor nahm es die ERSTE datierte Position, und diese Datei trug
 * deshalb eine eigene Abschrift der SQL-Regel.
 *
 * WAS SIE NICHT UEBERNIMMT
 *
 * Wo der Trigger ergaenzen muss, weil ein Kalendereintrag eine Uhrzeit
 * braucht, erfindet er eine: 08:00 Uhr. Dem Kunden wird sie nicht als
 * vereinbart mitgeteilt — ohne Startzeit in der Offerte bleibt `startTime`
 * leer. Und ohne jedes Datum in der Offerte erfindet der Trigger einen Tag
 * (Wunschtermin oder heute + 7); dann nennt die Mail GAR KEINEN Termin.
 *
 * KEINE ABHAENGIGKEITEN ausser `offerTermin.ts` — Deno und Vitest laden beide.
 */

import { earliestTermin, terminItemsFromRows } from "./offerTermin.ts";

export interface AcceptanceItemRow {
  service_type: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  position: number | null;
}

export interface AcceptanceOfferDates {
  service_date: string | null;
  service_start_time: string | null;
}

export interface AcceptanceTermin {
  serviceType: string | null;
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, oder `null`, wenn die Offerte keine Startzeit nennt. */
  startTime: string | null;
}

const kurzeZeit = (wert: string | null | undefined): string | null => {
  const roh = (wert ?? "").trim();
  if (roh === "") return null;
  const m = /^(\d{2}):(\d{2})/.exec(roh);
  return m ? `${m[1]}:${m[2]}` : null;
};

const kleinster = (werte: ReadonlyArray<string | null>): string | null => {
  const vorhanden = werte.filter((w): w is string => typeof w === "string" && w !== "");
  if (vorhanden.length === 0) return null;
  return [...vorhanden].sort()[0];
};

/** `offer_arbeitsbeginn()`: der erste Arbeitstag ueber alle Gruppen. */
export const arbeitsbeginn = (
  items: ReadonlyArray<AcceptanceItemRow>,
  serviceDate: string | null,
): string | null => earliestTermin(terminItemsFromRows(items), serviceDate);

export const buildAcceptanceTermine = (
  items: ReadonlyArray<AcceptanceItemRow>,
  offer: AcceptanceOfferDates,
): AcceptanceTermin[] => {
  const auftragsdatum = arbeitsbeginn(items, offer.service_date);
  if (!auftragsdatum) return [];

  const offerStart = kurzeZeit(offer.service_start_time);

  const gruppen = new Map<string, AcceptanceItemRow[]>();
  for (const item of items) {
    if (item.service_type === null) continue;
    const bisher = gruppen.get(item.service_type);
    if (bisher) bisher.push(item);
    else gruppen.set(item.service_type, [item]);
  }

  if (gruppen.size >= 2) {
    const kleinstePosition = (zeilen: AcceptanceItemRow[]): number =>
      Math.min(...zeilen.map((z) => (typeof z.position === "number" ? z.position : Number.MAX_SAFE_INTEGER)));

    return [...gruppen.entries()]
      .sort(([, a], [, b]) => kleinstePosition(a) - kleinstePosition(b))
      .map(([serviceType, zeilen]) => ({
        serviceType,
        date: kleinster(zeilen.map((z) => z.scheduled_date)) ?? auftragsdatum,
        startTime: kurzeZeit(kleinster(zeilen.map((z) => z.scheduled_start_time))) ?? offerStart,
      }));
  }

  const einzigeGruppe = gruppen.size === 1 ? [...gruppen.keys()][0] : null;
  return [{ serviceType: einzigeGruppe, date: auftragsdatum, startTime: offerStart }];
};
