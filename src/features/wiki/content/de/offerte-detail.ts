import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-detail",
  locale: "de",
  title: "Die Offerte im Detail",
  summary: "Positionen, Verlauf, Kundenlink und die Aktionen je nach Status.",

  purpose:
    "Die Detailseite zeigt alles zu einer Offerte: was drinsteht, was die Kundschaft damit gemacht hat und was Sie als Nächstes tun können.",

  whenToUse: [
    "Sie möchten wissen, ob die Kundschaft die Offerte geöffnet hat.",
    "Sie brauchen den Link für die Kundschaft.",
    "Eine Offerte wurde zugesagt und Sie möchten den Auftrag anlegen.",
    "Sie möchten das PDF prüfen, bevor Sie senden.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/offerte-detail-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Detailseite mit Positionen, Kundendaten, Verlauf und Kundenlink.",
      alt: "Detailansicht einer Offerte. Links die Positionen mit Zwischensumme, Mehrwertsteuer und Total; rechts Kundendaten, die Aktivitätenliste und der Bereich mit dem Kundenlink.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 10, label: "Titel und Status der Offerte." },
        { n: 2, xPct: 44, yPct: 55, label: "Die Positionen mit Total." },
        { n: 3, xPct: 86, yPct: 48, label: "Aktivitäten — was wann passiert ist." },
        { n: 4, xPct: 86, yPct: 72, label: "Kundenlink zum Kopieren." },
      ],
    },
    {
      kind: "heading",
      id: "aktivitaeten",
      text: "Woran Sie sehen, was der Kunde getan hat",
    },
    {
      kind: "paragraph",
      text: "Der Bereich «Aktivitäten» rechts ist der Nachweis. Er füllt sich von selbst, Sie tragen dort nichts ein.",
    },
    {
      kind: "statusTable",
      headers: { status: "Eintrag", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Offerte erstellt", meaning: "Sie haben die Offerte angelegt.", next: "—" },
        { status: "Per E-Mail gesendet", meaning: "Die Offerte ging an die genannte Adresse.", next: "Abwarten." },
        { status: "Vom Kunden angesehen", meaning: "Die Kundschaft hat den Link geöffnet.", next: "Nach ein paar Tagen nachfassen." },
        { status: "Offerte angenommen", meaning: "Verbindlich zugesagt.", next: "Auftrag und Termin planen." },
        { status: "Offerte abgelehnt", meaning: "Abgesagt. Der Grund steht unter «Kundennotiz».", next: "Verlustgrund festhalten." },
      ],
    },
    {
      kind: "heading",
      id: "kundenlink",
      text: "Den Kundenlink weitergeben",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie rechts unter «Kunden-Link» auf «Kopieren».",
          note: "Der Link liegt danach in der Zwischenablage. Angezeigt wird er nicht.",
        },
        {
          text: "Fügen Sie ihn dort ein, wo Sie mit der Kundschaft schreiben.",
          note: "Mit dem Symbol daneben öffnen Sie die Kundenansicht selbst in einem neuen Tab — nützlich zum Prüfen.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Welche Schaltflächen wann erscheinen",
    },
    {
      kind: "statusTable",
      headers: { status: "Schaltfläche", meaning: "Sichtbar wenn", next: "Was passiert" },
      rows: [
        { status: "PDF herunterladen", meaning: "immer", next: "Lädt die Offerte als PDF." },
        { status: "Vorschau & Senden", meaning: "nur bei «Entwurf»", next: "Zeigt das PDF und sendet es." },
        { status: "Neue Version", meaning: "gesendet, noch nicht angenommen", next: "Legt eine neue Fassung an." },
        { status: "Nachtrag erstellen", meaning: "nur bei «Angenommen»", next: "Ergänzt eine zugesagte Offerte." },
        { status: "Auftrag anzeigen / erstellen", meaning: "nur bei «Angenommen»", next: "Führt zum Auftrag." },
        { status: "Offerte löschen", meaning: "alles ausser «Angenommen»", next: "Entfernt die Offerte." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Erneut senden» finden Sie nicht hier",
      text: "Auf der Detailseite gibt es das nicht. Nutzen Sie in der Offertenliste das Menü mit den drei Punkten.",
    },
    {
      kind: "heading",
      id: "vorschau",
      text: "Vorschau und Senden",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie bei einem Entwurf auf «Vorschau & Senden».",
          note: "Es öffnet sich das echte PDF, Seite für Seite durchblätterbar.",
        },
        {
          text: "Prüfen Sie Positionen, Preise und die Sprache.",
        },
        {
          text: "Klicken Sie auf «Offerte senden».",
          note: "Erst jetzt geht die E-Mail hinaus und der Status wechselt auf «Gesendet».",
        },
      ],
    },
    {
      kind: "heading",
      id: "auftrag",
      text: "Vom Angebot zum Auftrag",
    },
    {
      kind: "paragraph",
      text: "Sagt die Kundschaft über den Link zu, entsteht der Auftrag meist automatisch. Deshalb steht dann «Auftrag anzeigen» statt «Auftrag erstellen».",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Angenommene Offerten lassen sich nicht löschen",
      text: "Sie hängen an einem Auftrag. Der Versuch wird mit einer Meldung abgewiesen — das ist keine Störung, sondern Absicht.",
    },
  ],

  whatHappensNext: [
    "Nach dem Senden erscheint «Per E-Mail gesendet» in den Aktivitäten.",
    "Öffnet die Kundschaft den Link, kommt «Vom Kunden angesehen» dazu.",
    "Bei einer Zusage entstehen «Offerte angenommen», ein Auftrag und der Eintrag «AGB akzeptiert».",
  ],

  commonMistakes: [
    "Den Kundenlink von Hand aus der Adresszeile abschreiben. Nutzen Sie «Kopieren».",
    "Auf der Detailseite nach «Erneut senden» suchen. Das steht nur in der Liste.",
    "Eine gesendete Offerte ändern wollen. Dafür gibt es «Neue Version».",
  ],

  ifSomethingGoesWrong: [
    "«Daten konnten nicht geladen werden» beim PDF: Die Offerte enthält unvollständige Angaben, etwa bei Zuschlägen. Öffnen Sie sie zum Bearbeiten und prüfen Sie die Felder.",
    "«Löschen nicht möglich»: Die Offerte ist angenommen und mit einem Auftrag verknüpft.",
    "Die Aktivitäten zeigen kein «Angesehen»: Die Kundschaft hat den Link noch nicht geöffnet. Ein PDF-Anhang allein löst das nicht aus.",
  ],
} satisfies WikiArticleBody;

export default body;
