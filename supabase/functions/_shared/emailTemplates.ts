/**
 * Shared email templates for lead distribution notifications.
 * Extracted from match-lead/index.ts to reduce file size and improve maintainability.
 */

import { getDashboardAppBaseUrl } from "./dashboardAppUrl.ts";
import { getAppName, getSiteUrl } from "./envConfig.ts";
import {
  EMAIL_BODY_PADDING,
  EMAIL_CARD_OUTER,
  EMAIL_HEADER_BAND,
  wrapEmailDocument,
} from "./emailLayout.ts";

interface CompanyLeadEmailParams {
  companyName: string;
  serviceLabel: string;
  locationInfo: string;
  distanceText: string;
  tokenCost: number;
  dashboardUrl?: string;
  acceptUrl?: string;
  lead: {
    from_plz: string;
    from_city: string;
    to_plz?: string;
    to_city?: string;
    preferred_date?: string;
    from_rooms?: number;
    from_living_space_m2?: number;
    instrument_type?: string;
  };
  estimatedJobPrice: {
    min_price: number;
    max_price: number;
  };
  /** Admin notify path: no token/accept/CHF blocks; dashboard CTA only */
  simpleNotify?: boolean;
}

/**
 * Build HTML email for company lead notification.
 */
export function buildCompanyLeadNotificationEmail(params: CompanyLeadEmailParams): string {
  const {
    companyName,
    serviceLabel,
    locationInfo,
    distanceText,
    tokenCost,
    dashboardUrl,
    acceptUrl,
    lead,
    estimatedJobPrice,
    simpleNotify,
  } = params;
  const year = new Date().getFullYear();
  const dashboardLink = dashboardUrl || `${getDashboardAppBaseUrl()}/firma/anfragen`;
  const preferredDateStr = lead.preferred_date
    ? new Date(lead.preferred_date).toLocaleDateString("de-CH")
    : "Flexibel";
  const avgPrice = Math.round((estimatedJobPrice.min_price + estimatedJobPrice.max_price) / 2);
  const roi = tokenCost > 0 ? Math.round((avgPrice / tokenCost) * 10) / 10 : 0;

  const priceBlock =
    !simpleNotify && estimatedJobPrice.min_price > 0
      ? `
    <div style="background:#f4f4f5;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;text-align:center;">
      <p style="color:#52525b;margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Geschätzter Auftragswert</p>
      <p style="color:#18181b;margin:0;font-size:22px;font-weight:600;">
        CHF ${estimatedJobPrice.min_price.toLocaleString("de-CH")} – ${estimatedJobPrice.max_price.toLocaleString("de-CH")}
      </p>
    </div>`
      : "";

  const tokenRow =
    !simpleNotify && tokenCost > 0
      ? `
        <tr style="border-top:1px dashed #d4d4d8;">
          <td style="padding:12px 0 8px 0;color:#52525b;">Token-Kosten:</td>
          <td style="padding:12px 0 8px 0;font-weight:600;color:#18181b;">${tokenCost} Tokens</td>
        </tr>`
      : "";

  const roiBlock =
    !simpleNotify && estimatedJobPrice.min_price > 0 && roi > 0 && tokenCost > 0
      ? `
    <div style="background:#f4f4f5;padding:14px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#3f3f46;">
        <strong>ROI:</strong> Bei ${tokenCost} Token-Kosten und einem Auftragswert von CHF ${avgPrice}
        beträgt Ihre potenzielle Rendite bis zu <strong>${roi}x</strong>.
      </p>
    </div>`
      : "";

  const acceptBlock =
    !simpleNotify && acceptUrl && tokenCost > 0
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 10px auto;width:100%;max-width:100%;">
        <tr>
          <td style="background-color:#2d2d2d;border-radius:8px;text-align:center;">
            <a href="${acceptUrl}" style="display:block;color:#ffffff;text-decoration:none;padding:14px 20px;font-weight:600;font-size:15px;">
              Anfrage jetzt kaufen (${tokenCost} Tokens)
            </a>
          </td>
        </tr>
      </table>`
      : "";

  const expiryText = simpleNotify
    ? "Diese Anfrage läuft in 48 Stunden ab."
    : "Diese Anfrage läuft in 24 Stunden ab.";

  const inner = `
  <div style="${EMAIL_CARD_OUTER}">
    <div style="${EMAIL_HEADER_BAND}">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Neue ${serviceLabel}-Anfrage!</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#52525b;">${distanceText}</p>
    </div>
    <div style="${EMAIL_BODY_PADDING}">
      <p style="font-size:16px;margin-top:0;">Guten Tag ${companyName},</p>
      <p>Sie haben eine neue Anfrage für <strong>${serviceLabel}</strong> ${locationInfo} erhalten.</p>
      ${priceBlock}
      <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
        <h3 style="margin-top:0;color:#18181b;font-size:16px;">Anfrage-Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#52525b;">Service:</td>
            <td style="padding:8px 0;font-weight:500;">${serviceLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#52525b;">Von:</td>
            <td style="padding:8px 0;font-weight:500;">${lead.from_plz} ${lead.from_city}</td>
          </tr>
          ${
            lead.to_city
              ? `
          <tr>
            <td style="padding:8px 0;color:#52525b;">Nach:</td>
            <td style="padding:8px 0;font-weight:500;">${lead.to_plz} ${lead.to_city}</td>
          </tr>`
              : ""
          }
          ${
            lead.instrument_type
              ? `
          <tr>
            <td style="padding:8px 0;color:#52525b;">Instrument:</td>
            <td style="padding:8px 0;font-weight:500;">${lead.instrument_type}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:8px 0;color:#52525b;">Wunschtermin:</td>
            <td style="padding:8px 0;font-weight:500;">${preferredDateStr}</td>
          </tr>
          ${
            lead.from_rooms
              ? `
          <tr>
            <td style="padding:8px 0;color:#52525b;">Zimmer:</td>
            <td style="padding:8px 0;font-weight:500;">${lead.from_rooms}</td>
          </tr>`
              : ""
          }
          ${
            lead.from_living_space_m2
              ? `
          <tr>
            <td style="padding:8px 0;color:#52525b;">Wohnfläche:</td>
            <td style="padding:8px 0;font-weight:500;">${lead.from_living_space_m2} m²</td>
          </tr>`
              : ""
          }
          ${tokenRow}
        </table>
      </div>
      ${roiBlock}
      <div style="margin:24px 0;text-align:center;">
        ${acceptBlock}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:100%;">
          <tr>
            <td style="border:1px solid #a1a1aa;border-radius:8px;background:#ffffff;text-align:center;">
              <a href="${dashboardLink}" style="display:block;color:#18181b;text-decoration:none;padding:12px 18px;font-weight:600;font-size:14px;">
                Im Dashboard ansehen
              </a>
            </td>
          </tr>
        </table>
        <p style="color:#71717a;font-size:12px;margin:12px 0 0 0;">${expiryText}</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
    <p style="margin:0;">© ${year} ${getAppName()}</p>
  </div>`;

  return wrapEmailDocument(inner);
}


// ============================================================
// Customer Confirmation Email
// ============================================================

interface CustomerConfirmationEmailParams {
  customerFirstName: string;
  customerLastName: string;
  serviceLabel: string;
  locationInfo: string;
  matchedCompanies: number;
  lead: {
    slug?: string;
    service_type: string;
    from_plz: string;
    from_city: string;
    to_plz?: string;
    to_city?: string;
    preferred_date?: string;
    from_rooms?: number;
    from_living_space_m2?: number;
    packing_service_needed?: boolean;
    cleaning_service_needed?: boolean;
    storage_needed?: boolean;
    piano_type?: string;
    piano_weight_kg?: number;
    moebellift_floor?: number;
    detailed_form_data?: Record<string, unknown>;
  };
}

const FORM_FIELD_LABELS: Record<string, string> = {
  from_address: "Abholadresse",
  to_address: "Zieladresse",
  from_floor: "Stockwerk (von)",
  to_floor: "Stockwerk (nach)",
  from_elevator: "Lift vorhanden (von)",
  to_elevator: "Lift vorhanden (nach)",
  from_rooms: "Anzahl Zimmer",
  from_living_space_m2: "Wohnfläche",
  preferred_date: "Wunschtermin",
  preferred_time: "Bevorzugte Zeit",
  flexibility: "Flexibilität",
  packing_service: "Einpackservice",
  cleaning_service: "Endreinigung",
  storage_needed: "Lagerung benötigt",
  piano_type: "Instrument-Typ",
  piano_weight_kg: "Gewicht",
  moebellift_floor: "Stockwerk (Möbellift)",
  property_type: "Objekttyp",
  property_size: "Objektgrösse",
  cleaning_type: "Reinigungsart",
  room_count: "Anzahl Räume",
  bathroom_count: "Anzahl Badezimmer",
  kitchen_type: "Küchentyp",
  has_balcony: "Balkon/Terrasse",
  additional_info: "Zusätzliche Informationen",
  notes: "Anmerkungen",
  message: "Nachricht",
  items: "Transportgüter",
  special_items: "Spezielle Gegenstände",
  heavy_items: "Schwere Gegenstände",
  volume_m3: "Volumen",
  duration_months: "Lagerdauer",
  access_frequency: "Zugriffshäufigkeit",
  staircase_type: "Treppenhaus",
  staircase_turns: "Treppendrehungen",
};

function formatFormValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function buildCustomerConfirmationEmail(params: CustomerConfirmationEmailParams): string {
  const { customerFirstName, customerLastName, serviceLabel, locationInfo, matchedCompanies, lead } = params;
  const year = new Date().getFullYear();
  const preferredDateStr = lead.preferred_date
    ? new Date(lead.preferred_date).toLocaleDateString("de-CH")
    : null;

  // Build core details rows
  const coreRows: string[] = [];
  coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Service:</td><td style="padding:8px 0;font-weight:500;">${serviceLabel}</td></tr>`);
  if (lead.slug) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Anfrage-Nr.:</td><td style="padding:8px 0;font-weight:500;">${lead.slug}</td></tr>`);
  }
  coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Von:</td><td style="padding:8px 0;font-weight:500;">${lead.from_plz} ${lead.from_city}</td></tr>`);
  if (lead.to_city) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Nach:</td><td style="padding:8px 0;font-weight:500;">${lead.to_plz || ""} ${lead.to_city}</td></tr>`);
  }
  if (preferredDateStr) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Wunschtermin:</td><td style="padding:8px 0;font-weight:500;">${preferredDateStr}</td></tr>`);
  }
  if (lead.from_rooms) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Zimmer:</td><td style="padding:8px 0;font-weight:500;">${lead.from_rooms}</td></tr>`);
  }
  if (lead.from_living_space_m2) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Wohnfläche:</td><td style="padding:8px 0;font-weight:500;">${lead.from_living_space_m2} m²</td></tr>`);
  }
  if (lead.piano_type) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Instrument:</td><td style="padding:8px 0;font-weight:500;">${lead.piano_type}${lead.piano_weight_kg ? ` (${lead.piano_weight_kg} kg)` : ""}</td></tr>`);
  }
  if (lead.moebellift_floor) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Stockwerk:</td><td style="padding:8px 0;font-weight:500;">${lead.moebellift_floor}. OG</td></tr>`);
  }

  const booleanServices: string[] = [];
  if (lead.packing_service_needed) booleanServices.push("Einpackservice");
  if (lead.cleaning_service_needed) booleanServices.push("Endreinigung");
  if (lead.storage_needed) booleanServices.push("Lagerung");
  if (booleanServices.length > 0) {
    coreRows.push(`<tr><td style="padding:8px 0;color:#6b7280;">Zusatzleistungen:</td><td style="padding:8px 0;font-weight:500;">${booleanServices.join(", ")}</td></tr>`);
  }

  // Build detailed form data rows (from the JSON field)
  const detailRows: string[] = [];
  const skipKeys = new Set([
    "firstName", "lastName", "email", "phone", "serviceType",
    "fromPlz", "fromCity", "toPlz", "toCity", "fromAddress", "toAddress",
    "maxCompanies", "recaptchaToken", "lang",
  ]);

  if (lead.detailed_form_data && typeof lead.detailed_form_data === "object") {
    for (const [key, value] of Object.entries(lead.detailed_form_data)) {
      if (skipKeys.has(key)) continue;
      const formatted = formatFormValue(key, value);
      if (!formatted) continue;

      const label = FORM_FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim();
      detailRows.push(`<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">${label}:</td><td style="padding:6px 0;font-size:13px;">${formatted}</td></tr>`);
    }
  }

  const detailSection = detailRows.length > 0
    ? `
    <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
      <h3 style="margin-top:0;color:#18181b;font-size:15px;">Weitere Details Ihrer Anfrage</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRows.join("")}
      </table>
    </div>`
    : "";

  const inner = `
  <div style="${EMAIL_CARD_OUTER}">
    <div style="${EMAIL_HEADER_BAND};text-align:left;">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Ihre Anfrage wurde weitergeleitet</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#52525b;">
        ${matchedCompanies} qualifizierte Firma${matchedCompanies === 1 ? "" : "en"} ${matchedCompanies === 1 ? "wurde" : "wurden"} benachrichtigt
      </p>
    </div>
    <div style="${EMAIL_BODY_PADDING}">
      <p style="font-size:16px;margin-top:0;">Guten Tag ${customerFirstName} ${customerLastName},</p>
      <p>
        Vielen Dank für Ihre Anfrage! Ihre <strong>${serviceLabel}</strong>-Anfrage ${locationInfo} wurde an <strong>${matchedCompanies}</strong> passende Unternehmen in Ihrer Nähe weitergeleitet.
      </p>
      <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
        <h3 style="margin-top:0;color:#18181b;font-size:15px;">Zusammenfassung Ihrer Anfrage</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${coreRows.join("")}
        </table>
      </div>
      ${detailSection}
      <div style="background:#ffffff;padding:16px;border-radius:6px;border:1px solid #d4d4d8;margin:16px 0;">
        <h3 style="margin-top:0;color:#18181b;font-size:15px;">Was passiert als Nächstes?</h3>
        <ul style="padding-left:20px;margin-bottom:0;">
          <li style="margin-bottom:8px;">Die Firmen melden sich bei Ihnen</li>
          <li style="margin-bottom:8px;">Sie erhalten unverbindliche Offerten per E-Mail oder Telefon</li>
          <li>Sie wählen frei das passende Angebot</li>
        </ul>
      </div>
      <p style="color:#52525b;font-size:14px;">
        Bitte prüfen Sie die Angaben. Bei Fragen kontaktieren Sie uns gerne.
      </p>
      <p style="margin-bottom:0;">
        Freundliche Grüsse,<br>
        <strong>Ihr ${getAppName()} Team</strong>
      </p>
    </div>
  </div>
  <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
    <p style="margin:0;">© ${year} ${getAppName()}</p>
    ${getSiteUrl() ? `<p style="margin:6px 0 0 0;"><a href="${getSiteUrl()}" style="color:#3f3f46;text-decoration:underline;">${getSiteUrl()}</a></p>` : ""}
  </div>`;

  return wrapEmailDocument(inner);
}


