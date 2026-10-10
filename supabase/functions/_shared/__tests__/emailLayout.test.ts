import { describe, expect, it } from "vitest";
import { wrapEmailDocument } from "../i18n/emailLayout.ts";

/**
 * Bis 2026-10-10 gab es zwei `wrapEmailDocument`: eines mit `lang="de"` fest
 * (`_shared/emailLayout.ts`, geloescht) und dieses. Vier Versender riefen das
 * feste mit einem zweiten Argument auf — JavaScript verwirft ueberzaehlige
 * Argumente stillschweigend, und franzoesische Kunden bekamen `lang="de"`.
 * Dieser Test haelt fest, dass das Argument wirklich im Dokument landet.
 */
describe("wrapEmailDocument", () => {
  it("setzt die Sprache des Kunden als lang-Attribut", () => {
    expect(wrapEmailDocument("<p>x</p>", "fr")).toContain('<html lang="fr">');
    expect(wrapEmailDocument("<p>x</p>", "en")).toContain('<html lang="en">');
    expect(wrapEmailDocument("<p>x</p>", "de")).toContain('<html lang="de">');
  });

  it("faellt ohne Angabe auf Deutsch zurueck — der Fall, den es nur noch fuer Firmenmails gibt", () => {
    expect(wrapEmailDocument("<p>x</p>")).toContain('<html lang="de">');
  });

  it("traegt den Inhalt unveraendert", () => {
    expect(wrapEmailDocument("<p>Bonjour</p>", "fr")).toContain("<p>Bonjour</p>");
  });
});
