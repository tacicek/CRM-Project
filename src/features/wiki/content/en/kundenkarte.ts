import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "en",
  title: "The customer card",
  summary: "Everything about one customer: contact, records, amounts, history and portal access.",

  purpose:
    "The customer card brings together everything that belongs to one person or company. It answers “what has happened so far?” without searching through several lists.",

  whenToUse: [
    "The customer calls and you need the picture in ten seconds.",
    "You want to know how much someone has paid in total.",
    "You suspect a duplicate record.",
    "You want to give the customer portal access.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The customer card with contact, records and amounts.",
      alt: "Customer card with the name at the top, a card for contact details and notes on the left, and counters for enquiries, quotes and work orders plus a summary of amounts on the right.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 33, label: "Contact details. Only the note can be changed here." },
        { n: 2, xPct: 75, yPct: 30, label: "Records: how many enquiries, quotes, work orders and documents." },
        { n: 3, xPct: 75, yPct: 60, label: "Finances: invoiced, paid and open." },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Contact and note",
    },
    {
      kind: "paragraph",
      text: "On the left you see email, phone, language, customer number and origin. These fields are read-only here.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Write into the “Notes” field what the team should know.",
          note: "For example: “Prefers to be called after 5 pm.” The customer never sees this note.",
        },
        {
          text: "Click “Save changes”.",
          note: "The button only appears once you have typed something.",
        },
      ],
    },
    {
      kind: "heading",
      id: "betraege",
      text: "Understanding the amounts",
    },
    {
      kind: "statusTable",
      headers: { status: "Line", meaning: "What it contains", next: "Careful" },
      rows: [
        { status: "Invoiced", meaning: "Total of all issued invoices, excluding drafts.", next: "—" },
        { status: "Paid", meaning: "Total of every recorded payment.", next: "Reversals are already deducted." },
        { status: "Open", meaning: "What is still outstanding on issued invoices.", next: "—" },
        { status: "Of which receipts", meaning: "The part of “Paid” that came in through receipts.", next: "A share, not a second amount." },
        { status: "Credit notes", meaning: "Total of the credit notes sent.", next: "—" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Do not add “Of which receipts”",
      text: "That line is a slice of “Paid”. Adding both counts the same money twice.",
    },
    {
      kind: "heading",
      id: "verlauf",
      text: "The history",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Switch to “History” at the top.",
          note: "You see enquiries, quotes, work orders, appointments, invoices, receipts and emails in date order.",
        },
        {
          text: "Click “Load more” at the bottom if the list continues.",
        },
      ],
    },
    {
      kind: "heading",
      id: "dubletten",
      text: "Merging duplicate records",
    },
    {
      kind: "paragraph",
      text: "When two records share a phone number, the note “Possibly the same person” appears at the top.",
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Owner and admin only",
      text: "Anyone may check. Only the owner and admins may merge. As a member you will not see the button.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Merging cannot be undone",
      text: "Two records become one. Check the email address and phone number before you confirm — the same name is not enough.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click “Check” in the note." },
        {
          text: "Compare the two columns “Stays” and “Will be merged”.",
          note: "“Swap direction” switches which record survives.",
        },
        {
          text: "Read the line “Stays on the target, will be lost” if it appears.",
          note: "It shows which details disappear.",
        },
        {
          text: "To confirm, retype the name of the record being merged away.",
          note: "Only then does “Merge” become active. That is the safeguard against a stray click.",
        },
      ],
    },
    {
      kind: "heading",
      id: "portal",
      text: "Portal access",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Create access”.",
          note: "A link is generated that works only once.",
        },
        {
          text: "Click “Copy link” and send it to the customer the way you normally would.",
          note: "The link is shown only now. If you leave the page it is gone — simply create a new one.",
        },
        {
          text: "“Revoke access” ends any running sessions.",
        },
      ],
    },
    {
      kind: "paragraph",
      text: "If the customer changes their details in the portal, the section “Open change requests” appears here. You decide with “Accept” or “Reject”.",
    },
  ],

  whatHappensNext: [
    "Saved notes are visible to the whole team straight away.",
    "After a merge you land on the record that survives.",
    "An accepted change request writes the customer's details into the record.",
  ],

  commonMistakes: [
    "Adding “Invoiced” and “Paid”. One is issued, the other is received.",
    "Merging because two people share a name. Always check email and phone.",
    "Planning to copy the portal link later. It is shown only once.",
  ],

  ifSomethingGoesWrong: [
    "“Merge” is missing: your role does not allow it. Ask the owner or an admin.",
    "You lost the portal link: simply create a new one. The old one loses none of its security.",
    "An amount looks wrong: open “Finances” and check the recorded payments — the card only adds them up.",
  ],
} satisfies WikiArticleBody;

export default body;
