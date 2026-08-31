import { describe, it, expect } from "vitest";
import { autoFormat, displayToIso, isoToDisplay, MIN_YEAR, MAX_YEAR } from "@/lib/dateInputCH";

/**
 * The regression these tests exist for: offer 10091 was stored with
 * service_date = 0261-08-31 and reached the customer as "Termin 31.08.261".
 * The value came out of this field, not out of the PDF.
 */
describe("DateInputCH — der Fall aus Offerte 10091", () => {
  it("nimmt das Jahr 261 nicht an, obwohl es ein gueltiges Datum ist", () => {
    expect(new Date("0261-08-31").getTime()).not.toBeNaN(); // die alte Pruefung sagte: in Ordnung
    expect(displayToIso("31.08.0261")).toBe("");
  });

  it("nimmt auch das an, was ein einzelner Tastendruck erzeugt", () => {
    // "31.08.2026", Cursor vor dem Jahr, eine 0 getippt: autoFormat behaelt
    // acht Ziffern und setzt sie neu zusammen.
    expect(autoFormat("31.08.02026")).toBe("31.08.0202");
    expect(displayToIso("31.08.0202")).toBe("");
  });

  it("kein Jahr unterhalb MIN_YEAR kommt durch", () => {
    for (const jahr of ["0001", "0202", "0261", "0999", "1899"]) {
      expect(displayToIso(`31.08.${jahr}`)).toBe("");
    }
  });

  it("kein Jahr oberhalb MAX_YEAR kommt durch", () => {
    expect(displayToIso("31.08.2200")).toBe("");
    expect(displayToIso("31.08.9999")).toBe("");
  });

  it("die Grenzen selbst sind erlaubt", () => {
    expect(displayToIso(`01.01.${MIN_YEAR}`)).toBe(`${MIN_YEAR}-01-01`);
    expect(displayToIso(`31.12.${MAX_YEAR}`)).toBe(`${MAX_YEAR}-12-31`);
  });
});

describe("displayToIso — was gueltig ist, bleibt gueltig", () => {
  it("wandelt ein normales Datum um", () => {
    expect(displayToIso("29.04.2026")).toBe("2026-04-29");
    expect(displayToIso("11.11.2026")).toBe("2026-11-11");
    expect(displayToIso("01.01.2026")).toBe("2026-01-01");
    expect(displayToIso("31.12.2026")).toBe("2026-12-31");
  });

  it("fuellt einstellige Tag- und Monatsangaben auf", () => {
    expect(displayToIso("1.1.2026")).toBe("2026-01-01");
    expect(displayToIso("9.4.2026")).toBe("2026-04-09");
  });

  it("kennt den Schalttag", () => {
    expect(displayToIso("29.02.2028")).toBe("2028-02-29"); // Schaltjahr
    expect(displayToIso("29.02.2027")).toBe("");           // keines
  });

  it("weist Tage zurueck, die es im Monat nicht gibt", () => {
    expect(displayToIso("31.04.2026")).toBe("");
    expect(displayToIso("31.06.2026")).toBe("");
    expect(displayToIso("32.01.2026")).toBe("");
    expect(displayToIso("00.01.2026")).toBe("");
  });

  it("weist unmoegliche Monate zurueck", () => {
    expect(displayToIso("15.13.2026")).toBe("");
    expect(displayToIso("15.00.2026")).toBe("");
  });

  it("weist alles zurueck, was nicht die Form TT.MM.JJJJ hat", () => {
    expect(displayToIso("")).toBe("");
    expect(displayToIso("31")).toBe("");
    expect(displayToIso("31.08")).toBe("");
    expect(displayToIso("31.08.202")).toBe("");   // Jahr noch nicht fertig getippt
    expect(displayToIso("31.08.20261")).toBe(""); // Jahr zu lang
    expect(displayToIso("311.08.2026")).toBe(""); // Tag zu lang
    expect(displayToIso("31.088.2026")).toBe(""); // Monat zu lang
    expect(displayToIso("31.08.2026.1")).toBe("");
  });

  it("kippt nicht ueber die Zeitzone — der Tag bleibt der getippte", () => {
    // `new Date("2026-01-01")` ist UTC-Mitternacht; mit den lokalen Gettern
    // waere das westlich von Greenwich der 31.12. und wuerde faelschlich
    // abgewiesen.
    expect(displayToIso("01.01.2026")).toBe("2026-01-01");
    expect(displayToIso("01.03.2026")).toBe("2026-03-01");
  });
});

describe("isoToDisplay", () => {
  it("dreht die Umwandlung um", () => {
    expect(isoToDisplay("2026-04-29")).toBe("29.04.2026");
    expect(isoToDisplay("")).toBe("");
    expect(isoToDisplay("kaputt")).toBe("");
  });

  it("bildet mit displayToIso einen sauberen Hin- und Rueckweg", () => {
    for (const iso of ["2026-01-01", "2026-11-11", "2028-02-29", "2199-12-31"]) {
      expect(displayToIso(isoToDisplay(iso))).toBe(iso);
    }
  });
});

describe("autoFormat", () => {
  it("setzt die Punkte beim Tippen", () => {
    expect(autoFormat("3")).toBe("3");
    expect(autoFormat("31")).toBe("31");
    expect(autoFormat("310")).toBe("31.0");
    expect(autoFormat("3108")).toBe("31.08");
    expect(autoFormat("310820")).toBe("31.08.20");
    expect(autoFormat("31082026")).toBe("31.08.2026");
  });

  it("wirft alles weg, was keine Ziffer ist, und kappt nach acht Ziffern", () => {
    expect(autoFormat("31.08.2026")).toBe("31.08.2026");
    expect(autoFormat("31.08.202699")).toBe("31.08.2026");
    expect(autoFormat("ab31")).toBe("31");
  });
});
