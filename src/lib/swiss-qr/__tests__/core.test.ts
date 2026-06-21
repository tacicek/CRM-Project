import { describe, it, expect } from "vitest";
import {
  cleanIBAN,
  validateSwissIBAN,
  isQRIBAN,
  mod10Recursive,
  generateQRRReference,
  isValidQRRReference,
  generateSCORReference,
  referenceTypeForIban,
  buildQrPayload,
  renderQrPng,
  type QrBillInput,
} from "@/lib/swiss-qr/core";

// SIX resmi örnekleri
const NORMAL_IBAN = "CH9300762011623852957"; // IID 00762 → normal IBAN (kanonik geçerli örnek)
const QR_IBAN = "CH4431999123000889012"; // IID 31999 → QR-IBAN (SIX örneği)

const creditor = {
  iban: NORMAL_IBAN,
  name: "Robert Schneider AG",
  street: "Rue du Lac",
  buildingNumber: "1268",
  postalCode: "2501",
  town: "Biel",
  country: "CH",
};

describe("cleanIBAN", () => {
  it("boşlukları kaldırır ve büyük harfe çevirir", () => {
    expect(cleanIBAN("ch93 0076 2011 6238 5295 7")).toBe(NORMAL_IBAN);
  });
});

describe("validateSwissIBAN", () => {
  it("geçerli CH IBAN'ı kabul eder (boşluklu da)", () => {
    expect(validateSwissIBAN("CH93 0076 2011 6238 5295 7")).toBe(true);
    expect(validateSwissIBAN(QR_IBAN)).toBe(true);
  });
  it("bozulmuş IBAN'ı reddeder", () => {
    expect(validateSwissIBAN("CH9300762011623852958")).toBe(false); // son hane değişti
  });
  it("CH/LI dışını ve yanlış uzunluğu reddeder", () => {
    expect(validateSwissIBAN("DE89370400440532013000")).toBe(false);
    expect(validateSwissIBAN("CH93")).toBe(false);
  });
});

describe("isQRIBAN", () => {
  it("IID 30000–31999 aralığını QR-IBAN sayar", () => {
    expect(isQRIBAN(QR_IBAN)).toBe(true);
  });
  it("normal IBAN'ı QR-IBAN saymaz", () => {
    expect(isQRIBAN(NORMAL_IBAN)).toBe(false);
  });
});

describe("mod10Recursive + QRR", () => {
  // SIX kanonik QRR örneği: 210000000003139471430009017 (26 hane taban + çek hanesi 7)
  it("kanonik SIX örneğini doğrular", () => {
    expect(isValidQRRReference("210000000003139471430009017")).toBe(true);
  });
  it("tabandan 27 haneli QRR üretir (kanonik örnekle eşleşir)", () => {
    expect(generateQRRReference("21000000000313947143000901")).toBe(
      "210000000003139471430009017"
    );
  });
  it("üretilen referans kendi doğrulamasını geçer (round-trip)", () => {
    const ref = generateQRRReference("2026000000000000000000123");
    expect(isValidQRRReference(ref)).toBe(true);
    expect(ref).toHaveLength(27);
  });
  it("rakam dışı karakterde hata fırlatır", () => {
    expect(() => mod10Recursive("12A4")).toThrow();
  });
});

describe("generateSCORReference (ISO 11649)", () => {
  it("kanonik RF örneğini üretir", () => {
    // ISO 11649 referans örneği: taban 539007547034 → RF18539007547034
    expect(generateSCORReference("539007547034")).toBe("RF18539007547034");
  });
  it("boş tabanda hata fırlatır", () => {
    expect(() => generateSCORReference("")).toThrow();
  });
});

describe("referenceTypeForIban", () => {
  it("QR-IBAN → QRR, normal → NON", () => {
    expect(referenceTypeForIban(QR_IBAN)).toBe("QRR");
    expect(referenceTypeForIban(NORMAL_IBAN)).toBe("NON");
  });
});

describe("buildQrPayload", () => {
  const base: QrBillInput = { creditor, amount: 250, currency: "CHF", message: "Rechnung RE-2026-0001" };

  it("31 alanlı, SPC/0200 ile başlar, EPD ile biter", () => {
    const out = buildQrPayload(base);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(31);
    expect(lines[0]).toBe("SPC");
    expect(lines[1]).toBe("0200");
    expect(lines[3]).toBe(NORMAL_IBAN);
    expect(lines[30]).toBe("EPD");
  });

  it("tutarı 2 ondalıkla yazar, NON referans boş kalır", () => {
    const lines = buildQrPayload(base).split("\r\n");
    expect(lines[18]).toBe("250.00");
    expect(lines[19]).toBe("CHF");
    expect(lines[27]).toBe("NON"); // RefTp
    expect(lines[28]).toBe(""); // Ref
  });

  it("tutarsız (açık) fatura için Amount boş bırakılır", () => {
    const lines = buildQrPayload({ ...base, amount: undefined }).split("\r\n");
    expect(lines[18]).toBe("");
  });

  it("QR-IBAN + QRR referans çalışır ve QRR yazar", () => {
    const ref = "210000000003139471430009017";
    const lines = buildQrPayload({ ...base, creditor: { ...creditor, iban: QR_IBAN }, reference: ref }).split("\r\n");
    expect(lines[27]).toBe("QRR");
    expect(lines[28]).toBe(ref);
  });

  it("debtor verilince structured 'S' bloğu dolar", () => {
    const lines = buildQrPayload({
      ...base,
      debtor: { name: "Pia Rutschmann", street: "Marktgasse", buildingNumber: "28", postalCode: "9400", town: "Rorschach", country: "CH" },
    }).split("\r\n");
    expect(lines[20]).toBe("S"); // UltmtDbtr AdrTp
    expect(lines[21]).toBe("Pia Rutschmann");
    expect(lines[26]).toBe("CH");
  });

  it("QR-IBAN + NON → hata (banka reddi)", () => {
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: QR_IBAN } })).toThrow();
  });

  it("normal IBAN + QRR referans → hata", () => {
    expect(() => buildQrPayload({ ...base, reference: "210000000003139471430009017" })).toThrow();
  });

  it("IBAN yoksa/geçersizse → hata (sessiz fallback yok)", () => {
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: "" } })).toThrow();
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: "CH9300762011623852958" } })).toThrow();
  });
});

describe("renderQrPng", () => {
  it("PNG data URL döner", async () => {
    const png = await renderQrPng(buildQrPayload({ creditor, amount: 100, currency: "CHF" }));
    expect(png.startsWith("data:image/png;base64,")).toBe(true);
  });
});
