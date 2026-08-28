import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Der Auth-Vertrag der Edge Functions — und was daran gemessen statt geglaubt wird.
 *
 * WARUM ES DIESES TOR GIBT
 *
 * Diese Installation laeuft mit `VERIFY_JWT=false`, und die Kong-Route auf
 * `/functions/v1` traegt nur `cors`. Der ausgerollte Router `main` ueberspringt
 * seinen 401-Block genau dann. Jede ausgerollte Function ist damit aus dem
 * Internet erreichbar, und die Pruefung IM HANDLER ist die einzige Schranke.
 * `supabase/config.toml` beschreibt an dieser Installation eine Absicht, keinen
 * Zustand.
 *
 * WAS IM MANIFEST STEHT UND WAS NICHT
 *
 * Im Manifest steht ausschliesslich BEURTEILUNG: Modell, Mandantenherleitung,
 * erwartete Methoden, Datenpreisgabe, gewollter Deploymentzustand, Ausnahmen mit
 * Grund.
 *
 * Nicht im Manifest stehen die messbaren Tatsachen — Repo-Pfad, config-Eintrag,
 * Deployment, Digest, Auth-Signale im Quelltext. Die holt dieses Modul sich aus
 * der Aufnahme, dem Repo und `config.toml`. Was man messen kann, wird nicht
 * abgeschrieben: abgeschriebene Tatsachen veralten, und dann bestaetigt das Tor
 * einen Zustand, den es nicht geprueft hat.
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

export const ERLAUBTE_DEPLOYMENT_ABSICHTEN = [
  /** Soll laufen und laeuft. */
  "deployed",
  /** Soll (noch) nicht laufen. */
  "not-deployed",
  /** Laeuft, soll aber zurueckgebaut werden. */
  "undeploy",
] as const;

export type DeploymentAbsicht = (typeof ERLAUBTE_DEPLOYMENT_ABSICHTEN)[number];

export interface ManifestEintrag {
  model: AuthModell;
  tenant_derivation: string;
  intended_deployment: DeploymentAbsicht;
  methods: string[];
  public_data_exposure: string;
  exceptions?: Record<string, string>;
  note?: string;
}

export interface EdgeAuthManifest {
  capture_generation: string;
  gateway_is_not_a_boundary: boolean;
  functions: Record<string, ManifestEintrag>;
  config_only_no_source_no_deploy: string[];
}

const WURZEL = join(__dirname, "..", "..");
const FUNKTIONEN = join(WURZEL, "supabase", "functions");

export const leseManifest = (): EdgeAuthManifest =>
  JSON.parse(readFileSync(join(WURZEL, "docs", "hardening", "edge-auth-manifest.json"), "utf8"));

