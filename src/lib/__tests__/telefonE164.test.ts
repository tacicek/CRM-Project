import { describe, expect, it } from "vitest";
import { istBrauchbareTelefonnummer, normalisiereTelefonE164 } from "@/lib/telefonE164";

/**
 * Die Erwartungen sind an `public.normalize_customer_phone()` geeicht — dieselben
 * Eingaben wie im DB-Test supabase-test/tests/customer-360.sql (Block A).
 */
describe("normalisiereTelefonE164", () => {
  it("fuehrt die drei Schreibweisen aus dem Repo auf denselben Schluessel", () => {
    for (const roh of ["079 123 45 67", "+41 79 123 45 67", "0041791234567", "+41791234567"]) {
      expect(normalisiereTelefonE164(roh)).toBe("+41791234567");
    }
  });

  it("nimmt Trenner in jeder Form", () => {
    expect(normalisiereTelefonE164("(079) 123-45.67")).toBe("+41791234567");
  });

  it("behaelt eine auslaendische Nummer mit ihrer Vorwahl", () => {
    expect(normalisiereTelefonE164("+49 30 12345678")).toBe("+493012345678");
    expect(normalisiereTelefonE164("0049 30 12345678")).toBe("+493012345678");
  });

  it("verwirft eine Nummer ohne erkennbares Praefix, statt zu raten", () => {
    // Genau dieser Fall macht einen Kunden im Abgleich unerreichbar.
    expect(normalisiereTelefonE164("79 123 45 67")).toBeNull();
  });

  it("verwirft zu kurze Nummern", () => {
    expect(normalisiereTelefonE164("+41 79")).toBeNull();
    expect(normalisiereTelefonE164("0791234")).toBeNull();
  });

  it("behandelt leer und null als kein Wert", () => {
    expect(normalisiereTelefonE164("")).toBeNull();
    expect(normalisiereTelefonE164("   ")).toBeNull();
    expect(normalisiereTelefonE164(null)).toBeNull();
    expect(normalisiereTelefonE164(undefined)).toBeNull();
  });
});

describe("istBrauchbareTelefonnummer", () => {
  it("laesst das leere Feld zu — Telefon ist optional", () => {
    expect(istBrauchbareTelefonnummer("")).toBe(true);
    expect(istBrauchbareTelefonnummer(null)).toBe(true);
  });

  it("verlangt von einer gefuellten Nummer, dass sie aufloest", () => {
    expect(istBrauchbareTelefonnummer("079 123 45 67")).toBe(true);
    expect(istBrauchbareTelefonnummer("79 123 45 67")).toBe(false);
  });
});
