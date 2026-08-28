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
 */

const WURZEL = join(__dirname, "..", "..");
const QUELLE = join(WURZEL, "src");

const QUELL_ENDUNGEN = new Set([".ts", ".tsx"]);
const UEBERSPRUNGEN = new Set(["__tests__", "test", "node_modules"]);

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
    const roh = readFileSync(datei, "utf8");
    const inhalt = ohneKommentare(roh);
    for (const regel of REGELN) {
      const treffer = regel.muster.exec(inhalt);
      if (!treffer) continue;
      const zeile = inhalt.slice(0, treffer.index).split("\n").length;
      funde.push({
        datei: relative(WURZEL, datei),
        zeile,
        text: roh.split("\n")[zeile - 1]?.trim() ?? "",
        regel: `${regel.name}: ${regel.erklaerung}`,
      });
    }
  }
  return funde;
};
