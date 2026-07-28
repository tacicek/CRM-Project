import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "finanzen-uebersicht",
  locale: "en",
  title: "Finances: what is open and what came in",
  summary: "Open items and payments in one place — including reversals.",

  purpose:
    "The “Finances” page answers two questions: who still owes money, and what has already come in. This is also where you record payments.",

  whenToUse: [
    "You have a bank statement in front of you and want to record the entries.",
    "You want to know what is overdue.",
    "You recorded a payment wrongly and need to correct it.",
    "You want to see the month's takings.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Finances with the four amounts and the list of open items.",
      alt: "Finances page with four amounts for Collected, Last 30 days, Open and Overdue, below them two tabs and the list of open invoices, each with a button to record a payment.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 19, label: "Four amounts. “Overdue” turns red as soon as anything is overdue." },
        { n: 2, xPct: 24, yPct: 28, label: "Line “Unmatched” — appears only when such entries exist." },
        { n: 3, xPct: 29, yPct: 36, label: "Two tabs: open items and payments." },
        { n: 4, xPct: 91, yPct: 43, label: "“Record payment” opens the window." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-betraege",
      text: "The four amounts",
    },
    {
      kind: "statusTable",
      headers: { status: "Amount", meaning: "What it contains", next: "Note" },
      rows: [
        { status: "Collected", meaning: "Every payment ever recorded.", next: "Reversals are already deducted." },
        { status: "Last 30 days", meaning: "The same, limited to the last 30 days.", next: "—" },
        { status: "Open", meaning: "What is still outstanding on issued invoices.", next: "Drafts are not counted." },
        { status: "Overdue", meaning: "The part whose due date has passed.", next: "Shown in red." },
      ],
    },
    {
      kind: "heading",
      id: "offene-posten",
      text: "Tab “Open items”",
    },
    {
      kind: "paragraph",
      text: "Every invoice that is not fully paid appears here. The oldest due date is at the top.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "The invoice number is clickable and opens the invoice.",
        "Below it: either “Due {date}” or, in red, “{n} days overdue”.",
        "If something has already been paid, it also shows “{amount} of {amount} paid”.",
        "The marker “Reminder level {n}” appears once reminders exist.",
        "On the right, the amount still open with the “Record payment” button.",
      ],
    },
    {
      kind: "heading",
      id: "zahlungseingaenge",
      text: "Tab “Payments”",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/finanzen-zahlungseingaenge-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The payment ledger with one reversed entry.",
      alt: "Payments tab with a list of entries. Each row shows the date, payment method, matching state and amount; one row carries the Reversal marker and a negative amount.",
    },
    {
      kind: "paragraph",
      text: "Each row is one entry: date, payment method, reference and amount. A row marked “Reversal” with a negative amount cancels an earlier entry.",
    },
    {
      kind: "heading",
      id: "stornieren",
      text: "Correcting a wrong payment",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Payments are never deleted",
      text: "A wrong entry is cancelled by a counter-entry. Both rows stay visible — that keeps the bookkeeping traceable.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Switch to the “Payments” tab." },
        {
          text: "Find the wrong entry and click “Reverse”.",
          note: "The button is absent on entries that are themselves reversals or have already been reversed.",
        },
        {
          text: "Confirm the question.",
          note: "A second row appears with the same amount as a minus.",
        },
        {
          text: "Then record the correct payment.",
          note: "A reversal always cancels the whole amount — partial amounts cannot be reversed.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Recording and reversing: owner and admin only",
      text: "As a member you see both buttons but get an error when you click. That is not a fault, it is how permissions are set.",
    },
  ],

  whatHappensNext: [
    "After a payment is recorded, “Open” falls and “Collected” rises.",
    "A fully paid invoice leaves the open items and counts as “Paid”.",
    "A reversal raises “Open” again and the invoice reappears.",
  ],

  commonMistakes: [
    "Trying to set the invoice to “paid” by hand. The status follows the payments; there is no switch.",
    "Trying to delete a wrong entry. Only reversal by counter-entry exists.",
    "Reading “Collected” as profit. It is money received, not earnings.",
  ],

  ifSomethingGoesWrong: [
    "An error appears when recording: your role does not allow it. Ask the owner or an admin.",
    "An amount sits under “Unmatched”: the entry is recorded but not attached to an invoice. Record it again on the right invoice and reverse the old one.",
    "A paid invoice shows as open again: the payment was probably reversed, or a credit note was created.",
  ],
} satisfies WikiArticleBody;

export default body;
