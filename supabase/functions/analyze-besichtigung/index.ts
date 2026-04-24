import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── SYSTEM PROMPT (German, structured JSON output) ──────────────────────────
const SYSTEM_PROMPT = `Du bist ein professioneller Umzugsberater-KI, der Fotos von Wohnungen analysiert.

Deine Aufgabe: Analysiere die Fotos und erstelle eine detaillierte Inventarliste für einen Umzug.

WICHTIG:
- Identifiziere ALLE sichtbaren Möbelstücke und Gegenstände
- Schätze für jeden Gegenstand das Volumen in Kubikmetern — sei REALISTISCH, nicht übertrieben
- Gruppiere nach Raum: Nutze die vom Kunden angegebene Raumzuordnung (siehe Foto-Zuordnung unten)
- Erkenne spezielle Gegenstände die extra Vorsicht brauchen (Klavier, Aquarium, Tresor, zerbrechliche Kunst)
- Schätze das Gesamtvolumen, die benötigte Zeit, Arbeiteranzahl und Fahrzeuggrösse

REALISTISCHE ZEITSCHÄTZUNG (sehr wichtig — überschätze NICHT):
- Basis: 1 Std. pro 8–10 m³ Volumen (inkl. Tragen, Verpacken, Einladen, Ausladen)
- Kleines Zimmer (< 15 m³): 1–2 Std. mit 2 Personen
- Grosse Wohnung (30–50 m³): 4–6 Std. mit 2 Personen
- Nur wenn Fotos aus MEHREREN Räumen vorliegen und Gesamtvolumen > 30 m³: über 4 Std.
- Etagen ohne Lift: +30 Min. pro Etage
- Spezielle Gegenstände (Klavier, Tresor): +1 Std. pro Stück

FAHRZEUGGRÖSSE nach Gesamtvolumen:
- bis 8 m³ → transporter
- 8–20 m³ → 3.5t
- 20–40 m³ → 7.5t
- 40–70 m³ → 12t
- über 70 m³ → 18t

ARBEITERANZAHL:
- bis 20 m³ → 2 Personen
- 20–40 m³ → 3 Personen
- über 40 m³ → 4 Personen

Antworte NUR als valides JSON in diesem Format:
{
  "estimated_volume_m3": <number>,
  "estimated_time_hours": <number>,
  "recommended_workers": <number>,
  "recommended_truck": "<transporter|3.5t|7.5t|12t|18t>",
  "room_breakdown": [
    {
      "room": "<Raumname auf Deutsch>",
      "volume_m3": <number>,
      "items": ["<Gegenstand 1>", "<Gegenstand 2>"]
    }
  ],
  "detected_items": [
    {
      "name": "<Name auf Deutsch>",
      "count": <number>,
      "volume_m3": <number>,
      "weight_kg": <number oder null>,
      "special": <boolean>,
      "category": "<moebel|elektronik|karton|sonstiges>"
    }
  ],
  "special_items": ["<Liste spezieller Gegenstände>"],
  "special_requirements": ["<z.B. Möbellift erforderlich, Demontage notwendig>"],
  "access_difficulty": "<einfach|mittel|schwierig>",
  "confidence": <0.0 bis 1.0>,
  "summary": "<Kurze Zusammenfassung auf Deutsch, 2-3 Sätze>"
}`;

