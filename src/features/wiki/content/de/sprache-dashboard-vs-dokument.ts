import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "sprache-dashboard-vs-dokument",
  locale: "de",
  title: "Zwei Sprachen: Ihre und die der Kundschaft",
  summary: "Warum Sie auf Deutsch arbeiten und die Kundschaft trotzdem Französisch liest.",

  purpose:
    "Das Programm kennt zwei getrennte Sprachen. Die eine ist die Sprache Ihrer Bedienoberfläche. Die andere ist die Sprache, in der die Kundschaft angeschrieben wird.",

  whenToUse: [
    "Sie bedienen das Programm auf Deutsch, haben aber französischsprachige Kundschaft.",
    "Eine Offerte ging in der falschen Sprache hinaus.",
    "Sie möchten die Bedienoberfläche umstellen, ohne die Kundendokumente zu ändern.",
    "Eine neue Person im Team arbeitet lieber auf Französisch.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Der wichtigste Satz auf dieser Seite",
      text: "Wenn Sie oben rechts die Sprache umstellen, ändert sich nur Ihre eigene Ansicht. Kein Dokument und keine E-Mail an die Kundschaft ändert sich dadurch.",
    },
    {
      kind: "heading",
      id: "die-zwei-sprachen",
      text: "Die zwei Sprachen im Vergleich",
    },
    {
      kind: "statusTable",
      headers: { status: "Sprache", meaning: "Gilt für", next: "Wo Sie sie ändern" },
      rows: [
        {
          status: "Ihre Bedienoberfläche",
          meaning: "Menü, Schaltflächen und Beschriftungen, die nur Sie sehen.",
          next: "Oben rechts in der Kopfzeile, neben der Glocke.",
        },
        {
          status: "Sprache der Kundschaft",
          meaning: "Offerte, Rechnung, Quittung, E-Mail, SMS und die Seiten, die die Kundschaft öffnet.",
          next: "Beim Erfassen der Anfrage oder beim Schreiben der Offerte.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eigene-sprache-aendern",
      text: "Ihre eigene Sprache ändern",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "Die Sprachwahl sitzt in der Kopfzeile zwischen der Glocke und der Hilfe.",
      alt: "Kopfzeile mit der Glocke für Benachrichtigungen, daneben die Sprachwahl mit dem Kürzel DE, danach die Schaltfläche Hilfe und Anleitung.",
      hotspots: [
        { n: 1, xPct: 72, yPct: 50, label: "Hier steht Ihre aktuelle Sprache: DE, FR oder EN." },
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie in der Kopfzeile auf das Sprachkürzel, zum Beispiel «DE».",
          note: "Es öffnet sich eine Liste mit Deutsch, Français und English.",
        },
        {
          text: "Wählen Sie Ihre Sprache.",
          note: "Die Seite stellt sich sofort um. Ihre Daten bleiben unverändert.",
        },
        {
          text: "Wählen Sie die Option für die Firmensprache, wenn Sie der Voreinstellung der Firma folgen möchten.",
          note: "Dann übernimmt Ihre Ansicht wieder die Sprache, die in den Einstellungen der Firma hinterlegt ist.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Die Wahl gilt nur für diesen Browser",
      text: "Ihre Kolleginnen und Kollegen sehen weiterhin ihre eigene Sprache. An einem anderen Gerät müssen Sie die Wahl erneut treffen.",
    },
    {
      kind: "heading",
      id: "kundensprache",
      text: "Die Sprache der Kundschaft",
    },
    {
      kind: "paragraph",
      text: "Die Sprache der Kundschaft wird bei der Anfrage festgehalten. Sie wandert von dort in die Offerte, den Auftrag, die Rechnung und die Quittung.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Die Offerte wird in dieser Sprache geschrieben und versendet.",
        "Die Seite, die die Kundschaft über den Link öffnet, erscheint in dieser Sprache.",
        "Erinnerungen per E-Mail und SMS gehen in dieser Sprache hinaus, auch wenn niemand aus dem Team sie auslöst.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Nach dem Senden ist die Sprache festgeschrieben",
      text: "Eine gesendete Offerte lässt sich nicht mehr ändern, auch nicht ihre Sprache. Wenn die Sprache falsch ist, erstellen Sie eine neue Fassung der Offerte.",
    },
    {
      kind: "heading",
      id: "beispiel",
      text: "Ein Beispiel",
    },
    {
      kind: "paragraph",
      text: "Anna arbeitet auf Deutsch. Ihre Kundin Luc Exemple wohnt in Genf und spricht Französisch.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Anna sieht das ganze Programm auf Deutsch.",
        "Bei der Anfrage ist als Sprache Französisch hinterlegt.",
        "Die Offerte, die Anna schreibt, ist auf Französisch.",
        "Luc erhält eine französische E-Mail und öffnet eine französische Seite.",
        "Stellt Anna ihre Ansicht auf Englisch um, bleibt Lucs Offerte französisch.",
      ],
    },
  ],

  whatHappensNext: [
    "Ihre Sprachwahl gilt sofort und bleibt in diesem Browser gespeichert.",
    "Dokumente behalten die Sprache, die bei ihrer Erstellung hinterlegt war.",
    "Automatische Erinnerungen benutzen die Sprache, die im Datensatz steht.",
  ],

  commonMistakes: [
    "Die eigene Sprache umstellen und erwarten, dass die Kundschaft ab jetzt in dieser Sprache schreibt.",
    "Die Sprache der Kundschaft erst nach dem Senden bemerken. Danach hilft nur noch eine neue Fassung der Offerte.",
    "Annehmen, die Sprache gelte für die ganze Firma. Sie gilt pro Kundin, pro Kunde und pro Dokument.",
  ],

  ifSomethingGoesWrong: [
    "Ein Dokument ging in der falschen Sprache hinaus: Erstellen Sie eine neue Fassung der Offerte mit der richtigen Sprache und senden Sie diese.",
    "Ihre Ansicht springt nach dem Neuladen zurück: Sie folgen der Firmensprache. Wählen Sie in der Sprachwahl gezielt eine Sprache.",
    "Ein Text erscheint auf Deutsch, obwohl Sie Französisch gewählt haben: Melden Sie die Stelle. Es fehlt dann eine Übersetzung.",
  ],
} satisfies WikiArticleBody;

export default body;
