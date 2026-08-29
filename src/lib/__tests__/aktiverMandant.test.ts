import { describe, expect, it } from "vitest";
import {
  antwortGehoertNochZumMandanten,
  zeileGehoertZumMandanten,
} from "../aktiverMandant";

const FIRMA_A = "11111111-1111-1111-1111-111111111111";
const FIRMA_B = "22222222-2222-2222-2222-222222222222";

describe("zeileGehoertZumMandanten", () => {
  it("laesst die eigene Zeile durch", () => {
    expect(zeileGehoertZumMandanten({ company_id: FIRMA_A }, FIRMA_A)).toBe(true);
  });

  it("weist die Zeile der anderen Firma ab", () => {
    // Der Fall, um den es geht: der Benutzer ist Mitglied in A UND B, aktiv ist
    // A, aufgerufen wird eine Rechnung aus B. RLS laesst ihn die Zeile lesen —
    // die Bildschirmgrenze muss sie trotzdem abweisen, sonst steht B-Inhalt
    // unter A-Kopfdaten.
    expect(zeileGehoertZumMandanten({ company_id: FIRMA_B }, FIRMA_A)).toBe(false);
  });

  it("weist ab, solange kein Mandant ausgewaehlt ist", () => {
    expect(zeileGehoertZumMandanten({ company_id: FIRMA_A }, null)).toBe(false);
    expect(zeileGehoertZumMandanten({ company_id: FIRMA_A }, undefined)).toBe(false);
  });

  it("weist eine Zeile ohne company_id ab, statt sie durchzuwinken", () => {
    expect(zeileGehoertZumMandanten({ company_id: null }, FIRMA_A)).toBe(false);
    expect(zeileGehoertZumMandanten({}, FIRMA_A)).toBe(false);
    expect(zeileGehoertZumMandanten(null, FIRMA_A)).toBe(false);
  });
});

describe("antwortGehoertNochZumMandanten", () => {
  it("nimmt die Antwort an, wenn der Mandant derselbe geblieben ist", () => {
    expect(antwortGehoertNochZumMandanten(FIRMA_A, FIRMA_A)).toBe(true);
  });

  it("verwirft die Antwort einer Abfrage, die vor dem Wechsel startete", () => {
    // A ist langsam, der Benutzer wechselt zu B, dann trifft A ein. Ohne diese
    // Pruefung schriebe A-Inhalt in den B-Bildschirm — ohne Fehler und ohne
    // Hinweis.
    expect(antwortGehoertNochZumMandanten(FIRMA_A, FIRMA_B)).toBe(false);
  });

  it("verwirft, solange eine der beiden Seiten fehlt", () => {
    expect(antwortGehoertNochZumMandanten(null, FIRMA_A)).toBe(false);
    expect(antwortGehoertNochZumMandanten(FIRMA_A, null)).toBe(false);
    expect(antwortGehoertNochZumMandanten(null, null)).toBe(false);
  });
});
