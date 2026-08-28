import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Migrationen sind anfügend. Dieses Modul macht daraus eine prüfbare Zusage.
 *
 * WARUM ES DAS BRAUCHT
 *
 * `CLAUDE.md` §6 hält fest: „bestehende Migration wird nicht bearbeitet — neue
 * Datei". Das war bisher eine Bitte. Wer eine eingespielte Datei nachträglich
 * ändert, verschiebt damit, was die Produktion angeblich ausführt, ohne dass
 * irgendetwas rot wird — und in einem Repo, dessen Migrationen von Hand
 * eingespielt werden, ist das der leiseste mögliche Fehler.
 *
 * Der Ledger (`ops/migration-ledger.json`) friert den Stand vom 2026-08-28 ein.
 * Neue Dateien sind erlaubt und erwünscht. Geänderte und gelöschte nicht.
 *
 * WAS ER NICHT IST
 *
 * Kein Nachweis, dass diese Migrationen ANGEWENDET sind. Welche angewendet sind,
 * sagt allein die Datenbank. Der Befund T10-02 zeigt, wie weit die beiden
 * auseinanderliegen können: die Produktion trägt ein Recht, das keine dieser
 * Dateien erzeugt.
 */

const WURZEL = join(__dirname, "..", "..");
const VERZEICHNIS = join(WURZEL, "supabase", "migrations");

export interface MigrationLedger {
  signed_at: string;
  file_count: number;
  forward_migration_count: number;
  accepted_duplicate_versions: Record<string, string[]>;
  checksums: Record<string, string>;
}

export const leseLedger = (): MigrationLedger =>
  JSON.parse(readFileSync(join(WURZEL, "ops", "migration-ledger.json"), "utf8"));

export const migrationsdateien = (): string[] =>
  readdirSync(VERZEICHNIS).filter((f) => f.endsWith(".sql")).sort();

export const pruefsumme = (datei: string): string =>
  createHash("sha256").update(readFileSync(join(VERZEICHNIS, datei))).digest("hex");

/** Vorwärtsmigrationen — die `ROLLBACK_*`-Geschwister tragen keine eigene Version. */
export const vorwaertsmigrationen = (): string[] =>
  migrationsdateien().filter((f) => !f.startsWith("ROLLBACK_"));

export const version = (datei: string): string | null => {
  const m = /^(\d{14})_/.exec(datei);
  return m ? m[1] : null;
};

export interface LedgerBefund {
  geaendert: Array<{ datei: string; erwartet: string; gefunden: string }>;
  entfernt: string[];
  neu: string[];
  neueDoppelungen: Array<{ version: string; dateien: string[] }>;
  ohneVersion: string[];
}

export const pruefeLedger = (): LedgerBefund => {
  const ledger = leseLedger();
  const jetzt = migrationsdateien();
  const jetztMenge = new Set(jetzt);

  const geaendert: LedgerBefund["geaendert"] = [];
  const entfernt: string[] = [];
  for (const [datei, erwartet] of Object.entries(ledger.checksums)) {
    if (!jetztMenge.has(datei)) {
      entfernt.push(datei);
      continue;
    }
    const gefunden = pruefsumme(datei);
    if (gefunden !== erwartet) geaendert.push({ datei, erwartet, gefunden });
  }

  const neu = jetzt.filter((f) => !(f in ledger.checksums));

  // Doppelte Zeitstempel: die Reihenfolge zwischen ihnen ist alphabetisch und
  // nicht beabsichtigt. Zwei Bestandsfälle sind im Ledger vermerkt; neue nicht.
  const nachVersion = new Map<string, string[]>();
  const ohneVersion: string[] = [];
  for (const f of vorwaertsmigrationen()) {
    const v = version(f);
    if (!v) {
      ohneVersion.push(f);
      continue;
    }
    nachVersion.set(v, [...(nachVersion.get(v) ?? []), f]);
  }
  const neueDoppelungen = [...nachVersion.entries()]
    .filter(([v, fs]) => fs.length > 1 && !(v in ledger.accepted_duplicate_versions))
    .map(([version, dateien]) => ({ version, dateien: dateien.sort() }));

  return { geaendert, entfernt, neu, neueDoppelungen, ohneVersion };
};
