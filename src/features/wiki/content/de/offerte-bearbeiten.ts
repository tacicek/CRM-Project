import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-bearbeiten",
  locale: "de",
  title: "Eine Offerte bearbeiten",
  summary: "Entwürfe ändern — und warum gesendete Offerten sich sperren.",

  purpose:
    "Solange eine Offerte ein Entwurf ist, können Sie alles daran ändern. Sobald sie gesendet wurde, ist der Inhalt gesperrt.",

  whenToUse: [
    "Ein Entwurf ist noch nicht fertig.",
    "Sie haben einen Tippfehler entdeckt, bevor die Offerte hinausging.",
    "Sie möchten die Positionen einer neuen Version anpassen.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Nur Entwürfe lassen sich bearbeiten",
      text: "Öffnen Sie eine gesendete Offerte zum Bearbeiten, werden Sie mit einer Meldung zurückgeschickt. Das ist Absicht, kein Fehler.",
    },
    {
      kind: "heading",
      id: "warum-gesperrt",
      text: "Warum eine gesendete Offerte gesperrt ist",
    },
    {
      kind: "paragraph",
      text: "Die Kundschaft muss nachlesen können, was sie erhalten hat. Liesse sich eine versendete Offerte nachträglich ändern, wäre der Link keinen Beweis mehr wert.",
    },
    {
      kind: "paragraph",
      text: "Die Sperre wirkt nicht nur in der Anzeige. Auch ein Umweg über eine andere Stelle wird abgewiesen.",
    },
    {
      kind: "heading",
      id: "bearbeiten",
      text: "Einen Entwurf bearbeiten",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie die Offertenliste und suchen Sie den Entwurf.",
          note: "Entwürfe tragen das graue Zeichen «Entwurf».",
        },
        {
          text: "Klicken Sie im Menü mit den drei Punkten auf «Bearbeiten».",
        },
        {
          text: "Ändern Sie, was nötig ist.",
          note: "Das Formular entspricht dem beim Erstellen.",
        },
        {
          text: "Klicken Sie auf «Änderungen speichern» oder «Speichern & Senden».",
          note: "Die zweite Schaltfläche speichert und verschickt in einem Schritt.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Eine gesendete Offerte: keine Schaltflächen zum Ändern, nur PDF und Kundenlink.",
      alt: "Detailansicht einer gesendeten Offerte. Oben ein roter Hinweis auf eine neuere Version, rechts nur die Bereiche Kunde, Aktivitäten und Kunden-Link ohne Bearbeitungsmöglichkeit.",
    },
    {
      kind: "heading",
      id: "was-tun",
      text: "Was tun, wenn die Offerte schon draussen ist",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "Richtiger Weg", next: "Anleitung" },
      rows: [
        { status: "Gesendet, noch keine Antwort", meaning: "Neue Version anlegen und diese senden.", next: "Neue Version einer Offerte" },
        { status: "Angenommen, Umfang ändert sich", meaning: "Nachtrag erstellen.", next: "Nachtrag zu einer Offerte" },
        { status: "Abgelehnt", meaning: "Nichts ändern. Neue Offerte aus der Anfrage.", next: "Eine Offerte schreiben" },
        { status: "Noch Entwurf", meaning: "Direkt bearbeiten.", next: "Dieser Artikel" },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Eine neue Version ist wieder ein Entwurf",
      text: "Legen Sie eine neue Version an, entsteht ein frischer Entwurf mit denselben Positionen. Den können Sie normal bearbeiten und dann senden.",
    },
  ],

  whatHappensNext: [
    "Gespeicherte Änderungen sind sofort wirksam, solange die Offerte ein Entwurf ist.",
    "Mit «Speichern & Senden» wechselt der Status auf «Gesendet» und der Inhalt wird gesperrt.",
    "Danach ändern Sie nur noch über eine neue Version.",
  ],

  commonMistakes: [
    "Nach dem Senden noch schnell einen Preis korrigieren wollen. Das ist gesperrt — nutzen Sie eine neue Version.",
    "Eine angenommene Offerte bearbeiten wollen. Für Änderungen am vereinbarten Umfang gibt es den Nachtrag.",
    "Mehrere Entwürfe zur selben Anfrage anlegen, statt einen zu bearbeiten. Das erzeugt Verwirrung in der Liste.",
  ],

  ifSomethingGoesWrong: [
    "«Diese Offerte wurde versendet»: Richtig so. Legen Sie eine neue Version an.",
    "«Bearbeitung nicht möglich»: Die Offerte ist angenommen oder abgelehnt.",
    "«Fehler beim Speichern» bei einer älteren Fassung: Sie bearbeiten eine überholte Version. Öffnen Sie stattdessen die neueste.",
  ],
} satisfies WikiArticleBody;

export default body;
