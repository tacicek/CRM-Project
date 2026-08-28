import { describe, expect, it } from "vitest";
import { sammleOfferteRebaseFelder } from "../offerRebaseFelder";
import { buildOfferLanguageRebasePlan, applyOfferLanguageRebase } from "../offerLanguageRebase";
import { buildOfferTitle } from "../offerTitle";

const lead = { service_type: "umzug", from_city: "Zürich", to_city: "Bern" };

const katalogzeile = (de: string, fr?: string) => ({
  description: de,
  translations: fr ? { fr: { description: fr } } : {},
});

const position = (id: string, n: number, description: string) => ({
  id, position: n, description, quantity: 3, unit: "Std", unit_price: 145.5,
});

describe("sammleOfferteRebaseFelder", () => {
  it("erzeugt den Titel in beiden Sprachen aus derselben reinen Funktion", () => {
    const [titel] = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: lead,
      titel: buildOfferTitle("de", lead),
      positionen: [],
      zahlungskondition: { wert: "", quelle: null },
      agb: { wert: "", quelle: null },
    });
    expect(titel.feld).toBe("title");
    expect(titel.herkunft).toBe("generated");
    expect(titel.quelleInAktuellerSprache).toBe(buildOfferTitle("de", lead));
    expect(titel.quelleInZielsprache).toBe(buildOfferTitle("fr", lead));
    expect(titel.quelleInZielsprache).not.toBe(titel.quelleInAktuellerSprache);
  });

  it("nimmt eine hinterlegte Übersetzung, aber NICHT den deutschen Rückfall", () => {
    const mitFr = katalogzeile("Verpackung", "Emballage");
    const ohneFr = katalogzeile("Reinigung");
    const felder = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: null, titel: "",
      positionen: [position("a", 1, "Verpackung"), position("b", 2, "Reinigung")],
      positionsherkunft: new Map([
        ["a", { zeile: mitFr, felder: ["description"] }],
        ["b", { zeile: ohneFr, felder: ["description"] }],
      ]),
      zahlungskondition: { wert: "", quelle: null },
      agb: { wert: "", quelle: null },
    });
    const a = felder.find((f) => f.feld === "items[1].description")!;
    const b = felder.find((f) => f.feld === "items[2].description")!;
    expect(a.quelleInZielsprache).toBe("Emballage");
    // Ohne fr-Eintrag liefert `localizedField` „Reinigung" (deutscher Rückfall).
    // Genau das darf hier NICHT als Übersetzung gelten.
    expect(b.quelleInZielsprache).toBeNull();
  });

  it("stuft Positionen ohne bekannte Herkunft als unknown ein", () => {
    const felder = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: null, titel: "",
      positionen: [position("a", 1, "Verpackung")],
      zahlungskondition: { wert: "", quelle: null },
      agb: { wert: "", quelle: null },
    });
    expect(felder.find((f) => f.feld === "items[1].description")!.herkunft).toBe("unknown");
  });

  it("führt Menge, Einheit und Preis als sprachneutral mit", () => {
    const felder = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: null, titel: "",
      positionen: [position("a", 1, "Verpackung")],
      zahlungskondition: { wert: "", quelle: null },
      agb: { wert: "", quelle: null },
    });
    const neutral = felder.filter((f) => f.herkunft === "non-localized").map((f) => f.feld);
    expect(neutral).toEqual([
      "items[1].quantity", "items[1].unit", "items[1].unit_price",
    ]);
  });

  it("löst einen Katalogschlüssel für jede Sprache auf", () => {
    const felder = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: null, titel: "",
      positionen: [],
      zahlungskondition: { wert: "x", quelle: { art: "katalogschluessel", key: "offer.doc.payment.cash" } },
      agb: { wert: "", quelle: null },
    });
    const zk = felder.find((f) => f.feld === "payment_terms")!;
    expect(zk.herkunft).toBe("template");
    expect(zk.quelleInAktuellerSprache).toBeTruthy();
    expect(zk.quelleInZielsprache).toBeTruthy();
    expect(zk.quelleInZielsprache).not.toBe(zk.quelleInAktuellerSprache);
  });
});

