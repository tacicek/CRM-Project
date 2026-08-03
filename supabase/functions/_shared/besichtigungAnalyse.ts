/**
 * Die Entscheidung vor der Bildanalyse.
 *
 * ── Warum das hier steht ───────────────────────────────────────────────────
 *
 * `analyze-besichtigung` hat die Sitzung auf `analyzing` gesetzt, BEVOR auch
 * nur ein Foto signiert war. Schlugen danach alle Signaturen fehl, brach die
 * Funktion mit 500 ab — und die Sitzung blieb auf `analyzing` stehen. Fuer
 * jeden spaeteren Blick sah das aus wie eine laufende Analyse, die nie
 * zurueckkommt. Kein Aufraeumen setzt sie zurueck; nur ein Mensch mit
 * Datenbankzugriff.
 *
 * Die Reihenfolge ist damit umgedreht: erst signieren, dann entscheiden, und
 * den Status nur anfassen, wenn es wirklich etwas zu analysieren gibt.
 *
 * Diese Datei traegt den Teil, der ohne Netz und ohne Deno auskommt, damit
 * genau diese Fehlerpfade pruefbar sind — der Fall "alles fehlgeschlagen" ist
 * sonst der am schwersten herstellbare von allen.
 */

/** Ergebnis eines Signaturversuchs. `signedUrl === null` heisst: ging nicht. */
export interface SignaturErgebnis {
  photoId: string;
  roomType: string | null;
  signedUrl: string | null;
}

export interface BildInhalt {
  type: "image";
  source: { type: "url"; url: string };
}

export interface AnalyseVorbereitung {
  bilder: BildInhalt[];
  /** Raumnamen, streng parallel zu `bilder`. */
  raeume: string[];
  /** Fotos ohne Adresse — nur fuer die Protokollzeile. */
  uebersprungen: string[];
  /**
   * Erst wenn hier `true` steht, darf die Sitzung auf `analyzing` wechseln.
   * Ein einziges brauchbares Foto genuegt; null brauchbare nicht.
   */
  darfAnalyseBeginnen: boolean;
}

/**
 * Macht aus Signaturergebnissen die Bildliste — und die Entscheidung.
 *
 * Fotos ohne Adresse fallen heraus, ohne den Rest mitzunehmen: eine
 * Besichtigung mit acht Fotos, von denen eines nicht signierbar war, wird mit
 * sieben analysiert. Die Raumnamen bleiben dabei zwingend parallel zur
 * Bildliste — wuerden sie getrennt gefuehrt, verschoebe ein ausgelassenes Foto
 * alle folgenden Zuordnungen, und das Modell bekaeme die Kueche als Bad
 * beschrieben.
 */
export const bereiteAnalyseVor = (
  ergebnisse: readonly SignaturErgebnis[],
  raumNamen: Readonly<Record<string, string>>,
  standardRaum: string,
): AnalyseVorbereitung => {
  const bilder: BildInhalt[] = [];
  const raeume: string[] = [];
  const uebersprungen: string[] = [];

  for (const e of ergebnisse) {
    if (!e.signedUrl) {
      uebersprungen.push(e.photoId);
      continue;
    }
    bilder.push({ type: "image", source: { type: "url", url: e.signedUrl } });
    raeume.push(raumNamen[e.roomType ?? ""] ?? standardRaum);
  }

  return { bilder, raeume, uebersprungen, darfAnalyseBeginnen: bilder.length > 0 };
};
