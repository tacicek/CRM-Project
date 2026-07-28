import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnungen-liste",
  locale: "en",
  title: "The invoice list",
  summary: "All invoices with status, filters, PDF and the deletion rules.",

  purpose:
    "The invoice list shows every invoice you have created together with its status. From here you open an invoice, download the PDF, or create a new one.",

  whenToUse: [
    "You are looking for a particular invoice.",
    "You want to see which invoices are overdue.",
    "You need a PDF for the bookkeeping.",
    "You want to write a new invoice.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/rechnungen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The invoice list with figures, search, status filters and the rows.",
      alt: "Invoice list with four figures, a search field, five status filters and below them rows showing invoice number, customer name, date, due date, status and amount.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 22, label: "Total, Open, Overdue and Turnover." },
        { n: 2, xPct: 30, yPct: 34, label: "Search by number or customer name." },
        { n: 3, xPct: 40, yPct: 41, label: "Status filters." },
        { n: 4, xPct: 92, yPct: 12, label: "“New invoice” opens the empty form." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-status",
      text: "The four statuses",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Meaning", next: "Your next step" },
      rows: [
        { status: "Draft", meaning: "Not yet gone out to the customer.", next: "Finish it and send." },
        { status: "Sent", meaning: "Issued, not yet fully paid.", next: "Wait for the money." },
        { status: "Paid", meaning: "Settled in full.", next: "Nothing further." },
        { status: "Overdue", meaning: "The due date has passed.", next: "Follow up or send a reminder." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "“Paid” sets itself",
      text: "As soon as the recorded payments cover the amount, the status changes automatically. You cannot set it by hand.",
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "The figures at the top",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "“Total” is the number of all invoices.",
        "“Open” counts drafts and sent invoices — overdue ones are not included here.",
        "“Overdue” counts only the overdue ones.",
        "“Turnover” is the money actually received, not the sum of the invoices issued.",
      ],
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
          text: "Type into the field “No. or customer name …”.",
          note: "The search covers the invoice number and the name.",
        },
        {
          text: "Choose a status below: “All”, “Draft”, “Sent”, “Paid” or “Overdue”.",
        },
        {
          text: "Click a row to open the invoice.",
        },
      ],
    },
    {
      kind: "heading",
      id: "pdf",
      text: "Downloading the PDF",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click the download icon in the row.",
          note: "Or use the three-dot menu and “Download PDF”.",
        },
        {
          text: "The PDF contains the Swiss QR payment part.",
          note: "For that, the IBAN and the company address must be filled in under Settings.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“IBAN missing” or “Company address incomplete”",
      text: "If either message appears, no QR payment part can be produced. Add the IBAN, street, postcode and town under “Settings”.",
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Deleting — and why rarely",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Deleting does not ask first",
      text: "In the three-dot menu, “Delete” removes the draft immediately, with no confirmation. There is no way back.",
    },
    {
      kind: "paragraph",
      text: "Deleting is only possible for drafts. For anything else a message explains that posted documents are reversed, not deleted.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Draft: can be deleted.",
        "Sent, Paid, Overdue: cannot be deleted.",
        "An invoice issued in error is settled with a credit note, not removed.",
      ],
    },
  ],

  whatHappensNext: [
    "Clicking a row opens the invoice with all its line items.",
    "“New invoice” opens an empty form.",
    "The status changes as soon as you record a payment under “Finances”.",
  ],

  commonMistakes: [
    "Reading “Turnover” as the sum of the invoices issued. It is the money received.",
    "Hitting “Delete” by accident in the three-dot menu. There is no confirmation.",
    "Trying to delete an issued invoice instead of creating a credit note.",
  ],

  ifSomethingGoesWrong: [
    "The PDF will not generate: check the IBAN and company address in the settings.",
    "An invoice is missing from the list: a status filter is probably active. Choose “All”.",
    "A draft was deleted by accident: it is gone. Write it again — the customer's data is still there.",
  ],
} satisfies WikiArticleBody;

export default body;
