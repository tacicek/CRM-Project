import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kunden-liste",
  locale: "en",
  title: "The customer list",
  summary: "Every customer in one place — search, filter and open.",

  purpose:
    "The customer list collects every person and company you have dealt with. It shows at a glance who still owes money and when something last happened.",

  whenToUse: [
    "You need a customer's phone number.",
    "You want to know who still owes money.",
    "You suspect someone has been recorded twice.",
    "You want to see all your business customers.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Customers appear on their own",
      text: "There is no “New customer” button, and that is deliberate. A record appears automatically from an enquiry, a quote or a document.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kunden-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The customer list with figures, search, filters and the records.",
      alt: "Customer list with four figures at the top, a search field, four filter buttons and below them the customer records showing name, email, phone and town.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 17, label: "Four figures about your customer base." },
        { n: 2, xPct: 50, yPct: 30, label: "Search across name, email and phone." },
        { n: 3, xPct: 30, yPct: 37, label: "Filters: All, People, Companies, Possible duplicate." },
        { n: 4, xPct: 50, yPct: 55, label: "One record. Clicking opens the customer card." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "The four figures",
    },
    {
      kind: "statusTable",
      headers: { status: "Tile", meaning: "What is counted", next: "Clickable?" },
      rows: [
        { status: "Customers", meaning: "All records, excluding those already merged.", next: "No" },
        { status: "New (30 d.)", meaning: "Records created in the last 30 days.", next: "No" },
        { status: "Possible duplicate", meaning: "Records that share a phone number.", next: "Yes — applies the filter" },
        { status: "Inactive (90 d.)", meaning: "Records whose first contact is more than 90 days ago.", next: "No" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Inactive” does not mean “no activity”",
      text: "The tile counts when the first contact happened, not when something last happened. A long-standing regular customer is counted here too.",
    },
    {
      kind: "heading",
      id: "suchen-filtern",
      text: "Searching and filtering",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Type into the field “Name, email or phone …”.",
          note: "The list reacts by itself after a moment. There is nothing to confirm.",
        },
        {
          text: "Choose a filter below: “All”, “People”, “Companies” or “Possible duplicate”.",
          note: "Search and filter work together.",
        },
        {
          text: "The “X” in the search field clears the search.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eintrag-lesen",
      text: "Reading a record",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "On the left: name, email, phone and town.",
        "The “Company” marker appears for business customers.",
        "A language code appears only when the customer does not speak German.",
        "On the right, the open amount with the word “open” — only when something really is open.",
        "Furthest right: when something last happened, or “No activity yet”.",
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click a record.",
          note: "The customer card opens with every record and amount.",
        },
        {
          text: "At the bottom, set how many records appear per page.",
          note: "You can choose 10, 25, 50 or 100. The default is 25.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Clicking a record opens the customer card.",
    "The open amount drops as soon as you record a payment under “Finances”.",
    "A new record appears here as soon as an enquiry or document creates one.",
  ],

  commonMistakes: [
    "Trying to create a customer by hand. That is not provided — record an enquiry instead.",
    "Reading “Inactive (90 d.)” as “has not been in touch for a while”. It counts the first contact.",
    "Searching by customer number. The search covers name, email and phone.",
  ],

  ifSomethingGoesWrong: [
    "The list is empty: there are no enquiries for this company yet. Create an enquiry first.",
    "Someone appears twice: open the record; a note about possible duplicates appears at the top.",
    "You cannot find a record: search by phone number rather than name — names are often spelled differently.",
  ],
} satisfies WikiArticleBody;

export default body;
