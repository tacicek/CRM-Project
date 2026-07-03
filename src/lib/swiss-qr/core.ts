/**
 * Swiss QR-Bill core — PURE layer (Layer 2).
 *
 * This file does not know about DB (Supabase) or UI (React); it takes plain data, produces plain string/PNG.
 * It does not import up or down → fully portable and testable.
 *
 * Norm: SIX "Swiss Implementation Guidelines QR-bill" v2.x, SPC payload v0200.
 * Reference types:
 *   - QR-IBAN (IID 30000–31999) → QRR (27 digits, Modulo-10 recursive) MANDATORY.
 *   - Normal IBAN → SCOR (ISO 11649, RF + Modulo-97) or NON (no reference).
 * A wrong match leads to the bank rejecting the payment → buildQrPayload guards against this.
 */
import QRCode from "qrcode";

export type QrCurrency = "CHF" | "EUR";
export type ReferenceType = "QRR" | "SCOR" | "NON";

export interface QrBillAddress {
  name: string;
  street: string;
  buildingNumber: string;
  postalCode: string;
  town: string;
  /** ISO 3166-1 alpha-2, e.g. "CH" */
  country: string;
}

export interface QrBillInput {
  creditor: QrBillAddress & { iban: string };
  /** The Swiss QR norm makes the debtor optional (can be left empty in the MVP). */
  debtor?: QrBillAddress;
  /** Positive amount, e.g. 250.00. If omitted, an empty Amount field (open-amount invoice). */
  amount?: number;
  currency: QrCurrency;
  /** Unstructured message, e.g. "Rechnung RE-2026-0001". */
  message?: string;
  /**
   * Ready-made reference. If provided, the type is derived from its format (RF… → SCOR, digits-only → QRR).
   * If not provided, no reference (NON) — but NON with a QR-IBAN is forbidden (the guard throws).
   */
  reference?: string;
}

const CRLF = "\r\n";

/** Removes whitespace, converts to uppercase. */
export const cleanIBAN = (iban: string): string =>
  iban.replace(/\s+/g, "").toUpperCase();

/**
 * ISO 7064 Mod-97-10 (ISO 13616). Move the first 4 characters to the end, convert letters to numbers,
 * valid if mod 97 === 1. Only CH/LI IBANs are accepted in a Swiss QR-Bill.
 */
export const validateSwissIBAN = (iban: string): boolean => {
  const c = cleanIBAN(iban);
  if (!/^(CH|LI)[0-9A-Z]{19}$/.test(c)) return false; // CH/LI IBAN = 21 characters
  const rearranged = c.slice(4) + c.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      // A-Z → 10-35
      return code >= 65 && code <= 90 ? String(code - 55) : ch;
    })
    .join("");
  return mod97(numeric) === 1;
};

/** Large number mod 97 piece by piece (string, because it exceeds 53 bits). */
const mod97 = (numeric: string): number => {
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
};

/**
 * Is it a QR-IBAN? The IID (bank code) is IBAN digits 5–9 (index 4–8), range 30000–31999.
 */
export const isQRIBAN = (iban: string): boolean => {
  const c = cleanIBAN(iban);
  if (c.length < 9) return false;
  const iid = Number(c.slice(4, 9));
  return Number.isInteger(iid) && iid >= 30000 && iid <= 31999;
};

/**
 * Modulo-10 recursive (Swiss ESR/QRR check digit).
 * Input: a digits-only string. Output: a single check digit (0–9).
 */
export const mod10Recursive = (digits: string): number => {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const d of digits) {
    if (d < "0" || d > "9") throw new Error(`mod10Recursive: keine Ziffer: ${d}`);
    carry = table[(carry + Number(d)) % 10];
  }
  return (10 - carry) % 10;
};

/**
 * Generates a QRR reference: 27 digits (26-digit right-aligned zero-padded base + 1 check digit).
 * @param raw Invoice-derived numeric base (e.g. produced from the invoice number). Non-digits are dropped.
 */
export const generateQRRReference = (raw: string): string => {
  const base = raw.replace(/\D/g, "");
  if (base.length === 0) throw new Error("generateQRRReference: leere Referenzbasis");
  if (base.length > 26) throw new Error("generateQRRReference: Basis überschreitet 26 Stellen");
  const padded = base.padStart(26, "0");
  return padded + String(mod10Recursive(padded));
};

/** Is the check digit of the given 27-digit QRR reference correct? */
export const isValidQRRReference = (ref: string): boolean => {
  const c = ref.replace(/\s+/g, "");
  if (!/^\d{27}$/.test(c)) return false;
  return mod10Recursive(c.slice(0, 26)) === Number(c[26]);
};

/**
 * SCOR / Creditor Reference (ISO 11649): "RF" + 2-digit check + alphanumeric base.
 * Mod-97: computed over base + "RF00", check = 98 - (mod 97).
 * @param raw Alphanumeric base (max 21 characters). Whitespace is dropped, converted to uppercase.
 */
