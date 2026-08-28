import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

/**
 * Sucht im Quelltext nach Wegen, auf denen die Firma wieder GERATEN werden
 * koennte.
 *
 * WARUM ALS TOR UND NICHT ALS NOTIZ
 *
 * `fetchSingleCompanyForUser()` beantwortete die Frage "welche Firma ist meine?"
 * ohne zu wissen, welche ausgewaehlt ist: erst `companies.email` /
 * `notification_email` gegen die Anmeldeadresse, sonst die zuletzt angelegte.
 * Bei zwei Firmen konnte damit eine Rechnungsliste die Zeilen der einen zeigen
 * und den QR-Glaeubiger der anderen drucken.
 *
 * Die Funktion ist entfernt. Das allein haelt sie aber nicht fern: dieselbe
 * Abfrage laesst sich in zwei Zeilen neu schreiben, und sie sieht dabei
 * harmlos aus. Deshalb prueft dieses Tor das MUSTER, nicht den Namen.
 *
 * WAS ES NICHT KANN
 *
 * Es liest Text, keine Bedeutung. Wer die Spalte ueber eine Variable einsetzt
 * (`.eq(SPALTE, wert)`), `.match({ email })` oder `.or("email.eq…")` benutzt oder
 * den Abfragebauer ueber mehr als 400 Zeichen verteilt, kommt daran vorbei.
 * Das Tor faengt den naheliegenden Rueckfall, nicht den entschlossenen — es
 * ersetzt keine Durchsicht. Diese Grenze steht hier, damit ein gruener Lauf
 * nicht mehr verspricht, als er geprueft hat.
 */

const WURZEL = join(__dirname, "..", "..");
const QUELLE = join(WURZEL, "src");

const QUELL_ENDUNGEN = new Set([".ts", ".tsx"]);
const UEBERSPRUNGEN = new Set(["__tests__", "node_modules"]);

/**
 * Dateien, die die Muster ENTHALTEN duerfen, weil sie die einzige erlaubte
 * Umsetzung sind. Eine Positivliste mit Begruendung, keine pauschal
 * uebersprungenen Verzeichnisse: `src/test/` ganz auszunehmen hiesse, dass
 * Testcode eine zweite Mandantenquelle bauen darf, ohne dass es auffaellt.
 */
const ERLAUBT = new Map<string, string>([
  ["src/test/mandanten-quelle.ts", "diese Datei — sie TRAEGT die Muster"],
  [
    "src/hooks/CompanyProvider.tsx",
    "die eine Stelle, die Mitgliedschaften aufloest und den aktiven Mandanten setzt",
  ],
  [
    "src/lib/tenantSession.ts",
    "der eine Ort, der die sessionStorage-Schluessel kennt — er waehlt keine Firma aus",
  ],
  [
    "src/lib/fetchCompaniesForUser.ts",
    "der eine Helfer, der Mitgliedschaften liest — er waehlt nicht aus",
  ],
]);

export interface Fundstelle {
  datei: string;
  zeile: number;
  text: string;
  regel: string;
}

