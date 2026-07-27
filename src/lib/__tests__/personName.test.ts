import { describe, it, expect } from "vitest";
import { splitPersonName, joinPersonName } from "@/lib/personName";

describe("splitPersonName", () => {
  it("trennt einen einfachen Namen am letzten Wort", () => {
    expect(splitPersonName("Anna Mueller")).toEqual({ first: "Anna", last: "Mueller" });
  });

  it("haelt einen Doppelvornamen zusammen", () => {
    expect(splitPersonName("Anna Maria Mueller")).toEqual({ first: "Anna Maria", last: "Mueller" });
  });

  // Der Grund fuer diese Datei: bis 2026-07-28 wurde daraus first="Anna",
  // last="Maria von Gunten".
  it("haelt einen Namenszusatz beim Nachnamen", () => {
    expect(splitPersonName("Anna Maria von Gunten")).toEqual({
      first: "Anna Maria",
      last: "von Gunten",
    });
    expect(splitPersonName("Jean de la Tour")).toEqual({ first: "Jean", last: "de la Tour" });
    expect(splitPersonName("Peter van den Berg")).toEqual({ first: "Peter", last: "van den Berg" });
  });

  it("behandelt einen fuehrenden Zusatz als Teil des Namens, nicht als Trennstelle", () => {
    // "Von Allmen" ist hier der ganze Name — es gibt keinen Vornamen davor.
    expect(splitPersonName("Von Allmen")).toEqual({ first: "Von", last: "Allmen" });
  });

  it("bevorzugt die Kommaform, weil sie eindeutig ist", () => {
    expect(splitPersonName("Mueller, Anna Maria")).toEqual({
      first: "Anna Maria",
      last: "Mueller",
    });
    expect(splitPersonName("von Gunten, Anna")).toEqual({ first: "Anna", last: "von Gunten" });
  });

  it("wertet ein einzelnes Wort als Nachnamen", () => {
    expect(splitPersonName("Mueller")).toEqual({ first: "", last: "Mueller" });
  });

  it("kommt mit leer, null und ueberzaehligen Leerzeichen zurecht", () => {
    expect(splitPersonName("")).toEqual({ first: "", last: "" });
    expect(splitPersonName("   ")).toEqual({ first: "", last: "" });
    expect(splitPersonName(null)).toEqual({ first: "", last: "" });
    expect(splitPersonName(undefined)).toEqual({ first: "", last: "" });
    expect(splitPersonName("  Anna   Mueller  ")).toEqual({ first: "Anna", last: "Mueller" });
  });
});

describe("joinPersonName", () => {
  it("setzt beide Teile mit genau einem Leerzeichen zusammen", () => {
    expect(joinPersonName("Anna", "Mueller")).toBe("Anna Mueller");
  });

  it("erzeugt bei fehlenden Teilen keinen Rand und kein doppeltes Leerzeichen", () => {
    expect(joinPersonName("", "Mueller")).toBe("Mueller");
    expect(joinPersonName("Anna", "")).toBe("Anna");
    expect(joinPersonName(null, "Mueller")).toBe("Mueller");
    expect(joinPersonName(undefined, undefined)).toBe("");
    expect(joinPersonName("  Anna  ", "  Mueller  ")).toBe("Anna Mueller");
  });
});

describe("Hin- und Rueckweg", () => {
  it("ueberlebt den Umweg ueber ein einzelnes Feld", () => {
    const faelle: [string, string][] = [
      ["Anna", "Mueller"],
      ["Anna Maria", "Mueller"],
      ["Anna Maria", "von Gunten"],
      ["Jean", "de la Tour"],
      ["", "Mueller"],
    ];
    for (const [first, last] of faelle) {
      expect(splitPersonName(joinPersonName(first, last))).toEqual({ first, last });
    }
  });

  it("kann einen mehrteiligen Nachnamen ohne Zusatz NICHT zurueckgewinnen", () => {
    // Dokumentiert die Grenze: "Meier Schmid" als Nachname wird beim Umweg ueber
    // ein Feld zu first="Meier", last="Schmid". Genau deshalb tragen neue
    // Datensaetze beide Felder getrennt und benutzen diese Funktion nicht.
    expect(splitPersonName(joinPersonName("Anna", "Meier Schmid"))).toEqual({
      first: "Anna Meier",
      last: "Schmid",
    });
  });
});
