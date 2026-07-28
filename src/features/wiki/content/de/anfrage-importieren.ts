import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-importieren",
  locale: "de",
  title: "Eine Anfrage selbst erfassen",
  summary: "Text einfügen oder diktieren — die Auswertung füllt die Felder, Sie prüfen sie.",

  purpose:
    "Kommt eine Anfrage per Telefon oder über einen Weg ohne Anbindung, erfassen Sie sie hier. Sie fügen den Text ein, das Programm erkennt Servicetyp und Angaben.",

  whenToUse: [
    "Eine Kundin ruft an und schildert ihren Umzug.",
    "Eine Anfrage kam über einen Kanal ohne Anbindung.",
    "Sie möchten eine ältere E-Mail nachträglich erfassen.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Es gibt kein leeres Formular",
      text: "«Neue Anfrage» führt immer hierher. Sie tippen keine Felder einzeln aus — Sie liefern Text oder Sprache, und prüfen danach das Ergebnis.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/anfrage-importieren-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Schritt 1 mit dem Textfeld und der Schaltfläche für die Spracheingabe.",
      alt: "Importseite mit der Überschrift Anfrage importieren, oben eine Schaltfläche für Spracheingabe, darunter ein grosses Textfeld mit Beispieltexten und die Schaltfläche zum Auswerten.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 27, label: "Spracheingabe — diktieren statt tippen." },
        { n: 2, xPct: 50, yPct: 55, label: "Hier den Text der Kundschaft einfügen." },
      ],
    },
    {
      kind: "heading",
      id: "schritt1",
      text: "Schritt 1: Text liefern",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Fügen Sie den gesamten Text der Kundschaft in das grosse Feld ein.",
          note: "Mindestens 20 Zeichen, höchstens 10 000. Der Zähler unten rechts zeigt den Stand.",
        },
        {
          text: "Oder klicken Sie auf «Spracheingabe» und sprechen Sie die Anfrage.",
          note: "Danach sehen Sie den erkannten Text und können ihn korrigieren, bevor es weitergeht.",
        },
        {
          text: "Klicken Sie auf «Mit AI extrahieren».",
          note: "Nach einer Diktatfreigabe startet die Auswertung von selbst.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Lieber zu viel Text als zu wenig",
      text: "Kopieren Sie die ganze Nachricht samt Grussformel und Signatur. Telefonnummer und Adresse stehen oft dort, und die Auswertung findet nur, was im Text steht.",
    },
    {
      kind: "heading",
      id: "schritt2",
      text: "Schritt 2: Ergebnis prüfen",
    },
    {
      kind: "paragraph",
      text: "Oben stehen der erkannte Servicetyp und ein Prozentwert für die Sicherheit der Auswertung. Liegt er unter 80 Prozent, erscheint ein Hinweis, die Angaben besonders sorgfältig zu prüfen.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Prüfen Sie den Servicetyp und ändern Sie ihn bei Bedarf im Auswahlfeld.",
          note: "Zur Wahl stehen Privatumzug, Firmenumzug, Reinigung, Räumung, Entsorgung, Lagerung, Klaviertransport und Möbellift.",
        },
        {
          text: "Ergänzen Sie fehlende Kontaktangaben.",
          note: "Alle Felder sind frei änderbar — die Auswertung ist ein Vorschlag, keine Vorgabe.",
        },
        {
          text: "Prüfen Sie «Der Kunde hat geschrieben auf».",
          note: "Diese Sprache bestimmt Offerte, PDF und E-Mails an die Kundschaft.",
        },
        {
          text: "Klicken Sie auf «Anfrage speichern».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ohne Postleitzahl geht es nicht weiter",
      text: "Die Postleitzahl ist das einzige Pflichtfeld. Welche verlangt wird, hängt vom Service ab: bei Lagerung die Abhol-PLZ, bei Umzug und Klaviertransport die Von-PLZ, sonst die Adress-PLZ.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Meldungen beim Speichern",
    },
    {
      kind: "statusTable",
      headers: { status: "Meldung", meaning: "Ursache", next: "Was tun" },
      rows: [
        { status: "Text zu kurz", meaning: "Weniger als 20 Zeichen.", next: "Mehr Text einfügen." },
        { status: "PLZ erforderlich", meaning: "Die für diesen Service nötige PLZ fehlt.", next: "Vierstellige PLZ eintragen." },
        { status: "Ungültige Telefonnummer", meaning: "Keine gültige Schweizer Nummer.", next: "Format +41 79 123 45 67 verwenden." },
        { status: "Fehlende Kundendaten", meaning: "Niedrige Sicherheit und kein Name erkannt.", next: "Vor- oder Nachnamen eintragen." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Zurückgehen verwirft alles",
      text: "Gehen Sie aus Schritt 2 zurück, fragt das Programm einmal nach — danach sind alle Korrekturen weg. Einen Zwischenstand gibt es nicht.",
    },
  ],

  whatHappensNext: [
    "Nach dem Speichern landen Sie in der Anfragenliste.",
    "Die neue Anfrage steht dort im passenden Servicereiter.",
    "Eine Offerte entsteht dabei nicht — die starten Sie mit «Offerte erstellen».",
  ],

  commonMistakes: [
    "Nur einen Halbsatz einfügen. Je weniger Text, desto weniger wird erkannt.",
    "Das Ergebnis ungeprüft speichern. Die Auswertung rät, besonders bei kurzen Nachrichten.",
    "Erwarten, dass gleich eine Offerte entsteht. Das ist ein zweiter, eigener Schritt.",
  ],

  ifSomethingGoesWrong: [
    "Die Spracheingabe fehlt: Ihr Browser unterstützt keine Aufnahme. Nutzen Sie einen aktuellen Chrome, Firefox oder Edge.",
    "Die Auswertung erkennt fast nichts: Der Text ist zu knapp oder enthält kaum Angaben. Ergänzen Sie ihn und starten Sie erneut.",
    "«Fehler beim Speichern»: Prüfen Sie die Verbindung und versuchen Sie es erneut — der Text bleibt im Feld stehen.",
  ],
} satisfies WikiArticleBody;

export default body;
