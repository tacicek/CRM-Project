import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "navigation-und-benachrichtigungen",
  locale: "de",
  title: "Menü, Kopfzeile und Benachrichtigungen",
  summary: "Wie Sie sich im Programm bewegen und wo Sie Hinweise auf Neuigkeiten finden.",

  purpose:
    "Das Programm hat zwei feste Elemente: die Seitenleiste links und die Kopfzeile oben. Beide sind auf jeder Seite gleich.",

  whenToUse: [
    "Sie suchen einen Menüpunkt und finden ihn nicht.",
    "Neben einem Menüpunkt steht eine Zahl und Sie möchten wissen, was sie bedeutet.",
    "Sie möchten Töne oder Hinweise ein- und ausschalten.",
    "Sie arbeiten am Mobiltelefon und sehen keine Seitenleiste.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "seitenleiste",
      text: "Die Seitenleiste",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/seitenleiste-v1.webp",
      width: 240,
      height: 1400,
      caption: "Die Seitenleiste, aufgeteilt in Schnellzugriff und drei Gruppen.",
      alt: "Seitenleiste mit dem Firmennamen oben, dann Übersicht, Anfragen, E-Mail-Eingang, Offerten und Kalender, danach die Gruppen Hauptbereich, Betrieb und Verwaltung, jeweils mit Symbol und Text.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 4, label: "Ihr Firmenname. Darunter das Suchfeld." },
        { n: 2, xPct: 50, yPct: 15, label: "Schnellzugriff: die fünf häufigsten Seiten." },
        { n: 3, xPct: 50, yPct: 40, label: "Hauptbereich: Kundschaft, Geld und laufende Arbeit." },
        { n: 4, xPct: 50, yPct: 87, label: "Verwaltung: Leistungen, Preise, Archiv, Einstellungen und diese Hilfe." },
      ],
    },
    {
      kind: "paragraph",
      text: "Jeder Eintrag hat ein Symbol und einen Text. Der Text ist entscheidend, das Symbol hilft nur beim Wiedererkennen.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Zahlen neben einem Eintrag",
      text: "Eine Zahl rechts neben einem Menüpunkt zeigt, wie viele Einträge dort auf Sie warten. Sie erscheint bei «E-Mail-Eingang», «Besichtigungen» und «Umzugsboxen».",
    },
    {
      kind: "heading",
      id: "kopfzeile",
      text: "Die Kopfzeile",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "Die Kopfzeile mit Seitenname, Glocke, Sprachwahl, Hilfe und Benutzermenü.",
      alt: "Schmaler Balken am oberen Rand. Links der Firmenname und der Name der aktuellen Seite. Rechts eine Glocke mit Zähler, die Sprachwahl, die Schaltfläche Hilfe und Anleitung sowie das Benutzermenü.",
      hotspots: [
        { n: 1, xPct: 18, yPct: 50, label: "Firmenname und aktuelle Seite." },
        { n: 2, xPct: 67, yPct: 50, label: "Glocke: neue Hinweise, mit Anzahl." },
        { n: 3, xPct: 72, yPct: 50, label: "Sprache der Bedienoberfläche." },
        { n: 4, xPct: 80, yPct: 50, label: "Hilfe zur aktuellen Seite." },
        { n: 5, xPct: 92, yPct: 50, label: "Ihr Konto, Töne und Abmelden." },
      ],
    },
    {
      kind: "heading",
      id: "benachrichtigungen",
      text: "Benachrichtigungen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf die Glocke in der Kopfzeile.",
          note: "Die Zahl an der Glocke zeigt, wie viele Hinweise Sie noch nicht gelesen haben.",
        },
        {
          text: "Klicken Sie einen Hinweis an, um zur passenden Seite zu springen.",
          note: "Ein Hinweis zu einem Termin führt in den Kalender, einer zu einer Offerte in die Offerte.",
        },
        {
          text: "Mit «Alle gelesen» setzen Sie den Zähler zurück.",
          note: "Die Hinweise bleiben in der Liste stehen; nur der Zähler wird null.",
        },
      ],
    },
    {
      kind: "heading",
      id: "toene",
      text: "Töne und Hinweise am Bildschirm",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie oben rechts auf Ihren Namen." },
        {
          text: "Schalten Sie «Ton aktiv» ein oder aus.",
          note: "Rechts steht «An» oder «Aus». Der Ton kommt bei neuen Anfragen und Terminänderungen.",
        },
        {
          text: "Schalten Sie «Push aktiv» ein, wenn Sie Hinweise auch ausserhalb des Browserfensters möchten.",
          note: "Der Browser fragt einmal um Erlaubnis. Sagen Sie dort «Zulassen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Benachr. blockiert»",
      text: "Steht das im Menü, hat der Browser die Hinweise gesperrt. Das lässt sich nur in den Einstellungen des Browsers ändern, nicht hier.",
    },
    {
      kind: "heading",
      id: "am-handy",
      text: "Am Mobiltelefon",
    },
    {
      kind: "paragraph",
      text: "Auf einem schmalen Bildschirm gibt es die Seitenleiste nicht. An ihre Stelle tritt eine Leiste am unteren Rand mit den fünf wichtigsten Zielen. Der letzte Knopf heisst «Mehr» und öffnet alle übrigen Bereiche.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Tippen Sie unten auf Übersicht, Anfragen, Offerten oder Kalender, um dorthin zu wechseln." },
        {
          text: "Für alles andere tippen Sie unten rechts auf «Mehr».",
          note: "Dort stehen Kundschaft, Finanzen, Aufträge, Rechnungen und die Verwaltung — dieselben Punkte wie in der Seitenleiste am Rechner.",
        },
        { text: "Zum Schliessen ziehen Sie das Fenster nach unten oder tippen daneben." },
        {
          text: "Oben links suchen Sie mit der Lupe.",
          note: "Sie durchsucht dieselben Ziele wie das Suchfeld am Rechner.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Der runde Knopf unten rechts",
      text: "Er legt eine neue Anfrage an. Er liegt über der Liste und bleibt immer sichtbar.",
    },
    {
      kind: "heading",
      id: "erscheinungsbild",
      text: "Helles und dunkles Erscheinungsbild",
    },
    {
      kind: "paragraph",
      text: "Sie können zwischen einer hellen und einer dunklen Darstellung wählen. Die Einstellung gilt nur für Ihre eigene Ansicht des Programms — an Offerten, Rechnungen und E-Mails an Ihre Kundschaft ändert sich nichts.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Am Rechner: oben rechts auf Ihren Namen tippen, dann unter «Erscheinungsbild» wählen." },
        { text: "Am Mobiltelefon: unten auf «Mehr», dann ganz unten «Erscheinungsbild»." },
        {
          text: "«Wie das System» übernimmt die Einstellung Ihres Geräts.",
          note: "Stellt Ihr Telefon abends automatisch auf dunkel um, folgt das Programm mit.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Die Zahl an der Glocke sinkt, sobald Sie Hinweise als gelesen markieren.",
    "Die Zahlen neben den Menüpunkten sinken, sobald Sie die betreffenden Einträge bearbeitet haben.",
    "Ihre Einstellung für Ton und Hinweise gilt für diesen Browser, nicht für Ihr Konto insgesamt.",
  ],

  commonMistakes: [
    "Die Zahlen neben den Menüpunkten mit den Benachrichtigungen verwechseln. Die Zahl am Menü zählt offene Einträge, die Glocke zählt ungelesene Hinweise.",
    "«Alle löschen» statt «Alle gelesen» wählen. Löschen entfernt die Hinweise aus der Liste.",
    "Erwarten, dass Töne auf jedem Gerät gleich eingestellt sind. Die Einstellung gilt pro Browser.",
  ],

  ifSomethingGoesWrong: [
    "Ein Menüpunkt fehlt: Er kann für diese Firma abgeschaltet sein. Fragen Sie die Person, die die Einstellungen betreut.",
    "Es kommen keine Töne: Prüfen Sie im Benutzermenü, ob «Ton aktiv» steht, und die Lautstärke des Geräts.",
    "Die Glocke zeigt eine Zahl, die Liste ist leer: Laden Sie die Seite neu.",
  ],
} satisfies WikiArticleBody;

export default body;
