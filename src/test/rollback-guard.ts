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
 * WAS DIESES TOR IST — WÖRTLICH
 *
 * Ein **konservatives Repo-Tor** auf drei gemeinsam auftretende syntaktische
 * Merkmale: eine `%s`-Vorlage, irgendein `EXECUTE`, und der Name einer
 * Nicht-Katalog-Relation. Für die bekannte Fehlerklasse *gespeicherte Daten →
 * privilegiertes SQL*.
 *
 * **Keine Taint-Analyse.** Ein herkunftsbasierter Vertrag („Katalog ja,
 * gespeicherte Zeile nein") stand hier einmal — die Durchsicht hat gezeigt, dass
 * der Code ihn in beide Richtungen verfehlte. Was er wirklich leistet, steht
 * oben; was er nicht leistet, hier:
 *
 *   · `format('DO %L', wert)` — `%L` quotiert das Literal, aber `DO` macht aus
 *     dem Literal einen Codeblock. Wird als eigene Regel erkannt (siehe unten),
 *     andere Umwege dieser Art nicht.
 *   · Ein Helfer, der die Tabelle liest und den Wert zurückgibt, während die
 *     Tabelle in dieser Datei **nirgends** genannt wird. Für ein dateilokales
 *     Tor grundsätzlich unerreichbar — als Fall 12 im Test festgehalten, damit
 *     das eine Entscheidung bleibt und kein ungeprüftes Schweigen.
 *   · Weitere Zusammensetz-Wege, die kein `||` und kein `concat(` benutzen
 *     (etwa `string_agg` über eine Zwischentabelle) oder die den Tabellennamen
 *     dynamisch bilden.
 *
 * Diese Grenzen sind bekannt und angenommen, nicht übersehen.
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
      // `%1$s` ist gueltiges PostgreSQL und wirkt wie `%s`. Die erste Fassung
      // sah nur `%s` — die Durchsicht ist genau dort durchgegangen.
      platzhalter: [...m[1].matchAll(/%(?:\d+\$)?[sIL]/g)].map((p) =>
        p[0].replace(/\d+\$/, ""),
      ),
    });
  }
  return treffer;
};

/** Fuehrt die Datei ueberhaupt irgendwo dynamisches SQL aus? */
export const fuehrtDynamischAus = (quelle: string): boolean =>
  /\bEXECUTE\b/i.test(quelle);

/**
 * Verkettung umgeht jede Quotierung — über jede Schreibweise und jeden Umweg.
 *
 * Drei Runden Durchsicht, drei Erweiterungen:
 *   1. `EXECUTE 'x' || v`            — die Ausgangsform.
 *   2. `b := a || v; EXECUTE b;`     — eine Zeile höher.
 *   3. `b := concat(a, v); EXECUTE b;` und `c := b; EXECUTE c;`
 *      — anderer Operator, bzw. eine schlichte Kopie dazwischen.
 *
 * Verfolgt wird deshalb: welche Variablen aus einer Verkettung entstehen
 * (`||` **oder** `concat(`), fortgepflanzt über einfache Zuweisungen bis zum
 * Fixpunkt, und ob eine davon später nackt ausgeführt wird.
 */
export const hatVerkettetesDDL = (quelle: string): boolean => {
  // Direkt im EXECUTE verkettet oder zusammengesetzt.
  if (/\bEXECUTE\s+(?!format\b)[^;]*(?:\|\||\bconcat\s*\()/i.test(quelle)) return true;

  const verkettet = new Set<string>();
  for (const m of quelle.matchAll(/(\w+)\s*:=\s*([^;]*(?:\|\||\bconcat\s*\()[^;]*);/gi)) {
    verkettet.add(m[1].toLowerCase());
  }

  // Schlichte Kopien fortpflanzen: `c := b;` erbt die Verseuchung von `b`.
  const kopien = [...quelle.matchAll(/(\w+)\s*:=\s*(\w+)\s*;/g)].map(
    (m) => [m[1].toLowerCase(), m[2].toLowerCase()] as const,
  );
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const [ziel, quelleVar] of kopien) {
      if (verkettet.has(quelleVar) && !verkettet.has(ziel)) {
        verkettet.add(ziel);
        gewachsen = true;
      }
    }
  }

  for (const m of quelle.matchAll(/\bEXECUTE\s+(\w+)\s*(?:;|USING\b)/gi)) {
    if (verkettet.has(m[1].toLowerCase())) return true;
  }
  return false;
};

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

  const aufnehmen = (schemaRoh: string | undefined, tabelle: string) => {
    const schema = (schemaRoh ?? "public").toLowerCase();
    const t = tabelle.toLowerCase();
    if (schema === "pg_catalog" || schema === "information_schema") return;
    if (t.startsWith("pg_")) return;
    if (["select", "values", "format", "execute", "lateral", "only"].includes(t)) return;
    namen.add(`${schema}.${t}`);
  };

  // `FROM a, b` ist die älteste und gewöhnlichste Schreibweise eines Joins —
  // und blieb zwei Runden lang unsichtbar, weil nur das erste Element nach
  // FROM gelesen wurde. Deshalb die ganze Liste bis zum nächsten Schlüsselwort.
  const klauseln =
    /\b(?:FROM|JOIN|UPDATE|INSERT\s+INTO|MERGE\s+INTO)\s+([\w.]+(?:\s+(?:AS\s+)?\w+)?(?:\s*,\s*[\w.]+(?:\s+(?:AS\s+)?\w+)?)*)/gi;

  for (const m of quelle.matchAll(klauseln)) {
    for (const teil of m[1].split(",")) {
      const bezeichner = teil.trim().split(/\s+/)[0];
      if (!bezeichner) continue;
      const stueck = bezeichner.split(".");
      if (stueck.length >= 2) aufnehmen(stueck[stueck.length - 2], stueck[stueck.length - 1]);
      else aufnehmen(undefined, stueck[0]);
    }
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
    | "REFUTED_BY_EXACT_PARSER_AND_QUOTING_TEST"
    | "NEEDS_MORE_EVIDENCE";
  beleg: string;
  grund: string;
}

export const BEKANNTE_AUSNAHMEN: BekannteAusnahme[] = [
  {
    datei: "ROLLBACK_20260802130000_funktionsrechte_zurueckgenommen.sql",
    art: "gespeicherter-wert-wird-sql",
    einstufung: "REFUTED_BY_EXACT_PARSER_AND_QUOTING_TEST",
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
    einstufung: "REFUTED_BY_EXACT_PARSER_AND_QUOTING_TEST",
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

  // `%L` gilt gemeinhin als sicher — als Rumpf eines `DO` wird das Literal
  // aber wieder Code.
  const doMitLiteral = vorlagen.some(
    (v) => /\bDO\b/i.test(v.vorlage) && v.platzhalter.includes("%L"),
  );
  if (doMitLiteral && fuehrtDynamischAus(quelle) && tabellen.length > 0) {
    verstoesse.push({
      datei,
      art: "gespeicherter-wert-wird-sql",
      detail:
        "%L in einer DO-Vorlage: das quotierte Literal wird als Codeblock ausgefuehrt.",
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
