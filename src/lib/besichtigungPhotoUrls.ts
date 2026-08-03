/**
 * Signierte Adressen fuer Besichtigungsfotos.
 *
 * Der Bucket `besichtigung-uploads` war oeffentlich; jeder mit dem Pfad kam an
 * die Wohnungsaufnahmen fremder Kunden. Seit 20260803040000 ist er privat, und
 * gelesen wird nur noch ueber signierte, befristete Adressen.
 *
 * Was hier steht, ist der Teil ohne Netzzugriff: welche Fotos ueberhaupt
 * angefragt werden und was mit einer fehlgeschlagenen Signatur passiert. Das
 * Signieren selbst kommt als Funktion herein, damit diese Entscheidung pruefbar
 * ist, ohne einen Supabase-Client zu bauen.
 */

/**
 * Lebensdauer einer signierten Adresse.
 *
 * Zehn Minuten: lange genug, um eine Besichtigung in Ruhe durchzusehen, kurz
 * genug, dass ein weitergereichter Link nicht zum Dauerzugang wird. Der Dialog
 * fordert beim naechsten Oeffnen neu an.
 */
export const SIGNED_URL_TTL_SECONDS = 600;

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
 * Signiert die Fotos, die noch keine Adresse haben, und gibt nur die neuen
 * zurueck.
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
  bereitsBekannt: Readonly<Record<string, string>>,
  sign: SignFn,
): Promise<Record<string, string>> => {
  const offen = photos.filter((p) => !bereitsBekannt[p.id] && p.storage_path);
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
