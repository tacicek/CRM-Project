import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender",
  locale: "de",
  title: "Der Kalender",
  summary: "Alle Termine im Blick — Ansichten, Filter, Verschieben und die Teamwoche.",

  purpose:
    "Im Kalender stehen Besichtigungen, Einsätze und interne Termine nebeneinander. Sie planen hier, verschieben und sehen, wer wann gebucht ist.",

  whenToUse: [
    "Sie planen die kommende Woche.",
    "Ein Termin muss verschoben werden.",
    "Sie möchten wissen, wer am Donnerstag frei ist.",
    "Ein erledigter Termin taucht nicht mehr auf.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kalender-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Wochenansicht mit Terminen in den Farben der zugewiesenen Personen.",
      alt: "Wochenansicht des Kalenders mit farbigen Terminblöcken, oben die Umschalter für Ansicht und Team, die Ansichten Monat, Woche, Tag und Liste sowie der Filter mit Marken für die Termintypen.",
      hotspots: [
        { n: 1, xPct: 24, yPct: 18, label: "Ansicht oder Teamwoche." },
        { n: 2, xPct: 41, yPct: 18, label: "Monat, Woche, Tag oder Liste." },
        { n: 3, xPct: 55, yPct: 18, label: "Filter — hier steht eine Zahl." },
        { n: 4, xPct: 40, yPct: 70, label: "Ein Termin. Die Farbe kommt von der zugewiesenen Person." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Erledigte und abgesagte Termine sind ausgeblendet",
      text: "Der Kalender zeigt beim Öffnen nur «Ausstehend» und «Bestätigt». Wer einen erledigten Termin sucht, muss ihn im Filter erst einschalten. Das ist der häufigste Grund für «mein Termin ist weg».",
    },
    {
      kind: "heading",
      id: "ansichten",
      text: "Die Ansichten",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Monat» — der Überblick, aber ohne Uhrzeiten.",
        "«Woche» — die Arbeitsansicht mit Zeitraster. Am nützlichsten für die Planung.",
        "«Tag» — ein Tag im Detail.",
        "«Liste» — alle kommenden Termine untereinander.",
        "«Team» — die Wochenübersicht pro Person mit Stundenzahl.",
      ],
    },
    {
      kind: "heading",
      id: "filter",
      text: "Filtern",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf «Filter».",
          note: "Die Zahl daneben zeigt, wie viele Einschränkungen aktiv sind.",
        },
        {
          text: "Unter «Termin-Typ» wählen Sie Besichtigung, Dienstleistung, Nachfassen, Besprechung oder Blockiert.",
        },
        {
          text: "Unter «Status» schalten Sie «Abgeschlossen» und «Abgesagt» dazu, wenn Sie Vergangenes sehen möchten.",
        },
        {
          text: "Unter «Team» grenzen Sie auf einzelne Personen ein.",
          note: "Aktive Filter erscheinen als Marken neben der Schaltfläche; ein Klick auf das «×» entfernt sie.",
        },
      ],
    },
    {
      kind: "heading",
      id: "typen",
      text: "Die Termintypen",
    },
    {
      kind: "statusTable",
      headers: { status: "Typ", meaning: "Wofür", next: "Besonderheit" },
      rows: [
        { status: "Besichtigung", meaning: "Vor-Ort-Termin beim Kunden.", next: "—" },
        { status: "Dienstleistung", meaning: "Der eigentliche Einsatz.", next: "Nur hier gibt es Fahrzeuge und Ausrüstung." },
        { status: "Nachfassen", meaning: "Erinnerung, sich zu melden.", next: "—" },
        { status: "Besprechung", meaning: "Intern.", next: "Es geht keine Bestätigung an Kunden." },
        { status: "Blockiert", meaning: "Zeit ist nicht verfügbar.", next: "Ohne Kundendaten." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Die Farbe zeigt die Person, nicht den Typ",
      text: "Sobald jemand zugewiesen ist, erhält der Termin dessen Farbe. Nur unbesetzte Termine tragen die Farbe ihres Typs.",
    },
    {
      kind: "heading",
      id: "verschieben",
      text: "Termine verschieben",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ziehen Sie einen Termin mit der Maus auf einen anderen Tag oder eine andere Zeit.",
          note: "Datum und Uhrzeit werden sofort gespeichert.",
        },
        {
          text: "Ziehen Sie am unteren Rand, um die Dauer zu ändern.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Beim Ziehen wird nicht auf Konflikte geprüft",
      text: "Sie können eine Person unbemerkt doppelt verplanen. Prüfen Sie nach dem Verschieben in der Teamwoche, ob es passt.",
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Bestätigen, erledigen, absagen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie einen Termin an — rechts erscheint die Detailkarte.",
        },
        {
          text: "«Bestätigen» setzt einen ausstehenden Termin auf bestätigt.",
        },
        {
          text: "«Erledigt» schliesst einen bestätigten Termin ab.",
        },
        {
          text: "«Absagen» sagt ihn ab; bei einer Serie fragt das Programm, ob nur dieser oder die ganze Serie.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Diese drei Schaltflächen benachrichtigen niemanden",
      text: "Bestätigen, Erledigt und Absagen ändern nur den Status. Es geht keine E-Mail und keine SMS an die Kundschaft — informieren Sie sie selbst.",
    },
    {
      kind: "paragraph",
      text: "Über «Zum Kalender» in der Detailkarte geben Sie einen einzelnen Termin an Apple, Yahoo oder als Datei weiter. Einen Export der ganzen Woche gibt es nicht.",
    },
  ],

  whatHappensNext: [
    "Verschobene Termine sind sofort für das ganze Team sichtbar.",
    "Ein abgesagter Termin verschwindet aus der Ansicht, solange «Abgesagt» im Filter nicht gesetzt ist.",
    "Wird der Termin eines Auftrags abgesagt, wechselt der Auftrag auf «Storniert».",
  ],

  commonMistakes: [
    "Einen erledigten Termin suchen, ohne den Statusfilter zu erweitern.",
    "Annehmen, «Absagen» informiere die Kundschaft. Das tut es nicht.",
    "Nach dem Ziehen nicht auf Doppelbelegungen prüfen.",
  ],

  ifSomethingGoesWrong: [
    "Ein Termin fehlt: Erweitern Sie im Filter den Status oder prüfen Sie den Typfilter.",
    "«Fehler beim Verschieben»: Der Termin springt zurück. Laden Sie die Seite neu und versuchen Sie es erneut.",
    "Ein Termin liegt doppelt: Öffnen Sie die Teamwoche, um die Belegung zu prüfen, und verschieben Sie einen davon.",
  ],
} satisfies WikiArticleBody;

export default body;
