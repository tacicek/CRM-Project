import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SPELL_CHECK_LOCALES,
  buildSpellCheckSystemPrompt,
  isSpellCheckLocale,
} from "../_shared/spellCheckPrompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const locale = body?.locale;

    // Die Sprache ist Pflicht und wird NICHT geraten. Bis 2026-08-28 kam sie gar
    // nicht an, und der Prompt war fest deutsch: eine franzoesische Offerte lief
    // durch `ß → ss` und die deutsche Substantivgrossschreibung. Ein fehlender
    // Wert als "dann eben Deutsch" zu lesen, ist genau dieser Fehler in klein.
    if (!isSpellCheckLocale(locale)) {
      return new Response(
        JSON.stringify({
          error: "Dokumentsprache fehlt oder ist nicht unterstützt",
          supported: SPELL_CHECK_LOCALES,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return new Response(
        JSON.stringify({ success: true, result: { fields: {}, hasCorrections: false } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sprache und Feldanzahl ins Protokoll, Inhalt NICHT: das hier sind
    // Kundentexte aus Offerten. `console.error` wie an den anderen Stellen
    // dieser Datei — Deno schreibt beides in denselben Strom, und ein zweiter
    // Kanal fuer eine Zeile waere nur eine weitere Konvention.
    console.error(`[spell-check-ai] locale=${locale} fields=${Object.keys(fields).length}`);

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
        system: buildSpellCheckSystemPrompt(locale),
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
