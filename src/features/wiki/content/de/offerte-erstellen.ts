import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-erstellen",
  locale: "de",
  title: "Eine Offerte schreiben",
  summary: "Von der Anfrage zur fertigen Offerte: Positionen, Preismodell, Konditionen, senden.",

  purpose:
    "Hier stellen Sie ein Angebot zusammen. Die Angaben aus der Anfrage sind schon übernommen; Sie ergänzen Positionen und Preise.",

  whenToUse: [
    "Eine Anfrage ist geprüft und soll ein Angebot bekommen.",
    "Nach einer Besichtigung möchten Sie den Preis festhalten.",
    "Die Kundschaft wartet auf eine schriftliche Zusage.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Eine Offerte beginnt immer bei einer Anfrage",
      text: "Öffnen Sie unter «Anfragen» die passende Anfrage und starten Sie von dort. Ohne Anfrage meldet die Seite «Kein Lead ausgewählt».",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/offerte-erstellen-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Offertenformular. Oben die übernommenen Angaben aus der Anfrage.",
      alt: "Formular zum Erstellen einer Offerte mit dem Abschnitt Anfrage-Übersicht, der Kontakt, Route und Objektdetails aus der Anfrage anzeigt.",
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "Wie die Seite aufgebaut ist",
    },
    {
      kind: "paragraph",
      text: "Es ist ein einziges langes Formular, kein Assistent mit Schritten. Sie können in beliebiger Reihenfolge arbeiten und zwischendurch speichern.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "«Anfrage-Übersicht» — was die Kundschaft gemeldet hat. Nur zum Lesen.",
        "«Umzugsrechner» — erscheint nur bei Umzügen und berechnet Volumen, Zeit und Kosten.",
        "«Offerten-Details» — Titel und Beschreibung.",
        "«Preismodell» — pauschal, nach Stunden oder mit Kostendach.",
        "«Zuschläge» — Aufschläge, etwa für Wochenende oder Etage.",
        "«Offerte-Art» — normal oder blind.",
        "«Positionen & Preise» — was verrechnet wird.",
        "«Zahlungskondition» und «Allgemeine Geschäftsbedingungen».",
      ],
    },
    {
      kind: "heading",
      id: "preismodell",
      text: "Das Preismodell wählen",
    },
    {
      kind: "statusTable",
      headers: { status: "Modell", meaning: "Bedeutung", next: "Passt, wenn" },
      rows: [
        { status: "Pauschalpreis", meaning: "Ein fester Betrag, unabhängig vom Aufwand.", next: "der Umfang klar ist." },
        { status: "Stundenansatz", meaning: "Abrechnung nach tatsächlichen Stunden.", next: "der Aufwand schwer zu schätzen ist." },
        { status: "Stundenansatz mit Kostendach", meaning: "Nach Stunden, aber gedeckelt.", next: "die Kundschaft Sicherheit möchte." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Das Kostendach ist ein Verkaufsargument",
      text: "Der Hinweis unter dem Feld sagt es der Kundschaft direkt: sie zahlt höchstens diesen Betrag, egal wie lange es dauert.",
    },
    {
      kind: "heading",
      id: "positionen",
      text: "Positionen erfassen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf «Aus Katalog hinzufügen», um Leistungen aus Ihrem Katalog zu übernehmen.",
          note: "Der Katalog steht unter «Meine Leistungen». Was dort gepflegt ist, geht hier schneller.",
        },
        {
          text: "Mit «Manuell eingeben» erstellen Sie eine leere Position.",
          note: "Jede Position braucht mindestens eine Beschreibung, sonst lässt sich nicht speichern.",
        },
        {
          text: "Stellen Sie bei Bedarf die «Preisbasis» je Position um.",
          note: "«Fester Betrag», «Ansatz (nach Aufwand)» oder «Spanne (min–max)».",
        },
        {
          text: "Prüfen Sie unten Zwischensumme, Rabatt und Total.",
        },
      ],
    },
    {
      kind: "heading",
      id: "konditionen",
      text: "Konditionen und AGB",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tragen Sie unter «Zahlungskondition» ein, wie bezahlt wird.",
          note: "Die Schaltflächen darunter — etwa «Barzahlung» oder «30 Tage» — füllen den Text mit einem Klick, und zwar in der Sprache der Kundschaft.",
        },
        {
          text: "Klappen Sie «Allgemeine Geschäftsbedingungen» auf, wenn AGB mitgehen sollen.",
          note: "«Standard-AGB automatisch einfügen» übernimmt Ihren hinterlegten Text. Die AGB erscheinen auf Seite 2 der Offerte.",
        },
      ],
    },
    {
      kind: "heading",
      id: "speichern-senden",
      text: "Speichern oder senden",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "«Als Entwurf speichern» legt die Offerte ab, ohne etwas zu verschicken.",
          note: "Sie können später weiterarbeiten. Der Status bleibt «Entwurf».",
        },
        {
          text: "«Offerte senden» speichert und schickt sie sofort per E-Mail.",
          note: "Erst wenn die E-Mail wirklich hinausgeht, wechselt der Status auf «Gesendet».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Prüfen Sie vorher die Sprache und den Preis",
      text: "Nach dem Senden ist die Offerte inhaltlich gesperrt. Änderungen brauchen dann eine neue Version.",
    },
    {
      kind: "paragraph",
      text: "Rechts sehen Sie die «Live-Vorschau». Sie zeigt ungefähr, wie die Offerte wirkt — das endgültige PDF prüfen Sie nach dem Speichern auf der Detailseite.",
    },
  ],

  whatHappensNext: [
    "Nach dem Speichern landen Sie in der Offertenliste.",
    "Ein Entwurf lässt sich beliebig weiter bearbeiten.",
    "Nach dem Senden erhält die Kundschaft eine E-Mail mit einem Link zur Offerte.",
    "Öffnet sie den Link, wechselt der Status auf «Angesehen».",
  ],

  commonMistakes: [
    "Ohne Position speichern wollen. Es braucht mindestens eine, sonst blockiert die Prüfung.",
    "Beim Kostendach einen Betrag eintragen, der unter dem Stundenansatz liegt. Das wird abgewiesen.",
    "Die Live-Vorschau für das fertige PDF halten. Sie ist eine Annäherung.",
  ],

  ifSomethingGoesWrong: [
    "«Bitte geben Sie einen Titel ein»: Das Feld «Titel» unter «Offerten-Details» ist leer.",
    "«Bitte füllen Sie alle Positionen aus»: Eine Position hat keine Beschreibung.",
    "«E-Mail nicht gesendet»: Die Offerte ist gespeichert, nur der Versand misslang. Senden Sie sie aus der Liste erneut.",
  ],
} satisfies WikiArticleBody;

export default body;