// ============================================================
// Admin Distribution Summary Email
// ============================================================

interface AdminSummaryEmailParams {
  serviceLabel: string;
  locationInfo: string;
  lead: {
    id: string;
    slug?: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
    from_plz: string;
    from_city: string;
    to_plz?: string;
    to_city?: string;
  };
  tokenCost: number;
  emailsSent: number;
  selectedCompaniesCount: number;
  companies: Array<{
    company_name: string;
    distance_km: number;
    notification_email: string | null;
    email: string;
  }>;
}

/**
 * Build HTML email for admin distribution summary.
 */
export function buildAdminDistributionSummaryEmail(params: AdminSummaryEmailParams): string {
  const { serviceLabel, locationInfo, lead, tokenCost, emailsSent, selectedCompaniesCount, companies } = params;
  const year = new Date().getFullYear();

  const companiesList = companies.map((c, i) =>
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.company_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.distance_km === 0 ? 'PLZ-Treffer' : c.distance_km?.toFixed(1) + ' km'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.notification_email || c.email}</td>
    </tr>`
  ).join('');

  const inner = `
  <div style="${EMAIL_CARD_OUTER}">
    <div style="${EMAIL_HEADER_BAND}">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Lead verteilt</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#52525b;">${serviceLabel} ${locationInfo}</p>
    </div>
    <div style="${EMAIL_BODY_PADDING}">
      <h3 style="margin-top:0;color:#18181b;font-size:16px;">Lead-Details</h3>
      <table style="width:100%;margin-bottom:16px;">
        <tr><td style="padding:6px 0;color:#52525b;">Referenz:</td><td style="font-weight:500;">${lead.slug || lead.id.substring(0, 8)}</td></tr>
        <tr><td style="padding:6px 0;color:#52525b;">Kunde:</td><td style="font-weight:500;">${lead.customer_first_name} ${lead.customer_last_name}</td></tr>
        <tr><td style="padding:6px 0;color:#52525b;">E-Mail:</td><td style="font-weight:500;">${lead.customer_email}</td></tr>
        <tr><td style="padding:6px 0;color:#52525b;">Telefon:</td><td style="font-weight:500;">${lead.customer_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#52525b;">Von:</td><td style="font-weight:500;">${lead.from_plz} ${lead.from_city}</td></tr>
        ${lead.to_city ? `<tr><td style="padding:6px 0;color:#52525b;">Nach:</td><td style="font-weight:500;">${lead.to_plz} ${lead.to_city}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#52525b;">Token-Kosten:</td><td style="font-weight:600;color:#18181b;">${tokenCost} Tokens</td></tr>
      </table>

      <h3 style="color:#18181b;font-size:16px;">Verteilt an ${selectedCompaniesCount} Firma(en)</h3>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #d4d4d8;border-radius:6px;">
        <thead>
          <tr style="background:#ececee;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#52525b;">#</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#52525b;">Firma</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#52525b;">Distanz</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#52525b;">E-Mail</th>
          </tr>
        </thead>
        <tbody>
          ${companiesList}
        </tbody>
      </table>

      <div style="margin-top:16px;padding:12px;background:#f4f4f5;border-radius:6px;border:1px solid #d4d4d8;text-align:center;">
        <p style="margin:0;color:#3f3f46;font-size:14px;">${emailsSent} E-Mail(s) an Firmen gesendet.</p>
      </div>

      <p style="text-align:center;margin-top:18px;">
        <a href="${getDashboardAppBaseUrl()}/admin/leads" style="display:inline-block;background:#2d2d2d;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:600;">
          Im Admin-Panel ansehen
        </a>
      </p>
    </div>
  </div>
  <div style="text-align:center;padding:14px 0 0;font-size:12px;color:#71717a;">
    © ${year} ${getAppName()}
  </div>`;

  return wrapEmailDocument(inner);
}
