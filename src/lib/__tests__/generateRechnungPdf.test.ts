import { describe, it, expect } from "vitest";
import { buildRechnungDoc, type RechnungData } from "@/lib/generateRechnungPdf";

const data: RechnungData = {
  rechnung_nr: "RE-2026-0001",
  datum: "2026-06-21",
  faellig_am: "2026-07-21",
  customer_name: "Pia Rutschmann",
  customer_address: "Marktgasse 28\n9400 Rorschach",
  positionen: [
    { beschreibung: "Umzug 3 Mann", menge: 6, einheit: "Std", einzelpreis: 90, betrag: 540 },
    { beschreibung: "Transportpauschale", betrag: 200 },
  ],
  zwischensumme: 740,
  mwst_satz: 8.1,
  mwst_betrag: 59.94,
  total: 799.94,
  company: {
    company_name: "Robert Schneider AG",
    street: "Rue du Lac",
    house_number: "1268",
    plz: "2501",
    city: "Biel",
    iban: "CH9300762011623852957", // normal IBAN → NON reference
  },
};

describe("buildRechnungDoc", () => {
  it("produces a valid PDF (does not throw, meaningful size)", async () => {
    const doc = await buildRechnungDoc(data);
    const out = doc.output("arraybuffer");
    expect(out.byteLength).toBeGreaterThan(2000);
  });

  it("produces a QR-IBAN invoice with QRR reference", async () => {
    const doc = await buildRechnungDoc({
      ...data,
      company: { ...data.company, iban: "CH4431999123000889012" }, // QR-IBAN
      qr_referenz: "210000000003139471430009017", // valid QRR
    });
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(2000);
  });

  it("QR-IBAN + no reference → the buildQrPayload guard throws", async () => {
    await expect(
      buildRechnungDoc({ ...data, company: { ...data.company, iban: "CH4431999123000889012" } })
    ).rejects.toThrow();
  });
});
