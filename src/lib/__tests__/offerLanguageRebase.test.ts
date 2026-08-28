import { describe, expect, it } from "vitest";
import {
  applyOfferLanguageRebase,
  buildOfferLanguageRebasePlan,
  type RebaseFeldEingabe,
} from "../offerLanguageRebase";

// --- Bausteine -------------------------------------------------------------

const katalogPosition = (
  n: number,
  de: string,
  fr: string | null,
  aktuell?: string,
): RebaseFeldEingabe => ({
  feld: `items[${n}].description`,
  entity: "offer_item",
  entityId: `item-${n}`,
  herkunft: "catalog",
  aktuellerWert: aktuell ?? de,
  quelleInAktuellerSprache: de,
  quelleInZielsprache: fr,
  quelleBezeichnung: `company_service_items:svc-${n}.description`,
});

const geld = (feld: string, wert: string): RebaseFeldEingabe => ({
  feld,
  entity: "offer_item",
  herkunft: "non-localized",
  aktuellerWert: wert,
});

const zahlungskondition = (
  de: string,
  fr: string | null,
  aktuell?: string,
): RebaseFeldEingabe => ({
  feld: "payment_terms",
  entity: "offer",
  herkunft: "template",
  aktuellerWert: aktuell ?? de,
  quelleInAktuellerSprache: de,
  quelleInZielsprache: fr,
  quelleBezeichnung: "companies.default_payment_terms",
});

const titel = (de: string, fr: string | null, aktuell?: string): RebaseFeldEingabe => ({
  feld: "title",
  entity: "offer",
  herkunft: "generated",
  aktuellerWert: aktuell ?? de,
  quelleInAktuellerSprache: de,
  quelleInZielsprache: fr,
  quelleBezeichnung: "offer.doc.title.route",
});

const freitext = (aktuell: string): RebaseFeldEingabe => ({
  feld: "customer_note",
  entity: "offer",
  herkunft: "manual",
  aktuellerWert: aktuell,
});

// --- 1. DE → FR, alles hinterlegt -----------------------------------------

describe("DE-Entwurf → FR mit vollständigen Übersetzungen", () => {
  const plan = buildOfferLanguageRebasePlan({
    von: "de",
    nach: "fr",
    eingefroren: false,
    felder: [
      titel("Umzug Zürich nach Bern", "Déménagement Zurich vers Berne"),
      katalogPosition(1, "Verpackung", "Emballage"),
      katalogPosition(2, "Reinigung", "Nettoyage"),
      zahlungskondition("Zahlbar innert 30 Tagen", "Payable sous 30 jours"),
    ],
  });

  it("stuft jedes Feld als anwendbar ein", () => {
    expect(plan.zusammenfassung.REBASE_AVAILABLE).toBe(4);
    expect(plan.zusammenfassung.TRANSLATION_MISSING).toBe(0);
    expect(plan.zusammenfassung.USER_EDITED_CONFLICT).toBe(0);
  });

  it("wendet genau diese vier an", () => {
    const wirkung = applyOfferLanguageRebase(plan);
    expect(wirkung.nach).toBe("fr");
    expect(wirkung.aenderungen).toEqual({
      title: "Déménagement Zurich vers Berne",
      "items[1].description": "Emballage",
      "items[2].description": "Nettoyage",
      payment_terms: "Payable sous 30 jours",
    });
    expect(wirkung.uebernommeneKonflikte).toEqual([]);
  });
});

// --- 2. FR → EN ------------------------------------------------------------

describe("FR-Entwurf → EN", () => {
  it("liest die Zielsprache, nicht die Basissprache", () => {
    const plan = buildOfferLanguageRebasePlan({
      von: "fr",
      nach: "en",
      eingefroren: false,
      felder: [
        {
          feld: "items[1].description",
          entity: "offer_item",
          herkunft: "catalog",
          aktuellerWert: "Emballage",
          quelleInAktuellerSprache: "Emballage",
          quelleInZielsprache: "Packing",
        },
      ],
    });
    expect(plan.felder[0].kategorie).toBe("REBASE_AVAILABLE");
    expect(applyOfferLanguageRebase(plan).aenderungen).toEqual({
      "items[1].description": "Packing",
    });
  });
});

// --- 3. Geld bleibt Geld ---------------------------------------------------

