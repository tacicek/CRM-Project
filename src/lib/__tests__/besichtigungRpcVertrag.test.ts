import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

type Rpcs = Database["public"]["Functions"];

/**
 * `expectTypeOf` verschwindet beim Uebersetzen — zur Laufzeit steht hier
 * nichts. Das Tor fuer diese Zusicherungen ist `tsc -b`, nicht `vitest run`.
 * Damit die Aussage nicht allein daran haengt, steht darunter zusaetzlich eine
 * Textpruefung der generierten Datei, die auch im normalen Lauf greift.
 */
const TYPES = readFileSync(
  new URL("../../integrations/supabase/types.ts", import.meta.url),
  "utf8",
);

/**
 * Die generierte Typdatei ist der Vertrag zwischen Oberflaeche und Datenbank.
 * Sie wird von Hand nachgezogen (siehe CLAUDE.md — ein voller Regenerierungs-
 * lauf erzeugt hier ~1500 Zeilen Rauschen), und genau deshalb kann sie
 * auseinanderlaufen: die Migration aendert die Signatur, die Datei bleibt
 * stehen, und der Aufruf scheitert erst zur Laufzeit gegen die echte DB.
 *
 * Diese beiden Faelle sind heute Nacht angefasst worden und werden deshalb
 * hier festgehalten.
 */

describe("delete_besichtigung_photo — an die Sitzung gebunden", () => {
  it("verlangt beide Parameter", () => {
    expectTypeOf<Rpcs["delete_besichtigung_photo"]["Args"]>().toEqualTypeOf<{
      p_photo_id: string;
      p_session_id: string;
    }>();
  });

  it("die alte, ungebundene Signatur ist kein gueltiges Argument mehr", () => {
    // 20260803030000 hat sie entfernt: wer sie noch aufruft, soll scheitern.
    expectTypeOf<{ p_photo_id: string }>().not.toMatchTypeOf<
      Rpcs["delete_besichtigung_photo"]["Args"]
    >();
  });

  it("fuehrt genau zwei Argumente, keine weiteren", () => {
    type Schluessel = keyof Rpcs["delete_besichtigung_photo"]["Args"];
    expectTypeOf<Schluessel>().toEqualTypeOf<"p_photo_id" | "p_session_id">();
  });
});

describe("get_user_overview — stillgelegt", () => {
  it("steht nicht mehr im Vertrag", () => {
    // 20260803020000 hat die Funktion entfernt. Bliebe der Typ stehen, liesse
    // sich der Aufruf weiter schreiben und schluege erst in Produktion fehl.
    expectTypeOf<"get_user_overview">().not.toMatchTypeOf<keyof Rpcs>();
  });

  it("und der Name kommt in der Datei nicht mehr vor", () => {
    // Diese Pruefung laeuft auch ohne Typpruefung: sie liest den Text.
    expect(TYPES).not.toContain("get_user_overview");
  });
});

describe("die Datei selbst — auch ohne Typpruefung nachweisbar", () => {
  it("delete_besichtigung_photo fuehrt p_session_id", () => {
    const stelle = TYPES.indexOf("delete_besichtigung_photo:");
    expect(stelle).toBeGreaterThan(-1);
    const block = TYPES.slice(stelle, stelle + 200);
    expect(block).toContain("p_photo_id");
    expect(block).toContain("p_session_id");
  });

  it("es gibt genau einen Eintrag fuer delete_besichtigung_photo", () => {
    expect(TYPES.split("delete_besichtigung_photo:").length - 1).toBe(1);
  });
});

describe("die Nachbarn sind unangetastet geblieben", () => {
  it("die uebrigen besichtigung-RPCs stehen weiterhin", () => {
    expectTypeOf<"get_besichtigung_photos">().toMatchTypeOf<keyof Rpcs>();
    expectTypeOf<"update_besichtigung_session_status">().toMatchTypeOf<keyof Rpcs>();
    expectTypeOf<"cleanup_expired_besichtigung_data">().toMatchTypeOf<keyof Rpcs>();
  });

  it("die Rollenpraedikate ebenfalls", () => {
    expectTypeOf<"is_company_member">().toMatchTypeOf<keyof Rpcs>();
    expectTypeOf<"is_company_owner">().toMatchTypeOf<keyof Rpcs>();
  });
});
