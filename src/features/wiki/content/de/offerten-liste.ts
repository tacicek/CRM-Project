import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerten-liste",
  locale: "de",
  title: "Die Offertenliste",
  summary: "Alle Angebote mit Status, Filtern und den Aktionen je Zeile.",

  purpose:
    "Die Offertenliste zeigt jedes Angebot, das Sie gespeichert oder versendet haben. Von hier öffnen Sie eine Offerte, senden sie erneut oder machen einen Auftrag daraus.",

  whenToUse: [
    "Sie möchten wissen, auf welche Offerten die Kundschaft noch nicht geantwortet hat.",
    "Sie suchen eine bestimmte Offerte.",
    "Eine Kundin sagt zu und Sie möchten den Auftrag anlegen.",
    "Sie möchten eine Offerte noch einmal senden.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/offerten-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Offertenliste mit vier Kennzahlen und der Tabelle aller Angebote.",
      alt: "Offertenliste mit vier Kacheln für Gesamt, Ausstehend, Angenommen und Wert, darunter eine Tabelle mit Nummer, Datum, Titel, Kunde, Sprache, Details, Betrag, Status und Gültigkeit.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Vier Kacheln — jede ist zugleich ein Filter." },
        { n: 2, xPct: 33, yPct: 39, label: "Suche über Nummer, Name und Titel." },
        { n: 3, xPct: 82, yPct: 39, label: "Filter nach Art und Sprache." },
        { n: 4, xPct: 84, yPct: 68, label: "Statusspalte — hier sehen Sie, wo eine Offerte steht." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Die vier Kacheln",
    },
    {
      kind: "paragraph",
      text: "Jede Kachel ist auch ein Filter. Ein Klick zeigt nur die passenden Offerten; «Zurücksetzen» hebt das wieder auf.",
    },
    {
      kind: "statusTable",
      headers: { status: "Kachel", meaning: "Was gezählt wird", next: "Klick filtert auf" },
      rows: [
        { status: "Gesamt", meaning: "Alle geladenen Offerten.", next: "Alle" },
        { status: "Ausstehend", meaning: "Gesendet oder angesehen, aber noch ohne Antwort.", next: "Ausstehende" },
        { status: "Angenommen", meaning: "Von der Kundschaft zugesagt.", next: "Angenommene" },
        { status: "Wert", meaning: "Summe der angenommenen Offerten.", next: "Angenommene" },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "Die fünf Status",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Entwurf", meaning: "Gespeichert, aber noch nicht gesendet.", next: "Fertig schreiben und senden." },
        { status: "Gesendet", meaning: "Beim Kunden, noch nicht geöffnet.", next: "Abwarten." },
        { status: "Angesehen", meaning: "Der Kunde hat die Offerte geöffnet.", next: "Nach ein paar Tagen nachfassen." },
        { status: "Angenommen", meaning: "Zugesagt. Ein Auftrag entsteht dazu.", next: "Termin planen." },
        { status: "Abgelehnt", meaning: "Der Kunde hat abgesagt.", next: "Grund notieren, Fall abschliessen." },
      ],
    },
    {
      kind: "heading",
      id: "spalten",
      text: "Was in der Tabelle steht",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Nr.» ist die Offertennummer.",
        "«Details» zeigt die Route von Ort zu Ort und, wenn vorhanden, Zimmer und Fläche.",
        "«Betrag» zeigt die Summe — oder «nach Aufwand», wenn eine Position nach Stundenansatz verrechnet wird.",
        "«E-Mail» zeigt mit einem Symbol, ob über die Firmenadresse oder die Systemadresse versendet wurde.",
        "«Gültig bis» ist das Ablaufdatum der Offerte.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Dieselbe Nummer kann zweimal vorkommen",
      text: "Legen Sie eine neue Version an, behält sie die Nummer der alten. Beide Zeilen stehen in der Liste und unterscheiden sich nur durch Datum und Status. Die Liste zeigt keine Versionsnummer.",
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Suchen und filtern",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tippen Sie in das Feld «Nr., Name oder Titel …».",
          note: "Gesucht wird zusätzlich in der E-Mail-Adresse, auch wenn das im Feld nicht steht.",
        },
        {
          text: "Wählen Sie rechts «Alle Arten», um zwischen «Normal» und «Blind» zu unterscheiden.",
          note: "Eine Blind-Offerte entstand ohne Besichtigung.",
        },
        {
          text: "Wählen Sie «Alle Sprachen», um nach der Sprache der Kundschaft zu filtern.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Aktionen je Zeile",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf eine Zeile, um die Offerte zu öffnen.",
        },
        {
          text: "Klicken Sie rechts auf das Menü mit den drei Punkten für weitere Aktionen.",
          note: "«Anzeigen», «Bearbeiten» und «Erneut senden» stehen immer dort.",
        },
        {
          text: "Bei angenommenen Offerten kommen «Zum Kalender hinzufügen» und «Auftrag erstellen» dazu.",
          note: "Existiert der Auftrag schon, heisst der Eintrag «Auftrag anzeigen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "«Neue Offerte» führt zu den Anfragen",
      text: "Die Schaltfläche oben rechts öffnet kein leeres Formular. Eine Offerte entsteht immer aus einer Anfrage, deshalb landen Sie dort.",
    },
  ],

  whatHappensNext: [
    "Ein Klick auf eine Zeile öffnet die Offerte mit allen Positionen und dem Verlauf.",
    "«Erneut senden» schickt dieselbe Offerte noch einmal per E-Mail.",
    "Sobald die Kundschaft zusagt, wechselt der Status auf «Angenommen» und ein Auftrag entsteht.",
  ],

  commonMistakes: [
    "Zwei Zeilen mit derselben Nummer für einen Fehler halten. Das sind zwei Versionen derselben Offerte.",
    "«Wert» als Umsatz lesen. Es ist die Summe der zugesagten Offerten, nicht das eingegangene Geld.",
    "«Erneut senden» bei einer angenommenen Offerte erwarten. Der Eintrag ist dann gesperrt.",
  ],

  ifSomethingGoesWrong: [
    "Eine Offerte fehlt: Prüfen Sie, ob oben eine Kachel als Filter aktiv ist, und klicken Sie «Zurücksetzen».",
    "«Erneut senden» meldet einen Fehler: Prüfen Sie die E-Mail-Adresse der Kundschaft in der Offerte.",
    "«Zum Kalender hinzufügen» meldet «Lead fehlt»: Der Offerte ist keine Anfrage zugeordnet. Legen Sie den Termin von Hand im Kalender an.",
  ],
} satisfies WikiArticleBody;

export default body;
