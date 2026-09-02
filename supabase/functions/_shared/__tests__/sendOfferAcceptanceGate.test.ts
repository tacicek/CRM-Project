import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * STOLPERDRAHT, KEIN BEWEIS — dieselbe Bauart wie `sendOfferReadinessGate`.
 *
 * Was die Frist RECHNET, ist in `offerAcceptanceWindow.test.ts` mit Eingabe und
 * Ausgabe geprüft. Hier steht nur die Frage, die eine Textsuche ehrlich
 * beantworten kann: ruft `send-offer` die Regel überhaupt noch auf, und steht
 * der Aufruf vor dem Versand? `index.ts` importiert entfernte Module und läuft
 * in Deno; unter Vitest ist es nicht ausführbar.
 *
 * Warum es dieses Tor gibt: eine Offerte, deren Annahmefrist schon abgelaufen
 * ist, kommt beim Kunden als «abgelaufen» an. Offerte 10095 war so eine —
 * Ausführung auf den Anlagetag, Frist damit der Vortag — und nichts hielt sie
 * auf.
 */

const QUELLE = readFileSync(join(__dirname, "..", "..", "send-offer", "index.ts"), "utf8");

const positionVon = (nadel: string): number => QUELLE.indexOf(nadel);

describe("send-offer prüft das Annahmefenster", () => {
  it("importiert die gemeinsame Regel statt einer eigenen Kopie", () => {
    expect(QUELLE).toContain('from "../_shared/offerAcceptanceWindow.ts"');
    expect(QUELLE).toContain("evaluateAcceptanceWindow");
  });

  it("prüft die GENAUE Wächterform, nicht nur den Namen", () => {
    // `if (false && !annahme.offen)` enthielte den Namen ebenfalls.
    expect(QUELLE).toContain("if (!annahme.offen) {");
  });

  it("vergleicht mit dem Tag, den auch die Datenbank meint", () => {
    // `heuteIso()` rechnet in UTC — `update_offer_by_token` entscheidet mit
    // CURRENT_DATE, und die Datenbank läuft in UTC. Ein lokaler Tag hier hiesse,
    // dass Tor und Datenbank sich kurz nach Mitternacht widersprechen.
    expect(QUELLE).toContain("evaluateAcceptanceWindow(offer.valid_until, offer.service_date, heuteIso())");
  });

  it("bricht mit 422 ab und nennt die Frist, statt still weiterzusenden", () => {
    expect(QUELLE).toContain('"offer_acceptance_window_closed"');
    expect(QUELLE).toMatch(/acceptanceDeadline: annahme\.frist/);
  });

  it("steht VOR dem E-Mail-Versand", () => {
    const pruefung = positionVon("const annahme = evaluateAcceptanceWindow(");
    const versand = positionVon("emails.send");
    expect(pruefung).toBeGreaterThan(-1);
    expect(versand).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(versand);
  });
});

describe("Der Browser-Weg benutzt dieselbe Regel", () => {
  const sendOffer = readFileSync(
    join(__dirname, "..", "..", "..", "..", "src", "lib", "sendOffer.ts"),
    "utf8",
  );

  it("`sendOffer` prüft, bevor es PDFs baut und die Function ruft", () => {
    const pruefung = sendOffer.indexOf("evaluateAcceptanceWindow(");
    const anhaenge = sendOffer.indexOf("buildOfferEmailAttachments(");
    const aufruf = sendOffer.indexOf('functions.invoke("send-offer"');
    expect(pruefung).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(anhaenge);
    expect(pruefung).toBeLessThan(aufruf);
  });

  it("holt die Regel aus `_shared`, statt sie im Browser nachzubauen", () => {
    expect(sendOffer).toContain('supabase/functions/_shared/offerAcceptanceWindow.ts"');
  });

  it("macht aus dem Schlüssel der Function einen Satz für den Bediener", () => {
    // Sonst stünde "offer_acceptance_window_closed" im Toast.
    expect(sendOffer).toContain('body?.error === "offer_acceptance_window_closed"');
  });
});

describe("Das Formular zeigt die Frist, statt sie erst beim Senden zu nennen", () => {
  const hinweis = readFileSync(
    join(__dirname, "..", "..", "..", "..", "src", "components", "offerte", "AnnahmefristHinweis.tsx"),
    "utf8",
  );
  const seiten = ["OfferteErstellen.tsx", "OfferteBearbeiten.tsx"].map((datei) =>
    readFileSync(join(__dirname, "..", "..", "..", "..", "src", "pages", "firma", datei), "utf8"),
  );

  it("der Hinweis rechnet mit derselben Regel", () => {
    expect(hinweis).toContain('supabase/functions/_shared/offerAcceptanceWindow.ts"');
    expect(hinweis).toContain("evaluateAcceptanceWindow(");
  });

  it("beide Formulare zeigen ihn", () => {
    for (const seite of seiten) {
      expect(seite).toContain("<AnnahmefristHinweis serviceDate={serviceDate} validUntil={validUntil} />");
    }
  });

  it("die alte Warnung, die nur «Gültig bis» gegen heute mass, ist weg", () => {
    // Sie schwieg genau dann, wenn das Ausführungsdatum die Frist geschlossen
    // hatte — und trieb den Bediener dazu, «Gültig bis» weiter zu schieben.
    for (const seite of seiten) {
      expect(seite).not.toContain("isValidUntilShorterThanSevenDays");
      expect(seite).not.toContain("offer.form.validUntil.shortWarning");
    }
  });
});
