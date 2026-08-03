/**
 * Signierte Adressen fuer Besichtigungsfotos.
 *
 * Der Bucket `besichtigung-uploads` war oeffentlich; jeder mit dem Pfad kam an
 * die Wohnungsaufnahmen fremder Kunden. Seit 20260803040000 ist er privat, und
 * gelesen wird nur noch ueber signierte, befristete Adressen.
 *
 * Befristet heisst: sie sterben. Eine Adresse, die vor zwanzig Minuten erzeugt
 * wurde, ist heute ein defektes Bild — deshalb reicht es nicht, sie einmal zu
 * holen und liegen zu lassen. Was hier steht, ist die Buchfuehrung darueber:
 * zu welcher Oeffnung des Dialogs eine Adresse gehoert, zu welcher Sitzung, und
 * wie lange sie noch gilt.
 *
 * Alles ohne Netzzugriff. Das Signieren kommt als Funktion herein, damit diese
 * Entscheidungen pruefbar sind, ohne einen Supabase-Client zu bauen.
 */

/**
 * Lebensdauer einer signierten Adresse.
 *
 * Zehn Minuten: lange genug, um eine Besichtigung in Ruhe durchzusehen, kurz
 * genug, dass ein weitergereichter Link nicht zum Dauerzugang wird.
 */
export const SIGNED_URL_TTL_SECONDS = 600;

/**
 * Sicherheitsabstand zum Ablauf.
 *
 * Eine Adresse gilt uns schon als tot, bevor sie es ist. Sonst reicht die
 * Oberflaeche in der letzten Sekunde noch eine Adresse heraus, die beim
 * Anklicken bereits abgelaufen ist — der Nutzer saehe ein kaputtes Bild und
 * haette recht mit der Annahme, dass etwas nicht stimmt.
 */
export const ABLAUF_PUFFER_SEKUNDEN = 30;

export interface PhotoRef {
  id: string;
  storage_path: string;
}

/** Genau der Ausschnitt der Storage-Schnittstelle, der hier gebraucht wird. */
export type SignFn = (
  path: string,
  ttlSeconds: number,
) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;

/**
 * Ein Satz Adressen aus EINER Oeffnung des Dialogs.
 *
 * `lauf` zaehlt die Oeffnungen. Er ist der Grund, warum ein spaet
 * eintreffendes Ergebnis nicht mehr schaden kann: wer zurueckkommt und nicht
 * mehr der aktuelle Lauf ist, wird verworfen. `sessionId` ist die zweite
 * Sperre — dieselbe Zaehlernummer bei einer anderen Besichtigung darf ebenso
 * wenig durchkommen.
 */
export interface PhotoUrlBatch {
  lauf: number;
  sessionId: string;
  /** Zeitpunkt der Signatur in ms (`Date.now()`). */
  erzeugtUm: number;
  urls: Readonly<Record<string, string>>;
}

/** Nie neu erzeugt, damit React daraus keine Aenderung ableitet. */
export const KEINE_URLS: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Signiert alle uebergebenen Fotos — jedes Mal neu.
 *
 * Es gibt hier bewusst kein "das kenne ich schon". Eine zwischengespeicherte
 * Adresse waere genau die, die inzwischen abgelaufen sein kann; sie
 * wiederzuverwenden hiesse, den Ablauf zu umgehen. Der Preis ist ein
 * Signaturlauf pro Oeffnung, und der kostet nichts.
 *
 * Fehlschlaege werden ausgelassen, nicht gemeldet und nicht ersetzt. Ein Foto
 * ohne Adresse erscheint nicht — das ist die richtige Antwort auf "du darfst
 * das nicht sehen" und auf "die Signatur ging schief" gleichermassen. Ein
 * Platzhalter oder eine geratene oeffentliche Adresse waere in beiden Faellen
 * falsch.
 *
 * Ein einzelner Fehlschlag beendet den Durchlauf nicht: die uebrigen Fotos
 * einer Besichtigung sind davon unabhaengig.
 */
export const signPhotoUrls = async (
  photos: readonly PhotoRef[],
  sign: SignFn,
): Promise<Record<string, string>> => {
  const offen = photos.filter((p) => p.storage_path);
  if (offen.length === 0) return {};

  const ergebnisse = await Promise.all(
    offen.map(async (photo) => {
      try {
        const { data, error } = await sign(photo.storage_path, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) return null;
        return [photo.id, data.signedUrl] as const;
      } catch {
        // Ein geworfener Fehler ist dasselbe Ergebnis wie ein gemeldeter: keine
        // Adresse. Bewusst still — der Aufrufer zeigt das Foto dann nicht an.
        return null;
      }
    }),
  );

  return Object.fromEntries(ergebnisse.filter((e): e is readonly [string, string] => e !== null));
};

/**
 * Darf ein eingetroffenes Ergebnis noch angewendet werden?
 *
 * Nein, wenn inzwischen ein weiterer Lauf gestartet ist (der Nutzer hat den
 * Dialog geschlossen und einen anderen geoeffnet), und nein, wenn die
 * angezeigte Besichtigung eine andere ist. Beides zusammen, nicht eines von
 * beiden: der Zaehler allein wuerde ein Ergebnis durchlassen, wenn zwei
 * Oeffnungen kollidieren; die Sitzung allein liesse ein aelteres Ergebnis
 * derselben Sitzung ein neueres ueberschreiben.
 */
export const darfUebernehmen = (
  ergebnisLauf: number,
  aktuellerLauf: number,
  ergebnisSessionId: string,
  angezeigteSessionId: string | null,
): boolean => ergebnisLauf === aktuellerLauf && ergebnisSessionId === angezeigteSessionId;

/** Verbleibende Gueltigkeit in ms, Puffer schon abgezogen. Nie negativ. */
export const verbleibendeGueltigkeitMs = (batch: PhotoUrlBatch, jetzt: number): number => {
  const endet = batch.erzeugtUm + (SIGNED_URL_TTL_SECONDS - ABLAUF_PUFFER_SEKUNDEN) * 1000;
  return Math.max(0, endet - jetzt);
};

/**
 * Die Adressen, die gerade gezeigt werden duerfen.
 *
 * Gibt `KEINE_URLS` zurueck, sobald einer der drei Gruende zutrifft: es gibt
 * keinen Satz, er gehoert zu einer anderen Besichtigung, oder er ist
 * abgelaufen. Ein abgelaufener Satz wird also nicht "noch schnell" angezeigt —
 * lieber kein Bild als ein totes.
 */
export const sichtbareUrls = (
  batch: PhotoUrlBatch | null,
  angezeigteSessionId: string | null,
  jetzt: number,
): Readonly<Record<string, string>> => {
  if (!batch || batch.sessionId !== angezeigteSessionId) return KEINE_URLS;
  if (verbleibendeGueltigkeitMs(batch, jetzt) <= 0) return KEINE_URLS;
  return batch.urls;
};
