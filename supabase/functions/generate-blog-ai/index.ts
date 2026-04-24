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
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    modelId: "claude-opus-4-6-20260213",
    maxTokens: 8192,
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    maxTokens: 8192,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    maxTokens: 8192,
  },
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
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

const DEFAULT_MODEL = "claude-sonnet-4-5"; // Best for content writing

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
    const error = await response.text();
    console.error("OpenAI API error:", response.status, error);
    throw new Error(`OpenAI API error (${response.status}): ${error.substring(0, 300)}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content || "";
  
  if (!result) {
    console.error("OpenAI returned no content. Finish reason:", data.choices?.[0]?.finish_reason);
  }
  
  return result;
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
    const error = await response.text();
    console.error("Anthropic API error:", response.status, error);
    throw new Error(`Anthropic API error (${response.status}): ${error.substring(0, 300)}`);
  }

  const data = await response.json();
  console.log("Anthropic response - stop_reason:", data.stop_reason, "content blocks:", data.content?.length);
  
  // Find the text content block (skip thinking blocks)
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  const result = textBlock?.text || data.content?.[0]?.text || "";
  
  if (!result) {
    console.error("Anthropic returned no text content. Full response:", JSON.stringify(data).substring(0, 500));
  }
  
  return result;
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
    const error = await response.text();
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${error}`);
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
): Promise<string> {
  const apiKey = getApiKey(modelConfig.provider);
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${modelConfig.provider}. Please add ${
      modelConfig.provider === "openai" ? "OPENAI_API_KEY" :
      modelConfig.provider === "anthropic" ? "ANTHROPIC_API_KEY" :
      "GOOGLE_AI_API_KEY"
    } to your secrets.`);
  }

  switch (modelConfig.provider) {
    case "openai":
      return await callOpenAI(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
    case "anthropic":
      return await callAnthropic(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
    case "google":
      return await callGemini(apiKey, modelConfig.modelId, systemPrompt, userPrompt, modelConfig.maxTokens);
    default:
      throw new Error(`Unknown provider: ${modelConfig.provider}`);
  }
}

// Rate limit: max 20 requests per IP per 10 minutes
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    console.log("[generate-blog-ai] Authorized:", user.email, "| Remaining:", rateCheck.remaining);

    const { topic, category, target_city, keywords, style, model_id = DEFAULT_MODEL } = await req.json();

    // Get model configuration - fallback to default if invalid
    let modelConfig = LLM_MODELS[model_id];
    if (!modelConfig) {
      console.log(`Model ${model_id} not found, falling back to ${DEFAULT_MODEL}`);
      modelConfig = LLM_MODELS[DEFAULT_MODEL];
    }
    
    console.log("Using model:", modelConfig.name, "(", modelConfig.modelId, ")");

    const systemPrompt = `Du bist ein spezialisierter SEO-Content-Generator für offerio.ch - das führende Schweizer Offerte-Vergleichsportal.

WICHTIG:
- Offerio ist ein VERGLEICHSPORTAL, keine Umzugsfirma/Reinigungsfirma!
- Kunden stellen kostenlose Anfragen und erhalten Offerten von mehreren geprüften Partnerfirmen.
- Schreibe für Schweizer Leser (formelle Anrede "Sie")
- Verwende Schweizer Begriffe ("Offerte" statt "Angebot")

ANTWORTE AUSSCHLIESSLICH IM REINEN JSON-FORMAT. 
Nutze für HTML-Attribute NUR einfache Anführungszeichen ('), z.B. <h2 class='title'>. 
Nutze doppelte Anführungszeichen (") NUR für die JSON-Struktur.
Erzeuge keine echten Zeilenumbrüche innerhalb der Werte, nutze \\n.`;

    const styleInstructions = {
      informative: "Schreibe einen informativen, sachlichen Artikel mit Fakten und nützlichen Tipps.",
      guide: "Schreibe einen Schritt-für-Schritt-Guide mit klaren Anweisungen.",
      listicle: "Schreibe einen Top-10 Listenartikel mit kurzen, prägnanten Punkten.",
      personal: "Schreibe einen persönlichen, beratenden Artikel mit Empfehlungen.",
    };

    const userPrompt = `Thema: ${topic}
Kategorie: ${category}
Region: ${target_city || 'Schweiz'}
Keywords: ${keywords?.join(', ') || 'Umzug, Offerten, Vergleich'}
Stil: ${styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.informative}

Erstelle einen umfassenden, SEO-optimierten Blog-Artikel (mindestens 1500 Wörter) im folgenden JSON-FORMAT:
{
  "title": "Titel (max 60 Zeichen, mit Fokus-Keyword)",
  "slug": "url-slug-format",
  "meta_description": "Meta-Beschreibung (max 160 Zeichen, mit Call-to-Action)",
  "excerpt": "Kurzfassung (2-3 Sätze)",
  "content": "Vollständiger HTML-Inhalt mit: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> Tags. Füge [IMAGE_PLACEHOLDER_1] und [IMAGE_PLACEHOLDER_2] an sinnvollen Stellen ein.",
  "gallery_images": [
    {"placeholder": "[IMAGE_PLACEHOLDER_1]", "description": "Beschreibung für Bild 1 (SEO-optimiert)"}, 
    {"placeholder": "[IMAGE_PLACEHOLDER_2]", "description": "Beschreibung für Bild 2 (SEO-optimiert)"}
  ],
  "focus_keyword": "Haupt-Keyword",
  "seo_title": "SEO-Titel mit Keyword | offerio.ch",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
  "faq_schema": [
    {"question": "Frage 1?", "answer": "Ausführliche Antwort 1"},
    {"question": "Frage 2?", "answer": "Ausführliche Antwort 2"},
    {"question": "Frage 3?", "answer": "Ausführliche Antwort 3"},
    {"question": "Frage 4?", "answer": "Ausführliche Antwort 4"},
    {"question": "Frage 5?", "answer": "Ausführliche Antwort 5"}
  ]
}

WICHTIG: Der Content muss erwähnen, dass Leser auf offerio.ch kostenlos Offerten vergleichen können!`;

    // Generate content using selected model
    const rawText = await generateContent(modelConfig, systemPrompt, userPrompt);
    console.log("Generated content length:", rawText.length);
    
    if (!rawText || rawText.trim().length === 0) {
      console.error("AI returned empty response. Model:", modelConfig.name);
      return new Response(JSON.stringify({ 
        error: `AI-Modell (${modelConfig.name}) hat eine leere Antwort geliefert. Bitte versuchen Sie es erneut oder wählen Sie ein anderes Modell.` 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JSON from response - handle markdown code fences
    let jsonText = rawText;
    
    // Remove markdown code fences if present (```json ... ``` or ``` ... ```)
    const codeBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
      console.log("Extracted JSON from code block, length:", jsonText.length);
    }

    // Find JSON object boundaries
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      console.error("No JSON found in response. First 500 chars:", rawText.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: `AI-Antwort enthält kein gültiges JSON. Modell: ${modelConfig.name}. Bitte versuchen Sie es erneut.` 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonString = jsonText.substring(firstBrace, lastBrace + 1);

    try {
      const blogData = JSON.parse(jsonString);
      return new Response(JSON.stringify({ 
        success: true, 
        blog: blogData,
        model_used: modelConfig.name
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      // Try to fix common JSON issues: unescaped newlines in strings
      console.error("JSON Parse Error (attempting fix):", parseError);
      try {
        // Replace unescaped newlines within JSON string values
        const fixedJson = jsonString
          .replace(/(?<=:\s*"[^"]*)\n/g, '\\n')
          .replace(/\t/g, '\\t');
        const blogData = JSON.parse(fixedJson);
        console.log("JSON fixed and parsed successfully");
        return new Response(JSON.stringify({ 
          success: true, 
          blog: blogData,
          model_used: modelConfig.name
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (fixError) {
        console.error("JSON fix also failed. Raw JSON (first 500):", jsonString.substring(0, 500));
        return new Response(JSON.stringify({ 
          error: `JSON-Verarbeitungsfehler. Modell: ${modelConfig.name}. Bitte erneut versuchen oder ein anderes Modell wählen.` 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
