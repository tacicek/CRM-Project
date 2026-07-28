import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "typischer-arbeitstag",
  locale: "en",
  title: "A typical working day",
  summary: "A short list of what you check in the morning, during the day and in the evening.",

  purpose:
    "This guide gives you a fixed order for the day. If you keep to it, nothing is left lying around.",

  whenToUse: [
    "In the first few weeks, until the order becomes a habit.",
    "After holiday or illness, to work through the backlog in order.",
    "When you are training someone to cover for you.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "morgens",
      text: "Morning: take stock",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open “Overview”.",
          note: "Four tiles show straight away where something is outstanding.",
        },
        {
          text: "Look under “Today” to see which appointments are due.",
          note: "Check that a team and a vehicle are fixed for every job.",
        },
        {
          text: "Open “Email inbox” if a number is shown next to it.",
          note: "Those messages are waiting for you to turn them into an enquiry or discard them.",
        },
        {
          text: "Open “Follow-ups”.",
          note: "These are tasks with a date. Overdue ones are highlighted.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The order is deliberate",
      text: "Overview first, then the inbox, then your own tasks. That way you decide about new work before the day catches up with you.",
    },
    {
      kind: "heading",
      id: "tagsueber",
      text: "During the day: turn enquiries into quotes",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open “Enquiries” and work through the new ones from top to bottom.",
          note: "New enquiries are marked “New”.",
        },
        {
          text: "Decide for each one: write a quote, or view the site first.",
          note: "For large or unclear jobs, a viewing is worth the time.",
        },
        {
          text: "Check the customer's language before you send.",
          note: "After sending, the quote can no longer be changed.",
        },
        {
          text: "Create a follow-up if you want to chase it later.",
          note: "Then the program reminds you instead of you having to remember.",
        },
      ],
    },
    {
      kind: "heading",
      id: "nach-dem-einsatz",
      text: "After a job: bill for it",
    },
    {
      kind: "steps",
      steps: [
        { text: "Open “Work orders” and close the finished job." },
        {
          text: "Create an invoice or a receipt.",
          note: "A receipt fits when payment happens on site. Otherwise use an invoice.",
        },
        {
          text: "Record payments you have received under “Finances”.",
          note: "The invoice status follows automatically from the payments you record.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Do not set an invoice to “paid” by hand",
      text: "There is no switch for it, and that is on purpose. Record the payment; the status follows from it.",
    },
    {
      kind: "heading",
      id: "abends",
      text: "Evening: a quick tidy-up",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Check in “Inbox” whether a customer message is still unanswered.",
          note: "You write replies in your normal email program; this screen only shows you the overview.",
        },
        {
          text: "Look in “Cases” for an open complaint.",
          note: "A case left open in the evening is an angry phone call the next morning.",
        },
        {
          text: "Glance at the “Calendar” for tomorrow.",
          note: "If a team is missing somewhere, you still notice it today.",
        },
      ],
    },
    {
      kind: "heading",
      id: "wochenrhythmus",
      text: "Once a week",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Open “Metrics” and see how many quotes became work orders.",
        "Check “Finances” for overdue invoices.",
        "Check “Moving boxes” if you rent them out: which are overdue?",
      ],
    },
  ],

  whatHappensNext: [
    "After this round, no enquiry is unanswered for more than a day.",
    "Every finished job has an invoice or a receipt.",
    "Anything you want to pick up later is a follow-up with a date on it.",
  ],

  commonMistakes: [
    "Collecting enquiries and handling them once a week. Whoever quotes first usually wins the job.",
    "Recording payments only at month end. Until then no figure under “Finances” is correct.",
    "Creating follow-ups and never opening the list. It only helps if you look at it daily.",
  ],

  ifSomethingGoesWrong: [
    "You have lost track: start at “Follow-ups” and work through the overdue entries.",
    "Very many open enquiries: sort by date and start with the oldest.",
    "You do not know whether a job was billed: open the work order; linked invoices and receipts are shown there.",
  ],
} satisfies WikiArticleBody;

export default body;
