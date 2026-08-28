import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BEKANNTE_AUSNAHMEN,
  findeFormatVorlagen,
  fuehrtDynamischAus,
  gelesenePersistenzTabellen,
  hatVerkettetesDDL,
  laeuftInEinerTransaktion,
  ohneKommentare,
  pruefeDatei,
  pruefeRollbackArtefakte,
  rollbackDateien,
  unerklaerteVerstoesse,
  veralteteAusnahmen,
} from "../rollback-guard";

/** Der Befund M01-04 im Original — so stand er in der Datei. */
const VERWUNDBAR = `
BEGIN;
DO $r$
DECLARE z record;
BEGIN
  SELECT * INTO z FROM public.undo_20260828100000;
  EXECUTE format(
    'CREATE POLICY %I ON public.landing_page_analytics FOR INSERT WITH CHECK (%s)',
    z.policyname, coalesce(z.withcheck, 'true')
  );
END
$r$;
COMMIT;
`;

/** Dieselbe Absicht, sicher gelöst: der Wert bestätigt nur noch. */
const SICHER = `
BEGIN;
DO $r$
DECLARE z record;
BEGIN
  SELECT * INTO z FROM public.undo_20260828100000;
  IF coalesce(z.withcheck, 'true') <> 'true' THEN
    RAISE EXCEPTION 'unerwartetes WITH CHECK "%"', z.withcheck;
  END IF;
  CREATE POLICY "Service role can insert analytics"
    ON public.landing_page_analytics FOR INSERT WITH CHECK (true);
END
$r$;
COMMIT;
`;

describe("Rücknahme-Tor · die Bausteine", () => {
  it("entfernt Kommentare, bevor gesucht wird", () => {
    const mitErklaerung = `-- Frueher stand hier format('… (%s)', z.withcheck).\nSELECT 1;`;
    expect(ohneKommentare(mitErklaerung)).not.toContain("%s");
  });

  it("findet die Vorlage und ihre Platzhalter", () => {
    const [treffer] = findeFormatVorlagen(VERWUNDBAR);
    expect(treffer.platzhalter).toEqual(["%I", "%s"]);
  });

  it("erkennt eine Ausführung auch ohne benachbartes format()", () => {
    expect(fuehrtDynamischAus("v_sql := 'x';\nEXECUTE v_sql;")).toBe(true);
    expect(fuehrtDynamischAus("SELECT 1;")).toBe(false);
  });

  it("sieht eine Tabelle auch hinter JOIN, nicht nur hinter FROM", () => {
    expect(
      gelesenePersistenzTabellen("SELECT u.x FROM pg_class c JOIN public.undo_20260828100000 u ON true"),
    ).toEqual(["public.undo_20260828100000"]);
  });

  it("hält Katalogquellen NICHT für Persistenztabellen", () => {
    expect(gelesenePersistenzTabellen("FROM pg_proc p JOIN pg_namespace n")).toEqual([]);
    expect(gelesenePersistenzTabellen("FROM pg_catalog.pg_policy")).toEqual([]);
    expect(gelesenePersistenzTabellen("FROM public.undo_20260828100000")).toEqual([
      "public.undo_20260828100000",
    ]);
  });

  it("erkennt Verkettung als Umgehung der Quotierung", () => {
    expect(hatVerkettetesDDL("EXECUTE 'GRANT ' || r.recht || ' ON t TO anon';")).toBe(true);
    expect(hatVerkettetesDDL("EXECUTE format('GRANT %s', sig);")).toBe(false);
  });

  it("verlangt eine Transaktion", () => {
    expect(laeuftInEinerTransaktion("BEGIN;\nDROP TABLE x;\nCOMMIT;")).toBe(true);
    expect(laeuftInEinerTransaktion("DROP TABLE x;")).toBe(false);
  });
});

