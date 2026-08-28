import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/**
 * Ein kundengerichteter Renderer darf die Sprache des BEDIENERS nicht lesen.
 *
 * Das System hat zwei Sprachachsen. Die Dashboard-Sprache gehoert der Firma,
 * die Dokumentsprache dem Kunden. Beide sind im selben Browsertab gleichzeitig
 * lebendig: ein deutschsprachiger Operator schreibt eine franzoesische Offerte.
 *
 * `useT()` und `useI18n()` lesen die BEDIENERSPRACHE aus dem React-Kontext.
 * Eine PDF-Seite, ein E-Mail-Baustein oder eine oeffentliche Token-Seite, die
 * einen von beiden benutzt, laesst die Sprache des Operators in das Dokument
 * des Kunden laufen — und zwar unsichtbar, denn beim deutschen Operator mit
 * deutschem Kunden stimmt das Ergebnis zufaellig.
 *
 * Diese Datei ist ein VORBEUGENDES Tor: gemessen am 2026-08-28 verletzt es
 * niemand. Genau deshalb ist jetzt der richtige Zeitpunkt — ein Tor, das man
 * einfuehrt, waehrend es gruen ist, muss nichts aufraeumen.
 */

const WURZEL = join(__dirname, "..", "..");

/** Verzeichnisse und Dateien, deren Ausgabe der KUNDE liest. */
const KUNDENFLAECHEN = [
  "src/components/pdf",
  "src/components/quittung",
  "src/pages/public",
  "src/lib/generateOfferPdf.tsx",
  "src/lib/generateAgbPdf.tsx",
  "src/lib/generateChecklistPdf.ts",
  "src/lib/generateRechnungPdf.ts",
  "src/lib/generateAuftragPdf.ts",
  "src/lib/generateBoxRentalPdf.ts",
];

/** Was dort nicht vorkommen darf. */
const VERBOTEN: Array<{ muster: RegExp; erklaerung: string }> = [
  {
    muster: /\buseT\s*\(/,
    erklaerung:
      "useT() liest die Sprache des BEDIENERS. Kundengerichtete Renderer bekommen " +
      "die Sprache als Argument — siehe documentI18nFor(locale) / createDocumentI18n(row).",
  },
  {
    muster: /\buseI18n\s*\(/,
    erklaerung:
      "useI18n() liest die Sprache des BEDIENERS. Fuer Kundenausgabe: " +
      "documentI18nFor(locale).",
  },
  {
    muster: /from\s+["']@\/i18n\/useI18n["']/,
    erklaerung: "Der Bedienerkontext hat in einem kundengerichteten Renderer nichts zu suchen.",
  },
];

export interface Verstoss {
  datei: string;
  zeile: number;
  text: string;
  erklaerung: string;
}

const QUELL_ENDUNGEN = new Set([".ts", ".tsx"]);
const UEBERSPRUNGEN = new Set(["__tests__"]);

const dateien = (pfad: string): string[] => {
  const voll = join(WURZEL, pfad);
  let s;
  try {
    s = statSync(voll);
  } catch {
    return []; // Pfad umbenannt oder entfernt — dafuer gibt es den Bestandstest unten.
  }
  if (s.isFile()) return QUELL_ENDUNGEN.has(extname(voll)) ? [voll] : [];
  const raus: string[] = [];
  for (const e of readdirSync(voll, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (UEBERSPRUNGEN.has(e.name)) continue;
      raus.push(...dateien(join(pfad, e.name)));
    } else if (QUELL_ENDUNGEN.has(extname(e.name))) {
      raus.push(join(voll, e.name));
    }
  }
  return raus;
};

/** Kommentare zaehlen nicht — ein Text, der die Regel ERKLAERT, soll bleiben duerfen. */
const ohneKommentare = (inhalt: string): string =>
  inhalt
    .replace(/\/\*[\s\S]*?\*\//g, (t) => t.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (t, vor: string) => vor + " ".repeat(t.length - vor.length));

export const kundenflaechen = (): string[] => KUNDENFLAECHEN;

/** Die Flaechen, die es wirklich gibt — schuetzt vor einer Liste, die ins Leere zeigt. */
export const vorhandeneKundenflaechen = (): string[] =>
  KUNDENFLAECHEN.filter((p) => {
    try {
      statSync(join(WURZEL, p));
      return true;
    } catch {
      return false;
    }
  });

export const findeBedienerspracheInKundenrenderern = (): Verstoss[] => {
  const funde: Verstoss[] = [];
  for (const flaeche of KUNDENFLAECHEN) {
    for (const datei of dateien(flaeche)) {
      const roh = readFileSync(datei, "utf8");
      const inhalt = ohneKommentare(roh);
      for (const { muster, erklaerung } of VERBOTEN) {
        const treffer = muster.exec(inhalt);
        if (!treffer) continue;
        const zeile = inhalt.slice(0, treffer.index).split("\n").length;
        funde.push({
          datei: relative(WURZEL, datei),
          zeile,
          text: roh.split("\n")[zeile - 1]?.trim() ?? "",
          erklaerung,
        });
      }
    }
  }
  return funde;
};
