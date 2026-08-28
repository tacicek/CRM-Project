import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TenantMismatchError,
  assertSameTenant,
  createTenantScopedDebounce,
  tenantBound,
} from "../tenantBoundWrite";
import { antwortGehoertNochZumMandanten } from "../aktiverMandant";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

/**
 * Der Ablauf, der die Firma A in die Zeile der Firma B geschrieben hat.
 *
 * Ein statisches Verbot von `fetchSingleCompanyForUser` und `getCachedCompany`
 * faengt ihn NICHT — hier raet niemand eine Firma. Zwei richtige Werte laufen
 * auseinander, weil sie zu verschiedenen Zeitpunkten entstanden sind.
 */
describe("Mandantenwechsel waehrend eines geplanten Schreibvorgangs", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schreibt die A-Nutzlast NICHT unter den Schluessel von B", () => {
    const ablage = new Map<string, string>();
    const entwurf = createTenantScopedDebounce<{ iban: string }>({
      delayMs: 600,
      // Der Schluessel kommt aus DEM PAKET, nicht aus einem Aussenwert.
      write: (tenantId, payload) => ablage.set(`entwurf:${tenantId}`, JSON.stringify(payload)),
    });

    // 1. Firma A ist geladen, der Bediener tippt.
    let aktiverMandant = A;
    entwurf.schedule(tenantBound(A, { iban: "CH-A-4711" }));
    expect(entwurf.pending).toBe(true);

    // 2. Vor Ablauf der 600 ms wechselt der Kontext auf B.
    aktiverMandant = B;
    expect(aktiverMandant).toBe(B); // der Kontext ist sofort umgesprungen

    // 3. Jetzt feuert der Timer.
    vi.advanceTimersByTime(600);

    // 4. Die A-Werte liegen unter A — nicht unter B.
    expect(ablage.get(`entwurf:${A}`)).toBe('{"iban":"CH-A-4711"}');
    expect(ablage.has(`entwurf:${B}`)).toBe(false);
  });

  it("ein Wechsel ersetzt den geplanten Schreibvorgang, statt ihn nachzuholen", () => {
    const ablage = new Map<string, string>();
    const entwurf = createTenantScopedDebounce<{ iban: string }>({
      delayMs: 600,
      write: (t, p) => ablage.set(`entwurf:${t}`, JSON.stringify(p)),
    });

    entwurf.schedule(tenantBound(A, { iban: "CH-A-4711" }));
    vi.advanceTimersByTime(300);          // A ist noch nicht geschrieben
    entwurf.schedule(tenantBound(B, { iban: "CH-B-0815" }));
    vi.advanceTimersByTime(600);

    expect(ablage.has(`entwurf:${A}`)).toBe(false);
    expect(ablage.get(`entwurf:${B}`)).toBe('{"iban":"CH-B-0815"}');
  });

  it("ein abgebrochener Schreibvorgang feuert gar nicht", () => {
    const geschrieben: string[] = [];
    const entwurf = createTenantScopedDebounce<null>({
      delayMs: 600,
      write: (t) => geschrieben.push(t),
    });
    entwurf.schedule(tenantBound(A, null));
    entwurf.cancel();
    vi.advanceTimersByTime(10_000);
    expect(geschrieben).toEqual([]);
    expect(entwurf.pending).toBe(false);
  });

  it("mehrere Wechsel hintereinander hinterlassen nur den letzten", () => {
    const ablage = new Map<string, unknown>();
    const entwurf = createTenantScopedDebounce<number>({
      delayMs: 600,
      write: (t, p) => ablage.set(t, p),
    });
    entwurf.schedule(tenantBound(A, 1));
    vi.advanceTimersByTime(100);
    entwurf.schedule(tenantBound(B, 2));
    vi.advanceTimersByTime(100);
    entwurf.schedule(tenantBound(A, 3));
    vi.advanceTimersByTime(600);
    expect([...ablage.entries()]).toEqual([[A, 3]]);
  });
});

describe("Nutzlast und Ziel einer Mutation", () => {
  it("muessen denselben Mandanten tragen", () => {
    expect(assertSameTenant(A, A)).toBe(A);
  });

  it("ein Bruch ist ein Fehler, kein stiller Schreibvorgang", () => {
    // Genau die Form des Befunds: Nutzlast aus der A-Zeile,
    // `.eq("id", …)` auf B.
    expect(() => assertSameTenant(A, B)).toThrow(TenantMismatchError);
    expect(() => assertSameTenant(A, B)).toThrow(/gehoert zu/);
  });

  it("fehlende Angaben gelten als Bruch, nicht als Erlaubnis", () => {
    for (const [p, z] of [[null, A], [A, null], [undefined, undefined], ["", A]] as const) {
      expect(() => assertSameTenant(p, z)).toThrow(TenantMismatchError);
    }
  });
});

describe("Eine ueberholte Antwort", () => {
  it("darf den Bildschirm des neuen Mandanten nicht mehr fuellen", async () => {
    // Die Abfrage fuer A ist langsam; waehrenddessen wechselt der Bediener zu B.
    let aktiv = A;
    const bildschirm: string[] = [];

    const antwortFuer = (mandant: string, verzoegerung: number) =>
      new Promise<string>((res) => setTimeout(() => res(`Daten von ${mandant}`), verzoegerung));

    vi.useFakeTimers();
    const langsameA = antwortFuer(A, 800).then((daten) => {
      if (antwortGehoertNochZumMandanten(A, aktiv)) bildschirm.push(daten);
    });
    const schnelleB = antwortFuer(B, 100).then((daten) => {
      if (antwortGehoertNochZumMandanten(B, aktiv)) bildschirm.push(daten);
    });

    aktiv = B;                       // Wechsel, waehrend A noch laeuft
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([langsameA, schnelleB]);
    vi.useRealTimers();

    expect(bildschirm).toEqual([`Daten von ${B}`]);
    expect(bildschirm.join()).not.toContain(A);
  });
});
