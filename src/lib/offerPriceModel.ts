/**
 * Canonical price-model contract for offers.
 *
 * The database column `offers.price_model` is a plain `text` — NOT a Postgres enum —
 * but it is constrained: `NOT NULL DEFAULT 'pauschal'` with
 * `CHECK (price_model = ANY (ARRAY['pauschal','stundenansatz','kostendach']))`
 * (verified against the live schema). So at rest a real offer's value is always one
 * of exactly these three and never null.
 *
 * The generated Supabase types still surface it as `string`, because the CHECK is
 * invisible to the type generator. This module is the single boundary where a raw
 * `string` from a query is narrowed to the domain `PriceModel` — deliberately, and
 * never with a cast. Every inline `'pauschal' | 'stundenansatz' | 'kostendach'`
 * union in the codebase should import `PriceModel` from here instead of redeclaring it.
 *
 *   pauschal       fixed total price
 *   stundenansatz  hourly rate only
 *   kostendach     hourly rate with a maximum price ceiling
 */

export type PriceModel = "pauschal" | "stundenansatz" | "kostendach";

/** The three valid values, in canonical order (matches the DB CHECK constraint). */
export const PRICE_MODELS = ["pauschal", "stundenansatz", "kostendach"] as const;

/** Type guard — true only for a value the DB CHECK constraint would accept. */
export const isPriceModel = (value: unknown): value is PriceModel =>
  typeof value === "string" && (PRICE_MODELS as readonly string[]).includes(value);

/**
 * Discriminated parse result. Callers decide how to handle `ok: false` per context
 * (visible error in the CRM, blocked save in a form, halted PDF/e-mail) — this module
 * never picks a silent fallback, because an out-of-range value is a data-integrity
 * signal, not something to paper over with `'pauschal'`.
 */
export type PriceModelResult =
  | { ok: true; value: PriceModel }
  | { ok: false; received: unknown };

/** Pure — does not mutate its input. */
export const parsePriceModel = (value: unknown): PriceModelResult =>
  isPriceModel(value) ? { ok: true, value } : { ok: false, received: value };
