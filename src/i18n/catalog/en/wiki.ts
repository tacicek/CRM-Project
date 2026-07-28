import { wiki as de } from "@/i18n/catalog/de/wiki";

export const wiki: Record<keyof typeof de, string> = {
  "wiki.title": "Help & guide",
  "wiki.subtitle": "Your working day, one step at a time.",

  // --- Search ----------------------------------------------------------------------
  "wiki.search.label": "Search the help",
  "wiki.search.placeholder": "What are you looking for? For example: send an offer",
  "wiki.search.clear": "Clear the search",
  "wiki.search.noResults": "We do not have a guide for that yet.",
  "wiki.search.noResultsHint": "Try another word, for example “invoice” instead of “bill”.",
  "wiki.search.results": "{count} guides found",
  "wiki.search.results#one": "{count} guide found",
  "wiki.search.results#other": "{count} guides found",

  // --- Home ------------------------------------------------------------------------
  "wiki.home.startHere": "Start here",
  "wiki.home.startHereHint": "New to the system? These guides walk you through the first steps.",
  "wiki.home.tasks": "What do you want to do?",
  "wiki.home.categories": "All areas",
  "wiki.home.daily": "For every day",
  "wiki.home.articleCount": "{count} guides",
  "wiki.home.articleCount#one": "{count} guide",
  "wiki.home.articleCount#other": "{count} guides",

  // --- Categories ------------------------------------------------------------------
  "wiki.category.start": "Start here",
  "wiki.category.anfragen-kunden": "Requests, customers and sales",
  "wiki.category.offerten": "Offers and customer approval",
  "wiki.category.planung": "Planning and service delivery",
  "wiki.category.finanzen": "Invoices, receipts and payments",
  "wiki.category.service-kommunikation": "Customer service and communication",
  "wiki.category.berichte": "Reports and daily control",
  "wiki.category.einrichtung": "Setup and administration",
  "wiki.category.kundensicht": "What the customer sees",
  "wiki.category.glossar": "Terms and statuses",

  // --- Article sections ------------------------------------------------------------
  "wiki.section.purpose": "What is this for?",
  "wiki.section.whenToUse": "When do you need it?",
  "wiki.section.beforeYouBegin": "Before you begin",
  "wiki.section.whatHappensNext": "What happens next?",
  "wiki.section.commonMistakes": "Common mistakes",
  "wiki.section.ifSomethingGoesWrong": "If something goes wrong",
  "wiki.section.related": "Related guides",
  "wiki.section.contents": "On this page",

  // --- Navigation ------------------------------------------------------------------
  "wiki.nav.breadcrumbHome": "Help & guide",
  "wiki.nav.breadcrumb": "You are here",
  "wiki.nav.previous": "Previous guide",
  "wiki.nav.next": "Next guide",
  "wiki.nav.backToHome": "Back to the overview",
  "wiki.nav.openScreen": "Open this page in the CRM",
  "wiki.nav.print": "Print this guide",

  // --- Images ----------------------------------------------------------------------
  "wiki.figure.zoom": "Enlarge the image",
  "wiki.figure.zoomHint": "Click to enlarge",
  "wiki.figure.close": "Close the image",
  "wiki.figure.legend": "About this image",

  // --- Callouts --------------------------------------------------------------------
  "wiki.callout.tip": "Tip",
  "wiki.callout.warning": "Careful",
  "wiki.callout.danger": "Cannot be undone",
  "wiki.callout.permission": "Permission needed",

  // --- Status table ----------------------------------------------------------------
  "wiki.status.title": "What the statuses mean",
  "wiki.status.header.status": "Status",
  "wiki.status.header.meaning": "Meaning",
  "wiki.status.header.next": "Your next step",

  // --- States ----------------------------------------------------------------------
  "wiki.state.loading": "Loading the guide …",
  "wiki.state.errorTitle": "The guide could not be loaded",
  "wiki.state.errorHint": "Please reload the page.",
  "wiki.state.retry": "Try again",
  "wiki.state.notFoundTitle": "This guide does not exist",
  "wiki.state.notFoundHint": "The address may have changed. Search in the overview.",

  // --- Footer ----------------------------------------------------------------------
  "wiki.meta.lastVerified": "Last checked on {date}",
  "wiki.kind.reference": "Explains one screen",
  "wiki.kind.journey": "A process across several steps",
};