const REGELN: Array<{ name: string; muster: RegExp; erklaerung: string }> = [
  {
    name: "geratene-firma-helfer",
    muster: /\bfetchSingleCompanyForUser\b/,
    erklaerung:
      "Der Ratehelfer ist entfernt. Unter /firma kommt die Firma aus useCompanyContext(); " +
      "einen vollstaendigen Satz laedt useCompanyRecord(select) bzw. fetchCompanyById().",
  },
  {
    name: "firma-ueber-anmeldeadresse",
    muster: /from\(\s*["'`]companies["'`]\s*\)[\s\S]{0,400}?\.eq\(\s*["'`](?:email|notification_email)["'`]/,
    erklaerung:
      "Eine Firma ueber die Anmeldeadresse zu suchen ist genau die alte Rateregel. " +
      "Die Firma wird ueber ihre id gelesen.",
  },
  {
    name: "firma-ueber-anlagedatum",
    muster: /from\(\s*["'`]companies["'`]\s*\)[\s\S]{0,400}?\.order\(\s*["'`]created_at["'`]/,
    erklaerung:
      "Die zuletzt angelegte Firma zu nehmen ist die zweite Haelfte der alten Rateregel.",
  },
  {
    name: "firma-aus-dem-sessionstorage",
    muster: /\bgetCachedCompany\b|["'`]firma_company_cache["'`]|["'`]crm_active_company_id["'`]/,
    erklaerung:
      "Ein synchroner Griff in den sessionStorage ist eine zweite Mandantenquelle, " +
      "und eine, die beim Wechsel NICHT nachzieht: der CompanyProvider schreibt den " +
      "Cache erst in einem Effekt nach dem Rendern, und dieses Schreiben loest kein " +
      "Rendern aus. Die Firma kommt aus useCompanyContext().",
  },
  {
    name: "verzoegerter-schreibvorgang-am-kontext",
    muster: /tenantBound\s*\(\s*activeCompanyId|tenantBound\s*\(\s*companyId\b/,
    erklaerung:
      "Ein verzoegerter Schreibvorgang darf seinen Mandanten nicht aus dem KONTEXT nehmen. " +
      "Der springt beim Wechsel sofort um, waehrend die geladene Zeile noch die alte ist — " +
      "genau so landeten A-Werte unter dem Schluessel von B. Der Mandant kommt aus der " +
      "Zeile, aus der die Werte stammen: tenantBound(company.id, …).",
  },
  {
    name: "firma-aus-mitgliedschaftsreihenfolge",
    muster: /from\(\s*["'`]company_members["'`]\s*\)[\s\S]{0,400}?\.eq\(\s*["'`]user_id["'`]/,
    erklaerung:
      "Mitgliedschaften eines Benutzers abzufragen und die erste zu nehmen, ist die " +
      "alte Rateregel ohne den Umweg ueber `companies`. Mitgliedschaften loest " +
      "genau eine Stelle auf: der CompanyProvider ueber fetchCompaniesForUser.",
  },
];

const dateienUnter = (verzeichnis: string): string[] => {
  const raus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.isDirectory()) {
      if (UEBERSPRUNGEN.has(eintrag.name)) continue;
      raus.push(...dateienUnter(join(verzeichnis, eintrag.name)));
    } else if (QUELL_ENDUNGEN.has(extname(eintrag.name))) {
      raus.push(join(verzeichnis, eintrag.name));
    }
  }
  return raus;
};

/**
 * Kommentare zaehlen nicht. Ein Text, der die alte Regel ERKLAERT, ist genau
 * das, was hier stehen bleiben soll — sonst zwingt das Tor dazu, die Geschichte
 * zu loeschen, um gruen zu werden.
 */
const ohneKommentare = (inhalt: string): string =>
  inhalt
    .replace(/\/\*[\s\S]*?\*\//g, (treffer) => treffer.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (treffer, vor: string) =>
      vor + " ".repeat(treffer.length - vor.length),
    );

export const findeGerateneMandantenQuellen = (): Fundstelle[] => {
  const funde: Fundstelle[] = [];
  for (const datei of dateienUnter(QUELLE)) {
    const relPfad = relative(WURZEL, datei);
    if (ERLAUBT.has(relPfad)) continue;
    const roh = readFileSync(datei, "utf8");
    const inhalt = ohneKommentare(roh);
    for (const regel of REGELN) {
      const treffer = regel.muster.exec(inhalt);
      if (!treffer) continue;
      const zeile = inhalt.slice(0, treffer.index).split("\n").length;
      funde.push({
        datei: relPfad,
        zeile,
        text: roh.split("\n")[zeile - 1]?.trim() ?? "",
        regel: `${regel.name}: ${regel.erklaerung}`,
      });
    }
  }
  return funde;
};
