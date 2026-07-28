import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "start-hier",
  locale: "en",
  title: "Start here",
  summary: "What this program does for you, and the order you work in.",

  purpose:
    "This program follows a customer job from the first enquiry to the paid invoice. Everything belongs to one company. You do not need to set anything up to begin.",

  whenToUse: [
    "You are using the program for the first time.",
    "You do not know where a particular task belongs.",
    "You want to understand the thread behind all these menus.",
    "You are training a colleague.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "der-rote-faden",
      text: "The thread that runs through everything",
    },
    {
      kind: "paragraph",
      text: "Almost everything in the program follows the same chain. Once you know the chain, you can find any menu entry.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Enquiry: a customer gets in touch. You record what they want.",
        "Quote: you write an offer and send it to the customer.",
        "Work order: the customer says yes. The quote becomes a job with a date.",
        "Invoice or receipt: once the work is done, you charge for it.",
        "Payment: you record what was paid. The invoice status follows on its own.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Nothing to memorise",
      text: "Every page has “Help & guide” in the top right. One click opens the guide for the page you are on.",
    },
    {
      kind: "heading",
      id: "wo-alles-liegt",
      text: "Where everything lives",
    },
    {
      kind: "paragraph",
      text: "The menu on the left is split into areas. The five entries you need every day sit at the very top.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/seitenleiste-v1.webp",
      width: 240,
      height: 1165,
      caption: "The side menu with all areas.",
      alt: "Side menu of the program. The company name at the top, then Overview, Enquiries, Email inbox, Quotes and Calendar. Below that the groups Main area, Operations and Administration.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 15, label: "Quick access: the five pages you use daily." },
        { n: 2, xPct: 50, yPct: 40, label: "Main area: customers, money and work in progress." },
        { n: 3, xPct: 50, yPct: 68, label: "Operations: viewings, equipment and team." },
        { n: 4, xPct: 50, yPct: 87, label: "Administration: your services, pricing and settings." },
      ],
    },
    {
      kind: "heading",
      id: "erste-schritte",
      text: "Your first three steps",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open “Overview”. That is your home page.",
          note: "It shows new enquiries, open quotes and today's appointments.",
        },
        {
          text: "Click “Enquiries” and open one enquiry.",
          note: "This shows you what information an enquiry carries.",
        },
        {
          text: "Then read the guide “A typical working day”.",
          note: "It describes, in order, what you check in the morning, during the day and in the evening.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "What this program does not do",
      text: "It is not payroll, vehicle tracking or route planning. It manages customers, offers, appointments and money.",
    },
  ],

  whatHappensNext: [
    "You know the chain: enquiry, quote, work order, invoice, payment.",
    "You know the help in the top right always matches the page you are on.",
    "We suggest reading “Signing in and out” and “A typical working day” next.",
  ],

  commonMistakes: [
    "Do not start with the settings. For the first few days you only need enquiries and quotes.",
    "Do not run two systems side by side. Anything not recorded here appears in no report.",
  ],

  ifSomethingGoesWrong: [
    "You cannot find a page: use the search at the top of this help page.",
    "A page is empty: there is usually no data yet. Create an enquiry first.",
    "You are unsure whether an action can be undone: every final step has a red-bordered warning right before it.",
  ],
} satisfies WikiArticleBody;

export default body;
