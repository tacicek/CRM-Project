import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "typischer-arbeitstag",
  locale: "de",
  title: "Ein typischer Arbeitstag",
  summary: "Eine kurze Liste, was Sie morgens, tagsüber und am Abend prüfen.",

  purpose:
    "Diese Anleitung gibt Ihnen eine feste Reihenfolge für den Tag. Wenn Sie sie einhalten, bleibt nichts liegen.",

  whenToUse: [
    "In den ersten Wochen, bis die Reihenfolge sitzt.",
    "Nach Ferien oder Krankheit, um den Rückstand geordnet abzubauen.",
    "Wenn Sie eine Vertretung einarbeiten.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "morgens",
      text: "Am Morgen: den Tag sichten",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie «Übersicht».",
          note: "Vier Kacheln zeigen sofort, wo etwas offen ist.",
        },
        {
          text: "Schauen Sie unter «Heute», welche Termine anstehen.",
          note: "Prüfen Sie, ob für jeden Einsatz Team und Fahrzeug feststehen.",
        },
        {
          text: "Öffnen Sie «E-Mail-Eingang», wenn dort eine Zahl steht.",
          note: "Diese Nachrichten warten darauf, dass Sie sie zu einer Anfrage machen oder verwerfen.",
        },
        {
          text: "Öffnen Sie «Wiedervorlage».",
          note: "Hier stehen Aufgaben mit Datum. Überfällige sind hervorgehoben.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Reihenfolge mit Absicht",
      text: "Erst der Überblick, dann der Posteingang, dann die eigenen Aufgaben. So entscheiden Sie über Neues, bevor der Tag Sie einholt.",
    },
    {
      kind: "heading",
      id: "tagsueber",
      text: "Tagsüber: aus Anfragen Offerten machen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Öffnen Sie «Anfragen» und arbeiten Sie die neuen von oben nach unten ab.",
          note: "Neue Anfragen sind mit «Neu» gekennzeichnet.",
        },
        {
          text: "Entscheiden Sie je Anfrage: Offerte schreiben oder zuerst besichtigen.",
          note: "Bei grossen oder unklaren Aufträgen lohnt sich die Besichtigung.",
        },
        {
          text: "Prüfen Sie vor dem Senden die Sprache der Kundschaft.",
          note: "Nach dem Senden lässt sich die Offerte nicht mehr ändern.",
        },
        {
          text: "Legen Sie sich eine Wiedervorlage, wenn Sie nachfassen möchten.",
          note: "So erinnert Sie das Programm, statt dass Sie daran denken müssen.",
        },
      ],
    },
    {
      kind: "heading",
      id: "nach-dem-einsatz",
      text: "Nach einem Einsatz: abrechnen",
    },
    {
      kind: "steps",
      steps: [
        { text: "Öffnen Sie «Aufträge» und schliessen Sie den erledigten Auftrag ab." },
        {
          text: "Erstellen Sie eine Rechnung oder eine Quittung.",
          note: "Eine Quittung passt, wenn direkt vor Ort bezahlt wird. Sonst nehmen Sie eine Rechnung.",
        },
        {
          text: "Tragen Sie eingegangene Zahlungen unter «Finanzen» ein.",
          note: "Der Status der Rechnung folgt automatisch aus den erfassten Zahlungen.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Rechnungen nicht von Hand auf «bezahlt» setzen",
      text: "Es gibt keinen Schalter dafür, und das ist Absicht. Tragen Sie die Zahlung ein; der Status ergibt sich daraus von selbst.",
    },
    {
      kind: "heading",
      id: "abends",
      text: "Am Abend: kurz aufräumen",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Prüfen Sie in «Posteingang», ob eine Kundennachricht ohne Antwort geblieben ist.",
          note: "Antworten schreiben Sie in Ihrem gewohnten E-Mail-Programm; das Programm zeigt hier nur die Übersicht.",
        },
        {
          text: "Schauen Sie in «Fälle», ob eine Reklamation offen ist.",
          note: "Ein offener Fall am Abend ist am nächsten Morgen ein verärgerter Anruf.",
        },
        {
          text: "Werfen Sie einen Blick in den «Kalender» auf morgen.",
          note: "Fehlt irgendwo das Team, merken Sie es heute noch.",
        },
      ],
    },
    {
      kind: "heading",
      id: "wochenrhythmus",
      text: "Einmal pro Woche",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "«Kennzahlen» öffnen und schauen, wie viele Offerten zu Aufträgen wurden.",
        "«Finanzen» auf überfällige Rechnungen prüfen.",
        "«Umzugsboxen» prüfen, wenn Sie Boxen vermieten: Welche sind überfällig?",
      ],
    },
  ],

  whatHappensNext: [
    "Nach dieser Runde ist keine Anfrage älter als einen Tag unbeantwortet.",
    "Jede erledigte Arbeit hat eine Rechnung oder eine Quittung.",
    "Alles, was Sie später nochmals anfassen wollen, steht als Wiedervorlage mit Datum.",
  ],

  commonMistakes: [
    "Anfragen sammeln und einmal pro Woche abarbeiten. Wer zuerst offeriert, gewinnt den Auftrag meistens.",
    "Zahlungen erst am Monatsende eintragen. Bis dahin stimmt keine Zahl unter «Finanzen».",
    "Wiedervorlagen anlegen und nie öffnen. Die Liste hilft nur, wenn Sie täglich hineinsehen.",
  ],

  ifSomethingGoesWrong: [
    "Sie haben den Überblick verloren: Beginnen Sie bei «Wiedervorlage» und arbeiten Sie die überfälligen Einträge ab.",
    "Sehr viele offene Anfragen: Sortieren Sie nach Datum und beginnen Sie bei den ältesten.",
    "Sie wissen bei einem Auftrag nicht, ob schon abgerechnet wurde: Öffnen Sie den Auftrag; verknüpfte Rechnungen und Quittungen stehen dort.",
  ],
} satisfies WikiArticleBody;

export default body;
