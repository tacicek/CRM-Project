import { settings as de } from "@/i18n/catalog/de/settings";

export const settings: Record<keyof typeof de, string> = {
  "settings.title": "Settings",
  "settings.tab.profile": "Profile",
  "settings.tab.notifications": "Notifications",
  "settings.tab.email": "Email",
  "settings.tab.sms": "SMS",
  "settings.tab.reminders": "Reminders",
  "settings.tab.agb": "Terms",
  "settings.tab.ki": "AI integration",

  "settings.language.title": "Language",
  "settings.language.description":
    "Sets the language your dashboard appears in, and the language assumed for enquiries whose language could not be determined.",
  "settings.language.default": "Company default language",
  "settings.language.defaultHint":
    "Your dashboard appears in this language. New enquiries without a stated language are treated as this language too.",
  "settings.language.customerNotice":
    "Documents and emails sent to customers always follow the customer's language — not this setting.",
  "settings.language.saved": "Language saved.",

  "settings.profile.title": "Company profile",
  "settings.profile.companyName": "Company name",
  "settings.profile.legalName": "Legal name",
  "settings.profile.slogan": "Slogan",
  "settings.profile.primaryColor": "Primary colour",
  "settings.profile.logo": "Logo",
  "settings.profile.signature": "Signature",
  "settings.profile.vatNumber": "VAT number",
  "settings.profile.uidNumber": "UID number",
  "settings.profile.iban": "IBAN",
  "settings.profile.bankName": "Bank",
  "settings.profile.website": "Website",
  "settings.profile.saved": "Profile saved.",

  "settings.pdf.title": "PDF template",
  "settings.pdf.classic": "Classic",
  "settings.pdf.modern": "Modern",

  "settings.notifications.email": "Notification email",
  "settings.notifications.phone": "Notification phone",
  "settings.email.apiKey": "Resend API key",
  "settings.email.fromName": "Sender name",
  "settings.email.fromEmail": "Sender email",
  "settings.email.test": "Send test email",
  "settings.sms.accountSid": "Twilio account SID",
  "settings.sms.authToken": "Twilio auth token",
  "settings.sms.phoneNumber": "Twilio phone number",

  "settings.pageTitle": "Settings | Company",
  "settings.subtitle":
    "Configure your company profile, notifications, e-mail dispatch and terms and conditions.",
  "settings.companyNotFound": "Company not found",
  "settings.unsavedChanges": "Unsaved changes",
  "settings.saveFailed": "The changes could not be saved.",

  "settings.profile.description": "Edit your company information",
  "settings.profile.companyData": "Company details",
  "settings.profile.primaryColorHint": "This colour is used in your quote PDFs",

  "settings.pdf.offerTitle": "Quote PDF template",
  "settings.pdf.hint":
    "Layout used to generate your quote PDFs (download, dispatch and customer view)",
  "settings.pdf.classicDesc": "Proven standard layout with a services table",
  "settings.pdf.modernDesc":
    "New design with an «At a glance» summary and service cards",

  "settings.notifications.description": "Configure your notification preferences",
  "settings.notifications.emailPlaceholder": "If different from the main e-mail address",
  "settings.notifications.emailHint": "Leave empty to use the main e-mail address",
  "settings.notifications.phoneLabel": "Notification phone (SMS)",

  "settings.email.title": "Own e-mail address (Resend)",
  "settings.email.description":
    "Send quotes from your own e-mail address instead of via the system",
  "settings.email.setupTitle": "How to set up your own e-mail address:",
  "settings.email.step1": "Create an account at",
  "settings.email.step2": "Verify your domain under",
  "settings.email.step3": "Create an API key under",
  "settings.email.step4": "Enter the details here",
  "settings.email.useOwn": "Use your own e-mail address",
  "settings.email.useOwnHint": "Quotes are sent from your own sender address",
  "settings.email.fromEmailHint": "Must be a verified domain",
  "settings.email.configComplete":
    "E-mail configuration complete — quotes are sent from your address",
  "settings.email.disabledNote":
    "When disabled, quotes are sent from the configured system e-mail address.",
  "settings.email.testTitle": "Test the e-mail configuration",
  "settings.email.testHint": "Send a test e-mail to {email}",
  "settings.email.testButton": "Send test",
  "settings.email.testMissingConfig":
    "Please save the API key and sender e-mail address first.",
  "settings.email.testSuccess": "Test successful",
  "settings.email.testSuccessDescription": "A test e-mail has been sent to {email}.",
  "settings.email.testFailed": "Test failed",
  "settings.email.testFailedDescription": "The test e-mail could not be sent.",
  "settings.email.sessionExpired": "Session expired",
  "settings.email.sessionExpiredDescription": "Please sign in again and retry.",
  "settings.email.saved": "E-mail settings have been saved.",
  "settings.email.saveFailed": "The e-mail settings could not be saved.",

  "settings.sms.title": "SMS reminders (Twilio)",
  "settings.sms.description": "Configure Twilio to send SMS reminders to your customers",
  "settings.sms.setupTitle": "How to obtain your Twilio credentials:",
  "settings.sms.step1": "Create an account at",
  "settings.sms.step2": "Open the console and copy your account SID and auth token",
  "settings.sms.step3": "Buy a phone number for sending SMS",
  "settings.sms.step4": "Enter the details here",
  "settings.sms.enable": "Enable Twilio",
  "settings.sms.enableHint": "Enable SMS functionality for your company",
  "settings.sms.accountSidLabel": "Account SID",
  "settings.sms.authTokenLabel": "Auth token",
  "settings.sms.authTokenPlaceholder": "Your auth token",
  "settings.sms.phoneNumberHint":
    "The phone number that SMS are sent from (in E.164 format)",
  "settings.sms.remindersEnable": "Enable SMS reminders",
  "settings.sms.remindersHint":
    "Customers receive SMS reminders in addition to the e-mail",
  "settings.sms.configComplete": "Twilio configuration complete",
  "settings.sms.saved": "Twilio settings have been saved.",
  "settings.sms.saveFailed": "The Twilio settings could not be saved.",

  "settings.agb.title": "Terms and conditions",
  "settings.agb.description":
    "Create structured terms and conditions sections, with a title and body, for each service type. They are automatically attached as a PDF to every quote and are legally accepted when the quote is accepted.",

  "settings.ki.description":
    "Choose your AI provider and store its API key. Your own keys take precedence over the server key.",
  "settings.ki.provider": "AI provider",
  "settings.ki.active": "Active",
  "settings.ki.apiKeyFor": "{provider} API key",
  "settings.ki.keySet": "Key stored.",
  "settings.ki.keyMissing": "No key stored.",
  "settings.ki.keyMissingFallback": "No key — the server key is used instead.",
  "settings.ki.model": "Model",
  "settings.ki.modelHint": "Leave empty = default ({model}).",
  "settings.ki.allModels": "All models",
  "settings.ki.save": "Save AI settings",
  "settings.ki.saved": "AI settings have been saved.",
  "settings.ki.saveFailed": "The AI settings could not be saved.",
};
