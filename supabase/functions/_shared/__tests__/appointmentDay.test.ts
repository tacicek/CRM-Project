import { describe, it, expect } from "vitest";
import {
  APP_TIME_ZONE,
  nextDateString,
  zonedDateString,
  zonedWallClockToUtc,
} from "../appointmentDay";

describe("zonedDateString", () => {
  it("gibt den Zürcher Kalendertag eines Zeitpunkts zurück", () => {
    // 2026-08-05 14:00 UTC = 16:00 Zürich (CEST) — derselbe Tag.
    expect(zonedDateString(new Date("2026-08-05T14:00:00Z"))).toBe("2026-08-05");
  });

  /**
   * Der Kern des Fehlers, den dieses Modul beseitigt.
   *
   * Zwischen lokaler Mitternacht und 01:00/02:00 steht die UTC-Uhr noch auf dem Vortag.
   * `toISOString()` meldete dort den falschen Tag, und eine Abfrage
   * `appointment_date = <UTC-Tag>` griff in dieser Nachtspanne die Termine von gestern ab.
   */
  it("meldet in der Nachtspanne den lokalen Tag, nicht den UTC-Tag (Sommerzeit, +2)", () => {
    const instant = new Date("2026-08-05T22:30:00Z"); // = 2026-08-06 00:30 Zürich
    expect(instant.toISOString().slice(0, 10)).toBe("2026-08-05"); // was der Fehler las
    expect(zonedDateString(instant)).toBe("2026-08-06"); // was gemeint ist
  });

  it("meldet in der Nachtspanne den lokalen Tag, nicht den UTC-Tag (Winterzeit, +1)", () => {
    const instant = new Date("2026-01-14T23:30:00Z"); // = 2026-01-15 00:30 Zürich
    expect(instant.toISOString().slice(0, 10)).toBe("2026-01-14");
    expect(zonedDateString(instant)).toBe("2026-01-15");
  });

  it("stimmt mit UTC überein, sobald die Nachtspanne vorbei ist", () => {
    const instant = new Date("2026-08-06T00:30:00Z"); // = 02:30 Zürich
    expect(zonedDateString(instant)).toBe("2026-08-06");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-08-06");
  });

  it("trägt den Monats- und Jahreswechsel mit", () => {
    // 2025-12-31 23:30 UTC = 2026-01-01 00:30 Zürich.
    expect(zonedDateString(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });

  it("nimmt eine andere Zone entgegen", () => {
    // 2026-08-05 22:30 UTC ist in Zürich schon der 6., in London noch der 5.
    expect(zonedDateString(new Date("2026-08-05T22:30:00Z"), "Europe/London")).toBe("2026-08-05");
  });
});

describe("nextDateString", () => {
  it("zählt einen Tag weiter", () => {
    expect(nextDateString("2026-08-05")).toBe("2026-08-06");
  });

  it("trägt den Monatswechsel", () => {
    expect(nextDateString("2026-08-31")).toBe("2026-09-01");
  });

  it("trägt den Jahreswechsel", () => {
    expect(nextDateString("2025-12-31")).toBe("2026-01-01");
  });

  it("kennt den Schalttag", () => {
    expect(nextDateString("2028-02-28")).toBe("2028-02-29");
    expect(nextDateString("2028-02-29")).toBe("2028-03-01");
  });

  /**
   * An den Umstellungstagen hat der Zürcher Tag 23 bzw. 25 Stunden. Gerechnet wird aber in
   * UTC, also darf das hier nichts ausmachen.
   */
  it("bleibt an den Sommerzeit-Umstellungen korrekt", () => {
    expect(nextDateString("2026-03-29")).toBe("2026-03-30"); // 23-Stunden-Tag
    expect(nextDateString("2026-10-25")).toBe("2026-10-26"); // 25-Stunden-Tag
  });
});

describe("zonedWallClockToUtc", () => {
  it("liest eine Winter-Wanduhr als CET (+1)", () => {
    expect(zonedWallClockToUtc("2026-01-15", "09:00:00").toISOString())
      .toBe("2026-01-15T08:00:00.000Z");
  });

  it("liest eine Sommer-Wanduhr als CEST (+2)", () => {
    expect(zonedWallClockToUtc("2026-08-05", "09:00:00").toISOString())
      .toBe("2026-08-05T07:00:00.000Z");
  });

  it("nimmt HH:MM ohne Sekunden entgegen", () => {
    expect(zonedWallClockToUtc("2026-08-05", "09:00:00").getTime())
      .toBe(zonedWallClockToUtc("2026-08-05", "09:00").getTime());
  });

  it("trifft den Offset am Tag der Umstellung", () => {
    // Umstellung 2026-03-29 um 02:00 → 03:00. Davor +1, danach +2.
    expect(zonedWallClockToUtc("2026-03-29", "01:30:00").toISOString())
      .toBe("2026-03-29T00:30:00.000Z");
    expect(zonedWallClockToUtc("2026-03-29", "04:00:00").toISOString())
      .toBe("2026-03-29T02:00:00.000Z");
  });
});

describe("die beiden Richtungen zusammen", () => {
  /**
   * Der Vertrag, an dem der Erinnerungslauf hängt: der Kalendertag eines Termins, aus
   * seinem eigenen Zeitpunkt zurückgelesen, ist wieder sein `appointment_date` — auch für
   * einen Termin in den frühen Morgenstunden, dessen Erinnerungsfenster komplett in die
   * Nachtspanne fällt.
   */
  it("führt einen 01:00-Termin auf seinen eigenen Kalendertag zurück", () => {
    const date = "2026-08-06";
    const instant = zonedWallClockToUtc(date, "01:00:00");
    expect(instant.toISOString()).toBe("2026-08-05T23:00:00.000Z"); // UTC sagt: 5. August
    expect(zonedDateString(instant)).toBe(date); // Zürich sagt: 6. August
  });

  it("gilt auch für Mitternacht", () => {
    const date = "2026-08-06";
    expect(zonedDateString(zonedWallClockToUtc(date, "00:00:00"))).toBe(date);
  });

  it("gilt über das ganze Jahr, zu jeder vollen Stunde", () => {
    for (const date of ["2026-01-15", "2026-03-29", "2026-06-21", "2026-10-25", "2026-12-31"]) {
      for (let h = 0; h < 24; h++) {
        const time = `${String(h).padStart(2, "0")}:30:00`;
        expect(zonedDateString(zonedWallClockToUtc(date, time))).toBe(date);
      }
    }
  });
});

describe("APP_TIME_ZONE", () => {
  it("ist die Zone, in der die Wanduhrwerte gemeint sind", () => {
    expect(APP_TIME_ZONE).toBe("Europe/Zurich");
  });
});
