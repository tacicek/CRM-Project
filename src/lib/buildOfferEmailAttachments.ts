import { supabase } from "@/integrations/supabase/client";
import { generateOfferPdfBase64 } from "@/lib/generateOfferPdf";
import { generateAgbPdfBase64 } from "@/lib/generateAgbPdf";
import { getChecklistPdfBase64 } from "@/lib/generateChecklistPdf";
import { resolveDocumentLocale } from "@/i18n/documentLocale";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import { OFFER_ITEMS_PDF_SELECT } from "@/lib/offerItemsPdfSelect";
import { parseTimeEstimate } from "@/lib/offerTimeEstimate";
import { validateSurcharges } from "@/lib/offerSurcharges";
import { parseChecklistSections } from "@/lib/checklistTemplates";
import { parseIncludedServices } from "@/lib/offerLeistungsuebersicht";
import { localizeOfferAgbSections, parseOfferAgbSections } from "@/lib/offerAgbSections";

type LeadRow = {
  service_type?: string | null;
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
  from_has_estrich?: boolean | null;
  from_has_keller?: boolean | null;
  to_street?: string | null;
  to_house_number?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_floor?: number | null;
  to_has_lift?: boolean | null;
};

type AttachmentResult = {
  offerPdfBase64: string | null;
  agbPdfBase64: string | null;
  checklistPdfBase64: string | null;
};