describe("Sammler und Einstufer zusammen", () => {
  it("ein deutscher Bediener stellt eine Offerte auf Französisch um", () => {
    const verpackung = katalogzeile("Verpackung", "Emballage");
    const reinigung = katalogzeile("Reinigung"); // keine fr-Übersetzung

    const felder = sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: lead,
      titel: buildOfferTitle("de", lead),
      positionen: [
        position("a", 1, "Verpackung"),
        position("b", 2, "Reinigung"),
        position("c", 3, "Sonderabsprache Hauswart"),
      ],
      positionsherkunft: new Map([
        ["a", { zeile: verpackung, felder: ["description"] }],
        ["b", { zeile: reinigung, felder: ["description"] }],
      ]),
      zahlungskondition: { wert: "Zahlbar bar bei Übergabe", quelle: { art: "katalogschluessel", key: "offer.doc.payment.cash" } },
      agb: { wert: "", quelle: null },
    });

    const plan = buildOfferLanguageRebasePlan({ von: "de", nach: "fr", eingefroren: false, felder });

    expect(plan.zusammenfassung.REBASE_AVAILABLE).toBeGreaterThan(0);
    // Position b hat keine französische Fassung.
    expect(plan.fehlendeUebersetzungen.map((m) => m.feld)).toContain("items[2].description");
    // Position c hat keine bekannte Herkunft → wird nicht angefasst.
    expect(plan.felder.find((f) => f.feld === "items[3].description")!.kategorie)
      .toBe("USER_EDITED_CONFLICT");

    const wirkung = applyOfferLanguageRebase(plan);
    expect(wirkung.aenderungen["items[1].description"]).toBe("Emballage");
    expect(wirkung.aenderungen["items[2].description"]).toBeUndefined();
    expect(wirkung.aenderungen["items[3].description"]).toBeUndefined();
    expect(wirkung.aenderungen.title).toBe(buildOfferTitle("fr", lead));

    // Kein einziger sprachneutraler Wert im Ergebnis.
    for (const k of Object.keys(wirkung.aenderungen)) {
      expect(k).not.toMatch(/\.(quantity|unit|unit_price)$/);
    }
  });
});

describe("Zusammengesetzte Quelltexte", () => {
  const zeile = (
    name: string, desc: string,
    fr?: { name?: string; description?: string },
  ) => ({ name, description: desc, translations: fr ? { fr } : {} });

  const sammle = (h: { zeile: ReturnType<typeof zeile>; felder: string[] }) =>
    sammleOfferteRebaseFelder({
      von: "de", nach: "fr",
      titelQuelle: null, titel: "",
      positionen: [position("a", 1, "Verpackung\nGrosse Kisten")],
      positionsherkunft: new Map([["a", h]]),
      zahlungskondition: { wert: "", quelle: null },
      agb: { wert: "", quelle: null },
    }).find((f) => f.feld === "items[1].description")!;

  it("verbindet beide Spalten, wenn beide übersetzt sind", () => {
    const f = sammle({
      zeile: zeile("Verpackung", "Grosse Kisten", { name: "Emballage", description: "Grandes caisses" }),
      felder: ["name", "description"],
    });
    expect(f.quelleInZielsprache).toBe("Emballage\nGrandes caisses");
  });

  it("meldet NICHTS, wenn nur eine der beiden Spalten übersetzt ist", () => {
    // Halb übersetzt sieht aus wie übersetzt: französischer Name, deutsche
    // Beschreibung darunter. Der Plan soll das als fehlend melden, nicht als
    // anwendbar.
    const f = sammle({
      zeile: zeile("Verpackung", "Grosse Kisten", { name: "Emballage" }),
      felder: ["name", "description"],
    });
    expect(f.quelleInZielsprache).toBeNull();

    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false, felder: [f],
    });
    expect(plan.felder[0].kategorie).toBe("TRANSLATION_MISSING");
  });

  it("ignoriert eine Spalte, die auch auf Deutsch leer ist", () => {
    const f = sammle({
      zeile: zeile("Verpackung", "", { name: "Emballage" }),
      felder: ["name", "description"],
    });
    expect(f.quelleInZielsprache).toBe("Emballage");
  });
});
