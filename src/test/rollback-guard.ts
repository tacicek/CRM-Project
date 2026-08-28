import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Rücknahmedateien dürfen gespeicherten Text nicht zu SQL machen.
 *
 * WARUM ES DAS BRAUCHT
 *
 * `ROLLBACK_20260828100000` baute die wiederherzustellende Policy so:
 *
 *   EXECUTE format('CREATE POLICY %I ON … WITH CHECK (%s)',
 *                  z.policyname, coalesce(z.withcheck, 'true'));
 *
 * `%s` setzt roh ein, und `z.withcheck` stand in `undo_20260828100000` — einer
 * Tabelle, die ohne RLS lag und für `anon` beschreibbar war. PL/pgSQL `EXECUTE`
 * nimmt mehrere Anweisungen entgegen, also wählte ein unauthentifizierter
 * Schreiber das SQL, das `postgres` beim Rücknehmen ausführte. Nachgestellt in
 * `ops/artifact-corrections/EVIDENZ-reproduktion-injektion.txt`.
 *
 * Eine Rücknahme ist der gefährlichste Ort für so etwas: sie läuft selten, unter
 * Druck, als Eigentümer, und niemand liest sie vorher noch einmal.
 *
 * WAS DIESES TOR NICHT IST
 *
 * **Kein Verbot dynamischen SQL.** `ROLLBACK_20260828110000` baut
 * `GRANT EXECUTE ON FUNCTION %s` aus `pg_proc.oid::regprocedure::text`. Das ist
 * korrekt und nötig: die Signatur trägt die Argumentliste, `%I` würde sie als
 * einen einzigen Bezeichner quoten und das Statement zerstören. Der Wert kommt
 * aus dem Katalog, nicht aus einer beschreibbaren Tabelle.
 *
 * Die Grenze verläuft also nicht bei „dynamisch", sondern bei **der Herkunft
 * des Werts**: Katalog ja, gespeicherte Zeile nein.
 */

const WURZEL = join(__dirname, "..", "..");
export const STANDARD_VERZEICHNIS = join(WURZEL, "supabase", "migrations");

/**
 * Kommentare entfernen, bevor irgendetwas gesucht wird.
 *
 * Ohne diesen Schritt schlägt das Tor bei der KORRIGIERTEN Fassung an: sie
 * erklärt den alten Fehler im Kommentar und zitiert dabei `%s`. Ein Tor, das
 * eine Erklärung für einen Verstoss hält, erzieht dazu, Erklärungen wegzulassen.
 */
export const ohneKommentare = (quelle: string): string =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

export interface FormatVorlage {
  vorlage: string;
  platzhalter: string[];
}

/**
 * JEDE `format(...)`-Vorlage, nicht nur die direkt hinter `EXECUTE`.
 *
 * Die erste Fassung suchte `EXECUTE\s+format\s*\(` — also Nachbarschaft. Eine
 * unabhaengige Durchsicht hat sie zweimal umgangen:
 *
 *     v_sql := format('… WITH CHECK (%s)', v_check);
 *     EXECUTE v_sql;
 *
 * Dasselbe Primitiv, nur ueber eine Variable. Nachbarschaft ist kein Merkmal;
 * die Kombination aus einer %s-Vorlage, einem EXECUTE irgendwo in der Datei und
 * einem Lesezugriff auf eine Persistenztabelle ist eins.
 */
export const findeFormatVorlagen = (quelle: string): FormatVorlage[] => {
  const treffer: FormatVorlage[] = [];
  const muster = /\bformat\s*\(\s*'((?:[^']|'')*)'/gi;
  let m: RegExpExecArray | null;
  while ((m = muster.exec(quelle)) !== null) {
    treffer.push({
      vorlage: m[1],
      platzhalter: [...m[1].matchAll(/%[sIL]/g)].map((p) => p[0]),
    });
  }
  return treffer;
};

/** Fuehrt die Datei ueberhaupt irgendwo dynamisches SQL aus? */
export const fuehrtDynamischAus = (quelle: string): boolean =>
  /\bEXECUTE\b/i.test(quelle);

/** `EXECUTE 'GRANT …' || irgendwas` — Verkettung umgeht jede Quotierung. */
export const hatVerkettetesDDL = (quelle: string): boolean =>
  /\bEXECUTE\s+(?!format\b)[^;]*\|\|/i.test(quelle);

