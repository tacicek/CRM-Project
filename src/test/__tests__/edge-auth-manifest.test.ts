import { describe, expect, it } from "vitest";
import {
  ERLAUBTE_DEPLOYMENT_ABSICHTEN,
  ERLAUBTE_MODELLE,
  OHNE_MANDANTENGRENZE_ERLAUBT,
  ausgerollteFunktionen,
  gatewayZustand,
  juengsteAufnahme,
  konfigurierteFunktionen,
  leseManifest,
  quelltext,
  repoFunktionen,
  signale,
} from "../edge-auth-manifest";

const manifest = leseManifest();
const aufnahme = juengsteAufnahme();
if (!aufnahme) throw new Error("keine Produktionsaufnahme unter ops/production-truth/");

const ausgerollt = new Set(ausgerollteFunktionen(aufnahme));
const imRepo = new Set(repoFunktionen());
const inKonfig = new Set(konfigurierteFunktionen());
const eintraege = Object.entries(manifest.functions);

/** Eine Ausnahme gilt nur mit Grund. */
const ausnahme = (name: string, regel: string): string | null => {
  const grund = manifest.functions[name]?.exceptions?.[regel];
  return typeof grund === "string" && grund.trim().length > 10 ? grund : null;
};

const melde = (verstoesse: string[]) => expect(verstoesse).toEqual([]);

// ---------------------------------------------------------------------------

describe("Grundlage", () => {
  it("das Manifest nennt die Aufnahme, gegen die es gilt", () => {
    expect(manifest.capture_generation).toBe(aufnahme.slice(aufnahme.indexOf("ops/production-truth")));
  });

  it("das Gateway ist gemessen KEINE Schranke", () => {
    // Faellt das je weg, ist die Begruendung fuer dieses Tor entfallen — dann
    // gehoert es ueberprueft, nicht stillschweigend abgeschwaecht.
    const { verifyJwt, routePlugins } = gatewayZustand(aufnahme);
    expect(verifyJwt).toBe("false");
    expect(routePlugins).toEqual(["cors"]);
    expect(manifest.gateway_is_not_a_boundary).toBe(true);
  });

  it("jeder Eintrag ist vollständig und trägt erlaubte Werte", () => {
    melde(
      eintraege.flatMap(([n, e]) => {
        const f: string[] = [];
        if (!(ERLAUBTE_MODELLE as readonly string[]).includes(e.model)) f.push(`${n}: unbekanntes Modell ${e.model}`);
        if (!(ERLAUBTE_DEPLOYMENT_ABSICHTEN as readonly string[]).includes(e.intended_deployment))
          f.push(`${n}: unbekannte Deployment-Absicht ${e.intended_deployment}`);
        if (!e.tenant_derivation?.trim()) f.push(`${n}: keine Mandantenherleitung angegeben`);
        if (!Array.isArray(e.methods) || e.methods.length === 0) f.push(`${n}: keine erwarteten Methoden`);
        if (!e.public_data_exposure?.trim()) f.push(`${n}: keine Angabe zur Datenpreisgabe`);
        return f;
      }),
    );
  });

  it("jede Ausnahme trägt einen Grund", () => {
    // Eine Ausnahme ohne Grund ist ein abgeschalteter Test mit besserer Presse.
    melde(
      eintraege.flatMap(([n, e]) =>
        Object.entries(e.exceptions ?? {})
          .filter(([, grund]) => typeof grund !== "string" || grund.trim().length <= 10)
          .map(([regel]) => `${n}: Ausnahme "${regel}" ohne Begründung`),
      ),
    );
  });
});

// --- Vollständigkeit -------------------------------------------------------

describe("Vollständigkeit", () => {
  it("JEDE ausgerollte Function ist eingestuft", () => {
    // Eine ausgerollte Function ohne Modell ist ein öffentlicher Endpunkt, den
    // niemand eingeordnet hat.
    melde([...ausgerollt].filter((n) => !(n in manifest.functions)));
  });

  it("JEDE Function im Repo ist eingestuft", () => {
    melde([...imRepo].filter((n) => !(n in manifest.functions)));
  });

  it("kein config.toml-Eintrag ohne Quelle bleibt unerklärt", () => {
    const ohneQuelle = [...inKonfig].filter((n) => !imRepo.has(n));
    const erklaert = new Set(manifest.config_only_no_source_no_deploy);
    melde(ohneQuelle.filter((n) => !erklaert.has(n)).map((n) => `${n}: in config.toml, keine Quelle, nicht als Rest vermerkt`));
  });

  it("die Restliste in config.toml ist noch wahr", () => {
    melde(
      manifest.config_only_no_source_no_deploy.filter((n) => imRepo.has(n) || ausgerollt.has(n))
        .map((n) => `${n}: als quellenlos gelistet, existiert aber`),
    );
  });
});

// --- Absicht gegen Wirklichkeit -------------------------------------------