export const buildOfferEmailAttachments = async (
  offerId: string,
  companyId: string
): Promise<AttachmentResult> => {
  const [offerRes, itemsRes, companyRes, leistungRes] = await Promise.all([
    supabase.from("offers").select("*").eq("id", offerId).single(),
    supabase.from("offer_items").select(OFFER_ITEMS_PDF_SELECT).eq("offer_id", offerId).order("position"),
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.from("offer_leistungsuebersicht").select("*").eq("offer_id", offerId).maybeSingle(),
  ]);

  if (offerRes.error || !offerRes.data) {
    throw new Error("Offer data for email attachment could not be loaded.");
  }
  if (companyRes.error || !companyRes.data) {
    throw new Error("Company data for email attachment could not be loaded.");
  }

  const offerData = offerRes.data;
  const itemsData = itemsRes.data || [];
  const companyData = companyRes.data;

  let leadData: LeadRow | null = null;
  if (offerData.lead_id) {
    const { data } = await supabase
      .from("leads")
      .select(
        "service_type, from_street, from_house_number, from_plz, from_city, from_floor, from_has_lift, from_has_estrich, from_has_keller, to_street, to_house_number, to_plz, to_city, to_floor, to_has_lift"
      )
      .eq("id", offerData.lead_id)
      .single();
    leadData = data as LeadRow | null;
  }

  // Surcharges are a financial input to the offer PDF (the norm taxes them before VAT). Narrow
  // the raw Json fail-closed, exactly like the download-PDF path (OfferteDetail): malformed data
  // aborts the whole attachment build rather than emailing a wrong document. null/[] → no
  // surcharges (valid). Values/order preserved (label + amount snapshot).
  const surchargesResult = validateSurcharges(offerData.surcharges);
  if (!surchargesResult.ok) {
    throw new Error("Offer surcharges for email attachment are malformed.");
  }
  const validatedSurcharges = surchargesResult.value.map((s) => ({ label: s.label, amount: s.amount }));

  const offerPdfBase64 = await generateOfferPdfBase64({
    ...offerData,
    surcharges: validatedSurcharges,
    // offer-level time_estimate is a raw Json column (legacy, effectively unused) — narrow it
    // the same way as OfferteDetail so the spread type matches LegacyOfferData.
    time_estimate: parseTimeEstimate(offerData.time_estimate),
    description: offerData.description || undefined,
    customer_phone: offerData.customer_phone || undefined,
    service_date: offerData.service_date || undefined,
    valid_until: offerData.valid_until || undefined,
    price_model: (offerData.price_model as 'pauschal' | 'stundenansatz' | 'kostendach' | null) ?? 'pauschal',
    hourly_rate: offerData.hourly_rate ?? null,
    kostendach_max: offerData.kostendach_max ?? null,
    payment_terms: offerData.payment_terms ?? null,
    service_start_time: offerData.service_start_time ?? null,
    service_end_time: offerData.service_end_time ?? null,
    // Full pass-through (mirror OfferteDetail.buildOfferPayload spread): the email PDF must carry
    // the SAME fields as the download PDF — service_type (Gruppierung), price_type, time_estimate,
    // amount_basis, kostendach_max, effort/volume/area_meta, scheduled_*, list_price,
    // discount_percent, breakdown, leistung. itemsData selektiert sie bereits (OFFER_ITEMS_PDF_SELECT);
    // die alte 5-Feld-Map liess alles ausser Betrag/Menge fallen (kein Multi-Service, kein rate).
    items: itemsData.map((item) => ({
      ...item,
      unit: item.unit ?? "",
      total: Number(item.total),
      // time_estimate is a raw Json column — narrow it at this read boundary with the same
      // canonical parser the download-PDF path (OfferteDetail) uses, so both PDFs agree.
      time_estimate: parseTimeEstimate(item.time_estimate),
    })),
    company: {
      company_name: companyData.company_name,
      street: companyData.street || undefined,
      house_number: companyData.house_number || undefined,
      plz: companyData.plz,
      city: companyData.city,
      phone: companyData.phone || undefined,
      email: companyData.email,
      website: companyData.website || undefined,
      mwst_number: companyData.mwst_number || undefined,
      logo_url: companyData.logo_url || undefined,
      primary_color: companyData.primary_color || undefined,
      pdf_template: companyData.pdf_template ?? null,
      // Fallback der Dokumentsprache für Offerten, die vor der Spalte `offers.language`
      // entstanden sind. Die Offerte selbst (offerData.language, via Spread) hat Vorrang.
      default_language: companyData.default_language ?? null,
    },
    customer_address: leadData
      ? {
          street: leadData.from_street || undefined,
          house_number: leadData.from_house_number || undefined,
          plz: leadData.from_plz || undefined,
          city: leadData.from_city || undefined,
          floor: leadData.from_floor ?? undefined,
          has_lift: leadData.from_has_lift ?? undefined,
          has_estrich: leadData.from_has_estrich ?? undefined,
          has_keller: leadData.from_has_keller ?? undefined,
        }
      : undefined,
    customer_destination:
      leadData && (leadData.to_plz || leadData.to_city)
        ? {
            street: leadData.to_street || undefined,
            house_number: leadData.to_house_number || undefined,
            plz: leadData.to_plz || undefined,
            city: leadData.to_city || undefined,
            floor: leadData.to_floor ?? undefined,
            has_lift: leadData.to_has_lift ?? undefined,
          }
        : undefined,
    service_type: (leadData?.service_type as string) || undefined,
    brief_layout: offerData.brief_layout ?? false,
    customer_salutation: offerData.customer_salutation ?? null,
    offerte_type: (offerData.offerte_type as 'normal' | 'blind' | null) ?? 'normal',
    access_token: offerData.access_token,
    baseUrl: window.location.origin,
    // Optional, decorative content: only attach a Leistungsübersicht when its included_services
    // parse cleanly. A malformed value is omitted (never shown as an empty list) and never
    // affects the financial offer PDF.
    leistungsuebersicht: (() => {
      const services = leistungRes.data ? parseIncludedServices(leistungRes.data.included_services) : null;
      return services ? { included_services: services } : undefined;
    })(),
  });

  let agbPdfBase64: string | null = null;
  let checklistPdfBase64: string | null = null;

  if (leadData?.service_type) {
    const normalizedType = normalizeServiceTypeForAgb(leadData.service_type);
    // Document (customer) language, derived once — the AGB and checklist attachments both
    // render their chrome (and, for AGB, their section text) in it.
    const documentLocale = resolveDocumentLocale(offerData, companyData);

    const [agbRes, checklistRes] = await Promise.all([
      supabase
        .from("agb_sections")
        // `translations` is needed to resolve title/content to the document language below.
        .select("id, title, content, display_order, translations")
        .eq("company_id", companyId)
        .eq("service_type", normalizedType)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("checklist_templates")
        .select("title, subtitle, sections")
        .eq("company_id", companyId)
        .eq("service_type", normalizedType)
        .eq("is_active", true)
        .eq("include_in_offerte", true)
        .maybeSingle(),
    ]);

    if (agbRes.data && agbRes.data.length > 0) {
      // AGB is legal content the customer accepts — resolve title AND content to the document
      // language (German base fallback), exactly like the public RPC and firma download, so the
      // FR/EN customer never receives a German AGB. Fail closed on malformed sections rather than
      // e-mailing wrong/partial terms; raw data is not logged. Chrome (title/subtitle) follows
      // the same locale inside generateAgbPdfBase64.
      const localizedAgb = localizeOfferAgbSections(agbRes.data, documentLocale);
      const parsedAgb = parseOfferAgbSections(localizedAgb);
      if (!parsedAgb.ok) {
        throw new Error("Offer AGB sections for email attachment are malformed.");
      }
      agbPdfBase64 = await generateAgbPdfBase64(
        parsedAgb.value,
        companyData.company_name,
        documentLocale
      );
    }

    // Optional attachment: only build the checklist PDF when its stored sections parse into
    // valid ChecklistSection[]. null/empty/malformed → no attachment; the offer email proceeds.
    const checklistData = checklistRes.data;
    const parsedSections = checklistData ? parseChecklistSections(checklistData.sections) : null;
    if (checklistData && parsedSections) {
      try {
        checklistPdfBase64 = await getChecklistPdfBase64({
          title: checklistData.title,
          subtitle: checklistData.subtitle ?? undefined,
          sections: parsedSections,
          // Chrome of the checklist PDF follows the customer's language (the offer's).
          locale: documentLocale,
          company: {
            company_name: companyData.company_name,
            street: companyData.street ?? undefined,
            house_number: companyData.house_number ?? undefined,
            plz: companyData.plz,
            city: companyData.city,
            phone: companyData.phone ?? undefined,
            email: companyData.email,
            website: companyData.website ?? undefined,
            logo_url: companyData.logo_url ?? undefined,
            primary_color: companyData.primary_color ?? undefined,
          },
        });
      } catch (err) {
        console.warn("[buildOfferEmailAttachments] Checklist PDF generation failed:", err);
      }
    }
  }

  return { offerPdfBase64, agbPdfBase64, checklistPdfBase64 };
};
