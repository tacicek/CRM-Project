import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-details",
  locale: "de",
  title: "Eine Anfrage ansehen und korrigieren",
  summary: "Alle Angaben lesen — und falsch erkannte Felder richtigstellen.",

  purpose:
    "Anfragen kommen oft aus einer E-Mail und werden automatisch ausgewertet. Bevor Sie eine Offerte schreiben, prüfen Sie die Angaben und korrigieren, was nicht stimmt.",

  whenToUse: [
    "Vor jeder Offerte, um die Angaben zu prüfen.",
    "Die Kundschaft ruft an und nennt eine andere Adresse.",
    "Die automatische Auswertung hat die Sprache falsch geraten.",
    "Eine Telefonnummer oder Postleitzahl fehlt.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Zwei Fenster, zwei Zwecke",
      text: "«Details» ist nur zum Lesen und gibt schnell den Überblick. «Bearbeiten» öffnet das Formular zum Ändern.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/anfrage-details-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Das Detailfenster mit Kontakt, Adressen und Beschreibung.",
      alt: "Über der Anfragenliste geöffnetes Fenster mit dem Namen der Kundschaft, den Kontaktdaten, den Adressen für Von und Nach, Termin, Zimmer und Fläche sowie der Beschreibung.",
    },
    {
      kind: "heading",
      id: "lesen",
      text: "Die Angaben lesen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf einer Anfragekarte auf «Details».",
          note: "Das Fenster legt sich über die Liste. Ändern lässt sich hier nichts.",
        },
        {
          text: "Lesen Sie Kontakt, Adresse, Termin, Zimmer, Fläche und Beschreibung.",
          note: "Die Beschreibung enthält oft den ursprünglichen Text der Kundschaft.",
        },
        {
          text: "Unten wählen Sie «Offerte erstellen» oder «Bearbeiten».",
        },
      ],
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Angaben korrigieren",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie auf «Bearbeiten» — auf der Karte oder im Detailfenster.",
        },
        {
          text: "Ergänzen Sie oben unter «Kontakt», was fehlt.",
          note: "Vorname, Nachname, E-Mail, Telefon, Wunschtermin und die Sprache der Kundschaft.",
        },
        {
          text: "Prüfen Sie darunter die Felder zum jeweiligen Service.",
          note: "Bei einem Umzug etwa Auszugs- und Einzugsadresse mit Etage, Lift, Zimmern und Fläche.",
        },
        {
          text: "Klicken Sie auf «Speichern».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Die Sprache entscheidet, was die Kundschaft liest",
      text: "«Sprache des Kunden» steuert Offerte, PDF und E-Mails — nicht Ihre eigene Ansicht. Hat die automatische Auswertung falsch geraten, korrigieren Sie es hier, bevor Sie die Offerte senden.",
    },
    {
      kind: "heading",
      id: "pruefungen",
      text: "Was beim Speichern geprüft wird",
    },
    {
      kind: "statusTable",
      headers: { status: "Meldung", meaning: "Ursache", next: "Was tun" },
      rows: [
        { status: "Ungültige E-Mail", meaning: "Die Adresse hat kein gültiges Format.", next: "Adresse prüfen oder Feld leeren." },
        { status: "Ungültige Telefonnummer", meaning: "Keine gültige Schweizer Nummer.", next: "Im Format +41 79 123 45 67 eintragen." },
        { status: "Ungültige PLZ", meaning: "Eine Postleitzahl hat nicht vier Ziffern.", next: "Vierstellig eintragen." },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Was sich hier nicht ändern lässt",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Den Servicetyp. Er wird beim Import festgelegt und bleibt danach fest.",
        "Die Verkaufsstufe. Sie zieht automatisch mit, sobald eine Offerte entsteht oder gesendet wird.",
        "Das Eingangsdatum und die verknüpfte Kundschaft.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Falscher Servicetyp?",
      text: "Legen Sie die Anfrage neu an — über «Neue Anfrage» und den Text der Kundschaft — und löschen Sie danach die falsche.",
    },
  ],

  whatHappensNext: [
    "Gespeicherte Korrekturen stehen sofort auf der Anfragekarte.",
    "Die Offerte übernimmt beim Erstellen genau diese Angaben.",
    "Die Sprache wandert von hier in Offerte, PDF und E-Mails.",
  ],

  commonMistakes: [
    "Die Angaben erst in der Offerte korrigieren. Dann steht auf der Anfrage weiter das Falsche.",
    "«Sprache des Kunden» mit der eigenen Ansicht verwechseln.",
    "Eine Postleitzahl mit Ortsnamen eintragen. Es gehören nur die vier Ziffern hinein.",
  ],

  ifSomethingGoesWrong: [
    "«Speichern» reagiert nicht: Eine Prüfung schlägt an. Die Meldung nennt das Feld.",
    "Nach dem Speichern fehlt eine Angabe: Prüfen Sie, ob Sie im richtigen Serviceabschnitt getippt haben — es gibt mehrere Adressblöcke.",
    "Der Servicetyp ist falsch: Legen Sie die Anfrage neu an; ändern lässt er sich nicht.",
  ],
} satisfies WikiArticleBody;

export default body;