export const generateSCORReference = (raw: string): string => {
  const base = raw.replace(/\s+/g, "").toUpperCase();
  if (base.length === 0) throw new Error("generateSCORReference: leere Referenzbasis");
  if (!/^[0-9A-Z]{1,21}$/.test(base)) throw new Error("generateSCORReference: ungültiges Zeichen");
  const numeric = (base + "RF00")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 65 && code <= 90 ? String(code - 55) : ch;
    })
    .join("");
  const check = 98 - mod97(numeric);
  return "RF" + String(check).padStart(2, "0") + base;
};

/** Derives the mandatory reference type from the IBAN type (NON if there is no reference base). */
export const referenceTypeForIban = (iban: string): ReferenceType =>
  isQRIBAN(iban) ? "QRR" : "NON";

/** Infers the type of the given reference string from its format. */
const detectReferenceType = (reference: string): ReferenceType => {
  const r = reference.replace(/\s+/g, "");
  if (/^RF/i.test(r)) return "SCOR";
  if (/^\d{27}$/.test(r)) return "QRR";
  return "NON";
};

/** Amount format for the Swiss QR-Bill: 2 decimals, no separator (e.g. "250.00"). */
const formatAmount = (amount: number): string => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Ungültiger Betrag");
  if (amount > 999_999_999.99) throw new Error("Betrag überschreitet die Obergrenze");
  return amount.toFixed(2);
};

const requireAddress = (a: QrBillAddress, label: string): void => {
  if (!a.name?.trim()) throw new Error(`${label}: Name erforderlich`);
  if (!a.postalCode?.trim()) throw new Error(`${label}: PLZ erforderlich (strukturierte Adresse)`);
  if (!a.town?.trim()) throw new Error(`${label}: Ort erforderlich (strukturierte Adresse)`);
  if (!/^[A-Z]{2}$/.test(a.country ?? "")) throw new Error(`${label}: Land muss ISO alpha-2 sein`);
};

/**
 * Builds the 31-field SPC (Swiss Payments Code) payload string (joined with CRLF).
 * Uses a structured address (AdrTp "S"). UltimateCreditor is reserved in v0200 → empty.
 *
 * Guards (CLAUDE.md §5 Rule 1 — no silent fallback, root cause):
 *   - IBAN missing/invalid → error.
 *   - QR-IBAN + (non-QRR reference) → error (bank rejection).
 *   - Normal IBAN + QRR reference → error.
 */
export const buildQrPayload = (input: QrBillInput): string => {
  const iban = cleanIBAN(input.creditor.iban ?? "");
  if (!iban) throw new Error("buildQrPayload: Gläubiger-IBAN erforderlich");
  if (!validateSwissIBAN(iban)) throw new Error(`buildQrPayload: ungültige CH/LI IBAN: ${iban}`);
  requireAddress(input.creditor, "creditor");

  const refType: ReferenceType = input.reference
    ? detectReferenceType(input.reference)
    : "NON";

  // Swiss norm: the reference type must match the IBAN type.
  if (isQRIBAN(iban) && refType !== "QRR") {
    throw new Error("Für QR-IBAN ist eine QRR-Referenz erforderlich (die Bank weist die Zahlung sonst zurück)");
  }
  if (!isQRIBAN(iban) && refType === "QRR") {
    throw new Error("QRR-Referenz ist nur mit QR-IBAN zulässig; für normale IBAN SCOR/NON verwenden");
  }

  const reference = input.reference?.replace(/\s+/g, "") ?? "";
  const debtor = input.debtor;
  if (debtor) requireAddress(debtor, "debtor");

  const fields: string[] = [
    // Header
    "SPC",
    "0200",
    "1",
    // CdtrInf
    iban,
    // Cdtr (structured)
    "S",
    input.creditor.name.trim(),
    input.creditor.street?.trim() ?? "",
    input.creditor.buildingNumber?.trim() ?? "",
    input.creditor.postalCode.trim(),
    input.creditor.town.trim(),
    input.creditor.country.toUpperCase(),
    // UltmtCdtr (reserved — empty)
    "", "", "", "", "", "", "",
    // CcyAmt
    input.amount === undefined ? "" : formatAmount(input.amount),
    input.currency,
    // UltmtDbtr
    debtor ? "S" : "",
    debtor?.name.trim() ?? "",
    debtor?.street?.trim() ?? "",
    debtor?.buildingNumber?.trim() ?? "",
    debtor?.postalCode.trim() ?? "",
    debtor?.town.trim() ?? "",
    debtor ? debtor.country.toUpperCase() : "",
    // RmtInf
    refType,
    reference,
    input.message?.trim() ?? "",
    // Trailer
    "EPD",
  ];

  return fields.join(CRLF);
};

/**
 * SPC payload → QR PNG data URL. errorCorrectionLevel "M" (as the norm requires), margin 0.
 * The Swiss cross mark (7×7mm) is NOT printed here, but in the PDF render layer (Layer 3).
 */
export const renderQrPng = async (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 1024 });
