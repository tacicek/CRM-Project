/**
 * Dashboard namespace: auftrag. German is the source of truth for the key set.
 *
 * Covers Aufträge (list), AuftragModal, SahaExtrasModal and AuftragAbschlussDialog.
 *
 * OPERATOR chrome only — resolved with `useT()`. The Auftrag carries its own
 * `auftraege.language` (inherited from the offer/lead); anything that is written INTO
 * the row and later printed on the work order or the receipt (address lines, extra
 * service descriptions, unit tokens) stays out of this catalog, so the dashboard
 * locale can never leak into a customer document.
 */
export const auftrag = {
  // --- Aufträge list ------------------------------------------------------------------
  "auftrag.pageTitle": "Aufträge · CRM",
  "auftrag.title": "Aufträge",
  "auftrag.subtitle":
    "Arbeitsaufträge und Team-Zuweisungen — Übersicht über alle geplanten Einsätze.",
  "auftrag.summary": "{total} insgesamt · {today} heute · {week} diese Woche",
  "auftrag.new": "Neuer Auftrag",
  "auftrag.searchPlaceholder": "In Aufträgen suchen …",
  "auftrag.empty": "Keine Aufträge gefunden",
  "auftrag.emptyAction": "Ersten Auftrag erstellen",

  // --- KPI tiles + tabs -----------------------------------------------------------------
  "auftrag.kpi.today": "Heute",
  "auftrag.kpi.tomorrow": "Morgen",
  "auftrag.kpi.planned": "Geplant",
  "auftrag.kpi.completed": "Abgeschlossen",
  "auftrag.tab.all": "Alle",
  "auftrag.tab.today": "Heute",
  "auftrag.tab.tomorrow": "Morgen",
  "auftrag.tab.planned": "Geplant",
  "auftrag.tab.done": "Erledigt",
  "auftrag.overdue": "{count} überfällige Aufträge",
  "auftrag.overdue#one": "{count} überfälliger Auftrag",
  "auftrag.overdue#other": "{count} überfällige Aufträge",

  // --- Table ------------------------------------------------------------------------------
  "auftrag.table.auftrag": "Auftrag",
  "auftrag.table.customer": "Kunde",
  "auftrag.table.dateTime": "Datum/Zeit",
  "auftrag.table.team": "Team",
  "auftrag.badge.today": "Heute",
  "auftrag.badge.tomorrow": "Morgen",
  "auftrag.badge.overdue": "Überfällig",
  "auftrag.badge.invalidData": "Daten konnten nicht validiert werden",
  "auftrag.time.oclock": "Uhr",
  "auftrag.team.notified": "Benachrichtigt",
  "auftrag.team.unassigned": "Nicht zugewiesen",

  // --- Row menu ----------------------------------------------------------------------------
  "auftrag.menu.aria": "Auftrag Optionen",
  "auftrag.menu.sahaExtras": "Saha Extras",
  "auftrag.menu.downloadPdf": "PDF herunterladen",
  "auftrag.menu.viewOffer": "Offerte anzeigen",
  "auftrag.menu.createQuittung": "Quittung erstellen",
  "auftrag.menu.anotherQuittung": "Weitere Quittung (bereits vorhanden)",
  "auftrag.menu.createRechnung": "Rechnung erstellen",
  "auftrag.menu.rechnungExists": "Rechnung bereits erstellt",
  "auftrag.menu.markConfirmed": "Als bestätigt markieren",
  "auftrag.menu.inProgress": "In Bearbeitung",
  "auftrag.menu.complete": "Abschliessen …",
  "auftrag.menu.reactivate": "Reaktivieren",
  "auftrag.menu.cancel": "Stornieren",
  "auftrag.menu.archive": "Archivieren",

  // --- Archive dialog ------------------------------------------------------------------------
  "auftrag.archive.title": "Auftrag archivieren?",
  "auftrag.archive.description":
    "Möchten Sie den Auftrag «{title}» wirklich archivieren? Der Auftrag wird aus der Liste entfernt, bleibt aber für die Nachvollziehbarkeit gespeichert.",
  "auftrag.archive.deleting": "Wird gelöscht …",

  // --- Toasts (list) --------------------------------------------------------------------------
  "auftrag.toast.savedTitle": "Gespeichert",
  "auftrag.toast.loadFailed": "Aufträge konnten nicht geladen werden.",
  "auftrag.toast.pdfDownloaded": "PDF wurde heruntergeladen.",
  "auftrag.toast.pdfFailed": "PDF konnte nicht erstellt werden.",
  "auftrag.toast.archived": "Auftrag wurde archiviert.",
  "auftrag.toast.deleteFailed": "Auftrag konnte nicht gelöscht werden.",
  "auftrag.toast.statusUpdated": "Status wurde aktualisiert.",
  "auftrag.toast.statusFailed": "Status konnte nicht aktualisiert werden.",
  "auftrag.toast.invalidTransition": "Ungültiger Statuswechsel: {from} → {to}",
  "auftrag.toast.ibanMissing": "IBAN fehlt",
  "auftrag.toast.ibanMissingHint":
    "Bitte IBAN in den Einstellungen hinterlegen, bevor Sie eine QR-Rechnung erstellen.",

  // --- Modal shell -------------------------------------------------------------------------------
  "auftrag.modal.edit": "Auftrag bearbeiten: {number}",
  "auftrag.modal.new": "Neuer Auftrag",
  "auftrag.modal.fromOffer": "Erstellt aus Offerte:",
  "auftrag.modal.selectOffer": "Wählen Sie eine genehmigte Offerte aus",
  "auftrag.modal.createAndAssign": "Auftrag erstellen und Team zuweisen",
  "auftrag.modal.loadingOffers": "Genehmigte Offerten werden geladen …",
  "auftrag.modal.noApprovedOffers": "Keine genehmigten Offerten",
  "auftrag.modal.noApprovedOffersHint":
    "Es gibt keine genehmigten Offerten, aus denen ein Auftrag erstellt werden kann.",
  "auftrag.modal.manualHint": "Sie können trotzdem einen Auftrag manuell erstellen.",
  "auftrag.modal.createManually": "Manuell erstellen",
  "auftrag.modal.offersAvailable": "{count} genehmigte Offerten verfügbar",
  "auftrag.modal.offersAvailable#one": "{count} genehmigte Offerte verfügbar",
  "auftrag.modal.offersAvailable#other": "{count} genehmigte Offerten verfügbar",
  "auftrag.modal.approved": "Genehmigt",

  // --- Pricing -------------------------------------------------------------------------------------
  "auftrag.pricing.title": "Preisgestaltung",
  "auftrag.pricing.type": "Preistyp",
  "auftrag.pricing.fixed": "Festpreis",
  "auftrag.pricing.hourly": "Nach Aufwand",
  "auftrag.pricing.estimate": "Kostenvoranschlag",
  "auftrag.pricing.hourlyRate": "Stundensatz (CHF)",
  "auftrag.pricing.hourlyRatePlaceholder": "z.B. 85",
  "auftrag.pricing.finalPriceNote": "Endpreis wird nach Abschluss berechnet",
  "auftrag.offerItems.title": "Offerte-Positionen",
  "auftrag.vatWithRate": "MwSt. ({rate}%)",

  // --- Extra services (in the modal) ------------------------------------------------------------------
  "auftrag.extras.title": "Zusätzliche Leistungen",
  "auftrag.extras.empty":
    "Keine zusätzlichen Leistungen. Klicken Sie auf «Hinzufügen», um eine neue Position zu erstellen.",
  "auftrag.extras.descriptionPlaceholder": "z.B. Möbelmontage",
  "auftrag.extras.priceChf": "Preis (CHF)",

  // --- Service details --------------------------------------------------------------------------------
  "auftrag.serviceDetails": "{service} — Details",
  "auftrag.details.rooms": "{count} Zimmer",
  "auftrag.details.bathrooms": "{count} Bad(er)",
  "auftrag.details.packing": "Verpackungsservice",
  "auftrag.details.cleaning": "Reinigung",
  "auftrag.details.piano": "Klavier",
  "auftrag.details.windows": "Fenster",
  "auftrag.details.balcony": "Balkon",
  "auftrag.details.garage": "Garage",
  "auftrag.details.heavyItems": "Schwere Gegenstände",

  // --- Form fields ---------------------------------------------------------------------------------------
  "auftrag.field.title": "Titel *",
  "auftrag.field.titlePlaceholder": "z.B. Umzug Familie Müller",
  "auftrag.field.customerData": "Kundendaten",
  "auftrag.field.namePlaceholder": "Name *",
  "auftrag.field.fromAddress": "Von-Adresse",
  "auftrag.field.toAddress": "Nach-Adresse",
  "auftrag.field.addressPlaceholder": "Strasse Nr.\nPLZ Ort\nStock (Lift)",
  "auftrag.field.date": "Datum *",
  "auftrag.field.duration": "Geschätzte Dauer",
  "auftrag.field.durationPlaceholder": "Dauer wählen",
  "auftrag.field.descriptionPlaceholder": "Allgemeine Beschreibung des Auftrags …",
  "auftrag.field.internalNotes": "Interne Notizen",
  "auftrag.field.internalNotesPlaceholder": "Nur intern sichtbar …",
  "auftrag.field.specialInstructions": "Spezielle Anweisungen",
  "auftrag.field.specialInstructionsPlaceholder":
    "Wichtige Hinweise für das Team (erscheint hervorgehoben in der Erinnerungs-E-Mail) …",

  // --- Duration options -------------------------------------------------------------------------------------
  "auftrag.duration.min30": "30 Min.",
  "auftrag.duration.h1": "1 Stunde",
  "auftrag.duration.h1_5": "1.5 Stunden",
  "auftrag.duration.h2": "2 Stunden",
  "auftrag.duration.h3": "3 Stunden",
  "auftrag.duration.h4": "4 Stunden",
  "auftrag.duration.h5": "5 Stunden",
  "auftrag.duration.h6": "6 Stunden",
  "auftrag.duration.h7": "7 Stunden",
  "auftrag.duration.h8": "8 Stunden (ganzer Tag)",
  "auftrag.duration.h10": "10 Stunden",
  "auftrag.duration.h12": "12 Stunden",

  // --- Team ------------------------------------------------------------------------------------------------
  "auftrag.team.title": "Team-Zuweisung",
  "auftrag.team.leader": "Team-Leiter (erhält Erinnerung)",
  "auftrag.team.leaderPlaceholder": "Team-Leiter wählen (optional)",
  "auftrag.team.noLeader": "Kein Team-Leiter",
  "auftrag.team.noEmailWarning": "Kein Team-Mitglied hat eine E-Mail-Adresse.",
  "auftrag.team.reminder": "Erinnerung senden",
  "auftrag.team.members": "Weitere Team-Mitglieder",
  "auftrag.reminder.d1": "1 Tag vorher",
  "auftrag.reminder.d2": "2 Tage vorher",
  "auftrag.reminder.d3": "3 Tage vorher",
  "auftrag.reminder.w1": "1 Woche vorher",

  // --- Modal actions + toasts ---------------------------------------------------------------------------------
  "auftrag.action.create": "Auftrag erstellen",
  "auftrag.toast.requiredFields": "Bitte füllen Sie alle Pflichtfelder aus.",
  "auftrag.toast.offerRequired": "Offerte erforderlich",
  "auftrag.toast.offerRequiredHint":
    "Ein Auftrag muss einer akzeptierten Offerte zugeordnet sein. Bitte wählen Sie eine Offerte aus oder öffnen Sie den Auftrag direkt aus einer Offerte.",
  "auftrag.toast.invalidEmail": "Ungültige E-Mail",
  "auftrag.toast.invalidEmailHint": "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  "auftrag.toast.invalidPrice": "Ungültiger Preis",
  "auftrag.toast.negativeHourlyRate": "Der Stundensatz darf nicht negativ sein.",
  "auftrag.toast.negativePrice": "Der Preis darf nicht negativ sein.",
  "auftrag.toast.pastDate": "Datum in der Vergangenheit",
  "auftrag.toast.pastDateHint": "Das gewählte Datum liegt in der Vergangenheit.",
  "auftrag.toast.updated": "Auftrag wurde aktualisiert.",
  "auftrag.toast.created": "Auftrag wurde erstellt.",
  "auftrag.toast.saveFailed": "Fehler beim Speichern",
  "auftrag.toast.saveFailedDefault": "Auftrag konnte nicht gespeichert werden.",
  "auftrag.toast.saveFailedForeignKey":
    "Die verknüpfte Offerte oder ein Mitarbeiter wurde nicht gefunden. Bitte überprüfen Sie die Auswahl.",
  "auftrag.toast.saveFailedDuplicate":
    "Ein Auftrag mit dieser Nummer existiert bereits. Bitte versuchen Sie es erneut.",
  "auftrag.toast.saveFailedCheck": "Ungültige Eingabe: {message}",
  "auftrag.toast.saveFailedCheckFallback": "Ein Wert entspricht nicht den erlaubten Optionen.",
  "auftrag.toast.offersLoadFailed": "Genehmigte Offerten konnten nicht geladen werden.",
  "auftrag.toast.offerLoadFailed": "Offerte-Daten konnten nicht geladen werden.",

  // --- Saha Extras (field extras) ---------------------------------------------------------------------------------
  "auftrag.saha.title": "Saha Extras",
  "auftrag.saha.quickAdd": "Schnell hinzufügen",
  "auftrag.saha.preset.hour": "Zusätzliche Stunde",
  "auftrag.saha.preset.disposal": "Entsorgung",
  "auftrag.saha.preset.heavy": "Schwerlast",
  "auftrag.saha.preset.assembly": "Montage",
  "auftrag.saha.preset.specialFurniture": "Spezialmöbel",
  "auftrag.saha.preset.extraTrip": "Zusatzfahrt",
  "auftrag.saha.addCustom": "Eigene Position hinzufügen",
  "auftrag.saha.descriptionRequired": "Beschreibung *",
  "auftrag.saha.customPlaceholder": "z.B. Zusätzliche Kartons",
  "auftrag.saha.added": "Hinzugefügte Extras ({count})",
  "auftrag.saha.none": "Noch keine Extras hinzugefügt",
  "auftrag.saha.extrasTotal": "Extras Total:",
  "auftrag.saha.newSubtotal": "Zwischensumme (neu):",
  "auftrag.saha.newTotal": "Neues Total:",
  "auftrag.saha.difference": "Differenz: {amount}",
  "auftrag.saha.unsavedWarning":
    "Sie haben ungespeicherte Änderungen. Möchten Sie wirklich schliessen?",
  "auftrag.saha.loadFailed": "Auftrag konnte nicht geladen werden.",
  "auftrag.saha.saveFailed": "Extras konnten nicht gespeichert werden.",
  "auftrag.saha.saved": "{count} Extras wurden gespeichert.",
  "auftrag.saha.saved#one": "{count} Extra wurde gespeichert.",
  "auftrag.saha.saved#other": "{count} Extras wurden gespeichert.",
  "auftrag.saha.missingDescription": "Beschreibung fehlt",
  "auftrag.saha.missingDescriptionHint": "Bitte geben Sie eine Beschreibung ein.",
  "auftrag.saha.wait": "Bitte warten",
  "auftrag.saha.waitHint": "Speichern ist in Kürze wieder möglich.",

  // --- Completion dialog -----------------------------------------------------------------------------------------------
  "auftrag.abschluss.title": "Auftrag abschliessen",
  "auftrag.abschluss.actualHours": "Tatsächlich geleistete Stunden *",
  "auftrag.abschluss.hoursPlaceholder": "z.B. 4.5",
  "auftrag.abschluss.hourlyRate": "Stundensatz",
  "auftrag.abschluss.subtotalHours": "Zwischensumme ({hours} h)",
  "auftrag.abschluss.finalPrice": "Endpreis",
  "auftrag.abschluss.fixedPrice": "Festpreis (Endbetrag)",
  "auftrag.abschluss.notes": "Abschluss-Notizen (optional)",
  "auftrag.abschluss.notesPlaceholder":
    "z.B. Zusätzliche Leistungen, Besonderheiten beim Einsatz …",
  "auftrag.abschluss.confirm": "Abschliessen",
  "auftrag.abschluss.hoursRequired": "Stunden erforderlich",
  "auftrag.abschluss.hoursRequiredHint":
    "Bitte geben Sie die tatsächlich geleisteten Stunden ein.",
  "auftrag.abschluss.done": "Auftrag abgeschlossen",
  "auftrag.abschluss.donePrice": "Endpreis: {amount}",
  "auftrag.abschluss.doneHint": "Der Auftrag wurde als erledigt markiert.",
  "auftrag.abschluss.failed": "Auftrag konnte nicht abgeschlossen werden.",
} as const;
