import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callAiProvider,
  DEFAULT_MODELS,
  resolveProvider,
  toSettingsMap,
} from "../aiProvider.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (response: unknown, ok = true, status = 200) => {
  const spy = vi.fn(async () => ({
    ok,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
};

describe("toSettingsMap", () => {
  it("turns api_keys rows into a lookup", () => {
    expect(toSettingsMap([{ key_name: "ai_provider", key_value: "openai" }])).toEqual({
      ai_provider: "openai",
    });
  });

  it("survives a null result", () => {
    expect(toSettingsMap(null)).toEqual({});
  });
});

describe("resolveProvider", () => {
  it("defaults to anthropic", () => {
    expect(resolveProvider({})).toBe("anthropic");
    expect(resolveProvider({ ai_provider: "hausmarke" })).toBe("anthropic");
  });

  it("honours a configured provider", () => {
    expect(resolveProvider({ ai_provider: "gemini" })).toBe("gemini");
  });
});

describe("callAiProvider", () => {
  const env = (values: Record<string, string>) => (key: string) => values[key];

  it("reports a missing key instead of calling out", async () => {
    const spy = stubFetch({});
    const result = await callAiProvider({ settings: {}, env: env({}), prompt: "hallo" });

    expect(result).toEqual({ ok: false, provider: "anthropic", error: "missing_api_key" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("prefers the company key over the environment fallback", async () => {
    const spy = stubFetch({ content: [{ text: "{}" }] });
    await callAiProvider({
      settings: { anthropic_api_key: "company-key" },
      env: env({ ANTHROPIC_API_KEY: "env-key" }),
      prompt: "hallo",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("company-key");
  });

  it("falls back to the environment key", async () => {
    const spy = stubFetch({ content: [{ text: "{}" }] });
    await callAiProvider({
      settings: {},
      env: env({ ANTHROPIC_API_KEY: "env-key" }),
      prompt: "hallo",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("env-key");
  });

  it("uses the documented default model and returns the answer", async () => {
    const spy = stubFetch({ content: [{ text: "ANTWORT" }] });
    const result = await callAiProvider({
      settings: { anthropic_api_key: "k" },
      env: env({}),
      prompt: "hallo",
    });

    expect(result).toEqual({
      ok: true,
      text: "ANTWORT",
      provider: "anthropic",
      model: DEFAULT_MODELS.anthropic,
    });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe(DEFAULT_MODELS.anthropic);
  });

  it("reads the OpenAI answer shape", async () => {
    stubFetch({ choices: [{ message: { content: "ANTWORT" } }] });
    const result = await callAiProvider({
      settings: { ai_provider: "openai", openai_api_key: "k", openai_model: "gpt-4o" },
      env: env({}),
      prompt: "hallo",
    });

    expect(result).toMatchObject({ ok: true, text: "ANTWORT", provider: "openai", model: "gpt-4o" });
  });

  it("reads the Gemini answer shape", async () => {
    stubFetch({ candidates: [{ content: { parts: [{ text: "ANTWORT" }] } }] });
    const result = await callAiProvider({
      settings: { ai_provider: "gemini", gemini_api_key: "k" },
      env: env({}),
      prompt: "hallo",
    });

    expect(result).toMatchObject({ ok: true, text: "ANTWORT", provider: "gemini" });
  });

  it("surfaces a provider error with its status", async () => {
    stubFetch({ error: "rate limited" }, false, 429);
    const result = await callAiProvider({
      settings: { anthropic_api_key: "k" },
      env: env({}),
      prompt: "hallo",
    });

    expect(result).toMatchObject({ ok: false, error: "provider_error", status: 429 });
  });

  it("reports an empty answer separately from a transport error", async () => {
    stubFetch({ content: [] });
    const result = await callAiProvider({
      settings: { anthropic_api_key: "k" },
      env: env({}),
      prompt: "hallo",
    });

    expect(result).toMatchObject({ ok: false, error: "empty_response" });
  });
});
