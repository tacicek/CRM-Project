import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BEKANNTE_AUSNAHMEN,
  findeDynamischesDDL,
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
    const [treffer] = findeDynamischesDDL(VERWUNDBAR);
    expect(treffer.platzhalter).toEqual(["%I", "%s"]);
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
        ["CONFIRMED_STORED_PRIVILEGE_ESCALATION", "REFUTED_BY_PARSER_AND_QUOTING", "NEEDS_MORE_EVIDENCE"],
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
