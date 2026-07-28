import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "nachtrag",
  locale: "en",
  title: "An amendment to a quote",
  summary: "Extra work after the agreement — with the customer's separate approval.",

  purpose:
    "An amendment supplements a quote that has already been accepted. It is put to the customer separately and agreed separately.",

  whenToUse: [
    "On site, work comes up that was not quoted.",
    "The customer wants something extra after agreeing.",
    "The scope grows and you need written approval for it.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Only on accepted quotes",
      text: "While a quote is not accepted, change it through a new version. An amendment presumes the agreement.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Creating an amendment",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open the accepted quote.",
        },
        {
          text: "Click “Create amendment” at the top.",
          note: "The button appears only on quotes with the status “Accepted”.",
        },
        {
          text: "You land on the amendment page.",
          note: "You enter the title and reason there — you are not asked for them when it is created.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/nachtrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The amendment page with title, reason and line items.",
      alt: "Amendment form with the Title and Reason fields, a list of line items showing service, quantity, unit and unit price, and the totals below.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 26, label: "Title and reason — what is being added and why." },
        { n: 2, xPct: 45, yPct: 55, label: "The additional line items." },
        { n: 3, xPct: 80, yPct: 78, label: "Subtotal, VAT and total." },
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Filling it in and saving",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Under “Title”, say what this is about.",
          note: "For example “Piano transport”. Without a title it cannot be sent.",
        },
        {
          text: "Under “Reason”, describe why the work is being added.",
          note: "The customer reads this. One sentence is enough.",
        },
        {
          text: "Add the extra services with “Add line item”.",
          note: "At least one line item is needed, otherwise the send button stays greyed out.",
        },
        {
          text: "Click “Save”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "senden",
      text: "Giving it to the customer",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "No email is sent",
      text: "“Send to customer” only makes the amendment available and locks it. You have to pass the link on yourself — unlike with a quote.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Send to customer” and confirm.",
          note: "After that the amendment's content is locked, so the customer can re-read what they received.",
        },
        {
          text: "Copy the “Customer link” that now appears.",
          note: "It is only shown after sending.",
        },
        {
          text: "Send the link the way you normally would.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "The amendment statuses",
    },
    {
      kind: "statusTable",
      headers: { status: "Status", meaning: "Meaning", next: "Your next step" },
      rows: [
        { status: "Draft", meaning: "Still being worked on, invisible to the customer.", next: "Finish filling it in." },
        { status: "Sent", meaning: "Made available and locked.", next: "Pass on the link." },
        { status: "Viewed", meaning: "The customer opened the link.", next: "Wait for the answer." },
        { status: "Agreed", meaning: "Approved. The work order grows by the line items.", next: "Schedule the work." },
        { status: "Rejected", meaning: "Declined. The work order stays unchanged.", next: "Get back in touch." },
      ],
    },
    {
      kind: "heading",
      id: "danach",
      text: "What happens on approval",
    },
    {
      kind: "paragraph",
      text: "If the customer agrees, the line items are added to the work order and the totals rise. The quote and the amendment stay unchanged as evidence.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Note the link down",
      text: "There is no route back from the quote to the amendment. Save the link, or set yourself a follow-up while the page is still open.",
    },
  ],

  whatHappensNext: [
    "After sending, the amendment is locked and the customer link is visible.",
    "If the customer opens the link, the status changes to “Viewed”.",
    "On approval, the work order's line items and total grow.",
    "On rejection, everything stays as agreed.",
  ],

  commonMistakes: [
    "Expecting an email to go out. The link has to be passed on by hand.",
    "Creating the amendment and leaving the page without saving the link. There is no route back.",
    "Looking for an amendment on a quote that is not accepted yet. There, the new version is the right route.",
  ],

  ifSomethingGoesWrong: [
    "“Send to customer” stays greyed out: the title or a line item is missing.",
    "You cannot find the amendment again: there is no overview. Keep the link, or ask support.",
    "The fields will not change: the amendment has been sent and is therefore locked. Create a second one if needed.",
  ],
} satisfies WikiArticleBody;

export default body;