describe("Rücknahme-Tor · die Regel", () => {
  it("weist die verwundbare Fassung ab", () => {
    const v = pruefeDatei("fixture.sql", VERWUNDBAR);
    expect(v.map((x) => x.art)).toContain("gespeicherter-wert-wird-sql");
  });

  it("lässt die korrigierte Fassung durch", () => {
    expect(pruefeDatei("fixture.sql", SICHER)).toEqual([]);
  });

  it("lässt %s aus dem Katalog durch — das ist kein Verbot dynamischen SQL", () => {
    const ausDemKatalog = `
BEGIN;
DO $r$ DECLARE sig text; BEGIN
  FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', sig);
  END LOOP;
END $r$;
COMMIT;`;
    expect(pruefeDatei("katalog.sql", ausDemKatalog)).toEqual([]);
  });

  it("weist eine Rücknahme ohne Transaktion ab", () => {
    const ohneTx = `ALTER TABLE public.x ENABLE ROW LEVEL SECURITY;`;
    expect(pruefeDatei("ohne-tx.sql", ohneTx).map((x) => x.art)).toEqual([
      "keine-transaktion",
    ]);
  });

  it("weist eine Erklärung im Kommentar NICHT ab", () => {
    const nurErklaert = `
BEGIN;
-- Frueher stand hier EXECUTE format('… WITH CHECK (%s)', z.withcheck) — behoben.
SELECT * FROM public.undo_20260828100000;
COMMIT;`;
    expect(pruefeDatei("erklaert.sql", nurErklaert)).toEqual([]);
  });
});

describe("Rücknahme-Tor · die zwei Umgehungen der unabhängigen Durchsicht", () => {
  /** A: der Wert geht über eine Variable — EXECUTE steht nicht neben format(). */
  const UMGEHUNG_VARIABLE = `
BEGIN;
DO $r$
DECLARE v_check text; v_sql text;
BEGIN
  SELECT withcheck INTO v_check FROM public.undo_20260828100000;
  v_sql := format('CREATE POLICY p ON public.landing_page_analytics FOR INSERT WITH CHECK (%s)', v_check);
  EXECUTE v_sql;
END
$r$;
COMMIT;`;

  /** B: die Tabelle wird über JOIN erreicht, nicht über FROM. */
  const UMGEHUNG_JOIN = `
BEGIN;
DO $r$
DECLARE r record;
BEGIN
  FOR r IN SELECT u.withcheck AS wc FROM pg_class c JOIN public.undo_20260828100000 u ON true LOOP
    EXECUTE format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%s)', r.wc);
  END LOOP;
END
$r$;
COMMIT;`;

  it("A · Variablen-Umweg wird erkannt", () => {
    expect(pruefeDatei("a.sql", UMGEHUNG_VARIABLE).map((v) => v.art))
      .toContain("gespeicherter-wert-wird-sql");
  });

  it("B · JOIN statt FROM wird erkannt", () => {
    expect(pruefeDatei("b.sql", UMGEHUNG_JOIN).map((v) => v.art))
      .toContain("gespeicherter-wert-wird-sql");
  });

  it("und der Katalogfall bleibt trotzdem erlaubt", () => {
    const ausDemKatalog = `
BEGIN;
DO $r$ DECLARE sig text; v text; BEGIN
  FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace LOOP
    v := format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', sig);
    EXECUTE v;
  END LOOP;
END $r$;
COMMIT;`;
    expect(pruefeDatei("katalog.sql", ausDemKatalog)).toEqual([]);
  });
});