/** Juengste Aufnahme nach ISO-Datum im Verzeichnisnamen — nicht nach mtime. */
export const juengsteAufnahme = (): string | null => {
  const basis = join(WURZEL, "ops", "production-truth");
  if (!existsSync(basis)) return null;
  const d = readdirSync(basis, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  return d.length ? join(basis, d[d.length - 1]) : null;
};

export const ausgerollteFunktionen = (aufnahme: string): string[] => {
  const roh = JSON.parse(readFileSync(join(aufnahme, "edge-runtime.json"), "utf8")) as {
    edge_runtime: { deployed_functions: Array<{ name: string }> };
  };
  return roh.edge_runtime.deployed_functions.map((f) => f.name).sort();
};

/** `VERIFY_JWT` der Laufzeit und die Plugins der Functions-Route. */
export const gatewayZustand = (
  aufnahme: string,
): { verifyJwt: string; routePlugins: string[] } => {
  const roh = JSON.parse(readFileSync(join(aufnahme, "edge-runtime.json"), "utf8")) as {
    edge_runtime: { verify_jwt: string };
    gateway: { functions_route_plugins: string[] };
  };
  return { verifyJwt: roh.edge_runtime.verify_jwt, routePlugins: roh.gateway.functions_route_plugins };
};

export const repoFunktionen = (): string[] =>
  readdirSync(FUNKTIONEN, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

/** Die in `supabase/config.toml` deklarierten Function-Namen. */
export const konfigurierteFunktionen = (): string[] => {
  const toml = readFileSync(join(WURZEL, "supabase", "config.toml"), "utf8");
  const namen = new Set<string>();
  for (const treffer of toml.matchAll(/^\s*\[functions\.([A-Za-z0-9_-]+)\]/gm)) {
    namen.add(treffer[1]);
  }
  return [...namen].sort();
};

/**
 * Kommentare zaehlen nicht als Pruefung.
 *
 * Die unabhängige Durchsicht am 2026-08-28 ersetzte in
 * `handle-proposal-response` die ganze Autorisierung durch `if (false)`. Das Tor
 * blieb gruen — nicht nur wegen des `.select("… access_token …")`, sondern auch,
 * weil zwei Zeilen tiefer ein KOMMENTAR steht: „Token ist validiert (Zeile oben:
 * offer.access_token === token)". Ein Satz ueber eine Pruefung ist keine.
 */
const ohneKommentare = (inhalt: string): string =>
  inhalt
    .replace(/\/\*[\s\S]*?\*\//g, (t) => t.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (t, vor: string) => vor + " ".repeat(t.length - vor.length));

export const quelltext = (name: string): string | null => {
  const p = join(FUNKTIONEN, name, "index.ts");
  return existsSync(p) ? ohneKommentare(readFileSync(p, "utf8")) : null;
};

/** Gemessene Auth-Signale im Quelltext — keine Beurteilung, nur Vorkommen. */
export interface Quellsignale {
  serviceRole: boolean;
  cronPruefung: boolean;
  mitgliedschaft: boolean;
  jwtBenutzer: boolean;
  faehigkeitsToken: boolean;
  signatur: boolean;
  grabstein: boolean;
}

export const signale = (quelle: string): Quellsignale => ({
  serviceRole: quelle.includes("SUPABASE_SERVICE_ROLE_KEY"),
  // Die WÄCHTERFORM, nicht der Name. `isCronRequestDISABLED` enthält den Namen
  // ebenfalls und wäre trotzdem abgeschaltet — diese Einschleusung kam am
  // 2026-08-28 durch die erste Fassung dieses Tors.
  cronPruefung: /\bif\s*\(\s*!\s*isCronRequest\s*\(/.test(quelle),
  // Ebenfalls die Aufrufform: ein Import allein prüft nichts.
  mitgliedschaft:
    /\b(verifyCompanyMembership|verifyCompanyRole|assertCompanyMembership|assertCompanyMembershipFromAuthHeader)\s*\(/.test(
      quelle,
    ),
  // Auch der gemeinsame Helfer zählt: `assertCompanyMembershipFromAuthHeader`
  // löst den Benutzer aus dem Header auf. Nur `auth.getUser` zu zählen hiesse,
  // den richtigen Weg zu bestrafen.
  jwtBenutzer:
    /\bauth\.getUser\s*\(/.test(quelle) ||
    /\bassertCompanyMembershipFromAuthHeader\s*\(/.test(quelle),
  // Die WÄCHTERFORM, nicht das Vokabular.
  //
  // Die erste Fassung suchte nach Bezeichnern wie `access_token`. Die
  // unabhängige Durchsicht am 2026-08-28 hat in `handle-proposal-response` die
  // ganze Autorisierung durch `if (false)` ersetzt — der Bezeichner blieb im
  // `.select("id, access_token, language")` stehen, und das Tor blieb grün.
  //
  // Ein Token schliesst eine Zeile auf. Das sieht so aus:
  //   .eq("access_token", …) / .eq("token", …) / .eq("token_hash", …)
  //   offer.access_token !== token          (Vergleich)
  //   supabase.rpc("…_by_token" | "…_by_action_token", { p_token })
  faehigkeitsToken:
    /\.eq\(\s*["'`][a-z_]*token[a-z_]*["'`]/.test(quelle) ||
    /\b[A-Za-z_.]*[Tt]oken[A-Za-z_]*\s*(!==|===|!=|==)\s*[A-Za-z_.]/.test(quelle) ||
    /rpc\(\s*\n?\s*["'`][a-z_]*_by_[a-z_]*token["'`]/.test(quelle),
  signatur: /\bverifySvixSignature\s*\(/.test(quelle),
  grabstein:
    quelle.includes("retiredAdminEndpoint") || quelle.includes("resendEmailTombstone"),
});

/** Modelle, bei denen ein service-role-Client ohne Mandantenbindung erwartbar ist. */
export const OHNE_MANDANTENGRENZE_ERLAUBT: ReadonlySet<AuthModell> = new Set<AuthModell>([
  "cron-secret",
  "tombstone",
  "infrastructure",
]);
