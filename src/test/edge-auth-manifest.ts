import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Liest den Soll-Vertrag (`docs/hardening/edge-auth-manifest.json`) und die
 * juengste Produktionsaufnahme (`ops/production-truth/<datum>/`) und stellt sie
 * gegenueber.
 *
 * WARUM DAS EIN TOR IST UND KEIN BERICHT
 *
 * Diese Installation laeuft mit `VERIFY_JWT=false` und einer Kong-Route, die auf
 * `/functions/v1` nur `cors` traegt. Jede ausgerollte Function ist damit aus dem
 * Internet erreichbar, und die Pruefung im Handler ist die einzige Schranke.
 * `supabase/config.toml` wird von dieser Installation nicht ausgewertet — es
 * beschreibt eine Absicht, keinen Zustand.
 *
 * Eine Function, die ausgerollt ist und in keinem Modell steht, ist deshalb kein
 * Dokumentationsmangel, sondern ein unbekannter oeffentlicher Endpunkt.
 */

export const ERLAUBTE_MODELLE = [
  "jwt-member",
  "jwt-user",
  "capability-token",
  "signed-webhook",
  "cron-secret",
  "public-safe",
  "tombstone",
  "infrastructure",
] as const;

export type AuthModell = (typeof ERLAUBTE_MODELLE)[number];

export interface ManifestEintrag {
  model: AuthModell;
  deployed: boolean;
  repo_source: boolean;
  drift?: string;
  disposition?: string;
  open_finding?: string;
  note?: string;
}

export interface EdgeAuthManifest {
  capture_generation: string;
  gateway_is_not_a_boundary: boolean;
  functions: Record<string, ManifestEintrag>;
  not_deployed_repo_only: string[];
  config_only_no_source_no_deploy: string[];
}

const WURZEL = join(__dirname, "..", "..");

export const manifestPfad = () => join(WURZEL, "docs", "hardening", "edge-auth-manifest.json");

export const leseManifest = (): EdgeAuthManifest =>
  JSON.parse(readFileSync(manifestPfad(), "utf8")) as EdgeAuthManifest;

/**
 * Die juengste Aufnahme, nach Verzeichnisnamen (ISO-Datum) sortiert. Nicht nach
 * mtime: ein `git checkout` setzt mtime neu, das Datum im Namen bleibt.
 */
export const juengsteAufnahme = (): string | null => {
  const basis = join(WURZEL, "ops", "production-truth");
  if (!existsSync(basis)) return null;
  const kandidaten = readdirSync(basis, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  return kandidaten.length ? join(basis, kandidaten[kandidaten.length - 1]) : null;
};

/** Namen der ausgerollten Functions aus einer Aufnahme, `_shared` eingeschlossen. */
export const ausgerollteFunktionen = (aufnahme: string): string[] => {
  const pfad = join(aufnahme, "edge-runtime.json");
  const roh = JSON.parse(readFileSync(pfad, "utf8")) as {
    edge_runtime: { deployed_functions: Array<{ name: string }> };
  };
  return roh.edge_runtime.deployed_functions.map((f) => f.name).sort();
};

/** Function-Verzeichnisse im Repo. */
export const repoFunktionen = (): string[] =>
  readdirSync(join(WURZEL, "supabase", "functions"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
