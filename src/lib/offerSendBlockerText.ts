import type { Translator, MessageKey } from "@/i18n/translator";
import type { ReadinessFinding } from "../../supabase/functions/_shared/offerSendReadiness.ts";

/**
 * Blocker in einen Satz, den der Bediener lesen kann.
 *
 * Die Prüfung selbst liefert SCHLÜSSEL, keine Sätze — sie läuft in zwei
 * Laufzeiten und darf keinen Katalog kennen. Übersetzt wird hier, in der
 * Sprache des BEDIENERS (`useT`), nicht in der des Kunden: er ist es, der die
 * Meldung liest und die fehlende Übersetzung nachträgt.
 */

const FELDNAMEN: Record<string, string> = {
  default_payment_terms: "Zahlungskonditionen",
  payment_terms: "Zahlungskonditionen",
  title: "Titel",
  content: "Inhalt",
  language: "Kundensprache",
  locale: "Sprache",
  description: "Beschreibung",
};

const BEREICH: Record<ReadinessFinding["entity"], string> = {
  offer: "Offerte",
  offer_item: "Position",
  company: "Firmeneinstellungen",
  agb_section: "AGB",
  checklist_template: "Checkliste",
  leistungsuebersicht: "Leistungsübersicht",
  email: "E-Mail",
  pdf: "PDF",
  public_view: "Öffentliche Ansicht",
  attachment: "Anhang",
};

/** `AGB · Inhalt` — kurz genug für einen Toast, genau genug zum Finden. */
export const blockerFeldbezeichnung = (b: ReadinessFinding): string => {
  const feld = FELDNAMEN[b.field] ?? b.field;
  return `${BEREICH[b.entity]} · ${feld}`;
};

export const blockerText = (b: ReadinessFinding, t: Translator): string =>
  t(b.messageKey as MessageKey, {
    field: blockerFeldbezeichnung(b),
    locale: b.requestedLocale,
  });

/**
 * Alle Blocker als Liste. Bewusst vollständig und nicht „und 3 weitere": wer
 * drei Übersetzungen nachtragen muss, will alle drei auf einmal sehen.
 */
export const blockerListe = (blockers: ReadonlyArray<ReadinessFinding>, t: Translator): string =>
  blockers.map((b) => blockerText(b, t)).join("\n");
