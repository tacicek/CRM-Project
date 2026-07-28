import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-detail",
  locale: "en",
  title: "The quote in detail",
  summary: "Line items, history, customer link and the actions available per status.",

  purpose:
    "The detail page shows everything about one quote: what is in it, what the customer did with it, and what you can do next.",

  whenToUse: [
    "You want to know whether the customer opened the quote.",
    "You need the link for the customer.",
    "A quote was agreed and you want to create the work order.",
    "You want to check the PDF before sending.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/offerte-detail-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The detail page with line items, customer details, history and the customer link.",
      alt: "Detail view of a quote. On the left the line items with subtotal, VAT and total; on the right the customer details, the activity list and the area holding the customer link.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 10, label: "Title and status of the quote." },
        { n: 2, xPct: 44, yPct: 55, label: "The line items with the total." },
        { n: 3, xPct: 86, yPct: 48, label: "Activities — what happened and when." },
        { n: 4, xPct: 86, yPct: 72, label: "Customer link to copy." },
      ],
    },
    {
      kind: "heading",
      id: "aktivitaeten",
      text: "How you see what the customer did",
    },
    {
      kind: "paragraph",
      text: "The “Activities” area on the right is the evidence. It fills itself; you enter nothing there.",
    },
    {
      kind: "statusTable",
      headers: { status: "Entry", meaning: "Meaning", next: "Your next step" },
      rows: [
        { status: "Quote created", meaning: "You created the quote.", next: "—" },
        { status: "Sent by email", meaning: "The quote went to the address shown.", next: "Wait." },
        { status: "Viewed by the customer", meaning: "The customer opened the link.", next: "Follow up after a few days." },
        { status: "Quote accepted", meaning: "Firmly agreed.", next: "Plan the work order and appointment." },
        { status: "Quote rejected", meaning: "Declined. The reason is under “Customer note”.", next: "Record the lost reason." },
      ],
    },
    {
      kind: "heading",
      id: "kundenlink",
      text: "Passing on the customer link",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "On the right, under “Customer link”, click “Copy”.",
          note: "The link is then on your clipboard. It is not displayed.",
        },
        {
          text: "Paste it wherever you correspond with the customer.",
          note: "The icon beside it opens the customer view in a new tab — useful for checking.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Which button appears when",
    },
    {
      kind: "statusTable",
      headers: { status: "Button", meaning: "Visible when", next: "What it does" },
      rows: [
        { status: "Download PDF", meaning: "always", next: "Downloads the quote as a PDF." },
        { status: "Preview and send", meaning: "only on “Draft”", next: "Shows the PDF and sends it." },
        { status: "New version", meaning: "sent, not yet accepted", next: "Creates a new revision." },
        { status: "Create amendment", meaning: "only on “Accepted”", next: "Supplements an agreed quote." },
        { status: "View / create work order", meaning: "only on “Accepted”", next: "Leads to the work order." },
        { status: "Delete quote", meaning: "anything but “Accepted”", next: "Removes the quote." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Send again” is not here",
      text: "The detail page does not offer it. Use the three-dot menu in the quote list.",
    },
    {
      kind: "heading",
      id: "vorschau",
      text: "Preview and send",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "On a draft, click “Preview and send”.",
          note: "The real PDF opens, page by page.",
        },
        {
          text: "Check the line items, the prices and the language.",
        },
        {
          text: "Click “Send quote”.",
          note: "Only now does the email go out and the status change to “Sent”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "auftrag",
      text: "From offer to work order",
    },
    {
      kind: "paragraph",
      text: "When the customer agrees through the link, the work order is usually created automatically. That is why the button then reads “View work order” rather than “Create work order”.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Accepted quotes cannot be deleted",
      text: "They are attached to a work order. The attempt is refused with a message — that is not a fault, it is deliberate.",
    },
  ],

  whatHappensNext: [
    "After sending, “Sent by email” appears in the activities.",
    "If the customer opens the link, “Viewed by the customer” is added.",
    "On acceptance you get “Quote accepted”, a work order, and the “Terms accepted” record.",
  ],

  commonMistakes: [
    "Copying the customer link by hand from the address bar. Use “Copy”.",
    "Looking for “Send again” on the detail page. It is only in the list.",
    "Trying to change a sent quote. That is what “New version” is for.",
  ],

  ifSomethingGoesWrong: [
    "“Data could not be loaded” for the PDF: the quote holds incomplete details, for example in the surcharges. Open it for editing and check the fields.",
    "“Deletion not possible”: the quote is accepted and linked to a work order.",
    "The activities show no “Viewed”: the customer has not opened the link yet. A PDF attachment alone does not trigger it.",
  ],
} satisfies WikiArticleBody;

export default body;
