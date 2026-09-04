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
    expect(QUELLE).toContain("evaluateAcceptanceWindow(offer.valid_until, arbeitsbeginn, heuteIso())");
  });

  it("rechnet mit DEM Termin, nicht mit dem rohen Feld", () => {
    // Liegt die Leistung laut Positionen später als `offers.service_date`, darf
    // die Frist nicht vom früheren Feld abgeleitet werden — sonst sperrt das Tor
    // eine Offerte, die in Wahrheit noch offen ist.
    expect(QUELLE).toContain('from "../_shared/offerTermin.ts"');
    expect(QUELLE).toContain("const arbeitsbeginn = earliestTermin(terminItems, offer.service_date)");
    const termin = positionVon("const arbeitsbeginn = earliestTermin(");
    const tor = positionVon("const annahme = evaluateAcceptanceWindow(");
    expect(termin).toBeGreaterThan(-1);
    expect(termin).toBeLessThan(tor);
  });

  it("die E-Mail nennt denselben Termin wie das PDF", () => {
    expect(QUELLE).toContain("${formatDate(terminDate)}");
    expect(QUELLE).not.toContain("${formatDate(offer.service_date)}");
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
  const komponente = (name: string) =>
    readFileSync(join(__dirname, "..", "..", "..", "..", "src", "components", "offerte", name), "utf8");
  const hinweis = komponente("AnnahmefristHinweis.tsx");
  const block = komponente("OfferteDatumsfelder.tsx");
  const seiten = ["OfferteErstellen.tsx", "OfferteBearbeiten.tsx"].map((datei) =>
    readFileSync(join(__dirname, "..", "..", "..", "..", "src", "pages", "firma", datei), "utf8"),
  );

  it("der Hinweis rechnet mit derselben Regel", () => {
    expect(hinweis).toContain('supabase/functions/_shared/offerAcceptanceWindow.ts"');
    expect(hinweis).toContain("evaluateAcceptanceWindow(");
  });

  it("der gemeinsame Datumsblock zeigt ihn", () => {
    expect(block).toContain("<AnnahmefristHinweis arbeitsbeginn={arbeitsbeginn} validUntil={validUntil} />");
  });

  it("beide Formulare benutzen denselben Block und geben den Arbeitsbeginn hinein", () => {
    // Zwei eigene Fassungen des Datumsbereichs waren der Anfang dieses ganzen
    // Fehlers: die eine zeigte ein Feld, das die andere nicht hatte.
    for (const seite of seiten) {
      expect(seite).toContain("<OfferteDatumsfelder");
      expect(seite).toContain("arbeitsbeginn={arbeitsbeginn}");
      expect(seite).toContain("const arbeitsbeginn = earliestTermin(");
      expect(seite).toContain('_shared/offerTermin.ts"');
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

describe("Der Datumsblock trennt Dokument und Arbeit", () => {
  const block = readFileSync(
    join(__dirname, "..", "..", "..", "..", "src", "components", "offerte", "OfferteDatumsfelder.tsx"),
    "utf8",
  );

  it("das Offertendatum ist sichtbar, aber kein Eingabefeld", () => {
    // Es war unsichtbar, weil es automatisch entsteht. Wer es suchte, fand das
    // Terminfeld und trug den heutigen Tag ein — sechsmal in Produktion.
    expect(block).toContain("offer.form.field.offertendatum");
    // Genau zwei Datumseingaben: Termin und «Gültig bis». Das Offertendatum ist
    // Text, keine Entscheidung — es entsteht beim Speichern.
    expect(block.match(/<DateInputCH/g) ?? []).toHaveLength(2);
    expect(block).toContain("isoToDisplay(offertendatum)");
  });

  it("das Terminfeld trägt das Wort, das auch im PDF steht", () => {
    expect(block).toContain("getAppointmentLabel(serviceType, locale)");
    expect(block).toContain("{terminLabel}");
  });

  it("der Wunschtermin steht daneben und lässt sich zurückholen", () => {
    expect(block).toContain("offer.form.wunschtermin.abweichend");
    expect(block).toContain("onServiceDateChange(wunschtermin)");
  });
});
