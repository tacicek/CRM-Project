import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "en",
  title: "The customer card",
  summary:
    "Everything about one customer: contact, address, records, amounts, activity, service locations and portal access.",

  purpose:
    "The customer card answers in ten seconds: who is this? how do I reach them? where do they live? where do we work? what comes next? is anything outstanding? what happened last?",

  whenToUse: [
    "The customer calls and you need the current picture in ten seconds.",
    "You need the address or the access notes for a property.",
    "You want to correct a name, phone number, e-mail address or language.",
    "You suspect a duplicate entry.",
    "You want to give the customer portal access.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The customer card: header with quick actions, attention strip, five tabs.",
      alt: "Customer card with the name at the top, below it buttons for Edit, Call, E-mail and Offer, a card for the next appointment, the tabs Overview, Activity, Records, Finance and Locations, plus blocks for contact, activity, records and finance.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 23, label: "Quick actions. Only what actually exists appears." },
        { n: 2, xPct: 31, yPct: 31, label: "Attention strip: next task, next appointment with its time, open balance." },
        { n: 3, xPct: 33, yPct: 39, label: "The five tabs of the card." },
        { n: 4, xPct: 26, yPct: 66, label: "Without an address the action stands here, not a dash." },
        { n: 5, xPct: 78, yPct: 74, label: "Invoiced, paid and open — overdue would be outlined in red." },
      ],
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "How the card is laid out",
    },
    {
      kind: "paragraph",
      text: "At the very top: name, type (person or company), status and customer number — next to them the buttons for calling, e-mail, copying the address and the map. Only the buttons that have something behind them appear.",
    },
    {
      kind: "paragraph",
      text: "Below that sits the attention strip: the next task, the next appointment with its time, the open balance and open cases. Anything overdue is outlined in red and carries the word “overdue”. If nothing is listed there, nothing is outstanding.",
    },
    {
      kind: "statusTable",
      headers: { status: "Tab", meaning: "What it holds", next: "What it answers" },
      rows: [
        { status: "Overview", meaning: "Contact, address, activity, counters, amounts, portal access.", next: "The ten-second look." },
        { status: "Activity", meaning: "Every event in chronological order, filterable.", next: "“What happened here?”" },
        { status: "Records", meaning: "Offers, jobs, invoices, receipts and appointments as lists.", next: "“Which offer was that?”" },
        { status: "Finance", meaning: "Invoiced, paid, open — and the documents behind them.", next: "“Is anything still open?”" },
        { status: "Locations", meaning: "Address, billing address and service locations.", next: "“Where are we driving?”" },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Changing the master data",
    },
    {
      kind: "paragraph",
      text: "Name, company, salutation, phone, e-mail, language, status, customer number and the note are changed via “Edit” at the top.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click “Edit” at the top." },
        {
          text: "Change the fields. The display name normally follows the name.",
          note: "If you want your own name such as “The Müller family”, switch on “Custom display name” — it then stays as typed, even when the last name changes.",
        },
        {
          text: "Click “Save”.",
          note: "If saving fails, the form stays open with your entries. Nothing is lost.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Old documents do not change",
      text: "A corrected address or e-mail applies from now on. Offers, jobs and invoices already issued keep the state they had when they were created — that is deliberate.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Phone numbers need a dialling code",
      text: "Write “079 123 45 67” or “+41 79 123 45 67”. A number that starts with neither 0 nor +41 cannot be matched — the same person's next request would then create a second entry. The form warns you beforehand.",
    },
    {
      kind: "heading",
      id: "adressen",
      text: "Address and service locations",
    },
    {
      kind: "paragraph",
      text: "The “Locations” tab holds two different things, and the distinction matters: the address is where the customer lives and where the invoice goes. A service location is where the work happens — move-out, move-in, cleaning object or storage.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Why the address is empty at first",
      text: "Addresses from requests are service locations, not a postal address. On a move, the move-out address is precisely the one the customer no longer lives at — so it is not carried over as a home address. Enter the address yourself with “Add address”.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Switch to the “Locations” tab at the top." },
        {
          text: "Click “Add address” and type the address.",
          note: "The suggestions help but are not required: “c/o Meier, rear building on the left” goes in just as well.",
        },
        {
          text: "Choose “Correspondence address” or “Billing address”.",
          note: "Without a billing address of its own, invoices go to the correspondence address. Per type exactly one address counts as the main address.",
        },
        {
          text: "Under “Service locations”, add floor, lift, parking and access notes.",
          note: "That saves asking again on the second job at the same property. Service locations also appear automatically from jobs.",
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
      headers: { status: "Row", meaning: "What is in it", next: "Watch out" },
      rows: [
        { status: "Invoiced", meaning: "Total of all issued invoices, drafts excluded.", next: "—" },
        { status: "Paid", meaning: "Total of all recorded incoming payments.", next: "Reversals are already deducted." },
        { status: "Open", meaning: "What is still outstanding on issued invoices.", next: "—" },
        { status: "Of which receipts", meaning: "The part of “Paid” that came in via a receipt.", next: "A share, not a second amount." },
        { status: "Credit notes", meaning: "Total of the credit notes sent.", next: "—" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Do not add “Of which receipts”",
      text: "That row is an extract from “Paid”. Adding both counts the same money twice.",
    },
    {
      kind: "heading",
      id: "verlauf",
      text: "The activity trail",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Switch to the “Activity” tab at the top.",
          note: "You see requests, offers, jobs, appointments, invoices, receipts and e-mails in chronological order — with date and time.",
        },
        {
          text: "Narrow it down with the filters: All, Offers, Jobs, Finance, Contact.",
        },
        {
          text: "Click a row to open the document.",
          note: "Offers, invoices and receipts open. Requests, jobs, appointments and e-mails have no dedicated screen — those rows are therefore not clickable.",
        },
        {
          text: "Click “Load more” at the bottom if the list continues.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "“Last activity” is always in the past",
      text: "An appointment next week does not count as last activity — it appears under “Next appointment”. So “Last activity 4 months ago” really does mean nothing has happened since.",
    },
    {
      kind: "heading",
      id: "dubletten",
      text: "Merging duplicate entries",
    },
    {
      kind: "paragraph",
      text: "If two entries share a phone number, the notice “Possibly the same person” appears at the top.",
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Owner and admin only",
      text: "Everyone may review. Only the owner and admins may merge. As a staff member you do not see the button.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Merging cannot be undone",
      text: "Two entries become one. Check the e-mail address and phone number before confirming — the same name is not enough.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click “Review” in the notice." },
        {
          text: "Compare the two columns “Will be kept” and “Will be merged”.",
          note: "“Swap direction” flips which entry survives.",
        },
        {
          text: "Read the row “Stays on the target, will be lost” if it appears.",
          note: "It lists the details that disappear.",
        },
        {
          text: "To confirm, type the name of the entry that is being merged away.",
          note: "Only then does “Merge” become clickable. That is the safeguard against a stray click.",
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
          note: "A link is created that is valid exactly once.",
        },
        {
          text: "Click “Copy link” and send it to the customer the way you usually would.",
          note: "The link is shown only now. Leave the page and it is gone — then create a new one.",
        },
        {
          text: "“Revoke access” ends any running sessions.",
        },
      ],
    },
    {
      kind: "paragraph",
      text: "If the customer changes their details in the portal, the “Open change requests” section appears here. You decide with “Accept” or “Reject”.",
    },
  ],

  whatHappensNext: [
    "Saved details are visible to the whole team immediately.",
    "Offers, jobs and invoices already issued stay unchanged.",
    "After a merge you land on the entry that survives — including the payments, cases, tasks, addresses and service locations of the other one.",
    "An accepted change request writes the customer's details into the entry.",
  ],

  commonMistakes: [
    "Adding “Invoiced” and “Paid”. One is issued, the other received.",
    "Treating a request's move-out address as the home address. That is why the list writes “Last service site” in front of it as long as no address is on file.",
    "Entering a phone number without a dialling code.",
    "Merging because two people share a name. Always check e-mail and phone.",
    "Planning to copy the portal link later. It is shown only once.",
  ],

  ifSomethingGoesWrong: [
    "“Merge” is missing: your role does not allow it. Ask the owner or an admin.",
    "“Merge stopped”: both entries collide in the same place. Nothing was changed; the message says where. Resolve it there and try again.",
    "A section shows a red box instead of numbers: the details could not be loaded. Click “Try again”. The amounts deliberately do not read 0.00 — 0.00 would be a claim nobody verified.",
    "You lost the portal link: simply create a new one. The old one loses none of its security.",
    "An amount looks wrong: open “Finance” and check the recorded payments — the card only adds them up.",
  ],
} satisfies WikiArticleBody;

export default body;
