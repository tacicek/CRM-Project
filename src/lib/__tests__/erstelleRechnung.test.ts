import { describe, it, expect } from "vitest";
import {
  erstelleRechnungAusAuftrag,
  computeQrReference,
  type AuftragInput,
  type OfferItemInput,
} from "@/lib/erstelleRechnung";
import { isValidQRRReference } from "@/lib/swiss-qr/core";

const auftrag: AuftragInput = {
  id: "auf-1",
  company_id: "comp-1",
  offer_id: "off-1",
  status: "abgeschlossen",
  customer_name: "Pia Rutschmann",
  customer_email: "pia@example.ch",
  customer_phone: "079 000 00 00",
  from_address: "Marktgasse 28, 9400 Rorschach",
  to_address: "Seestrasse 5, 8002 Zürich",
  vat_rate: null,
};

const items: OfferItemInput[] = [
  { description: "Umzug 3 Mann", quantity: 6, unit: "Std", unit_price: 90, total: 540 },
  { description: "Transportpauschale", quantity: 1, unit: null, unit_price: 200, total: null },
  { description: "  ", quantity: 1, unit: null, unit_price: 10, total: 10 }, // boş → atılır
];

const company = { iban: "CH9300762011623852957" }; // normal IBAN

describe("erstelleRechnungAusAuftrag", () => {
  it("abgeschlossen olmayan Auftrag'ı reddeder", () => {
    expect(() => erstelleRechnungAusAuftrag({ ...auftrag, status: "in_bearbeitung" }, items, company)).toThrow();
  });

  it("IBAN yoksa hata fırlatır", () => {
    expect(() => erstelleRechnungAusAuftrag(auftrag, items, { iban: "" })).toThrow();
  });

  it("offer_items'ı positionen'e map eder (boş açıklamalı atılır)", () => {
    const r = erstelleRechnungAusAuftrag(auftrag, items, company);
    expect(r.positionen).toHaveLength(2);
    expect(r.positionen[0]).toEqual({
      beschreibung: "Umzug 3 Mann",
      menge: 6,
      einheit: "Std",
      einzelpreis: 90,
      betrag: 540,
    });
    // total yoksa menge*einzelpreis
    expect(r.positionen[1].betrag).toBe(200);
  });

  it("toplamları MwSt 8.1% ile hesaplar", () => {
    const r = erstelleRechnungAusAuftrag(auftrag, items, company);
    expect(r.zwischensumme).toBe(740);
    expect(r.mwst_satz).toBe(8.1);
    expect(r.mwst_betrag).toBe(59.94);
    expect(r.total).toBe(799.94);
    expect(r.gesamttotal).toBe(799.94);
    expect(r.rabatt).toBe(0);
  });

  it("auftrag.vat_rate verilirse onu kullanır", () => {
    const r = erstelleRechnungAusAuftrag({ ...auftrag, vat_rate: 2.6 }, items, company);
    expect(r.mwst_satz).toBe(2.6);
    expect(r.mwst_betrag).toBe(19.24);
  });

  it("customer + zincir alanlarını snapshot'lar", () => {
    const r = erstelleRechnungAusAuftrag(auftrag, items, company);
    expect(r.auftrag_id).toBe("auf-1");
    expect(r.offer_id).toBe("off-1");
    expect(r.company_id).toBe("comp-1");
    expect(r.customer_address).toBe("Marktgasse 28, 9400 Rorschach");
    expect(r.customer_destination).toBe("Seestrasse 5, 8002 Zürich");
    expect(r.qr_iban).toBe("CH9300762011623852957");
    expect(r.qr_referenz).toBeNull();
    expect(r.status).toBe("entwurf");
  });

  it("schliesst optionale und inklusive Positionen aus (keine Überberechnung)", () => {
    const mitFreiPositionen: OfferItemInput[] = [
      { description: "Umzug pauschal", quantity: 1, unit: null, unit_price: 1000, total: 1000, price_type: "pauschale" },
      { description: "Einpackservice (optional)", quantity: 1, unit: null, unit_price: 300, total: 300, price_type: "optional" },
      { description: "Kartons inklusive", quantity: 10, unit: "Stk", unit_price: 0, total: 0, price_type: "inkl" },
    ];
    const r = erstelleRechnungAusAuftrag(auftrag, mitFreiPositionen, company);
    expect(r.positionen).toHaveLength(1);
    expect(r.positionen[0].beschreibung).toBe("Umzug pauschal");
    expect(r.zwischensumme).toBe(1000);
  });
});

describe("computeQrReference", () => {
  it("QR-IBAN → rechnung_nr'dan geçerli QRR üretir", () => {
    const ref = computeQrReference("RE-2026-0001", "CH4431999123000889012");
    expect(ref).not.toBeNull();
    expect(isValidQRRReference(ref as string)).toBe(true);
  });

  it("normal IBAN → NON (null)", () => {
    expect(computeQrReference("RE-2026-0001", "CH9300762011623852957")).toBeNull();
  });
});
