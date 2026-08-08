import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender-abo",
  locale: "en",
  title: "Subscribe to the calendar",
  summary:
    "Your appointments in your phone or computer calendar — one coloured calendar per appointment type.",

  purpose:
    "Your CRM appointments appear as a subscription in the calendar you already use: Apple, Google or Outlook. Each appointment type becomes its own calendar there, with its own colour, and can be shown or hidden individually.",

  whenToUse: [
    "You want to see your jobs on your phone without opening the program.",
    "The team should have company appointments next to their private ones, in their usual calendar.",
    "A device was lost or a link was passed on — its access has to go.",
    "You are setting up a new phone and need fresh subscription links.",
  ],

  blocks: [
    {
      kind: "paragraph",
      text: "The connection works through one secret link per appointment type: viewings, jobs, follow-ups, meetings, blocked time and other appointments. You only subscribe to the types you want to see.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "One calendar per type, with a fixed colour",
      text: "Each subscribed calendar is named after the company and the type, for example “Hirschenumzug GmbH – Besichtigungen”, and carries the colour the type also has in the program. That way you can hide meetings without losing the jobs.",
    },
    {
      kind: "heading",
      id: "einrichten",
      text: "How to set it up",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Open “Settings” and switch to the “Calendar” tab.",
        },
        {
          text: "Enter a label, for example “iPhone Anna”.",
          note: "That is how you will later recognise which device or person to cut off again.",
        },
        {
          text: "Click “Create token”.",
          note: "The subscription links below it are shown only this once. Copy them now.",
        },
        {
          text: "Copy the link of the appointment type you want, using the copy symbol.",
        },
        {
          text: "Add the link as a subscription in your calendar app and repeat for the other types.",
          note: "Where exactly is listed below, per app.",
        },
      ],
    },
    {
      kind: "heading",
      id: "apps",
      text: "Where to paste the link",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Apple Calendar (Mac): “File › New Calendar Subscription…”, paste the link. iPhone: “Settings › Apps › Calendar › Calendar Accounts › Add Account › Other › Add Subscribed Calendar”.",
        "Google Calendar: in the browser, next to “Other calendars” on the left, click the plus and choose “From URL”.",
        "Outlook: in the calendar, “Add calendar › Subscribe from web”.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The link is a password",
      text: "Anyone who knows the link sees the names, addresses and phone numbers of your appointments — without signing in. Do not forward it. Every person and every device gets its own token.",
    },
    {
      kind: "heading",
      id: "aktualisierung",
      text: "Refresh and direction",
    },
    {
      kind: "paragraph",
      text: "The subscription is a one-way street: what you change in the program appears in the subscribed calendar — changes made in the phone calendar have no effect. You keep editing appointments here, in the program.",
    },
    {
      kind: "paragraph",
      text: "How often it refreshes is decided by your calendar app — typically a few minutes to a few hours. A moved appointment replaces its old entry, so no duplicates appear. Cancelled appointments are marked as cancelled.",
    },
    {
      kind: "heading",
      id: "widerrufen",
      text: "Revoking access",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "In “Settings › Calendar”, open the “Existing tokens” list.",
          note: "“Last used” shows whether a token is still being fetched at all.",
        },
        {
          text: "Click “Revoke” next to the token in question and confirm.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Revoking is final",
      text: "Every calendar subscription set up with this token stops working immediately — on every device. A revoked token cannot be revived; create a new one if needed and subscribe again.",
    },
  ],

  whatHappensNext: [
    "New, moved and cancelled appointments appear by themselves after the next refresh.",
    "In the token list, “Last used” shows when a calendar last fetched the data.",
    "After a revocation the calendar app reports the calendar as unreachable — remove the dead subscription there by hand.",
  ],

  commonMistakes: [
    "Forwarding one link to several people instead of creating a token per person — revoking then hits all of them at once.",
    "Closing the window before the links are copied. They are shown only once; simply create a new token then.",
    "Trying to change an appointment in the phone calendar. The subscription only reads — editing happens in the program.",
    "Wondering why a change is not there yet. The calendar app only picks it up at the next refresh.",
  ],

  ifSomethingGoesWrong: [
    "The subscribed calendar stays empty: check that the link was copied completely, then subscribe again.",
    "The calendar app reports an error when fetching: the token was probably revoked. Create a new one and set up the subscription again.",
    "A link ended up in the wrong hands: revoke the token immediately — every subscription tied to it is dead on the spot.",
  ],
} satisfies WikiArticleBody;

export default body;