// Room type → German display name (for AI prompt)
const ROOM_NAMES: Record<string, string> = {
  wohnzimmer: "Wohnzimmer",
  schlafzimmer: "Schlafzimmer",
  kueche: "Küche",
  badezimmer: "Badezimmer",
  kinderzimmer: "Kinderzimmer",
  buero: "Büro/Arbeitszimmer",
  keller: "Keller",
  estrich: "Estrich/Dachboden",
  garage: "Garage",
  balkon: "Balkon/Terrasse",
  flur: "Flur/Eingang",
  abstellraum: "Abstellraum",
  sonstiges: "Sonstiges",
};

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Auth: verify caller is a logged-in user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse request body ──
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-besichtigung] User ${user.id} starting analysis for session: ${session_id}`);

    // ── Fetch photos for this session ──
    const { data: photosRaw, error: photosError } = await supabase.rpc(
      "get_besichtigung_photos",
      { p_session_id: session_id }
    );

    if (photosError) {
      console.error("[analyze-besichtigung] Error fetching photos:", photosError);
      return new Response(
        JSON.stringify({ error: "Fotos konnten nicht geladen werden", details: photosError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const photoList = typeof photosRaw === "string" ? JSON.parse(photosRaw) : photosRaw;

    if (!Array.isArray(photoList) || photoList.length === 0) {
      return new Response(
        JSON.stringify({ error: "Keine Fotos vorhanden. Bitte laden Sie zuerst Fotos hoch." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-besichtigung] Found ${photoList.length} photos to analyze`);

    // ── Update session status to 'analyzing' ──
    await supabase.rpc("update_besichtigung_session_status", {
      p_session_id: session_id,
      p_status: "analyzing",
    });

    // ── Generate public URLs for each photo (bucket is public) ──
    const imageContents: Array<{ type: string; source: { type: string; url: string } }> = [];
    const roomMapping: string[] = [];

    for (const photo of photoList) {
      const { data } = supabase.storage
        .from("besichtigung-uploads")
        .getPublicUrl(photo.storage_path);

      if (!data?.publicUrl) {
        console.warn(`[analyze-besichtigung] Skipping photo ${photo.id}: no public URL`);
        continue;
      }

      const roomName = ROOM_NAMES[photo.room_type || "sonstiges"] ?? "Sonstiges";
      roomMapping.push(roomName);

      imageContents.push({
        type: "image",
        source: { type: "url", url: data.publicUrl },
      });
    }

    if (imageContents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Fotos konnten nicht aus dem Speicher geladen werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-besichtigung] Sending ${imageContents.length} images to Claude claude-sonnet-4-20250514`);

    // ── Call Anthropic Claude claude-sonnet-4-20250514 Vision ──
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `Bitte analysiere diese ${imageContents.length} Foto(s) einer Wohnung für einen Umzug. Identifiziere alle Möbelstücke und Gegenstände und erstelle eine vollständige Inventarliste als JSON.`,
                  "",
                  "**Raumzuordnung vom Kunden (bitte für room_breakdown verwenden):**",
                  roomMapping.map((r, i) => `Foto ${i + 1} = ${r}`).join(", "),
                ].join("\n"),
              },
              ...imageContents,
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error(`[analyze-besichtigung] Anthropic error ${anthropicResponse.status}:`, errorText);
      // Revert status
      await supabase.rpc("update_besichtigung_session_status", {
        p_session_id: session_id,
        p_status: "uploaded",
      });
      return new Response(
        JSON.stringify({ error: "AI-Analyse fehlgeschlagen", details: `Anthropic ${anthropicResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicResult = await anthropicResponse.json();
    const aiContent = anthropicResult.content?.[0]?.text || "";

    console.log("[analyze-besichtigung] Claude response received, parsing...");

    // ── Parse structured JSON from AI response ──
    let analysisData;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      analysisData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("[analyze-besichtigung] JSON parse failed:", parseError.message);
      // Revert status
      await supabase.rpc("update_besichtigung_session_status", {
        p_session_id: session_id,
        p_status: "uploaded",
      });
      return new Response(
        JSON.stringify({ error: "AI-Antwort konnte nicht verarbeitet werden", raw: aiContent }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Save analysis to DB ──
    const { data: saveResult, error: saveError } = await supabase.rpc(
      "save_besichtigung_analysis",
      {
        p_session_id: session_id,
        p_estimated_volume_m3: analysisData.estimated_volume_m3 ?? null,
        p_estimated_time_hours: analysisData.estimated_time_hours ?? null,
        p_recommended_workers: analysisData.recommended_workers ?? null,
        p_recommended_truck: analysisData.recommended_truck ?? null,
        p_room_breakdown: JSON.stringify(analysisData.room_breakdown || []),
        p_detected_items: JSON.stringify(analysisData.detected_items || []),
        p_special_items: analysisData.special_items || [],
        p_special_requirements: analysisData.special_requirements || [],
        p_from_access_difficulty: analysisData.access_difficulty ?? null,
        p_confidence: analysisData.confidence ?? null,
        p_raw_response: JSON.stringify(anthropicResult),
      }
    );

    if (saveError) {
      console.error("[analyze-besichtigung] DB save error:", saveError);
      return new Response(
        JSON.stringify({ error: "Analyse konnte nicht gespeichert werden", details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[analyze-besichtigung] Analysis saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          estimated_volume_m3: analysisData.estimated_volume_m3,
          estimated_time_hours: analysisData.estimated_time_hours,
          recommended_workers: analysisData.recommended_workers,
          recommended_truck: analysisData.recommended_truck,
          room_breakdown: analysisData.room_breakdown,
          detected_items: analysisData.detected_items,
          special_items: analysisData.special_items,
          special_requirements: analysisData.special_requirements,
          access_difficulty: analysisData.access_difficulty,
          confidence: analysisData.confidence,
          summary: analysisData.summary,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[analyze-besichtigung] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Unerwarteter Fehler", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
