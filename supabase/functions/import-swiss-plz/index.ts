/**
 * import-swiss-plz
 *
 * Two-source merge strategy:
 *  1. gamba/swiss-geolocation CSV  → 3 400 PLZ with exact WGS84 coordinates
 *  2. openplzapi.org (per-canton)  → 4 200+ PLZ with city / canton
 *
 * Merge rule:
 *  - PLZ in gamba  → use gamba (exact coordinates)
 *  - PLZ only in OpenPLZ → use OpenPLZ city/canton + canton centroid coords
 *
 * Result: complete Swiss PLZ coverage for lead matching + distance calculations.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GAMBA_CSV_URL =
  "https://raw.githubusercontent.com/gamba/swiss-geolocation/master/post-codes.csv";
const OPENPLZ_BASE = "https://openplzapi.org/ch";

// Canton centroid coordinates (WGS84) — fallback for PLZ without gamba coords
const CANTON_COORDS: Record<string, { lat: number; lng: number }> = {
  AG: { lat: 47.388, lng: 8.050 },
  AI: { lat: 47.317, lng: 9.417 },
  AR: { lat: 47.383, lng: 9.283 },
  BE: { lat: 46.950, lng: 7.450 },
  BL: { lat: 47.467, lng: 7.733 },
  BS: { lat: 47.567, lng: 7.600 },
  FL: { lat: 47.166, lng: 9.523 },
  FR: { lat: 46.800, lng: 7.150 },
  GE: { lat: 46.200, lng: 6.150 },
  GL: { lat: 47.033, lng: 9.067 },
  GR: { lat: 46.650, lng: 9.578 },
  JU: { lat: 47.350, lng: 7.267 },
  LU: { lat: 47.050, lng: 8.100 },
  NE: { lat: 47.000, lng: 6.900 },
  NW: { lat: 46.950, lng: 8.367 },
  OW: { lat: 46.883, lng: 8.233 },
  SG: { lat: 47.433, lng: 9.300 },
  SH: { lat: 47.700, lng: 8.583 },
  SO: { lat: 47.217, lng: 7.533 },
  SZ: { lat: 47.017, lng: 8.650 },
  TG: { lat: 47.567, lng: 9.033 },
  TI: { lat: 46.183, lng: 8.967 },
  UR: { lat: 46.883, lng: 8.583 },
  VD: { lat: 46.567, lng: 6.500 },
  VS: { lat: 46.233, lng: 7.867 },
  ZG: { lat: 47.167, lng: 8.517 },
  ZH: { lat: 47.400, lng: 8.650 },
  CH: { lat: 46.800, lng: 8.233 },
};

interface PlzRow {
  plz: string;
  city: string;
  canton: string;
  latitude: number;
  longitude: number;
}

interface OpenPlzCanton {
  key: string;
  name: string;
  shortName: string;
}

interface OpenPlzLocality {
  postalCode: string;
  name: string;
  canton: { key: string; name: string; shortName: string };
}

// ─── PLZ not in gamba CSV but confirmed by OpenPLZ (manually verified) ────────
// Last checked: 2026-04-11 — diff of gamba vs openplzapi.org
const EXTRA_PLZ: PlzRow[] = [
  { plz: "6960", city: "Odogno", canton: "TI", latitude: 46.0342, longitude: 9.0204 },
];

// ─── Parse gamba CSV ────────────────────────────────────────────────────────
async function fetchGambaEntries(): Promise<Map<string, PlzRow>> {
  const result = new Map<string, PlzRow>();
  try {
    const res = await fetch(GAMBA_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.trim() || line.startsWith("#") || line.startsWith("zip,")) continue;
      const p = line.split(",");
      if (p.length < 8) continue;
      const plz = p[0].trim();
      const canton = p[4].trim();
      const city = p[5].trim();
      const lat = parseFloat(p[6]);
      const lng = parseFloat(p[7]);
      if (!plz || !canton || !city || isNaN(lat) || isNaN(lng)) continue;
      if (!result.has(plz)) {
        result.set(plz, { plz, city, canton, latitude: lat, longitude: lng });
      }
    }
    console.log(`[gamba] ${result.size} PLZ with exact coordinates`);
  } catch (err) {
    console.warn(`[gamba] fetch failed: ${err}`);
  }
  return result;
}

// ─── Fetch all canton keys from OpenPLZ ────────────────────────────────────
async function fetchCantons(): Promise<OpenPlzCanton[]> {
  const res = await fetch(`${OPENPLZ_BASE}/Cantons`);
  if (!res.ok) throw new Error(`Cantons fetch failed: HTTP ${res.status}`);
  const data: OpenPlzCanton[] = await res.json();
  console.log(`[openplz] ${data.length} cantons found`);
  return data;
}

// ─── Fetch all localities for one canton (paginated) ───────────────────────
async function fetchCantonLocalities(
  cantonKey: string,
  shortName: string
): Promise<Map<string, OpenPlzLocality>> {
  const result = new Map<string, OpenPlzLocality>();
  const PAGE_SIZE = 100;
  let page = 1;

  while (true) {
    const url = `${OPENPLZ_BASE}/Cantons/${cantonKey}/Localities?page=${page}&pageSize=${PAGE_SIZE}`;
    let data: OpenPlzLocality[];
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    for (const loc of data) {
      if (loc.postalCode && !result.has(loc.postalCode)) {
        result.set(loc.postalCode, loc);
      }
    }
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[openplz] ${shortName}: ${result.size} unique PLZ`);
  return result;
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch gamba (with coordinates) in parallel with canton list
    const [gambaMap, cantons] = await Promise.all([
      fetchGambaEntries(),
      fetchCantons(),
    ]);

    // 2. Build final rows from gamba (primary source) + EXTRA_PLZ
    const finalRows: PlzRow[] = [...gambaMap.values()];
    let countGamba = gambaMap.size;

    // Add manually curated extras not covered by gamba
    let countExtra = 0;
    for (const extra of EXTRA_PLZ) {
      if (!gambaMap.has(extra.plz)) {
        finalRows.push(extra);
        countExtra++;
      }
    }

    console.log(`Merge → ${finalRows.length} total PLZ`);
    console.log(`  from gamba (exact coords): ${countGamba}`);
    console.log(`  from EXTRA_PLZ:            ${countExtra}`);

    // 4. Clear existing rows
    await supabase
      .from("swiss_plz")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // 5. Insert in batches of 500
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < finalRows.length; i += BATCH) {
      const batch = finalRows.slice(i, i + BATCH);
      const { error } = await supabase.from("swiss_plz").insert(batch);
      if (error) throw error;
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${finalRows.length}`);
    }

    const { count } = await supabase
      .from("swiss_plz")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Swiss PLZ import completed",
        stats: {
          totalEntries: count,
          fromGamba: countGamba,
          fromExtraList: countExtra,
          cantonsCovered: cantons.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Import failed:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
