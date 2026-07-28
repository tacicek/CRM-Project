import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-importieren",
  locale: "en",
  title: "Recording an enquiry yourself",
  summary: "Paste text or dictate — the analysis fills the fields, you check them.",

  purpose:
    "When an enquiry arrives by phone or through a channel that is not connected, you record it here. You supply the text and the program recognises the service and the details.",

  whenToUse: [
    "A customer calls and describes their removal.",
    "An enquiry came in through a channel that is not connected.",
    "You want to record an older email after the fact.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "There is no blank form",
      text: "“New enquiry” always leads here. You do not type the fields one by one — you supply text or speech, then check the result.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/anfrage-importieren-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Step 1 with the text box and the voice-input button.",
      alt: "Import page headed Import enquiry, with a voice-input button at the top, a large text box with worked examples below it, and the analyse button.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 27, label: "Voice input — dictate instead of typing." },
        { n: 2, xPct: 50, yPct: 55, label: "Paste the customer's text here." },
      ],
    },
    {
      kind: "heading",
      id: "schritt1",
      text: "Step 1: supply the text",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Paste the customer's whole message into the large box.",
          note: "At least 20 characters, at most 10,000. The counter at the bottom right shows where you are.",
        },
        {
          text: "Or click “Voice input” and speak the enquiry.",
          note: "You then see the recognised text and can correct it before going on.",
        },
        {
          text: "Click “Extract with AI”.",
          note: "After you accept a dictation, the analysis starts by itself.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Better too much text than too little",
      text: "Copy the whole message, sign-off and signature included. The phone number and address are often there, and the analysis only finds what is written.",
    },
    {
      kind: "heading",
      id: "schritt2",
      text: "Step 2: check the result",
    },
    {
      kind: "paragraph",
      text: "At the top you see the recognised service and a confidence percentage. Below 80 per cent a note asks you to check the details especially carefully.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Check the service and change it in the dropdown if needed.",
          note: "The choices are private removal, business removal, cleaning, clearance, disposal, storage, piano transport and furniture lift.",
        },
        {
          text: "Fill in any missing contact details.",
          note: "Every field can be changed — the analysis is a suggestion, not an instruction.",
        },
        {
          text: "Check “The customer wrote in”.",
          note: "This language decides the quote, the PDF and the emails to the customer.",
        },
        {
          text: "Click “Save enquiry”.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Without a postcode you cannot go on",
      text: "The postcode is the only required field. Which one is asked for depends on the service: for storage the collection postcode, for removals and piano transport the from postcode, otherwise the address postcode.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Messages when saving",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Cause", next: "What to do" },
      rows: [
        { status: "Text too short", meaning: "Fewer than 20 characters.", next: "Add more text." },
        { status: "Postcode required", meaning: "The postcode this service needs is missing.", next: "Enter a four-digit postcode." },
        { status: "Invalid phone number", meaning: "Not a valid Swiss number.", next: "Use the format +41 79 123 45 67." },
        { status: "Customer details missing", meaning: "Low confidence and no name recognised.", next: "Enter a first name or surname." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Going back discards everything",
      text: "If you leave step 2, the program asks once — after that every correction is gone. There is no saved intermediate state.",
    },
  ],

  whatHappensNext: [
    "After saving you land in the enquiry list.",
    "The new enquiry sits there in the matching service tab.",
    "No quote is created along the way — you start that with “Create quote”.",
  ],

  commonMistakes: [
    "Pasting only half a sentence. The less text, the less is recognised.",
    "Saving the result without checking it. The analysis guesses, especially on short messages.",
    "Expecting a quote to appear straight away. That is a second, separate step.",
  ],

  ifSomethingGoesWrong: [
    "Voice input is missing: your browser does not support recording. Use a current Chrome, Firefox or Edge.",
    "The analysis recognises almost nothing: the text is too short or holds few details. Add to it and run it again.",
    "“Error while saving”: check your connection and try again — the text stays in the box.",
  ],
} satisfies WikiArticleBody;

export default body;
