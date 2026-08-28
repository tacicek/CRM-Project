import { describe, expect, it } from "vitest";
import { leseLedger, pruefeLedger, vorwaertsmigrationen } from "../migration-ledger";

const befund = pruefeLedger();

describe("Migrationen sind anfügend", () => {
  it("keine bestehende Datei wurde geändert", () => {
    // `CLAUDE.md` §6 sagt das seit langem. Bis 2026-08-28 war es eine Bitte.
    expect(
      befund.geaendert.map((g) => `${g.datei}\n    erwartet ${g.erwartet}\n    gefunden ${g.gefunden}`),
    ).toEqual([]);
  });

  it("keine bestehende Datei wurde entfernt", () => {
    // Eine gelöschte Migration ändert, was die Produktion angeblich ausführt —
    // ohne dass irgendetwas rot wird.
    expect(befund.entfernt).toEqual([]);
  });

  it("kein NEUER doppelter Zeitstempel", () => {
    // Zwei Dateien mit derselben Version werden alphabetisch angewendet. Das ist
    // eine Reihenfolge, die niemand gewählt hat. Zwei Bestandsfälle sind im
    // Ledger vermerkt; ein dritter wäre ein Fehler.
    expect(
      befund.neueDoppelungen.map((d) => `${d.version}: ${d.dateien.join(", ")}`),
    ).toEqual([]);
  });

  it("jede Vorwärtsmigration trägt einen Zeitstempel", () => {
    expect(befund.ohneVersion).toEqual([]);
  });

  it("der Ledger beschreibt noch dieselbe Menge, die er beschrieben hat", () => {
    const ledger = leseLedger();
    // Nur nach oben: neue Dateien sind erlaubt, weniger nicht.
    expect(vorwaertsmigrationen().length).toBeGreaterThanOrEqual(ledger.forward_migration_count);
  });

  it("die zwei bekannten Doppelungen sind benannt, nicht verschwiegen", () => {
    const ledger = leseLedger();
    expect(Object.keys(ledger.accepted_duplicate_versions).sort()).toEqual([
      "20260629120000",
      "20260703130000",
    ]);
  });
});
