import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "email-eingang",
  locale: "de",
  title: "Den E-Mail-Eingang prüfen",
  summary: "Automatisch ausgewertete Kundenmails prüfen, korrigieren und übernehmen.",

  purpose:
    "Mails an Ihre Anfrageadresse werden automatisch ausgewertet. Der E-Mail-Eingang ist die Warteschlange: Sie entscheiden, was zur Anfrage wird und was nicht.",

  whenToUse: [
    "Neben «E-Mail-Eingang» in der Seitenleiste steht eine Zahl.",
    "Am Morgen, bevor Sie mit den Anfragen beginnen.",
    "Eine Kundin sagt, sie habe geschrieben — Sie finden aber keine Anfrage.",
    "Eine Auswertung ist fehlgeschlagen und soll erneut laufen.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/email-eingang-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Der E-Mail-Eingang mit vier Reitern und den eingegangenen Mails.",
      alt: "Seite E-Mail-Eingang mit den Reitern Zu prüfen, Übernommen, Abgelehnt und Fehlgeschlagen, darunter eine Liste von Mails mit Betreff, Absender, Servicemarke, Sicherheitswert und Datum.",
      hotspots: [
        { n: 1, xPct: 30, yPct: 20, label: "Vier Reiter mit der Anzahl ungelesener Mails." },
        { n: 2, xPct: 45, yPct: 34, label: "Betreff und Absender." },
        { n: 3, xPct: 85, yPct: 34, label: "Erkannter Service und Sicherheit der Auswertung." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Die vier Reiter",
    },
    {
      kind: "statusTable",
      headers: { status: "Reiter", meaning: "Was dort liegt", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Zu prüfen", meaning: "Ausgewertet, wartet auf Ihre Entscheidung.", next: "Prüfen und übernehmen oder ablehnen." },
        { status: "Übernommen", meaning: "Wurde bereits zur Anfrage.", next: "Nichts weiter." },
        { status: "Abgelehnt", meaning: "Von Ihnen aussortiert.", next: "Bei Irrtum erneut verarbeiten." },
        { status: "Fehlgeschlagen", meaning: "Die Auswertung brach ab.", next: "Erneut verarbeiten." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Die Zahl in der Seitenleiste",
      text: "Sie zählt alles unter «Zu prüfen». Die kleinen Zahlen an den Reitern zählen dagegen nur die noch nicht geöffneten Mails.",
    },
    {
      kind: "heading",
      id: "pruefen",
      text: "Eine Mail prüfen und übernehmen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie im Reiter «Zu prüfen» auf eine Mail.",
          note: "Sie sehen Betreff, Absender, den Nachrichtentext und darunter die erkannten Angaben.",
        },
        {
          text: "Schauen Sie auf den Wert hinter «Sicherheit».",
          note: "Grün ab 85 Prozent, gelb ab 60, rot darunter. Je tiefer der Wert, desto genauer prüfen.",
        },
        {
          text: "Korrigieren und ergänzen Sie die Felder unter «Erkannte Angaben».",
          note: "Alles ist änderbar. Übernommen wird, was Sie hier stehen lassen — nicht der ursprüngliche Vorschlag.",
        },
        {
          text: "Klicken Sie auf «Als Anfrage übernehmen».",
          note: "Die Mail wechselt in den Reiter «Übernommen» und die Anfrage erscheint unter «Anfragen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Die Auswertung erfindet nichts",
      text: "Steht die Adresse nicht in der Mail, bleibt das Feld leer. Fehlende Angaben holen Sie mit einem kurzen Anruf, bevor Sie übernehmen.",
    },
    {
      kind: "heading",
      id: "ablehnen",
      text: "Werbung und Irrläufer ablehnen",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Ablehnen» fragt nicht nach",
      text: "Ein Klick genügt, und die Mail wandert sofort in den Reiter «Abgelehnt». Rückgängig machen Sie das über «Erneut verarbeiten».",
    },
    {
      kind: "steps",
      steps: [
        { text: "Öffnen Sie die Mail und klicken Sie auf «Ablehnen»." },
        {
          text: "Haben Sie sich vertan, öffnen Sie sie im Reiter «Abgelehnt» und klicken auf «Erneut verarbeiten».",
          note: "Die Auswertung läuft dann noch einmal.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Was der E-Mail-Eingang nicht kann",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Er zeigt nur einen Textauszug der Mail. Das ursprüngliche Layout wird nicht gespeichert.",
        "Anhänge erscheinen nur mit Namen — herunterladen können Sie sie hier nicht.",
        "Antworten können Sie von hier nicht. Nutzen Sie Ihr gewohntes E-Mail-Programm.",
        "«Zur Anfrage» führt zur Anfragenliste, nicht direkt zur einzelnen Anfrage.",
        "Es gibt keine Suche und keinen Filter nach Absender oder Datum.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Brauchen Sie den Anhang?",
      text: "Öffnen Sie die Mail in Ihrem normalen E-Mail-Programm. Der E-Mail-Eingang ist eine Prüfliste, kein Postfach.",
    },
  ],

  whatHappensNext: [
    "Nach dem Übernehmen erscheint die Anfrage unter «Anfragen» im passenden Servicereiter.",
    "Die Zahl in der Seitenleiste sinkt.",
    "Die Mail bleibt im Reiter «Übernommen» und ist mit der Anfrage verknüpft.",
  ],

  commonMistakes: [
    "Bei niedriger Sicherheit ungeprüft übernehmen. Dann steht Falsches in der Offerte.",
    "Auf eine Antwortmöglichkeit warten. Antworten laufen über Ihr E-Mail-Programm.",
    "Fehlgeschlagene Mails liegen lassen. Oft genügt «Erneut verarbeiten».",
  ],

  ifSomethingGoesWrong: [
    "Eine Mail zeigt keine erkannten Angaben: Klicken Sie auf «Erneut verarbeiten». Hilft das nicht, erfassen Sie die Anfrage von Hand.",
    "Eine erwartete Mail fehlt ganz: Prüfen Sie in Ihrem E-Mail-Programm, ob sie an die richtige Adresse ging.",
    "«Übernahme fehlgeschlagen»: Meist fehlt eine Pflichtangabe wie die Postleitzahl. Ergänzen Sie sie und versuchen Sie es erneut.",
  ],
} satisfies WikiArticleBody;

export default body;
