import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-version",
  locale: "en",
  title: "A new version of a quote",
  summary: "When something changes after sending — and how to tell the revisions apart.",

  purpose:
    "A sent quote is locked. If you still need to change something, create a new version. The old one stays as evidence.",

  whenToUse: [
    "The customer asks for an extra service after you sent the quote.",
    "You miscalculated a price and the quote has already gone out.",
    "A date shifts and the quote names a date.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Only after sending, and only before acceptance",
      text: "On a draft you edit directly. On an accepted quote you need an amendment. The new version sits exactly between the two.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Creating a new version",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open the sent quote from the list.",
        },
        {
          text: "Click “New version” at the top right.",
          note: "The button is absent if the quote is still a draft, already accepted, or itself superseded.",
        },
        {
          text: "You land in the edit form of the new revision.",
          note: "All line items are carried over. The new revision is a draft.",
        },
        {
          text: "Adjust what has changed and send the quote.",
          note: "Through “Save and send” it goes to the same address.",
        },
      ],
    },
    {
      kind: "heading",
      id: "was-passiert",
      text: "What happens to the old revision",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "The old revision stays exactly as it was — as evidence of what the customer saw.",
        "It is marked as superseded and shows the red note that a newer version of this revision exists.",
        "Its link stays reachable, but the customer can no longer accept through it.",
        "If someone opens the old link, they see a note that a newer revision exists.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The superseded revision — flagged in red and without a button for a further version.",
      alt: "Detail view of a superseded quote with the red note that a newer version of this revision exists, and only the button to download the PDF.",
      hotspots: [
        { n: 1, xPct: 32, yPct: 12, label: "The red note about the newer revision." },
        { n: 2, xPct: 92, yPct: 10, label: "Only the PDF left — no changes possible." },
      ],
    },
    {
      kind: "heading",
      id: "auseinanderhalten",
      text: "Telling the revisions apart",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The number stays the same",
      text: "Version 2 carries the same quote number as version 1. In the quote list both appear as separate rows with the same number — the list shows no version number.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Look at the date and the status in the list.",
          note: "The newer revision is younger and usually still a “Draft”.",
        },
        {
          text: "Open the quote to be certain.",
          note: "From version 2 onwards, “Version 2” appears at the top. The superseded revision carries the red note.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "When it is not possible",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Why", next: "What to do instead" },
      rows: [
        { status: "A newer version already exists", meaning: "You are on a superseded revision.", next: "Open the newest one and continue there." },
        { status: "The quote is accepted", meaning: "The scope is agreed.", next: "Create an amendment." },
        { status: "The quote is still a draft", meaning: "Nothing is locked.", next: "Edit it directly." },
      ],
    },
  ],

  whatHappensNext: [
    "The new revision is a draft and carries the same quote number.",
    "After sending it becomes the current one; the old stays as evidence.",
    "The customer can only accept through the newest revision.",
  ],

  commonMistakes: [
    "Trying to delete the old revision. It proves what the customer originally received.",
    "Sending the customer the old link again. They can no longer accept through it — copy the new revision's link.",
    "Looking for “New version” on an already accepted quote. There, only the amendment exists.",
  ],

  ifSomethingGoesWrong: [
    "The “New version” button is missing: the quote is a draft, accepted, or itself superseded.",
    "You do not know which revision is current: open both; the superseded one carries the red note.",
    "You created two new versions by accident: send only the last. Unsent drafts can be deleted.",
  ],
} satisfies WikiArticleBody;

export default body;