describe("Rücknahme-Tor · gegen das echte Verzeichnis", () => {
  it("prüft überhaupt Dateien", () => {
    expect(rollbackDateien().length).toBeGreaterThan(50);
  });

  it("kein Verstoss ohne begründeten Eintrag", () => {
    const offen = unerklaerteVerstoesse(pruefeRollbackArtefakte());
    expect(
      offen.map((v) => `${v.datei} · ${v.art}\n    ${v.detail}`).join("\n"),
    ).toBe("");
  });

  it("kein Eintrag, der keinen Verstoss mehr beschreibt", () => {
    expect(veralteteAusnahmen(pruefeRollbackArtefakte()).map((a) => a.datei)).toEqual([]);
  });

  it("jede Ausnahme nennt einen Grund", () => {
    for (const a of BEKANNTE_AUSNAHMEN) {
      expect(a.grund.length, `${a.datei} ohne Begründung`).toBeGreaterThan(80);
    }
  });

  it("jede Ausnahme trägt eine Einstufung aus einem Ende-zu-Ende-Test", () => {
    for (const a of BEKANNTE_AUSNAHMEN) {
      expect(
        ["CONFIRMED_STORED_PRIVILEGE_ESCALATION", "REFUTED_BY_EXACT_PARSER_AND_QUOTING_TEST", "NEEDS_MORE_EVIDENCE"],
        `${a.datei} ohne Einstufung`,
      ).toContain(a.einstufung);
      expect(a.beleg, `${a.datei} ohne Belegpfad`).toMatch(/^ops\//);
    }
  });

  it("eine bestätigte Eskalation darf NICHT als Ausnahme stehenbleiben", () => {
    // Eine Ausnahme ist eine Feststellung, kein Freibrief. Wird eine je als
    // CONFIRMED eingestuft, muss das Artefakt korrigiert werden — nicht der Eintrag.
    expect(
      BEKANNTE_AUSNAHMEN.filter((a) => a.einstufung === "CONFIRMED_STORED_PRIVILEGE_ESCALATION")
        .map((a) => a.datei),
    ).toEqual([]);
  });

  it("die korrigierte R-1-Rücknahme ist sauber", () => {
    const verstoesse = pruefeRollbackArtefakte().filter((v) =>
      v.datei.startsWith("ROLLBACK_20260828100000"),
    );
    expect(verstoesse).toEqual([]);
  });
});

describe("Rücknahme-Tor · eingeschleuste Verletzung, danach zurückgebaut", () => {
  it("schlägt bei einer neu eingeschleusten Datei an und ist danach wieder grün", () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), "rollback-tor-"));
    try {
      const sauber = join(verzeichnis, "ROLLBACK_29990101000000_sauber.sql");
      writeFileSync(sauber, SICHER);
      expect(unerklaerteVerstoesse(pruefeRollbackArtefakte(verzeichnis))).toEqual([]);

      // Einschleusen
      const boese = join(verzeichnis, "ROLLBACK_29990102000000_eingeschleust.sql");
      writeFileSync(boese, VERWUNDBAR);
      const nachher = unerklaerteVerstoesse(pruefeRollbackArtefakte(verzeichnis));
      expect(nachher).toHaveLength(1);
      expect(nachher[0].datei).toBe("ROLLBACK_29990102000000_eingeschleust.sql");
      expect(nachher[0].art).toBe("gespeicherter-wert-wird-sql");

      // Zurückbauen
      rmSync(boese);
      expect(unerklaerteVerstoesse(pruefeRollbackArtefakte(verzeichnis))).toEqual([]);
    } finally {
      rmSync(verzeichnis, { recursive: true, force: true });
    }
  });
});

/**
 * Die Fallmatrix der zweiten unabhängigen Durchsicht.
 *
 * Sie hat drei dieser Formen durchgelassen bekommen (`%1$s`, `%L`-in-`DO`,
 * Mehrvariablen-Verkettung) und die legitime Katalogform L2 fälschlich
 * abgewiesen. Jeder Fall steht hier, damit keiner davon zurückkommt.
 */
