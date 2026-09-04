import { describe, expect, it } from "vitest";
import {
  groupTermin,
  hasGroupTermine,
  resolveOfferTermin,
  type TerminItem,
} from "../offerTermin.ts";

const pos = (serviceType: string | null, scheduledDate: string | null = null): TerminItem => ({
  serviceType,
  scheduledDate,
});

describe("hasGroupTermine", () => {
  it("erkennt ein einziges eigenes Datum", () => {
    expect(hasGroupTermine([pos("umzug"), pos("reinigung", "2026-10-02")])).toBe(true);
    expect(hasGroupTermine([pos("umzug"), pos("reinigung")])).toBe(false);
    expect(hasGroupTermine([])).toBe(false);
  });
});

describe("groupTermin", () => {
  it("das eigene Datum der Gruppe gewinnt", () => {
    expect(groupTermin([pos("umzug", "2026-10-02")], "2026-09-04")).toBe("2026-10-02");
  });

  it("ohne eigenes Datum gilt das globale — die Zusage aus dem Formular", () => {
    expect(groupTermin([pos("umzug")], "2026-09-04")).toBe("2026-09-04");
    expect(groupTermin([pos("umzug")], null)).toBeNull();
  });
});

describe("resolveOfferTermin", () => {
  it("ohne Gruppendaten bleibt das globale Feld der Termin (Altverhalten)", () => {
    expect(resolveOfferTermin([pos("umzug"), pos("umzug")], "2026-09-04")).toBe("2026-09-04");
    expect(resolveOfferTermin([], "2026-09-04")).toBe("2026-09-04");
    expect(resolveOfferTermin([pos("umzug")], null)).toBeNull();
  });

  it("Offerte 10098: eine Gruppe mit eigenem Datum schlägt das globale Feld", () => {
    // Sieben Positionen, alle 'umzug', alle auf den 02.10. Das globale Feld trug
    // den Anlagetag. Gedruckt wurde bisher der Anlagetag.
    const items = Array.from({ length: 7 }, () => pos("umzug", "2026-10-02"));
    expect(resolveOfferTermin(items, "2026-09-04")).toBe("2026-10-02");
  });

  it("mehrere Gruppen am selben Tag ergeben weiterhin einen Termin", () => {
    expect(
      resolveOfferTermin([pos("umzug", "2026-10-02"), pos("reinigung", "2026-10-02")], "2026-09-04"),
    ).toBe("2026-10-02");
  });

  it("Gruppen an verschiedenen Tagen haben KEINEN einzelnen Termin", () => {
    // Die Kopfzeile müsste sonst eine Gruppe unterschlagen. Sie schweigt; die
    // Bänder nennen ihr Datum je Gruppe.
    expect(
      resolveOfferTermin([pos("umzug", "2026-10-02"), pos("reinigung", "2026-10-05")], "2026-09-04"),
    ).toBeNull();
  });

  it("eine Gruppe ohne eigenes Datum zählt mit ihrem Rückfall mit", () => {
    // 'reinigung' fällt auf das globale Feld zurück — das ist ein anderer Tag als
    // der von 'umzug', also gibt es keinen einzelnen Termin.
    expect(
      resolveOfferTermin([pos("umzug", "2026-10-02"), pos("reinigung")], "2026-09-04"),
    ).toBeNull();
    // Deckt sich das Globale mit dem Gruppendatum, bleibt es ein Termin.
    expect(
      resolveOfferTermin([pos("umzug", "2026-10-02"), pos("reinigung")], "2026-10-02"),
    ).toBe("2026-10-02");
  });

  it("gruppiert wie groupItemsByService: trim + lowercase, leer ist eine eigene Gruppe", () => {
    expect(
      resolveOfferTermin([pos(" Umzug ", "2026-10-02"), pos("umzug")], "2026-09-04"),
    ).toBe("2026-10-02");
    expect(resolveOfferTermin([pos("", "2026-10-02"), pos(null)], "2026-09-04")).toBe("2026-10-02");
  });
});
