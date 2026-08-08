import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender",
  locale: "en",
  title: "The calendar",
  summary: "Every appointment in view — views, filters, moving things and the team week.",

  purpose:
    "The calendar holds viewings, jobs and internal appointments side by side. This is where you plan, move things and see who is booked when.",

  whenToUse: [
    "You are planning the week ahead.",
    "An appointment has to be moved.",
    "You want to know who is free on Thursday.",
    "A finished appointment no longer shows up.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/kalender-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The week view with appointments in the colours of the people assigned.",
      alt: "Week view of the calendar with coloured appointment blocks, above it the View and Team toggles, the Month, Week, Day and List views, and the filter with markers for the appointment types.",
      hotspots: [
        { n: 1, xPct: 24, yPct: 18, label: "View or team week." },
        { n: 2, xPct: 41, yPct: 18, label: "Month, Week, Day or List." },
        { n: 3, xPct: 55, yPct: 18, label: "Filter — there is a number on it." },
        { n: 4, xPct: 40, yPct: 70, label: "One appointment. The colour comes from the person assigned." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Finished and cancelled appointments are hidden",
      text: "On opening, the calendar shows only “Pending” and “Confirmed”. Anyone looking for a finished appointment has to switch it on in the filter first. This is the most common reason for “my appointment is gone”.",
    },
    {
      kind: "heading",
      id: "ansichten",
      text: "The views",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "“Month” — the overview, but without times.",
        "“Week” — the working view with a time grid. The most useful for planning.",
        "“Day” — one day in detail.",
        "“List” — every upcoming appointment, one under the other.",
        "“Team” — the week per person, with hours.",
      ],
    },
    {
      kind: "heading",
      id: "filter",
      text: "Filtering",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click “Filter”.",
          note: "The number beside it shows how many restrictions are active.",
        },
        {
          text: "Under “Appointment type”, choose Viewing, Service, Follow-up, Meeting or Blocked.",
        },
        {
          text: "Under “Status”, add “Completed” and “Cancelled” if you want to see the past.",
        },
        {
          text: "Under “Team”, narrow down to individual people.",
          note: "Active filters appear as markers beside the button; clicking the “×” removes them.",
        },
      ],
    },
    {
      kind: "heading",
      id: "typen",
      text: "The appointment types",
    },
    {
      kind: "statusTable",
      headers: { status: "Type", meaning: "What for", next: "Special point" },
      rows: [
        { status: "Viewing", meaning: "An on-site visit to the customer.", next: "—" },
        { status: "Service", meaning: "The job itself.", next: "The only type with vehicles and equipment." },
        { status: "Follow-up", meaning: "A reminder to get back in touch.", next: "—" },
        { status: "Meeting", meaning: "Internal.", next: "No confirmation goes to a customer." },
        { status: "Blocked", meaning: "Time that is not available.", next: "No customer details." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "The colour shows the person, not the type",
      text: "As soon as someone is assigned, the appointment takes their colour. Only unassigned appointments carry the colour of their type.",
    },
    {
      kind: "heading",
      id: "verschieben",
      text: "Moving appointments",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Drag an appointment to another day or time.",
          note: "The date and time are saved immediately.",
        },
        {
          text: "Drag the bottom edge to change the duration.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Dragging does not check for clashes",
      text: "You can double-book a person without noticing. After moving something, check the team week to see that it still works.",
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Confirm, complete, cancel",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click an appointment — the detail card appears on the right.",
        },
        {
          text: "“Confirm” moves a pending appointment to confirmed.",
        },
        {
          text: "“Done” closes a confirmed appointment.",
        },
        {
          text: "“Cancel” calls it off; for a series the program asks whether just this one or the whole series.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "These three buttons tell nobody",
      text: "Confirm, Done and Cancel only change the status. No email and no text message goes to the customer — tell them yourself.",
    },
    {
      kind: "paragraph",
      text: "Through “To the calendar” on the detail card you pass a single appointment to Apple, Yahoo or as a file. For all appointments on an ongoing basis there is the calendar subscription — see “Subscribe to the calendar” under Setup.",
    },
  ],

  whatHappensNext: [
    "Moved appointments are visible to the whole team straight away.",
    "A cancelled appointment disappears from view while “Cancelled” is unticked in the filter.",
    "If a work order's appointment is cancelled, the work order becomes “Cancelled”.",
  ],

  commonMistakes: [
    "Looking for a finished appointment without widening the status filter.",
    "Assuming “Cancel” informs the customer. It does not.",
    "Not checking for double bookings after dragging something.",
  ],

  ifSomethingGoesWrong: [
    "An appointment is missing: widen the status in the filter, or check the type filter.",
    "“Error while moving”: the appointment snaps back. Reload the page and try again.",
    "An appointment is double-booked: open the team week to check the load and move one of them.",
  ],
} satisfies WikiArticleBody;

export default body;
