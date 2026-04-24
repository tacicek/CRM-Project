/**
 * Detect the appropriate German salutation for a Swiss business letter (SN 010 130).
 *
 * Priority:
 * 1. Explicit `customerSalutation` from the form (e.g. "Herr", "Frau")
 * 2. Heuristic: last character of first name (a, e, i → likely female)
 * 3. If a full name is known → default to "Sehr geehrter Herr [Nachname],"
 * 4. Only if the name is missing → "Sehr geehrte Damen und Herren,"
 */
export function detectSalutation(
  customerName: string,
  customerSalutation?: string | null
): string {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return "Sehr geehrte Damen und Herren,";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];

  if (customerSalutation) {
    const s = customerSalutation.toLowerCase();
    if (s.includes("herr")) return `Sehr geehrter Herr ${lastName},`;
    if (s.includes("frau")) return `Sehr geehrte Frau ${lastName},`;
  }

  const lastChar = firstName.toLowerCase().slice(-1);
  if (firstName.length > 1 && ["a", "e", "i"].includes(lastChar)) {
    return `Sehr geehrte Frau ${lastName},`;
  }

  return `Sehr geehrter Herr ${lastName},`;
}
