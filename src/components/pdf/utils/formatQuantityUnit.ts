/**
 * German singular/plural labels for PDF quantity + unit display.
 */
export function formatQuantityUnit(quantity: number, unitRaw: string): string {
  const unit = (unitRaw || "").trim();
  if (quantity !== 1) {
    return `${quantity} ${unit}`.trim();
  }
  const lower = unit.toLowerCase();
  if (lower === "stunden" || unit === "Stunden") return "1 Stunde";
  if (lower === "tage" || unit === "Tage") return "1 Tag";
  if (lower === "tag" || unit === "Tag") return "1 Tag";
  if (lower === "personen" || unit === "Personen") return "1 Person";
  if (lower === "person" || unit === "Person") return "1 Person";
  return `1 ${unit}`.trim();
}
