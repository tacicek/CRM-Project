import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";

/**
 * The searchable stub of every German article.
 *
 * Kept separate from the bodies so search works before any article has been fetched: a
 * whole locale's index is a few kilobytes, while the bodies are the bulk of the manual.
 *
 * `keywords` should include the words a reader would type INSTEAD of the title —
 * especially the labels of the buttons the article explains, and the word they used at
 * their previous employer. Search also expands common synonyms on its own, so
 * "Angebot" already finds "Offerte" without being listed here.
 */
const index: WikiSearchIndex = {
  "start-hier": {
    title: "Hier starten",
    summary: "Was dieses Programm für Sie tut und in welcher Reihenfolge Sie arbeiten.",
    keywords: ["start", "beginn", "einführung", "erste schritte", "überblick", "neu", "einarbeitung", "grundlagen"],
  },
  "anmelden-abmelden": {
    title: "Anmelden und abmelden",
    summary: "Wie Sie sich anmelden, ein vergessenes Passwort zurücksetzen und sich sicher abmelden.",
    keywords: ["anmelden", "abmelden", "login", "logout", "passwort", "passwort vergessen", "zugang", "einloggen", "reset"],
  },
  "dashboard-uebersicht": {
    title: "Die Übersicht",
    summary: "Ihre Startseite: neue Anfragen, offene Offerten und die Termine von heute.",
    keywords: ["übersicht", "startseite", "dashboard", "kacheln", "kennzahlen", "heute", "letzte anfragen", "home"],
  },
  "navigation-und-benachrichtigungen": {
    title: "Menü, Kopfzeile und Benachrichtigungen",
    summary: "Wie Sie sich im Programm bewegen und wo Sie Hinweise auf Neuigkeiten finden.",
    keywords: ["menü", "seitenleiste", "navigation", "kopfzeile", "glocke", "benachrichtigung", "hinweise", "ton", "push", "handy", "mobil"],
  },
  "sprache-dashboard-vs-dokument": {
    title: "Zwei Sprachen: Ihre und die der Kundschaft",
    summary: "Warum Sie auf Deutsch arbeiten und die Kundschaft trotzdem Französisch liest.",
    keywords: ["sprache", "deutsch", "französisch", "englisch", "übersetzung", "dokumentsprache", "umstellen", "landessprache"],
  },
  "typischer-arbeitstag": {
    title: "Ein typischer Arbeitstag",
    summary: "Eine kurze Liste, was Sie morgens, tagsüber und am Abend prüfen.",
    keywords: ["arbeitstag", "ablauf", "routine", "checkliste", "morgens", "abends", "täglich", "reihenfolge"],
  },
  "rollen-und-rechte": {
    title: "Rollen und Rechte",
    summary: "Wer darf was: Inhaber, Admin und Mitarbeiter im Vergleich.",
    keywords: ["rolle", "rechte", "berechtigung", "inhaber", "admin", "mitarbeiter", "gesperrt", "darf nicht", "zusammenführen"],
  },
  "kunden-liste": {
    title: "Die Kundenliste",
    summary: "Alle Kundinnen und Kunden an einem Ort — suchen, filtern und öffnen.",
    keywords: ["kunden", "kundenliste", "kontakte", "suchen", "dublette", "duplikat", "firma", "offener betrag"],
  },
  "kundenkarte": {
    title: "Die Kundenkarte",
    summary: "Alles zu einer Kundin: Kontakt, Adresse, Vorgänge, Beträge, Verlauf, Einsatzorte und Portalzugang.",
    keywords: ["kundenkarte", "kunde öffnen", "kunde bearbeiten", "adresse", "anschrift", "rechnungsadresse", "einsatzort", "stockwerk", "lift", "verlauf", "notiz", "zusammenführen", "portal", "fakturiert", "bezahlt"],
  },
  "finanzen-uebersicht": {
    title: "Finanzen: was offen ist und was hereinkam",
    summary: "Offene Posten und Zahlungseingänge an einem Ort — inklusive Storno.",
    keywords: ["finanzen", "offene posten", "zahlungseingang", "kassiert", "überfällig", "storno", "stornieren", "zahlungsbuch"],
  },
  "zahlung-erfassen": {
    title: "Eine Zahlung erfassen",
    summary: "Voll, teilweise oder zu viel — und wie Sie einen Fehler korrigieren.",
    keywords: ["zahlung erfassen", "zahlungseingang", "teilzahlung", "überzahlung", "twint", "bar", "banküberweisung", "storno", "eingang buchen"],
  },
  "rechnungen-liste": {
    title: "Die Rechnungsliste",
    summary: "Alle Rechnungen mit Status, Filter, PDF und den Löschregeln.",
    keywords: ["rechnungen", "rechnungsliste", "status", "entwurf", "versendet", "überfällig", "pdf", "löschen"],
  },
  "rechnung-erstellen": {
    title: "Eine Rechnung schreiben und senden",
    summary: "Vom leeren Formular über den QR-Zahlteil bis zum Versand per E-Mail.",
    keywords: ["rechnung erstellen", "neue rechnung", "qr rechnung", "positionen", "mwst", "fällig", "senden", "iban"],
  },
  "offerten-liste": {
    title: "Die Offertenliste",
    summary: "Alle Angebote mit Status, Filtern und den Aktionen je Zeile.",
    keywords: ["offerten", "angebote", "offertenliste", "status", "ausstehend", "angenommen", "erneut senden", "blind"],
  },
  "offerte-erstellen": {
    title: "Eine Offerte schreiben",
    summary: "Von der Anfrage zur fertigen Offerte: Positionen, Preismodell, Konditionen, senden.",
    keywords: ["offerte erstellen", "angebot schreiben", "positionen", "preismodell", "pauschal", "stundenansatz", "kostendach", "agb", "senden"],
  },
  "offerte-detail": {
    title: "Die Offerte im Detail",
    summary: "Positionen, Verlauf, Kundenlink und die Aktionen je nach Status.",
    keywords: ["offerte detail", "kundenlink", "aktivitäten", "angesehen", "vorschau", "auftrag erstellen", "pdf"],
  },
  "offerte-bearbeiten": {
    title: "Eine Offerte bearbeiten",
    summary: "Entwürfe ändern — und warum gesendete Offerten sich sperren.",
    keywords: ["offerte bearbeiten", "entwurf ändern", "gesperrt", "versendet", "nicht bearbeitbar"],
  },
  "offerte-version": {
    title: "Eine neue Version einer Offerte",
    summary: "Wenn sich nach dem Senden noch etwas ändert — und wie Sie die Fassungen auseinanderhalten.",
    keywords: ["neue version", "version", "fassung", "überholt", "nachträglich ändern", "revision"],
  },
  "nachtrag": {
    title: "Ein Nachtrag zu einer Offerte",
    summary: "Zusätzliche Leistungen nach der Zusage — mit eigener Zustimmung der Kundschaft.",
    keywords: ["nachtrag", "zusatzleistung", "ergänzung", "zustimmung", "angenommen", "kundenlink"],
  },
  "anfragen-liste": {
    title: "Die Anfragenliste",
    summary: "Alle eingegangenen Anfragen, nach Service gruppiert — und der Weg zur Offerte.",
    keywords: ["anfragen", "leads", "anfragenliste", "reiter", "offeriert", "verkaufsstufe", "suchen", "löschen"],
  },
  "anfrage-details": {
    title: "Eine Anfrage ansehen und korrigieren",
    summary: "Alle Angaben lesen — und falsch erkannte Felder richtigstellen.",
    keywords: ["anfrage details", "anfrage bearbeiten", "korrigieren", "sprache des kunden", "plz", "adresse ändern"],
  },
  "anfrage-importieren": {
    title: "Eine Anfrage selbst erfassen",
    summary: "Text einfügen oder diktieren — die Auswertung füllt die Felder, Sie prüfen sie.",
    keywords: ["anfrage erfassen", "neue anfrage", "import", "spracheingabe", "diktieren", "ki", "extrahieren", "plz"],
  },
  "email-eingang": {
    title: "Den E-Mail-Eingang prüfen",
    summary: "Automatisch ausgewertete Kundenmails prüfen, korrigieren und übernehmen.",
    keywords: ["e-mail eingang", "posteingang mails", "zu prüfen", "übernehmen", "ablehnen", "erneut verarbeiten", "sicherheit"],
  },
  "auftraege-liste": {
    title: "Die Auftragsliste",
    summary: "Alle Einsätze mit Datum, Team und Status — und was Sie je Auftrag tun können.",
    keywords: ["aufträge", "auftragsliste", "einsatz", "überfällig", "abschliessen", "archivieren", "team"],
  },
  "auftrag-abschliessen": {
    title: "Einen Auftrag planen und abschliessen",
    summary: "Team zuweisen, Preis festlegen, abschliessen — und danach abrechnen.",
    keywords: ["auftrag abschliessen", "team zuweisen", "stunden erfassen", "nach aufwand", "festpreis", "endpreis"],
  },
  "kalender": {
    title: "Der Kalender",
    summary: "Alle Termine im Blick — Ansichten, Filter, Verschieben und die Teamwoche.",
    keywords: ["kalender", "termine", "woche", "monat", "filter", "verschieben", "teamwoche", "ics"],
  },
  "termin-erstellen": {
    title: "Einen Termin erstellen",
    summary: "Typ, Zeit, Team und Fahrzeuge — und wann die Kundschaft eine Bestätigung erhält.",
    keywords: ["termin erstellen", "neuer termin", "besichtigung", "blockiert", "wiederkehrend", "fahrzeug", "konflikt"],
  },
  "kalender-abo": {
    title: "Kalender abonnieren",
    summary: "Ihre Termine im Handy- oder Computer-Kalender abonnieren — je Termin-Typ ein eigener, farbiger Kalender.",
    keywords: ["kalender abonnieren", "abo", "webcal", "iphone", "apple", "google", "outlook", "handy", "token erzeugen", "widerrufen", "synchronisieren", "kalender verbinden"],
  },
};

export default index;
