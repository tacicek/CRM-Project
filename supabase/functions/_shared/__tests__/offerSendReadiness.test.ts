import { describe, expect, it } from "vitest";
import {
  evaluateOfferSendReadiness,
  summariseReadiness,
  type ContentSlot,
  type ReadinessInput,
} from "../offerSendReadiness";

const slot = (
  field: string,
  source: ContentSlot["source"],
  required = true,
  value: string | null = "Text",
): ContentSlot => ({ entity: "offer", entityId: "o1", field, required, value, source });

const vollstaendigFr = (): ReadinessInput => ({
  requestedLocale: "fr",
  slots: [
    slot("title", "translation"),
    slot("payment_terms", "translation"),
    { entity: "offer_item", entityId: "i1", field: "description", required: true, value: "Emballage", source: "translation" },
    { entity: "agb_section", entityId: "a1", field: "content", required: true, value: "Conditions", source: "translation" },
    { entity: "checklist_template", entityId: "c1", field: "content", required: false, value: "Liste", source: "translation" },
  ],
  localeClaims: [
    { entity: "pdf", field: "locale", locale: "fr" },
    { entity: "email", field: "locale", locale: "fr" },
    { entity: "public_view", field: "locale", locale: "fr" },
  ],
});

// --- Sprache -------------------------------------------------------------

describe("Die Sprache selbst", () => {
  it("fehlt sie ganz, wird NICHT auf Deutsch zurückgefallen", () => {
    // Der veraltete Client: er schickt `fields`, aber kein `locale`. Vor 2026-08-28
    // hiess das stillschweigend "dann eben Deutsch".
    for (const roh of [undefined, null, ""]) {
      const r = evaluateOfferSendReadiness({ requestedLocale: roh, slots: [] });
      expect(r.ok).toBe(false);
      expect(r.locale).toBeNull();
      expect(r.blockers.map((b) => b.code)).toEqual(["MISSING_LOCALE"]);
    }
  });

  it("eine unbekannte Sprache wird abgewiesen, nicht angenähert", () => {
    for (const roh of ["it", "de-CH", "DE", 42, {}, ["fr"]]) {
      const r = evaluateOfferSendReadiness({ requestedLocale: roh, slots: [] });
      expect(r.ok).toBe(false);
      expect(r.blockers[0].code).toBe("UNSUPPORTED_LOCALE");
    }
  });

  it("hält die drei unterstützten Sprachen fest", () => {
    for (const l of ["de", "fr", "en"] as const) {
      expect(evaluateOfferSendReadiness({ requestedLocale: l, slots: [] }).locale).toBe(l);
    }
  });
});

// --- Der Kernfall --------------------------------------------------------

describe("Eine französische Offerte mit einer fehlenden Übersetzung", () => {
  const eingabe: ReadinessInput = {
    ...vollstaendigFr(),
    slots: [
      slot("title", "translation"),
      // Die Zahlungskondition hat keine französische Fassung → deutscher Rückfall.
      slot("payment_terms", "base-fallback", true, "Zahlbar innert 30 Tagen"),
      { entity: "offer_item", entityId: "i1", field: "description", required: true, value: "Emballage", source: "translation" },
    ],
  };
  const r = evaluateOfferSendReadiness(eingabe);

  it("wird blockiert", () => {
    expect(r.ok).toBe(false);
  });

  it("benennt genau das Feld, die Zeile und beide Sprachen", () => {
    expect(r.blockers).toEqual([
      {
        code: "GERMAN_FALLBACK",
        entity: "offer",
        entityId: "o1",
        field: "payment_terms",
        requestedLocale: "fr",
        fallbackLocale: "de",
        messageKey: "offer.send.blocked.GERMAN_FALLBACK",
        focus: null,
      },
    ]);
  });

  it("die Kurzfassung trägt keinen Kundentext", () => {
    const kurz = summariseReadiness(r);
    expect(kurz).toBe("GERMAN_FALLBACK:offer#o1.payment_terms@fr");
    expect(kurz).not.toContain("Zahlbar");
  });
});

// --- Vollständig ---------------------------------------------------------

