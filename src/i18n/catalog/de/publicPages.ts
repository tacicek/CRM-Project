/**
 * Public, token-addressed customer pages (src/pages/public/*).
 *
 * Rendered in the CUSTOMER's language, resolved from the document the link points
 * at — never from a dashboard context (there is no logged-in operator here at all).
 *
 * ONE EXCEPTION, and it is deliberate: /termin/:id/antwort (RescheduleResponse) is
 * reached from the link inside the *company* notification e-mail — the operator, not
 * the customer, answers there. Its keys (`public.rescheduleResponse.*`) are therefore
 * worded towards the company and resolved from `companies.default_language`.
 */
export const publicPages = {
  // --- Shared -------------------------------------------------------------------
  "public.invalidLink": "Ungültiger Link. Bitte verwenden Sie den Link aus Ihrer E-Mail.",
  "public.notFound": "Nicht gefunden",
  "public.loading": "Wird geladen…",
  "public.error": "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
  "public.expired": "Dieser Link ist abgelaufen.",
  "public.thanks": "Vielen Dank!",
  "public.close": "Sie können dieses Fenster nun schliessen.",
  "public.reload": "Seite neu laden",
  "public.processing": "Wird verarbeitet…",
  "public.messageOptional": "Nachricht (optional)",

  // --- Shared appointment vocabulary ------------------------------------------------
  "public.appointment.notFound": "Termin nicht gefunden.",
  "public.appointment.notFoundOrEmailMismatch":
    "Termin nicht gefunden oder E-Mail-Adresse stimmt nicht überein.",
  "public.appointment.addToCalendar": "Zum Kalender hinzufügen",
  "public.appointment.icsDescription": "Termin bei {company}",

  // --- Offer view (/offerte/:token) -------------------------------------------------
  "public.offer.title": "Ihre Offerte",
  "public.offer.pageTitle": "{title} | Offerte von {company}",
  "public.offer.expired": "Diese Offerte ist abgelaufen.",
  "public.offer.expiredWithDeadline": "Diese Offerte ist abgelaufen (Annahme bis {date}).",
  "public.offer.validUntil": "Gültig bis {date}",
  "public.offer.download": "Offerte als PDF herunterladen",
  "public.offer.downloadChecklist": "Checkliste herunterladen",
  "public.offer.accept": "Offerte annehmen",
  "public.offer.reject": "Offerte ablehnen",
  "public.offer.rejectShort": "Ablehnen",
  "public.offer.accepted": "Sie haben diese Offerte angenommen.",
  "public.offer.rejected": "Sie haben diese Offerte abgelehnt.",
  "public.offer.acceptedOn": "Sie haben diese Offerte am {date} angenommen.",
  "public.offer.rejectedOn": "Sie haben diese Offerte am {date} abgelehnt.",
  "public.offer.acceptTitle": "Offerte verbindlich annehmen",
  "public.offer.acceptConfirm":
    "Mit der Annahme erteilen Sie uns verbindlich den in dieser Offerte beschriebenen Auftrag.",
  "public.offer.acceptBinding": "Verbindlich annehmen",
  "public.offer.rejectTitle": "Offerte ablehnen",
  "public.offer.rejectReason": "Möchten Sie uns kurz mitteilen, warum? (optional)",
  "public.offer.agbAccept":
    "Ich habe die Allgemeinen Geschäftsbedingungen gelesen und akzeptiere sie.",
  "public.offer.agbRequired": "Bitte akzeptieren Sie die AGB, um fortzufahren.",
  "public.offer.agbTitle": "Allgemeine Geschäftsbedingungen",
  "public.offer.requestViewing": "Besichtigung anfragen",
  "public.offer.requestViewingTitle": "Kostenlose Besichtigung anfragen",
  "public.offer.requestViewingSent":
    "Ihre Anfrage ist bei uns eingegangen. Wir melden uns in Kürze bei Ihnen.",
  "public.offer.questions": "Haben Sie Fragen? Rufen Sie uns an oder schreiben Sie uns.",
  "public.offer.acceptedThanks":
    "Vielen Dank für Ihren Auftrag. Wir melden uns in Kürze mit den nächsten Schritten.",
  "public.offer.rejectedThanks":
    "Vielen Dank für Ihre Rückmeldung. Gerne unterbreiten wir Ihnen ein neues Angebot.",

  // --- Offer view: load errors ---------------------------------------------------------
  "public.offer.notFoundTitle": "Offerte nicht gefunden",
  "public.offer.notFoundBody": "Diese Offerte existiert nicht oder ist nicht mehr verfügbar.",
  "public.offer.connectionErrorTitle": "Verbindungsproblem",
  "public.offer.connectionErrorBody":
    "Die Offerte konnte nicht geladen werden. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",

  // --- Offer view: header & meta --------------------------------------------------------
  "public.offer.website": "Website",
  "public.offer.createdOn": "Offerte erstellt am {date}",
  "public.offer.serviceDate": "Ausführungsdatum",

  // --- Offer view: item table ------------------------------------------------------------
  "public.offer.positions": "Positionen",
  "public.offer.col.pos": "Pos.",
  "public.offer.col.description": "Beschreibung",
  "public.offer.col.quantity": "Menge",
  "public.offer.col.unit": "Einheit",
  "public.offer.col.price": "Preis",
  "public.offer.col.total": "Total",
  "public.offer.hoursRange": "{min}–{max} Std.",
  "public.offer.perHour": "{amount}/Std.",
  "public.offer.perUnit": "{amount} / {unit}",

  // --- Offer view: checklist block ---------------------------------------------------------
  "public.offer.checklistBy": "Diese Checkliste wurde von {company} für Sie zusammengestellt.",
  "public.offer.checklistPdf": "Checkliste als PDF",

  // --- Offer view: response bar ---------------------------------------------------------------
  "public.offer.howRespond": "Wie möchten Sie auf diese Offerte reagieren?",
  "public.offer.askQuestion": "Frage stellen",
  "public.offer.contactFooter": "Bei Fragen wenden Sie sich bitte an",

  // --- Offer view: accept dialog ---------------------------------------------------------------
  "public.offer.acceptDialogBody":
    "Möchten Sie diese Offerte verbindlich annehmen? {company} wird über Ihre Entscheidung informiert.",
  "public.offer.acceptNotePlaceholder": "Möchten Sie der Firma etwas mitteilen?",

  // --- Offer view: reject dialog ---------------------------------------------------------------
  "public.offer.rejectDialogBody":
    "Möchten Sie diese Offerte ablehnen? {company} wird über Ihre Entscheidung informiert.",
  "public.offer.rejectReasonLabel": "Grund für die Ablehnung (optional)",
  "public.offer.rejectNotePlaceholder":
    "Teilen Sie der Firma mit, warum Sie die Offerte ablehnen…",

  // --- Offer view: question dialog ---------------------------------------------------------------
  "public.offer.contactDialogBody":
    "Haben Sie eine Frage zu dieser Offerte? {company} wird sich bei Ihnen melden.",
  "public.offer.contactLabel": "Ihre Frage oder Nachricht *",
  "public.offer.contactPlaceholder": "Schreiben Sie hier Ihre Frage oder Nachricht…",
  "public.offer.yourContactDetails": "Ihre Kontaktdaten:",
  "public.offer.sendMessage": "Nachricht senden",

  // --- Offer view: viewing-request dialog ------------------------------------------------------
  "public.offer.viewingDialogBody":
    "Schlagen Sie einen Termin für eine Besichtigung vor. {company} wird sich bei Ihnen melden.",
  "public.offer.viewingDate": "Wunschdatum",
  "public.offer.viewingTime": "Wunschzeit",
  "public.offer.viewingNotePlaceholder":
    "Gibt es etwas, das wir vor der Besichtigung wissen sollten?",
  "public.offer.viewingSubmit": "Termin vorschlagen",
  // Written into offers.customer_response_note and read by the COMPANY — therefore
  // rendered in the company's language, not the customer's.
  "public.offer.viewingRequestNote": "Besichtigung gewünscht am {date}.",
  "public.offer.viewingRequestNoteTime": "Besichtigung gewünscht am {date} um {time} Uhr.",

  // --- Offer view: toasts ----------------------------------------------------------------------
  "public.offer.toast.expiredTitle": "Annahmefrist abgelaufen",
  "public.offer.toast.expiredBody":
    "Diese Offerte kann nicht mehr angenommen werden. Bitte kontaktieren Sie die Firma.",
  "public.offer.toast.acceptedTitle": "Offerte angenommen",
  "public.offer.toast.acceptedBody": "Vielen Dank! Die Firma wurde benachrichtigt.",
  "public.offer.toast.acceptedAgbBody":
    "Vielen Dank! Sie haben die Offerte und die AGB akzeptiert. Die Firma wurde benachrichtigt.",
  "public.offer.toast.saveFailed": "Die Antwort konnte nicht gespeichert werden.",
  "public.offer.toast.rejectedTitle": "Offerte abgelehnt",
  "public.offer.toast.rejectedBody": "Die Firma wurde über Ihre Entscheidung informiert.",
  "public.offer.toast.messageRequired": "Bitte geben Sie eine Nachricht ein.",
  "public.offer.toast.messageSentTitle": "Nachricht gesendet",
  "public.offer.toast.messageSentBody":
    "Die Firma wurde über Ihre Frage informiert und wird sich bei Ihnen melden.",
  "public.offer.toast.messageFailed": "Die Nachricht konnte nicht gesendet werden.",
  "public.offer.toast.dateRequired": "Bitte wählen Sie ein Datum.",
  "public.offer.toast.viewingRequestedTitle": "Besichtigung angefragt",
  "public.offer.toast.viewingRequestedBody":
    "Die Firma wurde über Ihren Terminwunsch informiert.",
  "public.offer.toast.requestFailed": "Die Anfrage konnte nicht gespeichert werden.",

  // --- Appointment cancel (/termin/:id/absagen) ---------------------------------------
  "public.cancel.title": "Termin absagen",
  "public.cancel.question": "Möchten Sie diesen Termin wirklich absagen?",
  "public.cancel.reason": "Grund der Absage (optional)",
  "public.cancel.placeholder": "Teilen Sie uns mit, warum Sie absagen müssen…",
  "public.cancel.submit": "Termin absagen",
  "public.cancel.submitting": "Wird abgesagt…",
  "public.cancel.done": "Ihr Termin wurde abgesagt. Wir haben Ihre Absage erhalten.",
  "public.cancel.doneTitle": "Termin abgesagt",
  "public.cancel.doneBody": "Der Termin wurde erfolgreich abgesagt. {company} wurde benachrichtigt.",
  "public.cancel.alreadyCancelled": "Dieser Termin wurde bereits abgesagt.",
  "public.cancel.companyInformed": "{company} wird über die Absage informiert.",
  "public.cancel.toastSuccess": "Termin erfolgreich abgesagt",
  "public.cancel.toastFailed": "Der Termin konnte nicht abgesagt werden.",
  // Written into appointments.cancellation_reason and read by the COMPANY — company language.
  "public.cancel.defaultReason": "Vom Kunden abgesagt",

  // --- Appointment reschedule (/termin/:id/verschieben) ---------------------------------
  "public.reschedule.title": "Termin verschieben",
  "public.reschedule.intro": "Schlagen Sie uns einen neuen Termin vor.",
  "public.reschedule.current": "Aktueller Termin",
  "public.reschedule.newDate": "Gewünschtes Datum",
  "public.reschedule.pickNewDate": "Neues Datum auswählen",
  "public.reschedule.newTime": "Gewünschte Uhrzeit",
  "public.reschedule.pickTime": "Uhrzeit wählen",
  "public.reschedule.pickDateTime": "Bitte wählen Sie ein Datum und eine Uhrzeit aus.",
  "public.reschedule.message": "Nachricht (optional)",
  "public.reschedule.placeholder": "Teilen Sie uns mit, warum Sie verschieben möchten…",
  "public.reschedule.submit": "Terminvorschlag senden",
  "public.reschedule.done":
    "Ihr Terminvorschlag ist bei uns eingegangen. Wir bestätigen ihn Ihnen so bald wie möglich.",
  "public.reschedule.doneTitle": "Terminvorschlag gesendet",
  "public.reschedule.doneBody":
    "Ihr Terminvorschlag wurde an {company} gesendet. Sie erhalten eine Bestätigung per E-Mail.",
  "public.reschedule.proposed": "Vorgeschlagener Termin",
  "public.reschedule.alreadyRequested":
    "Für diesen Termin wurde bereits eine Verschiebung angefragt.",
  "public.reschedule.companyInformed":
    "{company} wird über Ihren Terminvorschlag informiert und meldet sich bei Ihnen.",
  "public.reschedule.toastSent": "Terminvorschlag gesendet",
  "public.reschedule.toastFailed": "Der Terminvorschlag konnte nicht gesendet werden.",

  // --- Reschedule response (/termin/:id/antwort) — addressed to the COMPANY ---------------
  "public.rescheduleResponse.confirmTitle": "Terminverschiebung bestätigen",
  "public.rescheduleResponse.rejectTitle": "Terminverschiebung ablehnen",
  "public.rescheduleResponse.confirmIntro": "Bestätigen Sie den neuen Termin für diesen Kunden.",
  "public.rescheduleResponse.rejectIntro": "Lehnen Sie die Verschiebungsanfrage ab.",
  "public.rescheduleResponse.originalAppointment": "Ursprünglicher Termin",
  "public.rescheduleResponse.proposedAppointment": "Vorgeschlagener neuer Termin",
  "public.rescheduleResponse.newAppointment": "Neuer Termin",
  "public.rescheduleResponse.messageToCustomer": "Nachricht an den Kunden (optional)",
  "public.rescheduleResponse.confirmPlaceholder": "Wir freuen uns auf den Termin…",
  "public.rescheduleResponse.rejectPlaceholder":
    "Leider können wir den vorgeschlagenen Termin nicht annehmen…",
  "public.rescheduleResponse.confirmSubmit": "Neuen Termin bestätigen",
  "public.rescheduleResponse.rejectSubmit": "Anfrage ablehnen",
  "public.rescheduleResponse.confirmedTitle": "Termin bestätigt",
  "public.rescheduleResponse.rejectedTitle": "Anfrage abgelehnt",
  "public.rescheduleResponse.confirmedBody":
    "Der neue Termin wurde bestätigt. Der Kunde wurde per E-Mail informiert.",
  "public.rescheduleResponse.rejectedBody":
    "Die Verschiebungsanfrage wurde abgelehnt. Der Kunde wurde per E-Mail informiert.",
  "public.rescheduleResponse.alreadyHandled": "Dieser Termin wurde bereits bearbeitet.",
  "public.rescheduleResponse.customerNotified":
    "Der Kunde wird per E-Mail über Ihre Entscheidung informiert.",
  "public.rescheduleResponse.toastFailed": "Die Anfrage konnte nicht verarbeitet werden.",

  // --- Besichtigung proposal response (/besichtigung/:leadId/antwort) -----------------------
  "public.viewingProposal.title": "Terminvorschläge für die Besichtigung",
  "public.viewingProposal.introCompany": "{company} hat Ihnen folgende Termine vorgeschlagen.",
  "public.viewingProposal.intro": "Bitte wählen Sie einen der vorgeschlagenen Termine:",
  "public.viewingProposal.select": "Diesen Termin wählen",
  "public.viewingProposal.selectRequired": "Bitte wählen Sie einen Termin aus.",
  "public.viewingProposal.none": "Keinen Termin annehmen",
  "public.viewingProposal.confirmSubmit": "Termin bestätigen",
  "public.viewingProposal.messagePlaceholder": "Haben Sie besondere Wünsche oder Anmerkungen?",
  "public.viewingProposal.companyNotified":
    "Die Firma wird per E-Mail über Ihre Entscheidung informiert.",
  "public.viewingProposal.confirmedTitle": "Termin bestätigt",
  "public.viewingProposal.confirmedBody":
    "Vielen Dank! {company} wurde über Ihre Bestätigung informiert.",
  "public.viewingProposal.rejectedTitle": "Terminvorschläge abgelehnt",
  "public.viewingProposal.rejectedBody": "{company} wurde über Ihre Ablehnung informiert.",
  "public.viewingProposal.yourAppointment": "Ihr Besichtigungstermin",
  "public.viewingProposal.done":
    "Vielen Dank — wir haben Ihre Wahl erhalten und bestätigen den Termin.",
  "public.viewingProposal.declined":
    "Vielen Dank für Ihre Rückmeldung. Wir melden uns mit neuen Terminvorschlägen.",
  "public.viewingProposal.invalidProposals": "Ungültige Terminvorschläge.",
  "public.viewingProposal.parseError":
    "Die Terminvorschläge konnten nicht geladen werden. Bitte verwenden Sie den Link aus Ihrer E-Mail erneut.",
  "public.viewingProposal.loadError": "Die Terminvorschläge konnten nicht geladen werden.",
  "public.viewingProposal.confirmFailed": "Der Termin konnte nicht bestätigt werden.",
  "public.viewingProposal.rejectFailed": "Die Ablehnung konnte nicht gesendet werden.",

  // --- Virtual Besichtigung (/besichtigung/:token) -------------------------------------------
  "public.virtualViewing.title": "Virtuelle Besichtigung",
  "public.virtualViewing.intro":
    "Laden Sie Fotos der zu bearbeitenden Räume hoch, damit wir Ihnen eine genaue Offerte erstellen können.",
  "public.virtualViewing.addPhotos": "Fotos hinzufügen",
  "public.virtualViewing.room": "Raum",
  "public.virtualViewing.uploading": "Wird hochgeladen…",
  "public.virtualViewing.finish": "Besichtigung abschliessen",
  "public.virtualViewing.done":
    "Vielen Dank! Wir haben Ihre Fotos erhalten und erstellen Ihre Offerte.",
  "public.virtualViewing.minPhotos": "Bitte laden Sie mindestens ein Foto hoch, um fortzufahren.",
  "public.virtualViewing.noToken": "Kein Token angegeben.",
  "public.virtualViewing.sessionNotFound": "Die Besichtigung wurde nicht gefunden.",
  "public.virtualViewing.loadFailed": "Die Besichtigung konnte nicht geladen werden.",
  "public.virtualViewing.invalidLinkTitle": "Ungültiger Link",
  "public.virtualViewing.invalidLinkBody": "Dieser Link ist ungültig oder existiert nicht mehr.",
  "public.virtualViewing.contactForNewLink":
    "Bitte kontaktieren Sie die Firma für einen neuen Link.",
  "public.virtualViewing.contactCompanyForNewLink":
    "Bitte kontaktieren Sie {company} für einen neuen Link.",
  "public.virtualViewing.expiredTitle": "Link abgelaufen",
  "public.virtualViewing.expiredBody": "Dieser Besichtigungs-Link ist leider abgelaufen.",
  "public.virtualViewing.completedTitle": "Abgeschlossen",
  "public.virtualViewing.completedBody":
    "Ihre virtuelle Besichtigung wurde erfolgreich übermittelt.",
  "public.virtualViewing.completedNote":
    "{company} wird Ihre Fotos analysieren und sich mit einem Angebot bei Ihnen melden.",
  "public.virtualViewing.howItWorks": "So funktioniert's:",
  "public.virtualViewing.step.rooms": "Fotografieren Sie alle Zimmer Ihrer Wohnung",
  "public.virtualViewing.step.furniture": "Zeigen Sie grosse und schwere Möbel deutlich",
  "public.virtualViewing.step.storage": "Vergessen Sie Keller, Estrich und Garage nicht",
  "public.virtualViewing.step.notes": "Fügen Sie am Ende zusätzliche Informationen hinzu",
  "public.virtualViewing.selectRoom": "Raum auswählen",
  "public.virtualViewing.uploadFor": "Fotos hochladen – {room}",
  "public.virtualViewing.notesTitle": "Zusätzliche Informationen (optional)",
  "public.virtualViewing.notesPlaceholder":
    "z. B. schweres Klavier im Wohnzimmer, enge Treppe, 3. Stock ohne Lift, Parkplatz weit entfernt…",
  // The base key is what callers pass to `t()`; the #one/#other variants are picked by
  // Intl.PluralRules (French counts 0 as singular, German and English do not).
  "public.virtualViewing.photosUploaded": "{count} Fotos hochgeladen",
  "public.virtualViewing.photosUploaded#one": "{count} Foto hochgeladen",
  "public.virtualViewing.photosUploaded#other": "{count} Fotos hochgeladen",
  "public.virtualViewing.roomsDocumented": "{done} von {total} Räumen dokumentiert",
  "public.virtualViewing.toast.uploaded": "{file} hochgeladen",
  "public.virtualViewing.toast.uploadFailed": "{file} konnte nicht hochgeladen werden.",
  "public.virtualViewing.toast.deleted": "Foto gelöscht",
  "public.virtualViewing.toast.deleteFailed": "Das Foto konnte nicht gelöscht werden.",
  "public.virtualViewing.toast.completed": "Besichtigung abgeschlossen!",
  "public.virtualViewing.toast.completeFailed":
    "Die Besichtigung konnte nicht abgeschlossen werden.",
} as const;
