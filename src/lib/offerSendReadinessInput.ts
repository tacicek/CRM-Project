import { supabase } from "@/integrations/supabase/client";
import { normalizeServiceTypeForAgb } from "@/lib/normalizeServiceType";
import {
  evaluateOfferSendReadiness,
  type ContentSlot,
  type ReadinessInput,
  type ReadinessResult,
} from "../../supabase/functions/_shared/offerSendReadiness.ts";
import { resolveLocalizedRowField } from "../../supabase/functions/_shared/localizedRow.ts";

/**
 * Die Sendebereitschaft aus Sicht des Browsers.
 *
 * ZWEI PRUEFUNGEN, EIN VERTRAG
 *
 * Die MASSGEBLICHE Pruefung sitzt in `send-offer` — daran kommt weder ein
 * veralteter Bundle noch ein direkter Aufruf vorbei. Diese hier ist die
 * schnelle: sie sagt dem Bediener, was fehlt, BEVOR PDFs erzeugt und eine
 * Anfrage gestellt wird.
 *
 * Beide rufen dieselbe Funktion auf — `evaluateOfferSendReadiness` aus
 * `_shared/`. Die Regel gibt es genau einmal; unterschiedlich ist nur, woher
 * die Zeilen kommen (hier PostgREST, dort service-role). Waere die Regel
 * zweimal geschrieben, waere die zweite die, die niemand pflegt.
 *
 * WAS SIE PRUEFT — UND WARUM NICHT MEHR
 *
 * Titel und Positionstexte sind beim Anlegen in der Kundensprache eingefroren
 * worden. Ihre Herkunft laesst sich hier nicht mehr belegen, und ein Blocker
 * auf Verdacht hielte jede richtige Offerte auf. Geprueft wird, was zur
 * Sendezeit noch aus einer Vorlage geholt wird: Zahlungskondition und AGB.
 */

export type { ReadinessFinding, ReadinessResult } from "../../supabase/functions/_shared/offerSendReadiness.ts";

interface AgbZeile {
  id: string;
  title: string | null;
  content: string | null;
  translations: unknown;
}

export const ladeOfferSendReadiness = async (offerId: string): Promise<ReadinessResult> => {
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, language, payment_terms, company_id, lead_id, leads(service_type)")
    .eq("id", offerId)
    .maybeSingle();

  if (error) throw error;
  if (!offer) {
    // Keine Zeile — die Sprache ist dann erst recht nicht bekannt. Fail closed.
    return evaluateOfferSendReadiness({ requestedLocale: null, slots: [] });
  }

  const locale = offer.language;
  const slots: ContentSlot[] = [];

  // Zahlungskondition: ohne eigene auf der Offerte kommt die deutsche
  // Firmenspalte zum Zug — ohne jede Uebersetzungssuche.
  if (!offer.payment_terms) {
    const { data: firma } = await supabase
      .from("companies")
      .select("id, default_payment_terms")
      .eq("id", offer.company_id)
      .maybeSingle();
    if (firma?.default_payment_terms) {
      slots.push({
        entity: "company",
        entityId: firma.id,
        field: "default_payment_terms",
        required: true,
        value: firma.default_payment_terms,
        source: locale === "de" ? "base" : "base-fallback",
        focus: "einstellungen#zahlungskonditionen",
      });
    }
  }

  const serviceType = (offer.leads as { service_type?: string | null } | null)?.service_type ?? null;
  if (serviceType && offer.company_id) {
    const { data: agb } = await supabase
      .from("agb_sections")
      .select("id, title, content, display_order, translations")
      .eq("company_id", offer.company_id)
      // `.eq` mit EINEM normalisierten Typ — genau wie
      // `buildOfferEmailAttachments`, das die Anhaenge tatsaechlich baut. Die
      // Edge Function benutzt eine zweite, abweichende Normalisierung (`.in`
      // ueber eine Liste); die beiden auseinanderzuhalten ist ein eigener
      // Befund (D-004: eine Umsetzung je Vertrag) und keine Sprachfrage.
      .eq("service_type", normalizeServiceTypeForAgb(serviceType))
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    for (const abschnitt of (agb ?? []) as AgbZeile[]) {
      for (const feld of ["title", "content"] as const) {
        const aufgeloest = resolveLocalizedRowField(
          abschnitt as unknown as Record<string, unknown>,
          feld,
          typeof locale === "string" ? locale : "",
        );
        slots.push({
          entity: "agb_section",
          entityId: abschnitt.id,
          field: feld,
          required: true,
          value: aufgeloest.value,
          source: aufgeloest.source,
          focus: "einstellungen#agb",
        });
      }
    }
  }

  const eingabe: ReadinessInput = { requestedLocale: locale, slots };
  return evaluateOfferSendReadiness(eingabe);
};
