import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bearbeitePaidApiAnfrage,
  type EndpunktVertrag,
  type PaidApiUmgebung,
} from "../_shared/paidApiHttp.ts";

/**
 * Adressdetails zu einer place_id — ein BEZAHLTER Google-Aufruf je Auswahl.
 * Verlangt ein geprueftes JWT und die Mitgliedschaft in der genannten Firma.
 */

const PlaceDetailsRequestSchema = z.object({
  placeId: z.string().min(1, "Place ID erforderlich").max(500, "Place ID zu lang"),
});

type PlaceDetailsRequest = z.infer<typeof PlaceDetailsRequestSchema>;

export interface PlaceResult {
  formattedAddress: string;
  street: string;
  houseNumber: string;
  plz: string;
  city: string;
  canton: string;
  country: string;
  lat: number;
  lng: number;
}

interface AddressComponent {
  types: string[];
  long_name: string;
  short_name: string;
}

export const detailsVertrag = (
  apiKey: string | undefined,
): EndpunktVertrag<PlaceDetailsRequest, { result: PlaceResult }> => ({
  name: "google-places-details",
  bucket: "google-places",

  pruefeNutzlast: (roh) => {
    const r = PlaceDetailsRequestSchema.safeParse(roh);
    return r.success ? r.data : null;
  },

  baueUrl: (n) => {
    if (!apiKey) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", n.placeId);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", "formatted_address,geometry,address_components");
    url.searchParams.set("language", "de");
    return url.toString();
  },

  werteAus: (daten) => {
    const d = daten as {
      status?: string;
      result?: {
        formatted_address?: string;
        address_components?: AddressComponent[];
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    };
    if (d?.status !== "OK" || !d.result) return null;

    const teile = d.result.address_components ?? [];
    const lang = (typen: string[]): string =>
      teile.find((c) => typen.some((t) => c.types.includes(t)))?.long_name ?? "";
    const kurz = (typen: string[]): string =>
      teile.find((c) => typen.some((t) => c.types.includes(t)))?.short_name ?? "";

    return {
      result: {
        formattedAddress: d.result.formatted_address ?? "",
        street: lang(["route"]),
        houseNumber: lang(["street_number"]),
        plz: lang(["postal_code"]),
        city: lang(["locality", "political"]) || lang(["administrative_area_level_2"]),
        canton: kurz(["administrative_area_level_1"]),
        country: kurz(["country"]),
        lat: d.result.geometry?.location?.lat ?? 0,
        lng: d.result.geometry?.location?.lng ?? 0,
      },
    };
  },
});

const produktionsUmgebung = (): PaidApiUmgebung => {
  const dienst = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return {
    verifyToken: async (token) => {
      const { data, error } = await dienst.auth.getUser(token);
      if (error) throw error;
      return data.user?.id ?? null;
    },
    consumeBudget: async (bucket, userId, companyId) => {
      const { data, error } = await dienst.rpc("consume_api_budget", {
        p_bucket: bucket,
        p_user_id: userId,
        p_company_id: companyId,
      });
      if (error) throw error;
      return data as { allowed: boolean; retry_after: number };
    },
    fetchGoogle: (url) => fetch(url),
    log: (ereignis, felder) => console.error(JSON.stringify({ ereignis, ...(felder ?? {}) })),
  };
};

serve((req) =>
  bearbeitePaidApiAnfrage(
    req,
    detailsVertrag(Deno.env.get("GOOGLE_MAPS_API_KEY")),
    produktionsUmgebung(),
  ),
);
