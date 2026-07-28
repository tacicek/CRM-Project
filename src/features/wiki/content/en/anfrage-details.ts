import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-details",
  locale: "en",
  title: "Viewing and correcting an enquiry",
  summary: "Read every detail — and put right whatever was recognised wrongly.",

  purpose:
    "Enquiries often come from an email and are analysed automatically. Before you write a quote, check the details and correct what is wrong.",

  whenToUse: [
    "Before every quote, to check the details.",
    "The customer calls and gives a different address.",
    "The automatic analysis guessed the language wrongly.",
    "A phone number or postcode is missing.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Two windows, two purposes",
      text: "“Details” is for reading only and gives you the picture quickly. “Edit” opens the form where you change things.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/anfrage-details-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The detail window with contact, addresses and description.",
      alt: "Window opened over the enquiry list showing the customer's name, the contact details, the from and to addresses, date, rooms and floor area, and the description.",
    },
    {
      kind: "heading",
      id: "lesen",
      text: "Reading the details",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "On an enquiry card, click “Details”.",
          note: "The window sits over the list. Nothing can be changed here.",
        },
        {
          text: "Read the contact, address, date, rooms, floor area and description.",
          note: "The description often holds the customer's original wording.",
        },
        {
          text: "At the bottom, choose “Create quote” or “Edit”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Correcting the details",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Edit” — either on the card or in the detail window.",
        },
        {
          text: "At the top, under “Contact”, fill in what is missing.",
          note: "First name, surname, email, phone, preferred date and the customer's language.",
        },
        {
          text: "Below that, check the fields belonging to the service.",
          note: "For a removal, for example the from and to addresses with floor, lift, rooms and area.",
        },
        {
          text: "Click “Save”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The language decides what the customer reads",
      text: "“Customer language” drives the quote, the PDF and the emails — not your own screen. If the automatic analysis guessed wrongly, correct it here before you send the quote.",
    },
    {
      kind: "heading",
      id: "pruefungen",
      text: "What is checked when you save",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Cause", next: "What to do" },
      rows: [
        { status: "Invalid email", meaning: "The address is not in a valid format.", next: "Correct it or clear the field." },
        { status: "Invalid phone number", meaning: "Not a valid Swiss number.", next: "Enter it as +41 79 123 45 67." },
        { status: "Invalid postcode", meaning: "A postcode does not have four digits.", next: "Enter four digits." },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "What cannot be changed here",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "The service type. It is set at import and stays fixed afterwards.",
        "The sales stage. It follows on its own once a quote is created or sent.",
        "The date it arrived and the linked customer.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Wrong service type?",
      text: "Create the enquiry again — through “New enquiry” and the customer's text — then delete the wrong one.",
    },
  ],

  whatHappensNext: [
    "Saved corrections appear on the enquiry card at once.",
    "The quote picks up exactly these details when it is created.",
    "The language travels from here into the quote, the PDF and the emails.",
  ],

  commonMistakes: [
    "Only correcting the details in the quote. The enquiry then still holds the wrong ones.",
    "Confusing “Customer language” with your own screen language.",
    "Typing a postcode together with the town name. Only the four digits belong there.",
  ],

  ifSomethingGoesWrong: [
    "“Save” does nothing: a check is blocking. The message names the field.",
    "A detail is missing after saving: check you typed in the right service section — there are several address blocks.",
    "The service type is wrong: create the enquiry again; it cannot be changed.",
  ],
} satisfies WikiArticleBody;

export default body;
