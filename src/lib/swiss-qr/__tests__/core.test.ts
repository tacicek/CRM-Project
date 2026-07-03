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

// Official SIX examples
const NORMAL_IBAN = "CH9300762011623852957"; // IID 00762 → normal IBAN (canonical valid example)
const QR_IBAN = "CH4431999123000889012"; // IID 31999 → QR-IBAN (SIX example)

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
  it("removes whitespace and converts to uppercase", () => {
    expect(cleanIBAN("ch93 0076 2011 6238 5295 7")).toBe(NORMAL_IBAN);
  });
});

describe("validateSwissIBAN", () => {
  it("accepts a valid CH IBAN (also with whitespace)", () => {
    expect(validateSwissIBAN("CH93 0076 2011 6238 5295 7")).toBe(true);
    expect(validateSwissIBAN(QR_IBAN)).toBe(true);
  });
  it("rejects a corrupted IBAN", () => {
    expect(validateSwissIBAN("CH9300762011623852958")).toBe(false); // last digit changed
  });
  it("rejects non-CH/LI and wrong length", () => {
    expect(validateSwissIBAN("DE89370400440532013000")).toBe(false);
    expect(validateSwissIBAN("CH93")).toBe(false);
  });
});

describe("isQRIBAN", () => {
  it("counts the IID 30000–31999 range as QR-IBAN", () => {
    expect(isQRIBAN(QR_IBAN)).toBe(true);
  });
  it("does not count a normal IBAN as QR-IBAN", () => {
    expect(isQRIBAN(NORMAL_IBAN)).toBe(false);
  });
});

describe("mod10Recursive + QRR", () => {
  // SIX canonical QRR example: 210000000003139471430009017 (26-digit base + check digit 7)
  it("validates the canonical SIX example", () => {
    expect(isValidQRRReference("210000000003139471430009017")).toBe(true);
  });
  it("generates a 27-digit QRR from the base (matches the canonical example)", () => {
    expect(generateQRRReference("21000000000313947143000901")).toBe(
      "210000000003139471430009017"
    );
  });
  it("the generated reference passes its own validation (round-trip)", () => {
    const ref = generateQRRReference("2026000000000000000000123");
    expect(isValidQRRReference(ref)).toBe(true);
    expect(ref).toHaveLength(27);
  });
  it("throws on a non-digit character", () => {
    expect(() => mod10Recursive("12A4")).toThrow();
  });
});

describe("generateSCORReference (ISO 11649)", () => {
  it("generates the canonical RF example", () => {
    // ISO 11649 reference example: base 539007547034 → RF18539007547034
    expect(generateSCORReference("539007547034")).toBe("RF18539007547034");
  });
  it("throws on an empty base", () => {
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

  it("31 fields, starts with SPC/0200, ends with EPD", () => {
    const out = buildQrPayload(base);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(31);
    expect(lines[0]).toBe("SPC");
    expect(lines[1]).toBe("0200");
    expect(lines[3]).toBe(NORMAL_IBAN);
    expect(lines[30]).toBe("EPD");
  });

  it("writes the amount with 2 decimals, NON reference stays empty", () => {
    const lines = buildQrPayload(base).split("\r\n");
    expect(lines[18]).toBe("250.00");
    expect(lines[19]).toBe("CHF");
    expect(lines[27]).toBe("NON"); // RefTp
    expect(lines[28]).toBe(""); // Ref
  });

  it("for an amountless (open) invoice the Amount is left empty", () => {
    const lines = buildQrPayload({ ...base, amount: undefined }).split("\r\n");
    expect(lines[18]).toBe("");
  });

  it("QR-IBAN + QRR reference works and writes QRR", () => {
    const ref = "210000000003139471430009017";
    const lines = buildQrPayload({ ...base, creditor: { ...creditor, iban: QR_IBAN }, reference: ref }).split("\r\n");
    expect(lines[27]).toBe("QRR");
    expect(lines[28]).toBe(ref);
  });

  it("when a debtor is given the structured 'S' block is filled", () => {
    const lines = buildQrPayload({
      ...base,
      debtor: { name: "Pia Rutschmann", street: "Marktgasse", buildingNumber: "28", postalCode: "9400", town: "Rorschach", country: "CH" },
    }).split("\r\n");
    expect(lines[20]).toBe("S"); // UltmtDbtr AdrTp
    expect(lines[21]).toBe("Pia Rutschmann");
    expect(lines[26]).toBe("CH");
  });

  it("QR-IBAN + NON → error (bank rejection)", () => {
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: QR_IBAN } })).toThrow();
  });

  it("normal IBAN + QRR reference → error", () => {
    expect(() => buildQrPayload({ ...base, reference: "210000000003139471430009017" })).toThrow();
  });

  it("IBAN missing/invalid → error (no silent fallback)", () => {
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: "" } })).toThrow();
    expect(() => buildQrPayload({ ...base, creditor: { ...creditor, iban: "CH9300762011623852958" } })).toThrow();
  });
});

describe("renderQrPng", () => {
  it("returns a PNG data URL", async () => {
    const png = await renderQrPng(buildQrPayload({ creditor, amount: 100, currency: "CHF" }));
    expect(png.startsWith("data:image/png;base64,")).toBe(true);
  });
});
