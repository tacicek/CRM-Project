import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftrag-abschliessen",
  locale: "de",
  title: "Einen Auftrag planen und abschliessen",
  summary: "Team zuweisen, Preis festlegen, abschliessen — und danach abrechnen.",

  purpose:
    "Ein Auftrag entsteht aus einer angenommenen Offerte. Sie legen Termin, Team und Preisart fest und schliessen ihn nach getaner Arbeit ab.",

  whenToUse: [
    "Eine Offerte wurde angenommen und die Arbeit muss eingeplant werden.",
    "Sie möchten einen Teamleiter zuweisen.",
    "Der Einsatz ist erledigt und die Stunden sollen erfasst werden.",
    "Sie arbeiten nach Aufwand und brauchen den Endpreis.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Ein Auftrag braucht eine angenommene Offerte",
      text: "«Neuer Auftrag» zeigt zuerst eine Liste angenommener Offerten. Ohne Offerte lässt sich ein neuer Auftrag nicht speichern.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/auftrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Auftragsfenster mit der Auswahl der angenommenen Offerten.",
      alt: "Fenster für einen neuen Auftrag mit der Liste genehmigter Offerten, aus denen ein Auftrag erstellt werden kann.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Einen Auftrag anlegen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie die angenommene Offerte und klicken Sie auf «Auftrag erstellen».",
          note: "Alternativ über «Neuer Auftrag» in der Auftragsliste und Auswahl der Offerte.",
        },
        {
          text: "Prüfen Sie «Titel» und «Kundendaten».",
          note: "Titel, Nachname und Datum sind Pflicht.",
        },
        {
          text: "Tragen Sie unter «Datum» und «Zeit» den Einsatz ein und wählen Sie die «Geschätzte Dauer».",
          note: "Ein Datum in der Vergangenheit wird bei einem neuen Auftrag abgewiesen.",
        },
        {
          text: "Klicken Sie auf «Auftrag erstellen».",
        },
      ],
    },
    {
      kind: "heading",
      id: "preis",
      text: "Die Preisart wählen",
    },
    {
      kind: "statusTable",
      headers: { status: "Preistyp", meaning: "Bedeutung", next: "Beim Abschluss" },
      rows: [
        { status: "Festpreis", meaning: "Fester Betrag aus der Offerte.", next: "Nichts zu rechnen." },
        { status: "Nach Aufwand", meaning: "Abrechnung nach Stunden.", next: "Sie tragen die Stunden ein." },
        { status: "Kostenvoranschlag", meaning: "Schätzung, Endbetrag wie offeriert.", next: "Nichts zu rechnen." },
      ],
    },
    {
      kind: "heading",
      id: "team",
      text: "Team zuweisen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Wählen Sie unter «Team-Leiter» die verantwortliche Person.",
          note: "Nur Personen mit hinterlegter E-Mail-Adresse erscheinen hier — sie bekommen die Erinnerung.",
        },
        {
          text: "Stellen Sie ein, wie früh die Erinnerung gehen soll.",
          note: "Ein Tag, zwei Tage, drei Tage oder eine Woche vorher.",
        },
        {
          text: "Haken Sie unter «Weitere Team-Mitglieder» alle an, die mitfahren.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Fahrzeuge und Material stehen im Kalender",
      text: "Im Auftrag wählen Sie nur Personen. Fahrzeuge und Ausrüstung weisen Sie beim Termin im Kalender zu.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Zusätzliche Leistungen» ändern die Summe nicht",
      text: "Was Sie hier eintragen, wird festgehalten, aber nicht in Zwischensumme, Mehrwertsteuer und Total eingerechnet. Der Betrag stammt aus der Offerte.",
    },
    {
      kind: "heading",
      id: "abschliessen",
      text: "Den Auftrag abschliessen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie in der Auftragsliste das Menü mit den drei Punkten und wählen Sie «Abschliessen …».",
          note: "Im Bearbeitungsfenster gibt es «Abgeschlossen» bewusst nicht als Status zur Auswahl.",
        },
        {
          text: "Bei «Nach Aufwand»: tragen Sie die tatsächlich geleisteten Stunden ein.",
          note: "Der Endpreis wird darunter sofort berechnet. Ohne Stunden lässt sich nicht abschliessen.",
        },
        {
          text: "Ergänzen Sie bei Bedarf die Abschluss-Notizen.",
          note: "Zum Beispiel Besonderheiten beim Einsatz.",
        },
        {
          text: "Klicken Sie auf «Abschliessen».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "«Abgeschlossen» ist eine Endstation",
      text: "Von dort führt kein Statuswechsel zurück. Schliessen Sie erst ab, wenn die Arbeit wirklich erledigt und der Aufwand bekannt ist.",
    },
    {
      kind: "heading",
      id: "abrechnen",
      text: "Danach abrechnen",
    },
    {
      kind: "paragraph",
      text: "Beim Abschluss entsteht keine Rechnung. Erst danach erscheint im Menü «Rechnung erstellen» und führt zu einem vorbereiteten Entwurf.",
    },
  ],

  whatHappensNext: [
    "Beim Anlegen entsteht automatisch ein passender Termin im Kalender.",
    "Ändern Sie Datum oder Zeit im Auftrag, wandert die Änderung in den Termin.",
    "Nach dem Abschluss steht der Endpreis fest und «Rechnung erstellen» wird frei.",
    "Wird der verknüpfte Termin abgesagt, wechselt der Auftrag auf «Storniert».",
  ],

  commonMistakes: [
    "Zusätzliche Leistungen hier eintragen und erwarten, dass die Summe steigt. Sie ändert sich nicht.",
    "Abschliessen, bevor die Stunden bekannt sind. Zurück geht es nicht.",
    "Einen Teamleiter suchen, der nicht erscheint. Ohne E-Mail-Adresse steht er nicht zur Wahl.",
  ],

  ifSomethingGoesWrong: [
    "«Bitte füllen Sie alle Pflichtfelder aus»: Titel, Nachname oder Datum fehlen.",
    "«Datum in der Vergangenheit»: Bei einem neuen Auftrag ist das nicht erlaubt. Wählen Sie ein künftiges Datum.",
    "«Stunden erforderlich»: Beim Abschluss nach Aufwand müssen die geleisteten Stunden eingetragen werden.",
  ],
} satisfies WikiArticleBody;

export default body;
