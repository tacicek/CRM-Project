/**
 * Dashboard namespace: misc.
 *
 * Everything the operator sees outside the offer/lead/auftrag/calendar/catalog flows:
 * the overview page, team & resources, box rentals, the data archive, the login screens,
 * the 404 page and the shared upload / voice / PLZ widgets.
 *
 * German is the source of truth for the key set.
 *
 * Note on the login screens (`auth.*`): Auth.tsx and ResetPassword.tsx render OUTSIDE the
 * I18nProvider — no company is known before login, so there is no dashboard locale to read.
 * `useT()` degrades to the German catalog there. The keys exist so the screens render
 * through the same pipeline, not because the screens can switch language.
 */
export const misc = {
  // ===========================================================================
  // Shared actions / labels (this namespace only — see `common.*` first)
  // ===========================================================================
  "misc.action.update": "Aktualisieren",
  "misc.action.refresh": "Aktualisieren",
  "misc.action.deleting": "Wird gelöscht…",
  "misc.contact.call": "Anrufen",
  "misc.options": "{name} Optionen",

  // ===========================================================================
  // Dashboard (Übersicht)
  // ===========================================================================
  "dashboard.pageTitle": "Übersicht · CRM",
  "dashboard.title": "Übersicht",
  "dashboard.subtitle":
    "Alle aktiven Anfragen, Offerten und heutigen Termine auf einen Blick.",
  "dashboard.open": "offen",
  "dashboard.action.newLead": "Anfrage erfassen",

  "dashboard.kpi.newLeads": "Neue Anfragen",
  "dashboard.kpi.newLeadsHint": "Heute eingegangen",
  "dashboard.kpi.openOffers": "Offene Offerten",
  "dashboard.kpi.openOffersHint": "Warten auf Antwort",
  "dashboard.kpi.jobsThisMonth": "Aufträge diesen Monat",
  "dashboard.kpi.jobsThisMonthHint": "Geplante Einsätze",
  "dashboard.kpi.besichtigungen": "Besichtigungen",
  "dashboard.kpi.besichtigungenHint": "Vor Auftragserteilung",

  "dashboard.today.title": "Heute",
  "dashboard.today.scheduled": "Termine eingeplant",
  "dashboard.today.scheduled#one": "Termin eingeplant",
  "dashboard.today.scheduled#other": "Termine eingeplant",

  "dashboard.besichtigung.title": "Besichtigungsanfragen",
  "dashboard.besichtigung.subtitle":
    "Kunden wünschen vor der Auftragserteilung eine Besichtigung",
  "dashboard.besichtigung.requestedOn": "Gewünscht am {date}",
  "dashboard.besichtigung.requestedOnAt": "Gewünscht am {date} um {time} Uhr",
  "dashboard.besichtigung.openOffer": "Offerte",

  "dashboard.recentLeads.title": "Letzte Anfragen",
  "dashboard.recentLeads.subtitle": "Ihre neuesten Leads",
  "dashboard.recentLeads.showAll": "Alle anzeigen",
  "dashboard.recentLeads.empty": "Noch keine Anfragen erhalten",
  "dashboard.recentLeads.emptyHint": "Neue Leads erscheinen hier automatisch",
  "dashboard.minutesShort": "Min.",

  "dashboard.leadStatus.sent": "Neu",
  "dashboard.leadStatus.accepted": "Akzeptiert",
  "dashboard.leadStatus.rejected": "Abgelehnt",

  "dashboard.boxes.subtitle": "Offene Vermietungen",
  "dashboard.boxes.manage": "Boxen verwalten",

  "dashboard.pendingLeads": "neue Anfragen",
  "dashboard.pendingLeads#one": "neue Anfrage",
  "dashboard.pendingLeads#other": "neue Anfragen",
  "dashboard.pendingLeads.hint": "Jetzt prüfen und reagieren",

  "dashboard.allClear.title": "Alles im grünen Bereich",
  "dashboard.allClear.description": "Keine offenen Vorgänge im Moment.",
  "dashboard.quickAccess": "Schnellzugriff",

  // ===========================================================================
  // Team & Ressourcen
  // ===========================================================================
  "team.pageTitle": "Team | Firma",
  "team.title": "Team-Verwaltung",
  "team.subtitle":
    "Mitarbeiter, Fahrzeuge und Ausrüstung verwalten — Termine zuweisen und Verfügbarkeit prüfen.",

  "team.members": "Mitarbeiter",
  "team.members#one": "Mitarbeiter",
  "team.members#other": "Mitarbeiter",
  "team.vehicles": "Fahrzeuge",
  "team.vehicles#one": "Fahrzeug",
  "team.vehicles#other": "Fahrzeuge",
  "team.equipment": "Ausrüstung",
  "team.equipment#one": "Ausrüstung",
  "team.equipment#other": "Ausrüstung",

  "team.action.addResource": "Ressource",
  "team.action.addMember": "Mitarbeiter",
  "team.action.addFirstMember": "Ersten Mitarbeiter hinzufügen",
  "team.action.addVehicle": "Fahrzeug hinzufügen",
  "team.action.addEquipment": "Ausrüstung hinzufügen",

  "team.members.empty": "Noch keine Mitarbeiter",
  "team.members.emptyHint": "Fügen Sie Ihre Teammitglieder hinzu",
  "team.vehicles.empty": "Noch keine Fahrzeuge hinzugefügt",
  "team.equipment.empty": "Noch keine Ausrüstung hinzugefügt",

  "team.member.new": "Neuer Mitarbeiter",
  "team.member.edit": "Mitarbeiter bearbeiten",
  "team.resource.new": "Neue Ressource",
  "team.resource.edit": "Ressource bearbeiten",
  "team.resource.vehicle": "Fahrzeug",
  "team.resource.equipment": "Ausrüstung",

  "team.field.role": "Rolle",
  "team.field.rolePlaceholder": "Rolle auswählen",
  "team.field.color": "Farbe",
  "team.field.colorSelect": "Farbe {color} auswählen",
  "team.field.licensePlate": "Kennzeichen",
  "team.field.capacity": "Kapazität (m³)",
  "team.field.quantity": "Anzahl",
  "team.placeholder.vehicleName": "z. B. Möbelwagen 25 m³",
  "team.placeholder.equipmentName": "z. B. Tresor-Dolly",
  "team.equipment.available": "{count}x vorhanden",

  "team.delete.title": "Löschen bestätigen",
  "team.delete.member":
    "Sind Sie sicher, dass Sie diesen Mitarbeiter löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
  "team.delete.resource":
    "Sind Sie sicher, dass Sie diese Ressource löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",

  "team.role.fahrer": "Fahrer",
  "team.role.helfer": "Helfer",
  "team.role.reiniger": "Reiniger",
  "team.role.teamleiter": "Teamleiter",
  "team.role.buero": "Büro",

  "team.color.blue": "Blau",
  "team.color.green": "Grün",
  "team.color.violet": "Violett",
  "team.color.amber": "Bernstein",
  "team.color.red": "Rot",
  "team.color.pink": "Pink",
  "team.color.cyan": "Cyan",
  "team.color.lime": "Limette",
  "team.color.orange": "Orange",
  "team.color.indigo": "Indigo",

  "team.toast.loadFailed": "Fehler beim Laden der Daten",
  "team.toast.nameRequired": "Bitte Vor- und Nachnamen eingeben",
  "team.toast.invalidEmail": "Bitte eine gültige E-Mail-Adresse eingeben",
  "team.toast.memberSaved": "Mitarbeiter gespeichert",
  "team.toast.memberUpdated": "Mitarbeiter aktualisiert",
  "team.toast.memberAdded": "Mitarbeiter hinzugefügt",
  "team.toast.memberDeleted": "Mitarbeiter gelöscht",
  "team.toast.resourceNameRequired": "Bitte Namen eingeben",
  "team.toast.resourceUpdated": "Ressource aktualisiert",
  "team.toast.resourceAdded": "Ressource hinzugefügt",
  "team.toast.resourceDeleted": "Ressource gelöscht",
  "team.toast.saveFailed": "Fehler beim Speichern",
  "team.toast.deleteFailed": "Fehler beim Löschen",

  // ===========================================================================
  // Umzugsboxen (Vermietung)
  // ===========================================================================
  "boxes.subtitle": "Mietboxen verwalten und Abholungen planen.",
  "boxes.stats.active": "aktiv",
  "boxes.stats.overdue": "überfällig",
  "boxes.stats.inCirculation": "im Umlauf",
  "boxes.action.new": "Neue Vermietung",

  "boxes.kpi.active": "Aktiv",
  "boxes.kpi.overdue": "Überfällig",
  "boxes.kpi.pickupToday": "Heute abholen",
  "boxes.kpi.thisWeek": "Diese Woche",
  "boxes.kpi.inCirculation": "Im Umlauf",

  "boxes.urgent.title": "Dringende Abholungen ({count})",
  "boxes.urgent.description":
    "Diese Boxen sind überfällig oder heute zur Rückgabe fällig",
  "boxes.action.schedulePickup": "Abholung planen",
  "boxes.action.markReturned": "Als zurückgegeben markieren",
  "boxes.action.downloadPdf": "PDF herunterladen",

  "boxes.tab.overview": "Übersicht",
  "boxes.tab.dueSoon": "Bald fällig",
  "boxes.tab.history": "Verlauf",

  "boxes.searchPlaceholder": "Suchen nach Name, Ort, Telefon…",
  "boxes.filter.active": "Aktive Vermietungen",
  "boxes.filter.all": "Alle anzeigen",

  "boxes.table.customer": "Kunde",
  "boxes.table.boxes": "Boxen",
  "boxes.table.city": "Ort",
  "boxes.table.deliveryDate": "Lieferdatum",
  "boxes.table.returnDue": "Rückgabe fällig",
  "boxes.table.assignee": "Zuständig",
  "boxes.table.delivered": "Geliefert",
  "boxes.table.returned": "Zurückgegeben",

  "boxes.count": "Boxen",
  "boxes.snapshot.invalid": "Ungültige Boxdaten",
  "boxes.count#one": "Box",
  "boxes.count#other": "Boxen",
  "boxes.overdueDays": "{count} Tage überfällig",
  "boxes.overdueDays#one": "{count} Tag überfällig",
  "boxes.overdueDays#other": "{count} Tage überfällig",
  "boxes.dueToday": "Heute fällig",
  "boxes.inDays": "In {count} Tagen",
  "boxes.inDays#one": "In {count} Tag",
  "boxes.inDays#other": "In {count} Tagen",

  "boxes.dueSoon.title": "Diese Woche fällig",
  "boxes.dueSoon.description":
    "Boxen, die in den nächsten 7 Tagen zurückgegeben werden sollten",
  "boxes.dueSoon.empty": "Keine Boxen diese Woche fällig",

  "boxes.history.title": "Verlauf",
  "boxes.history.description": "Zurückgegebene und abgeschlossene Vermietungen",
  "boxes.history.empty": "Keine abgeschlossenen Vermietungen",

  "boxes.delete.title": "Eintrag löschen?",
  "boxes.delete.description":
    "Dieser Eintrag wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",

  "boxes.status.reserved": "Reserviert",
  "boxes.status.delivered": "Geliefert",
  "boxes.status.in_use": "In Gebrauch",
  "boxes.status.pickup_requested": "Abholung angefragt",
  "boxes.status.pickup_scheduled": "Abholung geplant",
  "boxes.status.returned": "Zurückgegeben",
  "boxes.status.lost": "Verloren",
  "boxes.status.damaged": "Beschädigt",

  "boxes.typeShort.standard": "Standard",
  "boxes.typeShort.wardrobe": "Kleider",
  "boxes.typeShort.book": "Bücher",
  "boxes.typeShort.fragile": "Fragile",
  "boxes.typeShort.archive": "Archiv",
  "boxes.typeShort.other": "Andere",

  "boxes.type.standard": "Standard Umzugskarton",
  "boxes.type.wardrobe": "Kleiderbox",
  "boxes.type.book": "Bücherbox",
  "boxes.type.fragile": "Fragile / Glas",
  "boxes.type.archive": "Archivbox",
  "boxes.type.other": "Andere",

  "boxes.toast.loadFailed": "Fehler beim Laden der Daten",
  "boxes.toast.statusUpdated": "Status aktualisiert",
  "boxes.toast.updateFailed": "Fehler beim Aktualisieren",
  "boxes.toast.deleted": "Eintrag gelöscht",
  "boxes.toast.deleteFailed": "Fehler beim Löschen",
  "boxes.toast.companyMissing": "Firmendaten nicht verfügbar",
  "boxes.toast.companyLoadFailed": "Firmendaten konnten nicht geladen werden",
  "boxes.toast.pdfCreating": "PDF wird erstellt…",
  "boxes.toast.pdfDone": "PDF wurde heruntergeladen",
  "boxes.toast.pdfFailed": "Fehler beim Erstellen des PDFs",

  // --- Umzugsbox-Modal --------------------------------------------------------
  "boxModal.title.new": "Neue Umzugsbox-Vermietung",
  "boxModal.title.edit": "Umzugsbox bearbeiten",
  "boxModal.overdue": "Überfällig!",
  "boxModal.linkLead": "Mit Anfrage verknüpfen (optional)",
  "boxModal.linkLead.placeholder": "Anfrage auswählen…",
  "boxModal.linkLead.none": "Keine Verknüpfung",
  "boxModal.customerData": "Kundendaten",

  "boxModal.delivery.title": "📦 Lieferadresse (Boxen hinbringen)",
  "boxModal.delivery.hint":
    "Wohin die Boxen zuerst geliefert werden (alte Wohnung)",
  "boxModal.delivery.streetPlaceholder": "Musterstrasse 1",
  "boxModal.pickup.title": "🚚 Abholadresse (Boxen abholen)",
  "boxModal.pickup.hint":
    "Woher die Boxen später abgeholt werden (neue Wohnung)",
  "boxModal.pickup.streetPlaceholder": "Neuestrasse 2",

  "boxModal.boxDetails": "Box-Details",
  "boxModal.total": "Gesamt: {count} Boxen",
  "boxModal.boxType": "Box-Typ",
  "boxModal.addBoxType": "Weiteren Box-Typ hinzufügen",
  "boxModal.description": "Beschreibung (optional)",
  "boxModal.description.placeholder": "Zusätzliche Informationen zu den Boxen…",
  "boxModal.isRental": "Mietboxen (müssen zurückgegeben werden)",

  "boxModal.rentalDetails": "Miet-Details",
  "boxModal.pricePerDay": "Mietpreis pro Tag (CHF)",
  "boxModal.deposit": "Kaution (CHF)",
  "boxModal.depositPaid": "Kaution bezahlt",

  "boxModal.dates": "Termine",
  "boxModal.deliveryDate": "Lieferdatum *",
  "boxModal.expectedReturnDate": "Erwartetes Rückgabedatum",
  "boxModal.pickupDate": "Geplantes Abholdatum",
  "boxModal.pickupTime": "Geplante Abholzeit",
  "boxModal.reminderDays": "Erinnerung X Tage vor Rückgabe",
  "boxModal.days": "{count} Tage",
  "boxModal.days#one": "{count} Tag",
  "boxModal.days#other": "{count} Tage",

  "boxModal.teamAssignment": "Team-Zuordnung",
  "boxModal.assignee": "Zuständig für Abholung",
  "boxModal.deliveredBy": "Geliefert von",
  "boxModal.selectMember": "Team-Mitglied wählen…",
  "boxModal.unassigned": "Nicht zugewiesen",

  "boxModal.internalNotes": "Interne Notizen",
  "boxModal.internalNotes.placeholder": "Nur für interne Verwendung…",
  "boxModal.customerNotes": "Kundenhinweise zur Abholung",
  "boxModal.customerNotes.placeholder":
    "z. B. Boxen stehen im Keller, Zugang via Hintereingang",

  "boxModal.error.nameRequired": "Bitte geben Sie den Kundennamen ein",
  "boxModal.error.invalidEmail": "Bitte geben Sie eine gültige E-Mail-Adresse ein",
  "boxModal.error.returnBeforeDelivery":
    "Das Rückgabedatum muss nach dem Lieferdatum liegen",
  "boxModal.error.noBoxes": "Bitte geben Sie mindestens eine Box mit Menge > 0 ein",
  "boxModal.toast.updated": "Umzugsbox-Eintrag aktualisiert",
  "boxModal.toast.created": "Umzugsbox-Eintrag erstellt",
  "boxModal.toast.saveFailed": "Fehler beim Speichern",

  // ===========================================================================
  // Datenarchiv & Datenschutz
  // ===========================================================================
  "archive.title": "Datenarchiv & Datenschutz",
  "archive.subtitle":
    "Firmendaten gemäss DSGVO/DSG verwalten — Export, Löschung und Audit-Log.",
  "archive.noCompany.title": "Keine Firma verknüpft",
  "archive.noCompany.description":
    "Um das Datenarchiv zu nutzen, muss Ihr Konto mit einer Firma verknüpft sein.",

  "archive.gdpr.title": "Datenschutz-Grundverordnung (DSGVO/DSG)",
  "archive.gdpr.description":
    "Sie haben das Recht, Ihre Daten zu exportieren (Datenportabilität) und zu löschen (Recht auf Vergessenwerden). Alle Aktionen werden protokolliert.",

  "archive.stats.leads": "Leads",
  "archive.stats.offers": "Offerten",
  "archive.stats.appointments": "Termine",
  "archive.stats.team": "Team",
  "archive.stats.olderThan": "{count} älter als {days} Tage",
  "archive.stats.activeMembers": "Aktive Teammitglieder",

  "archive.export.title": "Daten exportieren",
  "archive.export.description":
    "Exportieren Sie alle Ihre Firmendaten als JSON oder CSV",
  "archive.export.jsonHint": "Vollständig, strukturiert",
  "archive.export.csvHint": "Excel-kompatibel",
  "archive.export.dialogDescription":
    "Wählen Sie die zu exportierenden Daten und das Format",
  "archive.export.formatLabel": "Export-Format",
  "archive.export.selectData": "Daten auswählen",
  "archive.export.running": "Wird exportiert…",
  "archive.export.submit": "Exportieren",
  "archive.export.success": "Daten erfolgreich exportiert",
  "archive.export.failed": "Fehler beim Exportieren",

  "archive.delete.title": "Alte Daten löschen",
  "archive.delete.description":
    "Löschen Sie abgeschlossene Daten älter als {days} Tage",
  "archive.delete.retention": "Aufbewahrungsfrist",
  "archive.delete.retentionDays": "{count} Tage",
  "archive.delete.retentionYear": "1 Jahr",
  "archive.delete.deletable": "Löschbare Datensätze:",
  "archive.delete.confirmTitle": "Daten unwiderruflich löschen?",
  "archive.delete.confirmDescription":
    "Diese Aktion kann nicht rückgängig gemacht werden!",
  "archive.delete.warning": "Warnung",
  "archive.delete.warningIntro": "Folgende Daten werden permanent gelöscht:",
  "archive.delete.leadsDetail": "{count} Leads (abgeschlossen/abgelehnt)",
  "archive.delete.offersDetail": "{count} Offerten (gesendet/akzeptiert/abgelehnt)",
  "archive.delete.appointmentsDetail": "{count} Termine (abgeschlossen/abgesagt)",
  "archive.delete.confirmCheckbox":
    "Ich verstehe, dass diese Daten unwiderruflich gelöscht werden und habe bei Bedarf einen Export erstellt.",
  "archive.delete.running": "Wird gelöscht…",
  "archive.delete.submit": "Endgültig löschen",
  "archive.delete.success": "Alte Daten wurden erfolgreich gelöscht",
  "archive.delete.failed": "Fehler beim Löschen der Daten",
  "archive.stats.loadFailed": "Fehler beim Laden der Statistiken",

  "archive.info.title": "Datenschutz-Hinweise",
  "archive.info.export.title": "📤 Datenexport (Art. 20 DSGVO)",
  "archive.info.export.text":
    "Sie können jederzeit alle Ihre Daten in einem maschinenlesbaren Format (JSON/CSV) exportieren. Dies ermöglicht die Übertragung zu anderen Diensten.",
  "archive.info.deletion.title": "🗑️ Recht auf Löschung (Art. 17 DSGVO)",
  "archive.info.deletion.text":
    "Sie können abgeschlossene und nicht mehr benötigte Daten löschen. Aktive Geschäftsdaten unterliegen gesetzlichen Aufbewahrungsfristen.",
  "archive.info.retention.title": "📋 Aufbewahrungsfristen",
  "archive.info.retention.text":
    "Geschäftsdokumente müssen gemäss OR 10 Jahre aufbewahrt werden. Wir empfehlen, Daten vor der Löschung zu exportieren.",
  "archive.info.security.title": "🔒 Datensicherheit",
  "archive.info.security.text":
    "Alle Daten werden in der Schweiz/EU gespeichert und verschlüsselt. Löschungen sind unwiderruflich und werden protokolliert.",

  // --- Archivtypen / Speicher / Status / Format (types/archive.ts) -------------
  "archive.type.leads": "Leads (Anfragen)",
  "archive.type.offers": "Offerten",
  "archive.type.email_logs": "E-Mail-Logs",
  "archive.type.notifications": "Benachrichtigungen",
  "archive.type.analytics": "Analytics-Daten",
  "archive.type.appointments": "Termine",
  "archive.type.full_backup": "Vollständiges Backup",
  "archive.type.custom": "Benutzerdefiniert",

  "archive.storage.local": "Lokaler Download",
  "archive.storage.google_drive": "Google Drive",
  "archive.storage.dropbox": "Dropbox",
  "archive.storage.s3": "Amazon S3",
  "archive.storage.supabase_storage": "Supabase Storage",

  "archive.status.pending": "Ausstehend",
  "archive.status.in_progress": "In Bearbeitung",
  "archive.status.completed": "Abgeschlossen",
  "archive.status.failed": "Fehlgeschlagen",
  "archive.status.restored": "Wiederhergestellt",

  "archive.format.json": "JSON (Vollständig)",
  "archive.format.csv": "CSV (Excel)",
  "archive.format.parquet": "Parquet (Big Data)",

  // ===========================================================================
  // Login / Passwort (ausserhalb des I18nProvider — bleibt Deutsch)
  // ===========================================================================
  "auth.brand": "CRM Dashboard",
  "auth.login.title": "Anmelden",
  "auth.login.pageTitle": "Anmelden | CRM",
  "auth.login.submitting": "Anmelden…",
  "auth.forgot.title": "Passwort vergessen",
  "auth.forgot.pageTitle": "Passwort vergessen | CRM",
  "auth.forgot.description":
    "Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Reset-Link.",
  "auth.forgot.link": "Passwort vergessen?",
  "auth.forgot.submit": "Reset-Link senden",
  "auth.forgot.submitting": "Senden…",
  "auth.field.password": "Passwort",
  "auth.field.emailPlaceholder": "ihre@email.ch",
  "auth.password.show": "Passwort anzeigen",
  "auth.password.hide": "Passwort verbergen",
  "auth.backToLogin": "Zurück zur Anmeldung",

  "auth.resetSent.title": "E-Mail gesendet!",
  "auth.resetSent.description":
    "Wir haben Ihnen einen Reset-Link zugeschickt. Bitte prüfen Sie Ihren Posteingang.",
  "auth.toast.resetSent.title": "E-Mail gesendet",
  "auth.toast.resetSent.description":
    "Prüfen Sie Ihren Posteingang für den Reset-Link.",
  "auth.toast.loginFailed": "Anmeldung fehlgeschlagen",
  "auth.toast.invalidCredentials": "E-Mail oder Passwort ist falsch.",
  "auth.toast.welcome": "Willkommen!",
  "auth.toast.welcomeDescription": "Sie wurden erfolgreich angemeldet.",

  "auth.noCompany.pageTitle": "Kein Zugriff | CRM",
  "auth.noCompany.title": "Keine Firma verknüpft",
  "auth.noCompany.description":
    "Ihr Konto {email} ist nicht mit einer Firma verknüpft.",
  "auth.noCompany.whatToDo": "Was können Sie tun?",
  "auth.noCompany.step1": "Kontaktieren Sie den Administrator",
  "auth.noCompany.step2": "Prüfen Sie, ob Sie die richtige E-Mail verwenden",
  "auth.noCompany.signOut": "Abmelden & anderen Account verwenden",

  "auth.pending.pageTitle": "Verifizierung ausstehend | CRM",
  "auth.pending.title": "Verifizierung ausstehend",
  "auth.pending.description": "Ihr Konto {email} ist noch nicht freigeschaltet.",
  "auth.pending.whatNow": "Was passiert jetzt?",
  "auth.pending.step1": "Ihr Firmenprofil wird geprüft",
  "auth.pending.step2":
    "Nach Freischaltung erhalten Sie Zugriff auf das Dashboard",
  "auth.pending.signOut": "Abmelden",

  "auth.reset.pageTitle": "Neues Passwort setzen | CRM",
  "auth.reset.title": "Neues Passwort setzen",
  "auth.reset.description": "Geben Sie Ihr neues Passwort ein.",
  "auth.reset.newPassword": "Neues Passwort",
  "auth.reset.newPasswordPlaceholder": "Mindestens 8 Zeichen",
  "auth.reset.confirmPassword": "Passwort bestätigen",
  "auth.reset.confirmPasswordPlaceholder": "Passwort wiederholen",
  "auth.reset.submit": "Passwort speichern",
  "auth.reset.submitting": "Wird gespeichert…",
  "auth.reset.success.title": "Passwort geändert!",
  "auth.reset.success.description": "Sie werden in Kürze weitergeleitet…",
  "auth.reset.success.toEnter": "Zum Dashboard",
  "auth.reset.toast.changed": "Passwort geändert",
  "auth.reset.toast.changedDescription":
    "Ihr Passwort wurde erfolgreich aktualisiert.",
  "auth.reset.toast.linkExpired": "Link abgelaufen",
  "auth.reset.toast.linkExpiredDescription":
    "Bitte fordern Sie einen neuen Passwort-Reset-Link an.",

  // ===========================================================================
  // 404
  // ===========================================================================
  "notFound.title": "404",
  "notFound.message": "Diese Seite existiert nicht.",
  "notFound.home": "Zurück zur Startseite",

  // ===========================================================================
  // Erinnerungseinstellungen
  // ===========================================================================
  "reminders.title": "Erinnerungseinstellungen",
  "reminders.description":
    "Automatische E-Mail-Erinnerungen für Ihre Teammitglieder und Kunden konfigurieren",
  "reminders.team.title": "Team-Erinnerungen",
  "reminders.team.description":
    "E-Mails an zugewiesene Teammitglieder vor Terminen",
  "reminders.customer.title": "Kunden-Erinnerungen",
  "reminders.customer.description": "E-Mails an Kunden vor ihren Terminen",
  "reminders.sendAt": "Erinnerung senden:",
  "reminders.hoursBefore": "{count} Stunden vorher",
  "reminders.hoursBefore#one": "{count} Stunde vorher",
  "reminders.hoursBefore#other": "{count} Stunden vorher",

  "reminders.content.title": "E-Mail-Inhalt",
  "reminders.content.description":
    "Welche Informationen sollen in den Erinnerungen enthalten sein?",
  "reminders.content.customerPhone": "Kundentelefon",
  "reminders.content.customerEmail": "Kunden-E-Mail",
  "reminders.content.leadDetails": "Lead-Details",
  "reminders.content.offerDetails": "Offerte-Details",
  "reminders.footer.title": "Eigene Fusszeile",
  "reminders.footer.placeholder":
    "Optionale benutzerdefinierte Nachricht für die E-Mail-Fusszeile…",

  "reminders.pending.title": "Anstehende Erinnerungen",
  "reminders.pending.description":
    "Diese Erinnerungen werden automatisch versendet",
  "reminders.pending.members": "{count} Teammitglieder",
  "reminders.pending.members#one": "{count} Teammitglied",
  "reminders.pending.members#other": "{count} Teammitglieder",
  "reminders.pending.dispatch": "Versand: {date} {time}",

  "reminders.info.title": "Wie funktionieren die Erinnerungen?",
  "reminders.info.item1":
    "Erinnerungen werden automatisch vor jedem Termin versendet",
  "reminders.info.item2":
    "Nur Termine mit zugewiesenen Teammitgliedern erhalten Erinnerungen",
  "reminders.info.item3":
    "Die E-Mail enthält alle wichtigen Details: Adresse, Kundenname, Telefon",
  "reminders.info.item4":
    "Bei Besichtigungen werden die Lead-Details inkl. Wohnungsgrösse gesendet",
  "reminders.info.item5":
    "Bei Service-Einsätzen werden zusätzlich die Offerte-Details gesendet",

  "reminders.toast.saved": "Einstellungen gespeichert",
  "reminders.toast.savedDescription":
    "Ihre Erinnerungseinstellungen wurden erfolgreich aktualisiert.",
  "reminders.toast.saveFailed": "Einstellungen konnten nicht gespeichert werden.",

  // ===========================================================================
  // Logo- / Signatur-Upload
  // ===========================================================================
  "upload.logo.label": "Firmenlogo",
  "upload.logo.empty": "Kein Logo",
  "upload.logo.change": "Logo ändern",
  "upload.logo.upload": "Logo hochladen",
  "upload.logo.hint": "JPG, PNG oder WebP. Max. 2 MB.",
  "upload.logo.notOptimizedDescription":
    "Das Logo konnte nicht verkleinert werden und wird im Original hochgeladen.",
  "upload.logo.uploaded": "Logo hochgeladen",
  "upload.logo.uploadedDescription": "Ihr Firmenlogo wurde aktualisiert.",
  "upload.logo.removed": "Logo entfernt",
  "upload.logo.removedDescription": "Ihr Firmenlogo wurde entfernt.",
  "upload.logo.uploadFailed": "Fehler beim Logo-Upload",
  "upload.logo.removeFailed": "Das Logo konnte nicht entfernt werden.",

  "upload.signature.label": "Unterschrift für Auftragsbestätigung",
  "upload.signature.hint":
    "Diese Unterschrift wird auf der Auftragsbestätigungs-Seite des PDFs angezeigt",
  "upload.signature.empty": "Keine Unterschrift",
  "upload.signature.formatHint":
    "PNG mit transparentem Hintergrund empfohlen. Max. 1 MB.",
  "upload.signature.notOptimizedDescription":
    "Die Unterschrift konnte nicht verkleinert werden und wird im Original hochgeladen.",
  "upload.signature.uploaded": "Signatur hochgeladen",
  "upload.signature.uploadedDescription": "Ihre Unterschrift wurde gespeichert.",
  "upload.signature.removed": "Signatur entfernt",
  "upload.signature.removedDescription": "Ihre Unterschrift wurde entfernt.",
  "upload.signature.uploadFailed": "Fehler beim Signatur-Upload",
  "upload.signature.removeFailed": "Die Signatur konnte nicht entfernt werden.",

  "upload.error.invalidType": "Ungültiger Dateityp",
  "upload.error.invalidTypeLogo":
    "Bitte wählen Sie eine JPG-, PNG- oder WebP-Datei. SVG wird nicht unterstützt.",
  "upload.error.invalidTypeSignature":
    "Bitte wählen Sie eine JPG-, PNG- oder WebP-Datei.",
  "upload.error.tooLarge": "Datei zu gross",
  "upload.error.tooLargeDescription":
    "Die Datei ist {size} MB gross. Maximal {max} MB erlaubt.",
  "upload.error.sessionExpired": "Sitzung abgelaufen",
  "upload.error.sessionExpiredDescription":
    "Bitte laden Sie die Seite neu oder melden Sie sich erneut an.",
  "upload.notOptimized": "Bild nicht optimiert",
  "upload.change": "Ändern",

  // ===========================================================================
  // Spracheingabe (VoiceRecorder)
  // ===========================================================================
  "voice.unsupported":
    "Ihr Browser unterstützt keine Audioaufnahme. Bitte verwenden Sie einen aktuellen Chrome-, Firefox- oder Edge-Browser.",
  "voice.start": "Spracheingabe",
  "voice.recording": "Aufnahme läuft — {duration}",
  "voice.stop": "Stoppen",
  "voice.transcribing": "Transkribiere Aufnahme…",
  "voice.done": "Transkription abgeschlossen — bitte prüfen und bei Bedarf bearbeiten:",
  "voice.edit": "Transkription bearbeiten",
  "voice.extract": "Mit KI extrahieren",
  "voice.discard": "Verwerfen",

  // ===========================================================================
  // PLZ-Auswahl nach Kanton
  // ===========================================================================
  "plz.open": "PLZ nach Kanton auswählen",
  "plz.description":
    "Wählen Sie die PLZ-Gebiete, in denen Sie tätig sind. Klicken Sie auf einen Kanton, um alle PLZ zu sehen.",
  "plz.searchPlaceholder": "PLZ, Stadt oder Kanton suchen…",
  "plz.selected": "{count} PLZ ausgewählt",
  "plz.pendingAdd": "+{count} neu",
  "plz.pendingRemove": "-{count} entfernt",
  "plz.selectAll": "Alle auswählen",
  "plz.deselectAll": "Alle abwählen",
  "plz.save": "Änderungen speichern",
  "plz.saved": "Gespeichert",
  "plz.savedDescription": "{added} PLZ hinzugefügt, {removed} PLZ entfernt.",
  "plz.loadFailed": "PLZ-Daten konnten nicht geladen werden.",
  "plz.saveFailed": "Änderungen konnten nicht gespeichert werden.",

  "canton.AG": "Aargau",
  "canton.AI": "Appenzell Innerrhoden",
  "canton.AR": "Appenzell Ausserrhoden",
  "canton.BE": "Bern",
  "canton.BL": "Basel-Landschaft",
  "canton.BS": "Basel-Stadt",
  "canton.FR": "Freiburg",
  "canton.GE": "Genf",
  "canton.GL": "Glarus",
  "canton.GR": "Graubünden",
  "canton.JU": "Jura",
  "canton.LU": "Luzern",
  "canton.NE": "Neuenburg",
  "canton.NW": "Nidwalden",
  "canton.OW": "Obwalden",
  "canton.SG": "St. Gallen",
  "canton.SH": "Schaffhausen",
  "canton.SO": "Solothurn",
  "canton.SZ": "Schwyz",
  "canton.TG": "Thurgau",
  "canton.TI": "Tessin",
  "canton.UR": "Uri",
  "canton.VD": "Waadt",
  "canton.VS": "Wallis",
  "canton.ZG": "Zug",
  "canton.ZH": "Zürich",
} as const;
