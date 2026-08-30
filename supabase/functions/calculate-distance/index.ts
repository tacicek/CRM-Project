import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bearbeitePaidApiAnfrage,
  type EndpunktVertrag,
  type PaidApiUmgebung,
} from "../_shared/paidApiHttp.ts";

/**
 * Entfernung zweier Adressen — ein BEZAHLTER Google-Aufruf je Anfrage.
 *
 * Bis 2026-08-28 stand hier ein Zaehler in einer `Map` im Modulkoerper und
 * sonst nichts: kein Token, keine Firma. Der Edge-Router erzeugt je Anfrage
 * einen eigenen Worker, also war die `Map` immer leer und die Drossel
 * wirkungslos — gemessen: 61 Anfragen, null 429. Anonym erreichbar zu bleiben
 * waere ohnehin falsch gewesen; alle Aufrufer liegen hinter /firma.
 *
 * Reihenfolge und Fehlerklassen liegen in `_shared/paidApiHttp.ts`. Hier bleibt,
 * was diesem Endpunkt gehoert: Schema, URL, Auswertung.
 */

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

const LocationSchema = z.union([z.string().min(1).max(500), CoordinatesSchema, AddressSchema]);

const DistanceRequestSchema = z.object({
  origin: LocationSchema,
  destination: LocationSchema,
  mode: z.enum(["driving", "walking", "bicycling", "transit"]).default("driving"),
});

type DistanceRequest = z.infer<typeof DistanceRequestSchema>;

export interface DistanceResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
}

const alsOrt = (ort: DistanceRequest["origin"]): string => {
  if (typeof ort === "string") return ort;
  if ("lat" in ort) return `${ort.lat},${ort.lng}`;
  return [ort.street, ort.houseNumber, ort.plz, ort.city, "Schweiz"].filter(Boolean).join(" ");
};

export const distanzVertrag = (
  apiKey: string | undefined,
): EndpunktVertrag<DistanceRequest, DistanceResult> => ({
  name: "calculate-distance",
  bucket: "google-distance",

  pruefeNutzlast: (roh) => {
    const r = DistanceRequestSchema.safeParse(roh);
    return r.success ? r.data : null;
  },

  baueUrl: (n) => {
    if (!apiKey) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", alsOrt(n.origin));
    url.searchParams.set("destinations", alsOrt(n.destination));
    url.searchParams.set("mode", n.mode);
    url.searchParams.set("units", "metric");
    url.searchParams.set("language", "de");
    url.searchParams.set("key", apiKey);
    return url.toString();
  },

  werteAus: (daten) => {
    const d = daten as {
      status?: string;
      rows?: Array<{ elements?: Array<{ status?: string; distance?: { value: number; text: string }; duration?: { value: number; text: string } }> }>;
    };
    if (d?.status !== "OK") return null;
    const el = d.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK" || !el.distance || !el.duration) return null;
    return {
      distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
      distanceText: el.distance.text,
      durationMinutes: Math.round(el.duration.value / 60),
      durationText: el.duration.text,
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
    // Nur Betriebsereignisse. Keine Adresse, kein Suchtext, keine Kennung.
    log: (ereignis, felder) => console.error(JSON.stringify({ ereignis, ...(felder ?? {}) })),
  };
};

serve((req) =>
  bearbeitePaidApiAnfrage(
    req,
    distanzVertrag(Deno.env.get("GOOGLE_MAPS_API_KEY")),
    produktionsUmgebung(),
  ),
);
