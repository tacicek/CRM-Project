import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * STOLPERDRAHT, KEIN BEWEIS.
 *
 * Diese Datei prüft, dass `send-offer` die Bereitschaftsprüfung noch AUFRUFT und
 * dass der Aufruf vor dem Versand steht. Mehr kann sie nicht: sie liest Text.
 *
 * Die erste Fassung wurde als Beweis der Durchsetzung verkauft. Die unabhängige
 * Durchsicht am 2026-08-28 hat sie mit einer Zuweisung EINE ZEILE über dem `if`
 * ausgehebelt —
 *
 *     if (!offer.language) (offer as Record<string, unknown>).language = "de";
 *     if (!isReadinessLocale(offer.language)) { … }
 *     (bereitschaft as { ok: boolean }).ok = true;
 *     if (!bereitschaft.ok) { … }
 *
 * — und jedes gesuchte Literal blieb stehen. 30 von 30 Tests grün, Prüfung tot.
 *
 * Die Antwort war nicht, mehr Text zu suchen. Der Zusammenbau ist nach
 * `_shared/offerSendReadiness.ts` gewandert (`buildOfferSendReadiness`) und wird
 * dort mit Eingabe und Ausgabe geprüft — siehe
 * `offerSendReadinessAssembly.test.ts`. Was hier bleibt, ist die Frage „ruft der
 * Handler es überhaupt noch auf?", und die ist mit einer Textsuche ehrlich zu
 * beantworten.
 *
 * `send-offer/index.ts` importiert entfernte Module (`esm.sh`, `deno.land`) und
 * läuft in Deno; unter Vitest ist es nicht ausführbar.
 */

const QUELLE = readFileSync(
  join(__dirname, "..", "..", "send-offer", "index.ts"),
  "utf8",
);

const positionVon = (nadel: string): number => QUELLE.indexOf(nadel);

describe("send-offer erzwingt die Sendebereitschaft selbst", () => {
  it("importiert den gemeinsamen Vertrag statt einer eigenen Kopie", () => {
    expect(QUELLE).toContain('from "../_shared/offerSendReadiness.ts"');
    expect(QUELLE).toContain("evaluateOfferSendReadiness");
  });

  it("prüft die Dokumentsprache, statt sie mit toLocale auf Deutsch zu runden", () => {
    // Anmerkung zur Reichweite: eine Zuweisung `offer.language = "de"` eine
    // Zeile über diesem Wächter würde hier NICHT auffallen. Dagegen hilft kein
    // Textmuster — dagegen hilft, dass `buildOfferSendReadiness` die Sprache
    // selbst prüft und mit Eingabe/Ausgabe getestet ist.
    // `toLocale` macht aus allem Unbekannten stillschweigend Deutsch. Beim
    // Anzeigen richtig, beim Senden der Fehler selbst.
    //
    // Geprüft wird die GENAUE Wächterform, nicht nur das Vorkommen des Namens:
    // ein `if (false && !isReadinessLocale(...))` enthielte den Namen ebenfalls
    // und wäre trotzdem abgeschaltet. (Dieser Test wurde gegen genau diese
    // Einschleusung geprüft und schlug erst nach dieser Verschärfung an.)
    expect(QUELLE).toContain("if (!isReadinessLocale(offer.language)) {");
    const spracheGeprueft = positionVon("if (!isReadinessLocale(offer.language)) {");
    const spracheGerundet = positionVon("toLocale(offer.language)");
    expect(spracheGeprueft).toBeGreaterThan(-1);
    expect(spracheGeprueft).toBeLessThan(spracheGerundet);
  });

  it("baut die Prüfung nicht mehr selbst zusammen", () => {
    // Der Zusammenbau gehört in `_shared`, wo er prüfbar ist. Steht er wieder
    // hier, ist er wieder nur per Textsuche belegbar — und das hat nicht
    // gehalten.
    expect(QUELLE).toContain("buildOfferSendReadiness(");
    expect(QUELLE).toContain("if (!bereitschaft.ok) {");
  });

  it("leitet die Anhang-Sprache aus dem AUFRUF ab, nicht aus der Zeile", () => {
    // Vorher standen dort drei `localeClaims`, die alle `customerLocale` gegen
    // sich selbst verglichen — `x !== x` kann nicht feuern. Die Bytes der
    // Anhänge kommen aus dem Browser; nur er weiss, in welcher Sprache er sie
    // gesetzt hat.
    expect(QUELLE).toContain("declaredAttachmentLocale");
    expect(QUELLE).not.toMatch(/entity:\s*"pdf",\s*field:\s*"locale",\s*locale:\s*customerLocale/);
  });

  it("bricht mit 422 ab, statt still weiterzusenden", () => {
    expect(QUELLE).toContain('"offer_not_ready"');
    expect(QUELLE).toContain("status: 422");
  });

  it("steht VOR dem E-Mail-Versand", () => {
    const pruefung = positionVon("const bereitschaft = buildOfferSendReadiness(");
    const versand = positionVon("emails.send");
    expect(pruefung).toBeGreaterThan(-1);
    expect(versand).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(versand);
  });

  it("liest die AGB mit ihren Übersetzungen — sonst könnte es gar nicht prüfen", () => {
    expect(QUELLE).toContain('.select("id, title, content, display_order, translations")');
  });

  it("schreibt keinen Kundentext ins Protokoll", () => {
    // Die Kurzfassung trägt Feld, Zeile und Sprache — nicht den Inhalt.
    expect(QUELLE).toContain("summariseReadiness(bereitschaft)");
    expect(QUELLE).not.toMatch(/logStep\([^)]*blockers:\s*bereitschaft\.blockers/);
  });
});

describe("Der Browser-Weg benutzt denselben Vertrag", () => {
  const sendOffer = readFileSync(
    join(__dirname, "..", "..", "..", "..", "src", "lib", "sendOffer.ts"),
    "utf8",
  );
  const eingabe = readFileSync(
    join(__dirname, "..", "..", "..", "..", "src", "lib", "offerSendReadinessInput.ts"),
    "utf8",
  );

  it("`sendOffer` prüft, bevor es PDFs baut und die Function ruft", () => {
    const pruefung = sendOffer.indexOf("ladeOfferSendReadiness(offerId)");
    const anhaenge = sendOffer.indexOf("buildOfferEmailAttachments(");
    const aufruf = sendOffer.indexOf('functions.invoke("send-offer"');
    expect(pruefung).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(anhaenge);
    expect(pruefung).toBeLessThan(aufruf);
  });

  it("importiert dieselbe Datei wie die Edge Function — keine zweite Regel", () => {
    expect(eingabe).toContain("supabase/functions/_shared/offerSendReadiness.ts");
    expect(eingabe).toContain("evaluateOfferSendReadiness");
  });

  it("reicht die 422-Blocker durch, statt sie zu einer Standardmeldung zu verflachen", () => {
    expect(sendOffer).toContain("body?.blockers");
    expect(sendOffer).toContain("blockers?: ReadinessFinding[]");
  });

  it("wertet einen Ausfall der Vorprüfung NICHT als Freigabe", () => {
    // Der `catch` laesst weiterlaufen — aber die massgebliche Pruefung steht
    // noch davor. Waere das ein `return { success: true }`, waere es eine
    // stille Freigabe.
    expect(sendOffer).not.toMatch(/catch\s*\{[^}]*success:\s*true/);
  });
});