/**
 * Aus welchen Tabellen liest oder schreibt die Datei?
 *
 * Katalog- und Informationsschema-Quellen gelten als vertrauenswuerdig — sie
 * sind nicht von aussen beschreibbar.
 *
 * `FROM` allein genuegt nicht: die Durchsicht erreichte dieselbe Tabelle ueber
 * `JOIN public.undo_… ON true` und blieb unsichtbar. Deshalb jede Stelle, an
 * der eine Relation benannt wird.
 */
export const gelesenePersistenzTabellen = (quelle: string): string[] => {
  const namen = new Set<string>();
  const muster = /\b(?:FROM|JOIN|INTO|UPDATE|USING)\s+(?:(\w+)\.)?(\w+)/gi;
  for (const m of quelle.matchAll(muster)) {
    const schema = (m[1] ?? "public").toLowerCase();
    const tabelle = m[2].toLowerCase();
    if (schema === "pg_catalog" || schema === "information_schema") continue;
    if (tabelle.startsWith("pg_")) continue;
    // `INSERT INTO … SELECT` und `EXECUTE … USING $1` benennen keine Relation.
    if (["select", "values", "format", "execute"].includes(tabelle)) continue;
    namen.add(`${schema}.${tabelle}`);
  }
  return [...namen].sort();
};

export const laeuftInEinerTransaktion = (quelle: string): boolean =>
  /^\s*BEGIN\s*;/im.test(quelle) && /^\s*COMMIT\s*;/im.test(quelle);

export type VerstossArt =
  | "gespeicherter-wert-wird-sql"
  | "verkettetes-ddl"
  | "keine-transaktion";

export interface Verstoss {
  datei: string;
  art: VerstossArt;
  detail: string;
}

/**
 * Bekannte, geprüfte Ausnahmen.
 *
 * Jeder Eintrag nennt den Grund. Das Tor verlangt, dass die Menge EXAKT stimmt:
 * ein neuer Verstoss ist rot, und ein Eintrag, der nicht mehr verletzt, ist
 * ebenfalls rot — sonst wächst die Liste still weiter und niemand räumt sie.
 */
export interface BekannteAusnahme {
  datei: string;
  art: VerstossArt;
  /** Ergebnis des Ende-zu-Ende-Tests, nicht einer Ueberlegung. */
  einstufung:
    | "CONFIRMED_STORED_PRIVILEGE_ESCALATION"
    | "REFUTED_BY_PARSER_AND_QUOTING"
    | "NEEDS_MORE_EVIDENCE";
  beleg: string;
  grund: string;
}

export const BEKANNTE_AUSNAHMEN: BekannteAusnahme[] = [
  {
    datei: "ROLLBACK_20260802130000_funktionsrechte_zurueckgenommen.sql",
    art: "gespeicherter-wert-wird-sql",
    einstufung: "REFUTED_BY_PARSER_AND_QUOTING",
    beleg: "ops/artifact-corrections/EVIDENZ-ausnahmen-service-role-pfad.txt",
    grund:
      "Interpoliert undo_20260802130000.func_signature mit %s in GRANT EXECUTE. " +
      "Ende-zu-Ende geprueft, nicht ueberlegt: service_role hinterlegte per " +
      "BYPASSRLS die Nutzlast \"public.harmlos() TO PUBLIC; INSERT INTO " +
      "public.beute2 ...; --\", danach lief die Ruecknahme als postgres. " +
      "Ergebnis: ERROR \"expected a right parenthesis\", Transaktion " +
      "zurueckgerollt, Nutzlast NICHT ausgefuehrt. Ursache ist die Schranke " +
      "`IF to_regprocedure(r.func_signature) IS NULL THEN CONTINUE` — sie " +
      "parst den Text. Eine Batterie von zehn Formen (Kommentar, Zeilenumbruch, " +
      "Blockkommentar, zusaetzliche Anweisung, TO-Klausel) passierte in keinem " +
      "Fall; nur syntaktisch gueltige Funktionsreferenzen kommen durch, und die " +
      "bleiben auch eingesetzt gueltige Referenzen. service_role hat ausserdem " +
      "auf KEINEM Schema CREATE (alle 14 gemessen) und kann daher keine " +
      "Funktion mit boesartigem Namen anlegen. " +
      "Die fruehere Begruendung \"service_role haette das DDL ohnehin\" war " +
      "FALSCH: die Durchsicht mass, dass service_role das Eigentuemer-DDL des " +
      "Ruecknahmepfads gerade nicht ausfuehren kann.",
  },
  {
    datei: "ROLLBACK_20260809120000_funktionsrechte_zweite_welle.sql",
    art: "gespeicherter-wert-wird-sql",
    einstufung: "REFUTED_BY_PARSER_AND_QUOTING",
    beleg: "ops/artifact-corrections/EVIDENZ-ausnahmen-service-role-pfad.txt",
    grund:
      "Wie oben, mit undo_20260809120000.func_signature und derselben " +
      "to_regprocedure-Schranke. Derselbe Ende-zu-Ende-Lauf: service_role " +
      "hinterlegte die Nutzlast, postgres fuehrte die Ruecknahme aus, Ergebnis " +
      "ERROR und ROLLBACK, Beutetabelle leer. Kein gespeicherter Text wird zu SQL.",
  },
];

