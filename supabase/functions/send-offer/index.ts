import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logEmail } from "../_shared/logEmail.ts";
import { getDefaultFrom, getDashAppUrl, getAppName } from "../_shared/envConfig.ts";
import { verifyCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { escapeHtml } from "../_shared/escapeHtml.ts";
import {
  createTranslator,
  formatCurrency,
  formatDate as formatDateLocale,
  formatDateTime,
  formatNumber,
  toLocale,
} from "../_shared/i18n/index.ts";
// jsPDF and QRCode removed - ALL PDFs are now generated on the frontend
// using @react-pdf/renderer and passed to this edge function as base64.
// This keeps the edge function lightweight and ensures identical PDFs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BUG-8: PII masking helpers — logs are DSG/DSGVO compliant
const maskEmail = (e: string) => e.replace(/(?<=.{2}).+(?=@)/, "***");

/** Escape user-supplied strings before interpolating into HTML email templates. */
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
  /** Dashboard language of the firm — governs the confirmation copy sent back to the company. */
  default_language?: string | null;
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
  price_type?: string | null;
  time_estimate?: { minHours: number; maxHours: number; hourlyRate: number } | null;
  // Betrags-Achse (offer_items.amount_basis): fixed | rate | range.
  amount_basis?: string | null;
  // Item-level Kostendach (offer_items.kostendach_max, max. CHF, netto) für rate-Posten.
  kostendach_max?: number | null;
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
  discount_percent?: number | null;
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
        company:companies(id, company_name, email, phone, street, house_number, plz, city, website, logo_url, mwst_number, iban, primary_color, signature_url, default_payment_terms, default_terms_and_conditions, default_language, resend_enabled, resend_api_key, resend_from_email, resend_from_name),
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
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Offers in a terminal status cannot be sent — to prevent status regression
    const TERMINAL_STATUSES = ["accepted", "rejected"];
    if (TERMINAL_STATUSES.includes(offer.status)) {
      logStep("Cannot resend — offer is in terminal status", { offerId, status: offer.status });
      return new Response(
        JSON.stringify({ error: `Diese Offerte kann nicht erneut gesendet werden (Status: ${offer.status}).` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Duplicate-send guard — if the offer is already "sent" or "viewed", force_resend is required
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

    // ── Locales ────────────────────────────────────────────────────────────────
    // Two recipients, two languages: the customer reads the offer in the DOCUMENT language
    // (offers.language, frozen at creation), while the confirmation copy that goes back to the
    // firm stays in the COMPANY language (companies.default_language).
    const customerLocale = toLocale(offer.language);
    const companyLocale = toLocale(offer.company?.default_language);
    const tCustomer = createTranslator(customerLocale);
    const tCompany = createTranslator(companyLocale);

    // Generate offer view URL
    const offerViewUrl = `${getDashAppUrl()}/offerte/${offer.access_token}`;
    // Brand color (company.primary_color) — for email header/CTA/table heading
    const accent = offer.company?.primary_color || "#4f46e5";

    // Build items HTML (mobile-safe stacked layout). Currency is always CHF; only the number
    // formatting follows the reader's locale.
    const fmtCHF = (n: number) => formatCurrency(n, customerLocale);
    const fmtCHFCompany = (n: number) => formatCurrency(n, companyLocale);
    // Free items (inkl/optional) are NOT priced rows — they resurface as a \u2713 "Inklusive"
    // block below the billable rows (mirrors PDF P2a + Detail view; single-source semantics
    // of src/lib/offerPricing isFreeItem, duplicated here because Deno cannot import src/).
    const isFreeItem = (pt: string | null | undefined) => pt === "inkl" || pt === "optional";
    const billableItems = (items ?? []).filter((i) => !isFreeItem(i.price_type));
    const freeItems = (items ?? []).filter((i) => isFreeItem(i.price_type));

    // Betrags-Achse — 1:1 gespiegelt aus src/lib/offerPricing (resolveAmountBasis, offerHasRateItem).
    // Deno kann src/ nicht importieren, daher hier dupliziert. SINGLE SOURCE der Regeln bleibt offerPricing.ts.
    const validTE = (te: OfferItem["time_estimate"]) =>
      !!(te && te.minHours > 0 && te.hourlyRate > 0);
    const itemBasis = (item: OfferItem): "fixed" | "rate" | "range" => {
      const b = item.amount_basis;
      if (b === "fixed" || b === "rate" || b === "range") return b;
      return validTE(item.time_estimate) ? "range" : "fixed";
    };
    // rate-Posten (Menge/Dauer unbestimmt) → gar keine Aggregatsumme. Sobald EIN Posten 'rate' ist,
    // wird die gesamte Total-/Zwischensumme-Box ausgeblendet und stattdessen der Hinweis
    // email.offer.rateAggregateNote gezeigt.
    const hasRateItem = billableItems.some((it) => itemBasis(it) === "rate");
    const rateAggregateNoteHtml = `<div style="text-align: right; margin: 24px 0; font-size: 13px; color: #6b7280;">${tCustomer("email.offer.rateAggregateNote")}</div>`;
    // First description line = bold main title, remaining lines = muted sub-line.
    const descHtml = (desc: string) => {
      const [main, ...rest] = (desc ?? "").split("\n");
      const sub = rest.join(" ").trim();
      return `<span style="font-weight: 700;">${escapeHtml(main)}</span>${sub ? `<br><span style="font-size: 12px; color: #6b7280;">${escapeHtml(sub)}</span>` : ""}`;
    };
    // amount_basis 'rate' (Ansatz): Preisspalte zeigt Einheitspreis "CHF X / Einheit" statt eines
    // bestimmten Totals; nicht in der Summe (Total-Zeile = "nach Aufwand"). Kein src/-Import in Deno,
    // daher hier dupliziert (wie isFreeItem oben). item-level Kostendach als Inline-Notiz.
    const itemsHtml = billableItems.map(item => {
      const te = item.time_estimate;
      const hasTE = te && te.minHours > 0 && te.hourlyRate > 0;
      const isRate = item.amount_basis === "rate";
      const minTotal = hasTE ? te!.minHours * te!.hourlyRate : item.quantity * item.unit_price;
      const maxTotal = hasTE ? te!.maxHours * te!.hourlyRate : null;
      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">${tCustomer("email.offer.itemPosition")}</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${item.position}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 6px 0 4px 0; color: #111827; font-size: 14px; word-break: break-word; line-height: 1.5;">${descHtml(item.description)}</td>
            </tr>
            ${hasTE ? `
            <tr>
              <td colspan="2" style="padding: 2px 0; color: #b45309; font-size: 12px;">
                ${tCustomer("email.offer.timeEstimate", {
                  minHours: te!.minHours,
                  maxHours: te!.maxHours,
                  rate: fmtCHF(te!.hourlyRate),
                })}
              </td>
            </tr>` : isRate ? `
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">${tCustomer("email.offer.itemRate")}</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; text-align: right;">${fmtCHF(Number(item.unit_price))} / ${escapeHtml(item.unit || tCustomer("email.offer.unitHour"))}</td>
            </tr>` : `
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">${tCustomer("email.offer.itemQuantity")}</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; text-align: right;">${item.quantity} ${escapeHtml(item.unit || tCustomer("email.offer.unitPiece"))}</td>
            </tr>
            <tr>
              <td style="padding: 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap;">${tCustomer("email.offer.itemPrice")}</td>
              <td style="padding: 2px 0; color: #111827; font-size: 14px; text-align: right;">${fmtCHF(Number(item.unit_price))}</td>
            </tr>`}
            <tr>
              <td style="padding: 6px 0 2px 0; color: #6b7280; font-size: 12px; width: 30%; white-space: nowrap; font-weight: 600;">${tCustomer("email.offer.itemTotal")}</td>
              <td style="padding: 6px 0 2px 0; font-size: 15px; font-weight: 700; text-align: right; ${hasTE ? 'color: #b45309;' : isRate ? 'color: #6b7280;' : 'color: #111827;'}">
                ${hasTE ? `${fmtCHF(minTotal)} &ndash; ${fmtCHF(maxTotal!)}` : isRate ? tCustomer("email.offer.itemOnDemand") : fmtCHF(minTotal)}
              </td>
            </tr>
            ${isRate && item.kostendach_max != null ? `
            <tr>
              <td colspan="2" style="padding: 8px 0 2px 0;">
                <div style="padding: 8px 10px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 12px;">
                  <strong>${tCustomer("email.offer.kostendachLabel")}:</strong> ${tCustomer("email.offer.kostendachValue", { amount: fmtCHF(Number(item.kostendach_max)) })}${Number(item.unit_price) > 0 ? ` ${tCustomer("email.offer.kostendachHours", { hours: +(Number(item.kostendach_max) / Number(item.unit_price)).toFixed(1) })}` : ""} &mdash; ${tCustomer("email.offer.kostendachExplain")}
                </div>
              </td>
            </tr>` : ``}
          </table>
        </td>
      </tr>`;
    }).join("") + (freeItems.length > 0 ? `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px;">${tCustomer("email.offer.itemIncluded")}</div>
          ${freeItems.map((i) => `<span style="display: inline-block; margin: 2px 14px 2px 0; font-size: 13px; color: #111827;"><span style="color: ${accent}; font-weight: 700;">&#10003;</span>&nbsp;${escapeHtml((i.description ?? "").split("\n")[0])}</span>`).join("")}
        </td>
      </tr>` : "");

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return tCustomer("common.notSpecified");
      return formatDateLocale(dateStr, customerLocale);
    };

    // Note about PDF attachments in email. The list is joined with the locale's own conjunction
    // ("und" / "et" / "and") rather than a hardcoded German one.
    const attachmentNotes: string[] = [];
    if (offerPdfBase64) {
      attachmentNotes.push(tCustomer("email.offer.attachmentOfferPdf"));
    }
    if (agbPdfBase64) {
      attachmentNotes.push(tCustomer("email.offer.attachmentAgb"));
    }
    if (checklistPdfBase64) {
      attachmentNotes.push(tCustomer("email.offer.attachmentChecklist"));
    }

    const attachmentList = attachmentNotes.join(` ${tCustomer("email.offer.attachmentConjunction")} `);

    const pdfAttachmentNote = attachmentNotes.length > 0 ? `
      <div style="margin-top: 20px; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="margin: 0; color: #166534; font-size: 14px;">
          📎 <strong>${tCustomer("common.attachments")}:</strong> ${tCustomer("email.offer.attachmentsNote", { list: attachmentList })}
        </p>
      </div>
    ` : "";

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="${customerLocale}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tCustomer("email.offer.documentTitle", { companyName: escapeHtml(offer.company?.company_name) })}</title>
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
        <div class="header" style="background: ${accent}; padding: 24px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${tCustomer("email.offer.headerTitle")}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${tCustomer("email.offer.headerFrom", { companyName: escapeHtml(offer.company?.company_name) })}</p>
        </div>

        <!-- Content -->
        <div class="content" style="padding: 24px 20px;">
          <p style="font-size: 16px; color: #1f2937; margin-bottom: 24px;">
            ${tCustomer("common.greeting", { name: `${escapeHtml(offer.customer_first_name)} ${escapeHtml(offer.customer_last_name)}` })}
          </p>

          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            ${tCustomer("email.offer.intro")}
          </p>

          ${pdfAttachmentNote}

          <!-- Offer Summary Card -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">${escapeHtml(offer.title)}</h2>
            ${offer.description ? `<p style="color: #6b7280; margin: 0 0 16px 0;">${escapeHtml(offer.description)}</p>` : ""}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 50%;">${tCustomer("email.offer.serviceDate")}:</td>
                <td style="padding: 6px 0; color: #1f2937; font-weight: 700; text-align: right;">${formatDate(offer.service_date)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 50%;">${tCustomer("email.offer.validUntil")}:</td>
                <td style="padding: 6px 0; color: #1f2937; font-weight: 700; text-align: right;">${formatDate(offer.valid_until)}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; margin: 24px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <thead>
              <tr>
                <th style="padding: 12px 14px; text-align: left; background-color: ${accent}; color: #ffffff; font-size: 14px;">${tCustomer("email.offer.itemsHeading")}</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <!-- Totals -->
          ${(() => {
            // rate-Posten → keine Aggregatsumme; nur Hinweis (email.offer.rateAggregateNote).
            if (hasRateItem) return rateAggregateNoteHtml;
            // Blind/Stunden-Spanne (nur fixed+range) — unverändert.
            const hasItemTE = billableItems.some(i => i.time_estimate && i.time_estimate.maxHours > 0 && i.time_estimate.hourlyRate > 0);
            if (!hasItemTE) {
              // P4a: Zwischensumme comes from the ITEMS (raw, free items excluded) — never
              // derived back from offers.subtotal, which stores the DISCOUNTED base (P3b-1).
              const surchargeArr = Array.isArray(offer.surcharges) ? offer.surcharges : [];
              const surchargesSum = surchargeArr.reduce((sum, x) => sum + (Number(x?.amount) || 0), 0);
              const itemsSub = billableItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
              const hasDiscount = Number(offer.discount_percent) > 0;
              // Discounted base = exactly what the save flow wrote to offers.subtotal.
              const discountRows = hasDiscount ? `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.discount", { percent: formatNumber(Number(offer.discount_percent), customerLocale) })}:</span>
              <span style="margin-left: 24px; color: #1f2937;">- ${fmtCHF(itemsSub + surchargesSum - Number(offer.subtotal))}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.netTotal")}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(offer.subtotal))}</span>
            </div>` : "";
              const surchargeRows = surchargeArr.map((x) => `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${escapeHtml(x?.label) || tCustomer("email.offer.surchargeDefault")}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(x?.amount) || 0)}</span>
            </div>`).join("");
              return `
          <div style="text-align: right; margin: 24px 0;">
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.subtotal")}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(itemsSub)}</span>
            </div>${surchargeRows}${discountRows}
            ${Number(offer.vat_rate) > 0 ? `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.vat", { rate: offer.vat_rate })}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(offer.vat_amount || 0))}</span>
            </div>` : ''}
            <div style="font-size: 20px; font-weight: bold; color: #1f2937; border-top: 2px solid #e5e7eb; padding-top: 12px;">
              <span>${tCustomer("email.offer.total")}:</span>
              <span style="margin-left: 24px;">${fmtCHF(Number(offer.total || (Number(offer.subtotal) + Number(offer.vat_amount || 0))))}</span>
            </div>
          </div>`;
            }
            // Per-item time estimates — compute range totals (P4a: free items excluded,
            // discount applied between the raw base and the VAT — mirrors offerPricing
            // computeDisplayTotals; duplicated because Deno cannot import src/).
            const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
            const dPct = Number(offer.discount_percent) > 0 ? Number(offer.discount_percent) : 0;
            const applyD = (n: number) => (dPct > 0 ? round2(n * (1 - dPct / 100)) : n);
            const minSub = billableItems.reduce((sum, item) => {
              const te = item.time_estimate;
              if (te && te.minHours > 0 && te.hourlyRate > 0) return sum + te.minHours * te.hourlyRate;
              return sum + item.quantity * item.unit_price;
            }, 0);
            const maxSub = billableItems.reduce((sum, item) => {
              const te = item.time_estimate;
              if (te && te.maxHours > 0 && te.hourlyRate > 0) return sum + te.maxHours * te.hourlyRate;
              return sum + item.quantity * item.unit_price;
            }, 0);
            // Zuschläge: Zwischensumme-Range bleibt Positionen; Zuschläge fix dazwischen, MwSt auf (Sub + Zuschläge).
            const rangeSurcharges = Array.isArray(offer.surcharges) ? offer.surcharges : [];
            const rangeSurchargesSum = rangeSurcharges.reduce((sum, x) => sum + (Number(x?.amount) || 0), 0);
            const rangeSurchargeRows = rangeSurcharges.map((x) => `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${escapeHtml(x?.label) || tCustomer("email.offer.surchargeDefault")}:</span>
              <span style="margin-left: 24px; color: #1f2937;">${fmtCHF(Number(x?.amount) || 0)}</span>
            </div>`).join("");
            const minBase = applyD(minSub + rangeSurchargesSum);
            const maxBase = applyD(maxSub + rangeSurchargesSum);
            const rangeDiscountRows = dPct > 0 ? `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.discount", { percent: formatNumber(dPct, customerLocale) })}:</span>
              <span style="margin-left: 24px; color: #b45309;">- ${fmtCHF(minSub + rangeSurchargesSum - minBase)} &ndash; - ${fmtCHF(maxSub + rangeSurchargesSum - maxBase)}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.netTotal")}:</span>
              <span style="margin-left: 24px; color: #b45309;">${fmtCHF(minBase)} &ndash; ${fmtCHF(maxBase)}</span>
            </div>` : "";
            const minVat = minBase * (Number(offer.vat_rate) / 100);
            const maxVat = maxBase * (Number(offer.vat_rate) / 100);
            const minTotal = minBase + minVat;
            const maxTotal = maxBase + maxVat;
            return `
          ${offer.offerte_type === 'blind' ? `
          <div style="margin: 0 0 20px 0; padding: 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #b45309;">
              ${tCustomer("email.offer.blindNote")}
            </p>
          </div>` : ''}
          <!-- Totals range -->
          <div style="text-align: right; margin: 24px 0;">
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.subtotal")}:</span>
              <span style="margin-left: 24px; color: #b45309; font-weight: 600;">${fmtCHF(minSub)} &ndash; ${fmtCHF(maxSub)}</span>
            </div>${rangeSurchargeRows}${rangeDiscountRows}
            ${Number(offer.vat_rate) > 0 ? `
            <div style="margin-bottom: 8px;">
              <span style="color: #6b7280;">${tCustomer("email.offer.vat", { rate: offer.vat_rate })}:</span>
              <span style="margin-left: 24px; color: #b45309;">${fmtCHF(minVat)} &ndash; ${fmtCHF(maxVat)}</span>
            </div>` : ''}
            <div style="font-size: 20px; font-weight: bold; color: #92400e; border-top: 2px solid #fde68a; padding-top: 12px;">
              <span>${tCustomer("email.offer.total")}:</span>
              <span style="margin-left: 24px;">${fmtCHF(minTotal)} &ndash; ${fmtCHF(maxTotal)}</span>
            </div>
          </div>`;
          })()}

          ${offer.price_model === 'stundenansatz' && offer.hourly_rate != null ? `
          <!-- Preismodell: Stundenansatz -->
          <div style="margin: 0 0 24px 0; padding: 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #1e40af; font-size: 14px;">
              ${tCustomer("email.offer.priceModelHourlyTitle")}
            </p>
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #1e3a8a; font-weight: 700;">
              ${tCustomer("email.offer.priceModelHourlyRate", { rate: formatNumber(Number(offer.hourly_rate), customerLocale) })}
            </p>
            <p style="margin: 0; font-size: 13px; color: #3b82f6;">
              ${tCustomer("email.offer.priceModelHourlyNote")}
            </p>
          </div>
          ` : ''}

          ${offer.price_model === 'kostendach' && offer.hourly_rate != null && offer.kostendach_max != null && !(items ?? []).some((i) => i.kostendach_max != null) ? `
          <!-- Preismodell: Kostendach (offer-level, nur Fallback ohne item-level Cap) -->
          <div style="margin: 0 0 24px 0; padding: 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #92400e; font-size: 14px;">
              ${tCustomer("email.offer.priceModelKostendachTitle")}
            </p>
            <p style="margin: 0 0 4px 0; font-size: 15px; color: #92400e; font-weight: 700;">
              ${tCustomer("email.offer.priceModelKostendachRate", {
                rate: formatNumber(Number(offer.hourly_rate), customerLocale),
                max: formatNumber(Number(offer.kostendach_max), customerLocale),
              })}
            </p>
            <p style="margin: 0; font-size: 13px; color: #d97706;">
              ${tCustomer("email.offer.priceModelKostendachNote", { max: formatNumber(Number(offer.kostendach_max), customerLocale) })}
            </p>
          </div>
          ` : ''}

          ${paymentTerms ? `
          <!-- Zahlungskondition -->
          <div style="margin: 0 0 24px 0; padding: 14px 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e; display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-weight: 700; color: #166534; font-size: 14px; white-space: nowrap;">${tCustomer("email.offer.paymentTermsLabel")}:</span>
            <span style="color: #166534; font-size: 14px;">${escapeHtml(paymentTerms)}</span>
          </div>
          ` : ''}

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${offerViewUrl}" class="cta" style="display: inline-block; background: ${accent}; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${tCustomer("email.offer.cta")}
            </a>
          </div>

          <p class="mobile-break" style="color: #6b7280; font-size: 14px; text-align: center; word-break: break-all;">
            ${tCustomer("email.offer.ctaFallback")} <a href="${offerViewUrl}" style="color: ${accent};">${offerViewUrl}</a>
          </p>
          
          <!-- Leistungsübersicht Section (if available) -->
          ${leistungsuebersichtHtml}
        </div>
        
        <!-- Footer -->
        <div class="footer" style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #1f2937; font-weight: 600; margin: 0 0 8px 0;">${offer.company?.company_name}</p>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">
            ${offer.company?.street ? `${offer.company.street} ${offer.company.house_number || ""}, ` : ""}${offer.company?.plz} ${offer.company?.city}<br>
            ${offer.company?.phone ? `${tCustomer("common.phone")}: ${offer.company.phone} | ` : ""}${offer.company?.email}
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
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    // Send email with optional attachments
    const offerNumber = offer.id.slice(0, 8).toUpperCase();
    const customerSubject = tCustomer("email.offer.subject", {
      companyName: offer.company?.company_name,
      offerNumber,
    });

    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string }[];
    } = {
      from: fromAddress,
      to: [offer.customer_email],
      subject: customerSubject,
      html: emailHtml,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    // Atomically claim the send: flip to "sending" only if the offer is still in a claimable
    // state. This closes the check-then-act race above — a concurrent request (or a double
    // click) finds "sending" and gets 0 rows back, so the customer never receives duplicates.
    const originalStatus = offer.status;
    const { data: claimedRows, error: claimError } = await supabase
      .from("offers")
      .update({ status: "sending" })
      .eq("id", offerId)
      .in("status", ["draft", "sent", "viewed"])
      .select("id");

    if (claimError) {
      logStep("Failed to claim offer for sending", { error: claimError });
      return new Response(
        JSON.stringify({ error: "Offerte konnte nicht für den Versand gesperrt werden." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!claimedRows || claimedRows.length === 0) {
      logStep("Offer already being sent or status changed — duplicate prevented", { offerId });
      return new Response(
        JSON.stringify({ error: "Diese Offerte wird bereits gesendet oder wurde bereits gesendet." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        subject: customerSubject,
        emailType: "offer_sent",
        status: "failed",
        errorMessage: JSON.stringify(emailError),
        companyId: offer.company_id,
        leadId: offer.lead_id,
        language: customerLocale,
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
      
      // Release the claim so the offer can be retried (revert "sending" → its previous status).
      await supabase.from("offers").update({ status: originalStatus }).eq("id", offerId);

      // BUG-5: 422 Unprocessable — email could not be sent (frontend catches it via sendError)
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
      subject: customerSubject,
      emailType: "offer_sent",
      status: "sent",
      companyId: offer.company_id,
      leadId: offer.lead_id,
      language: customerLocale,
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

    // Confirmation copy to the firm (own request 2026-07-04): the customer send has already
    // succeeded — a failure HERE must not fail the request or revert the status, so this
    // block is isolated by design (not error suppression; both outcomes are logged).
    const companyEmail = offer.company?.email;
    if (companyEmail) {
      const offerNo = offerNumber;
      // COMPANY language — this copy goes to the firm, so it must NOT inherit the customer's
      // locale. The confirmation prose itself is firm-internal CRM copy and stays German;
      // the labels and the money/date formatting follow companies.default_language.
      const confirmSubject = `Bestätigung: Offerte Nr. ${offerNo} wurde gesendet`;
      // The attachment list in this copy is the firm's language, not the customer's.
      const companyAttachmentNotes: string[] = [];
      if (offerPdfBase64) companyAttachmentNotes.push(tCompany("email.offer.attachmentOfferPdf"));
      if (agbPdfBase64) companyAttachmentNotes.push(tCompany("email.offer.attachmentAgb"));
      if (checklistPdfBase64) companyAttachmentNotes.push(tCompany("email.offer.attachmentChecklist"));

      const confirmRow = (label: string, value: string) => `
            <tr>
              <td style="padding: 4px 0; color: #6b7280; font-size: 13px; width: 35%;">${label}</td>
              <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 600;">${value}</td>
            </tr>`;
      const confirmHtml = `
      <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px 16px;">
        <div style="border: 1px solid #e5e7eb; border-left: 4px solid ${accent}; border-radius: 8px; padding: 20px 24px;">
          <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #111827;">
            Ihre Offerte wurde erfolgreich versendet
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            ${confirmRow(tCompany("common.offer"), `Nr. ${offerNo} &ndash; ${escapeHtml(offer.title)}`)}
            ${confirmRow(tCompany("common.customer"), `${escapeHtml(offer.customer_first_name)} ${escapeHtml(offer.customer_last_name)}`)}
            ${confirmRow(tCompany("common.email"), escapeHtml(offer.customer_email))}
            ${confirmRow(tCompany("email.offer.total"), fmtCHFCompany(Number(offer.total || 0)))}
            ${confirmRow(tCompany("common.sentAt"), formatDateTime(new Date(), companyLocale))}
            ${companyAttachmentNotes.length > 0 ? confirmRow(tCompany("common.attachments"), escapeHtml(companyAttachmentNotes.join(", "))) : ""}
          </table>
          <p style="margin: 14px 0 0 0; font-size: 12px; color: #6b7280;">
            Diese Bestätigung wurde automatisch erstellt. Sie werden ebenfalls benachrichtigt, sobald der Kunde die Offerte ansieht oder beantwortet.
          </p>
        </div>
      </div>`;
      try {
        const { error: confirmError } = await resend.emails.send({
          from: fromAddress,
          to: [companyEmail],
          subject: confirmSubject,
          html: confirmHtml,
        });
        if (confirmError) throw confirmError;
        logStep("Company confirmation email sent", { to: companyEmail });
        await logEmail({
          recipientEmail: companyEmail,
          recipientName: offer.company?.company_name,
          subject: confirmSubject,
          emailType: "offer_sent_confirmation",
          status: "sent",
          companyId: offer.company_id,
          leadId: offer.lead_id,
          language: companyLocale,
          metadata: { offer_id: offerId },
        });
      } catch (confirmErr) {
        logStep("Company confirmation email FAILED (customer send unaffected)", { error: String(confirmErr) });
        await logEmail({
          recipientEmail: companyEmail,
          recipientName: offer.company?.company_name,
          subject: confirmSubject,
          emailType: "offer_sent_confirmation",
          status: "failed",
          errorMessage: String(confirmErr),
          companyId: offer.company_id,
          leadId: offer.lead_id,
          language: companyLocale,
          metadata: { offer_id: offerId },
        });
      }
    } else {
      logStep("No company email — confirmation copy skipped");
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
    
    // BUG-5: 500 — unexpected error (frontend catches it via sendError)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
