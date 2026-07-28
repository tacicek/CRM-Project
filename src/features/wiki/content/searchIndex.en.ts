import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";

/**
 * The searchable stub of every English article. See searchIndex.de.ts for why the index
 * is kept separate from the bodies.
 *
 * Keywords are written for an English-speaking operator and are NOT a translation of the
 * German list. They deliberately include the words people bring from other systems
 * ("dashboard", "log in", "permissions") alongside the labels this app actually uses.
 */
const index: WikiSearchIndex = {
  "start-hier": {
    title: "Start here",
    summary: "What this program does for you, and the order you work in.",
    keywords: ["start", "begin", "introduction", "first steps", "overview", "new", "onboarding", "basics"],
  },
  "anmelden-abmelden": {
    title: "Signing in and out",
    summary: "How to sign in, reset a forgotten password and sign out safely.",
    keywords: ["sign in", "sign out", "log in", "log out", "password", "forgot password", "access", "reset"],
  },
  "dashboard-uebersicht": {
    title: "The overview",
    summary: "Your home page: new enquiries, open quotes and today's appointments.",
    keywords: ["overview", "home", "dashboard", "tiles", "figures", "today", "latest enquiries", "start page"],
  },
  "navigation-und-benachrichtigungen": {
    title: "Menu, top bar and notifications",
    summary: "How to move around the program and where to see what is new.",
    keywords: ["menu", "sidebar", "navigation", "top bar", "bell", "notification", "alert", "sound", "push", "phone", "mobile"],
  },
  "sprache-dashboard-vs-dokument": {
    title: "Two languages: yours and the customer's",
    summary: "Why you work in English while the customer still reads French.",
    keywords: ["language", "german", "french", "english", "translation", "document language", "switch", "bilingual"],
  },
  "typischer-arbeitstag": {
    title: "A typical working day",
    summary: "A short list of what you check in the morning, during the day and in the evening.",
    keywords: ["working day", "routine", "checklist", "morning", "evening", "daily", "order", "workflow"],
  },
  "rollen-und-rechte": {
    title: "Roles and permissions",
    summary: "Who may do what: owner, admin and member.",
    keywords: ["role", "permission", "rights", "owner", "admin", "member", "blocked", "not allowed", "merge"],
  },
  "kunden-liste": {
    title: "The customer list",
    summary: "Every customer in one place — search, filter and open.",
    keywords: ["customers", "customer list", "contacts", "search", "duplicate", "company", "open amount"],
  },
  "kundenkarte": {
    title: "The customer card",
    summary: "Everything about one customer: contact, records, amounts, history and portal access.",
    keywords: ["customer card", "open a customer", "history", "note", "merge", "portal", "invoiced", "paid"],
  },
  "finanzen-uebersicht": {
    title: "Finances: what is open and what came in",
    summary: "Open items and payments in one place — including reversals.",
    keywords: ["finances", "open items", "payment", "collected", "overdue", "reversal", "reverse", "ledger"],
  },
  "zahlung-erfassen": {
    title: "Recording a payment",
    summary: "In full, in part or too much — and how to correct a mistake.",
    keywords: ["record payment", "payment", "partial payment", "overpayment", "twint", "cash", "bank transfer", "reversal"],
  },
  "rechnungen-liste": {
    title: "The invoice list",
    summary: "All invoices with status, filters, PDF and the deletion rules.",
    keywords: ["invoices", "invoice list", "status", "draft", "sent", "overdue", "pdf", "delete"],
  },
  "rechnung-erstellen": {
    title: "Writing and sending an invoice",
    summary: "From the empty form through the QR payment part to sending by email.",
    keywords: ["create invoice", "new invoice", "qr invoice", "line items", "vat", "due date", "send", "iban"],
  },
  "offerten-liste": {
    title: "The quote list",
    summary: "Every quote with its status, the filters and the per-row actions.",
    keywords: ["quotes", "offers", "quote list", "status", "pending", "accepted", "send again", "blind"],
  },
  "offerte-erstellen": {
    title: "Writing a quote",
    summary: "From enquiry to finished quote: line items, price model, terms, sending.",
    keywords: ["create quote", "write an offer", "line items", "price model", "fixed price", "hourly rate", "ceiling", "terms", "send"],
  },
  "offerte-detail": {
    title: "The quote in detail",
    summary: "Line items, history, customer link and the actions available per status.",
    keywords: ["quote detail", "customer link", "activities", "viewed", "preview", "create work order", "pdf"],
  },
  "offerte-bearbeiten": {
    title: "Editing a quote",
    summary: "Changing drafts — and why sent quotes lock themselves.",
    keywords: ["edit quote", "draft", "locked", "sent", "cannot edit"],
  },
  "offerte-version": {
    title: "A new version of a quote",
    summary: "When something changes after sending — and how to tell the revisions apart.",
    keywords: ["new version", "version", "revision", "superseded", "change after sending"],
  },
  "nachtrag": {
    title: "An amendment to a quote",
    summary: "Extra work after the agreement — with the customer's separate approval.",
    keywords: ["amendment", "extra work", "supplement", "approval", "accepted", "customer link"],
  },
  "anfragen-liste": {
    title: "The enquiry list",
    summary: "Every enquiry that came in, grouped by service — and the route to a quote.",
    keywords: ["enquiries", "leads", "enquiry list", "tabs", "quoted", "sales stage", "search", "delete"],
  },
  "anfrage-details": {
    title: "Viewing and correcting an enquiry",
    summary: "Read every detail — and put right whatever was recognised wrongly.",
    keywords: ["enquiry details", "edit enquiry", "correct", "customer language", "postcode", "change address"],
  },
  "anfrage-importieren": {
    title: "Recording an enquiry yourself",
    summary: "Paste text or dictate — the analysis fills the fields, you check them.",
    keywords: ["record enquiry", "new enquiry", "import", "voice input", "dictate", "ai", "extract", "postcode"],
  },
  "email-eingang": {
    title: "Working through the email inbox",
    summary: "Check, correct and accept automatically analysed customer emails.",
    keywords: ["email inbox", "to review", "accept", "reject", "run analysis again", "confidence"],
  },
  "auftraege-liste": {
    title: "The work-order list",
    summary: "Every job with date, team and status — and what you can do with each one.",
    keywords: ["work orders", "jobs", "job list", "overdue", "close", "archive", "team"],
  },
  "auftrag-abschliessen": {
    title: "Planning and closing a work order",
    summary: "Assign the team, set the pricing, close it — and bill afterwards.",
    keywords: ["close job", "assign team", "record hours", "by effort", "fixed price", "final price"],
  },
  "kalender": {
    title: "The calendar",
    summary: "Every appointment in view — views, filters, moving things and the team week.",
    keywords: ["calendar", "appointments", "week", "month", "filter", "move", "team week", "ics"],
  },
  "termin-erstellen": {
    title: "Creating an appointment",
    summary: "Type, time, team and vehicles — and when the customer gets a confirmation.",
    keywords: ["create appointment", "new appointment", "viewing", "blocked", "recurring", "vehicle", "clash"],
  },
};

export default index;
