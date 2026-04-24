import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// LLM Provider Types
type LLMProvider = "openai" | "anthropic" | "google";

interface LLMModelConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  modelId: string;
  maxTokens: number;
}

// Available models configuration
const LLM_MODELS: Record<string, LLMModelConfig> = {
  // ===== OpenAI Models =====
  "gpt-5.2": {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    modelId: "gpt-5.2",
    maxTokens: 4096,
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    maxTokens: 4096,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    maxTokens: 4096,
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    modelId: "gpt-4-turbo",
    maxTokens: 4096,
  },

  // ===== Anthropic Models =====
  "claude-opus-4-5": {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    modelId: "claude-opus-4-5-20251101",
    maxTokens: 4096,
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
  },
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    maxTokens: 4096,
  },
  "claude-3-opus": {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "anthropic",
    modelId: "claude-3-opus-20240229",
    maxTokens: 4096,
  },
  "claude-3-haiku": {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    modelId: "claude-3-haiku-20240307",
    maxTokens: 4096,
  },

  // ===== Google Models =====
  "gemini-3-pro": {
    id: "gemini-3-pro",
    name: "Gemini 3.0 Pro",
    provider: "google",
    modelId: "gemini-3.0-pro",
    maxTokens: 4096,
  },
  "gemini-2-0-flash": {
    id: "gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    modelId: "gemini-2.0-flash-exp",
    maxTokens: 4096,
  },
  "gemini-1-5-pro": {
    id: "gemini-1-5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    modelId: "gemini-1.5-pro",
    maxTokens: 4096,
  },
  "gemini-1-5-flash": {
    id: "gemini-1-5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    modelId: "gemini-1.5-flash",
    maxTokens: 4096,
  },
};

const DEFAULT_MODEL = "gpt-5.2";
const FALLBACK_MODEL = "gpt-4o";

interface GenerationRequest {
  service_type: string;
  location?: string;
  canton?: string;
  section?: "all" | "hero" | "seo" | "content" | "faq";
  custom_prompt?: string;
  language?: string;
  model_id?: string;
}

const SERVICE_PROMPTS: Record<string, { name: string; keywords: string[] }> = {
  umzug: {
    name: "Umzug",
    keywords: ["Umzug Offerten vergleichen", "Umzugsfirma finden", "Umzugskosten vergleichen", "günstige Umzugsfirma", "Privatumzug Offerte", "Firmenumzug Offerten"],
  },
  reinigung: {
    name: "Reinigung",
    keywords: ["Reinigung Offerten vergleichen", "Endreinigung Offerte", "Umzugsreinigung Kosten", "Wohnungsreinigung Preise", "Reinigungsfirma finden", "Abnahmegarantie"],
  },
  renovation: {
    name: "Renovation",
    keywords: ["Renovation Offerten vergleichen", "Renovationskosten", "Wohnungsrenovation Offerte", "Malerarbeiten Preise", "Sanierung Kosten", "Umbau Offerten"],
  },
  entsorgung: {
    name: "Entsorgung",
    keywords: ["Entsorgung Offerten vergleichen", "Entrümpelung Kosten", "Räumung Offerte", "Haushaltsauflösung Preise", "Sperrmüll Entsorgung", "Altmöbel entsorgen"],
  },
  malerarbeit: {
    name: "Malerarbeit",
    keywords: ["Maler Offerten vergleichen", "Malerarbeiten Kosten", "Anstrich Offerte", "Tapezieren Preise", "Fassadenanstrich Offerten", "Maler finden"],
  },
  usm_transport: {
    name: "USM Transport",
    keywords: ["USM Transport Offerten", "USM Möbel Transport Kosten", "USM Haller Umzug", "Designmöbel Transport Preise", "Büromöbel Transport", "Spezialumzug Offerte"],
  },
  wasserbett_transport: {
    name: "Wasserbett Transport",
    keywords: ["Wasserbett Transport Offerten", "Wasserbett Umzug Kosten", "Wasserbett Abbau Aufbau", "Spezialtransport Preise", "Bettentransport Offerte"],
  },
  moving: {
    name: "Umzug",
    keywords: ["Umzug Offerten vergleichen", "Umzugsfirma finden", "Umzugskosten", "günstige Umzugsfirma"],
  },
  cleaning: {
    name: "Reinigung",
    keywords: ["Reinigung Offerten vergleichen", "Endreinigung Offerte", "Reinigungsfirma finden", "Wohnungsreinigung Preise"],
  },
  disposal: {
    name: "Entsorgung",
    keywords: ["Entsorgung Offerten vergleichen", "Entrümpelung Kosten", "Räumung Offerte"],
  },
  storage: {
    name: "Lagerung",
    keywords: ["Lagerung Offerten vergleichen", "Möbellager Kosten", "Einlagerung Preise", "Self-Storage Offerte"],
  },
  transport: {
    name: "Transport",
    keywords: ["Transport Offerten vergleichen", "Möbeltransport Kosten", "Klaviertransport Preise", "Spezialtransport Offerte"],
  },
  painting: {
    name: "Malerarbeiten",
    keywords: ["Maler Offerten vergleichen", "Malerarbeiten Kosten", "Anstrich Preise", "Maler finden"],
  },
  other: {
    name: "Dienstleistung",
    keywords: ["Offerten vergleichen", "Handwerker finden", "Dienstleister Offerte", "kostenlos Offerten"],
  },
};

