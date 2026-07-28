import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "nachtrag",
  locale: "de",
  title: "Ein Nachtrag zu einer Offerte",
  summary: "Zusätzliche Leistungen nach der Zusage — mit eigener Zustimmung der Kundschaft.",

  purpose:
    "Ein Nachtrag ergänzt eine bereits angenommene Offerte. Er wird der Kundschaft getrennt vorgelegt und getrennt zugestimmt.",

  whenToUse: [
    "Vor Ort kommt eine Leistung dazu, die nicht offeriert war.",
    "Die Kundschaft wünscht nach der Zusage etwas zusätzlich.",
    "Der Umfang wächst und Sie brauchen dafür eine schriftliche Zustimmung.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Nur bei angenommenen Offerten",
      text: "Solange eine Offerte nicht angenommen ist, ändern Sie sie über eine neue Version. Der Nachtrag setzt die Zusage voraus.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Einen Nachtrag anlegen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie die angenommene Offerte.",
        },
        {
          text: "Klicken Sie oben auf «Nachtrag erstellen».",
          note: "Die Schaltfläche erscheint nur bei Offerten mit dem Status «Angenommen».",
        },
        {
          text: "Sie landen auf der Nachtragsseite.",
          note: "Titel und Grund tragen Sie dort ein — beim Anlegen werden Sie nicht danach gefragt.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/nachtrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Nachtragsseite mit Titel, Grund und Positionen.",
      alt: "Formular für einen Nachtrag mit den Feldern Titel und Grund, einer Positionsliste mit Leistung, Menge, Einheit und Einzelpreis sowie den Summen darunter.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 26, label: "Titel und Grund — was kommt dazu und warum." },
        { n: 2, xPct: 45, yPct: 55, label: "Die zusätzlichen Positionen." },
        { n: 3, xPct: 80, yPct: 78, label: "Zwischensumme, Mehrwertsteuer und Total." },
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Ausfüllen und speichern",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tragen Sie unter «Titel» ein, worum es geht.",
          note: "Zum Beispiel «Klaviertransport». Ohne Titel lässt sich nicht senden.",
        },
        {
          text: "Beschreiben Sie unter «Grund», warum die Leistung dazukommt.",
          note: "Das liest die Kundschaft mit. Ein Satz genügt.",
        },
        {
          text: "Fügen Sie mit «Position hinzufügen» die zusätzlichen Leistungen ein.",
          note: "Mindestens eine Position ist nötig, sonst bleibt die Sendeschaltfläche grau.",
        },
        {
          text: "Klicken Sie auf «Speichern».",
        },
      ],
    },
    {
      kind: "heading",
      id: "senden",
      text: "An die Kundschaft geben",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Es wird keine E-Mail verschickt",
      text: "«An den Kunden senden» stellt den Nachtrag nur bereit und sperrt ihn. Den Link müssen Sie selbst weitergeben — anders als bei der Offerte.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf «An den Kunden senden» und bestätigen Sie.",
          note: "Danach ist der Nachtrag inhaltlich gesperrt, damit die Kundschaft nachlesen kann, was sie bekommen hat.",
        },
        {
          text: "Kopieren Sie den «Kundenlink», der nun erscheint.",
          note: "Er wird erst nach dem Senden angezeigt.",
        },
        {
          text: "Schicken Sie den Link auf Ihrem üblichen Weg.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "Die Status des Nachtrags",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Entwurf", meaning: "Noch in Arbeit, für die Kundschaft unsichtbar.", next: "Fertig ausfüllen." },
        { status: "Versendet", meaning: "Bereitgestellt und gesperrt.", next: "Link weitergeben." },
        { status: "Angesehen", meaning: "Die Kundschaft hat den Link geöffnet.", next: "Auf die Antwort warten." },
        { status: "Zugestimmt", meaning: "Zugesagt. Der Auftrag wächst um die Positionen.", next: "Leistung einplanen." },
        { status: "Abgelehnt", meaning: "Abgelehnt. Der Auftrag bleibt unverändert.", next: "Rücksprache halten." },
      ],
    },
    {
      kind: "heading",
      id: "danach",
      text: "Was bei der Zustimmung passiert",
    },
    {
      kind: "paragraph",
      text: "Stimmt die Kundschaft zu, werden die Positionen dem Auftrag hinzugefügt und die Summen erhöht. Offerte und Nachtrag bleiben unverändert als Beleg stehen.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Notieren Sie sich den Link",
      text: "Von der Offerte führt kein Weg zurück zum Nachtrag. Legen Sie den Link ab oder setzen Sie sich eine Wiedervorlage, solange Sie die Seite offen haben.",
    },
  ],

  whatHappensNext: [
    "Nach dem Senden ist der Nachtrag gesperrt und der Kundenlink sichtbar.",
    "Öffnet die Kundschaft den Link, wechselt der Status auf «Angesehen».",
    "Bei Zustimmung wachsen die Positionen und die Summe des Auftrags.",
    "Bei Ablehnung bleibt alles wie vereinbart.",
  ],

  commonMistakes: [
    "Erwarten, dass eine E-Mail hinausgeht. Der Link muss von Hand weitergegeben werden.",
    "Den Nachtrag anlegen und die Seite verlassen, ohne den Link zu sichern. Es gibt keinen Weg zurück.",
    "Bei einer noch nicht angenommenen Offerte einen Nachtrag suchen. Dort ist die neue Version der richtige Weg.",
  ],

  ifSomethingGoesWrong: [
    "«An den Kunden senden» bleibt grau: Es fehlt der Titel oder eine Position.",
    "Sie finden den Nachtrag nicht wieder: Es gibt keine Übersicht. Bewahren Sie den Link auf oder fragen Sie beim Support nach.",
    "Die Felder lassen sich nicht ändern: Der Nachtrag ist gesendet und damit gesperrt. Legen Sie bei Bedarf einen zweiten an.",
  ],
} satisfies WikiArticleBody;

export default body;
