import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rollen-und-rechte",
  locale: "en",
  title: "Roles and permissions",
  summary: "Who may do what: owner, admin and member.",

  purpose:
    "Everyone on the team has a role. The role decides who may record money, change settings and delete data.",

  whenToUse: [
    "A button is missing for you but not for a colleague.",
    "You are setting up a new account and have to choose a role.",
    "You want to know why you cannot record a payment.",
    "You are checking who may delete customer data.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "eigene-rolle",
      text: "Seeing your own role",
    },
    {
      kind: "steps",
      steps: [
        { text: "Click your name in the top right." },
        {
          text: "Your role is shown under your email address.",
          note: "It reads “Owner”, “Admin” or “Member”.",
        },
      ],
    },
    {
      kind: "heading",
      id: "die-drei-rollen",
      text: "The three roles",
    },
    {
      kind: "statusTable",
      headers: { status: "Role", meaning: "What this role may do", next: "Typically for" },
      rows: [
        {
          status: "Owner",
          meaning: "Everything. The owner is the person the company is registered to.",
          next: "Management.",
        },
        {
          status: "Admin",
          meaning: "Almost everything, including money, settings and deleting.",
          next: "Office management and their deputy.",
        },
        {
          status: "Member",
          meaning: "The daily work: enquiries, quotes, appointments and work orders.",
          next: "Scheduling and job supervision.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Owner and admin only",
      text: "Recording and changing payments, merging or deleting customer data, changing company settings, editing templates and pricing, deleting invoices and cases.",
    },
    {
      kind: "heading",
      id: "was-alle-duerfen",
      text: "What everyone may do",
    },
    {
      kind: "paragraph",
      text: "Members see the same data as the owner and admins. They can carry out the daily work in full.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "View, record and edit enquiries.",
        "Write, send and track quotes.",
        "Create and change appointments in the calendar.",
        "Plan and close work orders.",
        "Read every list and report.",
      ],
    },
    {
      kind: "heading",
      id: "was-eingeschraenkt-ist",
      text: "What is blocked for members",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Recording, changing or reversing payments.",
        "Merging two customer records.",
        "Deleting customers, invoices, cases or messages.",
        "Changing company details, templates, pricing and reminders.",
        "Creating credit notes and payment reminders.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "A missing button is not a fault",
      text: "If a button does not appear for you, you do not have the permission for it. Ask someone with the owner or admin role to carry out the step.",
    },
    {
      kind: "heading",
      id: "kunden-zusammenfuehren",
      text: "Example: merging customers",
    },
    {
      kind: "paragraph",
      text: "If the same customer appears twice, the records can be merged. This is the clearest difference between the roles.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Merging cannot be undone",
      text: "The two records become one. Check carefully first that it really is the same person or company.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Open “Customers” and then the record in question." },
        {
          text: "Look for the note about a possible duplicate.",
          note: "It only appears when the program has found a similar record.",
        },
        {
          text: "Compare both records line by line.",
          note: "The same name is not enough. Compare the email address and the phone number.",
        },
        {
          text: "Merge only when you are certain.",
          note: "As a member you will not see this button.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Your role applies to the whole company, not page by page.",
    "A role change takes effect as soon as that person reloads the page.",
    "Blocked actions are not merely hidden — they are also refused in the background.",
  ],

  commonMistakes: [
    "Giving everyone the admin role so “nothing is blocked”. Then anyone can change money and customer data.",
    "Assuming members see less data. They see the same; they may just change less.",
    "Creating a second account because a button is missing. That produces duplicate records.",
  ],

  ifSomethingGoesWrong: [
    "A button is missing: check your role in the menu at the top right.",
    "An action fails with an error although the button was there: you lack the permission. Ask the owner or an admin.",
    "You need more permissions permanently: have your role changed rather than using a second account.",
  ],
} satisfies WikiArticleBody;

export default body;
