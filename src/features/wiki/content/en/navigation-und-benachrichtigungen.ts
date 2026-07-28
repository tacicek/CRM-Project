import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "navigation-und-benachrichtigungen",
  locale: "en",
  title: "Menu, top bar and notifications",
  summary: "How to move around the program and where to see what is new.",

  purpose:
    "The program has two fixed parts: the menu on the left and the bar along the top. Both are the same on every page.",

  whenToUse: [
    "You are looking for a menu entry and cannot find it.",
    "A number appears next to an entry and you want to know what it means.",
    "You want to turn sounds and alerts on or off.",
    "You are working on a phone and cannot see the menu.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "seitenleiste",
      text: "The side menu",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/seitenleiste-v1.webp",
      width: 240,
      height: 1400,
      caption: "The side menu, split into quick access and three groups.",
      alt: "Side menu with the company name at the top, then Overview, Enquiries, Email inbox, Quotes and Calendar, then the groups Main area, Operations and Administration, each entry with an icon and a label.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 4, label: "Your company name. The search box sits below it." },
        { n: 2, xPct: 50, yPct: 15, label: "Quick access: the five most-used pages." },
        { n: 3, xPct: 50, yPct: 40, label: "Main area: customers, money and work in progress." },
        { n: 4, xPct: 50, yPct: 87, label: "Administration: services, pricing, archive, settings and this help." },
      ],
    },
    {
      kind: "paragraph",
      text: "Every entry has an icon and a label. The label is what matters; the icon only helps you recognise it again.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Numbers next to an entry",
      text: "A number to the right of a menu entry shows how many items are waiting for you. It appears for “Email inbox”, “Viewings” and “Moving boxes”.",
    },
    {
      kind: "heading",
      id: "kopfzeile",
      text: "The top bar",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "The top bar with the page name, the bell, the language choice, help and your account menu.",
      alt: "Narrow bar along the top of the screen. On the left the company name and the current page name. On the right a bell with a counter, the language choice, the Help and guide button and the account menu.",
      hotspots: [
        { n: 1, xPct: 18, yPct: 50, label: "Company name and the current page." },
        { n: 2, xPct: 67, yPct: 50, label: "Bell: new alerts, with a count." },
        { n: 3, xPct: 72, yPct: 50, label: "Language of the interface." },
        { n: 4, xPct: 80, yPct: 50, label: "Help for the page you are on." },
        { n: 5, xPct: 92, yPct: 50, label: "Your account, sounds and signing out." },
      ],
    },
    {
      kind: "heading",
      id: "benachrichtigungen",
      text: "Notifications",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click the bell in the top bar.",
          note: "The number on the bell shows how many alerts you have not read yet.",
        },
        {
          text: "Click an alert to jump to the matching page.",
          note: "An appointment alert leads to the calendar, a quote alert leads to the quote.",
        },
        {
          text: "“Mark all read” resets the counter.",
          note: "The alerts stay in the list; only the counter goes to zero.",
        },
      ],
    },
    {
      kind: "heading",
      id: "toene",
      text: "Sounds and on-screen alerts",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click your name in the top right." },
        {
          text: "Turn “Sound on” on or off.",
          note: "It shows “On” or “Off” to the right. The sound plays for new enquiries and appointment changes.",
        },
        {
          text: "Turn “Push on” on if you want alerts outside the browser window.",
          note: "The browser asks for permission once. Answer “Allow”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Alerts blocked”",
      text: "If you see this in the menu, the browser has blocked alerts. That can only be changed in the browser's own settings, not here.",
    },
    {
      kind: "heading",
      id: "am-handy",
      text: "On the phone",
    },
    {
      kind: "paragraph",
      text: "On a narrow screen there is no sidebar. A bar along the bottom takes its place, holding the five most important destinations. The last button is called \u201cMore\u201d and opens everything else.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Tap Overview, Requests, Quotes or Calendar at the bottom to go there." },
        {
          text: "For anything else, tap \u201cMore\u201d at the bottom right.",
          note: "It holds customers, finances, jobs, invoices and administration — the same entries as the sidebar on a computer.",
        },
        { text: "To close it, drag the panel down or tap beside it." },
        {
          text: "The magnifier at the top left searches.",
          note: "It covers the same destinations as the search field on a computer.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The round button at the bottom right",
      text: "It creates a new request. It floats above the list and stays visible.",
    },
    {
      kind: "heading",
      id: "erscheinungsbild",
      text: "Light and dark appearance",
    },
    {
      kind: "paragraph",
      text: "You can switch between a light and a dark appearance. The setting only affects your own view of the program — quotes, invoices and emails to your customers stay the same.",
    },
    {
      kind: "steps",
      steps: [
        { text: "On a computer: tap your name at the top right, then choose under \u201cAppearance\u201d." },
        { text: "On a phone: tap \u201cMore\u201d at the bottom, then \u201cAppearance\u201d at the very bottom." },
        {
          text: "\u201cMatch system\u201d follows your device setting.",
          note: "If your phone switches to dark in the evening, the program follows.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "The number on the bell falls as soon as you mark alerts as read.",
    "The numbers next to menu entries fall as soon as you deal with those items.",
    "Your sound and alert setting applies to this browser, not to your account overall.",
  ],

  commonMistakes: [
    "Confusing the menu numbers with notifications. The menu counts open items; the bell counts unread alerts.",
    "Choosing “Clear all” instead of “Mark all read”. Clearing removes the alerts from the list.",
    "Expecting the sound setting to be the same on every device. It applies per browser.",
  ],

  ifSomethingGoesWrong: [
    "A menu entry is missing: it may be switched off for this company. Ask whoever looks after the settings.",
    "No sounds play: check in your account menu that “Sound on” is set, and check the device volume.",
    "The bell shows a number but the list is empty: reload the page.",
  ],
} satisfies WikiArticleBody;

export default body;
