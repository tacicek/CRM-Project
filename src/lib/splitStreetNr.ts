/**
 * Split combined street lines from browser autofill / paste (CH/DE style).
 * Examples: "Musterstrasse 12a", "Bahnhofstrasse 5", "Im Rank 3", "Rue du Rhône 45, Etage 2"
 * (comma variants: take first segment before comma for the trailing-number match.)
 */
export function splitStreetNr(value: string): { street: string; nr: string } | null {
  const firstLine = value.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return null;

  const beforeComma = firstLine.split(",")[0]?.trim() ?? firstLine;

  const spaceMatch = beforeComma.match(/^(.+?)\s+(\d+[a-zA-Z\-/]*)$/);
  if (spaceMatch) {
    return { street: spaceMatch[1].trim(), nr: spaceMatch[2].trim() };
  }

  const commaMatch = firstLine.match(/^(.+?),\s*(\d+[a-zA-Z\-/]*)$/);
  if (commaMatch) {
    return { street: commaMatch[1].trim(), nr: commaMatch[2].trim() };
  }

  return null;
}
