import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift zwischen Produktion und Repo — als TOR, nicht als Zahl im Bericht.
 *
 * `scripts/edge-drift.mjs` misst seit dem 2026-08-28, wie weit die ausgerollten
 * Edge Functions vom Quelltext abweichen. Messen allein ändert nichts: die Zahl
 * stand in einem Bericht, den man lesen musste.
 *
 * Dieses Tor macht daraus eine Zusage mit Adresse. Jede gemessene Abweichung
 * muss im Manifest unter `known_drift` stehen — mit der Rollout-Einheit, die sie
 * auflöst, und dem Grund. Eine NEUE, nicht eingetragene Abweichung ist ein
 * Fehler: dann läuft in der Produktion etwas, über das niemand entschieden hat.
 *
 * Umgekehrt gilt es genauso: ein Eintrag für eine Function, die gar nicht mehr
 * abweicht, ist eine Schuld, die jemand vergessen hat zu streichen. Auch das
 * wird rot — sonst wächst die Liste zu einer Ausrede.
 *
 * DIE DIGESTS
 *
 * Genau wie im Aufnahmeskript: `find -type f | sort | sha256sum | sha256sum`,
 * relativ zum Funktionsverzeichnis. `sha256sum` schreibt den Dateinamen in seine
 * Ausgabe, der Pfad zählt also mit. `__tests__` wird ausgelassen — es läuft unter
 * Vitest, nicht unter Deno, und wird nie ausgerollt.
 */

const WURZEL = join(__dirname, "..", "..");
const FUNKTIONEN = join(WURZEL, "supabase", "functions");
const NICHT_AUSGEROLLT = new Set(["__tests__"]);

const sha256 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

const dateienUnter = (dir: string, praefix: string): Array<{ voll: string; rel: string }> => {
  const raus: Array<{ voll: string; rel: string }> = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const voll = join(dir, e.name);
    const rel = praefix ? `${praefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (NICHT_AUSGEROLLT.has(e.name)) continue;
      raus.push(...dateienUnter(voll, rel));
    } else if (e.isFile()) raus.push({ voll, rel });
  }
  return raus;
};

export const repoDigest = (name: string): { tree: string; indexTs: string | null } => {
  const dateien = dateienUnter(join(FUNKTIONEN, name), name);
  dateien.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const zeilen = dateien.map((d) => `${sha256(readFileSync(d.voll))}  ${d.rel}\n`).join("");
  const idx = join(FUNKTIONEN, name, "index.ts");
  return {
    tree: sha256(Buffer.from(zeilen, "utf8")),
    indexTs: existsSync(idx) ? sha256(readFileSync(idx)) : null,
  };
};

interface Deployed {
  name: string;
  index_ts_sha256: string | null;
  tree_sha256: string;
}

export const gemesseneDrift = (aufnahme: string): string[] => {
  const roh = JSON.parse(readFileSync(join(aufnahme, "edge-runtime.json"), "utf8")) as {
    edge_runtime: { deployed_functions: Deployed[] };
  };
  const imRepo = new Set(
    readdirSync(FUNKTIONEN, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name),
  );
  return roh.edge_runtime.deployed_functions
    .filter((d) => imRepo.has(d.name))
    .filter((d) => {
      const r = repoDigest(d.name);
      return d.index_ts_sha256 !== r.indexTs || d.tree_sha256 !== r.tree;
    })
    .map((d) => d.name)
    .sort();
};
