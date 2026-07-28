import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "zahlung-erfassen",
  locale: "de",
  title: "Eine Zahlung erfassen",
  summary: "Voll, teilweise oder zu viel — und wie Sie einen Fehler korrigieren.",

  purpose:
    "Sobald Geld eingegangen ist, tragen Sie es hier ein. Der Status der Rechnung ergibt sich daraus von selbst — Sie stellen ihn nie von Hand.",

  whenToUse: [
    "Auf dem Konto ist eine Überweisung eingegangen.",
    "Die Kundschaft hat bar oder mit TWINT bezahlt.",
    "Es kam nur eine Anzahlung.",
    "Es wurde zu viel überwiesen.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "permission",
      title: "Nur Inhaber und Admin",
      text: "Zahlungen erfassen und stornieren ist Inhabern und Administratoren vorbehalten. Mitarbeiter sehen die Schaltfläche, erhalten beim Klicken aber eine Fehlermeldung.",
    },
    {
      kind: "heading",
      id: "wo-beginnen",
      text: "Wo Sie beginnen",
    },
    {
      kind: "paragraph",
      text: "Es gibt zwei Wege zum selben Fenster. Beide führen zum gleichen Ergebnis.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Über «Finanzen» → Reiter «Offene Posten» → «Zahlung erfassen» bei der Rechnung. Das ist der schnelle Weg für mehrere Eingänge nacheinander.",
        "Über die Rechnung selbst → Schaltfläche «Zahlung erfassen» unten. Sie erscheint nur, wenn die Rechnung gespeichert ist und noch etwas offen steht.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Bei jedem offenen Posten steht rechts «Zahlung erfassen».",
      alt: "Liste offener Rechnungen. Jede Zeile zeigt Rechnungsnummer, Kundenname, Fälligkeit und rechts den offenen Betrag mit einer Schaltfläche zum Erfassen der Zahlung.",
      hotspots: [
        { n: 1, xPct: 91, yPct: 43, label: "Diese Schaltfläche öffnet das Fenster." },
        { n: 2, xPct: 33, yPct: 57, label: "Hier steht, wie viel bereits bezahlt wurde." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-felder",
      text: "Die vier Felder",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "«Betrag» ist mit dem offenen Betrag vorbelegt. Überschreiben Sie ihn, wenn weniger oder mehr kam.",
          note: "Bei einer Quittung ist das Feld fest — dort ist der Betrag durch den Beleg bestimmt.",
        },
        {
          text: "«Zahlungsdatum» steht auf heute. Setzen Sie das Datum des tatsächlichen Eingangs ein.",
          note: "Für den Kontoauszug ist das Valutadatum richtig, nicht der Tag Ihrer Erfassung.",
        },
        {
          text: "Wählen Sie unter «Zahlungsweg», wie das Geld kam.",
          note: "Zur Wahl: Banküberweisung, QR-Rechnung, TWINT, Bar, Karte, Anderer Weg.",
        },
        {
          text: "Tragen Sie unter «Referenz» ein, woran Sie die Zahlung wiedererkennen.",
          note: "Zum Beispiel die QR-Referenz, eine TWINT-Nummer oder eine Belegnummer. Das Feld ist freiwillig, hilft aber später beim Abgleich.",
        },
        {
          text: "Klicken Sie auf «Erfassen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Es gibt kein Bemerkungsfeld",
      text: "Was die Zahlung erklärt, gehört in die «Referenz». Ein freies Notizfeld bietet das Fenster nicht.",
    },
    {
      kind: "heading",
      id: "teilzahlung",
      text: "Teilzahlung",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tragen Sie unter «Betrag» ein, was tatsächlich kam.",
          note: "Beispiel: 400 von 890 Franken.",
        },
        {
          text: "Erfassen Sie die Zahlung wie gewohnt.",
          note: "Die Rechnung bleibt offen, der offene Betrag sinkt auf die Differenz.",
        },
        {
          text: "Später erfassen Sie den Rest als zweite Zahlung.",
          note: "Sobald nichts mehr offen ist, wechselt die Rechnung von selbst auf «Bezahlt».",
        },
      ],
    },
    {
      kind: "heading",
      id: "ueberzahlung",
      text: "Zu viel bezahlt",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Der Überschuss bleibt liegen",
      text: "Tippen Sie mehr als offen ist, erscheint sofort ein Hinweis. Der überschüssige Teil wird als nicht zugeordneter Eingang gebucht und taucht unter «Nicht abgeglichen» auf.",
    },
    {
      kind: "paragraph",
      text: "Das ist kein Fehler, sondern ein Merkposten. Klären Sie mit der Kundschaft, ob der Betrag zurückgeht oder auf die nächste Rechnung angerechnet wird.",
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Eine falsche Zahlung korrigieren",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Erfasste Zahlungen lassen sich nicht ändern",
      text: "Betrag, Datum und Zahlungsweg stehen nach dem Erfassen fest. Eine Korrektur geht nur über «Stornieren» und ein erneutes Erfassen.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Öffnen Sie «Finanzen» und den Reiter «Zahlungseingänge»." },
        { text: "Klicken Sie bei der falschen Buchung auf «Stornieren» und bestätigen Sie." },
        {
          text: "Erfassen Sie die Zahlung nun richtig.",
          note: "In der Liste stehen danach drei Zeilen: die falsche, die Gegenbuchung und die richtige.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Der offene Betrag der Rechnung sinkt sofort.",
    "Ist nichts mehr offen, wechselt die Rechnung automatisch auf «Bezahlt».",
    "Der Eingang erscheint im Reiter «Zahlungseingänge» und zählt in «Kassiert» mit.",
    "Auf der Kundenkarte steigt die Zeile «Bezahlt».",
  ],

  commonMistakes: [
    "Das Erfassungsdatum statt des Eingangsdatums eintragen. Dann stimmt die Auswertung «Letzte 30 Tage» nicht.",
    "Bei einer Teilzahlung den vollen Betrag stehen lassen. Dann gilt die Rechnung als bezahlt, obwohl Geld fehlt.",
    "Nach einer Falschbuchung eine zweite Zahlung mit Minusbetrag erfassen wollen. Nutzen Sie «Stornieren».",
  ],

  ifSomethingGoesWrong: [
    "«Erfassen» bleibt grau: Der Betrag ist leer oder null. Tragen Sie eine Zahl grösser als null ein.",
    "Es erscheint eine Fehlermeldung: Ihre Rolle darf keine Zahlungen erfassen. Bitten Sie Inhaber oder Admin.",
    "Sie haben zweimal dieselbe Zahlung erfasst: Stornieren Sie eine der beiden Buchungen.",
  ],
} satisfies WikiArticleBody;

export default body;
