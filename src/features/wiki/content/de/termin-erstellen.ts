import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "termin-erstellen",
  locale: "de",
  title: "Einen Termin erstellen",
  summary: "Typ, Zeit, Team und Fahrzeuge — und wann die Kundschaft eine Bestätigung erhält.",

  purpose:
    "Hier legen Sie einen Termin an: eine Besichtigung, einen Einsatz, eine Nachfassaktion oder eine blockierte Zeit.",

  whenToUse: [
    "Sie vereinbaren telefonisch eine Besichtigung.",
    "Ein Einsatz braucht Fahrzeug und Ausrüstung.",
    "Sie möchten Ferien oder eine Pause blockieren.",
    "Sie möchten sich erinnern lassen, bei einer Offerte nachzufassen.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/termin-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Terminfenster mit der Typauswahl und den Zeitfeldern.",
      alt: "Fenster für einen neuen Termin mit fünf Schaltflächen für den Termin-Typ, dem Titelfeld, der Statusauswahl sowie Datum, Start und Ende.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 30, label: "Der Termin-Typ bestimmt, welche Felder erscheinen." },
        { n: 2, xPct: 50, yPct: 47, label: "Titel — das einzige Pflichtfeld." },
        { n: 3, xPct: 50, yPct: 62, label: "Datum, Start und Ende." },
      ],
    },
    {
      kind: "heading",
      id: "oeffnen",
      text: "Drei Wege zum Fenster",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Neuer Termin» oben rechts — mit dem heutigen Datum.",
        "Rechtsklick auf einen Tag im Kalender — mit diesem Datum.",
        "Aus einer Anfrage oder Offerte über «Termin planen» — mit vorbereiteten Angaben.",
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Das Fenster ausfüllen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Wählen Sie oben den «Termin-Typ».",
          note: "Bei «Blockiert» verschwinden die Kundenfelder — dort brauchen Sie keine.",
        },
        {
          text: "Tragen Sie einen «Titel» ein.",
          note: "Das ist das einzige Pflichtfeld. Alles andere ist freiwillig.",
        },
        {
          text: "Setzen Sie «Datum», «Start» und «Ende».",
          note: "Mindestens 15 Minuten, höchstens 12 Stunden. Bei «Ganztägig» entfallen die Zeiten.",
        },
        {
          text: "Übernehmen Sie unter «Kunde» die Angaben aus einer Anfrage oder tippen Sie sie ein.",
        },
        {
          text: "Weisen Sie unter «Team zuweisen» die Personen zu.",
          note: "Nur beim Typ «Dienstleistung» erscheinen zusätzlich «Fahrzeuge» und «Ausrüstung».",
        },
        {
          text: "Klicken Sie auf «Erstellen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Konflikte werden angezeigt, aber nicht blockiert",
      text: "Ist eine Person oder ein Fahrzeug zur selben Zeit schon verplant, erscheint ein roter Hinweis «Ressourcenkonflikt!» mit den betroffenen Terminen. Speichern können Sie trotzdem — die Entscheidung bleibt bei Ihnen.",
    },
    {
      kind: "heading",
      id: "benachrichtigung",
      text: "Wann die Kundschaft etwas erfährt",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "Wird gesendet?", next: "Was Sie tun sollten" },
      rows: [
        { status: "Neuer Termin, Typ Besichtigung oder Dienstleistung", meaning: "Ja, eine Bestätigung per E-Mail.", next: "Nichts weiter." },
        { status: "Neuer Termin, Typ Besprechung oder Blockiert", meaning: "Nein.", next: "Interne Termine brauchen das nicht." },
        { status: "Termin bearbeitet oder verschoben", meaning: "Nein.", next: "Kundschaft selbst informieren." },
        { status: "Termin abgesagt", meaning: "Nein.", next: "Kundschaft selbst informieren." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Verschieben ist still",
      text: "Ändern Sie Datum oder Zeit, erfährt die Kundschaft davon nichts. Rufen Sie an oder schreiben Sie — das Programm tut es nicht für Sie.",
    },
    {
      kind: "heading",
      id: "wiederkehrend",
      text: "Wiederkehrende Termine",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Setzen Sie beim Anlegen den Haken bei «Wiederkehrend».",
          note: "Dann wählen Sie täglich, wöchentlich, alle zwei Wochen oder monatlich und ein Enddatum.",
        },
        {
          text: "Beim Speichern entsteht die ganze Serie auf einmal.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Die Wiederholung lässt sich später nicht ändern",
      text: "Sie können sie nur beim Anlegen setzen. Stimmt sie nicht, sagen Sie die Serie ab und legen Sie eine neue an.",
    },
    {
      kind: "paragraph",
      text: "Erinnerungen an die Kundschaft laufen unabhängig davon automatisch. Was und wann erinnert wird, stellen Sie unter «Einstellungen» ein — im Terminfenster gibt es dafür kein Feld.",
    },
  ],

  whatHappensNext: [
    "Der Termin erscheint sofort im Kalender in der Farbe der zugewiesenen Person.",
    "Bei Besichtigung und Dienstleistung erhält die Kundschaft eine Bestätigung per E-Mail.",
    "Erinnerungen versendet das Programm später von selbst, gemäss Ihren Einstellungen.",
  ],

  commonMistakes: [
    "Einen Termin verschieben und annehmen, die Kundschaft werde informiert.",
    "Den Konflikthinweis übersehen und dieselbe Person doppelt verplanen.",
    "Fahrzeuge bei einer Besichtigung suchen. Die gibt es nur beim Typ «Dienstleistung».",
  ],

  ifSomethingGoesWrong: [
    "«Bitte geben Sie einen Titel ein»: Das Titelfeld ist leer.",
    "«Endzeit muss nach Startzeit liegen»: Start und Ende sind vertauscht.",
    "«Termin erstellt, aber keine Kunden-E-Mail vorhanden»: Der Termin steht, nur die Bestätigung ging nicht — tragen Sie die Adresse nach und informieren Sie die Kundschaft selbst.",
  ],
} satisfies WikiArticleBody;

export default body;
