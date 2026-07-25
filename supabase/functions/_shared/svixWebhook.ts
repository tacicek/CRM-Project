/**
 * Svix webhook signature verification (the scheme Resend uses).
 *
 * The endpoint runs with `verify_jwt = false` and Kong has no auth plugin in
 * front of `/functions/v1/*` — anyone on the internet can POST to it. The
 * signature is therefore not an extra safety net, it is the ONLY gate. Same
 * posture as `cronAuth.ts`: no secret configured means nothing is accepted.
 *
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}` — the RAW body.
 * Parsing the JSON and re-serialising it changes whitespace and key order and
 * breaks the signature, so the caller must pass the exact string it received
 * from `await req.text()`.
 *
 * No external dependency: the `svix` npm package would pull an unaudited module
 * tree into an unauthenticated endpoint for ~60 lines of HMAC. Web Crypto is in
 * both Deno and Node, which also keeps this file unit-testable under vitest.
 */

export interface SvixHeaders {
  /** `svix-id` */
  id: string | null;
  /** `svix-timestamp` — seconds since epoch, as sent */
  timestamp: string | null;
  /** `svix-signature` — space separated list of `v<version>,<base64>` */
  signature: string | null;
}

export type SignatureVerification =
  | { ok: true }
  | { ok: false; reason: SignatureFailure };

export type SignatureFailure =
  | "missing_secret"
  | "missing_headers"
  | "invalid_secret"
  | "invalid_timestamp"
  | "timestamp_out_of_tolerance"
  | "no_v1_signature"
  | "signature_mismatch";

/** Replay window. Svix's own default is 5 minutes. */
export const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/**
 * Split the configured secret into candidates.
 *
 * Each Resend account signs with its OWN endpoint secret, and this CRM serves
 * two companies with two separate Resend accounts. Which account a delivery came
 * from cannot be known before verification — the payload is untrusted until the
 * signature holds — so every configured secret is a candidate.
 *
 * Format: one or more secrets, comma or whitespace separated.
 */
export const parseWebhookSecrets = (raw: string | undefined | null): string[] =>
  (raw ?? "")
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const readSvixHeaders = (req: Request): SvixHeaders => ({
  id: req.headers.get("svix-id"),
  timestamp: req.headers.get("svix-timestamp"),
  signature: req.headers.get("svix-signature"),
});

/**
 * Compare two strings without leaking where they diverge.
 * Length is compared first — the length of a base64 HMAC is not a secret.
 */
const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const verifySvixSignature = async (opts: {
  /** Raw request body, byte-for-byte as received */
  payload: string;
  headers: SvixHeaders;
  /**
   * Endpoint signing secret(s), with or without the `whsec_` prefix. A string
   * may hold several comma-separated secrets — one per Resend account.
   */
  secret: string | string[] | undefined | null;
  /** Injected so the tolerance window is testable */
  nowMs: number;
  toleranceSeconds?: number;
}): Promise<SignatureVerification> => {
  const { payload, headers, nowMs } = opts;
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  const secrets = Array.isArray(opts.secret)
    ? opts.secret.filter((entry) => entry && entry.trim().length > 0)
    : parseWebhookSecrets(opts.secret);

  if (secrets.length === 0) return { ok: false, reason: "missing_secret" };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "missing_headers" };
  }

  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  // Both directions: an old capture replayed, and a clock-skewed future stamp.
  if (Math.abs(nowMs / 1000 - timestampSeconds) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  // Only v1 signatures are understood. A future scheme must be handled
  // explicitly rather than silently accepted.
  const provided = headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice("v1,".length));

  if (provided.length === 0) return { ok: false, reason: "no_v1_signature" };

  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const content = new TextEncoder().encode(signedContent);

  let matched = false;
  let usable = 0;

  for (const secret of secrets) {
    let keyBytes: Uint8Array;
    try {
      keyBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
    } catch {
      // A malformed entry must not hide a valid one next to it.
      continue;
    }
    usable++;

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, content)));

    // Svix may send several signatures during a secret rotation; any match wins.
    // Nothing returns early: neither the runtime nor the answer may reveal WHICH
    // secret (i.e. which Resend account) matched.
    for (const candidate of provided) {
      if (constantTimeEquals(candidate, expected)) matched = true;
    }
  }

  if (usable === 0) return { ok: false, reason: "invalid_secret" };

  return matched ? { ok: true } : { ok: false, reason: "signature_mismatch" };
};
