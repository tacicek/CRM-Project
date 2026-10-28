/** Escapes plain text for HTML text/attribute contexts; never use on trusted markup. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character] ?? character);

export const emailBrandColor = (value: string | null | undefined): string => {
  if (!value) return "#10B981";
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Ungültige Markenfarbe.");
  return value;
};
