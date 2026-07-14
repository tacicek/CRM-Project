/** Sidebar, header and layout shell. German is the source of truth for the key set. */
export const nav = {
  "nav.group.hauptbereich": "Hauptbereich",
  "nav.group.betrieb": "Betrieb",
  "nav.group.verwaltung": "Verwaltung",

  "nav.overview": "Übersicht",
  "nav.anfragen": "Anfragen",
  "nav.kalender": "Kalender",
  "nav.offerten": "Offerten",
  "nav.auftraege": "Aufträge",
  "nav.quittungen": "Quittungen",
  "nav.rechnungen": "Rechnungen",
  "nav.besichtigungen": "Besichtigungen",
  "nav.umzugsboxen": "Umzugsboxen",
  "nav.team": "Team",
  "nav.checkliste": "Checkliste",
  "nav.leistungskatalog": "Meine Leistungen",
  "nav.preisgestaltung": "Meine Preise",
  "nav.archiv": "Archiv",
  "nav.einstellungen": "Einstellungen",

  "nav.notifications": "Benachrichtigungen",
  "nav.notifications.empty": "Keine neuen Benachrichtigungen",
  "nav.notifications.markAllRead": "Alle als gelesen markieren",
  "nav.logout": "Abmelden",
  "nav.account": "Konto",
  "nav.menu": "Menü",

  // --- Shell ---------------------------------------------------------------------
  "nav.workspace": "Workspace",
  "nav.searchPlaceholder": "Suche oder Befehl …",
  "nav.openMenu": "Menü öffnen",
  "nav.closeMenu": "Menü schliessen",
  "nav.user": "Benutzer",
  "nav.switchCompany": "Firma wechseln",

  "nav.role.owner": "Inhaber",
  "nav.role.admin": "Admin",
  "nav.role.member": "Mitarbeiter",

  "nav.state.on": "An",
  "nav.state.off": "Aus",
  "nav.sound.on": "Ton aktiv",
  "nav.sound.off": "Ton deaktiviert",
  "nav.push.on": "Push aktiv",
  "nav.push.off": "Push deaktiviert",
  "nav.push.blocked": "Benachr. blockiert",

  "nav.noCompany.title": "Keine Firma gefunden",
  "nav.noCompany.description":
    "Ihr Account ist nicht mit einer Firma verknüpft. Bitte kontaktieren Sie den Support.",
  "nav.notVerified.title": "Firma noch nicht verifiziert",
  "nav.notVerified.description":
    "Ihr Firmenkonto ist registriert, aber noch nicht freigeschaltet. Bitte kontaktieren Sie den Support.",

  // --- Notification dropdown -------------------------------------------------------
  "nav.notifications.show": "Benachrichtigungen anzeigen",
  "nav.notifications.emptyHint": "Sie sind auf dem neuesten Stand!",
  "nav.notifications.markAllReadShort": "Alle gelesen",
  "nav.notifications.clearAll": "Alle löschen",
  // Plurale: Französisch behandelt 0 als Singular, Deutsch und Englisch nicht.
  "nav.notifications.new": "{count} neue Benachrichtigungen",
  "nav.notifications.new#one": "{count} neue Benachrichtigung",
  "nav.notifications.new#other": "{count} neue Benachrichtigungen",
  "nav.notifications.unread": "{count} ungelesen",
  "nav.notifications.unread#one": "{count} ungelesen",
  "nav.notifications.unread#other": "{count} ungelesen",
  "nav.notifications.count": "{count} Benachrichtigungen",
  "nav.notifications.count#one": "{count} Benachrichtigung",
  "nav.notifications.count#other": "{count} Benachrichtigungen",

  "nav.notifications.reschedule.proposed": "{date} • {time} Uhr",
  "nav.notifications.reschedule.accept": "Annehmen",
  "nav.notifications.reschedule.reject": "Ablehnen",
  "nav.notifications.reschedule.confirmed": "Terminverschiebung bestätigt",
  "nav.notifications.reschedule.confirmedDescription": "Neuer Termin: {date} um {time} Uhr",
  "nav.notifications.reschedule.rejected": "Terminverschiebung abgelehnt",
  "nav.notifications.reschedule.rejectedDescription":
    "Der Kunde wurde per E-Mail informiert.",

  "nav.notifications.error.noMetadata": "Keine Daten zu dieser Benachrichtigung gefunden",
  "nav.notifications.error.incompleteData": "Unvollständige Daten für diese Aktion",
  "nav.notifications.error.appointmentNotFound": "Termin nicht gefunden",
  "nav.notifications.error.processing": "Fehler bei der Verarbeitung",
  "nav.notifications.error.retry": "Bitte versuchen Sie es erneut",

  // --- Realtime-Meldungen (Termine) --------------------------------------------------
  "nav.notifications.newAppointment": "Neuer Termin: {type}",
  "nav.notifications.appointmentOn": "{title} am {date}",
  "nav.notifications.appointmentStatusChanged": "Termin: {status}",
} as const;
