import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Jede geänderte Migrationsdatei braucht einen Korrektureintrag.
 *
 * Angewendete Vorwärtsmigrationen sind unveränderlich. Kandidaten dürfen vor
 * ihrer ersten Produktionsausführung korrigiert werden — aber nur nachvollziehbar.
 * Ohne dieses Tor ist „nachvollziehbar" eine Absichtserklärung: beim Neuerzeugen
 * der Identitätstabelle fehlte prompt ein Eintrag (die Rücknahme-Geschwisterdatei
 * zu AC-0005), und niemandem wäre es aufgefallen.
 */

const WURZEL = join(__dirname, "..", "..");
const VERZEICHNIS = join(WURZEL, "supabase", "migrations");

export interface Korrektureintrag {
  record_id: string;
  artifact_path?: string;
  classification: string;
  corrects_record_id?: string;
  corrected_field?: string;
  [feld: string]: unknown;
}

export const leseKorrekturen = (): Korrektureintrag[] =>
  readFileSync(join(WURZEL, "ops", "artifact-corrections.jsonl"), "utf8")
    .split("\n")
    .filter((z) => z.trim().length > 0)
    .map((z) => JSON.parse(z) as Korrektureintrag);

const git = (...args: string[]): Buffer =>
  execFileSync("git", args, { cwd: WURZEL, maxBuffer: 32 * 1024 * 1024 });

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/**
 * Ist die Arbeitskopie flach geklont?
 *
 * Dieses Tor rechnet gegen echte Git-Objekte. Ohne Historie kann es nichts
 * nachrechnen — und darf das dann NICHT als „Digest stimmt nicht" ausgeben.
 * Genau so ist es passiert: `actions/checkout@v4` klont standardmässig mit
 * `fetch-depth: 1`, der Lauf meldete für jeden Eintrag „nicht ermittelbar" und
 * wurde rot, obwohl nichts kaputt war. Ein Tor, das aus fehlendem Werkzeug einen
 * inhaltlichen Befund macht, verbrennt genau das Vertrauen, für das es da ist.
 */
export const istFlacherKlon = (): boolean => {
  try {
    return git("rev-parse", "--is-shallow-repository").toString().trim() === "true";
  } catch {
    return false;
  }
};

export interface GeaenderteDatei {
  pfad: string;
  einfuehrungscommit: string;
  sha256Erste: string;
  sha256Aktuell: string;
}

/**
 * Welche Dateien dieses Tor überhaupt angehen.
 *
 * Dateien, die im signierten Ledger stehen, bewacht bereits
 * `migration-ledger.test.ts`: jede Änderung dort macht ihn rot, und genau ein
 * solcher Fall existiert (AC-0001). Unsichtbar sind die Dateien, die NACH der
 * Signierung entstanden sind — sie zählen im Ledger als „neu" und könnten
 * beliebig oft umgeschrieben werden, ohne dass irgendetwas ausschlägt.
 *
 * Ältere Migrationen, die vor der Signierung bearbeitet wurden, sind mit dem
 * Ledger-Stand als Ausgangspunkt akzeptiert; sie rückwirkend aufzuarbeiten wäre
 * ein eigener Auftrag und würde dieses Tor von Anfang an rot halten.
 */
const imLedgerGefuehrt = (): Set<string> => {
  const ledger = JSON.parse(
    readFileSync(join(WURZEL, "ops", "migration-ledger.json"), "utf8"),
  ) as { checksums: Record<string, string> };
  return new Set(Object.keys(ledger.checksums));
};

/** Migrationen, deren Inhalt sich seit ihrem Einführungscommit geändert hat. */
export const geaenderteMigrationen = (): GeaenderteDatei[] => {
  if (istFlacherKlon()) {
    throw new Error(
      "Flacher Klon: dieses Tor braucht die Git-Historie. " +
        "In CI `actions/checkout` mit `fetch-depth: 0` verwenden.",
    );
  }
  const signiert = imLedgerGefuehrt();
  const ergebnis: GeaenderteDatei[] = [];
  for (const datei of readdirSync(VERZEICHNIS).filter((f) => f.endsWith(".sql")).sort()) {
    if (signiert.has(datei)) continue; // vom Ledger-Tor bewacht
    const pfad = `supabase/migrations/${datei}`;
    let einf: string;
    try {
      einf = git("log", "--format=%h", "-1", "--diff-filter=A", "--", pfad).toString().trim();
    } catch {
      continue;
    }
    if (!einf) continue;

    let erste: Buffer;
    try {
      erste = git("show", `${einf}:${pfad}`);
    } catch {
      continue;
    }
    const aktuell = readFileSync(join(VERZEICHNIS, datei));
    const a = sha(erste);
    const b = sha(aktuell);
    if (a !== b) {
      ergebnis.push({ pfad, einfuehrungscommit: einf, sha256Erste: a, sha256Aktuell: b });
    }
  }
  return ergebnis;
};

/** Geänderte Dateien, für die kein Korrektureintrag existiert. */
export const ohneKorrektureintrag = (): GeaenderteDatei[] => {
  const erfasst = new Set(leseKorrekturen().map((k) => k.artifact_path).filter(Boolean));
  return geaenderteMigrationen().filter((g) => !erfasst.has(g.pfad));
};

