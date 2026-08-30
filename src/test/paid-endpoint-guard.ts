import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ein Quelltext-Tor fuer die drei bezahlten Google-Endpunkte.
 *
 * WAS ES IST — WÖRTLICH
 *
 * Eine **syntaktische Vertragspruefung** über drei bekannte Dateien. Es liest
 * Quelltext und sucht Muster. Es ist **keine Kontrollfluss-Analyse**: es kann
 * nicht beweisen, dass Google auf jedem Pfad erst nach der Wache erreicht wird.
 * Was es kann, ist die Rueckkehr genau der Fehler verhindern, die hier schon
 * einmal gemacht wurden:
 *
 *   · ein Zaehler im Modulkoerper, ausgegeben als Drosselung — er war ueber
 *     Worker hinweg wirkungslos (R2-01, gemessen: 61 Anfragen, null 429);
 *   · `console.log` mit Kundeninhalt in einem Produktionspfad;
 *   · ein `fetch` auf Google, das nicht ueber den gemeinsamen Ablauf laeuft.
 */

const WURZEL = join(__dirname, "..", "..");
export const BEZAHLTE_ENDPUNKTE = [
  "calculate-distance",
  "google-places-autocomplete",
  "google-places-details",
] as const;

export const quelle = (endpunkt: string): string =>
  readFileSync(join(WURZEL, "supabase", "functions", endpunkt, "index.ts"), "utf8");

/**
 * Auch die gemeinsame Ablaufdatei gehoert geprueft.
 *
 * Die erste Fassung las nur die drei `index.ts`. Jeder `umg.log(...)`-Aufruf und
 * der einzige Google-`fetch` liegen aber in `_shared/paidApiHttp.ts` — ein
 * `console.log(nutzlast)` oder ein Modulzaehler dort haette alle drei Endpunkte
 * getroffen, und das Tor waere gruen geblieben. Gefunden von der unabhaengigen
 * Durchsicht.
 */
export const GEMEINSAME_DATEIEN = ["_shared/paidApiHttp.ts"] as const;

export const gemeinsameQuelle = (pfad: string): string =>
  readFileSync(join(WURZEL, "supabase", "functions", pfad), "utf8");

export const ohneKommentare = (s: string): string =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // `(?<!:)` — sonst frisst der Zeilenkommentar-Ausdruck das `//` in
    // `https://…` und mit ihm genau die Zeile, die das Tor finden soll.
    // Gefunden, weil der eingeschleuste Testfall gruen blieb.
    .replace(/(?<!:)\/\/[^\n]*/g, " ");

export type VerstossArt =
  | "modulzaehler-als-drossel"
  | "console-log"
  | "kundeninhalt-im-protokoll"
  | "google-fetch-ausserhalb-des-ablaufs"
  | "kein-gemeinsamer-ablauf";

export interface Verstoss {
  endpunkt: string;
  art: VerstossArt;
  detail: string;
}

/** Feldnamen, die Kundeninhalt tragen und nie protokolliert werden duerfen. */
const KUNDENFELDER = [
  "origin", "destination", "input", "placeId", "place_id",
  "street", "houseNumber", "plz", "city", "formattedAddress",
];

export const pruefeEndpunkt = (endpunkt: string, roh: string): Verstoss[] => {
  const s = ohneKommentare(roh);
  const verstoesse: Verstoss[] = [];

  if (/\bnew\s+(Map|Set)\s*\(/.test(s)) {
    verstoesse.push({
      endpunkt, art: "modulzaehler-als-drossel",
      detail: "new Map/Set im Modulkoerper — genau die Bauart, die ueber Worker hinweg nichts durchsetzt.",
    });
  }

  if (/\bconsole\s*\.\s*log\s*\(/.test(s)) {
    verstoesse.push({ endpunkt, art: "console-log", detail: "console.log in einem Produktionspfad." });
  }

  // Ein Protokollaufruf, der einen Kundenfeldnamen nennt.
  for (const m of s.matchAll(/\b(?:console\s*\.\s*\w+|log)\s*\(([^;]{0,220})/g)) {
    const arg = m[1];
    const treffer = KUNDENFELDER.find((f) => new RegExp(`\\b${f}\\b`).test(arg));
    if (treffer) {
      verstoesse.push({
        endpunkt, art: "kundeninhalt-im-protokoll",
        detail: `Protokollaufruf nennt "${treffer}".`,
      });
      break;
    }
  }

  // Jeder Google-Aufruf muss ueber den gemeinsamen Ablauf laufen. Ein direktes
  // `fetch("https://maps.googleapis...")` im Handler umgeht ihn.
  if (/\bfetch\s*\(\s*["'`]https?:\/\/[^"'`]*googleapis/i.test(s)) {
    verstoesse.push({
      endpunkt, art: "google-fetch-ausserhalb-des-ablaufs",
      detail: "Direkter fetch auf googleapis im Handler statt ueber fetchGoogle des Ablaufs.",
    });
  }

  if (!/\bbearbeitePaidApiAnfrage\s*\(/.test(s)) {
    verstoesse.push({
      endpunkt, art: "kein-gemeinsamer-ablauf",
      detail: "Der Endpunkt benutzt den gemeinsamen Ablauf nicht — Reihenfolge und Budget waeren unbelegt.",
    });
  }

  return verstoesse;
};

export const pruefeAlleEndpunkte = (): Verstoss[] => [
  ...BEZAHLTE_ENDPUNKTE.flatMap((e) => pruefeEndpunkt(e, quelle(e))),
  // Die gemeinsame Datei traegt den Ablauf, nicht den Endpunktvertrag — sie
  // muss `bearbeitePaidApiAnfrage` nicht AUFRUFEN, sondern definiert es.
  ...GEMEINSAME_DATEIEN.flatMap((f) =>
    pruefeEndpunkt(f, gemeinsameQuelle(f)).filter((v) => v.art !== "kein-gemeinsamer-ablauf"),
  ),
];
