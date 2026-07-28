import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-bearbeiten",
  locale: "en",
  title: "Editing a quote",
  summary: "Changing drafts — and why sent quotes lock themselves.",

  purpose:
    "While a quote is a draft you can change anything about it. Once it has been sent, the content is locked.",

  whenToUse: [
    "A draft is not finished yet.",
    "You spotted a typo before the quote went out.",
    "You want to adjust the line items of a new version.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Only drafts can be edited",
      text: "If you open a sent quote for editing, a message sends you back. That is deliberate, not a fault.",
    },
    {
      kind: "heading",
      id: "warum-gesperrt",
      text: "Why a sent quote is locked",
    },
    {
      kind: "paragraph",
      text: "The customer must be able to re-read what they received. If a sent quote could be altered afterwards, the link would be worth nothing as evidence.",
    },
    {
      kind: "paragraph",
      text: "The lock is not only in the display. A detour through another route is refused as well.",
    },
    {
      kind: "heading",
      id: "bearbeiten",
      text: "Editing a draft",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open the quote list and find the draft.",
          note: "Drafts carry the grey “Draft” marker.",
        },
        {
          text: "In the three-dot menu, click “Edit”.",
        },
        {
          text: "Change whatever needs changing.",
          note: "The form is the same one used when creating.",
        },
        {
          text: "Click “Save changes” or “Save and send”.",
          note: "The second button saves and sends in one step.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "A sent quote: no editing buttons, only the PDF and the customer link.",
      alt: "Detail view of a sent quote. At the top a red note about a newer version; on the right only the Customer, Activities and Customer link areas, with no way to edit.",
    },
    {
      kind: "heading",
      id: "was-tun",
      text: "What to do when the quote is already out",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "The right route", next: "Guide" },
      rows: [
        { status: "Sent, no answer yet", meaning: "Create a new version and send that.", next: "A new version of a quote" },
        { status: "Accepted, scope changes", meaning: "Create an amendment.", next: "An amendment to a quote" },
        { status: "Rejected", meaning: "Change nothing. New quote from the enquiry.", next: "Writing a quote" },
        { status: "Still a draft", meaning: "Edit it directly.", next: "This guide" },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "A new version is a draft again",
      text: "Creating a new version produces a fresh draft with the same line items. You edit that normally and then send it.",
    },
  ],

  whatHappensNext: [
    "Saved changes take effect at once, as long as the quote is a draft.",
    "With “Save and send” the status changes to “Sent” and the content locks.",
    "After that, you only change things through a new version.",
  ],

  commonMistakes: [
    "Trying to fix a price quickly after sending. That is locked — use a new version.",
    "Trying to edit an accepted quote. For changes to the agreed scope there is the amendment.",
    "Creating several drafts for the same enquiry instead of editing one. That confuses the list.",
  ],

  ifSomethingGoesWrong: [
    "“This quote has been sent”: that is correct. Create a new version.",
    "“Editing not possible”: the quote is accepted or rejected.",
    "“Error while saving” on an older revision: you are editing a superseded version. Open the newest one instead.",
  ],
} satisfies WikiArticleBody;

export default body;
