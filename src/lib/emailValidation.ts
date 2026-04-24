/**
 * Frontend email validation helper.
 *
 * Kept in sync with supabase/functions/_shared/leadQualityValidator.ts so the
 * user gets an early, friendly warning before the server rejects the lead.
 *
 * Returns three severity levels:
 *   - "error"   → definitely wrong, block submit (invalid TLD, broken format,
 *                 disposable inbox).
 *   - "warning" → probably a typo, show suggestion but still allow submit
 *                 (e.g. gmial.com → gmail.com). User decides.
 *   - null      → looks good enough.
 */

// ---------------------------------------------------------------------------
// Reference sets — MUST stay in sync with leadQualityValidator.ts
// ---------------------------------------------------------------------------

const VALID_TLDS = new Set([
  "com", "ch", "de", "at", "net", "org", "io", "co", "uk", "fr", "it", "li",
  "eu", "me", "info", "biz", "swiss", "be", "nl", "es", "pt", "dk", "se",
  "no", "fi", "pl", "cz", "hu", "ro", "bg", "gr", "hr", "si", "sk", "lt",
  "lv", "ee", "ie", "mt", "cy", "rs", "ba", "al", "mk", "md", "ua", "by",
  "tr", "us", "ca", "edu", "gov", "app", "dev", "tech", "online", "store",
  "shop", "website", "news", "blog",
]);

// typo TLD → best-guess correction
const TYPO_TLD_FIX: Record<string, string> = {
  como: "com",
  cmo: "com",
  comm: "com",
  ccom: "com",
  con: "com",
  vom: "com",
  ocm: "com",
  cim: "com",
  cok: "com",
  coml: "com",
  comn: "com",
  cpm: "com",
  cmm: "com",
};

// typo domain → best-guess correction (manual overrides)
const TYPO_DOMAIN_FIX: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmall.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmial.de": "hotmail.de",
  "hotmil.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
};

// Popular providers used for fuzzy typo detection (domains users most often mistype).
// If the typed domain is NOT in this list but is within edit-distance 1–2 of one of
// these, we surface a suggestion (e.g. "outlllook.com" → "outlook.com").
const POPULAR_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.de",
  "hotmail.ch",
  "live.com",
  "live.de",
  "yahoo.com",
  "yahoo.de",
  "ymail.com",
  "icloud.com",
  "me.com",
  "bluewin.ch",
  "gmx.ch",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "sunrise.ch",
  "swissonline.ch",
  "hispeed.ch",
  "protonmail.com",
  "proton.me",
  "t-online.de",
  "web.de",
  "mail.ru",
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost,    // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Returns the closest popular provider to `domain` if the edit distance is
 * small enough to be almost certainly a typo. Otherwise returns null.
 *
 * Heuristic:
 *   - Exact match → null (already valid, nothing to suggest)
 *   - Distance 1: suggest (one char diff — very likely a typo)
 *   - Distance 2: suggest only for longer domains (>= 8 chars) to avoid
 *     matching unrelated short domains like "web.ch" ↔ "web.de".
 */
function findSimilarProvider(domain: string): string | null {
  let best: { provider: string; dist: number } | null = null;
  for (const provider of POPULAR_PROVIDERS) {
    if (provider === domain) return null;
    const d = levenshtein(domain, provider);
    if (best === null || d < best.dist) best = { provider, dist: d };
  }
  if (!best) return null;
  if (best.dist === 1) return best.provider;
  if (best.dist === 2 && domain.length >= 8) return best.provider;
  return null;
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
  "throwam.com", "yopmail.com", "sharklasers.com", "trashmail.com",
  "fakeinbox.com", "maildrop.cc", "getnada.com", "tempmailo.com",
  "dispostable.com", "mintemail.com", "mailnesia.com",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EmailSeverity = "error" | "warning" | null;

export interface EmailValidationResult {
  severity: EmailSeverity;
  /** Short message in German shown below the input. */
  message?: string;
  /** If present, the full corrected email address (user can click to accept). */
  suggestion?: string;
  /** Convenience: true if the address is safe enough to submit. */
  ok: boolean;
}

const EMAIL_BASIC_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(rawInput: string | null | undefined): EmailValidationResult {
  const value = (rawInput ?? "").trim();

  // Empty → caller decides if required
  if (!value) {
    return { severity: null, ok: false };
  }

  // Structural check
  if (!EMAIL_BASIC_RE.test(value)) {
    // Don't nag while the user is still typing (< 5 chars, no '@', no dot)
    if (value.length < 5 || !value.includes("@")) {
      return { severity: null, ok: false };
    }
    return {
      severity: "error",
      message: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      ok: false,
    };
  }

  const [local, domainRaw] = value.split("@");
  const domain = domainRaw.toLowerCase();

  // Typo domain (gmial.com → gmail.com etc.)
  if (TYPO_DOMAIN_FIX[domain]) {
    const fixed = `${local}@${TYPO_DOMAIN_FIX[domain]}`;
    return {
      severity: "warning",
      message: "Möglicher Tippfehler in der Domain.",
      suggestion: fixed,
      ok: false,
    };
  }

  // Disposable inbox → block
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      severity: "error",
      message:
        "Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte verwenden Sie eine persönliche Adresse.",
      ok: false,
    };
  }

  // TLD checks
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];

  if (TYPO_TLD_FIX[tld]) {
    const fixedTld = TYPO_TLD_FIX[tld];
    parts[parts.length - 1] = fixedTld;
    const fixed = `${local}@${parts.join(".")}`;
    return {
      severity: "error",
      message: `Die Endung ".${tld}" existiert nicht.`,
      suggestion: fixed,
      ok: false,
    };
  }

  // Only flag TLDs that are *definitely* wrong (very long OR obviously invalid).
  // Unknown-but-short TLDs (like a new ccTLD) are accepted to avoid false
  // positives; server-side validator will still catch them.
  if (tld.length > 6 || tld.length < 2) {
    return {
      severity: "error",
      message: `Die Endung ".${tld}" scheint ungültig zu sein.`,
      ok: false,
    };
  }

  if (!VALID_TLDS.has(tld) && tld.length <= 3) {
    // 2-3 char TLD not on allow-list → likely typo
    return {
      severity: "warning",
      message: `Ungewöhnliche Domain-Endung ".${tld}". Bitte prüfen Sie die Adresse.`,
      ok: true, // warning only — let them submit
    };
  }

  // Fuzzy provider check — catches typos like "outlllook.com" → "outlook.com"
  // that are not in the manual TYPO_DOMAIN_FIX list.
  const similar = findSimilarProvider(domain);
  if (similar) {
    return {
      severity: "warning",
      message: "Möglicher Tippfehler in der Domain.",
      suggestion: `${local}@${similar}`,
      ok: false,
    };
  }

  return { severity: null, ok: true };
}

/**
 * True only when the email is safe to submit (no error).
 * Warnings are tolerated (user may have intentionally used an exotic domain).
 */
export function isEmailAcceptable(email: string | null | undefined): boolean {
  const r = validateEmail(email);
  return r.ok && r.severity !== "error";
}