describe("Vollständig übersetzt", () => {
  it("eine französische Offerte geht durch", () => {
    const r = evaluateOfferSendReadiness(vollstaendigFr());
    expect(r.ok).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("eine englische Offerte geht durch", () => {
    const e = vollstaendigFr();
    const r = evaluateOfferSendReadiness({
      ...e,
      requestedLocale: "en",
      localeClaims: (e.localeClaims ?? []).map((c) => ({ ...c, locale: "en" })),
    });
    expect(r.ok).toBe(true);
  });
});

// --- Deutsch bleibt gültig ------------------------------------------------

describe("Deutsch als Dokumentsprache", () => {
  it("bleibt gültig — die Basisspalte IST dort die richtige Quelle", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "de",
      slots: [
        slot("title", "base"),
        slot("payment_terms", "base"),
        { entity: "offer_item", entityId: "i1", field: "description", required: true, value: "Verpackung", source: "base" },
      ],
      localeClaims: [{ entity: "pdf", field: "locale", locale: "de" }],
    });
    expect(r.ok).toBe(true);
  });

  it("blockiert aber weiterhin einen fehlenden Pflichtinhalt", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "de",
      slots: [slot("payment_terms", "absent", true, null)],
    });
    expect(r.blockers.map((b) => b.code)).toEqual(["EMPTY_REQUIRED"]);
  });
});

// --- Optional vs. Pflicht -------------------------------------------------

describe("Optionale Inhalte", () => {
  it("dürfen fehlen, ohne zu blockieren", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [slot("title", "translation"), slot("internal_hint", "absent", false, null)],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("dürfen aber NICHT still auf Deutsch umschlagen — das wird gemeldet", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [
        slot("title", "translation"),
        { entity: "checklist_template", entityId: "c1", field: "content", required: false, value: "Checkliste", source: "base-fallback" },
      ],
    });
    // Kein Blocker — aber auch kein Schweigen.
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => `${w.code}:${w.field}`)).toEqual(["GERMAN_FALLBACK:content"]);
  });
});

// --- Gemischte Sprachen in der Kette --------------------------------------

describe("Eine gemischt deutsch/französische Nutzlast", () => {
  it("wird mit genauen Blockern abgewiesen", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [
        slot("title", "translation"),
        slot("payment_terms", "base-fallback", true, "Zahlbar innert 30 Tagen"),
        { entity: "offer_item", entityId: "i1", field: "description", required: true, value: "Verpackung", source: "base-fallback" },
        { entity: "agb_section", entityId: "a1", field: "content", required: true, value: "AGB", source: "base-fallback" },
      ],
      localeClaims: [
        { entity: "pdf", field: "locale", locale: "fr" },
        // Die E-Mail wurde in der Bedienersprache gebaut — genau der Fehler.
        { entity: "email", field: "locale", locale: "de" },
        { entity: "public_view", field: "locale", locale: "fr" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.map((b) => `${b.code}:${b.entity}.${b.field}`)).toEqual([
      "LOCALE_MISMATCH:email.locale",
      "GERMAN_FALLBACK:offer.payment_terms",
      "GERMAN_FALLBACK:offer_item.description",
      "GERMAN_FALLBACK:agb_section.content",
    ]);
  });

  it("meldet die Sprache, die stattdessen käme", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [],
      localeClaims: [{ entity: "email", field: "locale", locale: "de" }],
    });
    expect(r.blockers[0].fallbackLocale).toBe("de");
  });

  it("eine fehlende Sprachangabe im Glied wird als solche gemeldet", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [],
      localeClaims: [{ entity: "pdf", field: "locale", locale: null }],
    });
    expect(r.blockers[0].code).toBe("LOCALE_MISMATCH");
    expect(r.blockers[0].fallbackLocale).toBeNull();
  });
});

// --- Eigenschaften --------------------------------------------------------

describe("Eigenschaften der Prüfung", () => {
  it("ist deterministisch", () => {
    const e = vollstaendigFr();
    expect(evaluateOfferSendReadiness(e)).toEqual(evaluateOfferSendReadiness(e));
  });

  it("verändert ihre Eingabe nicht", () => {
    const e = vollstaendigFr();
    const kopie = JSON.parse(JSON.stringify(e));
    evaluateOfferSendReadiness(e);
    expect(JSON.parse(JSON.stringify(e))).toEqual(kopie);
  });

  it("gibt strukturierte Blocker zurück, keinen Wahrheitswert", () => {
    const r = evaluateOfferSendReadiness({
      requestedLocale: "fr",
      slots: [slot("payment_terms", "base-fallback")],
    });
    const b = r.blockers[0];
    for (const feld of ["code", "entity", "entityId", "field", "requestedLocale", "fallbackLocale", "messageKey", "focus"]) {
      expect(b).toHaveProperty(feld);
    }
  });
});
