import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender-abo",
  locale: "de",
  title: "Kalender abonnieren",
  summary:
    "Ihre Termine im Handy- oder Computer-Kalender abonnieren — je Termin-Typ ein eigener, farbiger Kalender.",

  purpose:
    "Ihre CRM-Termine erscheinen als Abo in dem Kalender, den Sie ohnehin benutzen: Apple, Google oder Outlook. Jeder Termin-Typ wird dort ein eigener Kalender mit eigener Farbe, einzeln ein- und ausblendbar.",

  whenToUse: [
    "Sie möchten Ihre Einsätze auf dem Handy sehen, ohne das Programm zu öffnen.",
    "Das Team soll Firmentermine neben den privaten Terminen im gewohnten Kalender haben.",
    "Ein Gerät ist verloren gegangen oder ein Link wurde weitergegeben — der Zugriff soll weg.",
    "Sie richten ein neues Handy ein und brauchen frische Abo-Links.",
  ],

  blocks: [
    {
      kind: "paragraph",
      text: "Die Verbindung läuft über einen geheimen Link je Termin-Typ: Besichtigungen, Dienstleistungen, Nachfassen, Besprechungen, blockierte Zeiten und weitere Termine. Sie abonnieren nur die Typen, die Sie sehen möchten.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Ein Kalender je Typ, mit fester Farbe",
      text: "Jeder abonnierte Kalender heisst nach Firma und Typ, zum Beispiel «Hirschenumzug GmbH – Besichtigungen», und trägt die Farbe, die der Typ auch im Programm hat. So blenden Sie etwa Besprechungen aus, ohne die Einsätze zu verlieren.",
    },
    {
      kind: "heading",
      id: "einrichten",
      text: "So richten Sie es ein",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie «Einstellungen» und wechseln Sie zum Reiter «Kalender».",
        },
        {
          text: "Geben Sie eine Bezeichnung ein, zum Beispiel «iPhone Anna».",
          note: "So erkennen Sie später, welchem Gerät oder welcher Person Sie den Zugriff wieder entziehen.",
        },
        {
          text: "Klicken Sie auf «Token erzeugen».",
          note: "Die Abo-Links darunter erscheinen nur dieses eine Mal. Kopieren Sie sie jetzt.",
        },
        {
          text: "Kopieren Sie den Link des gewünschten Termin-Typs über das Kopier-Symbol.",
        },
        {
          text: "Fügen Sie den Link in Ihrem Kalender-Programm als Abo ein und wiederholen Sie das für weitere Typen.",
          note: "Wo genau, steht gleich unten je Programm.",
        },
      ],
    },
    {
      kind: "heading",
      id: "apps",
      text: "Wo Sie den Link einfügen",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Apple Kalender (Mac): «Ablage › Neues Kalenderabonnement…», Link einsetzen. iPhone: «Einstellungen › Apps › Kalender › Kalenderaccounts › Account hinzufügen › Andere › Kalenderabo hinzufügen».",
        "Google Kalender: im Browser links neben «Weitere Kalender» auf das Plus klicken und «Per URL» wählen.",
        "Outlook: im Kalender «Kalender hinzufügen › Aus dem Internet abonnieren».",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Der Link ist ein Passwort",
      text: "Wer den Link kennt, sieht Namen, Adressen und Telefonnummern Ihrer Termine — ohne Anmeldung. Leiten Sie ihn nicht weiter. Jede Person und jedes Gerät bekommt ein eigenes Token.",
    },
    {
      kind: "heading",
      id: "aktualisierung",
      text: "Aktualisierung und Richtung",
    },
    {
      kind: "paragraph",
      text: "Das Abo ist eine Einbahnstrasse: Was Sie im Programm ändern, erscheint im abonnierten Kalender — Änderungen im Handy-Kalender dagegen bewirken nichts. Termine bearbeiten Sie weiterhin hier im Programm.",
    },
    {
      kind: "paragraph",
      text: "Wie oft aktualisiert wird, entscheidet Ihr Kalender-Programm — üblich sind einige Minuten bis einige Stunden. Ein verschobener Termin ersetzt dabei seinen alten Eintrag, es entstehen keine Doppelten. Abgesagte Termine werden als abgesagt markiert.",
    },
    {
      kind: "heading",
      id: "widerrufen",
      text: "Zugriff widerrufen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie in «Einstellungen › Kalender» die Liste «Bestehende Tokens».",
          note: "«Zuletzt benutzt» zeigt, ob ein Token überhaupt noch abgerufen wird.",
        },
        {
          text: "Klicken Sie beim betroffenen Token auf «Widerrufen» und bestätigen Sie.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Widerrufen ist endgültig",
      text: "Alle Kalender-Abos, die mit diesem Token eingerichtet wurden, hören sofort auf zu funktionieren — auf jedem Gerät. Ein widerrufenes Token lässt sich nicht wiederbeleben; erzeugen Sie bei Bedarf ein neues und abonnieren Sie neu.",
    },
  ],

  whatHappensNext: [
    "Neue, verschobene und abgesagte Termine erscheinen nach der nächsten Aktualisierung von selbst.",
    "In der Token-Liste sehen Sie unter «Zuletzt benutzt», wann ein Kalender zuletzt abgerufen hat.",
    "Nach einem Widerruf meldet das Kalender-Programm den Kalender als nicht mehr erreichbar — entfernen Sie das tote Abo dort von Hand.",
  ],

  commonMistakes: [
    "Einen Link an mehrere Personen weiterleiten, statt jeder ein eigenes Token zu erzeugen — widerrufen trifft dann alle gemeinsam.",
    "Das Fenster schliessen, bevor die Links kopiert sind. Sie erscheinen nur einmal; erzeugen Sie dann einfach ein neues Token.",
    "Versuchen, einen Termin im Handy-Kalender zu ändern. Das Abo liest nur — bearbeitet wird im Programm.",
    "Sich wundern, dass eine Änderung nicht sofort da ist. Das Kalender-Programm holt sie erst bei der nächsten Aktualisierung.",
  ],

  ifSomethingGoesWrong: [
    "Der abonnierte Kalender bleibt leer: Prüfen Sie, ob der Link vollständig kopiert wurde, und abonnieren Sie neu.",
    "Das Kalender-Programm meldet einen Fehler beim Abruf: Das Token wurde vermutlich widerrufen. Erzeugen Sie ein neues und richten Sie das Abo neu ein.",
    "Ein Link ist in falsche Hände geraten: Widerrufen Sie das Token sofort — alle damit verbundenen Abos sind augenblicklich tot.",
  ],
} satisfies WikiArticleBody;

export default body;
