import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "start-hier",
  locale: "de",
  title: "Hier starten",
  summary: "Was dieses Programm für Sie tut und in welcher Reihenfolge Sie arbeiten.",

  purpose:
    "Dieses Programm begleitet einen Kundenauftrag von der ersten Anfrage bis zur bezahlten Rechnung. Alles gehört zu einer Firma. Sie müssen nichts einrichten, um zu beginnen.",

  whenToUse: [
    "Sie arbeiten zum ersten Mal mit dem Programm.",
    "Sie wissen nicht, wo eine bestimmte Aufgabe hingehört.",
    "Sie möchten den roten Faden hinter den vielen Menüpunkten verstehen.",
    "Eine Kollegin oder ein Kollege soll eingearbeitet werden.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "der-rote-faden",
      text: "Der rote Faden",
    },
    {
      kind: "paragraph",
      text: "Fast alles im Programm folgt derselben Kette. Wenn Sie diese Kette kennen, finden Sie jeden Menüpunkt.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Anfrage: Eine Kundin oder ein Kunde meldet sich. Der Wunsch wird erfasst.",
        "Offerte: Sie schreiben ein Angebot und senden es an die Kundschaft.",
        "Auftrag: Die Kundschaft sagt zu. Aus der Offerte wird ein Auftrag mit Termin.",
        "Rechnung oder Quittung: Nach getaner Arbeit stellen Sie Geld in Rechnung.",
        "Zahlung: Sie tragen ein, was bezahlt wurde. Der Status der Rechnung folgt automatisch.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Sie müssen nichts auswendig lernen",
      text: "Oben rechts steht auf jeder Seite «Hilfe & Anleitung». Ein Klick darauf öffnet die Anleitung zu genau der Seite, auf der Sie gerade sind.",
    },
    {
      kind: "heading",
      id: "wo-alles-liegt",
      text: "Wo alles liegt",
    },
    {
      kind: "paragraph",
      text: "Die Seitenleiste links ist in Bereiche geteilt. Ganz oben stehen die fünf Punkte, die Sie täglich brauchen.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/seitenleiste-v1.webp",
      width: 240,
      height: 1146,
      caption: "Die Seitenleiste mit allen Bereichen.",
      alt: "Seitenleiste des Programms. Oben der Firmenname, darunter Übersicht, Anfragen, E-Mail-Eingang, Offerten und Kalender. Danach die Gruppen Hauptbereich, Betrieb und Verwaltung.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 15, label: "Schnellzugriff: die fünf Seiten für den Alltag." },
        { n: 2, xPct: 50, yPct: 40, label: "Hauptbereich: Kunden, Geld und laufende Arbeit." },
        { n: 3, xPct: 50, yPct: 68, label: "Betrieb: Besichtigungen, Material und Team." },
        { n: 4, xPct: 50, yPct: 87, label: "Verwaltung: Ihre Leistungen, Preise und Einstellungen." },
      ],
    },
    {
      kind: "heading",
      id: "erste-schritte",
      text: "Ihre ersten drei Schritte",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie «Übersicht». Das ist Ihre Startseite.",
          note: "Dort sehen Sie neue Anfragen, offene Offerten und die Termine von heute.",
        },
        {
          text: "Klicken Sie auf «Anfragen» und schauen Sie sich eine Anfrage an.",
          note: "So sehen Sie, welche Angaben eine Anfrage mitbringt.",
        },
        {
          text: "Lesen Sie danach die Anleitung «Ein typischer Arbeitstag».",
          note: "Sie beschreibt der Reihe nach, was Sie morgens, tagsüber und abends prüfen.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Was dieses Programm nicht macht",
      text: "Es ist keine Lohnbuchhaltung, keine Fahrzeugortung und keine Routenplanung. Es verwaltet Kundinnen und Kunden, Angebote, Termine und Geld.",
    },
  ],

  whatHappensNext: [
    "Sie kennen die Kette Anfrage, Offerte, Auftrag, Rechnung, Zahlung.",
    "Sie wissen, dass die Hilfe oben rechts immer zur aktuellen Seite passt.",
    "Als Nächstes empfehlen wir «Anmelden und abmelden» und «Ein typischer Arbeitstag».",
  ],

  commonMistakes: [
    "Nicht bei den Einstellungen anfangen. Für die ersten Tage brauchen Sie nur Anfragen und Offerten.",
    "Nicht zwei Programme parallel führen. Was hier nicht eingetragen ist, taucht auch in keiner Auswertung auf.",
  ],

  ifSomethingGoesWrong: [
    "Sie finden eine Seite nicht: Nutzen Sie die Suche oben auf dieser Hilfeseite.",
    "Eine Seite ist leer: Meist gibt es zu diesem Bereich noch keine Daten. Legen Sie zuerst eine Anfrage an.",
    "Sie sind unsicher, ob eine Aktion rückgängig zu machen ist: Bei allen endgültigen Schritten steht vorher ein rot umrandeter Hinweis.",
  ],
} satisfies WikiArticleBody;

export default body;
