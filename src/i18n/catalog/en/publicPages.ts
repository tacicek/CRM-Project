import { publicPages as de } from "@/i18n/catalog/de/publicPages";

/**
 * Public, token-addressed customer pages (src/pages/public/*).
 *
 * Rendered in the CUSTOMER's language, resolved from the document the link points
 * at — never from a dashboard context (there is no logged-in operator here at all).
 *
 * ONE deliberate exception: /termin/:id/antwort (RescheduleResponse) is opened from
 * the link in the e-mail sent to the COMPANY — the operator answers there, not the
 * customer. Its `public.rescheduleResponse.*` keys are therefore addressed to the
 * company and follow `companies.default_language`.
 */
export const publicPages: Record<keyof typeof de, string> = {
  // --- Shared -------------------------------------------------------------------
  "public.invalidLink": "This link is not valid. Please use the link from your email.",
  "public.notFound": "Not found",
  "public.loading": "Loading…",
  "public.error": "Something went wrong. Please try again in a moment.",
  "public.expired": "This link has expired.",
  "public.thanks": "Thank you!",
  "public.close": "You can now close this window.",
  "public.reload": "Reload the page",
  "public.processing": "Processing…",
  "public.messageOptional": "Message (optional)",

  // --- Shared appointment vocabulary ------------------------------------------------
  "public.appointment.notFound": "Appointment not found.",
  "public.appointment.notFoundOrEmailMismatch":
    "Appointment not found, or the email address does not match.",
  "public.appointment.addToCalendar": "Add to calendar",
  "public.appointment.icsDescription": "Appointment with {company}",

  // --- Quote view (/offerte/:token) -------------------------------------------------
  "public.offer.title": "Your quote",
  "public.offer.pageTitle": "{title} | Quote from {company}",
  "public.offer.expired": "This quote has expired.",
  "public.offer.expiredWithDeadline": "This quote has expired (acceptance closed on {date}).",
  "public.offer.validUntil": "Valid until {date}",
  "public.offer.download": "Download quote as PDF",
  "public.offer.downloadChecklist": "Download checklist",
  "public.offer.accept": "Accept quote",
  "public.offer.reject": "Decline quote",
  "public.offer.rejectShort": "Decline",
  "public.offer.accepted": "You have accepted this quote.",
  "public.offer.rejected": "You have declined this quote.",
  "public.offer.acceptedOn": "You accepted this quote on {date}.",
  "public.offer.rejectedOn": "You declined this quote on {date}.",
  "public.offer.acceptTitle": "Accept quote as binding",
  "public.offer.acceptConfirm":
    "By accepting, you place a binding order with us for the work described in this quote.",
  "public.offer.acceptBinding": "Accept as binding",
  "public.offer.rejectTitle": "Decline quote",
  "public.offer.rejectReason": "Would you mind telling us briefly why? (optional)",
  "public.offer.agbAccept": "I have read the Terms and Conditions and accept them.",
  "public.offer.agbRequired": "Please accept the Terms and Conditions to continue.",
  "public.offer.agbTitle": "Terms and Conditions",
  "public.offer.requestViewing": "Request a viewing",
  "public.offer.requestViewingTitle": "Request a free viewing",
  "public.offer.requestViewingSent":
    "We have received your request and will get back to you shortly.",
  "public.offer.questions": "Any questions? Give us a call or drop us a line.",
  "public.offer.acceptedThanks":
    "Thank you for your order. We will be in touch shortly with the next steps.",
  "public.offer.rejectedThanks":
    "Thank you for letting us know. We would be glad to put together a new offer for you.",

  // --- Quote view: load errors ---------------------------------------------------------
  "public.offer.notFoundTitle": "Quote not found",
  "public.offer.notFoundBody": "This quote does not exist or is no longer available.",
  "public.offer.connectionErrorTitle": "Connection problem",
  "public.offer.connectionErrorBody":
    "The quote could not be loaded. Please check your internet connection and try again.",

  // --- Quote view: header & meta --------------------------------------------------------
  "public.offer.website": "Website",
  "public.offer.createdOn": "Quote issued on {date}",
  "public.offer.serviceDate": "Date of service",

  // --- Quote view: item table ------------------------------------------------------------
  "public.offer.positions": "Items",
  "public.offer.col.pos": "Item",
  "public.offer.col.description": "Description",
  "public.offer.col.quantity": "Quantity",
  "public.offer.col.unit": "Unit",
  "public.offer.col.price": "Price",
  "public.offer.col.total": "Total",
  "public.offer.hoursRange": "{min}–{max} hrs",
  "public.offer.perHour": "{amount}/hr",
  "public.offer.perUnit": "{amount} / {unit}",

  // --- Quote view: checklist block ---------------------------------------------------------
  "public.offer.checklistBy": "This checklist was put together for you by {company}.",
  "public.offer.checklistPdf": "Checklist as PDF",

  // --- Quote view: response bar ---------------------------------------------------------------
  "public.offer.howRespond": "How would you like to respond to this quote?",
  "public.offer.askQuestion": "Ask a question",
  "public.offer.contactFooter": "If you have any questions, please contact",

  // --- Quote view: accept dialog ---------------------------------------------------------------
  "public.offer.acceptDialogBody":
    "Would you like to accept this quote as binding? {company} will be informed of your decision.",
  "public.offer.acceptNotePlaceholder": "Anything you would like to tell the company?",

  // --- Quote view: decline dialog ---------------------------------------------------------------
  "public.offer.rejectDialogBody":
    "Would you like to decline this quote? {company} will be informed of your decision.",
  "public.offer.rejectReasonLabel": "Reason for declining (optional)",
  "public.offer.rejectNotePlaceholder": "Let the company know why you are declining the quote…",

  // --- Quote view: question dialog ---------------------------------------------------------------
  "public.offer.contactDialogBody":
    "Do you have a question about this quote? {company} will get back to you.",
  "public.offer.contactLabel": "Your question or message *",
  "public.offer.contactPlaceholder": "Write your question or message here…",
  "public.offer.yourContactDetails": "Your contact details:",
  "public.offer.sendMessage": "Send message",

  // --- Quote view: viewing-request dialog ------------------------------------------------------
  "public.offer.viewingDialogBody":
    "Suggest a date for a viewing. {company} will get back to you.",
  "public.offer.viewingDate": "Preferred date",
  "public.offer.viewingTime": "Preferred time",
  "public.offer.viewingNotePlaceholder": "Is there anything we should know before the viewing?",
  "public.offer.viewingSubmit": "Suggest appointment",
  // Written into offers.customer_response_note and read by the COMPANY — therefore
  // rendered in the company's language, not the customer's.
  "public.offer.viewingRequestNote": "Viewing requested for {date}.",
  "public.offer.viewingRequestNoteTime": "Viewing requested for {date} at {time}.",

  // --- Quote view: toasts ----------------------------------------------------------------------
  "public.offer.toast.expiredTitle": "Acceptance period has passed",
  "public.offer.toast.expiredBody":
    "This quote can no longer be accepted. Please contact the company.",
  "public.offer.toast.acceptedTitle": "Quote accepted",
  "public.offer.toast.acceptedBody": "Thank you! The company has been notified.",
  "public.offer.toast.acceptedAgbBody":
    "Thank you! You have accepted the quote and the Terms and Conditions. The company has been notified.",
  "public.offer.toast.saveFailed": "Your response could not be saved.",
  "public.offer.toast.rejectedTitle": "Quote declined",
  "public.offer.toast.rejectedBody": "The company has been informed of your decision.",
  "public.offer.toast.messageRequired": "Please enter a message.",
  "public.offer.toast.messageSentTitle": "Message sent",
  "public.offer.toast.messageSentBody":
    "The company has been informed of your question and will get back to you.",
  "public.offer.toast.messageFailed": "The message could not be sent.",
  "public.offer.toast.dateRequired": "Please choose a date.",
  "public.offer.toast.viewingRequestedTitle": "Viewing requested",
  "public.offer.toast.viewingRequestedBody":
    "The company has been informed of the date you would like.",
  "public.offer.toast.requestFailed": "Your request could not be saved.",

  // --- Appointment cancellation (/termin/:id/absagen) ---------------------------------
  "public.cancel.title": "Cancel appointment",
  "public.cancel.question": "Are you sure you want to cancel this appointment?",
  "public.cancel.reason": "Reason for cancelling (optional)",
  "public.cancel.placeholder": "Let us know why you need to cancel…",
  "public.cancel.submit": "Cancel appointment",
  "public.cancel.submitting": "Cancelling…",
  "public.cancel.done": "Your appointment has been cancelled. We have received your cancellation.",
  "public.cancel.doneTitle": "Appointment cancelled",
  "public.cancel.doneBody": "The appointment has been cancelled. {company} has been notified.",
  "public.cancel.alreadyCancelled": "This appointment has already been cancelled.",
  "public.cancel.companyInformed": "{company} will be informed of the cancellation.",
  "public.cancel.toastSuccess": "Appointment cancelled",
  "public.cancel.toastFailed": "The appointment could not be cancelled.",
  // Written into appointments.cancellation_reason and read by the COMPANY — company language.
  "public.cancel.defaultReason": "Cancelled by the customer",

  // --- Appointment reschedule (/termin/:id/verschieben) ---------------------------------
  "public.reschedule.title": "Reschedule appointment",
  "public.reschedule.intro": "Suggest a new appointment that suits you better.",
  "public.reschedule.current": "Current appointment",
  "public.reschedule.newDate": "Preferred date",
  "public.reschedule.pickNewDate": "Choose a new date",
  "public.reschedule.newTime": "Preferred time",
  "public.reschedule.pickTime": "Choose a time",
  "public.reschedule.pickDateTime": "Please choose a date and a time.",
  "public.reschedule.message": "Message (optional)",
  "public.reschedule.placeholder": "Let us know why you would like to reschedule…",
  "public.reschedule.submit": "Send suggestion",
  "public.reschedule.done":
    "We have received your suggested appointment and will confirm it as soon as we can.",
  "public.reschedule.doneTitle": "Suggestion sent",
  "public.reschedule.doneBody":
    "Your suggested appointment has been sent to {company}. You will receive a confirmation by email.",
  "public.reschedule.proposed": "Suggested appointment",
  "public.reschedule.alreadyRequested":
    "A reschedule has already been requested for this appointment.",
  "public.reschedule.companyInformed":
    "{company} will be informed of your suggestion and will get back to you.",
  "public.reschedule.toastSent": "Suggestion sent",
  "public.reschedule.toastFailed": "Your suggestion could not be sent.",

  // --- Reschedule response (/termin/:id/antwort) — addressed to the COMPANY ---------------
  "public.rescheduleResponse.confirmTitle": "Confirm the reschedule",
  "public.rescheduleResponse.rejectTitle": "Decline the reschedule",
  "public.rescheduleResponse.confirmIntro": "Confirm the new appointment for this customer.",
  "public.rescheduleResponse.rejectIntro": "Decline the reschedule request.",
  "public.rescheduleResponse.originalAppointment": "Original appointment",
  "public.rescheduleResponse.proposedAppointment": "Suggested new appointment",
  "public.rescheduleResponse.newAppointment": "New appointment",
  "public.rescheduleResponse.messageToCustomer": "Message to the customer (optional)",
  "public.rescheduleResponse.confirmPlaceholder": "We look forward to the appointment…",
  "public.rescheduleResponse.rejectPlaceholder":
    "Unfortunately we cannot take the suggested appointment…",
  "public.rescheduleResponse.confirmSubmit": "Confirm new appointment",
  "public.rescheduleResponse.rejectSubmit": "Decline request",
  "public.rescheduleResponse.confirmedTitle": "Appointment confirmed",
  "public.rescheduleResponse.rejectedTitle": "Request declined",
  "public.rescheduleResponse.confirmedBody":
    "The new appointment has been confirmed. The customer has been notified by email.",
  "public.rescheduleResponse.rejectedBody":
    "The reschedule request has been declined. The customer has been notified by email.",
  "public.rescheduleResponse.alreadyHandled": "This appointment has already been dealt with.",
  "public.rescheduleResponse.customerNotified":
    "The customer will be notified of your decision by email.",
  "public.rescheduleResponse.toastFailed": "The request could not be processed.",

  // --- Viewing proposal response (/besichtigung/:leadId/antwort) -----------------------
  "public.viewingProposal.title": "Suggested viewing appointments",
  "public.viewingProposal.introCompany": "{company} has suggested the following appointments.",
  "public.viewingProposal.intro": "Please choose one of the suggested appointments:",
  "public.viewingProposal.select": "Choose this appointment",
  "public.viewingProposal.selectRequired": "Please choose an appointment.",
  "public.viewingProposal.none": "None of these appointments suit me",
  "public.viewingProposal.confirmSubmit": "Confirm appointment",
  "public.viewingProposal.messagePlaceholder": "Do you have any particular requests or remarks?",
  "public.viewingProposal.companyNotified":
    "The company will be notified of your decision by email.",
  "public.viewingProposal.confirmedTitle": "Appointment confirmed",
  "public.viewingProposal.confirmedBody":
    "Thank you! {company} has been informed of your confirmation.",
  "public.viewingProposal.rejectedTitle": "Appointments declined",
  "public.viewingProposal.rejectedBody": "{company} has been informed that you declined.",
  "public.viewingProposal.yourAppointment": "Your viewing appointment",
  "public.viewingProposal.done":
    "Thank you — we have received your choice and will confirm the appointment.",
  "public.viewingProposal.declined":
    "Thank you for letting us know. We will get back to you with new appointment proposals.",
  "public.viewingProposal.invalidProposals": "The suggested appointments are not valid.",
  "public.viewingProposal.parseError":
    "The suggested appointments could not be loaded. Please use the link from your email again.",
  "public.viewingProposal.loadError": "The suggested appointments could not be loaded.",
  "public.viewingProposal.confirmFailed": "The appointment could not be confirmed.",
  "public.viewingProposal.rejectFailed": "Your decline could not be sent.",

  // --- Virtual viewing (/besichtigung/:token) -------------------------------------------
  "public.virtualViewing.title": "Virtual viewing",
  "public.virtualViewing.intro":
    "Upload photos of the rooms involved so that we can prepare an accurate quote for you.",
  "public.virtualViewing.addPhotos": "Add photos",
  "public.virtualViewing.room": "Room",
  "public.virtualViewing.uploading": "Uploading…",
  "public.virtualViewing.finish": "Finish viewing",
  "public.virtualViewing.done":
    "Thank you! We have received your photos and are preparing your quote.",
  "public.virtualViewing.minPhotos": "Please upload at least one photo to continue.",
  "public.virtualViewing.noToken": "No token supplied.",
  "public.virtualViewing.sessionNotFound": "The viewing could not be found.",
  "public.virtualViewing.loadFailed": "The viewing could not be loaded.",
  "public.virtualViewing.invalidLinkTitle": "Invalid link",
  "public.virtualViewing.invalidLinkBody": "This link is not valid or no longer exists.",
  "public.virtualViewing.contactForNewLink": "Please contact the company for a new link.",
  "public.virtualViewing.contactCompanyForNewLink": "Please contact {company} for a new link.",
  "public.virtualViewing.expiredTitle": "Link expired",
  "public.virtualViewing.expiredBody": "Unfortunately this viewing link has expired.",
  "public.virtualViewing.completedTitle": "Viewing complete",
  "public.virtualViewing.completedBody": "Your virtual viewing has reached us safely.",
  "public.virtualViewing.completedNote":
    "{company} will review your photos and come back to you with an offer.",
  "public.virtualViewing.howItWorks": "How it works:",
  "public.virtualViewing.step.rooms": "Photograph every room in your home",
  "public.virtualViewing.step.furniture": "Show large and heavy furniture clearly",
  "public.virtualViewing.step.storage": "Do not forget the cellar, the attic and the garage",
  "public.virtualViewing.step.notes": "Add any further details at the end",
  "public.virtualViewing.selectRoom": "Choose a room",
  "public.virtualViewing.uploadFor": "Upload photos – {room}",
  "public.virtualViewing.notesTitle": "Further details (optional)",
  "public.virtualViewing.notesPlaceholder":
    "e.g. heavy piano in the living room, narrow staircase, third floor without a lift, parking far away…",
  "public.virtualViewing.photosUploaded": "{count} photos uploaded",
  "public.virtualViewing.photosUploaded#one": "{count} photo uploaded",
  "public.virtualViewing.photosUploaded#other": "{count} photos uploaded",
  "public.virtualViewing.roomsDocumented": "{done} of {total} rooms documented",
  "public.virtualViewing.toast.uploaded": "{file} uploaded",
  "public.virtualViewing.toast.uploadFailed": "{file} could not be uploaded.",
  "public.virtualViewing.toast.deleted": "Photo deleted",
  "public.virtualViewing.toast.deleteFailed": "The photo could not be deleted.",
  "public.virtualViewing.toast.completed": "Viewing complete!",
  "public.virtualViewing.toast.completeFailed": "The viewing could not be completed.",
};
