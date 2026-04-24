import { supabase } from "@/integrations/supabase/client";

export interface SpellCheckFields {
  [key: string]: string;
}

export interface SpellCheckResult {
  fields: SpellCheckFields;
  hasCorrections: boolean;
}

const TIMEOUT_MS = 5000;

/**
 * Collects only non-empty free-text fields and sends them to Claude for spell check.
 * Returns null on timeout or any error (caller should skip modal and save directly).
 */
export async function runSpellCheck(
  fields: SpellCheckFields
): Promise<SpellCheckResult | null> {
  // Filter out empty fields
  const nonEmpty: SpellCheckFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v && v.trim().length > 0) nonEmpty[k] = v;
  }
  if (Object.keys(nonEmpty).length === 0) {
    return { fields: {}, hasCorrections: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke("spell-check-ai", {
      body: { fields: nonEmpty },
    });

    clearTimeout(timeoutId);

    if (error || !data?.success) {
      console.error("[spellCheck] Edge function error:", error ?? data?.error);
      return null;
    }

    return data.result as SpellCheckResult;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("[spellCheck] Failed:", err);
    return null;
  }
}

/**
 * Given original and corrected texts, compute a list of word-level diff tokens.
 * Each token: { text, changed: boolean }
 */
export function diffWords(
  original: string,
  corrected: string
): Array<{ text: string; changed: boolean }> {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);
  const maxLen = Math.max(origWords.length, corrWords.length);
  const result: Array<{ text: string; changed: boolean }> = [];

  for (let i = 0; i < maxLen; i++) {
    const orig = origWords[i] ?? "";
    const corr = corrWords[i] ?? "";
    if (corr) {
      result.push({ text: corr, changed: orig !== corr });
    }
  }
  return result;
}
