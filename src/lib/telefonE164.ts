/**
 * Telefonnummer in E.164 — die BEDIENER-seitige Spiegelung von
 * `public.normalize_customer_phone()` (Migration 20260728100000).
 *
 * WARUM DAS HIER NOETIG IST
 * Die Datenbank speichert die eingetippte Nummer roh und berechnet daneben
 * `phone_normalized`. Nur dieser normalisierte Wert taugt zum Abgleich: er
 * entscheidet, ob eine neue Anfrage an einem bestehenden Kunden landet oder
 * einen zweiten anlegt. Eine Nummer ohne erkennbares Praefix ("79 123 45 67")
 * wird VERWORFEN statt geraten — der Kunde ist dann im Abgleich unerreichbar,
 * und niemand erfaehrt es.
 *
 * Das Formular kann das vorher sagen. Es prueft mit derselben Regel und warnt,
 * bevor gespeichert wird.
 *
 * Die Regel selbst bleibt in der Datenbank — diese Datei entscheidet nichts,
 * sie sagt nur voraus.
 */

/** `null`, wenn die Nummer nicht eindeutig zu einer E.164-Form fuehrt. */
export const normalisiereTelefonE164 = (roh: string | null | undefined): string | null => {
  if (roh === null || roh === undefined) return null;

  const v = roh.replace(/[\s\-()./]/g, "");
  if (v === "") return null;

  const ziffern = (ab: number): string => v.slice(ab).replace(/\D/g, "");

  if (v.startsWith("+")) {
    const d = ziffern(1);
    return d.length >= 7 ? `+${d}` : null;
  }
  if (v.startsWith("0041")) {
    const d = ziffern(4);
    return d.length >= 7 ? `+41${d}` : null;
  }
  if (v.startsWith("00")) {
    const d = ziffern(2);
    return d.length >= 9 ? `+${d}` : null;
  }
  if (v.startsWith("0")) {
    const d = ziffern(1);
    return d.length >= 8 ? `+41${d}` : null;
  }

  // Kein erkennbares Praefix — mehrdeutig, wird verworfen statt geraten.
  return null;
};

/** Leer ist erlaubt (das Feld ist optional); gefuellt muss es aufloesbar sein. */
export const istBrauchbareTelefonnummer = (roh: string | null | undefined): boolean =>
  (roh ?? "").trim() === "" || normalisiereTelefonE164(roh) !== null;