describe("Ein Sprachwechsel fasst keinen Betrag an", () => {
  const geldfelder = [
    geld("items[1].unit_price", "1250.00"),
    geld("items[1].quantity", "3"),
    geld("items[1].unit", "Std"),
    geld("mwst_satz", "8.1"),
    geld("amount_basis", "fixed"),
    geld("total", "4050.00"),
    geld("offer_number", "10042"),
    geld("scheduled_date", "2026-09-14"),
  ];

  it("stuft sie alle als sprachneutral ein", () => {
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [...geldfelder, katalogPosition(1, "Verpackung", "Emballage")],
    });
    expect(plan.zusammenfassung.NON_LOCALIZED).toBe(geldfelder.length);
  });

  it("lässt sie aus der Anwendung heraus — kein einziger Betrag im Ergebnis", () => {
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [...geldfelder, katalogPosition(1, "Verpackung", "Emballage")],
    });
    // Auch mit pauschaler Zustimmung zu ALLEN Feldern darf nichts Sprachneutrales
    // durchrutschen: die Zustimmung gilt nur für USER_EDITED_CONFLICT.
    const wirkung = applyOfferLanguageRebase(plan, geldfelder.map((f) => f.feld));
    expect(Object.keys(wirkung.aenderungen)).toEqual(["items[1].description"]);
    for (const f of geldfelder) {
      expect(wirkung.aenderungen[f.feld]).toBeUndefined();
    }
  });
});

// --- 4. Von Hand geänderte Position ---------------------------------------

describe("Eine von Hand geänderte Positionsbeschreibung", () => {
  const plan = buildOfferLanguageRebasePlan({
    von: "de", nach: "fr", eingefroren: false,
    felder: [
      katalogPosition(1, "Verpackung", "Emballage"),
      // Der Bediener hat den Katalogtext überschrieben.
      katalogPosition(2, "Transport", "Transport", "Transport inkl. Klaviertransport"),
    ],
  });

  it("wird als USER_EDITED_CONFLICT gemeldet", () => {
    expect(plan.felder[1].kategorie).toBe("USER_EDITED_CONFLICT");
    expect(plan.zusammenfassung.USER_EDITED_CONFLICT).toBe(1);
  });

  it("steht NICHT in der Liste der ohne Rückfrage anwendbaren Felder", () => {
    expect(plan.anwendbar.map((f) => f.feld)).toEqual(["items[1].description"]);
  });

  it("bleibt ohne Zustimmung unberührt", () => {
    const wirkung = applyOfferLanguageRebase(plan);
    expect(wirkung.aenderungen["items[2].description"]).toBeUndefined();
    expect(wirkung.ausgelassen).toContainEqual({
      feld: "items[2].description",
      kategorie: "USER_EDITED_CONFLICT",
    });
  });

  it("wird nur mit feldgenauer Zustimmung übernommen", () => {
    const wirkung = applyOfferLanguageRebase(plan, ["items[2].description"]);
    expect(wirkung.aenderungen["items[2].description"]).toBe("Transport");
    expect(wirkung.uebernommeneKonflikte).toEqual(["items[2].description"]);
  });

  it("die Zustimmung für ein Feld gilt nicht für ein anderes", () => {
    const p2 = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [
        katalogPosition(1, "Verpackung", "Emballage", "Verpackung mit Spezialmaterial"),
        katalogPosition(2, "Transport", "Transport", "Transport mit Lift"),
      ],
    });
    const wirkung = applyOfferLanguageRebase(p2, ["items[1].description"]);
    expect(wirkung.uebernommeneKonflikte).toEqual(["items[1].description"]);
    expect(wirkung.aenderungen["items[2].description"]).toBeUndefined();
  });
});

// --- 4b. Gleiches Wort in beiden Sprachen ---------------------------------

describe("Ein Wort, das in beiden Sprachen gleich lautet", () => {
  it("ist ALREADY_CORRECT, nicht REBASE_AVAILABLE", () => {
    // "Transport" heisst auf Französisch ebenfalls "Transport". Das Feld ist
    // damit bereits richtig — es als "umzustellen" zu melden, wäre eine
    // Änderung ohne Unterschied, und der Bediener müsste sie bestätigen.
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [katalogPosition(1, "Transport", "Transport")],
    });
    expect(plan.felder[0].kategorie).toBe("ALREADY_CORRECT");
    expect(applyOfferLanguageRebase(plan).aenderungen).toEqual({});
  });
});

// --- 5. Fehlende Übersetzung ----------------------------------------------

