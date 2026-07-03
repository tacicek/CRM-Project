/**
 * Deterministic Lead Quality Validator (shared between edge functions)
 *
 * Free, fast, catches ~85% of fake leads without calling the LLM.
 * Uses logic parallel to VALIDATE_LEAD_QUALITY_PROMPT in prompts.ts;
 * goal: avoid paying the LLM cost on every lead.
 *
 * Output verdict:
 *   - "clearly_invalid" → don't call the LLM, go straight to reject/risky bucket
 *   - "ambiguous"       → consult the LLM (VALIDATE_LEAD_QUALITY_PROMPT)
 *   - "clearly_valid"   → don't call the LLM, keep it in pending_verification
 */

// ---------------------------------------------------------------------------
// Reference lists
// ---------------------------------------------------------------------------

// TLD not in the whitelist / longer than 6 characters → ungültig
const VALID_TLDS = new Set([
  "com", "ch", "de", "at", "net", "org", "io", "co", "uk", "fr", "it", "li",
  "eu", "me", "info", "biz", "swiss", "be", "nl", "es", "pt", "dk", "se",
  "no", "fi", "pl", "cz", "hu", "ro", "bg", "gr", "hr", "si", "sk", "lt",
  "lv", "ee", "ie", "mt", "cy", "rs", "ba", "al", "mk", "md", "ua", "by",
  "tr", "us", "ca", "edu", "gov", "app", "dev", "tech", "online", "store",
  "shop", "website", "news", "blog",
]);

const TYPO_TLDS = new Set([
  "como", "cmo", "comm", "ccom", "con", "vom", "ocm", "cim", "cok",
  "coml", "comn", "cpm", "cmm",
]);

const TYPO_DOMAINS = new Set([
  "gmial.com", "gamil.com", "gnail.com", "gmaill.com", "gmai.com",
  "yahooo.com", "yaho.com", "yahoo.con",
  "hotmial.com", "hotmai.com", "hotmial.de", "hotmil.com",
  "outlok.com", "outloook.com",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
  "throwam.com", "yopmail.com", "sharklasers.com", "trashmail.com",
  "fakeinbox.com", "maildrop.cc", "getnada.com", "tempmailo.com",
  "dispostable.com", "mintemail.com", "mailnesia.com",
]);

// European country codes (in sync with the prompt)
const VALID_EU_PHONE_PREFIXES = [
  "+41", "+49", "+43", "+33", "+39", "+423", "+352",
  "+32", "+31", "+34", "+351", "+44", "+45", "+46",
  "+47", "+358", "+48", "+420", "+36", "+40", "+359",
  "+30", "+385", "+386", "+421", "+370", "+371", "+372",
  "+353", "+356", "+357", "+382", "+381", "+387", "+355",
  "+389", "+373", "+380", "+375",
];

const KEYBOARD_PATTERNS = [
  "asdf", "qwer", "asdfgh", "qwerty", "zxcv", "yxcv",
  "1234", "abcd", "aaaa", "bbbb", "xxxx", "zzzz",
];

