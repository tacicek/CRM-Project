import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-erstellen",
  locale: "en",
  title: "Writing a quote",
  summary: "From enquiry to finished quote: line items, price model, terms, sending.",

  purpose:
    "This is where you put an offer together. The details from the enquiry are already carried over; you add the line items and prices.",

  whenToUse: [
    "An enquiry has been checked and should receive an offer.",
    "After a site visit you want to put the price in writing.",
    "The customer is waiting for a written commitment.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "A quote always starts from an enquiry",
      text: "Open the matching enquiry under “Enquiries” and start there. Without an enquiry the page says no enquiry is selected.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/offerte-erstellen-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The quote form. At the top, the details carried over from the enquiry.",
      alt: "Form for creating a quote with the enquiry overview section showing the contact, the route and the property details taken from the enquiry.",
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "How the page is laid out",
    },
    {
      kind: "paragraph",
      text: "It is one long form, not a step-by-step wizard. You can work in any order and save in between.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "“Enquiry overview” — what the customer reported. Read-only.",
        "“Moving calculator” — appears only for removals; works out volume, time and cost.",
        "“Quote details” — title and description.",
        "“Price model” — fixed, hourly, or hourly with a ceiling.",
        "“Surcharges” — extras, for example weekend or floor level.",
        "“Quote type” — normal or blind.",
        "“Line items and prices” — what is being charged.",
        "“Payment terms” and “Terms and conditions”.",
      ],
    },
    {
      kind: "heading",
      id: "preismodell",
      text: "Choosing the price model",
    },
    {
      kind: "statusTable",
      headers: { status: "Model", meaning: "Meaning", next: "Fits when" },
      rows: [
        { status: "Fixed price", meaning: "One set amount, whatever the effort.", next: "the scope is clear." },
        { status: "Hourly rate", meaning: "Charged by the hours actually worked.", next: "the effort is hard to estimate." },
        { status: "Hourly rate with a ceiling", meaning: "By the hour, but capped.", next: "the customer wants certainty." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The ceiling is a selling point",
      text: "The note under the field says it to the customer directly: they pay at most this amount, however long it takes.",
    },
    {
      kind: "heading",
      id: "positionen",
      text: "Adding line items",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Add from catalogue” to take services from your own catalogue.",
          note: "The catalogue lives under “My services”. Whatever is kept up to date there is faster here.",
        },
        {
          text: "“Enter manually” creates an empty line item.",
          note: "Every line item needs at least a description, otherwise it will not save.",
        },
        {
          text: "Change the “Price basis” per line item if needed.",
          note: "“Fixed amount”, “Rate (by effort)” or “Range (min–max)”.",
        },
        {
          text: "Check the subtotal, discount and total at the bottom.",
        },
      ],
    },
    {
      kind: "heading",
      id: "konditionen",
      text: "Terms and conditions",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Under “Payment terms”, state how payment is made.",
          note: "The buttons below — for example “Cash payment” or “30 days” — fill the text with one click, in the customer's language.",
        },
        {
          text: "Expand “Terms and conditions” if terms should go along with it.",
          note: "“Insert standard terms automatically” takes your saved text. The terms appear on page 2 of the quote.",
        },
      ],
    },
    {
      kind: "heading",
      id: "speichern-senden",
      text: "Saving or sending",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "“Save as draft” files the quote without sending anything.",
          note: "You can carry on later. The status stays “Draft”.",
        },
        {
          text: "“Send quote” saves and emails it straight away.",
          note: "The status only changes to “Sent” once the email actually goes out.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Check the language and the price first",
      text: "After sending, the quote's content is locked. Changes then need a new version.",
    },
    {
      kind: "paragraph",
      text: "On the right you see the “Live preview”. It shows roughly how the quote reads — check the final PDF after saving, on the detail page.",
    },
  ],

  whatHappensNext: [
    "After saving you land in the quote list.",
    "A draft can be edited as often as you like.",
    "After sending, the customer gets an email with a link to the quote.",
    "If they open the link, the status changes to “Viewed”.",
  ],

  commonMistakes: [
    "Trying to save without a line item. At least one is required, or the check blocks you.",
    "Entering a ceiling below the hourly rate. That is refused.",
    "Taking the live preview for the finished PDF. It is an approximation.",
  ],

  ifSomethingGoesWrong: [
    "“Please enter a title”: the “Title” field under “Quote details” is empty.",
    "“Please complete all line items”: one line item has no description.",
    "“Email not sent”: the quote is saved, only the sending failed. Send it again from the list.",
  ],
} satisfies WikiArticleBody;

export default body;