/** Alle Digest-Felder eines Eintrags, mit dem Commit, gegen den sie gelten sollen. */
const DIGEST_FELDER: Array<[digest: string, commit: string]> = [
  ["sha256_old", "commit_introducing_old_form"],
  ["sha256_reviewed", "commit_introducing"],
  // `sha256_previous` gilt gegen den Zustand VOR der Korrektur, nicht gegen den
  // Korrekturcommit. Ein Eintrag, der dafür keinen Commit nennt, ist nicht
  // nachrechenbar — und genau das soll auffallen.
  ["sha256_previous", "commit_previous"],
  ["correctly_computed_digest", "measured_commit"],
];

export interface DigestBefund {
  record_id: string;
  feld: string;
  eingetragen: string;
  tatsaechlich: string | null;
  /** true, wenn der Eintrag gar keinen Commit nennt, gegen den man rechnen könnte. */
  nichtNachrechenbar: boolean;
  spaeterBerichtigt: boolean;
}

/**
 * Ein eingetragener Digest muss einem echten Git-Objekt entsprechen.
 *
 * Genau hier lag der Fehler, den die unabhängige Durchsicht fand: ein von Hand
 * getippter Wert, der die ersten 16 Zeichen mit dem echten teilte und ab da
 * erfunden war. Ein Prüfsatz, dessen Zahlen niemand nachrechnet, ist Dekoration.
 *
 * Ein falscher Wert darf stehenbleiben — das Protokoll ist anfügend, alte
 * Einträge werden nicht umgeschrieben. Er muss aber von einem SPÄTEREN Eintrag
 * ausdrücklich berichtigt sein.
 */
export const digestBefunde = (): DigestBefund[] => {
  if (istFlacherKlon()) {
    throw new Error(
      "Flacher Klon: Digests lassen sich nicht gegen Git-Objekte nachrechnen. " +
        "In CI `actions/checkout` mit `fetch-depth: 0` verwenden.",
    );
  }
  const eintraege = leseKorrekturen();
  const befunde: DigestBefund[] = [];

  for (const e of eintraege) {
    const pfad = (e.source_path as string | undefined) ?? e.artifact_path;
    if (!pfad) continue;

    for (const [digestFeld, commitFeld] of DIGEST_FELDER) {
      const eingetragen = e[digestFeld] as string | undefined;
      if (!eingetragen) continue;

      const commit = e[commitFeld] as string | undefined;
      const spaeterBerichtigt = eintraege.some(
        (k) => k.corrects_record_id === e.record_id && k.corrected_field === digestFeld,
      );

      // Ein Digest OHNE Commit-Bezug ist nicht nachrechenbar. Ihn stillschweigend
      // zu überspringen wäre genau das Loch, durch das der erfundene Wert kam:
      // das Tor prüfte ihn nie, weil AC-0006 kein commit_of_correction führte.
      if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) {
        befunde.push({
          record_id: e.record_id,
          feld: digestFeld,
          eingetragen,
          tatsaechlich: null,
          nichtNachrechenbar: true,
          spaeterBerichtigt,
        });
        continue;
      }

      let tatsaechlich: string | null = null;
      try {
        tatsaechlich = sha(git("show", `${commit}:${pfad}`));
      } catch {
        tatsaechlich = null;
      }
      if (tatsaechlich === eingetragen) continue;

      befunde.push({
        record_id: e.record_id,
        feld: digestFeld,
        eingetragen,
        tatsaechlich,
        nichtNachrechenbar: false,
        spaeterBerichtigt,
      });
    }
  }
  return befunde;
};

/** Falsche Digests, die von keinem späteren Eintrag berichtigt werden. */
export const unberichtigteDigests = (): DigestBefund[] =>
  digestBefunde().filter((b) => !b.spaeterBerichtigt);

export interface StandBefund {
  record_id: string;
  pfad: string;
  eingetragen: string;
  tatsaechlich: string;
}

/**
 * Der JÜNGSTE Eintrag zu einer Datei muss deren aktuellen Stand nennen.
 *
 * Die zweite Durchsicht fand genau hier ein Loch: `sha256_current` wurde von
 * keiner Prüfung angefasst, also blieb ein veralteter Eintrag grün — und einer
 * war live, im selben Commit, dessen Botschaft die Behebung der Digest-Klasse
 * ankündigte. Ein Prüfsatz, der den Ist-Stand nicht kennt, beschreibt eine
 * Vergangenheit, die niemand mehr überprüfen kann.
 *
 * Ältere Einträge zu derselben Datei bleiben unangetastet — sie sind Historie,
 * und das Protokoll ist anfügend.
 */
export const veralteterStand = (): StandBefund[] => {
  if (istFlacherKlon()) return [];
  const eintraege = leseKorrekturen();
  const befunde: StandBefund[] = [];

  const juengsterJePfad = new Map<string, Korrektureintrag>();
  for (const e of eintraege) {
    const pfad = e.artifact_path;
    if (!pfad || typeof e.sha256_current !== "string") continue;
    juengsterJePfad.set(pfad, e); // spätere Zeile gewinnt
  }

  for (const [pfad, e] of juengsterJePfad) {
    let tatsaechlich: string;
    try {
      tatsaechlich = sha(readFileSync(join(WURZEL, pfad)));
    } catch {
      continue; // Datei entfernt — anderer Befund
    }
    if (tatsaechlich !== e.sha256_current) {
      befunde.push({
        record_id: e.record_id,
        pfad,
        eingetragen: e.sha256_current as string,
        tatsaechlich,
      });
    }
  }
  return befunde;
};
