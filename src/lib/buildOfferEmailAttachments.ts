import { supabase } from "@/integrations/supabase/client";
import { generateOfferPdfBase64 } from "@/lib/generateOfferPdf";
import { generateAgbPdfBase64 } from "@/lib/generateAgbPdf";
import { getChecklistPdfBase64 } from "@/lib/generateChecklistPdf";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";

type LeadRow = {
  service_type?: string | null;
  from_street?: string | null;
  from_house_number?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_floor?: number | null;
  from_has_lift?: boolean | null;
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
    supabase.from("offer_items").select("*").eq("offer_id", offerId).order("position"),
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
        "service_type, from_street, from_house_number, from_plz, from_city, from_floor, from_has_lift, to_street, to_house_number, to_plz, to_city, to_floor, to_has_lift"
      )
      .eq("id", offerData.lead_id)
      .single();
    leadData = data as LeadRow | null;
  }

  const offerPdfBase64 = await generateOfferPdfBase64({
    ...offerData,
    description: offerData.description || undefined,
    customer_phone: offerData.customer_phone || undefined,
    service_date: offerData.service_date || undefined,
    valid_until: offerData.valid_until || undefined,
    price_model: (offerData.price_model as 'pauschal' | 'stundenansatz' | 'kostendach' | null) ?? 'pauschal',
    hourly_rate: offerData.hourly_rate ?? null,
    kostendach_max: offerData.kostendach_max ?? null,
    payment_terms: (offerData as Record<string, unknown>).payment_terms as string | null ?? null,
    service_start_time: (offerData as Record<string, unknown>).service_start_time as string | null ?? null,
    service_end_time: (offerData as Record<string, unknown>).service_end_time as string | null ?? null,
    items: itemsData.map(
      (item: {
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
        total: number;
      }) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total: Number(item.total),
      })
    ),
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
    },
    customer_address: leadData
      ? {
          street: leadData.from_street || undefined,
          house_number: leadData.from_house_number || undefined,
          plz: leadData.from_plz || undefined,
          city: leadData.from_city || undefined,
          floor: leadData.from_floor ?? undefined,
          has_lift: leadData.from_has_lift ?? undefined,
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
    brief_layout: (offerData as Record<string, unknown>).brief_layout as boolean ?? false,
    customer_salutation: (offerData as Record<string, unknown>).customer_salutation as string | null ?? null,
    offerte_type: ((offerData as Record<string, unknown>).offerte_type as 'normal' | 'blind' | null) ?? 'normal',
    access_token: offerData.access_token,
    baseUrl: window.location.origin,
    leistungsuebersicht: leistungRes.data
      ? {
          included_services: Array.isArray(leistungRes.data.included_services)
            ? leistungRes.data.included_services
            : [],
        }
      : undefined,
  });

  let agbPdfBase64: string | null = null;
  let checklistPdfBase64: string | null = null;

  if (leadData?.service_type) {
    const normalizedType = normalizeServiceTypeForAgb(leadData.service_type);

    const [agbRes, checklistRes] = await Promise.all([
      supabase
        .from("agb_sections")
        .select("id, title, content, display_order")
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
      agbPdfBase64 = await generateAgbPdfBase64(agbRes.data, companyData.company_name);
    }

    if (checklistRes.data?.sections && Array.isArray(checklistRes.data.sections) && checklistRes.data.sections.length > 0) {
      try {
        checklistPdfBase64 = await getChecklistPdfBase64({
          title: checklistRes.data.title,
          subtitle: checklistRes.data.subtitle ?? undefined,
          sections: checklistRes.data.sections as Parameters<typeof getChecklistPdfBase64>[0]["sections"],
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