describe("Eine fehlende Zahlungskondition", () => {
  const plan = buildOfferLanguageRebasePlan({
    von: "de", nach: "fr", eingefroren: false,
    felder: [
      katalogPosition(1, "Verpackung", "Emballage"),
      zahlungskondition("Zahlbar innert 30 Tagen", null),
    ],
  });

  it("wird als TRANSLATION_MISSING gemeldet, nicht still deutsch gelassen", () => {
    expect(plan.felder[1].kategorie).toBe("TRANSLATION_MISSING");
  });

  it("benennt Quelle und Zielsprache", () => {
    expect(plan.fehlendeUebersetzungen).toEqual([
      {
        feld: "payment_terms",
        entity: "offer",
        entityId: null,
        quelleBezeichnung: "companies.default_payment_terms",
        zielsprache: "fr",
      },
    ]);
  });

  it("erfindet nichts — das Feld erscheint in keiner Änderung", () => {
    const wirkung = applyOfferLanguageRebase(plan, ["payment_terms"]);
    expect(wirkung.aenderungen.payment_terms).toBeUndefined();
  });
});

// --- 6. Gemischte Katalog- und Handpositionen ------------------------------

describe("Gemischte Katalog- und Handpositionen", () => {
  it("trennt sie sauber", () => {
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [
        katalogPosition(1, "Verpackung", "Emballage"),
        {
          feld: "items[2].description",
          entity: "offer_item",
          entityId: "item-2",
          herkunft: "manual",
          aktuellerWert: "Sonderabsprache mit dem Hauswart, Schlüssel am Freitag",
        },
        katalogPosition(3, "Reinigung", null),
        geld("items[1].unit_price", "980.00"),
      ],
    });
    expect(plan.zusammenfassung).toMatchObject({
      REBASE_AVAILABLE: 1,
      USER_EDITED_CONFLICT: 1,
      TRANSLATION_MISSING: 1,
      NON_LOCALIZED: 1,
      ALREADY_CORRECT: 0,
      IMMUTABLE: 0,
    });
    // Der handgeschriebene Satz wird nicht übersetzt und nicht ersetzt.
    const wirkung = applyOfferLanguageRebase(plan);
    expect(wirkung.aenderungen).toEqual({ "items[1].description": "Emballage" });
  });
});

// --- 7. Wechsel auf die bereits aktive Sprache -----------------------------

describe("Wechsel auf die bereits aktive Sprache", () => {
  const felder = [
    titel("Umzug Zürich nach Bern", "Déménagement Zurich vers Berne"),
    katalogPosition(1, "Verpackung", "Emballage"),
    freitext("Bitte Lift reservieren"),
  ];

  it("ist ein No-op", () => {
    const plan = buildOfferLanguageRebasePlan({ von: "de", nach: "de", eingefroren: false, felder });
    expect(plan.zusammenfassung.ALREADY_CORRECT).toBe(3);
    expect(applyOfferLanguageRebase(plan).aenderungen).toEqual({});
  });

  it("ist idempotent — zweimal angewendet ändert nichts weiter", () => {
    const p1 = buildOfferLanguageRebasePlan({ von: "de", nach: "de", eingefroren: false, felder });
    const p2 = buildOfferLanguageRebasePlan({ von: "de", nach: "de", eingefroren: false, felder });
    expect(applyOfferLanguageRebase(p1)).toEqual(applyOfferLanguageRebase(p2));
  });
});

// --- 8. Determinismus ------------------------------------------------------

describe("Determinismus", () => {
  it("gleiche Eingabe, gleicher Plan — auch bei wiederholtem Aufruf", () => {
    const eingabe = {
      von: "de" as const, nach: "fr" as const, eingefroren: false,
      felder: [
        titel("Umzug", "Déménagement"),
        katalogPosition(1, "Verpackung", "Emballage", "Verpackung XXL"),
        katalogPosition(2, "Reinigung", null),
        freitext("Notiz"),
        geld("total", "1200.00"),
      ],
    };
    const a = buildOfferLanguageRebasePlan(eingabe);
    const b = buildOfferLanguageRebasePlan(eingabe);
    const c = buildOfferLanguageRebasePlan(eingabe);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(b)).toBe(JSON.stringify(c));
  });

  it("erzeugt keinen Zustand — die Eingabe bleibt unverändert", () => {
    const felder = [katalogPosition(1, "Verpackung", "Emballage")];
    const kopie = JSON.parse(JSON.stringify(felder));
    buildOfferLanguageRebasePlan({ von: "de", nach: "fr", eingefroren: false, felder });
    expect(felder).toEqual(kopie);
  });
});

// --- 9. Eingefrorene Offerte ----------------------------------------------

