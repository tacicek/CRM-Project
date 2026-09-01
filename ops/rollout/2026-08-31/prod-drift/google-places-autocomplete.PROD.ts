import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod Schema für Input-Validierung
const AutocompleteRequestSchema = z.object({
  input: z.string().min(3, "Mindestens 3 Zeichen erforderlich").max(500, "Eingabe zu lang"),
  country: z.string().length(2, "Ländercode muss 2 Zeichen haben").default("ch"),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validiere Input mit Zod
    const parseResult = AutocompleteRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.log("[google-places-autocomplete] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ predictions: [], error: parseResult.error.flatten().fieldErrors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { input, country } = parseResult.data;

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }

    // Use Google Places Autocomplete API
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("types", "address");
    url.searchParams.set("components", `country:${country}`);
    url.searchParams.set("language", "de");

    console.log("[google-places-autocomplete] Fetching predictions for:", input);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[google-places-autocomplete] API error:", data.status, data.error_message);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    console.log("[google-places-autocomplete] Found", data.predictions?.length || 0, "predictions");

    return new Response(
      JSON.stringify({ predictions: data.predictions || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[google-places-autocomplete] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
