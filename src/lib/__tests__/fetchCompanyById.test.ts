import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der echte Client baut sich beim Import gegen `localStorage` — unter
 * `environment: "node"` gibt es das nicht. Der Mock ersetzt das Modul, bevor es
 * geladen wird, und protokolliert zugleich, WONACH gefragt wurde. Genau das ist
 * hier der Prueffall: die alte Aufloesung fragte nach E-Mail und Alter, die
 * neue darf ausschliesslich nach der `id` fragen.
 */
const aufrufe: Array<{ methode: string; argumente: unknown[] }> = [];
let antwort: { data: unknown; error: unknown } = { data: null, error: null };

const abfrageBauer = () => {
  const bauer = {
    select: (...a: unknown[]) => { aufrufe.push({ methode: "select", argumente: a }); return bauer; },
    eq: (...a: unknown[]) => { aufrufe.push({ methode: "eq", argumente: a }); return bauer; },
    in: (...a: unknown[]) => { aufrufe.push({ methode: "in", argumente: a }); return bauer; },
    order: (...a: unknown[]) => { aufrufe.push({ methode: "order", argumente: a }); return bauer; },
    limit: (...a: unknown[]) => { aufrufe.push({ methode: "limit", argumente: a }); return bauer; },
    maybeSingle: () => { aufrufe.push({ methode: "maybeSingle", argumente: [] }); return Promise.resolve(antwort); },
    single: () => { aufrufe.push({ methode: "single", argumente: [] }); return Promise.resolve(antwort); },
  };
  return bauer;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabelle: string) => {
      aufrufe.push({ methode: "from", argumente: [tabelle] });
      return abfrageBauer();
    },
  },
}));

const { fetchCompanyById } = await import("../fetchCompanyById");

const FIRMA_A = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  aufrufe.length = 0;
  antwort = { data: null, error: null };
});

describe("fetchCompanyById", () => {
  it("fragt genau eine Tabelle und genau eine id ab", async () => {
    antwort = { data: { id: FIRMA_A, company_name: "A" }, error: null };

    const zeile = await fetchCompanyById<{ id: string }>({
      companyId: FIRMA_A,
      select: "id, company_name",
    });

    expect(zeile).toEqual({ id: FIRMA_A, company_name: "A" });
    expect(aufrufe.filter((a) => a.methode === "from").map((a) => a.argumente[0])).toEqual(["companies"]);
    expect(aufrufe.filter((a) => a.methode === "eq")).toEqual([
      { methode: "eq", argumente: ["id", FIRMA_A] },
    ]);
  });

  it("raet nicht: kein Sortieren nach Alter, kein Filter auf E-Mail, keine Mitgliedschaftsabfrage", async () => {
    antwort = { data: { id: FIRMA_A }, error: null };
    await fetchCompanyById({ companyId: FIRMA_A, select: "id" });

    // Das war die Auswahlregel des alten Helfers, und genau sie hat bei zwei
    // Firmen die falsche geliefert.
    expect(aufrufe.some((a) => a.methode === "order")).toBe(false);
    expect(aufrufe.some((a) => a.methode === "in")).toBe(false);
    const eqFelder = aufrufe.filter((a) => a.methode === "eq").map((a) => a.argumente[0]);
    expect(eqFelder).not.toContain("email");
    expect(eqFelder).not.toContain("notification_email");
    expect(aufrufe.filter((a) => a.methode === "from").map((a) => a.argumente[0]))
      .not.toContain("company_members");
  });

  it("fragt ohne Mandanten gar nicht erst", async () => {
    // Kein Rueckfall auf "die eine Firma": solange der Kontext laedt, ist die
    // richtige Antwort "noch keine", nicht "irgendeine".
    expect(await fetchCompanyById({ companyId: null, select: "id" })).toBeNull();
    expect(await fetchCompanyById({ companyId: undefined, select: "id" })).toBeNull();
    expect(await fetchCompanyById({ companyId: "", select: "id" })).toBeNull();
    expect(aufrufe).toEqual([]);
  });

  it("liefert null statt eines Fehlers, wenn die id nicht sichtbar ist", async () => {
    // Fremde id unter RLS: leere Menge, kein Fehler. `maybeSingle` haelt das so —
    // `single` wuerde 406 melden und damit bestaetigen, dass es die Zeile gibt.
    antwort = { data: null, error: null };
    expect(await fetchCompanyById({ companyId: FIRMA_A, select: "id" })).toBeNull();
    expect(aufrufe.some((a) => a.methode === "maybeSingle")).toBe(true);
    expect(aufrufe.some((a) => a.methode === "single")).toBe(false);
  });

  it("wirft den Datenbankfehler weiter, statt ihn zu schlucken", async () => {
    antwort = { data: null, error: new Error("connection reset") };
    await expect(fetchCompanyById({ companyId: FIRMA_A, select: "id" })).rejects.toThrow("connection reset");
  });
});
