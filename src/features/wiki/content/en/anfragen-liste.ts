import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfragen-liste",
  locale: "en",
  title: "The enquiry list",
  summary: "Every enquiry that came in, grouped by service — and the route to a quote.",

  purpose:
    "Every enquiry lands here: from the web form, from the email inbox, or entered by hand. This is where you start the quote.",

  whenToUse: [
    "In the morning, to see what came in overnight.",
    "You are looking for one particular customer's enquiry.",
    "You want to work through all the cleaning enquiries together.",
    "You want to see what already has a quote out.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/anfragen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The enquiry list with the tab strip and the actions on each enquiry.",
      alt: "Enquiry list with a tab strip for All, Removal, Cleaning, Transport and Quoted, then cards showing the name, sales stage, service, route and a row of buttons.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 18, label: "Tabs per service group, with a count." },
        { n: 2, xPct: 34, yPct: 24, label: "Search across name, town, email, phone and postcode." },
        { n: 3, xPct: 30, yPct: 31, label: "Sales stage and service of the enquiry." },
        { n: 4, xPct: 25, yPct: 43, label: "“Create quote” — the main route from here." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Understanding the tab strip",
    },
    {
      kind: "paragraph",
      text: "“All” shows the enquiries that do not have a quote yet. A service tab only appears when there is something in it.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "An enquiry moves to “Quoted”",
      text: "As soon as you have created a quote, the enquiry leaves its service tab and sits in the last tab. That way “All” only ever shows the work still open.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Not every service has its own tab",
      text: "A furniture lift or an unrecognised service appears only under “All”. Piano transport lands in the “Transport” tab. The little plus at the end of the strip is not a button.",
    },
    {
      kind: "heading",
      id: "eintrag",
      text: "What an enquiry card shows",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "The customer's name — or “Unknown customer” when no name was recognised.",
        "The sales stage as a grey marker: New, Qualifying, Viewing, Quote in progress, Quote sent, Negotiating, Won or Lost.",
        "The service with its icon, for example “Private removal”.",
        "The language, but only when the customer does not speak German.",
        "The preferred date, if one was given.",
        "The marker “Quote no. …” as soon as an offer exists.",
        "Below that the route, rooms and floor area, then a clickable phone number and email.",
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "The buttons on each enquiry",
    },
    {
      kind: "statusTable",
      headers: { status: "Button", meaning: "Where it leads", next: "Visible when" },
      rows: [
        { status: "Create quote", meaning: "To the quote form with the details carried over.", next: "While no quote exists." },
        { status: "View quote", meaning: "To the existing quote.", next: "Once one exists." },
        { status: "New quote", meaning: "Creates a second quote for the same enquiry.", next: "Once one exists." },
        { status: "Customer card", meaning: "To the customer card.", next: "Only when a customer is linked." },
        { status: "Viewing", meaning: "To the viewing planner.", next: "Always." },
        { status: "Schedule appointment", meaning: "To the calendar with a prepared appointment.", next: "Always." },
        { status: "Details", meaning: "Opens the enquiry for reading.", next: "Always." },
        { status: "Edit", meaning: "Opens the enquiry for correcting.", next: "Always." },
      ],
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Searching",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Type into the field “Search enquiries …”.",
          note: "The search covers name, town, email, phone and postcode — not the description.",
        },
        {
          text: "When a tab is active, a marker with its name appears beside the search box.",
          note: "Clicking the “×” in it takes you back to “All”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Deleting an enquiry",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Deleting cannot be undone",
      text: "The bin on the right removes the enquiry after a short browser prompt. A quote that already exists survives, but loses its link to the enquiry.",
    },
    {
      kind: "paragraph",
      text: "Only delete genuine mistakes and advertising. Leave a declined enquiry standing — it belongs to that customer's history.",
    },
  ],

  whatHappensNext: [
    "“Create quote” opens the form with all the details from the enquiry.",
    "Once the quote is saved, the enquiry moves to the “Quoted” tab.",
    "The sales stage follows on its own as soon as you send or the customer agrees.",
  ],

  commonMistakes: [
    "Looking under “All” for an enquiry that already has a quote. It is under “Quoted”.",
    "Searching for a word from the description. The search covers name, town, email, phone and postcode.",
    "Deleting handled enquiries to tidy up. That loses the history.",
  ],

  ifSomethingGoesWrong: [
    "A tab is missing: there is currently no open enquiry in that service group.",
    "An enquiry appears nowhere: its service fits no group. Look under “All”.",
    "“Customer card” is missing on an enquiry: no customer record is linked to it yet.",
  ],
} satisfies WikiArticleBody;

export default body;
