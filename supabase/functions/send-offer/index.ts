import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logEmail } from "../_shared/logEmail.ts";
import { getDefaultFrom, getDashAppUrl, getAppName } from "../_shared/envConfig.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
// jsPDF and QRCode removed - ALL PDFs are now generated on the frontend
// using @react-pdf/renderer and passed to this edge function as base64.
// This keeps the edge function lightweight and ensures identical PDFs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BUG-8: PII maskeleme yardımcıları — loglar DSG/DSGVO uyumlu
const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");

/** Escape user-supplied strings before interpolating into HTML email templates. */
const escapeHtml = (s: string | null | undefined): string => {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

interface SendOfferRequest {
  offerId: string;
  /** Pre-generated offer PDF as base64 (from frontend @react-pdf/renderer). */
  offerPdfBase64?: string;
  /** Pre-generated checklist PDF as base64 (from frontend). */
  checklistPdfBase64?: string;
  /** Pre-generated AGB PDF as base64 (from frontend). */
  agbPdfBase64?: string;
  /** If true, allows resending an already-sent offer. */
  force_resend?: boolean;
}

interface ChecklistSection {
  id: string;
  timeline: string;
  items: string[];
  order: number;
}

interface CompanyInfo {
  id: string;
  company_name: string;
  email: string;
  phone?: string | null;
  street?: string | null;
  house_number?: string | null;
  plz: string;
  city: string;
  website?: string | null;
  logo_url?: string | null;
  mwst_number?: string | null;
  iban?: string | null;
  primary_color?: string | null;
  signature_url?: string | null;
  default_payment_terms?: string | null;
  default_terms_and_conditions?: string | null;
  resend_enabled?: boolean | null;
  resend_api_key?: string | null;
  resend_from_email?: string | null;
  resend_from_name?: string | null;
}

// OfferItem interface kept for email HTML building
interface OfferItem {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total?: number;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
}

interface LeistungItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface LeistungsuebersichtData {
  included_services: LeistungItem[];
  excluded_services: string[];
  special_notes?: string | null;
}

interface AgbSection {
  id: string;
  title: string;
  content: string;
  display_order: number;
}

interface OfferData {
  id: string;
  title: string;
  description?: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone?: string | null;
  service_date?: string | null;
  valid_until?: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  created_at: string;
  paymentTerms?: string | null;
  termsAndConditions?: string | null;
  access_token?: string;
  leistungsuebersicht?: LeistungsuebersichtData | null;
  agbSections?: AgbSection[];
  service_type?: string | null;
  customer_address?: LegacyAddress;
  customer_destination?: LegacyAddress;
  price_model?: 'pauschal' | 'stundenansatz' | 'kostendach' | null;
  hourly_rate?: number | null;
  kostendach_max?: number | null;
  offerte_type?: 'normal' | 'blind' | null;
}

// formatServiceTypeTitle removed - was only used by server-side PDF generator

interface ChecklistTemplate {
  id: string;
  title: string;
  subtitle?: string | null;
  sections: ChecklistSection[];
}

interface LegacyAddress {
  street?: string | null;
  house_number?: string | null;
  plz?: string | null;
  city?: string | null;
  floor?: number | null;
  has_lift?: boolean | null;
  rooms?: number | null;
}

interface LeadInfo {
  service_type?: string | null;
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_rooms?: number | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
  to_rooms?: number | null;
}
const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[SEND-OFFER] ${step}`, details ? JSON.stringify(details) : "");
};

// NOTE: All PDF-related utility functions (formatCurrency, formatDatePdf, hexToRgb,
// PDF_COLORS, lightenHex, mapServiceType, buildAddressFromLead, renderAddressLines,
// loadImageAsBase64, addLogoWithWhiteBackground, generateOfferPdfBase64,
// generateChecklistPdfBase64, generateAgbPdfBase64) have been removed.
// PDFs are now generated on the frontend using @react-pdf/renderer
// and passed to this edge function as base64 strings.

// NOTE: The server-side offer PDF generation has been removed.
// The offer PDF is now generated on the frontend using @react-pdf/renderer
// and passed to this edge function as `offerPdfBase64`.
// This eliminates the QRCode dependency and ~860 lines of jsPDF code,
// reducing the bundle size and ensuring email PDF = download PDF.


// Generate Checklist PDF as base64

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const systemResendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify the requesting user is authorized
    const authHeader = req.headers.get("Authorization");
    logStep("Auth header check", { hasAuthHeader: !!authHeader });
    
    if (!authHeader) {
      logStep("No authorization header found");
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { tokenLength: token.length });
    
    // Validate user token using service role key
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Auth validation failed", { error: authError?.message, code: authError?.code });
      return new Response(
        JSON.stringify({ error: "Token validation failed", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logStep("User authenticated", { userId: user.id, email: maskEmail(user.email ?? "") });

    const {
      offerId,
      offerPdfBase64: preGeneratedOfferPdf,
      checklistPdfBase64: preGeneratedChecklistPdf,
      agbPdfBase64: preGeneratedAgbPdf,
      force_resend: forceResendFromBody = false,
    }: SendOfferRequest = await req.json();
    logStep("Processing offer", {
      offerId,
      userId: user.id,
      hasPreGeneratedOfferPdf: !!preGeneratedOfferPdf,
      hasPreGeneratedChecklistPdf: !!preGeneratedChecklistPdf,
      hasPreGeneratedAgbPdf: !!preGeneratedAgbPdf,
      force_resend: forceResendFromBody,
    });

    // Get offer with company and lead info
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select(`
        *,
        company:companies(id, company_name, email, phone, street, house_number, plz, city, website, logo_url, mwst_number, iban, primary_color, signature_url, default_payment_terms, default_terms_and_conditions, resend_enabled, resend_api_key, resend_from_email, resend_from_name),
        lead:leads(
          service_type,
          from_street,
          from_house_number,
          from_plz,
          from_city,
          from_floor,
          from_has_lift,
          from_rooms,
          to_street,
          to_house_number,
          to_plz,
          to_city,
          to_floor,
          to_has_lift,
          to_rooms
        )
      `)
      .eq("id", offerId)
      .single();

    if (offerError || !offer) {
      logStep("Offer not found", { error: offerError });
      return new Response(
        JSON.stringify({ error: "Offerte nicht gefunden" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Check if the authenticated user is a member of the offer's company
    const offerCompanyId = (offer.company as unknown as { id?: string } | null)?.id;
    if (offerCompanyId) {
      const isMember = await verifyCompanyMembership(supabase, user.id, offerCompanyId);
      if (!isMember) {
        logStep("Unauthorized access attempt — not a company member", { userId: user.id, companyId: offerCompanyId });
        return new Response(
          JSON.stringify({ error: "Sie haben keine Berechtigung für diese Offerte" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Terminal statüdeki teklifler gönderilemez — status regression engellemek için
    const TERMINAL_STATUSES = ["accepted", "rejected"];
    if (TERMINAL_STATUSES.includes(offer.status)) {
      logStep("Cannot resend — offer is in terminal status", { offerId, status: offer.status });
      return new Response(
        JSON.stringify({ error: `Diese Offerte kann nicht erneut gesendet werden (Status: ${offer.status}).` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Çift gönderim koruması — offer zaten "sent" veya "viewed" ise force_resend gerek
    if (["sent", "viewed"].includes(offer.status) && !forceResendFromBody) {
      logStep("Offer already sent/viewed, skipping duplicate", { offerId, status: offer.status });
      return new Response(
        JSON.stringify({ error: "Diese Offerte wurde bereits gesendet. Verwenden Sie force_resend: true um erneut zu senden." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get offer items
    const { data: items } = await supabase
      .from("offer_items")
      .select("*")
      .eq("offer_id", offerId)
      .order("position", { ascending: true });

    // Get Leistungsübersicht
    const { data: leistungsuebersicht } = await supabase
      .from("offer_leistungsuebersicht")
      .select("*")
      .eq("offer_id", offerId)
      .maybeSingle();

    logStep("Offer data fetched", { 
      customerEmail: offer.customer_email,
      companyName: offer.company?.company_name,
      serviceType: offer.lead?.service_type,
      itemCount: items?.length || 0,
      hasLeistungsuebersicht: !!leistungsuebersicht
    });

    // Build Leistungsübersicht HTML for email
    let leistungsuebersichtHtml = "";
    if (leistungsuebersicht) {
      const includedServices = Array.isArray(leistungsuebersicht.included_services)
        ? leistungsuebersicht.included_services
        : [];
      const excludedServices = Array.isArray(leistungsuebersicht.excluded_services)
        ? leistungsuebersicht.excluded_services
        : [];

      if (includedServices.length > 0 || excludedServices.length > 0) {
        const includedHtml = includedServices.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #059669; font-size: 16px; margin-bottom: 12px;">
              ✓ Inkludierte Leistungen
            </h3>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${includedServices.map((service: { name: string; description?: string }) => `
                <li style="margin-bottom: 10px; padding: 10px 12px; background-color: #ecfdf5; border-radius: 6px; border-left: 3px solid #10b981;">
                  <strong style="color: #1f2937;">${service.name}</strong>
                  ${service.description ? `<br><span style="color: #6b7280; font-size: 13px;">${service.description}</span>` : ""}
                </li>
              `).join("")}
            </ul>
          </div>
        ` : "";

        const excludedHtml = excludedServices.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #dc2626; font-size: 16px; margin-bottom: 12px;">
              ✗ Nicht inkludierte Leistungen
            </h3>
            <ul style="margin: 0; padding-left: 0; list-style: none;">
              ${excludedServices.map((service: string) => `
                <li style="margin-bottom: 8px; padding: 8px 12px; background-color: #fef2f2; border-radius: 6px; border-left: 3px solid #ef4444; color: #991b1b;">
                  ${service}
                </li>
              `).join("")}
            </ul>
          </div>
        ` : "";

        // Leistungsübersicht im Email entfernt - alle Infos sind in der Offerte PDF
        leistungsuebersichtHtml = "";

        logStep("Leistungsübersicht skipped in email - included in positions");
      }
    }

    // Checklist PDF - now generated on frontend and passed as base64
    let checklistPdfBase64: string | null = preGeneratedChecklistPdf || null;
    let checklistFileName: string | null = null;
    
    if (checklistPdfBase64) {
      checklistFileName = `Checkliste.pdf`;
      logStep("Using pre-generated checklist PDF from frontend", { fileName: checklistFileName });
    } else {
      logStep("No checklist PDF provided from frontend");
    }

    // NOTE: Logo/signature loading removed - PDFs are generated on frontend

    // Get company offer template for payment terms and T&C
    let paymentTerms: string | null = (offer as Record<string, unknown>).payment_terms as string | null ?? null;
    let termsAndConditions = offer.company?.default_terms_and_conditions || null;
    
    // Fall back to template / company default when the offer has no explicit payment_terms
    if (!paymentTerms) {
      paymentTerms = offer.company?.default_payment_terms || null;
      if (offer.company?.id && offer.lead?.service_type) {
        const { data: offerTemplate } = await supabase
          .from("company_offer_templates")
          .select("payment_terms, terms_and_conditions")
          .eq("company_id", offer.company.id)
          .eq("service_type", offer.lead.service_type)
          .maybeSingle();
        
        if (offerTemplate) {
          paymentTerms = offerTemplate.payment_terms || paymentTerms;
          termsAndConditions = offerTemplate.terms_and_conditions || termsAndConditions;
          logStep("Offer template loaded", { hasPaymentTerms: !!paymentTerms, hasTerms: !!termsAndConditions });
        }
      }
    } else {
      // Offer has explicit payment_terms — still load T&C from template if available
      if (offer.company?.id && offer.lead?.service_type) {
        const { data: offerTemplate } = await supabase
          .from("company_offer_templates")
          .select("terms_and_conditions")
          .eq("company_id", offer.company.id)
          .eq("service_type", offer.lead.service_type)
          .maybeSingle();
        if (offerTemplate?.terms_and_conditions) {
          termsAndConditions = offerTemplate.terms_and_conditions;
        }
      }
      if (!termsAndConditions) {
        termsAndConditions = offer.company?.default_terms_and_conditions || null;
      }
    }

    // Helper function to normalize service type for AGB lookup.
    // Returns an array so we can search for both the exact type and its base category.
    // raeumung and entsorgung are intentionally separate — NOT merged.
    const normalizeServiceTypeForAgb = (serviceType: string): string[] => {
      const baseServiceTypes: string[] = [serviceType];

      const serviceTypeMap: Record<string, string> = {
        'umzug_privat': 'umzug',
        'umzug_firma': 'umzug',
        'umzug_buero': 'umzug',
        'umzug_international': 'umzug',
        'privatumzug': 'umzug',
        'firmenumzug': 'umzug',
        'endreinigung': 'reinigung',
        'grundreinigung': 'reinigung',
        'umzugsreinigung': 'reinigung',
        'reinigung_umzug': 'reinigung',
        'reinigung_bau': 'reinigung',
        'reinigung_buero': 'reinigung',
        'raeumung_wohnung': 'raeumung',
        'raeumung_keller': 'raeumung',
        'raeumung_haus': 'raeumung',
        'entrümpelung': 'raeumung',
        'entsorgung_moebel': 'entsorgung',
        'entsorgung_sperrgut': 'entsorgung',
        'moebel_transport': 'transport',
        'usm_transport': 'transport',
        'wasserbett_transport': 'transport',
      };

      if (serviceTypeMap[serviceType]) {
        baseServiceTypes.push(serviceTypeMap[serviceType]);
      }

      return baseServiceTypes;
    };

    // Fetch AGB sections for this service type
    let agbSections: AgbSection[] = [];
    if (offer.company?.id && offer.lead?.service_type) {
      const serviceTypes = normalizeServiceTypeForAgb(offer.lead.service_type);
      logStep("Looking for AGB sections", { originalType: offer.lead.service_type, searchTypes: serviceTypes });
      
      const { data: agbData } = await supabase
        .from("agb_sections")
        .select("id, title, content, display_order")
        .eq("company_id", offer.company.id)
        .in("service_type", serviceTypes)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (agbData && agbData.length > 0) {
        agbSections = agbData;
        logStep("AGB sections loaded", { count: agbSections.length, serviceTypes });
      } else {
        logStep("No AGB sections found for service types", { searchTypes: serviceTypes });
      }
    }

    // Build Leistungsübersicht data for PDF
    let leistungsuebersichtData: LeistungsuebersichtData | null = null;
    if (leistungsuebersicht) {
      const includedServices = Array.isArray(leistungsuebersicht.included_services)
        ? leistungsuebersicht.included_services as LeistungItem[]
        : [];
      const excludedServices = Array.isArray(leistungsuebersicht.excluded_services)
        ? leistungsuebersicht.excluded_services as string[]
        : [];
      
      if (includedServices.length > 0 || excludedServices.length > 0) {
        leistungsuebersichtData = {
          included_services: includedServices,
          excluded_services: excludedServices,
          special_notes: leistungsuebersicht.special_notes,
        };
      }
    }

    // AGB PDF - now generated on frontend and passed as base64
    let agbPdfBase64: string | null = preGeneratedAgbPdf || null;
    const agbFileName = "AGB.pdf";
    
    if (agbPdfBase64) {
      logStep("Using pre-generated AGB PDF from frontend", { fileName: agbFileName });
    } else if (agbSections.length > 0) {
      logStep("AGB sections exist but no pre-generated PDF provided from frontend");
    }

    // Generate Offer PDF
    let offerPdfBase64: string | null = null;
    const offerFileName = `Offerte_${offer.id.slice(0, 8).toUpperCase()}_${offer.customer_last_name}.pdf`;

    // If a pre-generated PDF was sent from the frontend, use it directly
    // This ensures the email PDF is 100% identical to the download PDF
    if (preGeneratedOfferPdf) {
      offerPdfBase64 = preGeneratedOfferPdf;
      logStep("Using pre-generated offer PDF from frontend", { fileName: offerFileName, pdfLength: preGeneratedOfferPdf.length });
    } else {
      logStep("WARNING: No pre-generated PDF provided. Email sent without offer PDF attachment.", { fileName: offerFileName });
    }

    // Generate offer view URL
    const offerViewUrl = `${getDashAppUrl()}/offerte/${offer.access_token}`;

    // Build items HTML (mobile-safe stacked layout)
    const fmtCHF = (n: number) => 'CHF ' + n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const itemsHtml = items?.map(item => {
      const te = item.time_estimate;
      const hasTE = te && te.minHours > 0 && te.hourlyRate > 0;
      const minTotal = hasTE ? te!.minHours * te!.hourlyRate : item.quantity * item.unit_price;
      const maxTotal = hasTE ? te!.maxHours * te!.hourlyRate : null;
      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">Pos.</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${item.position}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 6px 0 4px 0; color: #111827; font-size: 14px; word-break: break-word; line-height: 1.5;">${item.description}</td>
            </tr>
            ${hasTE ? `
            <tr>
              <td colspan="2" style="padding: 2px 0; color: #b45309; font-size: 12px;">
                ${te!.minHours} &ndash; ${te!.maxHours} Std. &times; ${fmtCHF(te!.hourlyRate)} / Std.
              </td>
            </tr>` : `
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">Menge</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; text-align: right;">${item.quantity} ${item.unit || "Stk."}</td>
            </tr>
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">Preis</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; text-align: right;">${fmtCHF(Number(item.unit_price))}</td>
            </tr>`}
            <tr>
              <td style="padding: 6px 0 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap; font-weight: 600;">Total</td>
              <td style="padding: 6px 0 2px 0; font-size: 15px; font-weight: 700; text-align: right; ${hasTE ? 'color: #b45309;' : 'color: #111827;'}">
                ${maxTotal !== null ? `${fmtCHF(minTotal)} &ndash; ${fmtCHF(maxTotal)}` : fmtCHF(minTotal)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }).join("") || "";

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "-";
      return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Note about PDF attachments in email
    const attachmentNotes: string[] = [];
    if (offerPdfBase64) {
      attachmentNotes.push("die Offerte als PDF");
    }
    if (agbPdfBase64) {
      attachmentNotes.push("unsere AGB");
    }
    if (checklistPdfBase64) {
      attachmentNotes.push("eine hilfreiche Checkliste zur Vorbereitung");
    }
    
    const pdfAttachmentNote = attachmentNotes.length > 0 ? `
      <div style="margin-top: 20px; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          📎 <strong>Anhänge:</strong> Im Anhang dieser E-Mail finden Sie ${attachmentNotes.join(" und ")}.
        </p>
      </div>
    ` : "";

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ihre Offerte von ${escapeHtml(offer.company?.company_name)}</title>
      <style>
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-spacing: 0; border-collapse: collapse; }
        img { max-width: 100%; height: auto; }
        * { box-sizing: border-box; }
        a { word-break: break-word; }
        .container { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; }
        .header { padding: 24px 20px !important; }
        .content { padding: 24px 20px !important; }
        .footer { padding: 20px !important; }
        .cta { display: inline-block; }
        @media only screen and (max-width: 640px) {
          .container { width: 100% !important; max-width: 100% !important; }
          .header { padding: 20px 16px !important; }
          .content { padding: 20px 14px !important; }
          .footer { padding: 16px !important; }
          .cta { display: block !important; width: 100% !important; text-align: center !important; }
          .mobile-break { word-break: break-word !important; overflow-wrap: anywhere !important; }
        }
      </style>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f5f7;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #f4f5f7;">
        <tr>
          <td align="center" style="padding: 16px 14px;">
      <div class="container" style="width: 100%; max-width: 100%; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div class="header" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 24px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Ihre Offerte</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">von ${escapeHtml(offer.company?.company_name)}</p>
        </div>

        <!-- Content -->
        <div class="content" style="padding: 24px 20px;">
          <p style="font-size: 16px; color: #1f2937; margin-bottom: 24px;">
            Guten Tag ${escapeHtml(offer.customer_first_name)} ${escapeHtml(offer.customer_last_name)},
          </p>
          
          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            vielen Dank für Ihre Anfrage. Anbei erhalten Sie unsere Offerte für die gewünschten Leistungen.
          </p>
          
          ${pdfAttachmentNote}
          
          <!-- Offer Summary Card -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">${escapeHtml(offer.title)}</h2>
            ${offer.description ? `<p style="color: #6b7280; margin: 0 0 16px 0;">${escapeHtml(offer.description)}</p>` : ""}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 50%;">Ausführungsdatum:</td>
                <td style="padding: 6px 0; color: #1f2937; font-weight: 700; text-align: right;">${formatDate(offer.service_date)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 50%;">Gültig bis:</td>
                <td style="padding: 6px 0; color: #1f2937; font-weight: 700; text-align: right;">${formatDate(offer.valid_until)}</td>
              </tr>
            </table>
          </div>
          
          <!-- Items Table -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; margin: 24px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <thead>
              <tr>
                <th style="padding: 12px 14px; text-align: left; background-color: #6366f1; color: #ffffff; font-size: 14px;">Leistungspositionen</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <!-- Totals -->
          ${(() => {
            const hasItemTE = items?.some(i => i.time_estimate && i.time_estimate.maxHours > 0 && i.time_estimate.hourlyRate > 0);
            if (!hasItemTE) {
              // Zuschläge: offer.subtotal = steuerbare Basis (Positionen + Zuschläge).
              const surchargeArr = Array.isArray(offer.surcharges) ? offer.surcharges : [];
              const surchargesSum = surchargeArr.reduce((sum, x) => sum + (Number(x?.amount) || 0), 0);
              const itemsSub = Number(offer.subtotal) - surchargesSum;
              const surchargeRows = surchargeArr.map((x) => `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${x?.label || "Zuschlag"}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(x?.amount) || 0)}</span>
            </div>`).join("");
              return `
          <div style="text-align: right; margin: 24px 0;">
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">Zwischensumme:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(itemsSub)}</span>
            </div>${surchargeRows}
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">MwSt. (${offer.vat_rate}%):</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(offer.vat_amount || 0))}</span>
            </div>
            <div style="font-size: 20px; font-weight: bold; color: #1f2937; border-top: 2px solid #e5e7eb; padding-top: 12px;">
              <span>Total:</span>
              <span style="margin-left: 24px;">${fmtCHF(Number(offer.total || (Number(offer.subtotal) + Number(offer.vat_amount || 0))))}</span>
            </div>
          </div>`;
            }
            // Per-item time estimates — compute range totals
            const minSub = (items || []).reduce((sum, item) => {
              const te = item.time_estimate;
              if (te && te.minHours > 0 && te.hourlyRate > 0) return sum + te.minHours * te.hourlyRate;
              return sum + item.quantity * item.unit_price;
            }, 0);
            const maxSub = (items || []).reduce((sum, item) => {
              const te = item.time_estimate;
              if (te && te.maxHours > 0 && te.hourlyRate > 0) return sum + te.maxHours * te.hourlyRate;
              return sum + item.quantity * item.unit_price;
            }, 0);
            // Zuschläge: Zwischensumme-Range bleibt Positionen; Zuschläge fix dazwischen, MwSt auf (Sub + Zuschläge).
            const rangeSurcharges = Array.isArray(offer.surcharges) ? offer.surcharges : [];
            const rangeSurchargesSum = rangeSurcharges.reduce((sum, x) => sum + (Number(x?.amount) || 0), 0);
            const rangeSurchargeRows = rangeSurcharges.map((x) => `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${x?.label || 'Zuschlag'}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(x?.amount) || 0)}</span>
            </div>`).join("");
            const minVat = (minSub + rangeSurchargesSum) * (Number(offer.vat_rate) / 100);
            const maxVat = (maxSub + rangeSurchargesSum) * (Number(offer.vat_rate) / 100);
            const minTotal = minSub + rangeSurchargesSum + minVat;
            const maxTotal = maxSub + rangeSurchargesSum + maxVat;
            return `
          ${offer.offerte_type === 'blind' ? `
          <div style="margin: 0 0 20px 0; padding: 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #b45309;">
              Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung.
              Preise sind Schätzungen und können nach Besichtigung angepasst werden.
            </p>
          </div>` : ''}
          <!-- Totals range -->
          <div style="text-align: right; margin: 24px 0;">
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">Zwischensumme:</span>
              <span style="margin-left: 24px; color: #b45309; font-weight: 600;">${fmtCHF(minSub)} &ndash; ${fmtCHF(maxSub)}</span>
            </div>${rangeSurchargeRows}
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">MwSt. (${offer.vat_rate}%):</span>
              <span style="margin-left: 24px; color: #b45309;">${fmtCHF(minVat)} &ndash; ${fmtCHF(maxVat)}</span>
            </div>
            <div style="font-size: 20px; font-weight: bold; color: #92400e; border-top: 2px solid #fde68a; padding-top: 12px;">
              <span>Total:</span>
              <span style="margin-left: 24px;">${fmtCHF(minTotal)} &ndash; ${fmtCHF(maxTotal)}</span>
            </div>
          </div>`;
          })()}

          ${offer.price_model === 'stundenansatz' && offer.hourly_rate != null ? `
          <!-- Preismodell: Stundenansatz -->
          <div style="margin: 0 0 24px 0; padding: 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #1e40af; font-size: 14px;">
              Preismodell: Stundenansatz
            </p>
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #1e3a8a; font-weight: 700;">
              CHF ${Number(offer.hourly_rate).toLocaleString('de-CH')} / Std.
            </p>
            <p style="margin: 0; font-size: 13px; color: #3b82f6;">
              Die Abrechnung erfolgt nach effektivem Zeitaufwand zum angegebenen Stundenansatz. Der Endpreis ergibt sich aus den tatsächlich geleisteten Stunden.
            </p>
          </div>
          ` : ''}

          ${offer.price_model === 'kostendach' && offer.hourly_rate != null && offer.kostendach_max != null ? `
          <!-- Preismodell: Kostendach -->
          <div style="margin: 0 0 24px 0; padding: 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #92400e; font-size: 14px;">
              Preismodell: Stundenansatz mit Kostendach
            </p>
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #92400e; font-weight: 700;">
              CHF ${Number(offer.hourly_rate).toLocaleString('de-CH')} / Std. &nbsp;|&nbsp; Kostendach: max. CHF ${Number(offer.kostendach_max).toLocaleString('de-CH')}
            </p>
            <p style="margin: 0; font-size: 13px; color: #d97706;">
              Sie zahlen maximal CHF ${Number(offer.kostendach_max).toLocaleString('de-CH')}, unabhängig vom tatsächlichen Zeitaufwand.
            </p>
          </div>
          ` : ''}
          
          ${paymentTerms ? `
          <!-- Zahlungskondition -->
          <div style="margin: 0 0 24px 0; padding: 14px 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e; display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-weight: 700; color: #166534; font-size: 14px; white-space: nowrap;">Zahlungskondition:</span>
            <span style="color: #166534; font-size: 14px;">${paymentTerms}</span>
          </div>
          ` : ''}

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${offerViewUrl}" class="cta" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Offerte ansehen & beantworten
            </a>
          </div>

          <p class="mobile-break" style="color: #6b7280; font-size: 14px; text-align: center; word-break: break-all;">
            oder kopieren Sie diesen Link: <a href="${offerViewUrl}" style="color: #6366f1;">${offerViewUrl}</a>
          </p>
          
          <!-- Leistungsübersicht Section (if available) -->
          ${leistungsuebersichtHtml}
        </div>
        
        <!-- Footer -->
        <div class="footer" style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #1f2937; font-weight: 600; margin: 0 0 8px 0;">${offer.company?.company_name}</p>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">
            ${offer.company?.street ? `${offer.company.street} ${offer.company.house_number || ""}, ` : ""}${offer.company?.plz} ${offer.company?.city}<br>
            ${offer.company?.phone ? `Tel: ${offer.company.phone} | ` : ""}${offer.company?.email}
          </p>
        </div>
      </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    // Build email attachments
    const attachments: { filename: string; content: string }[] = [];
    
    if (offerPdfBase64) {
      attachments.push({
        filename: offerFileName,
        content: offerPdfBase64,
      });
    }
    
    // Add AGB as separate PDF attachment
    if (agbPdfBase64) {
      attachments.push({
        filename: agbFileName,
        content: agbPdfBase64,
      });
    }
    
    if (checklistPdfBase64 && checklistFileName) {
      attachments.push({
        filename: checklistFileName,
        content: checklistPdfBase64,
      });
    }

    // Determine which Resend API to use - company's own or system default
    const companyInfo = offer.company as CompanyInfo | null;
    let resendApiKey = systemResendApiKey;
    let fromAddress = getDefaultFrom();
    let fromEmail = fromAddress.match(/<(.+)>/)?.[1] ?? fromAddress;
    let isCompanyEmail = false;

    if (companyInfo?.resend_enabled && companyInfo?.resend_api_key && companyInfo?.resend_from_email) {
      resendApiKey = companyInfo.resend_api_key;
      const fromName = companyInfo.resend_from_name || companyInfo.company_name;
      fromAddress = `${fromName} <${companyInfo.resend_from_email}>`;
      fromEmail = companyInfo.resend_from_email;
      isCompanyEmail = true;
      logStep("Using company's own Resend API", { fromAddress });
    } else {
      logStep("Using system Resend API", { fromAddress });
    }

    if (!resendApiKey) {
      logStep("No Resend API key available - skipping email send");
      return new Response(
        JSON.stringify({ error: "E-Mail-Dienst nicht konfiguriert. Bitte richten Sie Resend in den Einstellungen ein." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Send email with optional attachments
    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string }[];
    } = {
      from: fromAddress,
      to: [offer.customer_email],
      subject: `Ihre Offerte von ${offer.company?.company_name} – Nr. ${offer.id.slice(0, 8).toUpperCase()}`,
      html: emailHtml,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const { error: emailError } = await resend.emails.send(emailPayload);

    if (emailError) {
      logStep("Email send failed", { error: emailError, statusCode: (emailError as any).statusCode });
      
      // Parse specific Resend error
      let userFriendlyError = "E-Mail konnte nicht gesendet werden.";
      const resendError = emailError as any;
      
      if (resendError.statusCode === 403 || (resendError.message && resendError.message.includes("domain"))) {
        userFriendlyError = `Domain nicht verifiziert: Die Domain "${fromEmail.split('@')[1]}" ist nicht in Ihrem Resend-Konto verifiziert. Bitte gehen Sie zu resend.com/domains und fügen Sie diese Domain hinzu.`;
      } else if (resendError.statusCode === 401) {
        userFriendlyError = "Ungültiger API-Key. Bitte überprüfen Sie Ihren Resend API-Key.";
      } else if (resendError.message) {
        userFriendlyError = resendError.message;
      }
      
      await logEmail({
        recipientEmail: offer.customer_email,
        recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
        subject: `Ihre Offerte von ${offer.company?.company_name}`,
        emailType: "offer_sent",
        status: "failed",
        errorMessage: JSON.stringify(emailError),
        companyId: offer.company_id,
        leadId: offer.lead_id,
        metadata: { 
          offer_id: offerId, 
          total: offer.total, 
          hasOfferPdf: !!offerPdfBase64, 
          hasAgbPdf: !!agbPdfBase64,
          hasChecklistPdf: !!checklistPdfBase64, 
          hasLeistungsuebersicht: !!leistungsuebersichtHtml,
          from_email: fromEmail,
          is_company_email: isCompanyEmail
        },
      });
      
      // BUG-5: 422 Unprocessable — e-posta gönderilemedi (frontend sendError ile yakalar)
      return new Response(
        JSON.stringify({ error: userFriendlyError, details: emailError, from_email: fromEmail }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Email sent successfully", { 
      to: offer.customer_email, 
      hasOfferPdf: !!offerPdfBase64,
      hasAgbPdf: !!agbPdfBase64,
      hasChecklistPdf: !!checklistPdfBase64, 
      hasLeistungsuebersicht: !!leistungsuebersichtHtml 
    });

    await logEmail({
      recipientEmail: offer.customer_email,
      recipientName: `${offer.customer_first_name} ${offer.customer_last_name}`,
      subject: `Ihre Offerte von ${offer.company?.company_name} – Nr. ${offer.id.slice(0, 8).toUpperCase()}`,
      emailType: "offer_sent",
      status: "sent",
      companyId: offer.company_id,
      leadId: offer.lead_id,
      metadata: { 
        offer_id: offerId, 
        total: offer.total, 
        hasOfferPdf: !!offerPdfBase64, 
        hasAgbPdf: !!agbPdfBase64,
        hasChecklistPdf: !!checklistPdfBase64, 
        hasLeistungsuebersicht: !!leistungsuebersichtHtml,
        from_email: fromEmail,
        is_company_email: isCompanyEmail
      },
    });

    // Update offer status to sent
    const { error: updateError } = await supabase
      .from("offers")
      .update({ 
        status: "sent",
        sent_at: new Date().toISOString()
      })
      .eq("id", offerId);

    if (updateError) {
      logStep("Failed to update offer status", { error: updateError });
    } else {
      logStep("Offer status updated to sent");
    }

    // Schedule besichtigung data cleanup (3 days after offer sent)
    // Non-blocking: failures here should not affect the offer send flow
    try {
      if (offer.company_id) {
        const { data: cleanupResult } = await supabase.rpc(
          "schedule_besichtigung_cleanup",
          {
            p_company_id: offer.company_id,
            p_lead_id: offer.lead_id || null,
            p_days: 3,
          }
        );
        const parsed = typeof cleanupResult === "string" ? JSON.parse(cleanupResult) : cleanupResult;
        if (parsed?.updated > 0) {
          logStep("Besichtigung cleanup scheduled", { sessions: parsed.updated, cleanup_at: parsed.cleanup_at });
        }
      }
    } catch (cleanupErr) {
      // Log but don't fail the offer send
      logStep("Besichtigung cleanup scheduling failed (non-critical)", { error: String(cleanupErr) });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Offer sent successfully", 
        hasOfferPdf: !!offerPdfBase64,
        hasAgbPdf: !!agbPdfBase64,
        hasChecklistPdf: !!checklistPdfBase64, 
        hasLeistungsuebersicht: !!leistungsuebersichtHtml 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("Error processing request", { error: errorMessage, stack: errorStack });
    
    // BUG-5: 500 — beklenmedik hata (frontend sendError ile yakalar)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