// Call OpenAI API
async function callOpenAI(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  console.log("Calling OpenAI with model:", modelId);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error (${response.status}):`, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

// Call Anthropic API
async function callAnthropic(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  console.log("Calling Anthropic with model:", modelId);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Anthropic API error (${response.status}):`, errorText);
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "";
}

// Call Google Gemini API
async function callGemini(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  console.log("Calling Gemini with model:", modelId);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error (${response.status}):`, errorText);
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Get API key for provider
function getApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case "openai":
      return Deno.env.get("OPENAI_API_KEY");
    case "anthropic":
      return Deno.env.get("ANTHROPIC_API_KEY");
    case "google":
      return Deno.env.get("GOOGLE_AI_API_KEY");
    default:
      return undefined;
  }
}

// Generate content using selected model
async function generateContent(
  modelConfig: LLMModelConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; usedModel: string }> {
  const apiKey = getApiKey(modelConfig.provider);

  if (!apiKey) {
    // If API key is missing for the requested model, try fallback immediately if different provider
    console.warn(`API key missing for ${modelConfig.provider}.`);
    throw new Error(`API Key für ${modelConfig.provider} fehlt.`);
  }

  try {
    let content = "";
    switch (modelConfig.provider) {
      case "openai":
        content = await callOpenAI(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
        break;
      case "anthropic":
        content = await callAnthropic(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
        break;
      case "google":
        content = await callGemini(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
        break;
      default:
        throw new Error(`Unknown provider: ${modelConfig.provider}`);
    }
    return { content, usedModel: modelConfig.name };

  } catch (error) {
    console.error(`Error with model ${modelConfig.name}:`, error);

    // If it's a model not found error (404/400) or similar, try fallback
    const errorMsg = error.message || "";
    if (errorMsg.includes("404") || errorMsg.includes("400") || errorMsg.includes("model_not_found")) {
      console.log(`Attempting fallback to ${FALLBACK_MODEL}...`);

      const fallbackConfig = LLM_MODELS[FALLBACK_MODEL];
      const fallbackApiKey = getApiKey(fallbackConfig.provider);

      if (fallbackApiKey && fallbackConfig.id !== modelConfig.id) {
        // Only try fallback if it's a different model
        const fallbackContent = await callOpenAI(
          fallbackApiKey,
          fallbackConfig.modelId,
          systemPrompt,
          userPrompt,
          fallbackConfig.maxTokens
        );
        return {
          content: fallbackContent,
          usedModel: `${fallbackConfig.name} (Fallback von ${modelConfig.name})`
        };
      }
    }

    throw error; // Re-throw if fallback not possible or failed
  }
}

// Rate limit: max 20 requests per user per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify caller is an authenticated admin/staff user
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "").replace("bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin/staff role
    const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: user.id });
    if (!isStaff) {
      return new Response(
        JSON.stringify({ error: "Admin or staff access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit by user ID
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more content." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-landing-page-content] Authorized:", user.email, "| Remaining:", rateCheck.remaining);

    const {
      service_type,
      location,
      canton,
      section = "all",
      custom_prompt,
      language = "de",
      model_id = DEFAULT_MODEL
    }: GenerationRequest = await req.json();

    if (!service_type) {
      return new Response(
        JSON.stringify({ error: "service_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get model configuration - fallback to default if invalid
    let modelConfig = LLM_MODELS[model_id];
    if (!modelConfig) {
      console.log(`Model ${model_id} not found, falling back to ${DEFAULT_MODEL}`);
      modelConfig = LLM_MODELS[DEFAULT_MODEL];
    }

    console.log("Using model:", modelConfig.name, "(", modelConfig.modelId, ")");

    const serviceInfo = SERVICE_PROMPTS[service_type] || { name: service_type, keywords: [] };
    const locationStr = location ? ` in ${location}${canton ? `, ${canton}` : ""}` : "";

    // Build the system prompt
    const systemPrompt = `Du bist ein SEO-Experte und Content-Writer für Offerio.ch - das führende Schweizer OFFERTE-VERGLEICHSPORTAL.

WICHTIG - ÜBER OFFERIO.CH:
- Offerio ist KEIN Dienstleister/Umzugsfirma/Reinigungsfirma - wir sind ein VERGLEICHSPORTAL
- Kunden stellen eine KOSTENLOSE Anfrage und erhalten mehrere Offerten von geprüften Partnerfirmen
- Der Service für Endkunden ist 100% KOSTENLOS und UNVERBINDLICH
- Wir vermitteln zwischen Kunden und qualifizierten Schweizer Fachfirmen
- USP: "Mehrere Offerten vergleichen, Zeit & Geld sparen"

SCHREIBSTIL:
- Verwende formelle Anrede (Sie)
- Schreibe für Schweizer Kunden die Offerten vergleichen wollen
- Erwähne lokale Vorteile wenn ein Standort angegeben ist
- Verwende Schweizer Schreibweisen (z.B. "Offerte" statt "Angebot")
- Betone immer: kostenlos, unverbindlich, mehrere Offerten, vergleichen, Zeit sparen
- NIEMALS so schreiben als wären WIR die Umzugsfirma/Reinigungsfirma etc.
- Sei konkret und vertrauenswürdig`;

    let userPrompt = "";

    if (section === "all" || section === "hero") {
      userPrompt += `
### HERO SECTION
Generiere für "${serviceInfo.name}${locationStr}" - als VERGLEICHSPORTAL (nicht als Dienstleister!):
1. hero_title: Kraftvoller H1-Titel (max 60 Zeichen) - z.B. "${serviceInfo.name} Offerten vergleichen${locationStr}"
2. hero_subtitle: Kurzer Untertitel mit USP (max 80 Zeichen) - betone: kostenlos, mehrere Offerten, vergleichen
3. hero_description: 2-3 Sätze über das Vergleichen von Offerten (max 200 Zeichen) - NICHT über uns als Firma
`;
    }

    if (section === "all" || section === "seo") {
      userPrompt += `
### SEO SECTION
Generiere für "${serviceInfo.name}${locationStr}" - als VERGLEICHSPORTAL:
1. seo_title: SEO-optimierter Seitentitel (50-60 Zeichen) 
   - Muster: "${serviceInfo.name} Offerten vergleichen${locationStr} | Offerio.ch"
   - Keywords: vergleichen, Offerten, kostenlos
2. seo_description: Meta-Beschreibung (150-160 Zeichen)
   - Betone: kostenlos Offerten vergleichen, mehrere Anbieter, unverbindlich
   - Call-to-Action: "Jetzt kostenlos Offerten einholen!"
3. seo_keywords: Array mit 8-10 relevanten Keywords:
   - Vergleichs-Keywords: "${serviceInfo.name} vergleichen", "${serviceInfo.name} Offerten", "kostenlos Offerten"
   - Lokale Keywords${locationStr ? `: "${serviceInfo.name} ${location}"` : ""}
   - Service-Keywords: ${serviceInfo.keywords.join(", ")}
`;
    }

    if (section === "all" || section === "content") {
      userPrompt += `
### CONTENT SECTIONS
Generiere für "${serviceInfo.name}${locationStr}" drei Inhaltsabschnitte als JSON-Array - ALS VERGLEICHSPORTAL:

1. Einführungstext (type: "text_block"):
   - title: z.B. "${serviceInfo.name} Offerten vergleichen${locationStr}" 
   - content: 2-3 Absätze HTML-Text über:
     * Warum Offerten vergleichen wichtig ist
     * Wie Offerio hilft (kostenlos, unverbindlich, mehrere geprüfte Firmen)
     * Lokale Vorteile${locationStr ? ` für ${location}` : ""}
   - NICHT schreiben als wären wir selbst eine ${serviceInfo.name}firma!

2. Vorteile des Vergleichsportals (type: "feature_grid"):
   - title: "Ihre Vorteile mit Offerio" oder "Warum Offerten vergleichen?"
   - features: Array mit 6 Vorteilen des VERGLEICHENS, z.B.:
     * Kostenlos & unverbindlich
     * Mehrere Offerten auf einen Blick
     * Geprüfte Partnerfirmen
     * Zeit & Geld sparen
     * Lokale Anbieter${locationStr ? ` aus ${location}` : ""}
     * Keine versteckten Kosten
   
3. Prozess (type: "process_steps"):
   - title: "So einfach funktioniert's"
   - steps: Array mit 4 Schritten:
     1. Anfrage stellen (kostenlos)
     2. Offerten erhalten (von mehreren Firmen)
     3. Vergleichen & auswählen
     4. Auftrag vergeben
`;
    }

    if (section === "all" || section === "faq") {
      userPrompt += `
### FAQ SECTION
Generiere 5 häufig gestellte Fragen für "${serviceInfo.name}${locationStr}" - aus Sicht eines VERGLEICHSPORTALS:
- Fragen die Kunden haben wenn sie Offerten vergleichen wollen
- Ausführliche, hilfreiche Antworten (je 2-3 Sätze als HTML)
- Mögliche Themen:
  * "Ist der Service wirklich kostenlos?" (Ja, für Kunden 100% kostenlos)
  * "Wie viele Offerten erhalte ich?" (Mehrere von geprüften Partnern)
  * "Wie lange dauert es bis ich Offerten erhalte?"
  * "Sind die Partnerfirmen geprüft?"
  * "Muss ich eine Offerte annehmen?" (Nein, unverbindlich)
  * "Was kostet ein ${serviceInfo.name}${locationStr}?" (Variiert, darum vergleichen!)
`;
    }

    if (custom_prompt) {
      userPrompt += `\n### ZUSÄTZLICHE ANWEISUNGEN\n${custom_prompt}\n`;
    }

    userPrompt += `
### FORMAT
Antworte NUR mit einem validen JSON-Objekt. Kein Markdown, keine Erklärungen.
Struktur:
{
  "hero_title": "...",
  "hero_subtitle": "...",
  "hero_description": "...",
  "seo_title": "...",
  "seo_description": "...",
  "seo_keywords": ["..."],
  "content_sections": [...],
  "faq": [{"question": "...", "answer": "..."}]
}
`;

    console.log("Generating content for:", { service_type, location, section, model: modelConfig.id });

    // Generate content using selected model (with fallback)
    const result = await generateContent(modelConfig, systemPrompt, userPrompt);
    const content = result.content;
    const modelUsed = result.usedModel;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate the JSON response
    let parsedContent;
    try {
      // Remove potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response",
          raw_content: content.substring(0, 1000)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate slug suggestion
    const suggestedSlug = location
      ? `${serviceInfo.name.toLowerCase()}-${location.toLowerCase()}`.replace(/[^a-z0-9]+/g, "-")
      : `${serviceInfo.name.toLowerCase()}`.replace(/[^a-z0-9]+/g, "-");

    return new Response(
      JSON.stringify({
        success: true,
        model_used: modelUsed,
        generated: {
          ...parsedContent,
          suggested_slug: suggestedSlug,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Critical Error in Edge Function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred in the Edge Function",
        details: String(error)
      }),
      {
        status: 200, // Return 200 even on error to allow frontend to parse JSON
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