const TEST_NAMES = new Set([
  "test", "demo", "admin", "user", "fake", "anonym", "anonymous",
  "nobody", "noname", "kunde", "customer", "xxx", "yyy",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadValidationInput {
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  preferred_date?: string | null;
  service_type?: string | null;
  from_plz?: string | null;
  from_city?: string | null;
  from_street?: string | null;
  to_plz?: string | null;
  to_city?: string | null;
  to_street?: string | null;
}

export type Verdict = "clearly_invalid" | "ambiguous" | "clearly_valid";

export interface DeterministicResult {
  verdict: Verdict;
  qualityScore: number;      // 0-100
  signals: string[];         // Signal list
  rejectionReason: string | null;
  fieldChecks: {
    email:   { valid: boolean; issue: string | null };
    phone:   { valid: boolean; issue: string | null };
    name:    { valid: boolean; issue: string | null };
    address: { valid: boolean; issue: string | null };
    date:    { valid: boolean; issue: string | null };
  };
  // If true: even the email format is invalid → double opt-in cannot be sent
  emailCanReceive: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function stripDigits(v: string): string {
  return v.replace(/[^0-9]/g, "");
}

function isAllSameDigit(digits: string): boolean {
  return digits.length > 0 && new Set(digits).size === 1;
}

function isSequentialDigits(digits: string): boolean {
  return ["0123456789", "1234567890", "9876543210", "0987654321"].includes(digits);
}

function checkEmail(email: string | null | undefined): {
  valid: boolean;
  issue: string | null;
  disposable: boolean;
  typoDomain: boolean;
  emailCanReceive: boolean;
} {
  if (!email || !email.trim()) {
    return { valid: false, issue: "E-Mail fehlt", disposable: false, typoDomain: false, emailCanReceive: false };
  }

  const e = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(e)) {
    return { valid: false, issue: "E-Mail-Format ungültig", disposable: false, typoDomain: false, emailCanReceive: false };
  }

  const atIndex = e.lastIndexOf("@");
  const local = e.slice(0, atIndex);
  const domain = e.slice(atIndex + 1);

  if (/^\d+$/.test(local)) {
    return { valid: false, issue: "Lokaler Teil nur Zahlen", disposable: false, typoDomain: false, emailCanReceive: false };
  }

  const parts = domain.split(".");
  const tld = parts[parts.length - 1];

  if (TYPO_TLDS.has(tld)) {
    return { valid: false, issue: `Tippfehler-TLD: .${tld}`, disposable: false, typoDomain: false, emailCanReceive: false };
  }

  if (tld.length > 6 && !VALID_TLDS.has(tld)) {
    return { valid: false, issue: `Unbekannte TLD: .${tld}`, disposable: false, typoDomain: false, emailCanReceive: false };
  }

  if (!VALID_TLDS.has(tld)) {
    // 2-6 characters but an unknown TLD — accept as valid, only a suspicion signal
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, issue: "Wegwerf-Domain", disposable: true, typoDomain: false, emailCanReceive: false };
  }

  if (TYPO_DOMAINS.has(domain)) {
    return { valid: false, issue: `Tippfehler-Domain: ${domain}`, disposable: false, typoDomain: true, emailCanReceive: false };
  }

  return { valid: true, issue: null, disposable: false, typoDomain: false, emailCanReceive: true };
}

function checkPhone(phone: string | null | undefined): { valid: boolean; issue: string | null } {
  if (!phone || !phone.trim()) {
    return { valid: false, issue: "Telefon fehlt" };
  }

  const raw = phone.trim();
  const digits = stripDigits(raw);

  if (isAllSameDigit(digits)) {
    return { valid: false, issue: "Telefon: alle gleichen Ziffern" };
  }

  if (isSequentialDigits(digits)) {
    return { valid: false, issue: "Telefon: offensichtliche Sequenz" };
  }

  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, issue: `Telefon-Länge ungültig (${digits.length} Ziffern)` };
  }

  // If there is a country code it must be in the European list
  if (raw.startsWith("+") || raw.startsWith("00")) {
    const normalized = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
    const hasValidPrefix = VALID_EU_PHONE_PREFIXES.some((p) => normalized.startsWith(p));
    if (!hasValidPrefix) {
      return { valid: false, issue: "Nicht-europäische Ländervorwahl" };
    }
    return { valid: true, issue: null };
  }

  // Without a country code, CH local format is expected (07x/04x/03x/02x, 10 digits total)
  if (digits.length === 10 && /^0[2-7]/.test(digits)) {
    return { valid: true, issue: null };
  }

  // If it's neither local format nor has a country code → suspicious but not certain
  return { valid: true, issue: null };
}

