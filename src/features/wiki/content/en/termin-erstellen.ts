import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "termin-erstellen",
  locale: "en",
  title: "Creating an appointment",
  summary: "Type, time, team and vehicles — and when the customer gets a confirmation.",

  purpose:
    "This is where you create an appointment: a viewing, a job, a follow-up, or blocked time.",

  whenToUse: [
    "You arrange a viewing over the phone.",
    "A job needs a vehicle and equipment.",
    "You want to block holiday or a break.",
    "You want a reminder to follow up on a quote.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/en/termin-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The appointment window with the type selector and the time fields.",
      alt: "Window for a new appointment with five type buttons, the title field, the status selector and the date, start and end fields.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 30, label: "The type decides which fields appear." },
        { n: 2, xPct: 50, yPct: 47, label: "Title — the only required field." },
        { n: 3, xPct: 50, yPct: 62, label: "Date, start and end." },
      ],
    },
    {
      kind: "heading",
      id: "oeffnen",
      text: "Three ways to the window",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "“New appointment” at the top right — with today's date.",
        "Right-click a day in the calendar — with that date.",
        "From an enquiry or quote, through “Schedule appointment” — with details prepared.",
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Filling in the window",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Choose the “Appointment type” at the top.",
          note: "With “Blocked” the customer fields disappear — you do not need them there.",
        },
        {
          text: "Enter a “Title”.",
          note: "That is the only required field. Everything else is optional.",
        },
        {
          text: "Set “Date”, “Start” and “End”.",
          note: "At least 15 minutes, at most 12 hours. With “All day” the times drop away.",
        },
        {
          text: "Under “Customer”, take the details from an enquiry or type them in.",
        },
        {
          text: "Assign people under “Assign team”.",
          note: "“Vehicles” and “Equipment” only appear for the type “Service”.",
        },
        {
          text: "Click “Create”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Clashes are shown, not blocked",
      text: "If a person or vehicle is already booked at that time, a red note “Resource clash!” appears with the appointments involved. You can still save — the decision stays with you.",
    },
    {
      kind: "heading",
      id: "benachrichtigung",
      text: "When the customer hears about it",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "Anything sent?", next: "What you should do" },
      rows: [
        { status: "New appointment, type Viewing or Service", meaning: "Yes, a confirmation by email.", next: "Nothing further." },
        { status: "New appointment, type Meeting or Blocked", meaning: "No.", next: "Internal appointments do not need it." },
        { status: "Appointment edited or moved", meaning: "No.", next: "Tell the customer yourself." },
        { status: "Appointment cancelled", meaning: "No.", next: "Tell the customer yourself." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Moving something is silent",
      text: "If you change the date or time, the customer hears nothing. Call or write — the program will not do it for you.",
    },
    {
      kind: "heading",
      id: "wiederkehrend",
      text: "Recurring appointments",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "When creating it, tick “Recurring”.",
          note: "Then choose daily, weekly, every two weeks or monthly, and an end date.",
        },
        {
          text: "On saving, the whole series is created at once.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The recurrence cannot be changed afterwards",
      text: "You can only set it when creating. If it is wrong, cancel the series and create a new one.",
    },
    {
      kind: "paragraph",
      text: "Reminders to the customer go out automatically, separately from this. What is reminded and when is set under “Settings” — the appointment window has no field for it.",
    },
  ],

  whatHappensNext: [
    "The appointment appears in the calendar at once, in the colour of the person assigned.",
    "For Viewing and Service the customer gets a confirmation by email.",
    "Reminders go out later on their own, according to your settings.",
  ],

  commonMistakes: [
    "Moving an appointment and assuming the customer will be told.",
    "Ignoring the clash warning and double-booking the same person.",
    "Looking for vehicles on a viewing. They exist only for the type “Service”.",
  ],

  ifSomethingGoesWrong: [
    "“Please enter a title”: the title field is empty.",
    "“End time must be after start time”: start and end are the wrong way round.",
    "“Appointment created, but no customer email”: the appointment exists, only the confirmation did not go out — add the address and tell the customer yourself.",
  ],
} satisfies WikiArticleBody;

export default body;
