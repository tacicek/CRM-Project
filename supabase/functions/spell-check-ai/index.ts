import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a German spell checker for Swiss business documents.
Correct spelling, capitalization, and punctuation errors in the provided text.
Rules:
- Swiss German standard: replace ß with ss
- Fix obvious spelling mistakes
- Fix capitalization (German nouns must be capitalized)
- Fix punctuation where clearly missing
- Fix time format (e.g. "08 uhr" → "08:00 Uhr")
- Do NOT change proper nouns (names, street names, cities)
- Do NOT change the meaning or rewrite sentences
- Do NOT translate anything
- Return ONLY a JSON object, no explanation, no markdown:
  { "fields": { "fieldName": "corrected text", ... }, "hasCorrections": true/false }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const fields = body?.fields;

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return new Response(
        JSON.stringify({ success: true, result: { fields: {}, hasCorrections: false } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.error("[spell-check-ai] ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI-Service nicht konfiguriert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMessage = JSON.stringify({ fields });

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("[spell-check-ai] Claude API error:", claudeRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Claude API-Fehler" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text ?? "";

    let result: { fields: Record<string, string>; hasCorrections: boolean };
    try {
      // Strip potential markdown code fences
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[spell-check-ai] Failed to parse Claude response:", rawText);
      return new Response(
        JSON.stringify({ error: "Ungültige AI-Antwort" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[spell-check-ai] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
