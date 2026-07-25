/**
 * Per-company AI provider dispatch.
 *
 * Lifted out of `extract-anfrage-ai` so the inbound-email pipeline uses the
 * same provider, the same keys and the same model defaults instead of growing a
 * second, slowly diverging copy. Behaviour is unchanged: provider and keys come
 * from the `api_keys` table, the edge-function environment is the fallback, and
 * Anthropic is the default when nothing is configured.
 *
 * No supabase-js import on purpose — the caller passes the rows it already
 * fetched. That keeps this file free of remote imports and unit-testable.
 */

export const AI_KEY_NAMES = [
  "ai_provider",
  "anthropic_api_key",
  "anthropic_model",
  "openai_api_key",
  "openai_model",
  "gemini_api_key",
  "gemini_model",
] as const;

export const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
} as const;

export type AiProviderName = keyof typeof DEFAULT_MODELS;

export interface ApiKeyRow {
  key_name: string;
  key_value: string;
}

export type AiSettings = Record<string, string>;

export type EnvReader = (key: string) => string | undefined;

export type AiCallResult =
  | { ok: true; text: string; provider: AiProviderName; model: string }
  | {
    ok: false;
    provider: AiProviderName;
    error: "missing_api_key" | "provider_error" | "empty_response";
    status?: number;
    detail?: string;
  };

export const toSettingsMap = (rows: ApiKeyRow[] | null | undefined): AiSettings => {
  const settings: AiSettings = {};
  for (const row of rows ?? []) {
    if (row?.key_name && typeof row.key_value === "string") {
      settings[row.key_name] = row.key_value;
    }
  }
  return settings;
};

export const resolveProvider = (settings: AiSettings): AiProviderName => {
  const configured = settings["ai_provider"];
  if (configured === "openai" || configured === "gemini" || configured === "anthropic") {
    return configured;
  }
  return "anthropic";
};

const resolveApiKey = (
  provider: AiProviderName,
  settings: AiSettings,
  env: EnvReader,
): string | undefined => {
  const fromSettings = settings[`${provider}_api_key`];
  if (fromSettings) return fromSettings;
  return env(`${provider.toUpperCase()}_API_KEY`);
};

export const callAiProvider = async (opts: {
  settings: AiSettings;
  env: EnvReader;
  prompt: string;
  maxTokens?: number;
}): Promise<AiCallResult> => {
  const { settings, env, prompt } = opts;
  const maxTokens = opts.maxTokens ?? 4096;

  const provider = resolveProvider(settings);
  const apiKey = resolveApiKey(provider, settings, env);
  if (!apiKey) return { ok: false, provider, error: "missing_api_key" };

  const model = settings[`${provider}_model`] || DEFAULT_MODELS[provider];

  let response: Response;
  let text: string;

  if (provider === "openai") {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        provider,
        error: "provider_error",
        status: response.status,
        detail: await response.text(),
      };
    }
    const data = await response.json();
    text = data.choices?.[0]?.message?.content ?? "";
  } else if (provider === "gemini") {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        provider,
        error: "provider_error",
        status: response.status,
        detail: await response.text(),
      };
    }
    const data = await response.json();
    text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        provider,
        error: "provider_error",
        status: response.status,
        detail: await response.text(),
      };
    }
    const data = await response.json();
    text = data.content?.[0]?.text ?? "";
  }

  if (!text) return { ok: false, provider, error: "empty_response" };

  return { ok: true, text, provider, model };
};
