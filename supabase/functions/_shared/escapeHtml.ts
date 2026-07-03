/**
 * Escape user-supplied text before interpolating it into email HTML.
 *
 * Public token endpoints (offer/proposal/reschedule responses) build notification emails
 * from customer-entered free text (names, messages, notes). Without escaping, a value like
 * `<img src=x onerror=...>` injects arbitrary HTML into the email the firma receives.
 */
export const escapeHtml = (s: string | null | undefined): string => {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};
