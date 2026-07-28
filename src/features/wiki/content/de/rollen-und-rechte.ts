import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rollen-und-rechte",
  locale: "de",
  title: "Rollen und Rechte",
  summary: "Wer darf was: Inhaber, Admin und Mitarbeiter im Vergleich.",

  purpose:
    "Jede Person im Team hat eine Rolle. Die Rolle entscheidet, wer Geld erfassen, Einstellungen ändern und Daten löschen darf.",

  whenToUse: [
    "Eine Schaltfläche fehlt bei Ihnen, bei einer Kollegin aber nicht.",
    "Sie richten einen neuen Zugang ein und müssen die Rolle wählen.",
    "Sie möchten wissen, warum Sie eine Zahlung nicht erfassen können.",
    "Sie prüfen, wer Kundendaten löschen darf.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "eigene-rolle",
      text: "Ihre eigene Rolle sehen",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie oben rechts auf Ihren Namen." },
        {
          text: "Unter Ihrer E-Mail-Adresse steht Ihre Rolle.",
          note: "Sie lautet «Inhaber», «Admin» oder «Mitarbeiter».",
        },
      ],
    },
    {
      kind: "heading",
      id: "die-drei-rollen",
      text: "Die drei Rollen",
    },
    {
      kind: "statusTable",
      headers: { status: "Rolle", meaning: "Was diese Rolle darf", next: "Typisch für" },
      rows: [
        {
          status: "Inhaber",
          meaning: "Alles. Inhaber ist die Person, auf die die Firma eingetragen ist.",
          next: "Die Geschäftsleitung.",
        },
        {
          status: "Admin",
          meaning: "Fast alles, einschliesslich Geld, Einstellungen und Löschen.",
          next: "Büroleitung und Stellvertretung.",
        },
        {
          status: "Mitarbeiter",
          meaning: "Tägliche Arbeit: Anfragen, Offerten, Termine und Aufträge.",
          next: "Disposition und Einsatzleitung.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Nur Inhaber und Admin",
      text: "Zahlungen erfassen und ändern, Kundendaten zusammenführen oder löschen, Firmeneinstellungen ändern, Vorlagen und Preise bearbeiten, Rechnungen und Fälle löschen.",
    },
    {
      kind: "heading",
      id: "was-alle-duerfen",
      text: "Was alle dürfen",
    },
    {
      kind: "paragraph",
      text: "Mitarbeiter sehen dieselben Daten wie Inhaber und Admin. Sie können die tägliche Arbeit vollständig erledigen.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Anfragen ansehen, erfassen und bearbeiten.",
        "Offerten schreiben, senden und nachverfolgen.",
        "Termine im Kalender anlegen und ändern.",
        "Aufträge planen und abschliessen.",
        "Alle Listen und Auswertungen lesen.",
      ],
    },
    {
      kind: "heading",
      id: "was-eingeschraenkt-ist",
      text: "Was für Mitarbeiter gesperrt ist",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Zahlungen erfassen, ändern oder stornieren.",
        "Zwei Kundeneinträge zusammenführen.",
        "Kundinnen und Kunden, Rechnungen, Fälle oder Nachrichten löschen.",
        "Firmenangaben, Vorlagen, Preise und Erinnerungen ändern.",
        "Gutschriften und Mahnungen erstellen.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Fehlende Schaltflächen sind kein Fehler",
      text: "Wenn eine Schaltfläche bei Ihnen nicht erscheint, fehlt Ihnen das Recht dazu. Bitten Sie eine Person mit der Rolle Inhaber oder Admin, den Schritt auszuführen.",
    },
    {
      kind: "heading",
      id: "kunden-zusammenfuehren",
      text: "Beispiel: Kunden zusammenführen",
    },
    {
      kind: "paragraph",
      text: "Steht dieselbe Kundschaft zweimal im System, lassen sich die Einträge zusammenführen. Das ist der deutlichste Unterschied zwischen den Rollen.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Zusammenführen lässt sich nicht rückgängig machen",
      text: "Die beiden Einträge werden zu einem. Prüfen Sie vorher genau, ob es wirklich dieselbe Person oder Firma ist.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Öffnen Sie «Kunden» und dann den betroffenen Eintrag." },
        {
          text: "Suchen Sie den Hinweis auf einen möglichen Doppeleintrag.",
          note: "Er erscheint nur, wenn das Programm einen ähnlichen Eintrag gefunden hat.",
        },
        {
          text: "Prüfen Sie beide Einträge Zeile für Zeile.",
          note: "Gleicher Name genügt nicht. Vergleichen Sie E-Mail-Adresse und Telefonnummer.",
        },
        {
          text: "Führen Sie zusammen, wenn Sie sicher sind.",
          note: "Als Mitarbeiter sehen Sie diese Schaltfläche nicht.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Ihre Rolle gilt für die ganze Firma, nicht pro Seite.",
    "Eine Änderung der Rolle wirkt, sobald die betroffene Person die Seite neu lädt.",
    "Gesperrte Aktionen werden nicht nur ausgeblendet, sondern auch im Hintergrund abgewiesen.",
  ],

  commonMistakes: [
    "Allen die Rolle Admin geben, damit «nichts blockiert». Damit darf jede Person Geld und Kundendaten ändern.",
    "Annehmen, Mitarbeiter sähen weniger Daten. Sie sehen dasselbe, dürfen nur weniger ändern.",
    "Bei fehlender Schaltfläche einen zweiten Zugang anlegen. Das erzeugt Doppeleinträge.",
  ],

  ifSomethingGoesWrong: [
    "Eine Schaltfläche fehlt: Prüfen Sie Ihre Rolle im Menü oben rechts.",
    "Eine Aktion bricht mit einer Fehlermeldung ab, obwohl die Schaltfläche da war: Ihnen fehlt das Recht. Bitten Sie Inhaber oder Admin.",
    "Sie brauchen dauerhaft mehr Rechte: Lassen Sie Ihre Rolle ändern, statt einen zweiten Zugang zu benutzen.",
  ],
} satisfies WikiArticleBody;

export default body;
