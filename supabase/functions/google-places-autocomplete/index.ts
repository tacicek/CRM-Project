import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bearbeitePaidApiAnfrage,
  type EndpunktVertrag,
  type PaidApiUmgebung,
} from "../_shared/paidApiHttp.ts";
import { erstelleTokenPruefung } from "../_shared/paidApiGuard.ts";

/**
 * Adressvorschlaege — ein BEZAHLTER Google-Aufruf je Tastendruck-Runde.
 *
 * Dieser Endpunkt verlangt seit 2026-08-28 ein geprueftes JWT UND die
 * Mitgliedschaft in der genannten Firma. Ein frueherer Kommentar nannte ihn
 * einen "unauthentifizierten Proxy" — das war einmal richtig und ist es nicht
 * mehr; Prosa, die ein altes Sicherheitsmodell festhaelt, ist schlimmer als
 * keine.
 */

const AutocompleteRequestSchema = z.object({
  input: z.string().min(3, "Mindestens 3 Zeichen erforderlich").max(500, "Eingabe zu lang"),
  country: z.string().length(2, "Laendercode muss 2 Zeichen haben").default("ch"),
});

type AutocompleteRequest = z.infer<typeof AutocompleteRequestSchema>;

export interface Vorschlag {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text: string };
}

export const autocompleteVertrag = (
  apiKey: string | undefined,
): EndpunktVertrag<AutocompleteRequest, { predictions: Vorschlag[] }> => ({
  name: "google-places-autocomplete",
  bucket: "google-places",

  pruefeNutzlast: (roh) => {
    const r = AutocompleteRequestSchema.safeParse(roh);
    return r.success ? r.data : null;
  },

  baueUrl: (n) => {
    if (!apiKey) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", n.input);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("types", "address");
    url.searchParams.set("components", `country:${n.country}`);
    url.searchParams.set("language", "de");
    return url.toString();
  },

  werteAus: (daten) => {
    const d = daten as { status?: string; predictions?: Vorschlag[] };
    // ZERO_RESULTS ist kein Fehler, sondern eine leere Liste.
    if (d?.status === "ZERO_RESULTS") return { predictions: [] };
    if (d?.status !== "OK" || !Array.isArray(d.predictions)) return null;
    return { predictions: d.predictions };
  },
});

const produktionsUmgebung = (): PaidApiUmgebung => {
  const dienst = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return {
    // Ein abgelehntes Token ist 401, ein gestoerter Anmeldedienst 503.
    // `erstelleTokenPruefung` haelt diese Unterscheidung an einer Stelle.
    verifyToken: erstelleTokenPruefung(dienst),
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
    autocompleteVertrag(Deno.env.get("GOOGLE_MAPS_API_KEY")),
    produktionsUmgebung(),
  ),
);
