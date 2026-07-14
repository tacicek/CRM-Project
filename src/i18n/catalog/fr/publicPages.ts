import { publicPages as de } from "@/i18n/catalog/de/publicPages";

/**
 * Pages clients publiques, accessibles par jeton (src/pages/public/*).
 *
 * Affichées dans la langue du CLIENT, déterminée par le document auquel le lien
 * renvoie — jamais par le contexte du tableau de bord (aucun collaborateur n'est
 * connecté sur ces pages).
 *
 * UNE exception, délibérée : /termin/:id/antwort (RescheduleResponse) s'ouvre depuis
 * le lien contenu dans l'e-mail adressé à l'ENTREPRISE — c'est le collaborateur, et
 * non le client, qui y répond. Les clés `public.rescheduleResponse.*` s'adressent donc
 * à l'entreprise et suivent `companies.default_language`.
 */
export const publicPages: Record<keyof typeof de, string> = {
  // --- Éléments partagés -------------------------------------------------------------------
  "public.invalidLink": "Lien non valide. Merci d'utiliser le lien figurant dans votre e-mail.",
  "public.notFound": "Page introuvable",
  "public.loading": "Chargement…",
  "public.error": "Une erreur est survenue. Merci de réessayer un peu plus tard.",
  "public.expired": "Ce lien n'est plus valable.",
  "public.thanks": "Un grand merci !",
  "public.close": "Vous pouvez maintenant fermer cette fenêtre.",
  "public.reload": "Recharger la page",
  "public.processing": "Traitement en cours…",
  "public.messageOptional": "Message (facultatif)",

  // --- Vocabulaire commun des rendez-vous ------------------------------------------------
  "public.appointment.notFound": "Rendez-vous introuvable.",
  "public.appointment.notFoundOrEmailMismatch":
    "Rendez-vous introuvable ou adresse e-mail ne correspondant pas.",
  "public.appointment.addToCalendar": "Ajouter à mon agenda",
  "public.appointment.icsDescription": "Rendez-vous avec {company}",

  // --- Consultation du devis (/offerte/:token) -------------------------------------------------
  "public.offer.title": "Votre devis",
  "public.offer.pageTitle": "{title} | Devis de {company}",
  "public.offer.expired": "Ce devis n'est plus valable.",
  "public.offer.expiredWithDeadline":
    "Ce devis n'est plus valable (acceptation possible jusqu'au {date}).",
  "public.offer.validUntil": "Valable jusqu'au {date}",
  "public.offer.download": "Télécharger le devis en PDF",
  "public.offer.downloadChecklist": "Télécharger la check-list",
  "public.offer.accept": "Accepter le devis",
  "public.offer.reject": "Refuser le devis",
  "public.offer.rejectShort": "Refuser",
  "public.offer.accepted": "Vous avez accepté ce devis.",
  "public.offer.rejected": "Vous avez refusé ce devis.",
  "public.offer.acceptedOn": "Vous avez accepté ce devis le {date}.",
  "public.offer.rejectedOn": "Vous avez refusé ce devis le {date}.",
  "public.offer.acceptTitle": "Accepter le devis de manière ferme",
  "public.offer.acceptConfirm":
    "En acceptant ce devis, vous nous confiez fermement le mandat qui y est décrit.",
  "public.offer.acceptBinding": "Accepter fermement",
  "public.offer.rejectTitle": "Refuser le devis",
  "public.offer.rejectReason": "Souhaitez-vous nous en dire brièvement la raison ? (facultatif)",
  "public.offer.agbAccept": "J'ai lu les conditions générales (CG) et je les accepte.",
  "public.offer.agbRequired": "Merci d'accepter les conditions générales (CG) pour continuer.",
  "public.offer.agbTitle": "Conditions générales (CG)",
  "public.offer.requestViewing": "Demander une visite",
  "public.offer.requestViewingTitle": "Demander une visite gratuite",
  "public.offer.requestViewingSent":
    "Nous avons bien reçu votre demande. Nous revenons vers vous très prochainement.",
  "public.offer.questions": "Vous avez des questions ? Appelez-nous ou écrivez-nous.",
  "public.offer.acceptedThanks":
    "Merci beaucoup pour votre commande. Nous vous contactons sous peu pour la suite.",
  "public.offer.rejectedThanks":
    "Merci pour votre retour. C'est avec plaisir que nous vous soumettrons une nouvelle proposition.",

  // --- Consultation du devis : erreurs de chargement -------------------------------------------
  "public.offer.notFoundTitle": "Devis introuvable",
  "public.offer.notFoundBody": "Ce devis n'existe pas ou n'est plus disponible.",
  "public.offer.connectionErrorTitle": "Problème de connexion",
  "public.offer.connectionErrorBody":
    "Le devis n'a pas pu être chargé. Merci de vérifier votre connexion Internet et de réessayer.",

  // --- Consultation du devis : en-tête et informations -----------------------------------------
  "public.offer.website": "Site Internet",
  "public.offer.createdOn": "Devis établi le {date}",
  "public.offer.serviceDate": "Date d'exécution",

  // --- Consultation du devis : tableau des postes ----------------------------------------------
  "public.offer.positions": "Postes",
  "public.offer.col.pos": "Poste",
  "public.offer.col.description": "Désignation",
  "public.offer.col.quantity": "Quantité",
  "public.offer.col.unit": "Unité",
  "public.offer.col.price": "Prix",
  "public.offer.col.total": "Total",
  "public.offer.hoursRange": "{min}–{max} h",
  "public.offer.perHour": "{amount}/h",
  "public.offer.perUnit": "{amount} / {unit}",

  // --- Consultation du devis : check-list --------------------------------------------------------
  "public.offer.checklistBy": "Cette check-list a été préparée pour vous par {company}.",
  "public.offer.checklistPdf": "Check-list en PDF",

  // --- Consultation du devis : barre de réponse ---------------------------------------------------
  "public.offer.howRespond": "Quelle suite souhaitez-vous donner à ce devis ?",
  "public.offer.askQuestion": "Poser une question",
  "public.offer.contactFooter": "Pour toute question, merci de vous adresser à",

  // --- Consultation du devis : dialogue d'acceptation ----------------------------------------------
  "public.offer.acceptDialogBody":
    "Souhaitez-vous accepter fermement ce devis ? {company} sera informée de votre décision.",
  "public.offer.acceptNotePlaceholder": "Souhaitez-vous transmettre un message à l'entreprise ?",

  // --- Consultation du devis : dialogue de refus ----------------------------------------------------
  "public.offer.rejectDialogBody":
    "Souhaitez-vous refuser ce devis ? {company} sera informée de votre décision.",
  "public.offer.rejectReasonLabel": "Motif du refus (facultatif)",
  "public.offer.rejectNotePlaceholder":
    "Indiquez à l'entreprise pourquoi vous refusez ce devis…",

  // --- Consultation du devis : dialogue de question --------------------------------------------------
  "public.offer.contactDialogBody":
    "Vous avez une question au sujet de ce devis ? {company} reviendra vers vous.",
  "public.offer.contactLabel": "Votre question ou votre message *",
  "public.offer.contactPlaceholder": "Écrivez ici votre question ou votre message…",
  "public.offer.yourContactDetails": "Vos coordonnées :",
  "public.offer.sendMessage": "Envoyer le message",

  // --- Consultation du devis : dialogue de demande de visite -------------------------------------------
  "public.offer.viewingDialogBody":
    "Proposez une date pour une visite. {company} reviendra vers vous.",
  "public.offer.viewingDate": "Date souhaitée",
  "public.offer.viewingTime": "Heure souhaitée",
  "public.offer.viewingNotePlaceholder":
    "Y a-t-il quelque chose que nous devrions savoir avant la visite ?",
  "public.offer.viewingSubmit": "Proposer ce rendez-vous",
  // Enregistré dans offers.customer_response_note et lu par l'ENTREPRISE — donc rédigé
  // dans la langue de l'entreprise, et non dans celle du client.
  "public.offer.viewingRequestNote": "Visite souhaitée le {date}.",
  "public.offer.viewingRequestNoteTime": "Visite souhaitée le {date} à {time} h.",

  // --- Consultation du devis : notifications ------------------------------------------------------------
  "public.offer.toast.expiredTitle": "Délai d'acceptation dépassé",
  "public.offer.toast.expiredBody":
    "Ce devis ne peut plus être accepté. Merci de contacter l'entreprise.",
  "public.offer.toast.acceptedTitle": "Devis accepté",
  "public.offer.toast.acceptedBody": "Un grand merci ! L'entreprise a été informée.",
  "public.offer.toast.acceptedAgbBody":
    "Un grand merci ! Vous avez accepté le devis ainsi que les conditions générales. L'entreprise a été informée.",
  "public.offer.toast.saveFailed": "Votre réponse n'a pas pu être enregistrée.",
  "public.offer.toast.rejectedTitle": "Devis refusé",
  "public.offer.toast.rejectedBody": "L'entreprise a été informée de votre décision.",
  "public.offer.toast.messageRequired": "Merci de saisir un message.",
  "public.offer.toast.messageSentTitle": "Message envoyé",
  "public.offer.toast.messageSentBody":
    "L'entreprise a été informée de votre question et reviendra vers vous.",
  "public.offer.toast.messageFailed": "Le message n'a pas pu être envoyé.",
  "public.offer.toast.dateRequired": "Merci de choisir une date.",
  "public.offer.toast.viewingRequestedTitle": "Visite demandée",
  "public.offer.toast.viewingRequestedBody":
    "L'entreprise a été informée de la date que vous souhaitez.",
  "public.offer.toast.requestFailed": "Votre demande n'a pas pu être enregistrée.",

  // --- Annulation de rendez-vous (/termin/:id/absagen) ---------------------------------------
  "public.cancel.title": "Annuler le rendez-vous",
  "public.cancel.question": "Souhaitez-vous vraiment annuler ce rendez-vous ?",
  "public.cancel.reason": "Motif de l'annulation (facultatif)",
  "public.cancel.placeholder": "Indiquez-nous pourquoi vous devez annuler…",
  "public.cancel.submit": "Annuler le rendez-vous",
  "public.cancel.submitting": "Annulation en cours…",
  "public.cancel.done": "Votre rendez-vous a été annulé. Nous avons bien reçu votre annulation.",
  "public.cancel.doneTitle": "Rendez-vous annulé",
  "public.cancel.doneBody": "Le rendez-vous a bien été annulé. {company} en a été informée.",
  "public.cancel.alreadyCancelled": "Ce rendez-vous a déjà été annulé.",
  "public.cancel.companyInformed": "{company} sera informée de votre annulation.",
  "public.cancel.toastSuccess": "Rendez-vous annulé",
  "public.cancel.toastFailed": "Le rendez-vous n'a pas pu être annulé.",
  // Enregistré dans appointments.cancellation_reason et lu par l'ENTREPRISE — langue de l'entreprise.
  "public.cancel.defaultReason": "Annulé par le client",

  // --- Report de rendez-vous (/termin/:id/verschieben) ---------------------------------
  "public.reschedule.title": "Reporter le rendez-vous",
  "public.reschedule.intro": "Proposez-nous une nouvelle date de rendez-vous.",
  "public.reschedule.current": "Rendez-vous actuel",
  "public.reschedule.newDate": "Date souhaitée",
  "public.reschedule.pickNewDate": "Choisir une nouvelle date",
  "public.reschedule.newTime": "Heure souhaitée",
  "public.reschedule.pickTime": "Choisir une heure",
  "public.reschedule.pickDateTime": "Merci de choisir une date et une heure.",
  "public.reschedule.message": "Message (facultatif)",
  "public.reschedule.placeholder": "Indiquez-nous pourquoi vous souhaitez reporter…",
  "public.reschedule.submit": "Envoyer ma proposition",
  "public.reschedule.done":
    "Nous avons bien reçu votre proposition de rendez-vous. Nous vous la confirmons dans les meilleurs délais.",
  "public.reschedule.doneTitle": "Proposition envoyée",
  "public.reschedule.doneBody":
    "Votre proposition de rendez-vous a été transmise à {company}. Vous recevrez une confirmation par e-mail.",
  "public.reschedule.proposed": "Rendez-vous proposé",
  "public.reschedule.alreadyRequested": "Un report a déjà été demandé pour ce rendez-vous.",
  "public.reschedule.companyInformed":
    "{company} sera informée de votre proposition et reviendra vers vous.",
  "public.reschedule.toastSent": "Proposition envoyée",
  "public.reschedule.toastFailed": "Votre proposition n'a pas pu être envoyée.",

  // --- Réponse à un report (/termin/:id/antwort) — adressé à l'ENTREPRISE ---------------
  "public.rescheduleResponse.confirmTitle": "Confirmer le report du rendez-vous",
  "public.rescheduleResponse.rejectTitle": "Refuser le report du rendez-vous",
  "public.rescheduleResponse.confirmIntro": "Confirmez le nouveau rendez-vous pour ce client.",
  "public.rescheduleResponse.rejectIntro": "Refusez la demande de report.",
  "public.rescheduleResponse.originalAppointment": "Rendez-vous initial",
  "public.rescheduleResponse.proposedAppointment": "Nouveau rendez-vous proposé",
  "public.rescheduleResponse.newAppointment": "Nouveau rendez-vous",
  "public.rescheduleResponse.messageToCustomer": "Message au client (facultatif)",
  "public.rescheduleResponse.confirmPlaceholder": "Nous nous réjouissons de ce rendez-vous…",
  "public.rescheduleResponse.rejectPlaceholder":
    "Nous ne pouvons malheureusement pas retenir la date proposée…",
  "public.rescheduleResponse.confirmSubmit": "Confirmer le nouveau rendez-vous",
  "public.rescheduleResponse.rejectSubmit": "Refuser la demande",
  "public.rescheduleResponse.confirmedTitle": "Rendez-vous confirmé",
  "public.rescheduleResponse.rejectedTitle": "Demande refusée",
  "public.rescheduleResponse.confirmedBody":
    "Le nouveau rendez-vous a été confirmé. Le client en a été informé par e-mail.",
  "public.rescheduleResponse.rejectedBody":
    "La demande de report a été refusée. Le client en a été informé par e-mail.",
  "public.rescheduleResponse.alreadyHandled": "Ce rendez-vous a déjà été traité.",
  "public.rescheduleResponse.customerNotified":
    "Le client sera informé de votre décision par e-mail.",
  "public.rescheduleResponse.toastFailed": "La demande n'a pas pu être traitée.",

  // --- Choix d'une visite proposée (/besichtigung/:leadId/antwort) -----------------------
  "public.viewingProposal.title": "Dates proposées pour la visite",
  "public.viewingProposal.introCompany": "{company} vous propose les dates suivantes.",
  "public.viewingProposal.intro": "Merci de choisir l'une des dates proposées :",
  "public.viewingProposal.select": "Choisir ce rendez-vous",
  "public.viewingProposal.selectRequired": "Merci de choisir un rendez-vous.",
  "public.viewingProposal.none": "Aucune de ces dates ne me convient",
  "public.viewingProposal.confirmSubmit": "Confirmer le rendez-vous",
  "public.viewingProposal.messagePlaceholder":
    "Avez-vous des souhaits particuliers ou des remarques ?",
  "public.viewingProposal.companyNotified":
    "L'entreprise sera informée de votre décision par e-mail.",
  "public.viewingProposal.confirmedTitle": "Rendez-vous confirmé",
  "public.viewingProposal.confirmedBody":
    "Un grand merci ! {company} a été informée de votre confirmation.",
  "public.viewingProposal.rejectedTitle": "Dates refusées",
  "public.viewingProposal.rejectedBody": "{company} a été informée de votre refus.",
  "public.viewingProposal.yourAppointment": "Votre rendez-vous de visite",
  "public.viewingProposal.done":
    "Merci — nous avons bien reçu votre choix et vous confirmons le rendez-vous.",
  "public.viewingProposal.declined":
    "Merci pour votre retour. Nous revenons vers vous avec de nouvelles propositions de dates.",
  "public.viewingProposal.invalidProposals": "Dates proposées non valides.",
  "public.viewingProposal.parseError":
    "Les dates proposées n'ont pas pu être chargées. Merci d'utiliser à nouveau le lien figurant dans votre e-mail.",
  "public.viewingProposal.loadError": "Les dates proposées n'ont pas pu être chargées.",
  "public.viewingProposal.confirmFailed": "Le rendez-vous n'a pas pu être confirmé.",
  "public.viewingProposal.rejectFailed": "Votre refus n'a pas pu être envoyé.",

  // --- Visite virtuelle (/besichtigung/:token) -------------------------------------------
  "public.virtualViewing.title": "Visite virtuelle",
  "public.virtualViewing.intro":
    "Téléversez des photos des pièces concernées afin que nous puissions vous établir un devis précis.",
  "public.virtualViewing.addPhotos": "Ajouter des photos",
  "public.virtualViewing.room": "Pièce",
  "public.virtualViewing.uploading": "Téléversement en cours…",
  "public.virtualViewing.finish": "Terminer la visite",
  "public.virtualViewing.done":
    "Un grand merci ! Nous avons bien reçu vos photos et préparons votre devis.",
  "public.virtualViewing.minPhotos": "Merci de téléverser au moins une photo pour continuer.",
  "public.virtualViewing.noToken": "Aucun jeton fourni.",
  "public.virtualViewing.sessionNotFound": "La visite est introuvable.",
  "public.virtualViewing.loadFailed": "La visite n'a pas pu être chargée.",
  "public.virtualViewing.invalidLinkTitle": "Lien non valide",
  "public.virtualViewing.invalidLinkBody": "Ce lien n'est pas valide ou n'existe plus.",
  "public.virtualViewing.contactForNewLink":
    "Merci de contacter l'entreprise pour obtenir un nouveau lien.",
  "public.virtualViewing.contactCompanyForNewLink":
    "Merci de contacter {company} pour obtenir un nouveau lien.",
  "public.virtualViewing.expiredTitle": "Lien échu",
  "public.virtualViewing.expiredBody": "Ce lien de visite n'est malheureusement plus valable.",
  "public.virtualViewing.completedTitle": "Visite terminée",
  "public.virtualViewing.completedBody": "Votre visite virtuelle nous est bien parvenue.",
  "public.virtualViewing.completedNote":
    "{company} analysera vos photos et reviendra vers vous avec une offre.",
  "public.virtualViewing.howItWorks": "Comment procéder :",
  "public.virtualViewing.step.rooms": "Photographiez toutes les pièces de votre logement",
  "public.virtualViewing.step.furniture": "Montrez clairement les meubles volumineux et lourds",
  "public.virtualViewing.step.storage": "N'oubliez ni la cave, ni les combles, ni le garage",
  "public.virtualViewing.step.notes": "Ajoutez à la fin toute information complémentaire",
  "public.virtualViewing.selectRoom": "Choisir une pièce",
  "public.virtualViewing.uploadFor": "Téléverser des photos – {room}",
  "public.virtualViewing.notesTitle": "Informations complémentaires (facultatif)",
  "public.virtualViewing.notesPlaceholder":
    "p. ex. piano lourd au salon, escalier étroit, 3e étage sans ascenseur, place de parc éloignée…",
  "public.virtualViewing.photosUploaded": "{count} photos téléversées",
  "public.virtualViewing.photosUploaded#one": "{count} photo téléversée",
  "public.virtualViewing.photosUploaded#other": "{count} photos téléversées",
  "public.virtualViewing.roomsDocumented": "{done} pièce(s) documentée(s) sur {total}",
  "public.virtualViewing.toast.uploaded": "{file} téléversé",
  "public.virtualViewing.toast.uploadFailed": "{file} n'a pas pu être téléversé.",
  "public.virtualViewing.toast.deleted": "Photo supprimée",
  "public.virtualViewing.toast.deleteFailed": "La photo n'a pas pu être supprimée.",
  "public.virtualViewing.toast.completed": "Visite terminée !",
  "public.virtualViewing.toast.completeFailed": "La visite n'a pas pu être finalisée.",
};
