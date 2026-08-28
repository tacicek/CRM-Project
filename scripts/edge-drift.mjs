#!/usr/bin/env node
// Vergleicht eine Produktionsaufnahme mit dem Quelltext DIESES Auscheckstands.
//
// WOFUER
//
// `scripts/capture-production-truth.sh` nimmt auf, WAS deployed ist — Namen und
// Digests. Es kann nicht sagen, ob dieser Inhalt dem entspricht, was im Repo
// steht: der Vergleich braucht einen Auscheckstand, die Aufnahme ist ein Beleg
// der Gegenseite. `deploy-repo-diff.json` vergleicht deshalb nur MENGEN
// (welche Funktion existiert wo), nicht INHALTE.
//
// Diese Datei schliesst die Luecke. Sie bildet den Digest genauso wie das
// Aufnahmeskript — `find -type f | sort | sha256sum | sha256sum`, relativ zum
// Funktionsverzeichnis — und stellt beide Seiten gegenueber.
//
// WARUM DER PFAD ZAEHLT
//
// `sha256sum` schreibt den Dateinamen in seine Ausgabe. Der Baumdigest haengt
// damit an den relativen Pfaden. Die Produktion listet `<name>/index.ts`,
// gerechnet ab `/home/deno/functions`; hier wird ab `supabase/functions`
// gerechnet. Nur so sind die beiden Zahlen ueberhaupt vergleichbar.
//
// AUFRUF
//
//   node scripts/edge-drift.mjs <aufnahme-verzeichnis> [ausgabe.json]
//
// Ohne Ausgabepfad geht der Bericht nach stdout. Rueckgabe 0 auch bei Drift:
// dies ist ein Messwerkzeug, kein Tor. Das Tor ist eine eigene, spaetere Arbeit.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');

const [, , aufnahmeArg, ausgabeArg] = process.argv;
if (!aufnahmeArg) {
  console.error('ABBRUCH: Aufnahmeverzeichnis fehlt.');
  console.error('  node scripts/edge-drift.mjs ops/production-truth/<datum> [ausgabe.json]');
  process.exit(2);
}
const aufnahme = join(ROOT, aufnahmeArg);
const edgeRuntimePfad = join(aufnahme, 'edge-runtime.json');
if (!existsSync(edgeRuntimePfad)) {
  console.error(`ABBRUCH: ${relative(ROOT, edgeRuntimePfad)} fehlt — ist das eine Aufnahme?`);
  process.exit(2);
}

// sha256sum-Zeile: "<hex>  <pfad>\n" — zwei Leerzeichen, so schreibt es coreutils.
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

// `__tests__` wird nie ausgerollt — Vitest laeuft hier, nicht in Deno. Die
// Verzeichnisse mitzuzaehlen liess `calendar-feed` und `_shared` als "Drift"
// erscheinen, obwohl jede ausgelieferte Datei stimmte. Ein Tor, das ohne Grund
// anschlaegt, bringt man sich ab.
const NICHT_AUSGEROLLT = new Set(['__tests__']);

const dateienUnter = (dir, praefix) => {
  const raus = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const voll = join(dir, eintrag.name);
    const rel = praefix ? `${praefix}/${eintrag.name}` : eintrag.name;
    if (eintrag.isDirectory()) {
      if (NICHT_AUSGEROLLT.has(eintrag.name)) continue;
      raus.push(...dateienUnter(voll, rel));
    } else if (eintrag.isFile()) raus.push({ voll, rel });
  }
  return raus;
};

const baumDigest = (funktionsName) => {
  const basis = join(FUNCTIONS_DIR, funktionsName);
  const dateien = dateienUnter(basis, funktionsName);
  // `sort -z` sortiert nach Bytes, nicht nach Locale. Node vergleicht mit
  // `<` ebenfalls nach Codepoints — fuer ASCII-Pfade dasselbe Ergebnis.
  dateien.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const zeilen = dateien.map((d) => `${sha256Hex(readFileSync(d.voll))}  ${d.rel}\n`).join('');
  return { tree_sha256: sha256Hex(Buffer.from(zeilen, 'utf8')), file_count: dateien.length };
};

const indexDigest = (funktionsName) => {
  const p = join(FUNCTIONS_DIR, funktionsName, 'index.ts');
  return existsSync(p) ? sha256Hex(readFileSync(p)) : null;
};

const repo = {};
for (const eintrag of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
  if (!eintrag.isDirectory()) continue;
  repo[eintrag.name] = { ...baumDigest(eintrag.name), index_ts_sha256: indexDigest(eintrag.name) };
}

const laufzeit = JSON.parse(readFileSync(edgeRuntimePfad, 'utf8'));
const deployed = Object.fromEntries(
  laufzeit.edge_runtime.deployed_functions.map((f) => [f.name, f]),
);

const beide = Object.keys(deployed).filter((n) => n in repo).sort();
const identisch = [];
const drift = [];
for (const name of beide) {
  const d = deployed[name];
  const r = repo[name];
  if (d.index_ts_sha256 === r.index_ts_sha256 && d.tree_sha256 === r.tree_sha256) {
    identisch.push(name);
  } else {
    drift.push({
      name,
      index_ts_matches: d.index_ts_sha256 === r.index_ts_sha256,
      tree_matches: d.tree_sha256 === r.tree_sha256,
      deployed: { index_ts_sha256: d.index_ts_sha256, tree_sha256: d.tree_sha256, file_count: d.file_count },
      repo: { index_ts_sha256: r.index_ts_sha256, tree_sha256: r.tree_sha256, file_count: r.file_count },
      // Gleicher Einstiegspunkt, andere Datei-Anzahl: dann liegen auf dem
      // Server Dateien, die es im Repo nicht gibt. Gemessen am 2026-08-28 waren
      // das durchweg von Hand angelegte `.bak-*`-Kopien.
      hinweis:
        d.index_ts_sha256 === r.index_ts_sha256 && d.file_count > r.file_count
          ? 'index.ts stimmt; die Produktion traegt zusaetzliche Dateien (Sicherungskopien?)'
          : undefined,
    });
  }
}

const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const baumSauber =
  execSync('git status --porcelain -- supabase/functions', { cwd: ROOT }).toString().trim() === '';

const bericht = {
  what_this_is:
    'Content comparison between one production-truth generation and the Edge source of this exact checkout. Digests are formed exactly as the capture script forms them.',
  what_this_is_not:
    'Not a deployment ledger and not a gate: it reports drift, it does not decide what should be deployed.',
  capture_generation: aufnahmeArg,
  compared_commit: commit,
  edge_source_tree_clean: baumSauber,
  deployed_count: Object.keys(deployed).length,
  repo_count: Object.keys(repo).length,
  identical: identisch,
  drifted: drift,
  deploy_only: Object.keys(deployed).filter((n) => !(n in repo)).sort(),
  repo_only_not_deployed: Object.keys(repo).filter((n) => !(n in deployed)).sort(),
};

const text = `${JSON.stringify(bericht, null, 2)}\n`;
if (ausgabeArg) {
  writeFileSync(join(ROOT, ausgabeArg), text);
  console.log(`identisch ${identisch.length} · Drift ${drift.length} · deploy-only ${bericht.deploy_only.length} · nur im Repo ${bericht.repo_only_not_deployed.length}`);
  console.log(`==> ${ausgabeArg}`);
} else {
  process.stdout.write(text);
}
