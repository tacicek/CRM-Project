import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfragen-liste",
  locale: "de",
  title: "Die Anfragenliste",
  summary: "Alle eingegangenen Anfragen, nach Service gruppiert — und der Weg zur Offerte.",

  purpose:
    "Hier landet jede Anfrage: aus dem Webformular, aus dem E-Mail-Eingang oder von Hand erfasst. Von hier starten Sie die Offerte.",

  whenToUse: [
    "Am Morgen, um zu sehen, was über Nacht hereinkam.",
    "Sie suchen die Anfrage einer bestimmten Kundin.",
    "Sie möchten alle Reinigungsanfragen zusammen abarbeiten.",
    "Sie möchten sehen, wofür schon eine Offerte draussen ist.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/de/anfragen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Die Anfragenliste mit dem Reiterband und den Aktionen je Anfrage.",
      alt: "Anfragenliste mit einem Reiterband für Alle, Umzug, Reinigung, Transport und Offeriert, darunter Anfragekarten mit Name, Verkaufsstufe, Service, Route und einer Reihe von Schaltflächen.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 18, label: "Reiter je Servicegruppe, mit Anzahl." },
        { n: 2, xPct: 34, yPct: 24, label: "Suche über Name, Ort, E-Mail, Telefon und PLZ." },
        { n: 3, xPct: 30, yPct: 31, label: "Verkaufsstufe und Service der Anfrage." },
        { n: 4, xPct: 25, yPct: 43, label: "«Offerte erstellen» — der Hauptweg von hier." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Das Reiterband verstehen",
    },
    {
      kind: "paragraph",
      text: "«Alle» zeigt die Anfragen, zu denen es noch keine Offerte gibt. Ein Servicereiter erscheint nur, wenn dort auch etwas liegt.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Eine Anfrage wandert nach «Offeriert»",
      text: "Sobald Sie eine Offerte erstellt haben, verschwindet die Anfrage aus ihrem Servicereiter und steht im letzten Reiter «Offeriert». So sehen Sie unter «Alle» immer nur die offene Arbeit.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Nicht jeder Service hat einen eigenen Reiter",
      text: "Ein Möbellift oder eine unbekannte Leistung erscheint nur unter «Alle». Klaviertransport landet im Reiter «Transport». Das kleine Plus am Ende des Bandes ist keine Schaltfläche.",
    },
    {
      kind: "heading",
      id: "eintrag",
      text: "Was auf einer Anfragekarte steht",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Name der Kundschaft — oder «Unbekannter Kunde», wenn kein Name erkannt wurde.",
        "Die Verkaufsstufe als graue Marke: Neu, Qualifizierung, Besichtigung, Offerte in Arbeit, Offerte versendet, In Verhandlung, Gewonnen oder Verloren.",
        "Der Service mit Symbol, zum Beispiel «Privatumzug».",
        "Die Sprache, aber nur wenn die Kundschaft nicht Deutsch spricht.",
        "Der Wunschtermin, wenn einer genannt wurde.",
        "Die Marke «Offerte Nr. …», sobald ein Angebot existiert.",
        "Darunter Route, Zimmer und Fläche, dann Telefon und E-Mail zum Anklicken.",
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Die Schaltflächen je Anfrage",
    },
    {
      kind: "statusTable",
      headers: { status: "Schaltfläche", meaning: "Wohin sie führt", next: "Wann sichtbar" },
      rows: [
        { status: "Offerte erstellen", meaning: "Zum Offertenformular mit übernommenen Angaben.", next: "Solange keine Offerte existiert." },
        { status: "Offerte ansehen", meaning: "Zur bestehenden Offerte.", next: "Sobald eine existiert." },
        { status: "Neue Offerte", meaning: "Legt eine zweite Offerte zur selben Anfrage an.", next: "Sobald eine existiert." },
        { status: "Kundenkarte", meaning: "Zur Kundenkarte.", next: "Nur wenn ein Kunde verknüpft ist." },
        { status: "Besichtigung", meaning: "Zur Besichtigungsplanung.", next: "Immer." },
        { status: "Termin planen", meaning: "In den Kalender mit vorbereitetem Termin.", next: "Immer." },
        { status: "Details", meaning: "Öffnet die Anfrage zum Lesen.", next: "Immer." },
        { status: "Bearbeiten", meaning: "Öffnet die Anfrage zum Korrigieren.", next: "Immer." },
      ],
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Suchen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tippen Sie in das Feld «In Anfragen suchen …».",
          note: "Gesucht wird in Name, Ort, E-Mail, Telefon und Postleitzahl — nicht in der Beschreibung.",
        },
        {
          text: "Ist ein Reiter aktiv, erscheint neben der Suche eine Marke mit dem Reiternamen.",
          note: "Ein Klick auf das «×» darin bringt Sie zurück zu «Alle».",
        },
      ],
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Eine Anfrage löschen",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Löschen lässt sich nicht rückgängig machen",
      text: "Der Papierkorb rechts entfernt die Anfrage nach einer kurzen Rückfrage des Browsers. Eine bereits erstellte Offerte bleibt bestehen, verliert aber die Verbindung zur Anfrage.",
    },
    {
      kind: "paragraph",
      text: "Löschen Sie nur echte Fehleingaben und Werbung. Eine abgesagte Anfrage lassen Sie besser stehen — sie gehört zur Geschichte der Kundschaft.",
    },
  ],

  whatHappensNext: [
    "«Offerte erstellen» öffnet das Formular mit allen Angaben aus der Anfrage.",
    "Sobald die Offerte gespeichert ist, wandert die Anfrage in den Reiter «Offeriert».",
    "Die Verkaufsstufe zieht automatisch mit, sobald Sie senden oder die Kundschaft zusagt.",
  ],

  commonMistakes: [
    "Eine Anfrage suchen, die schon eine Offerte hat, und im Reiter «Alle» nachsehen. Sie steht unter «Offeriert».",
    "Nach einem Wort aus der Beschreibung suchen. Die Suche prüft Name, Ort, E-Mail, Telefon und PLZ.",
    "Erledigte Anfragen löschen, um aufzuräumen. Damit verlieren Sie die Vorgeschichte.",
  ],

  ifSomethingGoesWrong: [
    "Ein Reiter fehlt: Es gibt zu dieser Servicegruppe gerade keine offene Anfrage.",
    "Eine Anfrage taucht nirgends auf: Ihr Service passt in keine Gruppe. Schauen Sie unter «Alle».",
    "«Kundenkarte» fehlt bei einer Anfrage: Zu ihr ist noch kein Kundeneintrag verknüpft.",
  ],
} satisfies WikiArticleBody;

export default body;
