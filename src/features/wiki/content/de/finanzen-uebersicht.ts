import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "finanzen-uebersicht",
  locale: "de",
  title: "Finanzen: was offen ist und was hereinkam",
  summary: "Offene Posten und Zahlungseingänge an einem Ort — inklusive Storno.",

  purpose:
    "Die Seite «Finanzen» beantwortet zwei Fragen: Wer schuldet noch Geld, und was ist bereits eingegangen. Hier erfassen Sie auch Zahlungen.",

  whenToUse: [
    "Sie haben einen Kontoauszug vor sich und wollen Eingänge erfassen.",
    "Sie möchten wissen, was überfällig ist.",
    "Sie haben eine Zahlung falsch erfasst und müssen sie korrigieren.",
    "Sie möchten den Monatsumsatz sehen.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Finanzen mit den vier Beträgen und der Liste der offenen Posten.",
      alt: "Finanzseite mit vier Beträgen für Kassiert, Letzte 30 Tage, Offen und Überfällig, darunter zwei Reitern und der Liste offener Rechnungen mit je einer Schaltfläche zum Erfassen einer Zahlung.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 19, label: "Vier Beträge. «Überfällig» wird rot, sobald etwas überfällig ist." },
        { n: 2, xPct: 24, yPct: 28, label: "Zeile «Nicht abgeglichen» — erscheint nur, wenn es solche Eingänge gibt." },
        { n: 3, xPct: 29, yPct: 36, label: "Zwei Reiter: offene Posten und Zahlungseingänge." },
        { n: 4, xPct: 91, yPct: 43, label: "«Zahlung erfassen» öffnet das Fenster für den Eingang." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-betraege",
      text: "Die vier Beträge",
    },
    {
      kind: "statusTable",
      headers: { status: "Betrag", meaning: "Was darin steckt", next: "Hinweis" },
      rows: [
        { status: "Kassiert", meaning: "Alle jemals erfassten Zahlungseingänge.", next: "Stornos sind bereits abgezogen." },
        { status: "Letzte 30 Tage", meaning: "Dasselbe, aber nur die letzten 30 Tage.", next: "—" },
        { status: "Offen", meaning: "Was aus gestellten Rechnungen noch aussteht.", next: "Entwürfe zählen nicht mit." },
        { status: "Überfällig", meaning: "Der Teil davon, dessen Fälligkeit vorbei ist.", next: "Wird rot dargestellt." },
      ],
    },
    {
      kind: "heading",
      id: "offene-posten",
      text: "Reiter «Offene Posten»",
    },
    {
      kind: "paragraph",
      text: "Hier steht jede Rechnung, die noch nicht ganz bezahlt ist. Die älteste Fälligkeit steht oben.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Die Rechnungsnummer ist anklickbar und öffnet die Rechnung.",
        "Darunter steht entweder «Fällig {Datum}» oder rot «{n} Tage überfällig».",
        "Wurde schon etwas bezahlt, steht dort zusätzlich «{Betrag} von {Betrag} bezahlt».",
        "Die Marke «Mahnstufe {n}» erscheint, sobald Mahnungen entstanden sind.",
        "Rechts steht der noch offene Betrag mit der Schaltfläche «Zahlung erfassen».",
      ],
    },
    {
      kind: "heading",
      id: "zahlungseingaenge",
      text: "Reiter «Zahlungseingänge»",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/finanzen-zahlungseingaenge-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Zahlungsbuch mit einer stornierten Buchung.",
      alt: "Reiter Zahlungseingänge mit einer Liste von Buchungen. Jede Zeile zeigt Datum, Zahlungsweg, Abgleichzustand und Betrag; eine Zeile trägt die Marke Storno und einen negativen Betrag.",
    },
    {
      kind: "paragraph",
      text: "Jede Zeile ist eine Buchung: Datum, Zahlungsweg, Referenz und Betrag. Eine Zeile mit der Marke «Storno» und negativem Betrag hebt eine frühere Buchung auf.",
    },
    {
      kind: "heading",
      id: "stornieren",
      text: "Eine falsche Zahlung korrigieren",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Zahlungen werden nie gelöscht",
      text: "Eine falsche Buchung wird durch eine Gegenbuchung aufgehoben. Beide Zeilen bleiben sichtbar — so bleibt die Buchhaltung nachvollziehbar.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Wechseln Sie auf den Reiter «Zahlungseingänge»." },
        {
          text: "Suchen Sie die falsche Buchung und klicken Sie auf «Stornieren».",
          note: "Die Schaltfläche fehlt bei Buchungen, die selbst ein Storno sind oder bereits storniert wurden.",
        },
        {
          text: "Bestätigen Sie die Rückfrage.",
          note: "Es entsteht eine zweite Zeile mit demselben Betrag als Minus.",
        },
        {
          text: "Erfassen Sie danach die richtige Zahlung neu.",
          note: "Ein Storno hebt immer den ganzen Betrag auf — Teilbeträge lassen sich nicht stornieren.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Erfassen und stornieren: nur Inhaber und Admin",
      text: "Als Mitarbeiter sehen Sie beide Schaltflächen, erhalten beim Klicken aber eine Fehlermeldung. Das ist keine Störung, sondern die Rechtevergabe.",
    },
  ],

  whatHappensNext: [
    "Nach einer erfassten Zahlung sinkt «Offen» und «Kassiert» steigt.",
    "Ist eine Rechnung vollständig bezahlt, verschwindet sie aus den offenen Posten und gilt als «Bezahlt».",
    "Ein Storno erhöht «Offen» wieder und die Rechnung taucht erneut auf.",
  ],

  commonMistakes: [
    "Die Rechnung von Hand auf «bezahlt» stellen wollen. Der Status folgt den Zahlungen; einen Schalter gibt es nicht.",
    "Eine falsche Buchung löschen wollen. Es gibt nur das Stornieren mit Gegenbuchung.",
    "«Kassiert» als Gewinn lesen. Es ist eingegangenes Geld, nicht Ertrag.",
  ],

  ifSomethingGoesWrong: [
    "Beim Erfassen erscheint eine Fehlermeldung: Ihre Rolle erlaubt das nicht. Bitten Sie Inhaber oder Admin.",
    "Ein Betrag steht bei «Nicht abgeglichen»: Der Eingang ist erfasst, aber keiner Rechnung zugeordnet. Erfassen Sie ihn erneut bei der richtigen Rechnung und stornieren Sie den alten.",
    "Eine bezahlte Rechnung erscheint wieder als offen: Vermutlich wurde die Zahlung storniert oder eine Gutschrift erstellt.",
  ],
} satisfies WikiArticleBody;

export default body;
