import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "de",
  title: "Die Kundenkarte",
  summary:
    "Alles zu einer Kundin: Kontakt, Adresse, Vorgänge, Beträge, Verlauf, Einsatzorte und Portalzugang.",

  purpose:
    "Die Kundenkarte beantwortet in zehn Sekunden: Wer ist das? Wie erreiche ich sie? Wo wohnt sie? Wo wird gearbeitet? Was steht als Nächstes an? Ist etwas offen? Was war zuletzt?",

  whenToUse: [
    "Die Kundschaft ruft an und Sie brauchen den Stand in zehn Sekunden.",
    "Sie brauchen die Anschrift oder die Zugangsangaben zu einem Objekt.",
    "Sie möchten Name, Telefon, E-Mail oder Sprache korrigieren.",
    "Sie vermuten einen Doppeleintrag.",
    "Sie möchten der Kundschaft einen Portalzugang geben.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Kundenkarte: Kopfzeile mit Schnellaktionen, Achtungsstreifen, fünf Register.",
      alt: "Kundenkarte mit dem Namen oben, darunter Schaltflächen für Bearbeiten, Anrufen, E-Mail und Offerte, einer Karte für den nächsten Termin, den Registern Übersicht, Verlauf, Vorgänge, Finanzen und Orte sowie Blöcken für Kontakt, Aktivität, Vorgänge und Finanzen.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 23, label: "Schnellaktionen. Es erscheint nur, was auch hinterlegt ist." },
        { n: 2, xPct: 31, yPct: 31, label: "Achtungsstreifen: nächste Aufgabe, nächster Termin mit Uhrzeit, offener Betrag." },
        { n: 3, xPct: 33, yPct: 39, label: "Die fünf Register der Karte." },
        { n: 4, xPct: 26, yPct: 66, label: "Ohne Anschrift steht hier die Aktion, nicht ein Gedankenstrich." },
        { n: 5, xPct: 78, yPct: 74, label: "Fakturiert, bezahlt und offen — überfällig wäre rot umrandet." },
      ],
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "Der Aufbau",
    },
    {
      kind: "paragraph",
      text: "Ganz oben stehen Name, Art (Person oder Firma), Status und Kundennummer — daneben die Schaltflächen für Anrufen, E-Mail, Adresse kopieren und Karte. Es erscheinen nur die Schaltflächen, für die auch etwas hinterlegt ist.",
    },
    {
      kind: "paragraph",
      text: "Darunter liegt der Achtungsstreifen: die nächste Aufgabe, der nächste Termin mit Uhrzeit, der offene Betrag und offene Fälle. Was überfällig ist, erscheint rot umrandet und mit dem Zusatz «überfällig». Steht dort nichts, ist auch nichts offen.",
    },
    {
      kind: "statusTable",
      headers: { status: "Register", meaning: "Was darin steht", next: "Wofür" },
      rows: [
        { status: "Übersicht", meaning: "Kontakt, Anschrift, Aktivität, Zähler, Beträge, Portalzugang.", next: "Der Blick in zehn Sekunden." },
        { status: "Verlauf", meaning: "Alle Ereignisse in zeitlicher Reihenfolge, filterbar.", next: "«Was lief hier bisher?»" },
        { status: "Vorgänge", meaning: "Offerten, Aufträge, Rechnungen, Quittungen und Termine als Listen.", next: "«Welche Offerte war das?»" },
        { status: "Finanzen", meaning: "Fakturiert, bezahlt, offen — und die Belege dazu.", next: "«Ist noch etwas offen?»" },
        { status: "Orte", meaning: "Anschrift, Rechnungsadresse und Einsatzorte.", next: "«Wohin fahren wir?»" },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Stammdaten ändern",
    },
    {
      kind: "paragraph",
      text: "Name, Firma, Anrede, Telefon, E-Mail, Sprache, Status, Kundennummer und Notiz ändern Sie über «Bearbeiten» oben rechts.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie oben auf «Bearbeiten»." },
        {
          text: "Ändern Sie die Felder. Der Anzeigename folgt normalerweise dem Namen.",
          note: "Wollen Sie einen eigenen Namen wie «Familie Müller», schalten Sie «Eigener Anzeigename» ein — dann bleibt er stehen, auch wenn sich der Nachname ändert.",
        },
        {
          text: "Klicken Sie auf «Speichern».",
          note: "Schlägt das Speichern fehl, bleibt das Formular mit Ihren Eingaben offen. Es geht nichts verloren.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Alte Belege ändern sich nicht",
      text: "Eine korrigierte Adresse oder E-Mail gilt ab jetzt. Bereits erstellte Offerten, Aufträge und Rechnungen behalten den Stand, den sie beim Erstellen hatten — das ist so gewollt.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Telefonnummer mit Vorwahl",
      text: "Schreiben Sie «079 123 45 67» oder «+41 79 123 45 67». Eine Nummer ohne 0 oder +41 am Anfang kann nicht zugeordnet werden — die nächste Anfrage derselben Person legt dann einen zweiten Eintrag an. Das Formular warnt Sie vorher.",
    },
    {
      kind: "heading",
      id: "adressen",
      text: "Anschrift und Einsatzorte",
    },
    {
      kind: "paragraph",
      text: "Im Register «Orte» stehen zwei verschiedene Dinge, und die Unterscheidung ist wichtig: die Anschrift ist, wo die Kundschaft wohnt und wohin die Rechnung geht. Ein Einsatzort ist, wo gearbeitet wird — Auszug, Einzug, Reinigungsobjekt oder Lager.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Warum die Adresse anfangs leer ist",
      text: "Adressen aus Anfragen sind Einsatzorte, keine Anschrift. Bei einem Umzug ist die Auszugsadresse genau die Adresse, an der jemand nicht mehr wohnt — deshalb wird sie nicht als Wohnadresse übernommen. Tragen Sie die Anschrift mit «Adresse hinzufügen» selbst ein.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Wechseln Sie oben auf «Orte»." },
        {
          text: "Klicken Sie auf «Adresse hinzufügen» und tippen Sie die Adresse.",
          note: "Die Vorschläge helfen, sind aber nicht Pflicht: «c/o Meier, Hinterhaus links» können Sie ebenso eintragen.",
        },
        {
          text: "Wählen Sie «Korrespondenzadresse» oder «Rechnungsadresse».",
          note: "Ohne eigene Rechnungsadresse gehen Rechnungen an die Korrespondenzadresse. Je Art gilt genau eine Adresse als Hauptadresse.",
        },
        {
          text: "Unter «Einsatzorte» ergänzen Sie Stockwerk, Lift, Parksituation und Zugang.",
          note: "Das spart beim zweiten Auftrag am selben Objekt das Nachfragen. Einsatzorte entstehen auch automatisch aus Aufträgen.",
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
          note: "Sie sehen Anfragen, Offerten, Aufträge, Termine, Rechnungen, Quittungen und E-Mails in zeitlicher Reihenfolge — mit Datum und Uhrzeit.",
        },
        {
          text: "Schränken Sie mit den Filtern ein: Alle, Offerten, Aufträge, Finanzen, Kontakt.",
        },
        {
          text: "Klicken Sie eine Zeile an, um den Beleg zu öffnen.",
          note: "Offerten, Rechnungen und Quittungen lassen sich öffnen. Anfragen, Aufträge, Termine und E-Mails haben keinen eigenen Bildschirm — diese Zeilen sind deshalb nicht anklickbar.",
        },
        {
          text: "Klicken Sie unten auf «Mehr laden», wenn die Liste weitergeht.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "«Letzte Aktion» ist immer Vergangenheit",
      text: "Ein Termin nächste Woche zählt nicht als letzte Aktion — er steht unter «Nächster Termin». So bedeutet «Letzte Aktion vor 4 Monaten» wirklich, dass seither nichts geschehen ist.",
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
    "Gespeicherte Angaben sind sofort für das ganze Team sichtbar.",
    "Bereits erstellte Offerten, Aufträge und Rechnungen bleiben unverändert.",
    "Nach dem Zusammenführen landen Sie auf dem Eintrag, der bestehen bleibt — samt Zahlungen, Fällen, Aufgaben, Adressen und Einsatzorten des anderen.",
    "Ein übernommener Änderungswunsch schreibt die Angaben der Kundschaft in den Eintrag.",
  ],

  commonMistakes: [
    "«Fakturiert» und «Bezahlt» addieren. Das eine ist gestellt, das andere eingegangen.",
    "Die Auszugsadresse einer Anfrage als Wohnadresse behandeln. In der Liste steht deshalb «Letzter Einsatzort» davor, solange keine Anschrift erfasst ist.",
    "Eine Telefonnummer ohne Vorwahl eintragen.",
    "Zusammenführen, weil zwei Personen denselben Namen tragen. Prüfen Sie immer E-Mail und Telefon.",
    "Den Portallink erst später kopieren wollen. Er wird nur einmal angezeigt.",
  ],

  ifSomethingGoesWrong: [
    "«Zusammenführen» fehlt: Ihre Rolle erlaubt es nicht. Bitten Sie Inhaber oder Admin.",
    "«Zusammenführen gestoppt»: Beide Einträge kollidieren an derselben Stelle. Es wurde nichts geändert; die Meldung nennt, wo. Lösen Sie das dort auf und versuchen Sie es erneut.",
    "Ein Abschnitt zeigt einen roten Kasten statt Zahlen: Die Angaben konnten nicht geladen werden. Klicken Sie auf «Erneut versuchen». Die Beträge stehen bewusst nicht auf 0.00 — 0.00 wäre eine Aussage, die niemand geprüft hat.",
    "Sie haben den Portallink verloren: Erstellen Sie einfach einen neuen. Der alte verliert damit nichts an Sicherheit.",
    "Ein Betrag wirkt falsch: Öffnen Sie «Finanzen» und prüfen Sie die erfassten Zahlungen — die Karte rechnet nur zusammen.",
  ],
} satisfies WikiArticleBody;

export default body;