function checkName(firstName: string | null | undefined, lastName: string | null | undefined): {
  valid: boolean;
  issue: string | null;
  suspicious: boolean;
} {
  const first = (firstName ?? "").trim().toLowerCase();
  const last = (lastName ?? "").trim().toLowerCase();
  const combined = `${first} ${last}`.trim();

  if (!first && !last) {
    return { valid: false, issue: "Name fehlt", suspicious: false };
  }
  if (combined.length < 2) {
    return { valid: false, issue: "Name zu kurz", suspicious: false };
  }
  if (!/[a-zäöüàéèêçñß]/i.test(combined)) {
    return { valid: false, issue: "Name ohne Buchstaben", suspicious: false };
  }
  if (KEYBOARD_PATTERNS.some((p) => first.includes(p) || last.includes(p))) {
    return { valid: false, issue: "Tastatur-Muster im Namen", suspicious: false };
  }
  if (TEST_NAMES.has(first) || TEST_NAMES.has(last)) {
    return { valid: false, issue: "Test/Fake-Name", suspicious: false };
  }
  // Suspicious (not invalid, but lower the score)
  if (first && first === last) {
    return { valid: true, issue: null, suspicious: true };
  }
  if (/^(.)\1{2,}$/.test(first) || /^(.)\1{2,}$/.test(last)) {
    return { valid: true, issue: null, suspicious: true };
  }
  return { valid: true, issue: null, suspicious: false };
}

function checkAddress(input: LeadValidationInput): { valid: boolean; issue: string | null; suspicious: boolean } {
  const plz = input.from_plz?.trim() || input.to_plz?.trim() || "";
  const city = input.from_city?.trim() || input.to_city?.trim() || "";

  // Swiss PLZ check — only when it's 4 digits and in typical CH format
  if (plz && /^\d{4}$/.test(plz)) {
    const n = parseInt(plz, 10);
    if (n < 1000 || n > 9999) {
      return { valid: false, issue: "CH-PLZ ausserhalb 1000-9999", suspicious: false };
    }
    if (["0000", "1111", "1234", "9999"].includes(plz)) {
      return { valid: false, issue: `Offensichtliche Fake-PLZ: ${plz}`, suspicious: false };
    }
  }

  const isUmzug = (input.service_type ?? "").startsWith("umzug");
  if (isUmzug) {
    const hasFrom = !!(input.from_plz || input.from_city || input.from_street);
    const hasTo = !!(input.to_plz || input.to_city || input.to_street);
    if (!hasFrom && !hasTo) {
      return { valid: true, issue: "Umzug ohne jegliche Adresse", suspicious: true };
    }
  }

  if (!plz && !city) {
    return { valid: true, issue: null, suspicious: false };
  }
  return { valid: true, issue: null, suspicious: false };
}

