import { describe, expect, it } from "vitest";
import { entscheideAnmeldeZiel } from "../anmeldeZiel";

describe("entscheideAnmeldeZiel", () => {
  it("ohne Mitgliedschaft: keine Firma", () => {
    expect(entscheideAnmeldeZiel([])).toBe("keine-firma");
  });

  it("eine freigeschaltete Firma: ins Dashboard", () => {
    expect(entscheideAnmeldeZiel([{ is_verified: true }])).toBe("dashboard");
  });

  it("nur nicht freigeschaltete Firmen: Verifizierung ausstehend", () => {
    expect(entscheideAnmeldeZiel([{ is_verified: false }])).toBe("verifizierung-ausstehend");
    expect(entscheideAnmeldeZiel([{ is_verified: false }, { is_verified: false }]))
      .toBe("verifizierung-ausstehend");
  });

  it("eine freigeschaltete UNTER mehreren genügt — unabhängig von der Reihenfolge", () => {
    // Der Fall, an dem der alte Helfer scheiterte: er waehlte EINE Firma nach
    // Anmeldeadresse bzw. Anlagedatum. Traf er die unverifizierte, sah der
    // Benutzer "Verifizierung ausstehend", obwohl seine eigene Firma bereit war.
    expect(entscheideAnmeldeZiel([{ is_verified: false }, { is_verified: true }])).toBe("dashboard");
    expect(entscheideAnmeldeZiel([{ is_verified: true }, { is_verified: false }])).toBe("dashboard");
  });

  it("NULL ist keine Freischaltung", () => {
    // `is_verified` ist nullable. Ein fehlender Wert ist eine fehlende Pruefung,
    // kein stilles Ja.
    expect(entscheideAnmeldeZiel([{ is_verified: null }])).toBe("verifizierung-ausstehend");
    expect(entscheideAnmeldeZiel([{ is_verified: null }, { is_verified: true }])).toBe("dashboard");
  });
});
