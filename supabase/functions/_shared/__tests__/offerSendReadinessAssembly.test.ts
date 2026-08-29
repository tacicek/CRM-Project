import { describe, expect, it } from "vitest";
import { buildOfferSendReadiness, type OfferSendReadinessRohdaten } from "../offerSendReadiness";
import { resolveLocalizedRowField } from "../localizedRow";

/**
 * Der Zusammenbau, den `send-offer` benutzt — mit Eingabe und Ausgabe geprüft.
 *
 * Bis zum 2026-08-28 stand er inline im Handler, und ein Quelltext-Tor suchte
 * nach seinen Literalen. Die unabhängige Durchsicht hat das Tor mit einer
 * Zuweisung EINE ZEILE über dem `if` ausgehebelt: jedes gesuchte Literal blieb
 * stehen, die Prüfung war trotzdem tot. Eine Textsuche belegt Anwesenheit,
 * nicht Wirkung — deshalb diese Datei.
 */

const agb = (fr?: { title?: string; content?: string }) => ({
  id: "agb-1",
  title: "Allgemeine Geschäftsbedingungen",
  content: "Zahlbar innert 30 Tagen.",
  translations: fr ? { fr } : {},
});

const roh = (o: Partial<OfferSendReadinessRohdaten> = {}): OfferSendReadinessRohdaten => ({
  offerLanguage: "fr",
  paymentTerms: null,
  paymentTermsFromOfferRow: true,
  companyId: "firma-1",
  agbSections: [agb({ title: "Conditions générales", content: "Payable sous 30 jours." })],
  declaredAttachmentLocale: "fr",
  hasAttachments: true,
  ...o,
});

const codes = (r: ReturnType<typeof buildOfferSendReadiness>) => r.blockers.map((b) => b.code);

describe("Vollständig übersetzte französische Offerte", () => {
  it("geht durch", () => {
    const r = buildOfferSendReadiness(roh(), resolveLocalizedRowField);
    expect(r.ok).toBe(true);
  });
});

describe("Die Dokumentsprache", () => {
  it("fehlt sie, wird nicht auf Deutsch gerundet", () => {
    for (const l of [undefined, null, ""]) {
      const r = buildOfferSendReadiness(roh({ offerLanguage: l }), resolveLocalizedRowField);
      expect(r.ok).toBe(false);
      expect(codes(r)).toEqual(["MISSING_LOCALE"]);
    }
  });

  it("ist sie unbekannt, wird sie abgewiesen", () => {
    for (const l of ["it", "de-CH", "DE", 7]) {
      expect(codes(buildOfferSendReadiness(roh({ offerLanguage: l }), resolveLocalizedRowField)))
        .toEqual(["UNSUPPORTED_LOCALE"]);
    }
  });
});

describe("AGB ohne französische Fassung", () => {
  it("blockieren den Versand und benennen beide Felder", () => {
    const r = buildOfferSendReadiness(
      roh({ agbSections: [agb()] }),   // keine fr-Übersetzung
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(false);
    expect(r.blockers.map((b) => `${b.code}:${b.entity}.${b.field}`)).toEqual([
      "GERMAN_FALLBACK:agb_section.title",
      "GERMAN_FALLBACK:agb_section.content",
    ]);
    expect(r.blockers[0].entityId).toBe("agb-1");
  });

  it("halb übersetzt zählt als nicht übersetzt", () => {
    const r = buildOfferSendReadiness(
      roh({ agbSections: [agb({ title: "Conditions générales" })] }),
      resolveLocalizedRowField,
    );
    expect(codes(r)).toEqual(["GERMAN_FALLBACK"]);
    expect(r.blockers[0].field).toBe("content");
  });

  it("bei einer deutschen Offerte sind dieselben Zeilen in Ordnung", () => {
    const r = buildOfferSendReadiness(
      roh({ offerLanguage: "de", declaredAttachmentLocale: "de", agbSections: [agb()] }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(true);
  });
});

describe("Zahlungskondition", () => {
  it("aus der Offerte selbst ist eingefroren und wird nicht geprüft", () => {
    const r = buildOfferSendReadiness(
      roh({ paymentTerms: "Payable sous 30 jours", paymentTermsFromOfferRow: true }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(true);
  });

  it("aus der Firmenspalte ist bei fr/en der deutsche Rückfall", () => {
    const r = buildOfferSendReadiness(
      roh({ paymentTerms: "Zahlbar innert 30 Tagen", paymentTermsFromOfferRow: false }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(false);
    expect(r.blockers.map((b) => b.field)).toContain("default_payment_terms");
  });

  it("aus der Firmenspalte ist bei einer deutschen Offerte in Ordnung", () => {
    const r = buildOfferSendReadiness(
      roh({
        offerLanguage: "de", declaredAttachmentLocale: "de",
        paymentTerms: "Zahlbar innert 30 Tagen", paymentTermsFromOfferRow: false,
        agbSections: [agb()],
      }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(true);
  });
});

describe("Die Sprache der mitgeschickten Anhänge", () => {
  it("fehlt sie, obwohl Anhänge da sind, blockiert das — der Aufrufer ist veraltet", () => {
    // Genau der Fall aus der Durchsicht: ein alter Bundle rendert deutsch und
    // hängt es an eine französische Offerte. Vorher verglich die Prüfung einen
    // Wert mit sich selbst und liess ihn durch.
    const r = buildOfferSendReadiness(
      roh({ declaredAttachmentLocale: undefined }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(["LOCALE_MISMATCH"]);
    expect(r.blockers[0].field).toBe("attachment_locale");
  });

  it("weicht sie von der Dokumentsprache ab, blockiert das", () => {
    const r = buildOfferSendReadiness(
      roh({ declaredAttachmentLocale: "de" }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(["LOCALE_MISMATCH"]);
    expect(r.blockers[0].fallbackLocale).toBe("de");
  });

  it("ohne Anhänge wird nichts über Anhänge behauptet", () => {
    const r = buildOfferSendReadiness(
      roh({ hasAttachments: false, declaredAttachmentLocale: undefined }),
      resolveLocalizedRowField,
    );
    expect(r.ok).toBe(true);
  });
});

describe("Eigenschaften", () => {
  it("ist deterministisch und verändert die Eingabe nicht", () => {
    const e = roh({ agbSections: [agb()] });
    const kopie = JSON.parse(JSON.stringify(e));
    const a = buildOfferSendReadiness(e, resolveLocalizedRowField);
    const b = buildOfferSendReadiness(e, resolveLocalizedRowField);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(e))).toEqual(kopie);
  });
});
