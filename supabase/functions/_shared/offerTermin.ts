/**
 * Wann findet die Leistung statt? Genau eine Antwort, für alle, die sie drucken.
 *
 * ZWEI SPEICHERORTE, EINE REGEL
 *
 * Das Datum steht an zwei Stellen: `offers.service_date` (das globale Feld oben
 * im Formular) und `offer_items.scheduled_date` (je Servicegruppe, unten bei den
 * Positionen). Beide sind frei editierbar, nichts hält sie zusammen.
 *
 * Der Bediener bekommt dazu eine Zusage, und sie steht im Formular neben dem
 * Gruppendatum: «Leer = globales Ausführungsdatum gilt.» Gefüllt gilt also das
 * Gruppendatum. `ServiceTable` hält sich daran und erklärt es in seinem
 * Kommentar; `AddressComparison` unterdrückt folgerichtig die globale
 * TERMIN-Zelle, sobald Gruppendaten da sind — sonst stünde dieselbe Auskunft
 * zweimal da, einmal unter der falschen Zahl.
 *
 * Die moderne Vorlage hat diese Regel nie bekommen. Sie las
 * `executionDate ?? Gruppendatum` — global zuerst, und ohne Unterdrückung.
 * Vierzehn Zeilen weiter unten, in derselben Datei, stand die Regel richtig
 * herum. Damit druckte Offerte 10098 in den Bändern den 02.10. und in «Auf
 * einen Blick» den 04.09.; die Positionen widersprachen der Kopfzeile, und der
 * Kunde las die Kopfzeile. Betroffen war genau die Firma, die auf `modern`
 * steht.
 *
 * Deshalb entscheidet die Frage ab jetzt eine Funktion, und jede Vorlage, die
 * Oberfläche, die öffentliche Seite und die E-Mail rufen dieselbe auf.
 *
 * KEINE ABHÄNGIGKEITEN: Deno und Browser laden dieselbe Datei — wie
 * `offerAcceptanceWindow.ts`, aus demselben Grund.
 */

/** Das Wenige, das die Regel von einer Position braucht. */
export interface TerminItem {
  serviceType?: string | null;
  scheduledDate?: string | null;
}

/** Die Zeile, wie sie aus der Datenbank kommt (Oberfläche, öffentliche Seite, E-Mail). */
export interface TerminRow {
  service_type?: string | null;
  scheduled_date?: string | null;
}

/**
 * Datenbankzeilen in die Form bringen, die die Regel liest. Steht hier, damit
 * die drei Aufrufer nicht drei eigene Umformungen pflegen.
 */
export const terminItemsFromRows = (rows: ReadonlyArray<TerminRow>): TerminItem[] =>
  rows.map((r) => ({ serviceType: r.service_type ?? null, scheduledDate: r.scheduled_date ?? null }));

/** Bucket-Schlüssel wie in `groupItemsByService`: trim + lowercase, leer → null. */
const gruppenSchluessel = (serviceType: string | null | undefined): string | null => {
  const roh = (serviceType ?? "").trim().toLowerCase();
  return roh === "" ? null : roh;
};

/** `true`, sobald EINE Position ein eigenes Datum trägt. */
export const hasGroupTermine = (items: ReadonlyArray<TerminItem>): boolean =>
  items.some((i) => Boolean(i.scheduledDate));

/**
 * Das Datum EINER Gruppe: ihr eigenes, sonst das globale. Die Reihenfolge ist
 * die Zusage aus dem Formular — das Gruppendatum gewinnt.
 */
export const groupTermin = (
  groupItems: ReadonlyArray<TerminItem>,
  executionDate: string | null | undefined,
): string | null => {
  const eigenes = groupItems.find((i) => i.scheduledDate)?.scheduledDate;
  return eigenes ?? executionDate ?? null;
};

/**
 * Das eine Datum, das ein Dokument als DEN Termin nennen darf.
 *
 * `null` heisst nicht «unbekannt», sondern «es gibt keinen einzelnen»: die
 * Gruppen sind an verschiedenen Tagen, und eine Kopfzeile müsste eine davon
 * unterschlagen. Dann schweigt die Kopfzeile und die Bänder sagen es je Gruppe.
 *
 * Ohne jedes Gruppendatum kommt das globale Feld heraus — das alte Verhalten
 * bleibt damit für die grosse Mehrheit der Offerten unverändert.
 */
export const resolveOfferTermin = (
  items: ReadonlyArray<TerminItem>,
  executionDate: string | null | undefined,
): string | null => {
  if (items.length === 0) return executionDate ?? null;

  const proGruppe = new Map<string | null, TerminItem[]>();
  for (const item of items) {
    const k = gruppenSchluessel(item.serviceType);
    const bisher = proGruppe.get(k);
    if (bisher) bisher.push(item);
    else proGruppe.set(k, [item]);
  }

  const daten = new Set<string>();
  for (const gruppe of proGruppe.values()) {
    const d = groupTermin(gruppe, executionDate);
    if (d) daten.add(d);
  }

  if (daten.size === 1) return [...daten][0];
  return null;
};
