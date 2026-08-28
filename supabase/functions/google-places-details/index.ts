import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardAntwortHeaders, guardPaidApiCall } from "../_shared/paidApiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Zod Schema für Input-Validierung
const PlaceDetailsRequestSchema = z.object({
  placeId: z.string().min(1, "Place ID erforderlich").max(500, "Place ID zu lang"),
});

interface PlaceResult {
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Wer, und wie viel noch ────────────────────────────────────────────
    //
    // Bis 2026-08-28 stand hier ein Zaehler in einer `Map` im Modulkoerper und
    // sonst nichts: kein Token, keine Firma. Der Router erzeugt pro Anfrage
    // einen neuen Worker, also war die `Map` immer leer und die Drossel
    // wirkungslos (gemessen: 61 Anfragen, null 429). Und eine bezahlte API
    // anonym erreichbar zu lassen, waere ohnehin die falsche Antwort gewesen —
    // alle Aufrufer liegen hinter /firma.
    const dienst = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rumpf = await req.json().catch(() => null);
    const wache = await guardPaidApiCall(
      {
        bucket: "google-places",
        authorizationHeader: req.headers.get("Authorization") ?? req.headers.get("authorization"),
        companyId: (rumpf as { company_id?: unknown } | null)?.company_id,
      },
      {
        // Der Benutzer wird SERVERSEITIG aus dem Token abgeleitet, nie aus dem Rumpf.
        verifyToken: async (token) => {
          const { data, error } = await dienst.auth.getUser(token);
          if (error || !data.user) return null;
          return data.user.id;
        },
        // Der Zaehler liegt in Postgres: er ueberlebt Worker und Neustarts, ist
        // atomar, und er prueft die Mitgliedschaft in der angegebenen Firma.
        consumeBudget: async (topf, userId, companyId) => {
          const { data, error } = await dienst.rpc("consume_api_budget", {
            p_bucket: topf, p_user_id: userId, p_company_id: companyId,
          });
          if (error) throw new Error(error.message);
          return data as { allowed: boolean; retry_after: number };
        },
        log: (n, f) => console.error(`[google-places-details] ${n}`, f ?? {}),
      },
    );

    if (!wache.ok) {
      return new Response(
        JSON.stringify({ error: wache.message, code: wache.code }),
        {
          status: wache.status,
          headers: { ...corsHeaders, ...guardAntwortHeaders(wache), "Content-Type": "application/json" },
        },
      );
    }

    // Der Rumpf wurde oben schon gelesen — ein Request-Body laesst sich nur
    // einmal lesen. `rumpf` ist derselbe Wert.
    const rawBody = rumpf;
    
    // Validiere Input mit Zod
    const parseResult = PlaceDetailsRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[google-places-details] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { placeId } = parseResult.data;

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }

    // Use Google Places Details API
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", "formatted_address,geometry,address_components");
    url.searchParams.set("language", "de");

    console.log("[google-places-details] Fetching details for place:", placeId);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[google-places-details] API error:", data.status, data.error_message);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const place = data.result;
    const components = place.address_components || [];

    // Extract address components
    const getComponent = (types: string[]): string => {
      interface AddressComponent {
        types: string[];
        long_name: string;
        short_name: string;
      }
      const component = components.find((c: AddressComponent) => 
        types.some(t => c.types.includes(t))
      );
      return component?.long_name || "";
    };

    const getShortComponent = (types: string[]): string => {
      interface AddressComponent {
        types: string[];
        long_name: string;
        short_name: string;
      }
      const component = components.find((c: AddressComponent) => 
        types.some(t => c.types.includes(t))
      );
      return component?.short_name || "";
    };

    const result: PlaceResult = {
      formattedAddress: place.formatted_address || "",
      street: getComponent(["route"]),
      houseNumber: getComponent(["street_number"]),
      plz: getComponent(["postal_code"]),
      city: getComponent(["locality", "political"]) || getComponent(["administrative_area_level_2"]),
      canton: getShortComponent(["administrative_area_level_1"]),
      country: getShortComponent(["country"]),
      lat: place.geometry?.location?.lat || 0,
      lng: place.geometry?.location?.lng || 0,
    };

    console.log("[google-places-details] Parsed address:", {
      street: result.street,
      houseNumber: result.houseNumber,
      plz: result.plz,
      city: result.city,
    });

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[google-places-details] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
