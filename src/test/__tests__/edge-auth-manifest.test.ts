import { describe, expect, it } from "vitest";
import {
  ERLAUBTE_MODELLE,
  ausgerollteFunktionen,
  juengsteAufnahme,
  leseManifest,
  repoFunktionen,
} from "../edge-auth-manifest";

const manifest = leseManifest();
const aufnahme = juengsteAufnahme();

describe("Edge-Auth-Manifest", () => {
  it("nennt eine Aufnahme, die es auch gibt", () => {
    expect(aufnahme).not.toBeNull();
    expect(manifest.capture_generation).toBe(
      aufnahme!.slice(aufnahme!.indexOf("ops/production-truth")),
    );
  });

  it("haelt fest, dass das Gateway keine Schranke ist", () => {
    // Faellt das je auf `false`, ist die Begruendung fuer dieses Tor entfallen —
    // und dann gehoert das Tor ueberprueft, nicht stillschweigend abgeschwaecht.
    expect(manifest.gateway_is_not_a_boundary).toBe(true);
  });

  it("vergibt nur bekannte Modelle", () => {
    for (const [name, eintrag] of Object.entries(manifest.functions)) {
      expect(ERLAUBTE_MODELLE, `${name} traegt ein unbekanntes Modell`).toContain(eintrag.model);
    }
  });

  it("stuft JEDE ausgerollte Function ein", () => {
    const ausgerollt = ausgerolltMitAufnahme();
    const unklassifiziert = ausgerollt.filter((n) => !(n in manifest.functions));
    // Eine ausgerollte Function ohne Modell ist ein oeffentlicher Endpunkt, den
    // niemand eingeordnet hat — VERIFY_JWT ist false, das Gateway laesst durch.
    expect(unklassifiziert, "ausgerollt, aber in keinem Auth-Modell").toEqual([]);
  });

  it("fuehrt keine Function als ausgerollt, die es nicht ist", () => {
    const ausgerollt = new Set(ausgerolltMitAufnahme());
    const behauptet = Object.entries(manifest.functions)
      .filter(([, e]) => e.deployed)
      .map(([n]) => n);
    expect(behauptet.filter((n) => !ausgerollt.has(n))).toEqual([]);
  });

  it("sagt bei jedem Eintrag die Wahrheit ueber den Quelltext im Repo", () => {
    const imRepo = new Set(repoFunktionen());
    const falsch = Object.entries(manifest.functions)
      .filter(([n, e]) => e.repo_source !== imRepo.has(n))
      .map(([n, e]) => `${n}: manifest sagt repo_source=${e.repo_source}`);
    expect(falsch).toEqual([]);
  });

  it("listet die nicht ausgerollten Repo-Functions vollstaendig", () => {
    const ausgerollt = new Set(ausgerolltMitAufnahme());
    const tatsaechlich = repoFunktionen()
      .filter((n) => !ausgerollt.has(n))
      .sort();
    expect(manifest.not_deployed_repo_only.slice().sort()).toEqual(tatsaechlich);
  });

  it("laesst kein tombstone ohne Quelltext zurueck", () => {
    // Ein Grabstein ist ein fail-closed Endpunkt. Ohne Quelltext im Repo kann
    // niemand pruefen, ob er noch fail-closed antwortet.
    for (const [name, eintrag] of Object.entries(manifest.functions)) {
      if (eintrag.model === "tombstone") {
        expect(eintrag.repo_source, `${name} ist Grabstein ohne Quelle`).toBe(true);
      }
    }
  });
});

function ausgerolltMitAufnahme(): string[] {
  if (!aufnahme) throw new Error("keine Produktionsaufnahme unter ops/production-truth/");
  return ausgerollteFunktionen(aufnahme);
}
