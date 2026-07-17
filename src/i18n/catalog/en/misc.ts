import { misc as de } from "@/i18n/catalog/de/misc";

/**
 * British business English. German is the source of truth for the key set —
 * a missing key is a compile error.
 */
export const misc: Record<keyof typeof de, string> = {
  // --- Shared actions / labels -------------------------------------------------
  "misc.action.update": "Update",
  "misc.action.refresh": "Refresh",
  "misc.action.deleting": "Deleting…",
  "misc.contact.call": "Call",
  "misc.options": "{name} options",

  // --- Dashboard ----------------------------------------------------------------
  "dashboard.pageTitle": "Overview · CRM",
  "dashboard.title": "Overview",
  "dashboard.subtitle":
    "All active enquiries, offers and today's appointments at a glance.",
  "dashboard.open": "open",
  "dashboard.action.newLead": "Add enquiry",

  "dashboard.kpi.newLeads": "New enquiries",
  "dashboard.kpi.newLeadsHint": "Received today",
  "dashboard.kpi.openOffers": "Open offers",
  "dashboard.kpi.openOffersHint": "Awaiting a reply",
  "dashboard.kpi.jobsThisMonth": "Jobs this month",
  "dashboard.kpi.jobsThisMonthHint": "Scheduled assignments",
  "dashboard.kpi.besichtigungen": "Site visits",
  "dashboard.kpi.besichtigungenHint": "Before the job is awarded",

  "dashboard.today.title": "Today",
  "dashboard.today.scheduled": "appointments scheduled",
  "dashboard.today.scheduled#one": "appointment scheduled",
  "dashboard.today.scheduled#other": "appointments scheduled",

  "dashboard.besichtigung.title": "Site visit requests",
  "dashboard.besichtigung.subtitle":
    "Customers would like a site visit before awarding the job",
  "dashboard.besichtigung.requestedOn": "Requested for {date}",
  "dashboard.besichtigung.requestedOnAt": "Requested for {date} at {time}",
  "dashboard.besichtigung.openOffer": "Offer",

  "dashboard.recentLeads.title": "Latest enquiries",
  "dashboard.recentLeads.subtitle": "Your most recent leads",
  "dashboard.recentLeads.showAll": "Show all",
  "dashboard.recentLeads.empty": "No enquiries received yet",
  "dashboard.recentLeads.emptyHint": "New leads appear here automatically",
  "dashboard.minutesShort": "min",

  "dashboard.leadStatus.sent": "New",
  "dashboard.leadStatus.accepted": "Accepted",
  "dashboard.leadStatus.rejected": "Declined",

  "dashboard.boxes.subtitle": "Open rentals",
  "dashboard.boxes.manage": "Manage boxes",

  "dashboard.pendingLeads": "new enquiries",
  "dashboard.pendingLeads#one": "new enquiry",
  "dashboard.pendingLeads#other": "new enquiries",
  "dashboard.pendingLeads.hint": "Review and respond now",

  "dashboard.allClear.title": "All clear",
  "dashboard.allClear.description": "Nothing outstanding at the moment.",
  "dashboard.quickAccess": "Quick access",

  // --- Team & resources ----------------------------------------------------------
  "team.pageTitle": "Team | Company",
  "team.title": "Team management",
  "team.subtitle":
    "Manage staff, vehicles and equipment — assign appointments and check availability.",

  "team.members": "staff",
  "team.members#one": "staff member",
  "team.members#other": "staff",
  "team.vehicles": "vehicles",
  "team.vehicles#one": "vehicle",
  "team.vehicles#other": "vehicles",
  "team.equipment": "equipment",
  "team.equipment#one": "item of equipment",
  "team.equipment#other": "equipment",

  "team.action.addResource": "Resource",
  "team.action.addMember": "Staff member",
  "team.action.addFirstMember": "Add your first staff member",
  "team.action.addVehicle": "Add vehicle",
  "team.action.addEquipment": "Add equipment",

  "team.members.empty": "No staff yet",
  "team.members.emptyHint": "Add your team members",
  "team.vehicles.empty": "No vehicles added yet",
  "team.equipment.empty": "No equipment added yet",

  "team.member.new": "New staff member",
  "team.member.edit": "Edit staff member",
  "team.resource.new": "New resource",
  "team.resource.edit": "Edit resource",
  "team.resource.vehicle": "Vehicle",
  "team.resource.equipment": "Equipment",

  "team.field.role": "Role",
  "team.field.rolePlaceholder": "Select a role",
  "team.field.color": "Colour",
  "team.field.colorSelect": "Select the colour {color}",
  "team.field.licensePlate": "Number plate",
  "team.field.capacity": "Capacity (m³)",
  "team.field.quantity": "Quantity",
  "team.placeholder.vehicleName": "e.g. removal van 25 m³",
  "team.placeholder.equipmentName": "e.g. safe dolly",
  "team.equipment.available": "{count}x in stock",

  "team.delete.title": "Confirm deletion",
  "team.delete.member":
    "Are you sure you want to delete this staff member? This action cannot be undone.",
  "team.delete.resource":
    "Are you sure you want to delete this resource? This action cannot be undone.",

  "team.role.fahrer": "Driver",
  "team.role.helfer": "Removal assistant",
  "team.role.reiniger": "Cleaner",
  "team.role.teamleiter": "Team leader",
  "team.role.buero": "Office",

  "team.color.blue": "Blue",
  "team.color.green": "Green",
  "team.color.violet": "Violet",
  "team.color.amber": "Amber",
  "team.color.red": "Red",
  "team.color.pink": "Pink",
  "team.color.cyan": "Cyan",
  "team.color.lime": "Lime",
  "team.color.orange": "Orange",
  "team.color.indigo": "Indigo",

  "team.toast.loadFailed": "Could not load the data",
  "team.toast.nameRequired": "Please enter a first name and a surname",
  "team.toast.invalidEmail": "Please enter a valid e-mail address",
  "team.toast.memberSaved": "Staff member saved",
  "team.toast.memberUpdated": "Staff member updated",
  "team.toast.memberAdded": "Staff member added",
  "team.toast.memberDeleted": "Staff member deleted",
  "team.toast.resourceNameRequired": "Please enter a name",
  "team.toast.resourceUpdated": "Resource updated",
  "team.toast.resourceAdded": "Resource added",
  "team.toast.resourceDeleted": "Resource deleted",
  "team.toast.saveFailed": "Could not save",
  "team.toast.deleteFailed": "Could not delete",

  // --- Removal boxes --------------------------------------------------------------
  "boxes.subtitle": "Manage rental boxes and schedule collections.",
  "boxes.stats.active": "active",
  "boxes.stats.overdue": "overdue",
  "boxes.stats.inCirculation": "in circulation",
  "boxes.action.new": "New rental",

  "boxes.kpi.active": "Active",
  "boxes.kpi.overdue": "Overdue",
  "boxes.kpi.pickupToday": "Collect today",
  "boxes.kpi.thisWeek": "This week",
  "boxes.kpi.inCirculation": "In circulation",

  "boxes.urgent.title": "Urgent collections ({count})",
  "boxes.urgent.description":
    "These boxes are overdue or due for return today",
  "boxes.action.schedulePickup": "Schedule collection",
  "boxes.action.markReturned": "Mark as returned",
  "boxes.action.downloadPdf": "Download PDF",

  "boxes.tab.overview": "Overview",
  "boxes.tab.dueSoon": "Due soon",
  "boxes.tab.history": "History",

  "boxes.searchPlaceholder": "Search by name, town, phone…",
  "boxes.filter.active": "Active rentals",
  "boxes.filter.all": "Show all",

  "boxes.table.customer": "Customer",
  "boxes.table.boxes": "Boxes",
  "boxes.table.city": "Town",
  "boxes.table.deliveryDate": "Delivery date",
  "boxes.table.returnDue": "Return due",
  "boxes.table.assignee": "Assigned to",
  "boxes.table.delivered": "Delivered",
  "boxes.table.returned": "Returned",

  "boxes.count": "boxes",
  "boxes.snapshot.invalid": "Invalid box data",
  "boxes.count#one": "box",
  "boxes.count#other": "boxes",
  "boxes.overdueDays": "{count} days overdue",
  "boxes.overdueDays#one": "{count} day overdue",
  "boxes.overdueDays#other": "{count} days overdue",
  "boxes.dueToday": "Due today",
  "boxes.inDays": "In {count} days",
  "boxes.inDays#one": "In {count} day",
  "boxes.inDays#other": "In {count} days",

  "boxes.dueSoon.title": "Due this week",
  "boxes.dueSoon.description":
    "Boxes that should be returned within the next 7 days",
  "boxes.dueSoon.empty": "No boxes due this week",

  "boxes.history.title": "History",
  "boxes.history.description": "Returned and completed rentals",
  "boxes.history.empty": "No completed rentals",

  "boxes.delete.title": "Delete entry?",
  "boxes.delete.description":
    "This entry will be permanently deleted. This action cannot be undone.",

  "boxes.status.reserved": "Reserved",
  "boxes.status.delivered": "Delivered",
  "boxes.status.in_use": "In use",
  "boxes.status.pickup_requested": "Collection requested",
  "boxes.status.pickup_scheduled": "Collection scheduled",
  "boxes.status.returned": "Returned",
  "boxes.status.lost": "Lost",
  "boxes.status.damaged": "Damaged",

  "boxes.typeShort.standard": "Standard",
  "boxes.typeShort.wardrobe": "Wardrobe",
  "boxes.typeShort.book": "Books",
  "boxes.typeShort.fragile": "Fragile",
  "boxes.typeShort.archive": "Archive",
  "boxes.typeShort.other": "Other",

  "boxes.type.standard": "Standard removal box",
  "boxes.type.wardrobe": "Wardrobe box",
  "boxes.type.book": "Book box",
  "boxes.type.fragile": "Fragile / glassware",
  "boxes.type.archive": "Archive box",
  "boxes.type.other": "Other",

  "boxes.toast.loadFailed": "Could not load the data",
  "boxes.toast.statusUpdated": "Status updated",
  "boxes.toast.updateFailed": "Could not update",
  "boxes.toast.deleted": "Entry deleted",
  "boxes.toast.deleteFailed": "Could not delete",
  "boxes.toast.companyMissing": "Company details unavailable",
  "boxes.toast.companyLoadFailed": "Could not load the company details",
  "boxes.toast.pdfCreating": "Creating PDF…",
  "boxes.toast.pdfDone": "PDF downloaded",
  "boxes.toast.pdfFailed": "Could not create the PDF",

  // --- Box rental dialog ------------------------------------------------------------
  "boxModal.title.new": "New box rental",
  "boxModal.title.edit": "Edit box rental",
  "boxModal.overdue": "Overdue!",
  "boxModal.linkLead": "Link to an enquiry (optional)",
  "boxModal.linkLead.placeholder": "Select an enquiry…",
  "boxModal.linkLead.none": "No link",
  "boxModal.customerData": "Customer details",

  "boxModal.delivery.title": "📦 Delivery address (drop the boxes off)",
  "boxModal.delivery.hint":
    "Where the boxes are delivered first (old home)",
  "boxModal.delivery.streetPlaceholder": "Example Street 1",
  "boxModal.pickup.title": "🚚 Collection address (pick the boxes up)",
  "boxModal.pickup.hint": "Where the boxes are collected later (new home)",
  "boxModal.pickup.streetPlaceholder": "New Street 2",

  "boxModal.boxDetails": "Box details",
  "boxModal.total": "Total: {count} boxes",
  "boxModal.boxType": "Box type",
  "boxModal.addBoxType": "Add another box type",
  "boxModal.description": "Description (optional)",
  "boxModal.description.placeholder": "Additional information about the boxes…",
  "boxModal.isRental": "Rental boxes (must be returned)",

  "boxModal.rentalDetails": "Rental details",
  "boxModal.pricePerDay": "Rental price per day (CHF)",
  "boxModal.deposit": "Deposit (CHF)",
  "boxModal.depositPaid": "Deposit paid",

  "boxModal.dates": "Dates",
  "boxModal.deliveryDate": "Delivery date *",
  "boxModal.expectedReturnDate": "Expected return date",
  "boxModal.pickupDate": "Scheduled collection date",
  "boxModal.pickupTime": "Scheduled collection time",
  "boxModal.reminderDays": "Reminder X days before return",
  "boxModal.days": "{count} days",
  "boxModal.days#one": "{count} day",
  "boxModal.days#other": "{count} days",

  "boxModal.teamAssignment": "Team assignment",
  "boxModal.assignee": "Responsible for collection",
  "boxModal.deliveredBy": "Delivered by",
  "boxModal.selectMember": "Choose a team member…",
  "boxModal.unassigned": "Unassigned",

  "boxModal.internalNotes": "Internal notes",
  "boxModal.internalNotes.placeholder": "For internal use only…",
  "boxModal.customerNotes": "Customer notes for the collection",
  "boxModal.customerNotes.placeholder":
    "e.g. boxes are in the cellar, access via the rear entrance",

  "boxModal.error.nameRequired": "Please enter the customer's name",
  "boxModal.error.invalidEmail": "Please enter a valid e-mail address",
  "boxModal.error.returnBeforeDelivery":
    "The return date must be after the delivery date",
  "boxModal.error.noBoxes": "Please enter at least one box with a quantity above 0",
  "boxModal.toast.updated": "Box rental updated",
  "boxModal.toast.created": "Box rental created",
  "boxModal.toast.saveFailed": "Could not save",

  // --- Data archive & data protection -------------------------------------------------
  "archive.title": "Data archive & data protection",
  "archive.subtitle":
    "Manage company data in line with the GDPR/FADP — export, deletion and audit log.",
  "archive.noCompany.title": "No company linked",
  "archive.noCompany.description":
    "To use the data archive, your account must be linked to a company.",

  "archive.gdpr.title": "Data protection (GDPR/FADP)",
  "archive.gdpr.description":
    "You have the right to export your data (data portability) and to delete it (right to be forgotten). Every action is logged.",

  "archive.stats.leads": "Leads",
  "archive.stats.offers": "Offers",
  "archive.stats.appointments": "Appointments",
  "archive.stats.team": "Team",
  "archive.stats.olderThan": "{count} older than {days} days",
  "archive.stats.activeMembers": "Active team members",

  "archive.export.title": "Export data",
  "archive.export.description":
    "Export all of your company data as JSON or CSV",
  "archive.export.jsonHint": "Complete, structured",
  "archive.export.csvHint": "Excel-compatible",
  "archive.export.dialogDescription": "Choose the data to export and the format",
  "archive.export.formatLabel": "Export format",
  "archive.export.selectData": "Select data",
  "archive.export.running": "Exporting…",
  "archive.export.submit": "Export",
  "archive.export.success": "Data exported successfully",
  "archive.export.failed": "Could not export the data",

  "archive.delete.title": "Delete old data",
  "archive.delete.description":
    "Delete completed data older than {days} days",
  "archive.delete.retention": "Retention period",
  "archive.delete.retentionDays": "{count} days",
  "archive.delete.retentionYear": "1 year",
  "archive.delete.deletable": "Deletable records:",
  "archive.delete.confirmTitle": "Delete data irreversibly?",
  "archive.delete.confirmDescription": "This action cannot be undone!",
  "archive.delete.warning": "Warning",
  "archive.delete.warningIntro": "The following data will be permanently deleted:",
  "archive.delete.leadsDetail": "{count} leads (completed/declined)",
  "archive.delete.offersDetail": "{count} offers (sent/accepted/declined)",
  "archive.delete.appointmentsDetail": "{count} appointments (completed/cancelled)",
  "archive.delete.confirmCheckbox":
    "I understand that this data will be deleted irreversibly and I have exported it if required.",
  "archive.delete.running": "Deleting…",
  "archive.delete.submit": "Delete permanently",
  "archive.delete.success": "The old data has been deleted",
  "archive.delete.failed": "Could not delete the data",
  "archive.stats.loadFailed": "Could not load the statistics",

  "archive.info.title": "Data protection notes",
  "archive.info.export.title": "📤 Data export (art. 20 GDPR)",
  "archive.info.export.text":
    "You can export all of your data in a machine-readable format (JSON/CSV) at any time. This allows it to be transferred to other services.",
  "archive.info.deletion.title": "🗑️ Right to erasure (art. 17 GDPR)",
  "archive.info.deletion.text":
    "You can delete completed data that is no longer needed. Active business data is subject to statutory retention periods.",
  "archive.info.retention.title": "📋 Retention periods",
  "archive.info.retention.text":
    "Business documents must be retained for 10 years under the Swiss Code of Obligations. We recommend exporting data before deleting it.",
  "archive.info.security.title": "🔒 Data security",
  "archive.info.security.text":
    "All data is stored in Switzerland/the EU and encrypted. Deletions are irreversible and are logged.",

  "archive.type.leads": "Leads (enquiries)",
  "archive.type.offers": "Offers",
  "archive.type.email_logs": "E-mail logs",
  "archive.type.notifications": "Notifications",
  "archive.type.analytics": "Analytics data",
  "archive.type.appointments": "Appointments",
  "archive.type.full_backup": "Full backup",
  "archive.type.custom": "Custom",

  "archive.storage.local": "Local download",
  "archive.storage.google_drive": "Google Drive",
  "archive.storage.dropbox": "Dropbox",
  "archive.storage.s3": "Amazon S3",
  "archive.storage.supabase_storage": "Supabase Storage",

  "archive.status.pending": "Pending",
  "archive.status.in_progress": "In progress",
  "archive.status.completed": "Completed",
  "archive.status.failed": "Failed",
  "archive.status.restored": "Restored",

  "archive.format.json": "JSON (complete)",
  "archive.format.csv": "CSV (Excel)",
  "archive.format.parquet": "Parquet (big data)",

  // --- Sign-in / password ---------------------------------------------------------------
  "auth.brand": "CRM dashboard",
  "auth.login.title": "Sign in",
  "auth.login.pageTitle": "Sign in | CRM",
  "auth.login.submitting": "Signing in…",
  "auth.forgot.title": "Forgotten password",
  "auth.forgot.pageTitle": "Forgotten password | CRM",
  "auth.forgot.description":
    "Enter your e-mail address. We will send you a reset link.",
  "auth.forgot.link": "Forgotten your password?",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.submitting": "Sending…",
  "auth.field.password": "Password",
  "auth.field.emailPlaceholder": "your@email.ch",
  "auth.password.show": "Show password",
  "auth.password.hide": "Hide password",
  "auth.backToLogin": "Back to sign-in",

  "auth.resetSent.title": "E-mail sent!",
  "auth.resetSent.description":
    "We have sent you a reset link. Please check your inbox.",
  "auth.toast.resetSent.title": "E-mail sent",
  "auth.toast.resetSent.description": "Check your inbox for the reset link.",
  "auth.toast.loginFailed": "Sign-in failed",
  "auth.toast.invalidCredentials": "The e-mail address or password is incorrect.",
  "auth.toast.welcome": "Welcome!",
  "auth.toast.welcomeDescription": "You have been signed in successfully.",

  "auth.noCompany.pageTitle": "No access | CRM",
  "auth.noCompany.title": "No company linked",
  "auth.noCompany.description":
    "Your account {email} is not linked to a company.",
  "auth.noCompany.whatToDo": "What can you do?",
  "auth.noCompany.step1": "Contact the administrator",
  "auth.noCompany.step2": "Check that you are using the right e-mail address",
  "auth.noCompany.signOut": "Sign out & use another account",

  "auth.pending.pageTitle": "Verification pending | CRM",
  "auth.pending.title": "Verification pending",
  "auth.pending.description": "Your account {email} has not been activated yet.",
  "auth.pending.whatNow": "What happens now?",
  "auth.pending.step1": "Your company profile is being reviewed",
  "auth.pending.step2": "Once activated, you will have access to the dashboard",
  "auth.pending.signOut": "Sign out",

  "auth.reset.pageTitle": "Set a new password | CRM",
  "auth.reset.title": "Set a new password",
  "auth.reset.description": "Enter your new password.",
  "auth.reset.newPassword": "New password",
  "auth.reset.newPasswordPlaceholder": "At least 8 characters",
  "auth.reset.confirmPassword": "Confirm password",
  "auth.reset.confirmPasswordPlaceholder": "Repeat the password",
  "auth.reset.submit": "Save password",
  "auth.reset.submitting": "Saving…",
  "auth.reset.success.title": "Password changed!",
  "auth.reset.success.description": "You will be redirected shortly…",
  "auth.reset.success.toEnter": "Go to dashboard",
  "auth.reset.toast.changed": "Password changed",
  "auth.reset.toast.changedDescription":
    "Your password has been updated successfully.",
  "auth.reset.toast.linkExpired": "Link expired",
  "auth.reset.toast.linkExpiredDescription":
    "Please request a new password reset link.",

  // --- 404 -----------------------------------------------------------------------------
  "notFound.title": "404",
  "notFound.message": "This page does not exist.",
  "notFound.home": "Back to the home page",

  // --- Reminders -------------------------------------------------------------------------
  "reminders.title": "Reminder settings",
  "reminders.description":
    "Configure automatic e-mail reminders for your team members and customers",
  "reminders.team.title": "Team reminders",
  "reminders.team.description":
    "E-mails to the assigned team members before appointments",
  "reminders.customer.title": "Customer reminders",
  "reminders.customer.description": "E-mails to customers before their appointments",
  "reminders.sendAt": "Send the reminder:",
  "reminders.hoursBefore": "{count} hours in advance",
  "reminders.hoursBefore#one": "{count} hour in advance",
  "reminders.hoursBefore#other": "{count} hours in advance",

  "reminders.content.title": "E-mail content",
  "reminders.content.description":
    "Which information should the reminders contain?",
  "reminders.content.customerPhone": "Customer phone number",
  "reminders.content.customerEmail": "Customer e-mail",
  "reminders.content.leadDetails": "Lead details",
  "reminders.content.offerDetails": "Offer details",
  "reminders.footer.title": "Custom footer",
  "reminders.footer.placeholder":
    "Optional custom message for the e-mail footer…",

  "reminders.pending.title": "Upcoming reminders",
  "reminders.pending.description": "These reminders will be sent automatically",
  "reminders.pending.members": "{count} team members",
  "reminders.pending.members#one": "{count} team member",
  "reminders.pending.members#other": "{count} team members",
  "reminders.pending.dispatch": "Dispatch: {date} {time}",

  "reminders.info.title": "How do the reminders work?",
  "reminders.info.item1":
    "Reminders are sent automatically before every appointment",
  "reminders.info.item2":
    "Only appointments with assigned team members trigger reminders",
  "reminders.info.item3":
    "The e-mail contains all the key details: address, customer name, phone number",
  "reminders.info.item4":
    "For site visits, the lead details including the property size are sent",
  "reminders.info.item5":
    "For service assignments, the offer details are sent as well",

  "reminders.toast.saved": "Settings saved",
  "reminders.toast.savedDescription":
    "Your reminder settings have been updated successfully.",
  "reminders.toast.saveFailed": "The settings could not be saved.",

  // --- Logo / signature upload -------------------------------------------------------------
  "upload.logo.label": "Company logo",
  "upload.logo.empty": "No logo",
  "upload.logo.change": "Change logo",
  "upload.logo.upload": "Upload logo",
  "upload.logo.hint": "JPG, PNG or WebP. Max. 2 MB.",
  "upload.logo.notOptimizedDescription":
    "The logo could not be compressed and will be uploaded at its original size.",
  "upload.logo.uploaded": "Logo uploaded",
  "upload.logo.uploadedDescription": "Your company logo has been updated.",
  "upload.logo.removed": "Logo removed",
  "upload.logo.removedDescription": "Your company logo has been removed.",
  "upload.logo.uploadFailed": "Logo upload failed",
  "upload.logo.removeFailed": "The logo could not be removed.",

  "upload.signature.label": "Signature for the job confirmation",
  "upload.signature.hint":
    "This signature appears on the job confirmation page of the PDF",
  "upload.signature.empty": "No signature",
  "upload.signature.formatHint":
    "PNG with a transparent background recommended. Max. 1 MB.",
  "upload.signature.notOptimizedDescription":
    "The signature could not be compressed and will be uploaded at its original size.",
  "upload.signature.uploaded": "Signature uploaded",
  "upload.signature.uploadedDescription": "Your signature has been saved.",
  "upload.signature.removed": "Signature removed",
  "upload.signature.removedDescription": "Your signature has been removed.",
  "upload.signature.uploadFailed": "Signature upload failed",
  "upload.signature.removeFailed": "The signature could not be removed.",

  "upload.error.invalidType": "Invalid file type",
  "upload.error.invalidTypeLogo":
    "Please choose a JPG, PNG or WebP file. SVG is not supported.",
  "upload.error.invalidTypeSignature": "Please choose a JPG, PNG or WebP file.",
  "upload.error.tooLarge": "File too large",
  "upload.error.tooLargeDescription":
    "The file is {size} MB. The maximum allowed is {max} MB.",
  "upload.error.sessionExpired": "Session expired",
  "upload.error.sessionExpiredDescription":
    "Please reload the page or sign in again.",
  "upload.notOptimized": "Image not optimised",
  "upload.change": "Change",

  // --- Voice input ----------------------------------------------------------------------------
  "voice.unsupported":
    "Your browser does not support audio recording. Please use a current version of Chrome, Firefox or Edge.",
  "voice.start": "Voice input",
  "voice.recording": "Recording — {duration}",
  "voice.stop": "Stop",
  "voice.transcribing": "Transcribing the recording…",
  "voice.done":
    "Transcription complete — please review and edit it if necessary:",
  "voice.edit": "Edit transcription",
  "voice.extract": "Extract with AI",
  "voice.discard": "Discard",

  // --- Postcode selection by canton -------------------------------------------------------------
  "plz.open": "Select postcodes by canton",
  "plz.description":
    "Select the postcode areas you operate in. Click a canton to see all of its postcodes.",
  "plz.searchPlaceholder": "Search for a postcode, town or canton…",
  "plz.selected": "{count} postcodes selected",
  "plz.pendingAdd": "+{count} new",
  "plz.pendingRemove": "-{count} removed",
  "plz.selectAll": "Select all",
  "plz.deselectAll": "Deselect all",
  "plz.save": "Save changes",
  "plz.saved": "Saved",
  "plz.savedDescription": "{added} postcodes added, {removed} postcodes removed.",
  "plz.loadFailed": "The postcode data could not be loaded.",
  "plz.saveFailed": "The changes could not be saved.",

  "canton.AG": "Aargau",
  "canton.AI": "Appenzell Innerrhoden",
  "canton.AR": "Appenzell Ausserrhoden",
  "canton.BE": "Bern",
  "canton.BL": "Basel-Landschaft",
  "canton.BS": "Basel-Stadt",
  "canton.FR": "Fribourg",
  "canton.GE": "Geneva",
  "canton.GL": "Glarus",
  "canton.GR": "Graubünden",
  "canton.JU": "Jura",
  "canton.LU": "Lucerne",
  "canton.NE": "Neuchâtel",
  "canton.NW": "Nidwalden",
  "canton.OW": "Obwalden",
  "canton.SG": "St. Gallen",
  "canton.SH": "Schaffhausen",
  "canton.SO": "Solothurn",
  "canton.SZ": "Schwyz",
  "canton.TG": "Thurgau",
  "canton.TI": "Ticino",
  "canton.UR": "Uri",
  "canton.VD": "Vaud",
  "canton.VS": "Valais",
  "canton.ZG": "Zug",
  "canton.ZH": "Zurich",
};
