/**
 * Shared structured logger for edge functions.
 *
 * Two goals beyond a bare `console.log`:
 *   1. Consistent `[prefix] step - {metadata}` shape so production logs are greppable.
 *   2. No PII or secrets in logs. Metadata is sanitised before it is written:
 *      - secret-ish keys (authorization, token, service_role, password, body, …) are
 *        dropped entirely,
 *      - e-mail addresses are masked (`j***@example.com`),
 *      - phone numbers are masked (`+41******567`),
 *      - `Error` objects are serialised to `{ name, message }` — never the whole object,
 *        never a stack that might embed a token.
 *
 * The masking/redaction helpers are pure and exported so they can be unit-tested.
 * `createLogger` keeps its original `logStep`/`warn`/`error` surface for backward
 * compatibility and adds `info`.
 */

/** Substrings that mark a metadata key as secret — its value is removed, not masked. */
const SECRET_KEY_PARTS = [
  "authorization",
  "auth",
  "token",
  "apikey",
  "api_key",
  "service_role",
  "servicerole",
  "password",
  "secret",
  "cookie",
  "body",
  "prompt",
  "base64",
  "pdf",
];

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** `john@example.com` → `j***@example.com`. Never returns the local part beyond 1 char. */
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "***";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

/** `+41791234567` → `+41******567`. Keeps a leading `+`, first 2 and last 3 digits. */
export function maskPhone(value: string): string {
  const plus = value.trim().startsWith("+") ? "+" : "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return `${plus}***`;
  const head = digits.slice(0, 2);
  const tail = digits.slice(-3);
  return `${plus}${head}${"*".repeat(digits.length - 5)}${tail}`;
}

function isSecretKey(key: string): boolean {
  const k = key.toLowerCase();
  return SECRET_KEY_PARTS.some((part) => k.includes(part));
}

/**
 * Recursively strip secrets and mask PII from arbitrary log metadata.
 * Errors become `{ name, message }`; secret keys become `"[redacted]"`; strings that
 * look like e-mails (or sit under an email/phone-hinted key) are masked.
 */
export function sanitizeLogData(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogData(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? "[redacted]" : sanitizeLogData(v, k);
    }
    return out;
  }

  if (typeof value === "string") {
    const hint = (keyHint ?? "").toLowerCase();
    if (hint.includes("email") || hint.includes("mail")) return maskEmail(value);
    if (hint.includes("phone") || hint.includes("tel")) return maskPhone(value);
    // Mask any e-mail address that appears inside a free-text string.
    return value.replace(EMAIL_RE, (match) => maskEmail(match));
  }

  return value;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(sanitizeLogData(value));
  } catch {
    return "[unserializable]";
  }
}

type LogLevel = "log" | "info" | "warn" | "error";

export function createLogger(prefix: string) {
  const emit = (level: LogLevel, step: string, details?: unknown) => {
    const meta = details === undefined ? "" : ` - ${safeStringify(details)}`;
    console[level](`[${prefix}] ${step}${meta}`);
  };

  return {
    /** Kept for backward compatibility — routes to `console.log`. */
    logStep: (step: string, details?: unknown) => emit("log", step, details),
    info: (step: string, details?: unknown) => emit("info", step, details),
    warn: (step: string, details?: unknown) => emit("warn", step, details),
    error: (step: string, details?: unknown) => emit("error", step, details),
  };
}
