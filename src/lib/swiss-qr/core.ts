/**
 * Swiss QR-Bill çekirdeği — SAF katman (Katman 2).
 *
 * Bu dosya DB (Supabase) ya da UI (React) bilmez; düz veri alır, düz string/PNG üretir.
 * Yukarıyı veya aşağıyı import etmez → tam taşınabilir ve test edilebilir.
 *
 * Norm: SIX "Swiss Implementation Guidelines QR-bill" v2.x, SPC payload v0200.
 * Referans tipleri:
 *   - QR-IBAN (IID 30000–31999) → QRR (27 hane, Modulo-10 rekursiv) ZORUNLU.
 *   - Normal IBAN → SCOR (ISO 11649, RF + Modulo-97) veya NON (referanssız).
 * Yanlış eşleşme bankada ödeme reddine yol açar → buildQrPayload bunu guard'lar.
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
  /** ISO 3166-1 alpha-2, ör. "CH" */
  country: string;
}

export interface QrBillInput {
  creditor: QrBillAddress & { iban: string };
  /** Swiss QR normu debtor'ı opsiyonel kılar (MVP'de boş bırakılabilir). */
  debtor?: QrBillAddress;
  /** Pozitif tutar, ör. 250.00. Atlanırsa boş Amount alanı (açık tutarlı fatura). */
  amount?: number;
  currency: QrCurrency;
  /** Yapılandırılmamış mesaj, ör. "Rechnung RE-2026-0001". */
  message?: string;
  /**
   * Hazır referans. Verilirse formatından tip türetilir (RF… → SCOR, salt rakam → QRR).
   * Verilmezse referanssız (NON) — ancak QR-IBAN ile NON yasaktır (guard fırlatır).
   */
  reference?: string;
}

const CRLF = "\r\n";

/** Boşlukları kaldırır, büyük harfe çevirir. */
export const cleanIBAN = (iban: string): string =>
  iban.replace(/\s+/g, "").toUpperCase();

/**
 * ISO 7064 Mod-97-10 (ISO 13616). İlk 4 karakteri sona taşı, harfleri sayıya çevir,
 * mod 97 === 1 ise geçerli. Yalnızca CH/LI IBAN'ları Swiss QR-Bill'de kabul edilir.
 */
export const validateSwissIBAN = (iban: string): boolean => {
  const c = cleanIBAN(iban);
  if (!/^(CH|LI)[0-9A-Z]{19}$/.test(c)) return false; // CH/LI IBAN = 21 karakter
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

/** Büyük sayıyı parça parça mod 97 (string, çünkü 53 bit'i aşar). */
const mod97 = (numeric: string): number => {
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
};

/**
 * QR-IBAN mı? IID (banka kodu) IBAN'ın 5.–9. haneleri (index 4–8), aralık 30000–31999.
 */
export const isQRIBAN = (iban: string): boolean => {
  const c = cleanIBAN(iban);
  if (c.length < 9) return false;
  const iid = Number(c.slice(4, 9));
  return Number.isInteger(iid) && iid >= 30000 && iid <= 31999;
};

/**
 * Modulo-10 rekursiv (Swiss ESR/QRR çek hanesi).
 * Giriş: yalnızca rakam içeren string. Çıkış: tek haneli çek rakamı (0–9).
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
 * QRR referansı üretir: 27 hane (26 hane sağ-hizalı sıfır dolgulu taban + 1 çek hanesi).
 * @param raw Fatura türevi sayısal taban (ör. fatura no'dan üretilmiş). Rakam dışı atılır.
 */
export const generateQRRReference = (raw: string): string => {
  const base = raw.replace(/\D/g, "");
  if (base.length === 0) throw new Error("generateQRRReference: leere Referenzbasis");
  if (base.length > 26) throw new Error("generateQRRReference: Basis überschreitet 26 Stellen");
  const padded = base.padStart(26, "0");
  return padded + String(mod10Recursive(padded));
};

/** Verilen 27 haneli QRR referansının çek hanesi doğru mu? */
export const isValidQRRReference = (ref: string): boolean => {
  const c = ref.replace(/\s+/g, "");
  if (!/^\d{27}$/.test(c)) return false;
  return mod10Recursive(c.slice(0, 26)) === Number(c[26]);
};

/**
 * SCOR / Creditor Reference (ISO 11649): "RF" + 2 haneli çek + alfanümerik taban.
 * Mod-97: taban + "RF00" üzerinden hesaplanır, çek = 98 - (mod 97).
 * @param raw Alfanümerik taban (max 21 karakter). Boşluklar atılır, büyük harfe çevrilir.
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

/** IBAN tipinden zorunlu referans tipini türetir (referans tabanı yoksa NON). */
export const referenceTypeForIban = (iban: string): ReferenceType =>
  isQRIBAN(iban) ? "QRR" : "NON";

/** Verilen referans string'inin tipini formatından çıkarır. */
const detectReferenceType = (reference: string): ReferenceType => {
  const r = reference.replace(/\s+/g, "");
  if (/^RF/i.test(r)) return "SCOR";
  if (/^\d{27}$/.test(r)) return "QRR";
  return "NON";
};

/** Swiss QR-Bill için tutar formatı: 2 ondalık, ayraçsız (ör. "250.00"). */
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
 * 31 alanlık SPC (Swiss Payments Code) payload string'ini kurar (CRLF ile birleştirilir).
 * Structured adres (AdrTp "S") kullanır. UltimateCreditor v0200'de rezerve → boş.
 *
 * Guard'lar (CLAUDE.md §5 Kural 1 — sessiz fallback yok, kök neden):
 *   - IBAN yoksa/geçersizse → hata.
 *   - QR-IBAN + (QRR olmayan referans) → hata (banka reddi).
 *   - Normal IBAN + QRR referans → hata.
 */
export const buildQrPayload = (input: QrBillInput): string => {
  const iban = cleanIBAN(input.creditor.iban ?? "");
  if (!iban) throw new Error("buildQrPayload: Gläubiger-IBAN erforderlich");
  if (!validateSwissIBAN(iban)) throw new Error(`buildQrPayload: ungültige CH/LI IBAN: ${iban}`);
  requireAddress(input.creditor, "creditor");

  const refType: ReferenceType = input.reference
    ? detectReferenceType(input.reference)
    : "NON";

  // İsviçre normu: referans tipi IBAN tipiyle uyumlu olmalı.
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
    // UltmtCdtr (rezerve — boş)
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
 * SPC payload → QR PNG data URL. errorCorrectionLevel "M" (norm gereği), margin 0.
 * İsviçre çapraz işareti (7×7mm) burada DEĞİL, PDF render katmanında (Katman 3) basılır.
 */
export const renderQrPng = async (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 1024 });
