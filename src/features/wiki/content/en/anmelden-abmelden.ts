import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anmelden-abmelden",
  locale: "en",
  title: "Signing in and out",
  summary: "How to sign in, reset a forgotten password and sign out safely.",

  purpose:
    "You sign in with your email address and your password. After that you only see your own company's data.",

  whenToUse: [
    "You are starting your working day.",
    "You have forgotten your password.",
    "You are working on someone else's computer and want to sign out afterwards.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "anmelden",
      text: "Signing in",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/en/anmeldung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "The sign-in page. It is in German for everyone, even when the rest of your program is in English.",
      alt: "Sign-in page with a field for the email address labelled E-Mail, a field for the password labelled Passwort, the link Passwort vergessen and the button Anmelden.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Type your email address into the field “E-Mail”." },
        {
          text: "Type your password into the field “Passwort”.",
          note: "The eye icon at the end of the field makes the password visible so you can check it.",
        },
        {
          text: "Click “Anmelden”.",
          note: "You land on the overview. Your company name appears in the top left.",
        },
      ],
    },
    {
      kind: "heading",
      id: "passwort-vergessen",
      text: "Forgotten password",
    },
    {
      kind: "steps",
      steps: [
        { text: "On the sign-in page, click “Passwort vergessen”." },
        { text: "Type your email address and click “Reset-Link senden”." },
        {
          text: "Open the email and follow the link.",
          note: "The link takes you to a page where you choose a new password.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "No email arrived?",
      text: "Check your spam folder. Also check that you typed the address correctly.",
    },
    {
      kind: "heading",
      id: "abmelden",
      text: "Signing out",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Click your name in the top right.",
          note: "A small menu opens showing your email address and your role.",
        },
        { text: "Click “Sign out”." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Always sign out on a shared device",
      text: "Without signing out, the session stays open in the browser. The next person at that device would see your company's data.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Messages when signing in",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "What it means", next: "Your next step" },
      rows: [
        {
          status: "E-Mail oder Passwort ist falsch.",
          meaning: "The address and password do not match.",
          next: "Type the password again with the text visible.",
        },
        {
          status: "No company found",
          meaning: "Your account is not linked to a company yet.",
          next: "Contact the person who set up your access.",
        },
        {
          status: "Company not yet verified",
          meaning: "The company exists but has not been activated.",
          next: "Wait for activation. You cannot work yet.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "After signing in you are on the overview.",
    "The program remembers the sign-in in this browser until you sign out.",
    "Your role is shown in the top-right menu, under your email address.",
  ],

  commonMistakes: [
    "A space at the start or end of the email address. The field accepts it and the sign-in fails.",
    "Requesting several reset links and then using the oldest. Only the newest email works.",
    "On a shared computer, closing only the tab instead of signing out.",
  ],

  ifSomethingGoesWrong: [
    "Signing in fails repeatedly: set a new password through “Passwort vergessen”.",
    "After signing in you see “No company found”: your account is not linked yet. You cannot fix this yourself.",
    "The page stays blank: reload it. If that does not help, check your internet connection.",
  ],
} satisfies WikiArticleBody;

export default body;
