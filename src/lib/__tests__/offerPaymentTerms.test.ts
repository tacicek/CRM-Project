import { describe, expect, it } from "vitest";
import { localizeStandardPaymentTerms } from "@/lib/offerPaymentTerms";

describe("localizeStandardPaymentTerms", () => {
  it("translates a stored German system default into the customer's French", () => {
    expect(localizeStandardPaymentTerms("Barzahlung nach der Ausführung", "fr"))
      .toBe("Paiement comptant après l'exécution");
  });

  it("translates standard terms regardless of their source locale", () => {
    expect(localizeStandardPaymentTerms("Payment within 14 days net", "de"))
      .toBe("Zahlung innerhalb 14 Tagen netto");
  });

  it("preserves bespoke company-authored wording", () => {
    const custom = "50% bei Auftragserteilung, Rest nach Abnahme";
    expect(localizeStandardPaymentTerms(custom, "fr")).toBe(custom);
  });

  it("handles empty values", () => {
    expect(localizeStandardPaymentTerms(null, "fr")).toBeNull();
    expect(localizeStandardPaymentTerms("   ", "fr")).toBeNull();
  });
});
