import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardAntwortHeaders, guardPaidApiCall } from "../_shared/paidApiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Zod Schemas für verschiedene Location-Formate
const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const AddressSchema = z.object({
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  plz: z.string().regex(/^\d{4}$/, "PLZ muss 4 Ziffern haben"),
  city: z.string().min(1),
});

const LocationSchema = z.union([
  z.string().min(1).max(500), // Address string or PLZ
  CoordinatesSchema,
  AddressSchema,
]);

const DistanceRequestSchema = z.object({
  origin: LocationSchema,
  destination: LocationSchema,
  mode: z.enum(["driving", "walking", "bicycling", "transit"]).default("driving"),
});

interface DistanceResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
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
        bucket: "google-distance",
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
        log: (n, f) => console.error(`[calculate-distance] ${n}`, f ?? {}),
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
    const parseResult = DistanceRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error("[calculate-distance] Validation error:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: "Ungültige Eingabedaten",
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { origin, destination, mode } = parseResult.data;

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }

    // Format origin and destination
    const formatLocation = (loc: string | { plz?: string; city?: string; street?: string }): string => {
      if (typeof loc === "string") {
        // If it's a PLZ, append Switzerland
        if (/^\d{4}$/.test(loc)) {
          return `${loc}, Schweiz`;
        }
        return loc;
      }
      if (loc.lat && loc.lng) {
        return `${loc.lat},${loc.lng}`;
      }
      if (loc.plz && loc.city) {
        return `${loc.street || ""} ${loc.houseNumber || ""}, ${loc.plz} ${loc.city}, Schweiz`.trim();
      }
      throw new Error("Invalid location format");
    };

    const originStr = formatLocation(origin);
    const destinationStr = formatLocation(destination);

    console.log("[calculate-distance] Calculating distance:", { origin: originStr, destination: destinationStr, mode });

    // Use Google Distance Matrix API
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", originStr);
    url.searchParams.set("destinations", destinationStr);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("mode", mode);
    url.searchParams.set("language", "de");
    url.searchParams.set("units", "metric");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[calculate-distance] API error:", data.status, data.error_message);
      throw new Error(`Google Distance Matrix API error: ${data.status}`);
    }

    const element = data.rows?.[0]?.elements?.[0];
    
    if (!element || element.status !== "OK") {
      console.error("[calculate-distance] No route found:", element?.status);
      throw new Error("Keine Route gefunden");
    }

    const result: DistanceResult = {
      distanceKm: Math.round((element.distance.value / 1000) * 10) / 10,
      distanceText: element.distance.text,
      durationMinutes: Math.round(element.duration.value / 60),
      durationText: element.duration.text,
    };

    console.log("[calculate-distance] Result:", result);

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-distance] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
