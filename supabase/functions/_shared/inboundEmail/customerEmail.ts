/**
 * Welche Adresse gehört dem KUNDEN?
 *
 * Klingt trivial, ist es nicht: die Firma leitet ihr eigenes Postfach
 * (info@…) an die Empfangsadresse weiter. Viele Weiterleitungen ersetzen dabei
 * den Absender durch das weiterleitende Postfach. Der Kopf sagt dann
 * "info@hirschenumzug.ch", obwohl der Kunde jemand ganz anderes ist.
 *
 * Wird diese Adresse als customer_email gespeichert, schickt die Firma ihre
 * Offerte an sich selbst — und der Spam-Score-Trigger, der Leads pro Adresse
 * zählt, sieht jeden Kunden als denselben.
 *
 * Reihenfolge, von der verlässlichsten Quelle abwärts:
 *   1. was im TEXT stand (Formular-Mails führen die Adresse dort auf)
 *   2. Reply-To — genau dafür setzen Weiterleitungen diesen Kopf
 *   3. der Absender, aber nur wenn er nicht der Firma selbst gehört
 *
 * Lieber gar keine Adresse als die falsche: eine leere lässt sich im Review
 * nachtragen, eine falsche fällt niemandem auf.
 *
 * Rein — unit getestet.
 */

const SYSTEM_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "bounce",
  "bounces",
  "mailer-daemon",
  "postmaster",
  "mail-daemon",
];

const normalize = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

const localPart = (address: string): string => address.split("@")[0] ?? "";

/** Adressen, die der Firma selbst gehören — nie die des Kunden. */
export const buildCompanyAddressSet = (values: (string | null | undefined)[]): Set<string> => {
  const set = new Set<string>();
  for (const value of values) {
    const address = normalize(value);
    if (address.includes("@")) set.add(address);
  }
  return set;
};

export const isUsableCustomerAddress = (
  address: string | null | undefined,
  companyAddresses: Set<string>,
): boolean => {
  const candidate = normalize(address);
  if (!candidate.includes("@")) return false;
  if (companyAddresses.has(candidate)) return false;

  const local = localPart(candidate);
  return !SYSTEM_LOCAL_PARTS.some((part) => local === part || local.startsWith(`${part}+`));
};

export const pickCustomerEmail = (opts: {
  /** Was das Modell im Text gefunden hat. */
  extracted?: string | null;
  /** Absender laut Kopfzeile. */
  fromEmail?: string | null;
  /** Reply-To, falls die Weiterleitung eines gesetzt hat. */
  replyTo?: string | null;
  companyAddresses: Set<string>;
}): string | null => {
  const candidates = [opts.extracted, opts.replyTo, opts.fromEmail];

  for (const candidate of candidates) {
    if (isUsableCustomerAddress(candidate, opts.companyAddresses)) {
      return normalize(candidate);
    }
  }
  return null;
};

/** `"Max Müller" <max@example.com>` → `max@example.com`. */
export const addressFromHeader = (value: string | null | undefined): string | null => {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const angled = raw.match(/<([^>]+)>/);
  const address = normalize(angled ? angled[1] : raw);
  return address.includes("@") ? address : null;
};
