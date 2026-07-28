import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kunden-liste",
  locale: "de",
  title: "Die Kundenliste",
  summary: "Alle Kundinnen und Kunden an einem Ort — suchen, filtern und öffnen.",

  purpose:
    "Die Kundenliste sammelt jede Person und jede Firma, mit der Sie zu tun hatten. Sie zeigt auf einen Blick, wer offene Beträge hat und wann zuletzt etwas passiert ist.",

  whenToUse: [
    "Sie suchen die Telefonnummer einer Kundin.",
    "Sie möchten wissen, wer noch Geld schuldet.",
    "Sie vermuten, dass jemand doppelt erfasst ist.",
    "Sie möchten alle Firmenkunden sehen.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Kunden entstehen von selbst",
      text: "Es gibt keine Schaltfläche «Neuer Kunde», und das ist Absicht. Ein Eintrag entsteht automatisch aus einer Anfrage, einer Offerte oder einem Beleg.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kunden-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Kundenliste mit Kennzahlen, Suche, Filtern und den Einträgen.",
      alt: "Kundenliste mit vier Kennzahlen oben, einem Suchfeld, vier Filterschaltflächen und darunter den Kundeneinträgen mit Name, E-Mail, Telefon und Ort.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 17, label: "Vier Kennzahlen zum Bestand." },
        { n: 2, xPct: 50, yPct: 30, label: "Suche über Name, E-Mail und Telefon." },
        { n: 3, xPct: 30, yPct: 37, label: "Filter: Alle, Personen, Firmen, Duplikat-Verdacht." },
        { n: 4, xPct: 50, yPct: 55, label: "Ein Eintrag. Klicken öffnet die Kundenkarte." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Die vier Kennzahlen",
    },
    {
      kind: "statusTable",
      headers: { status: "Kachel", meaning: "Was gezählt wird", next: "Anklickbar?" },
      rows: [
        { status: "Kunden", meaning: "Alle Einträge, ohne die bereits zusammengeführten.", next: "Nein" },
        { status: "Neu (30 T.)", meaning: "Einträge, die in den letzten 30 Tagen entstanden sind.", next: "Nein" },
        { status: "Duplikat-Verdacht", meaning: "Einträge, die sich eine Telefonnummer teilen.", next: "Ja — setzt den Filter" },
        { status: "Inaktiv (90 T.)", meaning: "Einträge, deren erster Kontakt länger als 90 Tage her ist.", next: "Nein" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Inaktiv» heisst nicht «keine Aktivität»",
      text: "Die Kachel zählt, wann der erste Kontakt war — nicht, wann zuletzt etwas passiert ist. Eine langjährige Stammkundin zählt hier mit.",
    },
    {
      kind: "heading",
      id: "suchen-filtern",
      text: "Suchen und filtern",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tippen Sie in das Feld «Name, E-Mail oder Telefon …».",
          note: "Die Liste reagiert nach einem kurzen Moment von selbst. Sie müssen nichts bestätigen.",
        },
        {
          text: "Wählen Sie darunter einen Filter: «Alle», «Personen», «Firmen» oder «Duplikat-Verdacht».",
          note: "Suche und Filter wirken zusammen.",
        },
        {
          text: "Mit dem «X» im Suchfeld setzen Sie die Suche zurück.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eintrag-lesen",
      text: "Einen Eintrag lesen",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Links stehen Name, E-Mail, Telefon und Ort.",
        "Die Marke «Firma» erscheint bei Firmenkunden.",
        "Ein Sprachkürzel erscheint nur, wenn die Kundschaft nicht Deutsch spricht.",
        "Rechts steht der offene Betrag mit dem Wort «offen» — nur wenn wirklich etwas offen ist.",
        "Ganz rechts steht, wann zuletzt etwas passiert ist, oder «Noch keine Aktivität».",
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf einen Eintrag.",
          note: "Es öffnet sich die Kundenkarte mit allen Vorgängen und Beträgen.",
        },
        {
          text: "Unten stellen Sie ein, wie viele Einträge pro Seite erscheinen.",
          note: "Zur Wahl stehen 10, 25, 50 und 100. Voreingestellt sind 25.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Ein Klick auf einen Eintrag öffnet die Kundenkarte.",
    "Der offene Betrag sinkt, sobald Sie unter «Finanzen» eine Zahlung erfassen.",
    "Ein neuer Eintrag erscheint hier, sobald eine Anfrage oder ein Beleg dazu entsteht.",
  ],

  commonMistakes: [
    "Eine Kundin von Hand anlegen wollen. Das ist nicht vorgesehen — erfassen Sie stattdessen eine Anfrage.",
    "«Inaktiv (90 T.)» als «hat sich lange nicht gemeldet» lesen. Gezählt wird der erste Kontakt.",
    "Nach der Kundennummer suchen. Die Suche prüft Name, E-Mail und Telefon.",
  ],

  ifSomethingGoesWrong: [
    "Die Liste ist leer: Es gibt zu dieser Firma noch keine Anfragen. Legen Sie zuerst eine Anfrage an.",
    "Jemand steht doppelt: Öffnen Sie den Eintrag; oben erscheint ein Hinweis auf mögliche Dubletten.",
    "Ein Eintrag lässt sich nicht finden: Suchen Sie nach der Telefonnummer statt nach dem Namen — Namen werden oft anders geschrieben.",
  ],
} satisfies WikiArticleBody;

export default body;