describe("Rücknahme-Tor · Fallmatrix der Durchsicht", () => {
  const rumpf = (b: string) =>
    `BEGIN;\nDO $r$\nDECLARE v_check text; v_sql text; a text; b text; z record;\nBEGIN\n${b}\nEND\n$r$;\nCOMMIT;`;

  const LESEN = "SELECT withcheck INTO v_check FROM public.undo_20260828100000;";

  const ANGRIFFE: Array<[string, string]> = [
    ["numerierter Platzhalter %1$s", rumpf(`${LESEN}
      EXECUTE format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%1$s)', v_check);`)],
    ["%L als DO-Rumpf", rumpf(`${LESEN}\n      EXECUTE format('DO %L', v_check);`)],
    ["Verkettung über mehrere Variablen", rumpf(`${LESEN}
      a := 'CREATE POLICY p ON public.x FOR INSERT WITH CHECK (';
      b := a || v_check;
      EXECUTE b;`)],
    ["Variablenzuweisung", rumpf(`${LESEN}
      v_sql := format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%s)', v_check);
      EXECUTE v_sql;`)],
    ["JOIN statt FROM", rumpf(`FOR z IN SELECT u.withcheck AS wc FROM pg_class c JOIN public.undo_20260828100000 u ON true LOOP
      EXECUTE format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%s)', z.wc); END LOOP;`)],
    ["CTE", rumpf(`WITH x AS (SELECT withcheck w FROM public.undo_20260828100000) SELECT w INTO v_check FROM x;
      EXECUTE format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%s)', v_check);`)],
    ["FOR-Schleife", rumpf(`FOR z IN SELECT * FROM public.undo_20260828100000 LOOP
      EXECUTE format('CREATE POLICY p ON public.x FOR INSERT WITH CHECK (%s)', z.withcheck); END LOOP;`)],
    ["quote_literal-Verkettung", rumpf(`${LESEN}\n      EXECUTE 'DO ' || quote_literal(v_check);`)],
    ["direkte Verkettung im EXECUTE", rumpf(`${LESEN}
      EXECUTE 'CREATE POLICY p ON public.x WITH CHECK (' || v_check || ')';`)],
  ];

  const ERLAUBT: Array<[string, string]> = [
    ["Katalog, FOR-Form", rumpf(`FOR z IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', z.sig); END LOOP;`)],
    ["Katalog, SELECT … INTO", rumpf(`SELECT p.oid::regprocedure::text INTO v_check FROM pg_proc p LIMIT 1;
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', v_check);`)],
    ["PERFORM ohne EXECUTE", rumpf(`${LESEN}\n      PERFORM format('x %s', v_check);`)],
  ];

  it.each(ANGRIFFE)("weist ab: %s", (_name, quelle) => {
    expect(pruefeDatei("angriff.sql", quelle).length).toBeGreaterThan(0);
  });

  it.each(ERLAUBT)("lässt durch: %s", (_name, quelle) => {
    expect(pruefeDatei("erlaubt.sql", quelle)).toEqual([]);
  });
});

/**
 * Die vier Umgehungen, die die dritte Durchsicht in den NEUEN Regeln fand.
 *
 * Sie waren nur ad hoc bewiesen. Ein Beweis, der nicht in der Testreihe steht,
 * ist beim nächsten Umbau verschwunden — deshalb hier einzeln benannt, jeweils
 * mit der Katalog-Gegenprobe daneben, damit niemand einen echten Treffer
 * abschwächt, um ein Falsch-Positiv loszuwerden.
 */
