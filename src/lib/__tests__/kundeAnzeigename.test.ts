import { describe, expect, it } from "vitest";
import { abgeleiteterAnzeigename, folgtDemNamen } from "@/lib/kundeAnzeigename";

describe("abgeleiteterAnzeigename", () => {
  it("bildet Vor- und Nachname", () => {
    expect(abgeleiteterAnzeigename({ first_name: "Anna", last_name: "Muster" }))
      .toBe("Anna Muster");
  });

  it("kommt mit nur einem der beiden Namen aus", () => {
    expect(abgeleiteterAnzeigename({ last_name: "von Gunten" })).toBe("von Gunten");
    expect(abgeleiteterAnzeigename({ first_name: "Anna" })).toBe("Anna");
  });

  it("faellt auf den Firmennamen zurueck", () => {
    expect(abgeleiteterAnzeigename({ company_name: "Muster AG" })).toBe("Muster AG");
  });

  it("faellt zuletzt auf E-Mail und Telefon zurueck — in dieser Reihenfolge", () => {
    expect(abgeleiteterAnzeigename({ primary_email: "A@Example.COM", primary_phone: "+41790000001" }))
      .toBe("a@example.com");
    expect(abgeleiteterAnzeigename({ primary_phone: "+41790000001" })).toBe("+41790000001");
  });

  it("ignoriert Leerraum", () => {
    expect(abgeleiteterAnzeigename({ first_name: "  ", last_name: " Muster " })).toBe("Muster");
  });

  it("liefert einen leeren Namen, wenn es nichts zu bilden gibt", () => {
    expect(abgeleiteterAnzeigename({})).toBe("");
  });
});

describe("folgtDemNamen", () => {
  const anna = { first_name: "Anna", last_name: "Muster" };

  it("erkennt einen abgeleiteten Namen", () => {
    expect(folgtDemNamen("Anna Muster", anna)).toBe(true);
  });

  it("erkennt einen von Hand gesetzten Namen", () => {
    // Genau dieser Fall darf beim Speichern NICHT ueberschrieben werden.
    expect(folgtDemNamen("Familie Muster", anna)).toBe(false);
  });

  it("ist gegen Gross-/Kleinschreibung unempfindlich", () => {
    expect(folgtDemNamen("anna muster", anna)).toBe(true);
  });

  it("behandelt einen leeren Namen als abgeleitet — die Datenbank bildet ihn", () => {
    expect(folgtDemNamen("", anna)).toBe(true);
    expect(folgtDemNamen(null, anna)).toBe(true);
  });

  it("vergleicht gegen die HEUTIGEN Felder, nicht gegen die kuenftigen", () => {
    // Der Kunde heisst heute "Anna Muster" und der Bediener tippt gerade einen
    // neuen Nachnamen. Der Name folgte bisher der Regel — also wird er
    // nachgezogen, obwohl er zum neuen Nachnamen (noch) nicht passt.
    expect(folgtDemNamen("Anna Muster", { first_name: "Anna", last_name: "Muster" })).toBe(true);
    expect(folgtDemNamen("Anna Muster", { first_name: "Anna", last_name: "Neumann" })).toBe(false);
  });
});
