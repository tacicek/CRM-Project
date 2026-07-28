import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnung-erstellen",
  locale: "en",
  title: "Writing and sending an invoice",
  summary: "From the empty form through the QR payment part to sending by email.",

  purpose:
    "This is where you write an invoice: customer details, line items, VAT and terms. When you save, the invoice number and QR reference are created for you.",

  whenToUse: [
    "A job is finished and needs to be billed.",
    "You want to finish a draft.",
    "You need an existing invoice as a PDF again.",
    "You want to record a payment on an invoice.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/rechnung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The invoice form with customer details and invoice settings.",
      alt: "Form for a new invoice. On the left the customer details with salutation, name, address, email and phone; on the right date, due date, status, language and an internal note.",
      hotspots: [
        { n: 1, xPct: 27, yPct: 45, label: "Customer details. Only the name is required." },
        { n: 2, xPct: 74, yPct: 45, label: "Date, due date, status and the invoice language." },
      ],
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Step by step",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "In the invoice list, click “New invoice”.",
          note: "If you came from a work order, the customer details are already filled in.",
        },
        {
          text: "Under “Customer details”, fill in at least the “Name” field.",
          note: "Everything else is optional. Without a name it will not save.",
        },
        {
          text: "Check “Date” and “Due date”.",
          note: "The due date follows the date plus 30 days — until you change it once by hand. After that your value stays.",
        },
        {
          text: "Under “Invoice language”, choose the customer's language.",
          note: "It decides the PDF and the email — not the language of your own screen.",
        },
        {
          text: "Under “Line items”, enter what is being charged.",
          note: "“Amount” is worked out from quantity times unit price unless you overwrite it. “Add row” adds another line.",
        },
        {
          text: "Turn on “VAT” if needed and check the rate.",
          note: "The default is 8.1 per cent.",
        },
        {
          text: "Click “Save”.",
          note: "The invoice number and the QR reference are created now. Both happen in the background.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "The status",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Paid” is missing from the list — deliberately",
      text: "While anything is open, “Paid” cannot be chosen. The status follows the recorded payments. Record the payment instead of setting the status.",
    },
    {
      kind: "paragraph",
      text: "At the bottom of the page you see the summary: Paid, Credited where applicable, and Open. The same reminder is repeated below it.",
    },
    {
      kind: "heading",
      id: "senden",
      text: "Getting the PDF or sending by email",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "“Download PDF” saves first, then produces the file.",
          note: "The PDF contains the Swiss QR payment part. If the IBAN or company address is missing, a message appears.",
        },
        {
          text: "“Send by email” sends the invoice straight to the customer.",
          note: "The button appears only when a customer email is filled in and the invoice is not yet paid.",
        },
        {
          text: "After sending, the invoice shows as “Sent”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "zahlung",
      text: "Recording a payment on this invoice",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Record payment” at the bottom.",
          note: "The button appears only when the invoice is saved and something is still open.",
        },
        {
          text: "Enter the amount, date, payment method and reference, then confirm with “Record”.",
          note: "Partial payments are possible; the invoice then stays open.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Payments: owner and admin only",
      text: "Anyone may write and send the invoice. Only recording a payment is reserved for the owner and administrators.",
    },
  ],

  whatHappensNext: [
    "On the first save, the invoice number and QR reference are created automatically.",
    "After sending, the status changes to “Sent”.",
    "As soon as the recorded payments cover the amount, it changes to “Paid”.",
    "If the due date passes while something is still open, it becomes “Overdue” overnight.",
  ],

  commonMistakes: [
    "Changing the due date and then wondering why it no longer follows the date. After the first manual change, your value stays.",
    "Confusing the invoice language with your own screen language. It decides what the customer reads.",
    "Waiting for “Send by email” when no email field is filled in. Without an address the button does not appear.",
  ],

  ifSomethingGoesWrong: [
    "“Customer name missing”: enter a name under “Customer details”.",
    "“IBAN missing” or “Company address incomplete”: add the details under “Settings” and try again.",
    "Sending fails: check the customer's email address. The invoice stays saved; you can send again.",
  ],
} satisfies WikiArticleBody;

export default body;
