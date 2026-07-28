import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftraege-liste",
  locale: "en",
  title: "The work-order list",
  summary: "Every job with date, team and status — and what you can do with each one.",

  purpose:
    "A work order is the agreed job: who, when, where. The list shows every job and is where you close and bill them.",

  whenToUse: [
    "In the morning, to see the day's jobs.",
    "You want to know which job is overdue.",
    "A job is finished and should be closed.",
    "After closing, you want to create an invoice or a receipt.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/auftraege-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The work-order list with four tiles, tabs and the table.",
      alt: "Work-order list with the tiles Today, Tomorrow, Planned and Completed, then tabs and a table with job, customer, date and time, team and status.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Four tiles: today, tomorrow, planned, completed." },
        { n: 2, xPct: 35, yPct: 34, label: "Tabs to narrow down." },
        { n: 3, xPct: 80, yPct: 52, label: "Status column." },
        { n: 4, xPct: 95, yPct: 52, label: "The three-dot menu — everything happens there." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The row itself is not clickable",
      text: "There is no separate page for a work order. Every action goes through the three-dot menu on the right.",
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
        { status: "Planned", meaning: "Date is set, not yet confirmed.", next: "Assign the team, confirm." },
        { status: "Confirmed", meaning: "Firmly scheduled.", next: "Carry it out on the day." },
        { status: "In progress", meaning: "Happening right now.", next: "When finished: “Close …”." },
        { status: "Completed", meaning: "Done. A dead end — no way back.", next: "Create an invoice or receipt." },
        { status: "Cancelled", meaning: "Called off.", next: "Reactivate if needed." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Confirmed and Completed look the same",
      text: "Both markers are green. Read the words, not the colour.",
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Tabs and search",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "“All”, “Today”, “Tomorrow”, “Planned” and “Done” — each with a count.",
        "“Planned” covers both planned and confirmed jobs.",
        "Cancelled jobs are only under “All” — there is no tab of their own for them.",
        "The search covers the title, customer name, job number and both addresses.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Overdue jobs",
      text: "If the date has passed and the job is neither completed nor cancelled, a red note appears at the top and an “Overdue” marker on the row.",
    },
    {
      kind: "heading",
      id: "menue",
      text: "The three-dot menu",
    },
    {
      kind: "statusTable",
      headers: { status: "Entry", meaning: "What it does", next: "Visible when" },
      rows: [
        { status: "Edit", meaning: "Opens the job for changing.", next: "Always." },
        { status: "Customer card", meaning: "Leads to the customer card.", next: "When a customer is linked." },
        { status: "Download PDF", meaning: "Job sheet for the crew.", next: "Always." },
        { status: "View quote", meaning: "Opens the quote in a new tab.", next: "When one is linked." },
        { status: "Close …", meaning: "Opens the completion window.", next: "While not yet completed." },
        { status: "Create invoice", meaning: "Starts an invoice.", next: "Only on “Completed”." },
        { status: "Create receipt", meaning: "Starts a receipt.", next: "Always." },
        { status: "Cancel", meaning: "Sets the job to cancelled.", next: "When allowed." },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "“Archive” is called “Delete” in the confirmation",
      text: "The job disappears from the list but stays stored for the record. You cannot undo it from here.",
    },
    {
      kind: "heading",
      id: "doppelt",
      text: "Do not bill twice",
    },
    {
      kind: "paragraph",
      text: "One job can produce both a receipt and an invoice. The menu warns you: documents that already exist read “Invoice already created” or “Further receipt (already exists)”.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "An invoice needs an IBAN",
      text: "If the IBAN is missing from the settings, the program says “IBAN missing” and creates no QR invoice.",
    },
  ],

  whatHappensNext: [
    "“Close …” sets the job to “Completed” and unlocks “Create invoice”.",
    "No invoice appears by itself — that is a separate step.",
    "If the linked appointment is cancelled in the calendar, the job automatically becomes “Cancelled”.",
  ],

  commonMistakes: [
    "Waiting for an amount in the list. There is no money column — amounts live inside the job.",
    "Looking for a cancelled job under “Planned”. It is only under “All”.",
    "Trying to reverse the status after closing. “Completed” is a dead end.",
  ],

  ifSomethingGoesWrong: [
    "“Invalid status change”: the step you want is not allowed from this status.",
    "“Data could not be validated”: the stored record is damaged; editing and PDF are blocked. Report the job.",
    "“Create invoice” is missing: the job is not completed yet.",
  ],
} satisfies WikiArticleBody;

export default body;
