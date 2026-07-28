/**
 * Wiki chrome only — headings, buttons, labels around the content.
 *
 * The article prose itself does NOT live here. It lives in lazily loaded modules under
 * src/features/wiki/content/, because the catalogs are eagerly imported and a manual's
 * worth of text in the entry chunk would be paid for on every cold load, by every
 * operator, in all three languages.
 */
export const wiki = {
  "wiki.title": "Hilfe & Anleitung",
  "wiki.subtitle": "Schritt für Schritt durch Ihren Arbeitstag.",

  // --- Suche -----------------------------------------------------------------------
  "wiki.search.label": "Hilfe durchsuchen",
  "wiki.search.placeholder": "Wonach suchen Sie? Zum Beispiel: Offerte senden",
  "wiki.search.clear": "Suche zurücksetzen",
  "wiki.search.noResults": "Dazu haben wir noch keine Anleitung.",
  "wiki.search.noResultsHint": "Versuchen Sie ein anderes Wort, zum Beispiel «Rechnung» statt «Faktura».",
  "wiki.search.results": "{count} Anleitungen gefunden",
  "wiki.search.results#one": "{count} Anleitung gefunden",
  "wiki.search.results#other": "{count} Anleitungen gefunden",

  // --- Startseite ------------------------------------------------------------------
  "wiki.home.startHere": "Hier starten",
  "wiki.home.startHereHint": "Neu im System? Diese Anleitungen führen Sie durch die ersten Schritte.",
  "wiki.home.tasks": "Was möchten Sie tun?",
  "wiki.home.categories": "Alle Bereiche",
  "wiki.home.daily": "Für jeden Tag",
  "wiki.home.articleCount": "{count} Anleitungen",
  "wiki.home.articleCount#one": "{count} Anleitung",
  "wiki.home.articleCount#other": "{count} Anleitungen",

  // --- Kategorien ------------------------------------------------------------------
  "wiki.category.start": "Hier starten",
  "wiki.category.anfragen-kunden": "Anfragen, Kunden und Verkauf",
  "wiki.category.offerten": "Offerten und Zusage des Kunden",
  "wiki.category.planung": "Planung und Ausführung",
  "wiki.category.finanzen": "Rechnungen, Quittungen und Zahlungen",
  "wiki.category.service-kommunikation": "Kundendienst und Kommunikation",
  "wiki.category.berichte": "Auswertungen und Tageskontrolle",
  "wiki.category.einrichtung": "Einrichtung und Verwaltung",
  "wiki.category.kundensicht": "Was der Kunde sieht",
  "wiki.category.glossar": "Begriffe und Status",

  // --- Artikelabschnitte -----------------------------------------------------------
  "wiki.section.purpose": "Wofür ist das da?",
  "wiki.section.whenToUse": "Wann brauchen Sie das?",
  "wiki.section.beforeYouBegin": "Bevor Sie beginnen",
  "wiki.section.whatHappensNext": "Was passiert danach?",
  "wiki.section.commonMistakes": "Häufige Fehler",
  "wiki.section.ifSomethingGoesWrong": "Wenn etwas nicht klappt",
  "wiki.section.related": "Passende Anleitungen",
  "wiki.section.contents": "Inhalt dieser Seite",

  // --- Navigation ------------------------------------------------------------------
  "wiki.nav.breadcrumbHome": "Hilfe & Anleitung",
  "wiki.nav.breadcrumb": "Sie sind hier",
  "wiki.nav.previous": "Vorherige Anleitung",
  "wiki.nav.next": "Nächste Anleitung",
  "wiki.nav.backToHome": "Zurück zur Übersicht",
  "wiki.nav.openScreen": "Diese Seite im CRM öffnen",
  "wiki.nav.print": "Anleitung drucken",

  // --- Bilder ----------------------------------------------------------------------
  "wiki.figure.zoom": "Bild vergrössern",
  "wiki.figure.zoomHint": "Zum Vergrössern klicken",
  "wiki.figure.close": "Bild schliessen",
  "wiki.figure.legend": "Erklärung zum Bild",

  // --- Hinweiskästen ---------------------------------------------------------------
  "wiki.callout.tip": "Tipp",
  "wiki.callout.warning": "Achtung",
  "wiki.callout.danger": "Nicht umkehrbar",
  "wiki.callout.permission": "Berechtigung nötig",

  // --- Statustabelle ---------------------------------------------------------------
  "wiki.status.title": "Was die Status bedeuten",
  "wiki.status.header.status": "Status",
  "wiki.status.header.meaning": "Bedeutung",
  "wiki.status.header.next": "Ihr nächster Schritt",

  // --- Zustände --------------------------------------------------------------------
  "wiki.state.loading": "Anleitung wird geladen …",
  "wiki.state.errorTitle": "Anleitung konnte nicht geladen werden",
  "wiki.state.errorHint": "Bitte laden Sie die Seite neu.",
  "wiki.state.retry": "Erneut versuchen",
  "wiki.state.notFoundTitle": "Diese Anleitung gibt es nicht",
  "wiki.state.notFoundHint": "Vielleicht hat sich die Adresse geändert. Suchen Sie in der Übersicht.",

  // --- Fusszeile -------------------------------------------------------------------
  "wiki.meta.lastVerified": "Zuletzt geprüft am {date}",
  "wiki.kind.reference": "Bildschirm erklärt",
  "wiki.kind.journey": "Ablauf über mehrere Schritte",
} as const;
