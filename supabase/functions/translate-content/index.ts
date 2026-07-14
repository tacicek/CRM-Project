import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { assertCompanyMembership } from "../_shared/verifyCompanyMembership.ts";
import { createLogger } from "../_shared/logger.ts";
import { LOCALES, toLocale, type Locale } from "../_shared/i18n/locale.ts";

/**
 * translate-content — übersetzt firmen-eigene Inhalte (Katalogpositionen, AGB,
 * Checklisten, Textbausteine) aus dem Deutschen ins Französische und Englische.
 *
 * Warum das nötig ist: das Wörterbuch übersetzt nur die festen Beschriftungen
 * einer Offerte ("Total", "Gültig bis"). Der eigentliche INHALT — die
 * Positionstexte, die AGB-Abschnitte — ist von der Firma auf Deutsch verfasst und
 * liegt in der DB. Eine französische Offerte mit deutschen Positionen wäre nur
 * halb übersetzt.
 *
 * Diese Funktion SCHREIBT NICHT in die DB. Sie liefert Vorschläge zurück; die
 * Firma prüft und speichert sie im Dashboard. Eine Maschinenübersetzung ohne
 * Freigabe gehört nicht in ein Dokument, das ein Kunde unterschreibt.
 */

const logger = createLogger("translate-content");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

interface TranslateRequest {
  company_id: string;
  /** Zu übersetzende Felder, z. B. [{ id, fields: { name: "Umzug", description: "…" } }] */
  items: Array<{ id: string; fields: Record<string, string> }>;
  target_locales: string[];
  /** Fachlicher Kontext, damit die Übersetzung im Umzugs-/Reinigungsgewerbe stimmt. */
  context?: string;
}

interface TranslatedItem {
  id: string;
  translations: Record<string, Record<string, string>>;
}

const SYSTEM_PROMPT = `You translate business content for a Swiss moving and cleaning company's CRM.

The source is always German (Swiss German business register). You translate into French and/or English.

Rules:
- Target register: formal Swiss business. French uses vouvoiement. English is British-leaning business English.
- These texts appear on quotes, invoices and terms & conditions that customers sign. Accuracy outranks fluency: never invent, omit, or soften a term.
- Keep numbers, prices, units (m², m³, CHF), dates and proper nouns exactly as they are.
- Preserve any {placeholder} tokens verbatim — same name, same spelling.
- Preserve line breaks and list structure.
- Trade vocabulary: Umzug → déménagement / removal · Reinigung → nettoyage / cleaning · Räumung → débarras / clearance · Entsorgung → élimination / disposal · Lagerung → stockage / storage · Möbellift → monte-meubles / furniture lift · Klaviertransport → transport de piano / piano transport · Besichtigung → visite / viewing · Offerte → devis / quote · Kostendach → prix plafond / cost ceiling · Pauschal → forfait / flat rate.
- Legal text (AGB / terms) must stay legally precise. Translate the obligation, not a paraphrase of it. If a German legal term has no clean equivalent, keep the closest standard term used in Swiss French / international English contracts.

Return only the translations, one entry per input item and locale.`;

const buildSchema = (locales: Locale[], fieldNames: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "translations"],
        properties: {
          id: { type: "string" },
          translations: {
            type: "object",
            additionalProperties: false,
            required: locales,
            properties: Object.fromEntries(
              locales.map((l) => [
                l,
                {
                  type: "object",
                  additionalProperties: false,
                  required: fieldNames,
                  properties: Object.fromEntries(
                    fieldNames.map((f) => [f, { type: "string" }])
                  ),
                },
              ])
            ),
          },
        },
      },
    },
  },
});

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logger.error("ANTHROPIC_API_KEY not configured");
      return json({ error: "Übersetzungsdienst ist nicht konfiguriert." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nicht authentifiziert." }, 401);

    const body = (await req.json()) as TranslateRequest;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    await assertCompanyMembership(supabase, authHeader, body.company_id);

    const targets = (body.target_locales ?? [])
      .map(toLocale)
      .filter((l) => l !== "de");
    const locales = [...new Set(targets)] as Locale[];

    if (locales.length === 0) {
      return json({ error: "Keine Zielsprache angegeben." }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: "Keine Inhalte zum Übersetzen." }, 400);
    }

    // Das Schema erzwingt genau die Felder, die hereinkommen — so kann das Modell
    // kein Feld weglassen und die UI muss keine Lücken abfangen.
    const fieldNames = [
      ...new Set(body.items.flatMap((i) => Object.keys(i.fields))),
    ];

    const userContent = [
      body.context ? `Context: ${body.context}` : null,
      `Target languages: ${locales.join(", ")}`,
      "",
      "Items (German source):",
      JSON.stringify(body.items, null, 2),
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        // Übersetzen ist keine Denkaufgabe — niedriger Effort, kein Thinking.
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: buildSchema(locales, fieldNames),
          },
        },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      logger.error("Anthropic API error", { status: res.status, detail });
      return json({ error: "Übersetzung fehlgeschlagen." }, 502);
    }

    const data = await res.json();

    if (data.stop_reason === "refusal") {
      logger.error("Model refused", { stop_details: data.stop_details });
      return json({ error: "Übersetzung wurde abgelehnt." }, 422);
    }

    const textBlock = (data.content ?? []).find(
      (b: { type: string }) => b.type === "text"
    );
    if (!textBlock?.text) {
      logger.error("No text block in response", { stop_reason: data.stop_reason });
      return json({ error: "Übersetzung fehlgeschlagen." }, 502);
    }

    const parsed = JSON.parse(textBlock.text) as { items: TranslatedItem[] };

    logger.info("translated", {
      items: parsed.items.length,
      locales,
      usage: data.usage,
    });

    // Vorschlag zurück an die UI — bewusst KEIN Schreiben in die DB. Die Firma gibt frei.
    return json({ items: parsed.items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("unhandled", { message });
    return json({ error: message }, 500);
  }
});

export type { TranslateRequest, TranslatedItem };
export { LOCALES };
