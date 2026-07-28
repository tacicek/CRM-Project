import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnungen-liste",
  locale: "de",
  title: "Die Rechnungsliste",
  summary: "Alle Rechnungen mit Status, Filter, PDF und den Löschregeln.",

  purpose:
    "Die Rechnungsliste zeigt jede erstellte Rechnung mit ihrem Status. Von hier aus öffnen Sie eine Rechnung, laden das PDF herunter oder legen eine neue an.",

  whenToUse: [
    "Sie suchen eine bestimmte Rechnung.",
    "Sie möchten sehen, welche Rechnungen überfällig sind.",
    "Sie brauchen ein PDF für die Buchhaltung.",
    "Sie möchten eine neue Rechnung schreiben.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/rechnungen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Rechnungsliste mit Kennzahlen, Suche, Statusfiltern und den Einträgen.",
      alt: "Rechnungsliste mit vier Kennzahlen, einem Suchfeld, fünf Statusfiltern und darunter Zeilen mit Rechnungsnummer, Kundenname, Datum, Fälligkeit, Status und Betrag.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 22, label: "Gesamt, Offen, Überfällig und Umsatz." },
        { n: 2, xPct: 30, yPct: 34, label: "Suche nach Nummer oder Kundenname." },
        { n: 3, xPct: 40, yPct: 41, label: "Statusfilter." },
        { n: 4, xPct: 92, yPct: 12, label: "«Neue Rechnung» öffnet das leere Formular." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-status",
      text: "Die vier Status",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        { status: "Entwurf", meaning: "Noch nicht an die Kundschaft gegangen.", next: "Fertig schreiben und senden." },
        { status: "Versendet", meaning: "Gestellt, noch nicht vollständig bezahlt.", next: "Auf den Eingang warten." },
        { status: "Bezahlt", meaning: "Vollständig beglichen.", next: "Nichts weiter." },
        { status: "Überfällig", meaning: "Das Fälligkeitsdatum ist vorbei.", next: "Nachfassen oder mahnen." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "«Bezahlt» stellt sich von selbst ein",
      text: "Sobald die erfassten Zahlungen den Betrag decken, wechselt der Status automatisch. Sie können ihn nicht von Hand setzen.",
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Die Kennzahlen oben",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Gesamt» ist die Anzahl aller Rechnungen.",
        "«Offen» zählt Entwürfe und versendete Rechnungen — überfällige zählen hier nicht mit.",
        "«Überfällig» zählt nur die überfälligen.",
        "«Umsatz» ist das tatsächlich eingegangene Geld, nicht die Summe der gestellten Rechnungen.",
      ],
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
          text: "Tippen Sie in das Feld «Nr. oder Kundenname …».",
          note: "Gesucht wird in der Rechnungsnummer und im Namen.",
        },
        {
          text: "Wählen Sie darunter einen Status: «Alle», «Entwurf», «Versendet», «Bezahlt» oder «Überfällig».",
        },
        {
          text: "Klicken Sie auf eine Zeile, um die Rechnung zu öffnen.",
        },
      ],
    },
    {
      kind: "heading",
      id: "pdf",
      text: "PDF herunterladen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie in der Zeile auf das Symbol zum Herunterladen.",
          note: "Alternativ über das Menü mit den drei Punkten und «PDF herunterladen».",
        },
        {
          text: "Das PDF enthält den Schweizer QR-Zahlteil.",
          note: "Dafür müssen IBAN und Firmenadresse in den Einstellungen hinterlegt sein.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«IBAN fehlt» oder «Firmen-Adresse unvollständig»",
      text: "Erscheint eine dieser Meldungen, lässt sich kein QR-Zahlteil erzeugen. Ergänzen Sie IBAN, Strasse, PLZ und Ort unter «Einstellungen».",
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Löschen — und warum meist nicht",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Löschen fragt nicht nach",
      text: "Im Menü mit den drei Punkten löscht «Löschen» den Entwurf sofort, ohne Rückfrage. Es gibt kein Zurück.",
    },
    {
      kind: "paragraph",
      text: "Löschen ist nur bei Entwürfen möglich. Bei allen anderen erscheint der Hinweis, dass gebuchte Belege storniert und nicht gelöscht werden.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Entwurf: kann gelöscht werden.",
        "Versendet, Bezahlt, Überfällig: kann nicht gelöscht werden.",
        "Eine falsche gestellte Rechnung wird über eine Gutschrift ausgeglichen, nicht entfernt.",
      ],
    },
  ],

  whatHappensNext: [
    "Ein Klick auf eine Zeile öffnet die Rechnung mit allen Positionen.",
    "«Neue Rechnung» öffnet ein leeres Formular.",
    "Der Status ändert sich, sobald Sie unter «Finanzen» eine Zahlung erfassen.",
  ],

  commonMistakes: [
    "«Umsatz» als Summe der gestellten Rechnungen lesen. Es ist das eingegangene Geld.",
    "Im Dreipunktmenü versehentlich «Löschen» treffen. Es kommt keine Rückfrage.",
    "Eine gestellte Rechnung löschen wollen, statt eine Gutschrift zu erstellen.",
  ],

  ifSomethingGoesWrong: [
    "Das PDF lässt sich nicht erzeugen: Prüfen Sie IBAN und Firmenadresse in den Einstellungen.",
    "Eine Rechnung fehlt in der Liste: Vermutlich ist ein Statusfilter aktiv. Wählen Sie «Alle».",
    "Ein Entwurf wurde versehentlich gelöscht: Er ist weg. Schreiben Sie ihn neu — die Daten der Kundschaft sind noch da.",
  ],
} satisfies WikiArticleBody;

export default body;
