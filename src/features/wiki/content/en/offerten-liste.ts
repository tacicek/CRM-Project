import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerten-liste",
  locale: "en",
  title: "The quote list",
  summary: "Every quote with its status, the filters and the per-row actions.",

  purpose:
    "The quote list shows every offer you have saved or sent. From here you open a quote, send it again, or turn it into a work order.",

  whenToUse: [
    "You want to know which quotes the customer has not answered.",
    "You are looking for a particular quote.",
    "A customer says yes and you want to create the work order.",
    "You want to send a quote again.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/offerten-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The quote list with four figures and the table of all offers.",
      alt: "Quote list with four tiles for Total, Pending, Accepted and Value, then a table with number, date, title, customer, language, details, amount, status and validity.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Four tiles — each one also acts as a filter." },
        { n: 2, xPct: 33, yPct: 39, label: "Search by number, name and title." },
        { n: 3, xPct: 82, yPct: 39, label: "Filters by type and language." },
        { n: 4, xPct: 84, yPct: 68, label: "Status column — where each quote stands." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "The four tiles",
    },
    {
      kind: "paragraph",
      text: "Each tile is also a filter. One click shows only the matching quotes; “Reset” undoes it.",
    },
    {
      kind: "statusTable",
      headers: { status: "Tile", meaning: "What is counted", next: "Clicking filters to" },
      rows: [
        { status: "Total", meaning: "All loaded quotes.", next: "All" },
        { status: "Pending", meaning: "Sent or viewed, still without an answer.", next: "Pending" },
        { status: "Accepted", meaning: "Agreed by the customer.", next: "Accepted" },
        { status: "Value", meaning: "Sum of the accepted quotes.", next: "Accepted" },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "The five statuses",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Meaning", next: "Your next step" },
      rows: [
        { status: "Draft", meaning: "Saved but not yet sent.", next: "Finish it and send." },
        { status: "Sent", meaning: "With the customer, not yet opened.", next: "Wait." },
        { status: "Viewed", meaning: "The customer opened the quote.", next: "Follow up after a few days." },
        { status: "Accepted", meaning: "Agreed. A work order follows.", next: "Plan the appointment." },
        { status: "Rejected", meaning: "The customer declined.", next: "Note the reason, close the case." },
      ],
    },
    {
      kind: "heading",
      id: "spalten",
      text: "What the table shows",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "“No.” is the quote number.",
        "“Details” shows the route from place to place and, where present, rooms and floor area.",
        "“Amount” shows the total — or “by effort” when a line item is charged by the hour.",
        "“Email” shows with an icon whether it went out from the company address or the system address.",
        "“Valid until” is the quote's expiry date.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The same number can appear twice",
      text: "A new version keeps the old one's number. Both rows sit in the list and differ only by date and status. The list shows no version number.",
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Searching and filtering",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Type into the field “No., name or title …”.",
          note: "The search also covers the email address, even though the field does not say so.",
        },
        {
          text: "On the right choose “All types” to tell “Normal” from “Blind” apart.",
          note: "A blind quote was made without a site visit.",
        },
        {
          text: "Choose “All languages” to filter by the customer's language.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Per-row actions",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click a row to open the quote.",
        },
        {
          text: "Click the three-dot menu on the right for the other actions.",
          note: "“View”, “Edit” and “Send again” are always there.",
        },
        {
          text: "For accepted quotes, “Add to calendar” and “Create work order” appear as well.",
          note: "If the work order already exists, the entry reads “View work order”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "“New quote” takes you to the enquiries",
      text: "The button at the top right does not open an empty form. A quote always grows out of an enquiry, which is why you land there.",
    },
  ],

  whatHappensNext: [
    "Clicking a row opens the quote with all its line items and its history.",
    "“Send again” emails the same quote once more.",
    "As soon as the customer agrees, the status changes to “Accepted” and a work order is created.",
  ],

  commonMistakes: [
    "Taking two rows with the same number for an error. Those are two versions of the same quote.",
    "Reading “Value” as revenue. It is the sum of agreed quotes, not money received.",
    "Expecting “Send again” on an accepted quote. The entry is disabled then.",
  ],

  ifSomethingGoesWrong: [
    "A quote is missing: check whether a tile is active as a filter and click “Reset”.",
    "“Send again” reports an error: check the customer's email address in the quote.",
    "“Add to calendar” says the enquiry is missing: no enquiry is linked to the quote. Create the appointment by hand in the calendar.",
  ],
} satisfies WikiArticleBody;

export default body;