function checkDate(dateStr: string | null | undefined): { valid: boolean; issue: string | null; suspicious: boolean } {
  if (!dateStr) {
    return { valid: true, issue: null, suspicious: false };
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return { valid: false, issue: "Datum ungültig", suspicious: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dOnly = new Date(d);
  dOnly.setHours(0, 0, 0, 0);

  if (dOnly.getTime() < today.getTime()) {
    return { valid: false, issue: "Datum liegt in der Vergangenheit", suspicious: false };
  }
  const threeYears = new Date();
  threeYears.setFullYear(threeYears.getFullYear() + 3);
  if (dOnly.getTime() > threeYears.getTime()) {
    return { valid: false, issue: "Datum mehr als 3 Jahre in der Zukunft", suspicious: false };
  }
  if (dOnly.getTime() === today.getTime()) {
    return { valid: true, issue: null, suspicious: true };
  }
  return { valid: true, issue: null, suspicious: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function validateLeadDeterministic(input: LeadValidationInput): DeterministicResult {
  const signals: string[] = [];
  let score = 100;

  const emailCheck = checkEmail(input.customer_email);
  const phoneCheck = checkPhone(input.customer_phone);
  const nameCheck = checkName(input.customer_first_name, input.customer_last_name);
  const addressCheck = checkAddress(input);
  const dateCheck = checkDate(input.preferred_date);

  // ---- E-Mail ------------------------------------------------------------
  if (!emailCheck.valid) {
    if (emailCheck.disposable) {
      score -= 35;
      signals.push(`Wegwerf-E-Mail: ${emailCheck.issue}`);
    } else if (emailCheck.typoDomain) {
      score -= 30;
      signals.push(`Tippfehler-Domain: ${emailCheck.issue}`);
    } else if (emailCheck.issue === "E-Mail fehlt") {
      score -= 20;
      signals.push("E-Mail fehlt");
    } else {
      score -= 45;
      signals.push(`E-Mail ungültig: ${emailCheck.issue}`);
    }
  }

  // ---- Telefon -----------------------------------------------------------
  if (!phoneCheck.valid) {
    if (phoneCheck.issue === "Telefon fehlt") {
      score -= 10;
      signals.push("Telefon fehlt");
    } else {
      score -= 25;
      signals.push(`Telefon ungültig: ${phoneCheck.issue}`);
    }
  }

  // ---- Name --------------------------------------------------------------
  if (!nameCheck.valid) {
    score -= 20;
    signals.push(`Name ungültig: ${nameCheck.issue}`);
  } else if (nameCheck.suspicious) {
    score -= 10;
    signals.push("Name verdächtig");
  }

  // ---- Address -----------------------------------------------------------
  if (!addressCheck.valid) {
    score -= 15;
    signals.push(`Adresse ungültig: ${addressCheck.issue}`);
  } else if (addressCheck.suspicious) {
    score -= 10;
    signals.push(`Adresse verdächtig: ${addressCheck.issue}`);
  }

  // ---- Datum -------------------------------------------------------------
  if (!dateCheck.valid) {
    score -= 10;
    signals.push(`Datum ungültig: ${dateCheck.issue}`);
  } else if (dateCheck.suspicious) {
    score -= 5;
    signals.push("Datum heute (kurzfristig)");
  }

  score = Math.max(0, Math.min(100, score));

  // ---- Verdict -----------------------------------------------------------
  // clearly_invalid: email format is definitely invalid (mail can't even be sent) or score <25
  // clearly_valid:   score >=80 and no critical signals at all
  // ambiguous:       everything else (consult the LLM)
  let verdict: Verdict;
  let rejectionReason: string | null = null;

  const emailClearlyDead =
    !emailCheck.valid && (
      emailCheck.issue === "E-Mail-Format ungültig" ||
      emailCheck.issue === "Lokaler Teil nur Zahlen" ||
      emailCheck.typoDomain ||
      emailCheck.disposable ||
      (emailCheck.issue?.startsWith("Tippfehler-TLD") ?? false) ||
      (emailCheck.issue?.startsWith("Unbekannte TLD") ?? false)
    );

  if (emailClearlyDead) {
    verdict = "clearly_invalid";
    rejectionReason = `E-Mail-Adresse ungültig: ${emailCheck.issue}. Bestätigungs-E-Mail nicht möglich.`;
  } else if (!phoneCheck.valid && phoneCheck.issue !== "Telefon fehlt") {
    verdict = "clearly_invalid";
    rejectionReason = `Telefonnummer ungültig: ${phoneCheck.issue}.`;
  } else if (score < 25) {
    verdict = "clearly_invalid";
    rejectionReason = "Mehrere kritische Qualitätsprobleme erkannt.";
  } else if (score >= 80 && signals.length === 0) {
    verdict = "clearly_valid";
  } else {
    verdict = "ambiguous";
  }

  return {
    verdict,
    qualityScore: score,
    signals,
    rejectionReason,
    fieldChecks: {
      email:   { valid: emailCheck.valid,   issue: emailCheck.issue },
      phone:   { valid: phoneCheck.valid,   issue: phoneCheck.issue },
      name:    { valid: nameCheck.valid,    issue: nameCheck.issue },
      address: { valid: addressCheck.valid, issue: addressCheck.issue },
      date:    { valid: dateCheck.valid,    issue: dateCheck.issue },
    },
    emailCanReceive: emailCheck.emailCanReceive,
  };
}