describe("Eine versendete Offerte", () => {
  const plan = buildOfferLanguageRebasePlan({
    von: "de", nach: "fr", eingefroren: true,
    felder: [
      titel("Umzug", "Déménagement"),
      katalogPosition(1, "Verpackung", "Emballage"),
      zahlungskondition("Zahlbar innert 30 Tagen", "Payable sous 30 jours"),
      geld("total", "1200.00"),
    ],
  });

  it("liefert ausschliesslich IMMUTABLE", () => {
    expect(plan.zusammenfassung.IMMUTABLE).toBe(4);
    expect(plan.anwendbar).toEqual([]);
  });

  it("erzeugt KEINE Änderung — auch nicht am Sprachcode", () => {
    const wirkung = applyOfferLanguageRebase(plan, ["title", "payment_terms"]);
    expect(wirkung.aenderungen).toEqual({});
    expect(wirkung.uebernommeneKonflikte).toEqual([]);
    // Der Sprachcode der eingefrorenen Offerte bleibt, was er war.
    expect(wirkung.nach).toBe("de");
  });
});

// --- 10. Die Dashboard-Sprache spielt nicht mit ---------------------------

describe("Dashboard-Sprache", () => {
  it("kommt in der Eingabe gar nicht vor", () => {
    // Der Vertrag ist die TYPSIGNATUR: `RebasePlanEingabe` kennt `von` und `nach`
    // — beides Dokumentsprachen. Es gibt kein Feld, über das die
    // Bedienersprache hineinreichen könnte, und `buildOfferLanguageRebasePlan`
    // liest keinen React-Kontext (die Datei importiert nur einen Typ).
    const alsDeutscherBediener = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [katalogPosition(1, "Verpackung", "Emballage")],
    });
    const alsFranzoesischerBediener = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [katalogPosition(1, "Verpackung", "Emballage")],
    });
    expect(alsDeutscherBediener).toEqual(alsFranzoesischerBediener);
  });
});

// --- 11. Hin und zurück ----------------------------------------------------

describe("Hin- und Zurückwechseln", () => {
  it("zerstört den von Hand geschriebenen Text nicht", () => {
    const handText = "Sonderabsprache: Schlüsselübergabe am Freitag um 17:00";

    const hin = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [
        katalogPosition(1, "Verpackung", "Emballage"),
        { feld: "items[2].description", entity: "offer_item", herkunft: "manual", aktuellerWert: handText },
      ],
    });
    const nachFr = applyOfferLanguageRebase(hin);
    expect(nachFr.aenderungen["items[2].description"]).toBeUndefined();

    // Zurück nach DE — der Handtext steht immer noch unverändert da.
    const zurueck = buildOfferLanguageRebasePlan({
      von: "fr", nach: "de", eingefroren: false,
      felder: [
        katalogPosition(1, "Emballage", "Verpackung"),
        { feld: "items[2].description", entity: "offer_item", herkunft: "manual", aktuellerWert: handText },
      ],
    });
    const nachDe = applyOfferLanguageRebase(zurueck);
    expect(nachDe.aenderungen["items[2].description"]).toBeUndefined();
    expect(zurueck.felder[1].kategorie).toBe("USER_EDITED_CONFLICT");
  });

  it("überschreibt einen überschriebenen Katalogtext auch beim Rückweg nicht", () => {
    const zurueck = buildOfferLanguageRebasePlan({
      von: "fr", nach: "de", eingefroren: false,
      felder: [katalogPosition(1, "Emballage", "Verpackung", "Emballage renforcé")],
    });
    expect(zurueck.felder[0].kategorie).toBe("USER_EDITED_CONFLICT");
    expect(applyOfferLanguageRebase(zurueck).aenderungen).toEqual({});
  });
});

// --- 12. Unbekannte Herkunft ----------------------------------------------

describe("Unbekannte Herkunft", () => {
  it("gilt konservativ als vom Bediener geschrieben", () => {
    // Bestandsdaten: `offer_items` trägt (noch) keine Herkunftsspalte. Ohne
    // Beleg wird nicht überschrieben.
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [
        {
          feld: "items[1].description",
          entity: "offer_item",
          herkunft: "unknown",
          aktuellerWert: "Verpackung",
          quelleInZielsprache: "Emballage",
        },
      ],
    });
    expect(plan.felder[0].kategorie).toBe("USER_EDITED_CONFLICT");
    expect(applyOfferLanguageRebase(plan).aenderungen).toEqual({});
  });

  it("ohne Inhalt gibt es nichts zu schützen", () => {
    const plan = buildOfferLanguageRebasePlan({
      von: "de", nach: "fr", eingefroren: false,
      felder: [
        {
          feld: "items[1].description",
          entity: "offer_item",
          herkunft: "unknown",
          aktuellerWert: "",
          quelleInZielsprache: "Emballage",
        },
      ],
    });
    expect(plan.felder[0].kategorie).toBe("REBASE_AVAILABLE");
  });
});
