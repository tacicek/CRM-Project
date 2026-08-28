import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Die Bereitschaftsprüfung muss IM SENDEWEG stehen, nicht nur am Knopf.
 *
 * Ein Vertragstest über die reine Funktion beweist, dass die REGEL stimmt. Er
 * beweist nicht, dass der Sendeweg sie auch anwendet — und genau das ist die
 * Zusage: „ein direkter Aufruf, ein veralteter Bundle, ein
 * Wiederholungsversuch oder die nächste Integration kommen daran nicht vorbei".
 *
 * `send-offer/index.ts` importiert entfernte Module (`esm.sh`, `deno.land`) und
 * läuft in Deno; unter Vitest ist es nicht ausführbar. Was hier geht, ist die
 * Anordnung im Quelltext zu prüfen: dass die Prüfung da ist, dass sie mit 422
 * abbricht, und dass sie VOR dem Versand steht. Wer sie entfernt oder hinter
 * den Versand schiebt, macht diesen Test rot.
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

  it("die Bereitschaftsprüfung ist nicht kurzgeschlossen", () => {
    // Dieselbe Klasse Einschleusung eine Ebene tiefer: der Aufruf bleibt stehen,
    // sein Ergebnis wird überschrieben.
    expect(QUELLE).toContain("const bereitschaft = evaluateOfferSendReadiness({");
    expect(QUELLE).toContain("if (!bereitschaft.ok) {");
  });

  it("bricht mit 422 ab, statt still weiterzusenden", () => {
    expect(QUELLE).toContain('"offer_not_ready"');
    expect(QUELLE).toContain("status: 422");
  });

  it("steht VOR dem E-Mail-Versand", () => {
    const pruefung = positionVon("const bereitschaft = evaluateOfferSendReadiness(");
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
