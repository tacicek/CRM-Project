/**
 * Full-width email shell: 100% width, white background, zero outer gutter.
 * Use for all transactional HTML emails (Resend) for consistent mobile/desktop layout.
 */

export const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Wraps inner HTML in a document with viewport meta and a 100%-width table.
 * White background, no outer padding — content fills the full email width.
 */
export function wrapEmailDocument(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="width:100%;max-width:100%;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;background:#ffffff;">
    <tr>
      <td style="padding:0;font-family:${EMAIL_FONT_STACK};line-height:1.55;color:#18181b;">
        ${innerHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Neutral card — full width, no rounded border on mobile. */
export const EMAIL_CARD_OUTER =
  "width:100%;max-width:100%;box-sizing:border-box;background:#fafafa;border-top:1px solid #d4d4d8;border-bottom:1px solid #d4d4d8;";

/** Header band: colored top strip. */
export const EMAIL_HEADER_BAND =
  "padding:20px 16px;background:#ececee;border-bottom:1px solid #d4d4d8;";

/** Main content area inside card. */
export const EMAIL_BODY_PADDING = "padding:20px 16px;background:#fafafa;";
