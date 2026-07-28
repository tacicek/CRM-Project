import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "de",
  title: "Die Kundenkarte",
  summary: "Alles zu einer Kundin: Kontakt, Vorgänge, Beträge, Verlauf und Portalzugang.",

  purpose:
    "Die Kundenkarte fasst alles zusammen, was zu einer Person oder Firma gehört. Sie beantwortet die Frage «Was lief hier bisher?» ohne Suchen in mehreren Listen.",

  whenToUse: [
    "Die Kundschaft ruft an und Sie brauchen den Stand in zehn Sekunden.",
    "Sie möchten wissen, wie viel jemand insgesamt schon bezahlt hat.",
    "Sie vermuten einen Doppeleintrag.",
    "Sie möchten der Kundschaft einen Portalzugang geben.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Kundenkarte mit Kontakt, Vorgängen und Beträgen.",
      alt: "Kundenkarte mit dem Namen oben, links einer Karte für Kontaktdaten und Notizen, rechts Zählern für Anfragen, Offerten und Aufträge sowie einer Aufstellung der Beträge.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 33, label: "Kontaktdaten. Nur die Notiz lässt sich hier ändern." },
        { n: 2, xPct: 75, yPct: 30, label: "Vorgänge: wie viele Anfragen, Offerten, Aufträge und Belege." },
        { n: 3, xPct: 75, yPct: 60, label: "Finanzen: fakturiert, bezahlt und offen." },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Kontakt und Notiz",
    },
    {
      kind: "paragraph",
      text: "Links stehen E-Mail, Telefon, Sprache, Kundennummer und Herkunft. Diese Felder sind hier nur zum Lesen.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Schreiben Sie in das Feld «Notizen», was das Team wissen sollte.",
          note: "Zum Beispiel: «Ruft am liebsten nach 17 Uhr an.» Die Kundschaft sieht diese Notiz nie.",
        },
        {
          text: "Klicken Sie auf «Änderungen speichern».",
          note: "Die Schaltfläche erscheint erst, sobald Sie etwas getippt haben.",
        },
      ],
    },
    {
      kind: "heading",
      id: "betraege",
      text: "Die Beträge verstehen",
    },
    {
      kind: "statusTable",
      headers: { status: "Zeile", meaning: "Was darin steckt", next: "Achtung" },
      rows: [
        { status: "Fakturiert", meaning: "Summe aller gestellten Rechnungen, ohne Entwürfe.", next: "—" },
        { status: "Bezahlt", meaning: "Summe aller erfassten Zahlungseingänge.", next: "Stornos sind bereits abgezogen." },
        { status: "Offen", meaning: "Was aus gestellten Rechnungen noch aussteht.", next: "—" },
        { status: "Davon Quittungen", meaning: "Der Teil von «Bezahlt», der über Quittungen kam.", next: "Ein Anteil, kein zweiter Betrag." },
        { status: "Gutschriften", meaning: "Summe der versendeten Gutschriften.", next: "—" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "«Davon Quittungen» nicht dazuzählen",
      text: "Die Zeile ist ein Ausschnitt aus «Bezahlt». Wer beide addiert, zählt dasselbe Geld zweimal.",
    },
    {
      kind: "heading",
      id: "verlauf",
      text: "Der Verlauf",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Wechseln Sie oben auf «Verlauf».",
          note: "Sie sehen Anfragen, Offerten, Aufträge, Termine, Rechnungen, Quittungen und E-Mails in zeitlicher Reihenfolge.",
        },
        {
          text: "Klicken Sie unten auf «Mehr laden», wenn die Liste weitergeht.",
        },
      ],
    },
    {
      kind: "heading",
      id: "dubletten",
      text: "Doppelte Einträge zusammenführen",
    },
    {
      kind: "paragraph",
      text: "Teilen sich zwei Einträge eine Telefonnummer, erscheint oben der Hinweis «Möglicherweise dieselbe Person».",
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Nur Inhaber und Admin",
      text: "Prüfen dürfen alle. Zusammenführen dürfen nur Inhaber und Admin. Als Mitarbeiter sehen Sie die Schaltfläche nicht.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Zusammenführen lässt sich nicht rückgängig machen",
      text: "Aus zwei Einträgen wird einer. Prüfen Sie E-Mail und Telefonnummer, bevor Sie bestätigen — gleicher Name genügt nicht.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie im Hinweis auf «Prüfen»." },
        {
          text: "Vergleichen Sie die beiden Spalten «Bleibt bestehen» und «Wird zusammengeführt».",
          note: "Mit «Richtung tauschen» drehen Sie um, welcher Eintrag bestehen bleibt.",
        },
        {
          text: "Lesen Sie die Zeile «Bleibt beim Ziel, geht verloren», falls sie erscheint.",
          note: "Dort steht, welche Angaben verschwinden.",
        },
        {
          text: "Tippen Sie zur Bestätigung den Namen des Eintrags ab, der zusammengeführt wird.",
          note: "Erst dann wird «Zusammenführen» anklickbar. Das ist die Sicherung gegen einen Fehlklick.",
        },
      ],
    },
    {
      kind: "heading",
      id: "portal",
      text: "Portalzugang",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf «Zugang erstellen».",
          note: "Es entsteht ein Link, der nur einmal gültig ist.",
        },
        {
          text: "Klicken Sie auf «Link kopieren» und schicken Sie ihn der Kundschaft auf Ihrem üblichen Weg.",
          note: "Der Link wird nur jetzt angezeigt. Verlassen Sie die Seite, ist er weg — dann erstellen Sie einen neuen.",
        },
        {
          text: "Mit «Zugang widerrufen» beenden Sie laufende Sitzungen.",
        },
      ],
    },
    {
      kind: "paragraph",
      text: "Ändert die Kundschaft im Portal ihre Angaben, erscheint hier der Abschnitt «Offene Änderungswünsche». Sie entscheiden mit «Übernehmen» oder «Ablehnen».",
    },
  ],

  whatHappensNext: [
    "Gespeicherte Notizen sind sofort für das ganze Team sichtbar.",
    "Nach dem Zusammenführen landen Sie auf dem Eintrag, der bestehen bleibt.",
    "Ein übernommener Änderungswunsch schreibt die Angaben der Kundschaft in den Eintrag.",
  ],

  commonMistakes: [
    "«Fakturiert» und «Bezahlt» addieren. Das eine ist gestellt, das andere eingegangen.",
    "Zusammenführen, weil zwei Personen denselben Namen tragen. Prüfen Sie immer E-Mail und Telefon.",
    "Den Portallink erst später kopieren wollen. Er wird nur einmal angezeigt.",
  ],

  ifSomethingGoesWrong: [
    "«Zusammenführen» fehlt: Ihre Rolle erlaubt es nicht. Bitten Sie Inhaber oder Admin.",
    "Sie haben den Portallink verloren: Erstellen Sie einfach einen neuen. Der alte verliert damit nichts an Sicherheit.",
    "Ein Betrag wirkt falsch: Öffnen Sie «Finanzen» und prüfen Sie die erfassten Zahlungen — die Karte rechnet nur zusammen.",
  ],
} satisfies WikiArticleBody;

export default body;
