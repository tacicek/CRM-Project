import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `ROLLBACK_20260803020000` bringt `get_user_overview()` als Objekt zurueck,
 * aber ohne jede Wirkung.
 *
 * Diese Datei haelt fest, WARUM sie wirkungslos ist. Zwei fruehere Fassungen
 * waren es naemlich nicht:
 *
 *   1. Die Originalfassung entschied an einer echten E-Mail-Adresse.
 *   2. Die naechste ersetzte sie durch `test@test.invalid` und nannte das
 *      funktionslos. Es war dieselbe Konstruktion: `auth.users.email` ist eine
 *      Textspalte, die niemand gegen das DNS prueft. Wer eine Zeile mit genau
 *      dieser Adresse anlegen kann, schaltet die Funktion scharf.
 *
 * Geprueft wird deshalb nicht "die richtige Adresse steht drin", sondern:
 * **es gibt ueberhaupt keine Bedingung.** Ein Rumpf, der keine Tabelle liest
 * und nichts vergleicht, kann von keiner Zeile abhaengen — heute nicht und
 * nach keinem noch so geschickten INSERT.
 */

const DATEI = "supabase/migrations/ROLLBACK_20260803020000_admin_flaeche_stilllegen.sql";
const SQL = readFileSync(new URL(`../../../${DATEI}`, import.meta.url), "utf8");

/** Der Funktionsrumpf zwischen den Dollar-Klammern, ohne Kommentare drumherum. */
const rumpf = (): string => {
  const start = SQL.indexOf("AS $function$");
  const ende = SQL.indexOf("$function$;", start);
  expect(start, "AS $function$ nicht gefunden").toBeGreaterThan(-1);
  expect(ende, "abschliessendes $function$ nicht gefunden").toBeGreaterThan(start);
  return SQL.slice(start + "AS $function$".length, ende);
};

describe("Rollback get_user_overview — der Rumpf kann von keiner Zeile abhaengen", () => {
  it("weist unbedingt ab", () => {
    expect(rumpf()).toContain("RAISE EXCEPTION 'get_user_overview is retired'");
  });

  it("liest keine Tabelle", () => {
    const b = rumpf();
    for (const verboten of ["auth.users", "SELECT", "FROM", "PERFORM", "RETURN QUERY"]) {
      expect(b, `Rumpf enthaelt "${verboten}"`).not.toContain(verboten);
    }
  });

  it("vergleicht keine E-Mail-Adresse", () => {
    const b = rumpf();
    expect(b.toLowerCase()).not.toContain("email");
    expect(b).not.toContain("@");
  });

  it("enthaelt keinerlei Verzweigung", () => {
    // Ohne IF/CASE/COALESCE gibt es keinen zweiten Ausgang aus der Funktion.
    const b = rumpf();
    for (const verboten of ["IF ", "CASE", "COALESCE", "EXISTS"]) {
      expect(b, `Rumpf enthaelt "${verboten}"`).not.toContain(verboten);
    }
  });

  it("besteht aus genau einer Anweisung", () => {
    const anweisungen = rumpf()
      .replace(/^\s*BEGIN\s*/i, "")
      .replace(/\s*END;\s*$/i, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(anweisungen).toHaveLength(1);
  });

  it("ist nicht mehr SECURITY DEFINER", () => {
    // Sie liest nichts, also braucht sie keine fremden Rechte. Bliebe DEFINER
    // stehen, waere jede spaetere Erweiterung des Rumpfs sofort gefaehrlich.
    //
    // Kommentare werden vorher entfernt: der Kopf ERKLAERT, dass dort kein
    // SECURITY DEFINER steht, und ohne diesen Schritt pruefte der Test die
    // Erklaerung statt der Deklaration.
    const kopf = SQL.slice(SQL.indexOf("CREATE OR REPLACE FUNCTION"), SQL.indexOf("AS $function$"))
      .split("\n")
      .map((z) => z.replace(/--.*$/, ""))
      .join("\n");
    expect(kopf).not.toContain("SECURITY DEFINER");
  });
});

describe("Rollback get_user_overview — Rechte und Zusicherungen", () => {
  it("nimmt PUBLIC und anon das Ausfuehrungsrecht", () => {
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.get_user_overview() FROM PUBLIC, anon");
  });

  it("laesst authenticated aufrufen, damit die Abweisung eine echte ist", () => {
    // Ohne EXECUTE waere der Aufruf in der Nachpruefung ein Rechtefehler und
    // nicht die Abweisung, die belegt werden soll.
    expect(SQL).toContain("GRANT EXECUTE ON FUNCTION public.get_user_overview() TO authenticated");
  });

  it("prueft im Lauf selbst, dass der Rumpf nichts liest und nichts vergleicht", () => {
    expect(SQL).toContain("ILIKE '%auth.users%'");
    expect(SQL).toContain("ILIKE '%email%'");
    expect(SQL).toContain("LIKE '%@%'");
  });

  it("prueft im Lauf selbst, dass ein Aufruf als authenticated abgewiesen wird", () => {
    expect(SQL).toContain("SET LOCAL ROLE authenticated");
    expect(SQL).toContain("v_lieferte");
  });

  it("die echte Adresse von damals steht nirgends mehr", () => {
    // Ein Rollback soll den Befund nicht aufbewahren.
    expect(SQL).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("und die Scheinloesung test@test.invalid ebenfalls nicht", () => {
    expect(SQL).not.toContain("test.invalid");
  });
});
