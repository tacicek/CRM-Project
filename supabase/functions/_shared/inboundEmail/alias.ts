/**
 * Empfängeradresse → Firma.
 *
 * Ein Alias darf zwei Formen haben:
 *
 *   anfragen@firma.example      exakte Adresse
 *   @id.resend.app              die ganze Domain
 *
 * Die Domain-Form gibt es, weil Resend an eine Empfangs-Domain JEDEN local part
 * zustellt (`anfragen@`, `info@`, `kontakt@` …). Wer die Weiterleitung später auf
 * eine andere Schreibweise umstellt, soll nicht plötzlich Mails verlieren, die
 * still verworfen werden, weil die Adresse nicht exakt passte.
 *
 * Die exakte Adresse gewinnt: erst wenn keine passt, entscheidet die Domain.
 * So kann eine Domain einer Firma gehören und eine einzelne Adresse darauf
 * trotzdem einer anderen zugeordnet sein — genau das, was der spätere
 * Mehrmandanten-Betrieb braucht.
 *
 * Rein — unit getestet.
 */

export interface AliasRow {
  company_id: string;
  key_value: string;
}

const normalize = (value: string): string => value.trim().toLowerCase();

const domainOf = (address: string): string => {
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1);
};

export const matchCompanyByRecipient = (
  recipients: string[],
  aliases: AliasRow[],
): string | null => {
  const wanted = recipients.map(normalize).filter((entry) => entry.length > 0);
  if (wanted.length === 0) return null;

  const exact: AliasRow[] = [];
  const domains: AliasRow[] = [];

  for (const alias of aliases) {
    const value = normalize(String(alias?.key_value ?? ""));
    if (!value) continue;
    (value.startsWith("@") ? domains : exact).push({ ...alias, key_value: value });
  }

  for (const alias of exact) {
    if (wanted.includes(alias.key_value)) return alias.company_id;
  }

  for (const alias of domains) {
    const domain = alias.key_value.slice(1);
    if (wanted.some((recipient) => domainOf(recipient) === domain)) return alias.company_id;
  }

  return null;
};
