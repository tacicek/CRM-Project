import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
    const rawBody = await req.json();
    
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
