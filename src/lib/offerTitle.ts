import { documentI18nFor } from "@/i18n/documentLocale";
import type { Locale } from "@/i18n/locale";
import type { MessageKey } from "@/i18n/translator";

/**
 * Der Offertentitel — deterministisch aus Servicetyp und Orten, in der Sprache
 * des KUNDEN.
 *
 * Er stand bis 2026-08-28 inline im Ladeeffekt von `OfferteErstellen`. Damit war
 * er genau einmal erzeugbar: beim Laden. Wer danach die Dokumentsprache
 * umstellte, behielt den deutschen Titel auf der französischen Offerte — die
 * Oberfläche sagte „Französisch", der Titel widersprach ihr.
 *
 * Als reine Funktion lässt er sich für JEDE Sprache erzeugen, und damit kann
 * `buildOfferLanguageRebasePlan` sagen, was ein Sprachwechsel aus ihm machen
 * würde. Nebenbei ist er dadurch prüfbar.
 *
 * `nach`/`from…to` kommt aus dem Katalog, nicht aus einem Literal: ein „→" im
 * Titel überlebt die PDF-Schrift nicht zuverlässig.
 */
const OFFER_TITLE_KEY_BY_SERVICE: Record<string, MessageKey> = {
  // Umzug
  umzug: "offer.doc.title.umzug",
  umzug_privat: "offer.doc.title.umzug_privat",
  umzug_buero: "offer.doc.title.umzug_buero",
  umzug_firmen: "offer.doc.title.umzug_firmen",

  // Reinigung
  reinigung: "offer.doc.title.reinigung",
  reinigung_end: "offer.doc.title.reinigung_end",
  reinigung_bau: "offer.doc.title.reinigung_bau",
  reinigung_unterhalts: "offer.doc.title.reinigung_unterhalts",
  reinigung_glas: "offer.doc.title.reinigung_glas",
  reinigung_fassade: "offer.doc.title.reinigung_fassade",
  reinigung_teppich: "offer.doc.title.reinigung_teppich",
  reinigung_praxis: "offer.doc.title.reinigung_praxis",
  cleaning: "offer.doc.title.reinigung",

  // Räumung / Entsorgung
  raeumung: "offer.doc.title.raeumung",
  raeumung_haushalt: "offer.doc.title.raeumung_haushalt",
  raeumung_todesfall: "offer.doc.title.raeumung_todesfall",
  raeumung_messie: "offer.doc.title.raeumung_messie",
  raeumung_zwang: "offer.doc.title.raeumung_zwang",
  entsorgung: "offer.doc.title.entsorgung",
  entrümpelung: "offer.doc.title.entruempelung",

  // Lagerung
  lagerung: "offer.doc.title.lagerung",
  storage: "offer.doc.title.lagerung",

  // Spezialtransporte
  klaviertransport: "offer.doc.title.klaviertransport",
  piano: "offer.doc.title.klaviertransport",
  klavier: "offer.doc.title.klaviertransport",

  // Möbellift
  moebellift: "offer.doc.title.moebellift",
  moebellift_mieten: "offer.doc.title.moebellift_mieten",
  lift: "offer.doc.title.moebellift",

  // Möbeltransport
  moebeltransport: "offer.doc.title.moebeltransport",
  furniture: "offer.doc.title.moebeltransport",

  // Malerarbeiten
  maler: "offer.doc.title.maler",
  malerarbeit: "offer.doc.title.maler",
  painting: "offer.doc.title.maler",
};

export interface OfferTitleQuelle {
  service_type?: string | null;
  from_city?: string | null;
  to_city?: string | null;
}

export const buildOfferTitle = (locale: Locale, quelle: OfferTitleQuelle): string => {
  const t = documentI18nFor(locale).t;
  const rohService = quelle.service_type ?? "";
  const titleKey =
    OFFER_TITLE_KEY_BY_SERVICE[rohService] ??
    OFFER_TITLE_KEY_BY_SERVICE[rohService.toLowerCase()] ??
    "offer.doc.title.default";
  const basis = t(titleKey);

  // Umzug mit beiden Orten: „… Zürich nach Bern".
  if (rohService.includes("umzug") && quelle.from_city && quelle.to_city) {
    return t("offer.doc.title.route", { base: basis, from: quelle.from_city, to: quelle.to_city });
  }
  if (quelle.from_city) {
    return t("offer.doc.title.inCity", { base: basis, city: quelle.from_city });
  }
  return basis;
};
