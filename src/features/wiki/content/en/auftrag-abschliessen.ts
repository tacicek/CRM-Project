import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftrag-abschliessen",
  locale: "en",
  title: "Planning and closing a work order",
  summary: "Assign the team, set the pricing, close it — and bill afterwards.",

  purpose:
    "A work order grows out of an accepted quote. You set the date, the team and the pricing type, then close it once the work is done.",

  whenToUse: [
    "A quote was accepted and the work needs scheduling.",
    "You want to name a team leader.",
    "The job is finished and the hours need recording.",
    "You work by the hour and need the final price.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "A work order needs an accepted quote",
      text: "“New job” first shows a list of accepted quotes. Without a quote, a new work order cannot be saved.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/auftrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The work-order window with the list of accepted quotes.",
      alt: "Window for a new work order showing the list of approved quotes from which a job can be created.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Creating a work order",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open the accepted quote and click “Create work order”.",
          note: "Or use “New job” in the list and pick the quote there.",
        },
        {
          text: "Check the “Title” and the “Customer details”.",
          note: "Title, surname and date are required.",
        },
        {
          text: "Enter the job under “Date” and “Time” and choose the “Estimated duration”.",
          note: "A date in the past is refused for a new work order.",
        },
        {
          text: "Click “Create work order”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "preis",
      text: "Choosing the pricing type",
    },
    {
      kind: "statusTable",
      headers: { status: "Pricing type", meaning: "Meaning", next: "At closing" },
      rows: [
        { status: "Fixed price", meaning: "A set amount taken from the quote.", next: "Nothing to work out." },
        { status: "By effort", meaning: "Charged by the hours worked.", next: "You enter the hours." },
        { status: "Estimate", meaning: "An estimate; the final amount is as quoted.", next: "Nothing to work out." },
      ],
    },
    {
      kind: "heading",
      id: "team",
      text: "Assigning the team",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Under “Team leader”, choose the person in charge.",
          note: "Only people with an email address appear here — they are the ones who get the reminder.",
        },
        {
          text: "Set how far ahead the reminder should go out.",
          note: "One day, two days, three days or a week before.",
        },
        {
          text: "Tick everyone who is coming along under “Further team members”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Vehicles and equipment live in the calendar",
      text: "In the work order you only pick people. Vehicles and equipment are assigned on the appointment, in the calendar.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Additional services” do not change the total",
      text: "What you enter there is kept, but it does not feed into the subtotal, VAT or total. The amount comes from the quote.",
    },
    {
      kind: "heading",
      id: "abschliessen",
      text: "Closing the work order",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "In the list, open the three-dot menu and choose “Close …”.",
          note: "In the edit window, “Completed” is deliberately not offered as a status.",
        },
        {
          text: "For “By effort”: enter the hours actually worked.",
          note: "The final price is worked out below straight away. Without the hours it cannot be closed.",
        },
        {
          text: "Add closing notes if useful.",
          note: "For example anything unusual about the job.",
        },
        {
          text: "Click “Close”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "“Completed” is a dead end",
      text: "No status change leads back out of it. Only close when the work really is finished and the effort is known.",
    },
    {
      kind: "heading",
      id: "abrechnen",
      text: "Billing afterwards",
    },
    {
      kind: "paragraph",
      text: "Closing creates no invoice. Only afterwards does “Create invoice” appear in the menu, leading to a prepared draft.",
    },
  ],

  whatHappensNext: [
    "On creation, a matching appointment appears in the calendar automatically.",
    "If you change the date or time on the job, the appointment follows.",
    "After closing, the final price is fixed and “Create invoice” becomes available.",
    "If the linked appointment is cancelled, the job becomes “Cancelled”.",
  ],

  commonMistakes: [
    "Entering additional services here and expecting the total to rise. It does not move.",
    "Closing before the hours are known. There is no way back.",
    "Looking for a team leader who does not appear. Without an email address they are not offered.",
  ],

  ifSomethingGoesWrong: [
    "“Please fill in all required fields”: the title, surname or date is missing.",
    "“Date in the past”: not allowed for a new work order. Choose a future date.",
    "“Hours required”: for a by-effort closing, the hours worked are mandatory.",
  ],
} satisfies WikiArticleBody;

export default body;
