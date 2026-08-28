import { describe, expect, it, vi } from "vitest";
import {
  guardAntwortHeaders,
  guardPaidApiCall,
  type PaidApiGuardDeps,
} from "../paidApiGuard";

const USER = "11111111-1111-1111-1111-111111111111";
const CO = "aaaaaaaa-0000-0000-0000-00000000000a";

/**
 * Die wichtigste Zusage dieser Datei: eine abgewiesene Anfrage erreicht Google
 * NIE. Deshalb steht der Transport hier als Spion daneben — wenn er auch nur
 * einmal aufgerufen wird, wo er nicht darf, faellt der Test.
 */
const deps = (o: Partial<PaidApiGuardDeps> = {}): PaidApiGuardDeps => ({
  verifyToken: async () => USER,
  consumeBudget: async () => ({ allowed: true, retry_after: 0 }),
  ...o,
});

const eingabe = (o: Partial<Parameters<typeof guardPaidApiCall>[0]> = {}) => ({
  bucket: "google-distance" as const,
  authorizationHeader: `Bearer echtes.jwt.hier`,
  companyId: CO,
  ...o,
});

describe("Ohne gueltiges Token gibt es keine bezahlte API", () => {
  it("kein Authorization-Header → 401, kein Budgetverbrauch", async () => {
    const consume = vi.fn();
    const r = await guardPaidApiCall(
      eingabe({ authorizationHeader: null }),
      deps({ consumeBudget: consume }),
    );
    expect(r).toMatchObject({ ok: false, status: 401, code: "no_token" });
    expect(consume).not.toHaveBeenCalled();
  });

  it("leerer Bearer → 401", async () => {
    for (const h of ["", "Bearer", "Bearer    ", "   "]) {
      const r = await guardPaidApiCall(eingabe({ authorizationHeader: h }), deps());
      expect(r).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("ungueltiges Token → 401, kein Budgetverbrauch", async () => {
    const consume = vi.fn();
    const r = await guardPaidApiCall(
      eingabe(),
      deps({ verifyToken: async () => null, consumeBudget: consume }),
    );
    expect(r).toMatchObject({ ok: false, status: 401, code: "invalid_token" });
    expect(consume).not.toHaveBeenCalled();
  });

  it("gestoerte Tokenpruefung → 503, NICHT durchgelassen", async () => {
    const consume = vi.fn();
    const r = await guardPaidApiCall(
      eingabe(),
      deps({
        verifyToken: async () => { throw new Error("auth down"); },
        consumeBudget: consume,
      }),
    );
    expect(r).toMatchObject({ ok: false, status: 503, code: "auth_unavailable" });
    expect(consume).not.toHaveBeenCalled();
  });
});

describe("Die Firma wird nicht geglaubt", () => {
  it("fehlende oder unfoermige company_id → 400, kein Budgetverbrauch", async () => {
    const consume = vi.fn();
    for (const c of [undefined, null, "", "nicht-uuid", 42, {}, ["x"]]) {
      const r = await guardPaidApiCall(eingabe({ companyId: c }), deps({ consumeBudget: consume }));
      expect(r).toMatchObject({ ok: false, status: 400, code: "company_id_missing" });
    }
    expect(consume).not.toHaveBeenCalled();
  });

  it("die Mitgliedschaft prueft die Datenbank, nicht diese Datei", async () => {
    // Eine formal gueltige, aber fremde company_id kommt hier durch — und
    // scheitert in `consume_api_budget` mit `insufficient_privilege`. Genau so
    // ist es gewollt: die Wahrheit ueber Mitgliedschaft steht in der Datenbank.
    const r = await guardPaidApiCall(
      eingabe({ companyId: "bbbbbbbb-0000-0000-0000-00000000000b" }),
      deps({ consumeBudget: async () => { throw new Error("insufficient_privilege"); } }),
    );
    expect(r).toMatchObject({ ok: false, status: 503, code: "budget_unavailable" });
  });
});

describe("Budget", () => {
  it("erschoepft → 429 mit deterministischem Retry-After", async () => {
    const r = await guardPaidApiCall(
      eingabe(),
      deps({ consumeBudget: async () => ({ allowed: false, retry_after: 42 }) }),
    );
    expect(r).toMatchObject({ ok: false, status: 429, code: "rate_limited", retryAfterSeconds: 42 });
    expect(guardAntwortHeaders(r as never)).toEqual({ "Retry-After": "42" });
  });

  it("Retry-After ist nie 0 und nie gebrochen", async () => {
    for (const [roh, erwartet] of [[0, 1], [0.2, 1], [1.4, 2], [59.9, 60]] as const) {
      const r = await guardPaidApiCall(
        eingabe(),
        deps({ consumeBudget: async () => ({ allowed: false, retry_after: roh }) }),
      );
      expect((r as { retryAfterSeconds: number }).retryAfterSeconds).toBe(erwartet);
    }
  });

  it("gestoerter Zaehler → 503 FAIL CLOSED, nicht durchgelassen", async () => {
    // Eine kaputte Drossel ist kein Freibrief.
    const r = await guardPaidApiCall(
      eingabe(),
      deps({ consumeBudget: async () => { throw new Error("connection reset"); } }),
    );
    expect(r).toMatchObject({ ok: false, status: 503, code: "budget_unavailable" });
    expect((r as { ok: boolean }).ok).toBe(false);
  });

  it("erlaubt → weiter, mit serverseitig abgeleiteter Benutzer-ID", async () => {
    const r = await guardPaidApiCall(eingabe(), deps());
    expect(r).toEqual({ ok: true, userId: USER, companyId: CO });
  });

  it("die Benutzer-ID stammt aus der Tokenpruefung, nicht aus dem Rumpf", async () => {
    const r = await guardPaidApiCall(
      // Selbst wenn der Rumpf etwas anderes behauptet — hier gibt es kein Feld dafuer.
      eingabe(),
      deps({ verifyToken: async () => "99999999-9999-9999-9999-999999999999" }),
    );
    expect(r).toMatchObject({ ok: true, userId: "99999999-9999-9999-9999-999999999999" });
  });
});

describe("Eine abgewiesene Anfrage erreicht Google nie", () => {
  /** Steht fuer den bezahlten Transport. Jeder Aufruf kostet Geld. */
  const googleSpion = vi.fn(async () => ({ ok: true }));

  const handlerMitSpion = async (
    e: Parameters<typeof guardPaidApiCall>[0],
    d: PaidApiGuardDeps,
  ) => {
    const g = await guardPaidApiCall(e, d);
    if (!g.ok) return g;                 // ← hier endet es, ohne Transport
    await googleSpion();
    return g;
  };

  it("kein Token · ungueltiges Token · fehlende Firma · Budget erschoepft · Zaehler kaputt", async () => {
    googleSpion.mockClear();

    await handlerMitSpion(eingabe({ authorizationHeader: null }), deps());
    await handlerMitSpion(eingabe(), deps({ verifyToken: async () => null }));
    await handlerMitSpion(eingabe({ companyId: "x" }), deps());
    await handlerMitSpion(eingabe(), deps({ consumeBudget: async () => ({ allowed: false, retry_after: 5 }) }));
    await handlerMitSpion(eingabe(), deps({ consumeBudget: async () => { throw new Error("down"); } }));

    expect(googleSpion).toHaveBeenCalledTimes(0);
  });

  it("und wird bei einer erlaubten Anfrage GENAU EINMAL erreicht", async () => {
    googleSpion.mockClear();
    await handlerMitSpion(eingabe(), deps());
    expect(googleSpion).toHaveBeenCalledTimes(1);
  });
});

describe("frischer Worker je Anfrage — der Kern von R2-01", () => {
  /**
   * Die alte Drossel hielt ihren Zaehler in einer Modul-`Map`. Der Edge-Runtime
   * erzeugt je Anfrage einen eigenen Worker (`EdgeRuntime.userWorkers.create`),
   * also startete diese Map jedes Mal leer und konnte nie ausloesen — deshalb
   * blieb P0-S3a offen, obwohl die Drossel ausgerollt war.
   *
   * Dieser Test bildet genau das nach: fuer JEDE Anfrage ein frisch gebautes
   * Abhaengigkeitsbuendel, kein geteilter Modulzustand. Der Zaehler liegt in
   * Postgres, also muss die Grenze trotzdem greifen. Wuerde jemand den Zaehler
   * je wieder in den Modulkopf verschieben, wird dieser Test rot.
   */
  it("61 Anfragen mit je frischem Modulzustand erreichen trotzdem 429", async () => {
    // Der einzige geteilte Zustand ist der Topf — wie in der Datenbank.
    let verbraucht = 0;
    const GRENZE = 60;

    const frischeAbhaengigkeiten = () => ({
      verifyToken: async () => ({ userId: USER }),
      consumeBudget: async () => {
        verbraucht += 1;
        return verbraucht <= GRENZE
          ? { allowed: true as const }
          : { allowed: false as const, retryAfter: 42 };
      },
      log: () => {},
    });

    const status: number[] = [];
    for (let i = 0; i < 61; i++) {
      // Frisches Buendel = frischer Worker. Nichts ueberlebt die Runde ausser
      // dem serverseitigen Topf.
      const antwort = await guardPaidApiCall(
        eingabe(),
        frischeAbhaengigkeiten(),
      );
      status.push(antwort.ok ? 200 : antwort.status);
    }

    expect(status.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(status[60]).toBe(429);
  });

  it("ein Zaehler im Modulkopf wuerde diesen Test NICHT bestehen", async () => {
    // Gegenprobe: derselbe Ablauf mit einem Zaehler, der je Buendel neu beginnt
    // — also die alte, wirkungslose Bauart. Sie erreicht nie 429.
    const modulKopfBauart = () => {
      let lokal = 0; // startet bei jedem Worker neu
      return {
        verifyToken: async () => ({ userId: USER }),
        consumeBudget: async () => {
          lokal += 1;
          return lokal <= 60 ? { allowed: true as const } : { allowed: false as const, retryAfter: 42 };
        },
        log: () => {},
      };
    };

    const status: number[] = [];
    for (let i = 0; i < 61; i++) {
      const antwort = await guardPaidApiCall(
        eingabe(),
        modulKopfBauart(),
      );
      status.push(antwort.ok ? 200 : antwort.status);
    }

    // Kein einziges 429 — genau der gemessene Produktionsbefund R2-01.
    expect(status.filter((s) => s === 429)).toHaveLength(0);
  });
});
