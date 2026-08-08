import { describe, expect, it } from "vitest";
import { deuteLadefehler, istFehlgeschlagen, veralteteAntwort } from "@/lib/ladefehler";

describe("deuteLadefehler", () => {
  it("gibt null zurueck, wenn nichts fehlgeschlagen ist", () => {
    expect(deuteLadefehler(null)).toBeNull();
    expect(deuteLadefehler(undefined)).toBeNull();
  });

  it("erkennt die abgelehnte Berechtigung aus den RPCs (42501)", () => {
    expect(deuteLadefehler({ code: "42501", message: "Kein Zugriff auf diesen Kunden" }))
      .toEqual({ art: "kein_zugriff", nachricht: "Kein Zugriff auf diesen Kunden" });
  });

  it("behandelt ein abgelaufenes JWT wie eine fehlende Berechtigung", () => {
    expect(deuteLadefehler({ code: "PGRST301", message: "JWT expired" })?.art)
      .toBe("kein_zugriff");
  });

  it("erkennt das abgerissene Netz an der Meldung des Browsers", () => {
    for (const m of ["Failed to fetch", "NetworkError when attempting to fetch", "Load failed"]) {
      expect(deuteLadefehler({ message: m })?.art).toBe("verbindung");
    }
  });

  it("wertet einen Fehler ohne Code als Verbindungsfehler — aus Postgres kam er nicht", () => {
    expect(deuteLadefehler({ message: "TypeError: irgendetwas" })?.art).toBe("verbindung");
  });

  it("laesst einen Datenbankfehler mit Code unbekannt statt ihn zu deuten", () => {
    expect(deuteLadefehler({ code: "23505", message: "duplicate key" }))
      .toEqual({ art: "unbekannt", nachricht: "duplicate key" });
  });

  it("verschluckt einen Fehler ohne jede Angabe nicht", () => {
    // Ein leeres Objekt aus einem catch-Zweig ist ein Fehlschlag, kein Erfolg.
    expect(deuteLadefehler({})).toEqual({ art: "unbekannt", nachricht: "" });
    expect(istFehlgeschlagen({})).toBe(true);
    expect(istFehlgeschlagen(null)).toBe(false);
  });
});

describe("veralteteAntwort", () => {
  const pflicht = ["kunde", "anzahl", "offen", "aktionen"] as const;

  it("laesst eine vollstaendige Antwort durch", () => {
    expect(veralteteAntwort({ kunde: {}, anzahl: {}, offen: {}, aktionen: {} }, pflicht))
      .toBeNull();
  });

  it("erkennt die Antwort einer Datenbank ohne 20260807100000", () => {
    // Genau diese Form lieferte die alte customer_summary: `offen` und
    // `aktionen` fehlen, und der Achtungsstreifen las offen.faelle auf undefined.
    expect(veralteteAntwort({ kunde: {}, anzahl: {}, pipeline: {} }, pflicht))
      .toEqual({ art: "schema_veraltet", nachricht: "offen, aktionen" });
  });

  it("wertet null als vorhanden — die RPC hat sich geaeussert", () => {
    // `naechster_termin: null` heisst "kein Termin", nicht "Feld fehlt".
    expect(veralteteAntwort({ kunde: null, anzahl: null, offen: null, aktionen: null }, pflicht))
      .toBeNull();
  });

  it("urteilt nicht ueber eine leere Antwort — das ist Sache des Aufrufers", () => {
    expect(veralteteAntwort(null, pflicht)).toBeNull();
    expect(veralteteAntwort(undefined, pflicht)).toBeNull();
    expect(veralteteAntwort("kaputt", pflicht)).toBeNull();
  });
});
