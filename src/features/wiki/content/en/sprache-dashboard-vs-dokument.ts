import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "sprache-dashboard-vs-dokument",
  locale: "en",
  title: "Two languages: yours and the customer's",
  summary: "Why you work in English while the customer still reads French.",

  purpose:
    "The program keeps two languages apart. One is the language of your own screen. The other is the language the customer is written to in.",

  whenToUse: [
    "You use the program in English but have French-speaking customers.",
    "A quote went out in the wrong language.",
    "You want to change your own screen without changing customer documents.",
    "A new team member prefers to work in German.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "The most important sentence on this page",
      text: "Changing the language in the top right changes only your own view. No customer document and no customer email changes because of it.",
    },
    {
      kind: "heading",
      id: "die-zwei-sprachen",
      text: "The two languages compared",
    },
    {
      kind: "statusTable",
      headers: { status: "Language", meaning: "Applies to", next: "Where you change it" },
      rows: [
        {
          status: "Your own screen",
          meaning: "Menus, buttons and labels that only you see.",
          next: "Top right in the bar, next to the bell.",
        },
        {
          status: "The customer's language",
          meaning: "Quote, invoice, receipt, email, SMS and the pages the customer opens.",
          next: "When the enquiry is recorded, or when the quote is written.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eigene-sprache-aendern",
      text: "Changing your own language",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "The language choice sits in the top bar, between the bell and the help button.",
      alt: "Top bar with the notification bell, next to it the language choice showing the code EN, then the Help and guide button.",
      hotspots: [
        { n: 1, xPct: 72, yPct: 50, label: "Your current language shows here: DE, FR or EN." },
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "In the top bar, click the language code, for example “EN”.",
          note: "A list opens with Deutsch, Français and English.",
        },
        {
          text: "Choose your language.",
          note: "The page switches straight away. Your data does not change.",
        },
        {
          text: "Choose the company-language option if you want to follow the company default.",
          note: "Your view then uses whatever language is set in the company settings.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The choice applies to this browser only",
      text: "Your colleagues keep seeing their own language. On another device you have to choose again.",
    },
    {
      kind: "heading",
      id: "kundensprache",
      text: "The customer's language",
    },
    {
      kind: "paragraph",
      text: "The customer's language is set when the enquiry is recorded. From there it travels to the quote, the work order, the invoice and the receipt.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "The quote is written and sent in that language.",
        "The page the customer opens through the link appears in that language.",
        "Email and SMS reminders go out in that language, even when nobody on the team triggers them.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "After sending, the language is fixed",
      text: "A sent quote can no longer be changed, and neither can its language. If the language is wrong, create a new version of the quote.",
    },
    {
      kind: "heading",
      id: "beispiel",
      text: "An example",
    },
    {
      kind: "paragraph",
      text: "Anna works in German. Her customer Luc Exemple lives in Geneva and speaks French.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Anna sees the whole program in German.",
        "The enquiry has French recorded as the language.",
        "The quote Anna writes is in French.",
        "Luc receives a French email and opens a French page.",
        "If Anna switches her view to English, Luc's quote stays French.",
      ],
    },
  ],

  whatHappensNext: [
    "Your language choice applies immediately and is remembered in this browser.",
    "Documents keep the language recorded when they were created.",
    "Automatic reminders use the language stored on the record.",
  ],

  commonMistakes: [
    "Changing your own language and expecting customers to be written to in it from now on.",
    "Noticing the customer's language only after sending. After that, only a new version of the quote helps.",
    "Assuming the language applies to the whole company. It applies per customer and per document.",
  ],

  ifSomethingGoesWrong: [
    "A document went out in the wrong language: create a new version of the quote in the right language and send that.",
    "Your view reverts after a reload: you are following the company language. Pick a language explicitly instead.",
    "A text appears in German although you chose English: report where you saw it. A translation is missing.",
  ],
} satisfies WikiArticleBody;

export default body;
