import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "dashboard-uebersicht",
  locale: "de",
  title: "Die Übersicht",
  summary: "Ihre Startseite: neue Anfragen, offene Offerten und die Termine von heute.",

  purpose:
    "Die Übersicht zeigt auf einen Blick, was heute Ihre Aufmerksamkeit braucht. Sie ist der beste Startpunkt für den Arbeitstag.",

  whenToUse: [
    "Am Morgen, um den Tag zu planen.",
    "Nach der Mittagspause, um neue Anfragen zu sehen.",
    "Wenn Sie wissen möchten, auf wie viele Offerten noch keine Antwort kam.",
    "Wenn Sie schnell zu einer anderen Seite springen möchten.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/dashboard-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Übersicht mit den vier Kennzahlen, den heutigen Terminen und den letzten Anfragen.",
      alt: "Startseite des Programms. Oben vier Kacheln mit Zahlen für neue Anfragen, offene Offerten, Aufträge diesen Monat und Besichtigungen. Darunter die Termine von heute und eine Liste der letzten Anfragen.",
      hotspots: [
        { n: 1, xPct: 28, yPct: 25, label: "Vier Kacheln mit den wichtigsten Zahlen." },
        { n: 2, xPct: 45, yPct: 45, label: "Die Termine von heute." },
        { n: 3, xPct: 45, yPct: 78, label: "Die zuletzt eingegangenen Anfragen." },
        { n: 4, xPct: 85, yPct: 62, label: "Hinweis auf neue Anfragen und Schnellzugriff." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-kacheln",
      text: "Die vier Kacheln",
    },
    {
      kind: "statusTable",
      headers: { status: "Kachel", meaning: "Was die Zahl bedeutet", next: "Ihr nächster Schritt" },
      rows: [
        {
          status: "Neue Anfragen",
          meaning: "Anfragen, zu denen es noch keine Offerte gibt.",
          next: "Offerte schreiben oder Besichtigung vereinbaren.",
        },
        {
          status: "Offene Offerten",
          meaning: "Gesendete Offerten, auf die die Kundschaft noch nicht geantwortet hat.",
          next: "Bei älteren Offerten nachfassen.",
        },
        {
          status: "Aufträge diesen Monat",
          meaning: "Geplante Einsätze im laufenden Monat.",
          next: "Im Kalender prüfen, ob Team und Fahrzeug eingeteilt sind.",
        },
        {
          status: "Besichtigungen",
          meaning: "Besichtigungen vor der Auftragserteilung.",
          next: "Termin bestätigen oder Ergebnis erfassen.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Jede Kachel ist ein Absprung",
      text: "Unter jeder Zahl steht «Details». Ein Klick darauf öffnet die passende Liste.",
    },
    {
      kind: "heading",
      id: "heute",
      text: "Heute",
    },
    {
      kind: "paragraph",
      text: "Der Bereich «Heute» listet alle Termine des Tages. Ein Klick auf einen Termin öffnet ihn im Kalender.",
    },
    {
      kind: "heading",
      id: "letzte-anfragen",
      text: "Letzte Anfragen",
    },
    {
      kind: "paragraph",
      text: "Hier stehen die fünf neuesten Anfragen. Ein grünes Häkchen bedeutet, dass bereits eine Offerte existiert. Ein oranger Punkt mit «Neu» bedeutet, dass noch nichts passiert ist.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie auf eine Anfrage in der Liste." },
        {
          text: "Prüfen Sie die Angaben der Kundschaft.",
          note: "Adresse, Datum und Umfang stehen ganz oben.",
        },
        {
          text: "Klicken Sie auf «Alle anzeigen», wenn Sie mehr als fünf Anfragen sehen möchten.",
          note: "Das öffnet die vollständige Liste unter «Anfragen».",
        },
      ],
    },
    {
      kind: "heading",
      id: "unterwegs",
      text: "Unterwegs am Handy",
    },
  ],

  whatHappensNext: [
    "Die Zahlen aktualisieren sich, sobald Sie eine Offerte senden oder einen Termin anlegen.",
    "Eine Anfrage verschwindet aus «Neue Anfragen», sobald es dazu eine Offerte gibt.",
    "Über «Details» gelangen Sie in die vollständige Liste des jeweiligen Bereichs.",
  ],

  commonMistakes: [
    "Die Kachel «Offene Offerten» als Umsatz lesen. Sie zählt Offerten, nicht Geld.",
    "Annehmen, dass «Neue Anfragen» alle Anfragen zeigt. Gezählt werden nur die ohne Offerte.",
    "Termine nur hier prüfen. Der Kalender zeigt auch die kommenden Tage.",
  ],

  ifSomethingGoesWrong: [
    "Alle Kacheln stehen auf null: Es gibt zu dieser Firma noch keine Daten. Legen Sie unter «Anfragen» eine erste Anfrage an.",
    "Eine Zahl wirkt zu hoch: Klicken Sie auf «Details» und prüfen Sie die Liste. Die Kachel zählt genau die Einträge dieser Liste.",
    "Die Seite lädt sehr lange: Laden Sie sie einmal neu. Bleibt es langsam, prüfen Sie Ihre Internetverbindung.",
  ],
} satisfies WikiArticleBody;

export default body;
