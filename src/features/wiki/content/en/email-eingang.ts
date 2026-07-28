import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "email-eingang",
  locale: "en",
  title: "Working through the email inbox",
  summary: "Check, correct and accept automatically analysed customer emails.",

  purpose:
    "Emails to your enquiry address are analysed automatically. The email inbox is the queue: you decide what becomes an enquiry and what does not.",

  whenToUse: [
    "A number appears beside “Email inbox” in the menu.",
    "In the morning, before you start on the enquiries.",
    "A customer says they wrote — but you find no enquiry.",
    "An analysis failed and should run again.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/email-eingang-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The email inbox with its four tabs and the messages that came in.",
      alt: "Email inbox page with the tabs To review, Accepted, Rejected and Failed, then a list of messages showing subject, sender, service marker, confidence score and date.",
      hotspots: [
        { n: 1, xPct: 30, yPct: 20, label: "Four tabs with the number of unread messages." },
        { n: 2, xPct: 45, yPct: 34, label: "Subject and sender." },
        { n: 3, xPct: 85, yPct: 34, label: "Recognised service and the analysis confidence." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "The four tabs",
    },
    {
      kind: "statusTable",
      headers: { status: "Tab", meaning: "What sits there", next: "Your next step" },
      rows: [
        { status: "To review", meaning: "Analysed, waiting for your decision.", next: "Check, then accept or reject." },
        { status: "Accepted", meaning: "Already turned into an enquiry.", next: "Nothing further." },
        { status: "Rejected", meaning: "Sorted out by you.", next: "If that was a mistake, run the analysis again." },
        { status: "Failed", meaning: "The analysis broke off.", next: "Run the analysis again." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The number in the menu",
      text: "It counts everything under “To review”. The small numbers on the tabs, by contrast, count only the messages you have not opened yet.",
    },
    {
      kind: "heading",
      id: "pruefen",
      text: "Checking and accepting a message",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "In the “To review” tab, click a message.",
          note: "You see the subject, the sender, the message text and, below it, the recognised details.",
        },
        {
          text: "Look at the value behind “Confidence”.",
          note: "Green from 85 per cent, yellow from 60, red below that. The lower the value, the more carefully you check.",
        },
        {
          text: "Correct and complete the fields under “Recognised details”.",
          note: "Everything can be changed. What gets accepted is what you leave standing — not the original suggestion.",
        },
        {
          text: "Click “Accept as enquiry”.",
          note: "The message moves to the “Accepted” tab and the enquiry appears under “Enquiries”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The analysis invents nothing",
      text: "If the address is not in the email, the field stays empty. Get missing details with a short phone call before you accept.",
    },
    {
      kind: "heading",
      id: "ablehnen",
      text: "Rejecting advertising and stray mail",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“Reject” does not ask first",
      text: "One click and the message moves straight to the “Rejected” tab. You undo it with “Run analysis again”.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Open the message and click “Reject”." },
        {
          text: "If that was a mistake, open it in the “Rejected” tab and click “Run analysis again”.",
          note: "The analysis then runs once more.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "What the email inbox cannot do",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "It shows only an excerpt of the text. The original layout is not kept.",
        "Attachments appear by name only — you cannot download them here.",
        "You cannot reply from here. Use your normal email program.",
        "“To the enquiry” leads to the enquiry list, not straight to that one enquiry.",
        "There is no search and no filter by sender or date.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Need the attachment?",
      text: "Open the message in your normal email program. The email inbox is a checklist, not a mailbox.",
    },
  ],

  whatHappensNext: [
    "After accepting, the enquiry appears under “Enquiries” in the matching service tab.",
    "The number in the menu goes down.",
    "The message stays in the “Accepted” tab and keeps its link to the enquiry.",
  ],

  commonMistakes: [
    "Accepting without checking when the confidence is low. Wrong details then end up in the quote.",
    "Waiting for a way to reply. Replies go through your email program.",
    "Leaving failed messages lying. Often “Run analysis again” is enough.",
  ],

  ifSomethingGoesWrong: [
    "A message shows no recognised details: click “Run analysis again”. If that does not help, record the enquiry by hand.",
    "An expected message is missing entirely: check in your email program that it went to the right address.",
    "“Accepting failed”: usually a required detail such as the postcode is missing. Fill it in and try again.",
  ],
} satisfies WikiArticleBody;

export default body;
