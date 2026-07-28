import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "dashboard-uebersicht",
  locale: "en",
  title: "The overview",
  summary: "Your home page: new enquiries, open quotes and today's appointments.",

  purpose:
    "The overview shows at a glance what needs your attention today. It is the best place to start the working day.",

  whenToUse: [
    "In the morning, to plan the day.",
    "After lunch, to see new enquiries.",
    "When you want to know how many quotes are still unanswered.",
    "When you want to jump quickly to another page.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/dashboard-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The overview with the four figures, today's appointments and the latest enquiries.",
      alt: "Home page of the program. Four tiles at the top showing numbers for new enquiries, open quotes, work orders this month and viewings. Below them today's appointments and a list of the latest enquiries.",
      hotspots: [
        { n: 1, xPct: 28, yPct: 25, label: "Four tiles with the key numbers." },
        { n: 2, xPct: 45, yPct: 45, label: "Today's appointments." },
        { n: 3, xPct: 45, yPct: 78, label: "The most recently received enquiries." },
        { n: 4, xPct: 85, yPct: 62, label: "Reminder about new enquiries, plus quick access." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-kacheln",
      text: "The four tiles",
    },
    {
      kind: "statusTable",
      headers: { status: "Tile", meaning: "What the number means", next: "Your next step" },
      rows: [
        {
          status: "New enquiries",
          meaning: "Enquiries that do not have a quote yet.",
          next: "Write a quote or arrange a viewing.",
        },
        {
          status: "Open quotes",
          meaning: "Quotes you sent that the customer has not answered.",
          next: "Follow up on the older ones.",
        },
        {
          status: "Work orders this month",
          meaning: "Jobs planned within the current month.",
          next: "Check in the calendar that a team and a vehicle are assigned.",
        },
        {
          status: "Viewings",
          meaning: "Viewings that happen before a job is awarded.",
          next: "Confirm the appointment or record the result.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Every tile is a shortcut",
      text: "Under each number there is “Details”. Clicking it opens the matching list.",
    },
    {
      kind: "heading",
      id: "heute",
      text: "Today",
    },
    {
      kind: "paragraph",
      text: "The “Today” area lists every appointment for the day. Clicking an appointment opens it in the calendar.",
    },
    {
      kind: "heading",
      id: "letzte-anfragen",
      text: "Latest enquiries",
    },
    {
      kind: "paragraph",
      text: "This shows the five newest enquiries. A green tick means a quote already exists. An orange dot with “New” means nothing has happened yet.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click an enquiry in the list." },
        {
          text: "Check the customer's details.",
          note: "Address, date and scope are right at the top.",
        },
        {
          text: "Click “Show all” if you want to see more than five enquiries.",
          note: "That opens the full list under “Enquiries”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "unterwegs",
      text: "On a phone",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/dashboard-uebersicht-mobile-v1.webp",
      width: 780,
      height: 1688,
      caption: "The same overview on a phone.",
      alt: "The overview on a narrow screen. The tiles sit side by side and scroll horizontally; a bar at the bottom holds Overview, Requests, Quotes, Calendar and More.",
    },
  ],

  whatHappensNext: [
    "The numbers update as soon as you send a quote or create an appointment.",
    "An enquiry leaves “New enquiries” as soon as it has a quote.",
    "“Details” takes you to the full list for that area.",
  ],

  commonMistakes: [
    "Reading the “Open quotes” tile as revenue. It counts quotes, not money.",
    "Assuming “New enquiries” shows every enquiry. Only those without a quote are counted.",
    "Checking appointments only here. The calendar also shows the days ahead.",
  ],

  ifSomethingGoesWrong: [
    "Every tile shows zero: there is no data for this company yet. Create a first enquiry under “Enquiries”.",
    "A number looks too high: click “Details” and check the list. The tile counts exactly those entries.",
    "The page takes a long time to load: reload it once. If it stays slow, check your internet connection.",
  ],
} satisfies WikiArticleBody;

export default body;
