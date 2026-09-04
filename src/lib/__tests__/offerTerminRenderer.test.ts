import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveOfferTermin } from "../../../supabase/functions/_shared/offerTermin.ts";

/**
 * STOLPERDRAHT: liest noch irgendein Renderer das rohe Feld?
 *
 * Der Fehler, den diese Datei festhält, war keine falsche Rechnung, sondern
 * ZWEI Rechnungen. `offers.service_date` und `offer_items.scheduled_date`
 * beantworten dieselbe Frage, und die Vorlagen entschieden verschieden, welche
 * gilt. In `OfferPDFModern` standen beide Reihenfolgen in derselben Datei,
 * vierzehn Zeilen auseinander:
 *
 *     const terminDate = data.executionDate ?? groupScheduled(...)   // global zuerst
 *     const date = sched?.date ?? data.executionDate;                // Gruppe zuerst
 *
 * Offerte 10098 druckte deshalb in den Bändern den 02.10. und in «Auf einen
 * Blick» den 04.09. Betroffen war die Firma auf der Vorlage `modern`; die
 * klassische Vorlage hatte die Regel richtig und erklärte sie sogar im
 * Kommentar.
 *
 * Was die Regel RECHNET, steht in `offerTermin.test.ts`. Hier steht nur, dass
 * keiner der Renderer wieder anfängt, selbst zu entscheiden.
 */

const quelle = (...pfad: string[]): string =>
  readFileSync(join(__dirname, "..", "..", ...pfad), "utf8");

const RENDERER: Array<{ name: string; text: string }> = [
  { name: "OfferPDFModern", text: quelle("components", "pdf", "OfferPDFModern.tsx") },
  { name: "ServiceTable", text: quelle("components", "pdf", "components", "ServiceTable.tsx") },
  { name: "AddressComparison", text: quelle("components", "pdf", "components", "AddressComparison.tsx") },
  { name: "TitleSection", text: quelle("components", "pdf", "components", "TitleSection.tsx") },
  { name: "SignaturePage", text: quelle("components", "pdf", "components", "SignaturePage.tsx") },
  { name: "OfferteDetail", text: quelle("pages", "firma", "OfferteDetail.tsx") },
  { name: "OfferView", text: quelle("pages", "public", "OfferView.tsx") },
];

describe("Jeder Renderer fragt dieselbe Termin-Regel", () => {
  it.each(RENDERER)("$name importiert offerTermin", ({ text }) => {
    expect(text).toContain("_shared/offerTermin.ts");
  });

  it("keine Vorlage entscheidet die Reihenfolge mehr selbst", () => {
    // Die beiden Formen, in denen die Frage früher beantwortet wurde.
    for (const { name, text } of RENDERER) {
      expect(text, `${name} liest global-zuerst`).not.toMatch(
        /executionDate\s*\?\?\s*.*groupScheduled/,
      );
      expect(text, `${name} liest gruppe-zuerst von Hand`).not.toMatch(
        /sched\?\.date\s*\?\?\s*data\.executionDate/,
      );
    }
  });

  it("die Kopfzeilen drucken den aufgelösten Termin, nicht das rohe Feld", () => {
    const modern = RENDERER.find((r) => r.name === "OfferPDFModern")!.text;
    expect(modern).toContain("resolveOfferTermin(data.items, data.executionDate)");
    // Zusammenfassung und «Auf einen Blick» nennen dieselbe Zahl.
    expect(modern).not.toMatch(/formatDate\(data\.executionDate, locale\)/);

    for (const name of ["TitleSection", "SignaturePage", "AddressComparison"]) {
      const text = RENDERER.find((r) => r.name === name)!.text;
      expect(text, `${name} druckt noch das rohe Feld`).not.toMatch(
        /formatDate\(data\.executionDate, locale\)/,
      );
    }
  });

  it("Oberfläche und Kundenseite zeigen denselben Termin wie das Dokument", () => {
    const detail = RENDERER.find((r) => r.name === "OfferteDetail")!.text;
    const view = RENDERER.find((r) => r.name === "OfferView")!.text;
    expect(detail).toContain("formatDate(terminDate)");
    expect(detail).not.toContain("formatDate(offer.service_date)");
    expect(view).toContain("showDate(terminDate)");
    expect(view).not.toContain("showDate(offer.service_date)");
  });
});

describe("Die Regel selbst, an der Zeile aus der Produktion", () => {
  it("10098 hätte 02.10. gedruckt statt des Anlagetags", () => {
    const positionen = Array.from({ length: 7 }, () => ({
      serviceType: "umzug",
      scheduledDate: "2026-10-02",
    }));
    expect(resolveOfferTermin(positionen, "2026-09-04")).toBe("2026-10-02");
  });

  it("die 91 Offerten ohne Gruppendatum ändern sich nicht", () => {
    const positionen = [{ serviceType: "umzug", scheduledDate: null }];
    expect(resolveOfferTermin(positionen, "2026-09-15")).toBe("2026-09-15");
  });
});
