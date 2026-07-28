import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anmelden-abmelden",
  locale: "de",
  title: "Anmelden und abmelden",
  summary: "Wie Sie sich anmelden, ein vergessenes Passwort zurücksetzen und sich sicher abmelden.",

  purpose:
    "Sie melden sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an. Danach sehen Sie nur die Daten Ihrer Firma.",

  whenToUse: [
    "Sie beginnen Ihren Arbeitstag.",
    "Sie haben Ihr Passwort vergessen.",
    "Sie arbeiten an einem fremden Computer und möchten sich danach abmelden.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "anmelden",
      text: "Anmelden",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/anmeldung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Anmeldeseite mit den beiden Feldern und der Schaltfläche «Anmelden».",
      alt: "Anmeldeseite mit einem Feld für die E-Mail-Adresse, einem Feld für das Passwort, dem Link «Passwort vergessen» und der Schaltfläche «Anmelden».",
    },
    {
      kind: "steps",
      steps: [
        { text: "Tragen Sie Ihre E-Mail-Adresse in das Feld «E-Mail» ein." },
        {
          text: "Tragen Sie Ihr Passwort in das Feld «Passwort» ein.",
          note: "Mit dem Augensymbol am Ende des Feldes können Sie das Passwort sichtbar machen und prüfen.",
        },
        {
          text: "Klicken Sie auf «Anmelden».",
          note: "Sie landen auf der Übersicht. Oben links steht Ihr Firmenname.",
        },
      ],
    },
    {
      kind: "heading",
      id: "passwort-vergessen",
      text: "Passwort vergessen",
    },
    {
      kind: "steps",
      steps: [
        { text: "Klicken Sie auf der Anmeldeseite auf «Passwort vergessen»." },
        { text: "Tragen Sie Ihre E-Mail-Adresse ein und klicken Sie auf «Reset-Link senden»." },
        {
          text: "Öffnen Sie die E-Mail und folgen Sie dem Link.",
          note: "Der Link führt auf eine Seite, auf der Sie ein neues Passwort vergeben.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Keine E-Mail erhalten?",
      text: "Schauen Sie im Spam-Ordner nach. Prüfen Sie ausserdem, ob Sie die Adresse richtig geschrieben haben.",
    },
    {
      kind: "heading",
      id: "abmelden",
      text: "Abmelden",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Klicken Sie oben rechts auf Ihren Namen.",
          note: "Es öffnet sich ein kleines Menü mit Ihrer E-Mail-Adresse und Ihrer Rolle.",
        },
        { text: "Klicken Sie auf «Abmelden»." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "An fremden Geräten immer abmelden",
      text: "Ohne Abmelden bleibt die Sitzung im Browser bestehen. Die nächste Person am Gerät sieht dann Ihre Firmendaten.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Meldungen beim Anmelden",
    },
    {
      kind: "statusTable",
      headers: { status: "Meldung", meaning: "Bedeutung", next: "Ihr nächster Schritt" },
      rows: [
        {
          status: "E-Mail oder Passwort ist falsch.",
          meaning: "Die Angaben passen nicht zusammen.",
          next: "Tippen Sie das Passwort erneut, mit sichtbarem Text.",
        },
        {
          status: "Keine Firma gefunden",
          meaning: "Ihr Zugang ist noch keiner Firma zugeordnet.",
          next: "Melden Sie sich bei der Person, die Ihren Zugang eingerichtet hat.",
        },
        {
          status: "Firma noch nicht verifiziert",
          meaning: "Die Firma ist angelegt, aber noch nicht freigeschaltet.",
          next: "Warten Sie auf die Freischaltung. Sie können noch nicht arbeiten.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Nach der Anmeldung sind Sie auf der Übersicht.",
    "Das Programm merkt sich die Anmeldung in diesem Browser, bis Sie sich abmelden.",
    "Ihre Rolle steht im Menü oben rechts unter Ihrer E-Mail-Adresse.",
  ],

  commonMistakes: [
    "Ein Leerzeichen am Anfang oder Ende der E-Mail-Adresse. Das Feld nimmt es an, die Anmeldung misslingt.",
    "Den Reset-Link mehrfach anfordern und dann den ältesten benutzen. Gültig ist immer die neueste E-Mail.",
    "Am gemeinsam genutzten Computer nur den Tab schliessen statt sich abzumelden.",
  ],

  ifSomethingGoesWrong: [
    "Anmeldung schlägt wiederholt fehl: Setzen Sie das Passwort über «Passwort vergessen» neu.",
    "Nach der Anmeldung erscheint «Keine Firma gefunden»: Ihr Zugang ist noch nicht verknüpft. Das können Sie nicht selbst lösen.",
    "Die Seite bleibt weiss: Laden Sie die Seite neu. Hilft das nicht, prüfen Sie Ihre Internetverbindung.",
  ],
} satisfies WikiArticleBody;

export default body;