describe("Rücknahme-Tor · die vier nachgereichten Umgehungen", () => {
  const rumpf = (b: string) =>
    `BEGIN;\nDO $r$\nDECLARE v text; v1 text; v2 text; v3 text; z record;\nBEGIN\n${b}\nEND\n$r$;\nCOMMIT;`;
  const LIES_PERSISTENT = "SELECT withcheck INTO v FROM public.undo_20260828100000;";

  describe("A · Zusammenbau über concat()", () => {
    it("weist concat() ab", () => {
      const q = rumpf(`${LIES_PERSISTENT}
        v1 := concat('CREATE POLICY p ON public.t FOR INSERT WITH CHECK (', v, ')');
        EXECUTE v1;`);
      expect(pruefeDatei("a.sql", q).map((x) => x.art)).toContain("verkettetes-ddl");
    });

    it("weist CONCAT() in Grossschreibung ab", () => {
      const q = rumpf(`${LIES_PERSISTENT}
        v1 := CONCAT('CREATE POLICY p ON public.t FOR INSERT WITH CHECK (', v, ')');
        EXECUTE v1;`);
      expect(pruefeDatei("a.sql", q).length).toBeGreaterThan(0);
    });

    it("weist pg_catalog.concat() ab", () => {
      const q = rumpf(`${LIES_PERSISTENT}
        v1 := pg_catalog.concat('CREATE POLICY p ON public.t WITH CHECK (', v, ')');
        EXECUTE v1;`);
      expect(pruefeDatei("a.sql", q).length).toBeGreaterThan(0);
    });
  });

  describe("B · Zusammenbau über mehrere schlichte Kopien", () => {
    it("weist die Kette Quelle → v1 → v2 → v3 → EXECUTE ab", () => {
      // Zwischen dem Lesen, dem format-losen Zusammenbau und dem EXECUTE liegt
      // keine Nachbarschaft mehr. Genau darauf hatte das Tor einmal gebaut.
      const q = rumpf(`${LIES_PERSISTENT}
        v1 := 'CREATE POLICY p ON public.t FOR INSERT WITH CHECK (' || v;
        v2 := v1;
        v3 := v2;
        EXECUTE v3;`);
      expect(pruefeDatei("b.sql", q).map((x) => x.art)).toContain("verkettetes-ddl");
    });
  });

  describe("C · Persistenzquelle über Komma-Join", () => {
    it("weist FROM pg_class AS c, public.undo_… AS u ab", () => {
      const q = rumpf(`SELECT u.withcheck INTO v FROM pg_class AS c, public.undo_20260828100000 AS u LIMIT 1;
        EXECUTE format('CREATE POLICY p ON public.t FOR INSERT WITH CHECK (%s)', v);`);
      expect(pruefeDatei("c.sql", q).map((x) => x.art)).toContain("gespeicherter-wert-wird-sql");
    });

    it("lässt einen reinen Katalog-Komma-Join durch", () => {
      // Gegenprobe: die Regel darf nicht jeden Komma-Join zum Verstoss machen.
      const q = rumpf(`SELECT p.oid::regprocedure::text INTO v FROM pg_proc AS p, pg_namespace AS n LIMIT 1;
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', v);`);
      expect(pruefeDatei("c.sql", q)).toEqual([]);
    });
  });

  describe("D · Persistenzquelle über MERGE INTO", () => {
    it("weist ein schemaqualifiziertes MERGE INTO mit Alias ab", () => {
      const q = rumpf(`MERGE INTO public.undo_20260828100000 AS t
          USING (SELECT 1 AS x) AS s ON true
          WHEN MATCHED THEN UPDATE SET withcheck = 'x';
        SELECT 'true' INTO v;
        EXECUTE format('CREATE POLICY p ON public.t FOR INSERT WITH CHECK (%s)', v);`);
      expect(pruefeDatei("d.sql", q).map((x) => x.art)).toContain("gespeicherter-wert-wird-sql");
    });
  });

  describe("Katalogfälle bleiben unangetastet", () => {
    it.each([
      ["regprocedure in der FOR-Form", `FOR z IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', z.sig); END LOOP;`],
      ["Katalog SELECT … INTO", `SELECT p.oid::regprocedure::text INTO v FROM pg_proc p LIMIT 1;
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', v);`],
      ["Katalogwert über eine Zwischenvariable", `SELECT p.oid::regprocedure::text INTO v FROM pg_proc p LIMIT 1;
        v1 := format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', v);
        EXECUTE v1;`],
    ])("akzeptiert: %s", (_name, koerper) => {
      expect(pruefeDatei("katalog.sql", rumpf(koerper))).toEqual([]);
    });
  });
});