export const pruefeDatei = (datei: string, roh: string): Verstoss[] => {
  const quelle = ohneKommentare(roh);
  const verstoesse: Verstoss[] = [];

  const vorlagen = findeFormatVorlagen(quelle);
  const tabellen = gelesenePersistenzTabellen(quelle);
  const mitProzentS = vorlagen.filter((v) => v.platzhalter.includes("%s"));

  // Die drei Merkmale zusammen sind das Primitiv: ein roh eingesetzter Wert,
  // eine Ausfuehrung, und eine Quelle, die jemand anders beschreiben kann.
  // Ueber welche Variable der Wert dorthin gelangt, ist unerheblich.
  if (mitProzentS.length > 0 && fuehrtDynamischAus(quelle) && tabellen.length > 0) {
    verstoesse.push({
      datei,
      art: "gespeicherter-wert-wird-sql",
      detail:
        `%s-Vorlage + EXECUTE + Lesezugriff auf ${tabellen.join(", ")}. ` +
        `Vorlage: "${mitProzentS[0].vorlage.slice(0, 80)}". ` +
        "Ein gespeicherter Wert darf eine Konstante bestaetigen, aber nicht SQL werden.",
    });
  }

  if (hatVerkettetesDDL(quelle)) {
    verstoesse.push({
      datei,
      art: "verkettetes-ddl",
      detail: "EXECUTE mit || umgeht jede Quotierung.",
    });
  }

  if (!laeuftInEinerTransaktion(quelle)) {
    verstoesse.push({
      datei,
      art: "keine-transaktion",
      detail:
        "Ohne BEGIN;/COMMIT; bleibt bei einem Abbruch ein halb zurueckgenommener " +
        "Zustand stehen — die Ruecknahme muss geschlossen scheitern.",
    });
  }

  return verstoesse;
};

export const rollbackDateien = (verzeichnis: string = STANDARD_VERZEICHNIS): string[] =>
  readdirSync(verzeichnis)
    .filter((f) => f.startsWith("ROLLBACK_") && f.endsWith(".sql"))
    .sort();

export const pruefeRollbackArtefakte = (
  verzeichnis: string = STANDARD_VERZEICHNIS,
): Verstoss[] =>
  rollbackDateien(verzeichnis).flatMap((f) =>
    pruefeDatei(f, readFileSync(join(verzeichnis, f), "utf8")),
  );

/** Verstösse, für die es keinen bekannten, begründeten Eintrag gibt. */
export const unerklaerteVerstoesse = (verstoesse: Verstoss[]): Verstoss[] =>
  verstoesse.filter(
    (v) => !BEKANNTE_AUSNAHMEN.some((a) => a.datei === v.datei && a.art === v.art),
  );

/** Einträge, die keinen Verstoss mehr beschreiben — die Liste muss schrumpfen dürfen. */
export const veralteteAusnahmen = (verstoesse: Verstoss[]): BekannteAusnahme[] =>
  BEKANNTE_AUSNAHMEN.filter(
    (a) => !verstoesse.some((v) => v.datei === a.datei && v.art === a.art),
  );
