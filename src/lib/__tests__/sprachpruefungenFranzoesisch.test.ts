import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Franzoesisch war ueberall angeboten und nirgends erlaubt.
 *
 * Am 2026-08-31 auf der Produktion gemessen: elf von zwoelf Sprachregeln
 * kannten nur 'de' und 'en', obwohl die Oberflaeche `LOCALES = ["de","fr","en"]`
 * anbietet. Eine franzoesische Kundschaft haette an jeder Station der Kette
 * einen Constraint-Verstoss ausgeloest — lead, offer, auftrag, rechnung,
 * quittung, alle.
 *
 * Diese Datei haelt die Menge der elf Tabellen fest. Wer eine vergisst oder
 * spaeter eine zwoelfte Tabelle mit Sprachspalte anlegt, soll es hier merken
 * und nicht bei der ersten franzoesischen Offerte.
 */

const VORWAERTS = "supabase/migrations/20260831100000_sprachpruefungen_franzoesisch_zulassen.sql";
const ZURUECK = "supabase/migrations/ROLLBACK_20260831100000_sprachpruefungen_franzoesisch_zulassen.sql";

const lies = (datei: string) => readFileSync(new URL(`../../../${datei}`, import.meta.url), "utf8");
const SQL = lies(VORWAERTS);
const SQL_ZURUECK = lies(ZURUECK);


/** Erste Zeile, die tatsaechlich ausgefuehrt wird — Kommentare zaehlen nicht. */
const ersteAnweisung = (sql: string) =>
  sql.split("\n").map((z) => z.trim()).find((z) => z !== "" && !z.startsWith("--")) ?? "";

/** Die elf Regeln, die am 2026-08-31 nur zwei Sprachen kannten. */
const REGELN = [
  "appointments_language_check",
  "auftraege_language_check",
  "companies_default_language_check",
  "credit_notes_language_check",
  "customers_language_check",
  "invoice_reminders_language_check",
  "leads_language_check",
  "offer_amendments_language_check",
  "offers_language_check",
  "quittungen_language_check",
  "rechnungen_language_check",
] as const;

describe("Sprachpruefungen — die Vorwaertsmigration", () => {
  it.each(REGELN)("weitet %s auf de, fr, en", (regel) => {
    const stelle = SQL.indexOf(`ADD  CONSTRAINT ${regel}`);
    expect(stelle, `${regel} wird nicht neu angelegt`).toBeGreaterThan(-1);
    const block = SQL.slice(stelle, stelle + 220);
    expect(block).toContain("'de'::text");
    expect(block).toContain("'fr'::text");
    expect(block).toContain("'en'::text");
  });

  it("faesst email_logs nicht an — dort stimmt die Regel bereits", () => {
    expect(SQL).not.toContain("ALTER TABLE public.email_logs");
  });

  it("laeuft in einer Transaktion, damit ein Fehlschlag nichts halb erledigt", () => {
    // Auf einem Abbild der Produktion nachgestellt: mit einer zusaetzlichen
    // de/en-Tabelle bricht psql mit Rueckgabewert 3 ab, und eine zuvor von Hand
    // verengte Regel steht danach unveraendert da — nichts wurde halb getan.
    expect(ersteAnweisung(SQL)).toBe("BEGIN;");
    expect(SQL.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("prueft am Ende, dass KEINE Sprachregel mehr fr verbietet", () => {
    // Das ist das Netz gegen die uebersehene zwoelfte Tabelle. Auf einem Abbild
    // der Produktion nachgestellt: mit einer zusaetzlichen de/en-Tabelle bricht
    // die Migration ab und laesst nichts zurueck.
    expect(SQL).toContain("verbieten weiterhin fr");
    expect(SQL).toMatch(/NOT LIKE '%''fr''%'/);
    expect(SQL).toMatch(/RAISE EXCEPTION 'Diese Sprachregeln verbieten weiterhin fr/);
  });

  it("aendert keine Vorgabewerte — welche Sprache voreingestellt ist, ist eine andere Frage", () => {
    expect(SQL).not.toMatch(/SET DEFAULT/i);
    expect(SQL).not.toMatch(/ALTER COLUMN/i);
  });

  it("legt keine Zeilen an und loescht keine", () => {
    expect(SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  });
});

describe("Sprachpruefungen — die Ruecknahme", () => {
  it.each(REGELN)("engt %s wieder auf de, en", (regel) => {
    const stelle = SQL_ZURUECK.indexOf(`ADD  CONSTRAINT ${regel}`);
    expect(stelle, `${regel} fehlt in der Ruecknahme`).toBeGreaterThan(-1);
    const block = SQL_ZURUECK.slice(stelle, stelle + 220);
    expect(block).toContain("'de'::text");
    expect(block).toContain("'en'::text");
    expect(block).not.toContain("'fr'::text");
  });

  it("setzt kein SQL zur Laufzeit zusammen — das Ruecknahme-Tor verbietet es zu Recht", () => {
    // Eine erste Fassung zaehlte die elf Tabellen in einer Schleife mit
    // EXECUTE format(...). Die Werte kamen aus einer Konstante in derselben
    // Datei, waren also harmlos — aber src/test/rollback-guard.ts hat es
    // gemeldet, und die Regel hat recht: in einer Ruecknahme hat dynamisches
    // SQL nichts zu suchen. Ausgeschrieben statt Ausnahme eingetragen.
    expect(SQL_ZURUECK).not.toContain("EXECUTE");
    expect(SQL_ZURUECK).not.toContain("format(");
  });

  it("weigert sich, wenn bereits franzoesische Zeilen bestehen", () => {
    // Eine Verengung kann Daten unmoeglich machen, die schon da sind. Auf dem
    // Abbild nachgestellt: mit einer fr-Zeile bricht die Ruecknahme ab und
    // laesst die geweitete Regel stehen.
    expect(SQL_ZURUECK).toContain("Ruecknahme abgelehnt");
    expect(SQL_ZURUECK).toMatch(/RAISE EXCEPTION 'Ruecknahme abgelehnt/);
    expect(SQL_ZURUECK).toContain("$schutz$");
  });

  it("prueft jede der elf Tabellen auf fr-Zeilen, nicht nur eine", () => {
    for (const tabelle of [
      "appointments", "auftraege", "companies", "credit_notes", "customers",
      "invoice_reminders", "leads", "offer_amendments", "offers",
      "quittungen", "rechnungen",
    ]) {
      expect(SQL_ZURUECK).toContain(`FROM public.${tabelle} `);
    }
  });

  it("laeuft ebenfalls in einer Transaktion", () => {
    expect(ersteAnweisung(SQL_ZURUECK)).toBe("BEGIN;");
    expect(SQL_ZURUECK.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
});

describe("Vorwaerts und Ruecknahme decken dieselbe Menge ab", () => {
  it("keine Regel steht nur in einer der beiden Dateien", () => {
    const raus = (sql: string) =>
      [...sql.matchAll(/ADD\s+CONSTRAINT\s+(\w+_language_check|\w+_default_language_check)/g)]
        .map((m) => m[1])
        .sort();
    expect(raus(SQL)).toEqual(raus(SQL_ZURUECK));
    expect(raus(SQL)).toHaveLength(REGELN.length);
  });
});
