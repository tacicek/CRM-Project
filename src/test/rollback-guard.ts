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

export interface DynamischesDDL {
  vorlage: string;
  platzhalter: string[];
}

/** `EXECUTE format('…', …)` — die Vorlage ist das erste Argument. */
export const findeDynamischesDDL = (quelle: string): DynamischesDDL[] => {
  const treffer: DynamischesDDL[] = [];
  const muster = /\bEXECUTE\s+format\s*\(\s*'((?:[^']|'')*)'/gi;
  let m: RegExpExecArray | null;
  while ((m = muster.exec(quelle)) !== null) {
    const vorlage = m[1];
    treffer.push({
      vorlage,
      platzhalter: [...vorlage.matchAll(/%[sIL]/g)].map((p) => p[0]),
    });
  }
  return treffer;
};

/** `EXECUTE 'GRANT …' || irgendwas` — Verkettung umgeht jede Quotierung. */
export const hatVerkettetesDDL = (quelle: string): boolean =>
  /\bEXECUTE\s+(?!format\b)[^;]*\|\|/i.test(quelle);

/**
 * Aus welchen Tabellen liest die Datei? Katalog- und Informationsschema-Quellen
 * gelten als vertrauenswürdig — sie sind nicht von aussen beschreibbar.
 */
export const gelesenePersistenzTabellen = (quelle: string): string[] => {
  const namen = new Set<string>();
  for (const m of quelle.matchAll(/\bFROM\s+(?:(\w+)\.)?(\w+)/gi)) {
    const schema = (m[1] ?? "public").toLowerCase();
    const tabelle = m[2].toLowerCase();
    if (schema === "pg_catalog" || schema === "information_schema") continue;
    if (tabelle.startsWith("pg_")) continue;
    if (schema === "public" && tabelle.startsWith("pg_")) continue;
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
  grund: string;
  entscheidung_offen: boolean;
}

export const BEKANNTE_AUSNAHMEN: BekannteAusnahme[] = [
  {
    datei: "ROLLBACK_20260802130000_funktionsrechte_zurueckgenommen.sql",
    art: "gespeicherter-wert-wird-sql",
    grund:
      "Interpoliert undo_20260802130000.func_signature mit %s in GRANT EXECUTE. " +
      "Dieselbe Form wie der behobene Befund M01-04, aber NICHT ausnutzbar: die " +
      "Undo-Tabelle trägt RLS (gemessen 2026-08-28), anon und authenticated " +
      "können sie nicht beschreiben. Schreiben kann nur service_role, die das " +
      "DDL ohnehin dürfte. Die Datei wurde nie angewendet. Korrektur wäre ein " +
      "zweiter Eingriff in eine bestehende Migration und braucht eine eigene " +
      "Freigabe — die Freigabe zu M01-04 war ausdrücklich eng.",
    entscheidung_offen: true,
  },
  {
    datei: "ROLLBACK_20260809120000_funktionsrechte_zweite_welle.sql",
    art: "gespeicherter-wert-wird-sql",
    grund:
      "Wie oben, mit undo_20260809120000. RLS aktiv, nicht von anon " +
      "beschreibbar, nie angewendet. Eigene Freigabe nötig.",
    entscheidung_offen: true,
  },
];

export const pruefeDatei = (datei: string, roh: string): Verstoss[] => {
  const quelle = ohneKommentare(roh);
  const verstoesse: Verstoss[] = [];

  const ddl = findeDynamischesDDL(quelle);
  const tabellen = gelesenePersistenzTabellen(quelle);

  const mitProzentS = ddl.filter((d) => d.platzhalter.includes("%s"));
  if (mitProzentS.length > 0 && tabellen.length > 0) {
    verstoesse.push({
      datei,
      art: "gespeicherter-wert-wird-sql",
      detail:
        `%s in EXECUTE format(…) und liest ${tabellen.join(", ")}. ` +
        `Vorlage: "${mitProzentS[0].vorlage.slice(0, 80)}". ` +
        "Ein gespeicherter Wert darf eine Konstante bestätigen, aber nicht SQL werden.",
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
        "Ohne BEGIN;/COMMIT; bleibt bei einem Abbruch ein halb zurückgenommener " +
        "Zustand stehen — die Rücknahme muss geschlossen scheitern.",
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