describe("Gewollter gegen tatsächlichen Deploymentzustand", () => {
  it("was `deployed` heissen soll, läuft auch", () => {
    melde(
      eintraege.filter(([n, e]) => e.intended_deployment === "deployed" && !ausgerollt.has(n))
        .map(([n]) => `${n}: soll laufen, ist aber nicht ausgerollt`),
    );
  });

  it("was `not-deployed` heissen soll, läuft NICHT", () => {
    // Eine Function, die laut Manifest nicht laufen soll und doch läuft, ist
    // ein Endpunkt ohne Eigentümer.
    melde(
      eintraege.filter(([n, e]) => e.intended_deployment === "not-deployed" && ausgerollt.has(n))
        .map(([n]) => `${n}: soll nicht laufen, ist aber ausgerollt`),
    );
  });

  it("`undeploy` bezeichnet nur, was heute noch läuft", () => {
    melde(
      eintraege.filter(([n, e]) => e.intended_deployment === "undeploy" && !ausgerollt.has(n))
        .map(([n]) => `${n}: als rückzubauen geführt, läuft aber gar nicht mehr`),
    );
  });
});

// --- Modell gegen Quelltext ------------------------------------------------

describe("Das Modell muss zum Handler passen", () => {
  const mitQuelle = eintraege
    .map(([n, e]) => ({ n, e, q: quelltext(n) }))
    .filter((x): x is { n: string; e: typeof x.e; q: string } => x.q !== null);

  it("ein cron-secret-Endpunkt prüft den Aufrufer", () => {
    // Sonst ist er ein offener service-role-Endpunkt mit einem beruhigenden Namen.
    melde(
      mitQuelle
        .filter(({ n, e, q }) =>
          e.model === "cron-secret" && !signale(q).cronPruefung && !ausnahme(n, "cron-checks-secret"))
        .map(({ n }) => `${n}: cron-secret ohne isCronRequest`),
    );
  });

  it("ein jwt-member-Endpunkt prüft die Mitgliedschaft über den gemeinsamen Helfer", () => {
    // Eine abgeschriebene Prüfung ist eine zweite Prüfung — und die zweite ist
    // die, die niemand pflegt.
    melde(
      mitQuelle
        .filter(({ n, e, q }) =>
          e.model === "jwt-member" && !signale(q).mitgliedschaft && !ausnahme(n, "jwt-member-uses-shared-helper"))
        .map(({ n }) => `${n}: jwt-member ohne verifyCompanyMembership/-Role`),
    );
  });

  it("ein jwt-Endpunkt prüft überhaupt ein Token", () => {
    melde(
      mitQuelle
        .filter(({ e, q }) => (e.model === "jwt-member" || e.model === "jwt-user") && !signale(q).jwtBenutzer)
        .map(({ n }) => `${n}: ${manifest.functions[n].model} ohne auth.getUser`),
    );
  });

  it("ein capability-token-Endpunkt schliesst wirklich über ein Token auf", () => {
    // Gemessen wird die WÄCHTERFORM (Vergleich, `.eq`, `…_by_token`-RPC), nicht
    // das Vorkommen des Wortes. Ein `.select("… access_token …")` allein ist
    // keine Prüfung — die unabhängige Durchsicht hat genau damit eine
    // abgeschaltete Autorisierung an diesem Tor vorbeigebracht.
    melde(
      mitQuelle
        .filter(({ n, e, q }) =>
          e.model === "capability-token" &&
          !signale(q).faehigkeitsToken &&
          !ausnahme(n, "capability-token-validates-a-token"))
        .map(({ n }) => `${n}: capability-token ohne Tokenprüfung`),
    );
  });

  it("ein signed-webhook prüft die Signatur", () => {
    melde(
      mitQuelle.filter(({ e, q }) => e.model === "signed-webhook" && !signale(q).signatur)
        .map(({ n }) => `${n}: signed-webhook ohne Signaturprüfung`),
    );
  });

  it("ein Grabstein antwortet fail-closed und fasst nichts an", () => {
    melde(
      mitQuelle.flatMap(({ n, e, q }) => {
        if (e.model !== "tombstone") return [];
        const s = signale(q);
        const f: string[] = [];
        if (!s.grabstein) f.push(`${n}: als Grabstein geführt, benutzt aber keinen Grabstein-Helfer`);
        if (s.serviceRole) f.push(`${n}: Grabstein mit service-role-Schlüssel`);
        return f;
      }),
    );
  });

  it("kein Grabstein ohne Quelltext", () => {
    // Ohne Quelle kann niemand prüfen, ob er noch fail-closed antwortet.
    melde(
      eintraege.filter(([n, e]) => e.model === "tombstone" && !imRepo.has(n))
        .map(([n]) => `${n}: Grabstein ohne Quelle im Repo`),
    );
  });

  it("ein service-role-Handler bringt eine Mandantengrenze mit", () => {
    // `service_role` trägt BYPASSRLS. Ohne eigene Grenze ist jede Abfrage
    // mandantenlos — und das fällt nicht auf, weil nichts fehlschlägt.
    melde(
      mitQuelle
        .filter(({ n, e, q }) => {
          if (!signale(q).serviceRole) return false;
          if (OHNE_MANDANTENGRENZE_ERLAUBT.has(e.model)) return false;
          const s = signale(q);
          const hatGrenze = s.mitgliedschaft || s.faehigkeitsToken || s.signatur;
          return !hatGrenze && !ausnahme(n, "service-role-needs-tenant-boundary");
        })
        .map(({ n }) => `${n}: service-role ohne Mitgliedschafts-, Token- oder Signaturprüfung`),
    );
  });
});
