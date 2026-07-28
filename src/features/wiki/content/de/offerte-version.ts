import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-version",
  locale: "de",
  title: "Eine neue Version einer Offerte",
  summary: "Wenn sich nach dem Senden noch etwas ändert — und wie Sie die Fassungen auseinanderhalten.",

  purpose:
    "Eine gesendete Offerte ist gesperrt. Möchten Sie trotzdem etwas ändern, legen Sie eine neue Version an. Die alte bleibt als Beleg bestehen.",

  whenToUse: [
    "Die Kundschaft wünscht nach dem Senden eine zusätzliche Leistung.",
    "Sie haben einen Preis falsch gerechnet und die Offerte ist schon draussen.",
    "Ein Termin verschiebt sich und die Offerte nennt ein Datum.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Erst nach dem Senden, und nur vor der Zusage",
      text: "Bei einem Entwurf bearbeiten Sie direkt. Bei einer angenommenen Offerte brauchen Sie einen Nachtrag. Die neue Version liegt genau dazwischen.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Eine neue Version anlegen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie die gesendete Offerte aus der Liste.",
        },
        {
          text: "Klicken Sie oben rechts auf «Neue Version».",
          note: "Die Schaltfläche fehlt, wenn die Offerte noch Entwurf, bereits angenommen oder selbst schon überholt ist.",
        },
        {
          text: "Sie landen im Bearbeiten-Formular der neuen Fassung.",
          note: "Alle Positionen sind übernommen. Die neue Fassung ist ein Entwurf.",
        },
        {
          text: "Passen Sie an, was sich geändert hat, und senden Sie die Offerte.",
          note: "Über «Speichern & Senden» geht sie an dieselbe Adresse.",
        },
      ],
    },
    {
      kind: "heading",
      id: "was-passiert",
      text: "Was dabei mit der alten Fassung passiert",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Die alte Fassung bleibt unverändert bestehen — als Beleg dessen, was die Kundschaft gesehen hat.",
        "Sie wird als überholt markiert und zeigt oben den roten Hinweis «Zu dieser Fassung gibt es eine neuere Version».",
        "Ihr Link bleibt erreichbar, aber die Kundschaft kann darüber nicht mehr zusagen.",
        "Öffnet jemand den alten Link, sieht er einen Hinweis, dass es eine neuere Fassung gibt.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/de/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die überholte Fassung — rot markiert und ohne Schaltfläche für eine weitere Version.",
      alt: "Detailansicht einer überholten Offerte mit dem roten Hinweis, dass es zu dieser Fassung eine neuere Version gibt, und nur noch der Schaltfläche zum Herunterladen des PDF.",
      hotspots: [
        { n: 1, xPct: 32, yPct: 12, label: "Der rote Hinweis auf die neuere Fassung." },
        { n: 2, xPct: 92, yPct: 10, label: "Nur noch PDF — keine Änderung mehr möglich." },
      ],
    },
    {
      kind: "heading",
      id: "auseinanderhalten",
      text: "Die Fassungen auseinanderhalten",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Die Nummer bleibt gleich",
      text: "Version 2 trägt dieselbe Offertennummer wie Version 1. In der Offertenliste stehen beide als eigene Zeilen mit derselben Nummer — die Liste zeigt keine Versionsnummer.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Schauen Sie in der Liste auf Datum und Status.",
          note: "Die neuere Fassung ist jünger und meist noch «Entwurf».",
        },
        {
          text: "Öffnen Sie die Offerte, um sicherzugehen.",
          note: "Ab Version 2 steht oben «Version 2». Bei der überholten Fassung steht der rote Hinweis.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Wann es nicht geht",
    },
    {
      kind: "statusTable",
      headers: { status: "Meldung", meaning: "Warum", next: "Was stattdessen" },
      rows: [
        { status: "Es gibt bereits eine neuere Version", meaning: "Sie sind auf einer überholten Fassung.", next: "Die neueste öffnen und dort weitermachen." },
        { status: "Die Offerte ist angenommen", meaning: "Der Umfang ist vereinbart.", next: "Einen Nachtrag erstellen." },
        { status: "Die Offerte ist noch ein Entwurf", meaning: "Nichts ist gesperrt.", next: "Direkt bearbeiten." },
      ],
    },
  ],

  whatHappensNext: [
    "Die neue Fassung ist ein Entwurf und trägt dieselbe Offertennummer.",
    "Nach dem Senden gilt sie als die aktuelle; die alte bleibt als Beleg.",
    "Die Kundschaft kann nur noch über die neueste Fassung zusagen.",
  ],

  commonMistakes: [
    "Die alte Fassung löschen wollen. Sie ist der Beleg dafür, was die Kundschaft ursprünglich erhalten hat.",
    "Der Kundschaft den alten Link erneut schicken. Darüber kann sie nicht mehr zusagen — kopieren Sie den Link der neuen Fassung.",
    "Bei einer bereits angenommenen Offerte nach «Neue Version» suchen. Dort gibt es nur den Nachtrag.",
  ],

  ifSomethingGoesWrong: [
    "Die Schaltfläche «Neue Version» fehlt: Die Offerte ist Entwurf, angenommen oder selbst schon überholt.",
    "Sie wissen nicht, welche Fassung die aktuelle ist: Öffnen Sie beide; die überholte trägt den roten Hinweis.",
    "Sie haben versehentlich zwei neue Versionen angelegt: Senden Sie nur die letzte. Nicht gesendete Entwürfe können Sie löschen.",
  ],
} satisfies WikiArticleBody;

export default body;
