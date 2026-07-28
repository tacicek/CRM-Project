import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftraege-liste",
  locale: "de",
  title: "Die Auftragsliste",
  summary: "Alle Einsätze mit Datum, Team und Status — und was Sie je Auftrag tun können.",

  purpose:
    "Ein Auftrag ist die zugesagte Arbeit: wer, wann, wo. Die Liste zeigt alle Einsätze und ist der Ort, an dem Sie sie abschliessen und abrechnen.",

  whenToUse: [
    "Am Morgen, um die Einsätze des Tages zu sehen.",
    "Sie möchten wissen, welcher Auftrag überfällig ist.",
    "Ein Einsatz ist erledigt und soll abgeschlossen werden.",
    "Nach dem Abschluss möchten Sie Rechnung oder Quittung erstellen.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/auftraege-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Auftragsliste mit vier Kacheln, Reitern und der Tabelle.",
      alt: "Auftragsliste mit den Kacheln Heute, Morgen, Geplant und Abgeschlossen, darunter Reiter und eine Tabelle mit Auftrag, Kunde, Datum und Zeit, Team und Status.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Vier Kacheln: heute, morgen, geplant, abgeschlossen." },
        { n: 2, xPct: 35, yPct: 34, label: "Reiter zum Eingrenzen." },
        { n: 3, xPct: 80, yPct: 52, label: "Statusspalte." },
        { n: 4, xPct: 95, yPct: 52, label: "Das Menü mit den drei Punkten — hier passiert alles." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Die Zeile selbst ist nicht anklickbar",
      text: "Es gibt keine eigene Auftragsseite. Jede Aktion läuft über das Menü mit den drei Punkten rechts.",
    },
    {
      kind: "heading",
      id: "status",
      text: "Die fünf Status",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Geplant", meaning: "Termin steht, noch nicht bestätigt.", next: "Team zuweisen, bestätigen." },
        { status: "Bestätigt", meaning: "Fest eingeplant.", next: "Am Einsatztag durchführen." },
        { status: "In Bearbeitung", meaning: "Läuft gerade.", next: "Nach Abschluss «Abschliessen …»." },
        { status: "Abgeschlossen", meaning: "Erledigt. Endstation — kein Zurück.", next: "Rechnung oder Quittung erstellen." },
        { status: "Storniert", meaning: "Abgesagt.", next: "Bei Bedarf reaktivieren." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Bestätigt und Abgeschlossen sehen gleich aus",
      text: "Beide Marken sind grün. Lesen Sie den Text, nicht die Farbe.",
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Reiter und Suche",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Alle», «Heute», «Morgen», «Geplant» und «Erledigt» — jeder mit Anzahl.",
        "«Geplant» umfasst geplante und bestätigte Aufträge.",
        "Stornierte Aufträge finden Sie nur unter «Alle» — dafür gibt es keinen eigenen Reiter.",
        "Die Suche prüft Titel, Kundenname, Auftragsnummer und beide Adressen.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Überfällige Aufträge",
      text: "Liegt das Datum in der Vergangenheit und ist der Auftrag weder abgeschlossen noch storniert, erscheint oben ein roter Hinweis und in der Zeile die Marke «Überfällig».",
    },
    {
      kind: "heading",
      id: "menue",
      text: "Das Menü mit den drei Punkten",
    },
    {
      kind: "statusTable",
      headers: { status: "Eintrag", meaning: "Was er tut", next: "Sichtbar wann" },
      rows: [
        { status: "Bearbeiten", meaning: "Öffnet den Auftrag zum Ändern.", next: "Immer." },
        { status: "Kundenkarte", meaning: "Führt zur Kundenkarte.", next: "Wenn ein Kunde verknüpft ist." },
        { status: "PDF herunterladen", meaning: "Auftragsblatt fürs Team.", next: "Immer." },
        { status: "Offerte anzeigen", meaning: "Öffnet die Offerte in neuem Tab.", next: "Wenn eine verknüpft ist." },
        { status: "Abschliessen …", meaning: "Öffnet das Abschlussfenster.", next: "Solange nicht abgeschlossen." },
        { status: "Rechnung erstellen", meaning: "Startet eine Rechnung.", next: "Nur bei «Abgeschlossen»." },
        { status: "Quittung erstellen", meaning: "Startet eine Quittung.", next: "Immer." },
        { status: "Stornieren", meaning: "Setzt den Auftrag auf storniert.", next: "Wenn erlaubt." },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "«Archivieren» heisst im Bestätigungsfenster «Löschen»",
      text: "Der Auftrag verschwindet aus der Liste, bleibt aber für die Nachvollziehbarkeit gespeichert. Rückgängig machen können Sie es hier nicht.",
    },
    {
      kind: "heading",
      id: "doppelt",
      text: "Nicht doppelt abrechnen",
    },
    {
      kind: "paragraph",
      text: "Zu einem Auftrag können sowohl eine Quittung als auch eine Rechnung entstehen. Das Menü warnt Sie: bereits vorhandene Belege stehen dort als «Rechnung bereits erstellt» oder «Weitere Quittung (bereits vorhanden)».",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Rechnung braucht eine IBAN",
      text: "Fehlt die IBAN in den Einstellungen, meldet das Programm «IBAN fehlt» und erstellt keine QR-Rechnung.",
    },
  ],

  whatHappensNext: [
    "«Abschliessen …» setzt den Auftrag auf «Abgeschlossen» und schaltet «Rechnung erstellen» frei.",
    "Eine Rechnung entsteht dabei nicht von selbst — das ist ein eigener Schritt.",
    "Wird der zugehörige Termin im Kalender abgesagt, wechselt der Auftrag automatisch auf «Storniert».",
  ],

  commonMistakes: [
    "Auf einen Betrag in der Liste warten. Es gibt keine Geldspalte — Beträge stehen im Auftrag selbst.",
    "Einen stornierten Auftrag unter «Geplant» suchen. Er steht nur unter «Alle».",
    "Nach dem Abschliessen den Status zurücksetzen wollen. «Abgeschlossen» ist eine Endstation.",
  ],

  ifSomethingGoesWrong: [
    "«Ungültiger Statuswechsel»: Der gewünschte Schritt ist von diesem Status aus nicht erlaubt.",
    "«Daten konnten nicht validiert werden»: Der gespeicherte Datensatz ist beschädigt; Bearbeiten und PDF sind gesperrt. Melden Sie den Auftrag.",
    "«Rechnung erstellen» fehlt: Der Auftrag ist noch nicht abgeschlossen.",
  ],
} satisfies WikiArticleBody;

export default body;
