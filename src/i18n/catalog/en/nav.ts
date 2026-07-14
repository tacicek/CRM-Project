import { nav as de } from "@/i18n/catalog/de/nav";

export const nav: Record<keyof typeof de, string> = {
  "nav.group.hauptbereich": "Main area",
  "nav.group.betrieb": "Operations",
  "nav.group.verwaltung": "Administration",

  "nav.overview": "Overview",
  "nav.anfragen": "Enquiries",
  "nav.kalender": "Calendar",
  "nav.offerten": "Quotes",
  "nav.auftraege": "Work orders",
  "nav.quittungen": "Receipts",
  "nav.rechnungen": "Invoices",
  "nav.besichtigungen": "Viewings",
  "nav.umzugsboxen": "Moving boxes",
  "nav.team": "Team",
  "nav.checkliste": "Checklist",
  "nav.leistungskatalog": "My services",
  "nav.preisgestaltung": "My pricing",
  "nav.archiv": "Archive",
  "nav.einstellungen": "Settings",

  "nav.notifications": "Notifications",
  "nav.notifications.empty": "No new notifications",
  "nav.notifications.markAllRead": "Mark all as read",
  "nav.logout": "Sign out",
  "nav.account": "Account",
  "nav.menu": "Menu",

  "nav.workspace": "Workspace",
  "nav.searchPlaceholder": "Search or run a command …",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.user": "User",
  "nav.switchCompany": "Switch company",

  "nav.role.owner": "Owner",
  "nav.role.admin": "Admin",
  "nav.role.member": "Team member",

  "nav.state.on": "On",
  "nav.state.off": "Off",
  "nav.sound.on": "Sound on",
  "nav.sound.off": "Sound off",
  "nav.push.on": "Push on",
  "nav.push.off": "Push off",
  "nav.push.blocked": "Push blocked",

  "nav.noCompany.title": "No company found",
  "nav.noCompany.description":
    "Your account is not linked to a company. Please contact support.",
  "nav.notVerified.title": "Company not yet verified",
  "nav.notVerified.description":
    "Your company account is registered but not yet activated. Please contact support.",

  "nav.notifications.show": "Show notifications",
  "nav.notifications.emptyHint": "You are all caught up.",
  "nav.notifications.markAllReadShort": "Mark all read",
  "nav.notifications.clearAll": "Clear all",
  "nav.notifications.new": "{count} new notifications",
  "nav.notifications.new#one": "{count} new notification",
  "nav.notifications.new#other": "{count} new notifications",
  "nav.notifications.unread": "{count} unread",
  "nav.notifications.unread#one": "{count} unread",
  "nav.notifications.unread#other": "{count} unread",
  "nav.notifications.count": "{count} notifications",
  "nav.notifications.count#one": "{count} notification",
  "nav.notifications.count#other": "{count} notifications",

  "nav.notifications.reschedule.proposed": "{date} • {time}",
  "nav.notifications.reschedule.accept": "Accept",
  "nav.notifications.reschedule.reject": "Decline",
  "nav.notifications.reschedule.confirmed": "Rescheduling confirmed",
  "nav.notifications.reschedule.confirmedDescription":
    "New appointment: {date} at {time}",
  "nav.notifications.reschedule.rejected": "Rescheduling declined",
  "nav.notifications.reschedule.rejectedDescription":
    "The customer has been informed by e-mail.",

  "nav.notifications.error.noMetadata": "No data found for this notification",
  "nav.notifications.error.incompleteData": "Incomplete data for this action",
  "nav.notifications.error.appointmentNotFound": "Appointment not found",
  "nav.notifications.error.processing": "Processing failed",
  "nav.notifications.error.retry": "Please try again",

  "nav.notifications.newAppointment": "New appointment: {type}",
  "nav.notifications.appointmentOn": "{title} on {date}",
  "nav.notifications.appointmentStatusChanged": "Appointment: {status}",
};
