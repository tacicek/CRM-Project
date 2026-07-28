import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnung-erstellen",
  locale: "de",
  title: "Eine Rechnung schreiben und senden",
  summary: "Vom leeren Formular über den QR-Zahlteil bis zum Versand per E-Mail.",

  purpose:
    "Hier schreiben Sie eine Rechnung: Kundendaten, Positionen, Mehrwertsteuer und Konditionen. Beim Speichern entstehen Rechnungsnummer und QR-Referenz von selbst.",

  whenToUse: [
    "Ein Auftrag ist erledigt und muss abgerechnet werden.",
    "Sie möchten einen Entwurf fertig schreiben.",
    "Sie möchten eine bestehende Rechnung erneut als PDF holen.",
    "Sie möchten bei einer Rechnung eine Zahlung erfassen.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/rechnung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Rechnungsformular mit Kundendaten und Rechnungs-Details.",
      alt: "Formular für eine neue Rechnung. Links die Kundendaten mit Anrede, Name, Adresse, E-Mail und Telefon, rechts Datum, Fälligkeit, Status, Sprache und eine interne Notiz.",
      hotspots: [
        { n: 1, xPct: 27, yPct: 45, label: "Kundendaten. Nur der Name ist Pflicht." },
        { n: 2, xPct: 74, yPct: 45, label: "Datum, Fälligkeit, Status und Sprache der Rechnung." },
      ],
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Schritt für Schritt",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie in der Rechnungsliste auf «Neue Rechnung».",
          note: "Kommen Sie aus einem Auftrag, sind die Kundendaten schon ausgefüllt.",
        },
        {
          text: "Füllen Sie unter «Kundendaten» mindestens das Feld «Name» aus.",
          note: "Alles andere ist freiwillig. Ohne Namen lässt sich nicht speichern.",
        },
        {
          text: "Prüfen Sie «Datum» und «Fällig am».",
          note: "Die Fälligkeit folgt automatisch dem Datum plus 30 Tage — bis Sie sie einmal von Hand ändern. Danach bleibt Ihr Wert stehen.",
        },
        {
          text: "Wählen Sie unter «Sprache der Rechnung» die Sprache der Kundschaft.",
          note: "Sie bestimmt PDF und E-Mail — nicht die Sprache Ihrer Ansicht.",
        },
        {
          text: "Tragen Sie unter «Positionen» ein, was verrechnet wird.",
          note: "«Betrag» rechnet sich aus Menge mal Einzelpreis, solange Sie ihn nicht selbst überschreiben. Mit «Zeile hinzufügen» kommt eine weitere Position dazu.",
        },
        {
          text: "Schalten Sie bei Bedarf die «MwSt.» ein und prüfen Sie den Satz.",
          note: "Voreingestellt sind 8.1 Prozent.",
        },
        {
          text: "Klicken Sie auf «Speichern».",
          note: "Jetzt entstehen die Rechnungsnummer und die QR-Referenz. Beides läuft im Hintergrund.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "Der Status",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Bezahlt» fehlt in der Auswahl — mit Absicht",
      text: "Solange etwas offen ist, lässt sich «Bezahlt» nicht wählen. Der Status folgt den erfassten Zahlungen. Erfassen Sie die Zahlung, statt den Status zu setzen.",
    },
    {
      kind: "paragraph",
      text: "Unten auf der Seite steht die Aufstellung: Bezahlt, gegebenenfalls Gutgeschrieben, und Offen. Darunter steht derselbe Hinweis noch einmal.",
    },
    {
      kind: "heading",
      id: "senden",
      text: "Als PDF holen oder per E-Mail senden",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "«PDF herunterladen» speichert zuerst und erzeugt dann die Datei.",
          note: "Das PDF enthält den Schweizer QR-Zahlteil. Fehlen IBAN oder Firmenadresse, erscheint eine Meldung.",
        },
        {
          text: "«Per E-Mail senden» schickt die Rechnung direkt an die Kundschaft.",
          note: "Die Schaltfläche erscheint nur, wenn eine Kunden-E-Mail eingetragen und die Rechnung noch nicht bezahlt ist.",
        },
        {
          text: "Nach dem Senden steht die Rechnung auf «Versendet».",
        },
      ],
    },
    {
      kind: "heading",
      id: "zahlung",
      text: "Zahlung bei dieser Rechnung erfassen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie unten auf «Zahlung erfassen».",
          note: "Die Schaltfläche erscheint nur, wenn die Rechnung gespeichert ist und noch etwas offen steht.",
        },
        {
          text: "Tragen Sie Betrag, Datum, Zahlungsweg und Referenz ein und bestätigen Sie mit «Erfassen».",
          note: "Teilzahlungen sind möglich; die Rechnung bleibt dann offen.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Zahlungen: nur Inhaber und Admin",
      text: "Die Rechnung selbst dürfen alle schreiben und senden. Nur das Erfassen einer Zahlung ist Inhabern und Administratoren vorbehalten.",
    },
  ],

  whatHappensNext: [
    "Beim ersten Speichern entstehen Rechnungsnummer und QR-Referenz automatisch.",
    "Nach dem Senden wechselt der Status auf «Versendet».",
    "Sobald die erfassten Zahlungen den Betrag decken, wechselt er auf «Bezahlt».",
    "Ist die Fälligkeit vorbei und noch etwas offen, wird daraus über Nacht «Überfällig».",
  ],

  commonMistakes: [
    "Die Fälligkeit ändern und sich wundern, dass sie dem Datum nicht mehr folgt. Nach der ersten Änderung von Hand bleibt Ihr Wert stehen.",
    "Die Sprache der Rechnung mit der eigenen Ansicht verwechseln. Sie steuert, was die Kundschaft liest.",
    "Auf «Per E-Mail senden» warten, obwohl kein E-Mail-Feld ausgefüllt ist. Ohne Adresse erscheint die Schaltfläche nicht.",
  ],

  ifSomethingGoesWrong: [
    "«Kundenname fehlt»: Tragen Sie unter «Kundendaten» einen Namen ein.",
    "«IBAN fehlt» oder «Firmen-Adresse unvollständig»: Ergänzen Sie die Angaben unter «Einstellungen» und versuchen Sie es erneut.",
    "Der Versand schlägt fehl: Prüfen Sie die E-Mail-Adresse der Kundschaft. Die Rechnung bleibt gespeichert; Sie können erneut senden.",
  ],
} satisfies WikiArticleBody;

export default body;
