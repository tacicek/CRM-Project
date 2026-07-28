import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "zahlung-erfassen",
  locale: "en",
  title: "Recording a payment",
  summary: "In full, in part or too much — and how to correct a mistake.",

  purpose:
    "As soon as money has arrived, you record it here. The invoice status follows on its own — you never set it by hand.",

  whenToUse: [
    "A transfer has arrived in the bank account.",
    "The customer paid in cash or by TWINT.",
    "Only a deposit came in.",
    "Too much was transferred.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "permission",
      title: "Owner and admin only",
      text: "Recording and reversing payments is reserved for the owner and administrators. Members see the button but get an error when they click.",
    },
    {
      kind: "heading",
      id: "wo-beginnen",
      text: "Where to start",
    },
    {
      kind: "paragraph",
      text: "Two paths lead to the same window. The result is identical.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Through “Finances” → tab “Open items” → “Record payment” on the invoice. That is the quick route when you have several entries in a row.",
        "Through the invoice itself → the “Record payment” button at the bottom. It appears only when the invoice is saved and something is still open.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Every open item has “Record payment” on the right.",
      alt: "List of open invoices. Each row shows the invoice number, customer name, due date and on the right the open amount with a button to record the payment.",
      hotspots: [
        { n: 1, xPct: 91, yPct: 43, label: "This button opens the window." },
        { n: 2, xPct: 33, yPct: 57, label: "This shows how much has already been paid." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-felder",
      text: "The four fields",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "“Amount” is pre-filled with the open amount. Overwrite it if more or less arrived.",
          note: "On a receipt the field is fixed — there the amount is set by the document.",
        },
        {
          text: "“Payment date” is set to today. Enter the date the money actually arrived.",
          note: "For a bank statement that is the value date, not the day you record it.",
        },
        {
          text: "Under “Payment method”, choose how the money came in.",
          note: "The options are bank transfer, QR invoice, TWINT, cash, card and other.",
        },
        {
          text: "Under “Reference”, note what will let you recognise the payment later.",
          note: "For example the QR reference, a TWINT number or a document number. The field is optional but helps when matching.",
        },
        {
          text: "Click “Record”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "There is no comment field",
      text: "Whatever explains the payment belongs in the “Reference”. The window offers no free note field.",
    },
    {
      kind: "heading",
      id: "teilzahlung",
      text: "Partial payment",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Under “Amount”, enter what actually arrived.",
          note: "For example 400 of 890 francs.",
        },
        {
          text: "Record the payment as usual.",
          note: "The invoice stays open and the open amount drops to the difference.",
        },
        {
          text: "Later you record the remainder as a second payment.",
          note: "As soon as nothing is open, the invoice moves to “Paid” by itself.",
        },
      ],
    },
    {
      kind: "heading",
      id: "ueberzahlung",
      text: "Paid too much",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The surplus stays put",
      text: "If you type more than is open, a note appears immediately. The surplus is booked as an unattached entry and shows up under “Unmatched”.",
    },
    {
      kind: "paragraph",
      text: "That is not an error but a reminder. Clarify with the customer whether the amount is refunded or set against the next invoice.",
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Correcting a wrong payment",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "A recorded payment cannot be edited",
      text: "Amount, date and payment method are fixed once recorded. Correcting means “Reverse” and then recording again.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Open “Finances” and the “Payments” tab." },
        { text: "Click “Reverse” on the wrong entry and confirm." },
        {
          text: "Now record the payment correctly.",
          note: "The list then shows three rows: the wrong one, the counter-entry and the correct one.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "The invoice's open amount falls immediately.",
    "If nothing is open, the invoice moves to “Paid” automatically.",
    "The entry appears in the “Payments” tab and counts towards “Collected”.",
    "On the customer card, the “Paid” line rises.",
  ],

  commonMistakes: [
    "Entering the recording date instead of the arrival date. The “Last 30 days” figure then goes wrong.",
    "Leaving the full amount on a partial payment. The invoice then counts as paid although money is missing.",
    "Trying to record a second payment with a minus amount after a mistake. Use “Reverse”.",
  ],

  ifSomethingGoesWrong: [
    "“Record” stays greyed out: the amount is empty or zero. Enter a number greater than zero.",
    "An error appears: your role may not record payments. Ask the owner or an admin.",
    "You recorded the same payment twice: reverse one of the two entries.",
  ],
} satisfies WikiArticleBody;

export default body;
