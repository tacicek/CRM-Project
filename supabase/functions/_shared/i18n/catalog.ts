/**
 * Trilingual message catalog for CUSTOMER-FACING copy (emails + SMS).
 *
 * Rules:
 *  - German (`de`) is the source of truth for the key set. `fr` and `en` are typed
 *    as Record<MessageKey, string>, so a missing/extra key is a compile error.
 *  - Keys are flat and dotted. Interpolation tokens are `{placeholder}` and MUST be
 *    preserved verbatim across all three languages.
 *  - Register: formal Swiss business. FR uses vouvoiement. EN is British business English.
 *  - Company-internal copy (firma notification halves, admin summaries, CRM notes)
 *    is intentionally NOT in this catalog — it stays German.
 *
 * Glossary: Offerte → Devis / Quote · Rechnung → Facture / Invoice ·
 *           Quittung → Reçu / Receipt · Besichtigung → Visite / Viewing ·
 *           Termin → Rendez-vous / Appointment.
 */

export const de = {
  // ---------------------------------------------------------------------------
  // common — shared fragments, labels and salutations
  // ---------------------------------------------------------------------------
  "common.greeting": "Guten Tag {name},",
  "common.greetingPlain": "Guten Tag,",
  "common.regards": "Mit freundlichen Grüssen",
  "common.regardsFriendly": "Freundliche Grüsse",
  "common.teamSignature": "Ihr {appName} Team",
  "common.autoSent": "Diese E-Mail wurde automatisch versendet.",
  "common.autoSentBy": "Diese E-Mail wurde automatisch von {sender} gesendet.",
  "common.autoReminderSent": "Diese Erinnerung wurde automatisch versendet.",
  "common.copyright": "© {year} {appName}",
  "common.customer": "Kunde",
  "common.company": "Firma",
  "common.provider": "Anbieter",
  "common.date": "Datum",
  "common.time": "Uhrzeit",
  "common.dateAndTime": "Datum & Uhrzeit",
  "common.sentAt": "Gesendet am",
  "common.email": "E-Mail",
  "common.phone": "Telefon",
  "common.address": "Adresse",
  "common.destinationAddress": "Zieladresse",
  "common.location": "Ort",
  "common.from": "Von",
  "common.to": "Nach",
  "common.type": "Typ",
  "common.note": "Hinweis",
  "common.message": "Nachricht",
  "common.messageFrom": "Nachricht von {name}",
  "common.offer": "Offerte",
  "common.appointment": "Termin",
  "common.appointmentDetails": "Termindetails",
  "common.allDay": "Ganztägig",
  "common.timeRange": "{start} – {end} Uhr",
  "common.timeValue": "{time} Uhr",
  "common.timeAt": "um {time} Uhr",
  "common.attachments": "Anhänge",
  "common.notSpecified": "-",

  // ---------------------------------------------------------------------------
  // service.* — service type labels (mirrors _shared/serviceLabels.ts key set)
  // ---------------------------------------------------------------------------
  "service.umzug": "Umzug",
  "service.umzug_privat": "Privatumzug",
  "service.umzug_firma": "Firmenumzug",
  "service.umzug_buero": "Büroumzug",
  "service.umzug_international": "Internationaler Umzug",
  "service.privatumzug": "Privatumzug",
  "service.firmenumzug": "Firmenumzug",
  "service.bueroumzug": "Büroumzug",
  "service.seniorenumzug": "Seniorenumzug",
  "service.studentenumzug": "Studentenumzug",
  "service.reinigung": "Reinigung",
  "service.reinigung_end": "Reinigungsanfrage",
  "service.reinigung_grund": "Grundreinigung",
  "service.reinigung_fenster": "Fensterreinigung",
  "service.endreinigung": "Endreinigung",
  "service.grundreinigung": "Grundreinigung",
  "service.unterhaltsreinigung": "Unterhaltsreinigung",
  "service.uebergabereinigung": "Übergabereinigung",
  "service.baureinigung": "Baureinigung",
  "service.buroreinigung": "Büroreinigung",
  "service.raeumung": "Räumung",
  "service.raeumung_wohnung": "Wohnungsräumung",
  "service.raeumung_haus": "Hausräumung",
  "service.raeumung_keller": "Kellerräumung",
  "service.raeumung_dachboden": "Dachbodenräumung",
  "service.kellerraeumung": "Kellerräumung",
  "service.wohnungsraeumung": "Wohnungsräumung",
  "service.hausraeumung": "Hausräumung",
  "service.estrichraeumung": "Estrichräumung",
  "service.nachlassraeumung": "Nachlassräumung",
  "service.messieraeumung": "Messie-Räumung",
  "service.klaviertransport": "Klaviertransport",
  "service.klaviertransport_transport": "Klaviertransport",
  "service.klaviertransport_storage": "Klaviereinlagerung",
  "service.klaviertransport_disposal": "Klavierentsorgung",
  "service.klaviertransport_internal_move": "Klavierumstellung",
  "service.entsorgung": "Entsorgung",
  "service.entsorgung_moebel": "Möbelentsorgung",
  "service.entsorgung_elektro": "Elektroentsorgung",
  "service.entsorgung_sperrgut": "Sperrgutentsorgung",
  "service.lagerung": "Lagerung",
  "service.lagerung_einlagerung": "Einlagerung",
  "service.lagerung_zwischenlagerung": "Zwischenlagerung",
  "service.lagerung_selfstorage": "Self-Storage",
  "service.moebellift": "Möbellift",
  "service.moebellift_mieten": "Möbellift mieten",
  "service.moebellift_service": "Möbellift-Service",
  "service.moebeltransport": "Möbeltransport",
  "service.transport_moebel": "Möbeltransport",
  "service.spezialtransport": "Spezialtransport",
  "service.renovation": "Renovation",
  "service.malerarbeiten": "Malerarbeiten",
  "service.malerarbeit": "Malerarbeiten",

  // ---------------------------------------------------------------------------
  // appointmentType.* — appointment type labels
  // ---------------------------------------------------------------------------
  "appointmentType.besichtigung": "Besichtigung",
  "appointmentType.service": "Auftrag",
  "appointmentType.follow_up": "Nachkontrolle",
  "appointmentType.meeting": "Besprechung",
  "appointmentType.blocked": "Blockiert",

  // ---------------------------------------------------------------------------
  // email.offer.* — send-offer (customer email)
  // ---------------------------------------------------------------------------
  "email.offer.subject": "Ihre Offerte von {companyName} – Nr. {offerNumber}",
  "email.offer.documentTitle": "Ihre Offerte von {companyName}",
  "email.offer.headerTitle": "Ihre Offerte",
  "email.offer.headerFrom": "von {companyName}",
  "email.offer.intro":
    "vielen Dank für Ihre Anfrage. Anbei erhalten Sie unsere Offerte für die gewünschten Leistungen.",
  "email.offer.attachmentsNote": "Im Anhang dieser E-Mail finden Sie {list}.",
  "email.offer.attachmentOfferPdf": "die Offerte als PDF",
  "email.offer.attachmentAgb": "unsere AGB",
  "email.offer.attachmentChecklist": "eine hilfreiche Checkliste zur Vorbereitung",
  "email.offer.attachmentConjunction": "und",
  "email.offer.serviceDate": "Ausführungsdatum",
  "email.offer.validUntil": "Gültig bis",
  "email.offer.itemsHeading": "Leistungspositionen",
  "email.offer.itemPosition": "Pos.",
  "email.offer.itemQuantity": "Menge",
  "email.offer.itemPrice": "Preis",
  "email.offer.itemRate": "Ansatz",
  "email.offer.itemTotal": "Total",
  "email.offer.itemIncluded": "INKLUSIVE",
  "email.offer.itemOnDemand": "nach Aufwand",
  "email.offer.unitPiece": "Stk.",
  "email.offer.unitHour": "Std.",
  "email.offer.timeEstimate": "{minHours} – {maxHours} Std. × {rate} / Std.",
  "email.offer.kostendachLabel": "Kostendach",
  "email.offer.kostendachValue": "max. {amount}",
  "email.offer.kostendachHours": "({hours} Std)",
  "email.offer.kostendachExplain":
    "Sie zahlen maximal diesen Betrag, unabhängig vom tatsächlichen Zeitaufwand.",
  "email.offer.subtotal": "Zwischensumme",
  "email.offer.surchargeDefault": "Zuschlag",
  "email.offer.discount": "Rabatt {percent} %",
  "email.offer.netTotal": "Total exkl. MwSt",
  "email.offer.vat": "MwSt. ({rate}%)",
  "email.offer.total": "Total",
  "email.offer.rateAggregateNote":
    "Der Gesamtpreis ergibt sich aus den Positionen nach Aufwand (siehe Details oben) zzgl. allfälliger Fixpositionen.",
  "email.offer.blindNote":
    "Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung. Preise sind Schätzungen und können nach Besichtigung angepasst werden.",
  "email.offer.priceModelHourlyTitle": "Preismodell: Stundenansatz",
  "email.offer.priceModelHourlyRate": "CHF {rate} / Std.",
  "email.offer.priceModelHourlyNote":
    "Die Abrechnung erfolgt nach effektivem Zeitaufwand zum angegebenen Stundenansatz. Der Endpreis ergibt sich aus den tatsächlich geleisteten Stunden.",
  "email.offer.priceModelKostendachTitle": "Preismodell: Stundenansatz mit Kostendach",
  "email.offer.priceModelKostendachRate":
    "CHF {rate} / Std. | Kostendach: max. CHF {max}",
  "email.offer.priceModelKostendachNote":
    "Sie zahlen maximal CHF {max}, unabhängig vom tatsächlichen Zeitaufwand.",
  "email.offer.paymentTermsLabel": "Zahlungskondition",
  "email.offer.cta": "Offerte ansehen & beantworten",
  "email.offer.ctaFallback": "oder kopieren Sie diesen Link:",

  // ---------------------------------------------------------------------------
  // email.leadConfirmation.* — send-lead-confirmation
  // ---------------------------------------------------------------------------
  "email.leadConfirmation.subject": "Ihre Anfrage für {service} wurde erfolgreich gesendet",
  "email.leadConfirmation.headerTitle": "Anfrage erfolgreich gesendet",
  "email.leadConfirmation.intro":
    "Vielen Dank für Ihre Anfrage bei {appName}. Wir haben Ihre Anfrage für {service} {location} erhalten.",
  "email.leadConfirmation.locationFromTo": "von {fromCity} nach {toCity}",
  "email.leadConfirmation.locationIn": "in {fromCity}",
  "email.leadConfirmation.nextStepsTitle": "Was passiert als Nächstes?",
  "email.leadConfirmation.step1":
    "Wir prüfen Ihre Anfrage und leiten sie an passende Unternehmen weiter (bis zu {maxCompanies}).",
  "email.leadConfirmation.step2": "Die Firmen melden sich bei Ihnen",
  "email.leadConfirmation.step3": "Sie erhalten unverbindliche Offerten",
  "email.leadConfirmation.step4": "Sie entscheiden frei",
  "email.leadConfirmation.help": "Bei Fragen helfen wir gerne weiter.",

  // ---------------------------------------------------------------------------
  // email.invoice.* — shared invoice/receipt body (_shared/invoiceEmailTemplate.ts)
  // ---------------------------------------------------------------------------
  "email.invoice.subject": "Ihre {documentTitle} von {companyName} – {documentNumber}",
  "email.invoice.colDescription": "Beschreibung",
  "email.invoice.colAmount": "Betrag",
  "email.invoice.subtotal": "Zwischensumme",
  "email.invoice.discount": "Rabatt",
  "email.invoice.vat": "MwSt. ({rate}%)",
  "email.invoice.ibanLabel": "IBAN",
  "email.invoice.vatNumberLabel": "MwSt-Nr.",

  // ---------------------------------------------------------------------------
  // email.quittung.* — send-quittung (customer half)
  // ---------------------------------------------------------------------------
  "email.quittung.documentLabel": "Quittung",
  "email.quittung.intro":
    "Vielen Dank für Ihren Auftrag. Anbei finden Sie Ihre Quittung im Anhang.",
  "email.quittung.detailLabel": "Satz",
  "email.quittung.totalLabel": "Gesamttotal",
  "email.quittung.outstandingNotice":
    "Betrag noch offen – Bitte begleichen Sie den ausstehenden Betrag.",

  // ---------------------------------------------------------------------------
  // email.rechnung.* — send-rechnung-email (customer)
  // ---------------------------------------------------------------------------
  "email.rechnung.documentLabel": "Rechnung",
  "email.rechnung.intro":
    "Anbei erhalten Sie Ihre Rechnung mit QR-Zahlteil im PDF-Anhang.",
  "email.rechnung.detailLabel": "Menge",
  "email.rechnung.totalLabel": "Total",
  "email.rechnung.payableBy": "Zahlbar bis {date}",
  "email.rechnung.referenceLabel": "Referenz",

  // ---------------------------------------------------------------------------
  // email.appointmentConfirmation.* — send-appointment-confirmation
  // ---------------------------------------------------------------------------
  "email.appointmentConfirmation.subject": "Terminbestätigung: {type} am {date}",
  "email.appointmentConfirmation.headerTitle": "Terminbestätigung: {type}",
  "email.appointmentConfirmation.intro":
    "{companyName} hat folgenden Termin für Sie eingetragen:",
  "email.appointmentConfirmation.cancelNote":
    "Falls Sie den Termin nicht wahrnehmen können, kontaktieren Sie bitte rechtzeitig {companyName}.",
  "email.appointmentConfirmation.cancelNoteWithPhone":
    "Falls Sie den Termin nicht wahrnehmen können, kontaktieren Sie bitte rechtzeitig {companyName} unter {phone}.",

  // ---------------------------------------------------------------------------
  // email.besichtigungConfirmed.* — confirm-besichtigung / generateConfirmationEmail
  // ---------------------------------------------------------------------------
  "email.besichtigungConfirmed.subject":
    "Ihr Besichtigungstermin am {date} wurde bestätigt",
  "email.besichtigungConfirmed.headerTitle": "Besichtigungstermin bestätigt",
  "email.besichtigungConfirmed.intro":
    "Ihr Besichtigungstermin wurde von {companyName} bestätigt.",
  "email.besichtigungConfirmed.slotTitle": "Bestätigter Termin",
  "email.besichtigungConfirmed.noticeTitle": "Bitte beachten Sie:",
  "email.besichtigungConfirmed.noticeBody":
    "Falls Sie den Termin nicht wahrnehmen können, kontaktieren Sie bitte rechtzeitig {companyName}.",

  // ---------------------------------------------------------------------------
  // email.besichtigungProposal.* — confirm-besichtigung / generateProposalEmail
  // ---------------------------------------------------------------------------
  "email.besichtigungProposal.subject":
    "{companyName} hat Ihnen Terminvorschläge gesendet",
  "email.besichtigungProposal.headerTitle": "Terminvorschläge für Ihre Besichtigung",
  "email.besichtigungProposal.intro":
    "{companyName} hat Ihnen folgende Terminvorschläge für eine Besichtigung gesendet:",
  "email.besichtigungProposal.cta": "Termin auswählen",
  "email.besichtigungProposal.ctaHint":
    "Klicken Sie auf den Button, um Ihren Wunschtermin auszuwählen.",
  "email.besichtigungProposal.urgencyTitle": "Bitte antworten Sie zeitnah",
  "email.besichtigungProposal.urgencyBody":
    "Damit wir den Termin für Sie reservieren können, bitten wir Sie, uns Ihre Auswahl so bald wie möglich mitzuteilen.",

  // ---------------------------------------------------------------------------
  // email.proposalAccepted.* — handle-proposal-response (customer half)
  // ---------------------------------------------------------------------------
  "email.proposalAccepted.subject": "Ihr Besichtigungstermin bei {companyName}",
  "email.proposalAccepted.headerTitle": "Termin bestätigt",
  "email.proposalAccepted.intro": "Ihr Besichtigungstermin wurde erfolgreich bestätigt.",
  "email.proposalAccepted.closing": "Wir freuen uns auf Ihren Besuch!",

  // ---------------------------------------------------------------------------
  // email.rescheduleConfirmed.* — handle-reschedule-response (action=confirm)
  // ---------------------------------------------------------------------------
  "email.rescheduleConfirmed.subject": "Termin bestätigt: {title}",
  "email.rescheduleConfirmed.headerTitle": "Termin bestätigt!",
  "email.rescheduleConfirmed.headerSubtitle": "Ihr neuer Termin wurde akzeptiert",
  "email.rescheduleConfirmed.intro":
    "Tolle Neuigkeiten! {companyName} hat Ihren Terminvorschlag akzeptiert.",
  "email.rescheduleConfirmed.newAppointmentLabel": "Ihr neuer Termin",
  "email.rescheduleConfirmed.outro":
    "Bitte erscheinen Sie pünktlich zum Termin. Bei Fragen können Sie sich jederzeit an {companyName} wenden.",

  // ---------------------------------------------------------------------------
  // email.rescheduleRejected.* — handle-reschedule-response (action=reject)
  // ---------------------------------------------------------------------------
  "email.rescheduleRejected.subject": "Terminvorschlag nicht möglich: {title}",
  "email.rescheduleRejected.headerTitle": "Terminvorschlag nicht möglich",
  "email.rescheduleRejected.headerSubtitle":
    "Leider konnte Ihr Vorschlag nicht angenommen werden",
  "email.rescheduleRejected.intro":
    "Leider kann {companyName} Ihren vorgeschlagenen Termin am {date} um {time} Uhr nicht annehmen.",
  "email.rescheduleRejected.optionsTitle": "Was können Sie tun?",
  "email.rescheduleRejected.option1":
    "Kontaktieren Sie {companyName} direkt, um einen alternativen Termin zu finden",
  "email.rescheduleRejected.option2": "Der ursprüngliche Termin bleibt vorerst bestehen",

  // ---------------------------------------------------------------------------
  // email.rescheduleRequestSent.* — notify-appointment-reschedule (customer half)
  // ---------------------------------------------------------------------------
  "email.rescheduleRequestSent.subject": "Terminvorschlag gesendet: {title}",
  "email.rescheduleRequestSent.headerTitle": "Terminvorschlag gesendet",
  "email.rescheduleRequestSent.headerSubtitle":
    "Ihr Verschiebungswunsch wurde übermittelt",
  "email.rescheduleRequestSent.intro":
    "Ihr Terminvorschlag wurde erfolgreich an {companyName} gesendet.",
  "email.rescheduleRequestSent.proposedLabel": "Ihr vorgeschlagener Termin",
  "email.rescheduleRequestSent.outro":
    "{companyName} wird sich bei Ihnen melden, um den Termin zu bestätigen oder einen alternativen Vorschlag zu machen.",
  "email.rescheduleRequestSent.footer":
    "Bei Fragen können Sie sich direkt an {companyName} wenden.",

  // ---------------------------------------------------------------------------
  // email.appointmentCancelled.* — notify-appointment-cancelled (customer half)
  // ---------------------------------------------------------------------------
  "email.appointmentCancelled.subject": "Terminabsage bestätigt – {title}",
  "email.appointmentCancelled.headerTitle": "Absage bestätigt",
  "email.appointmentCancelled.intro":
    "Ihre Terminabsage wurde erfolgreich verarbeitet und {companyName} wurde benachrichtigt.",
  "email.appointmentCancelled.cancelledTitle": "Abgesagter Termin:",
  "email.appointmentCancelled.outro":
    "Falls Sie einen neuen Termin vereinbaren möchten, kontaktieren Sie bitte {companyName} direkt.",

  // ---------------------------------------------------------------------------
  // email.besichtigungRequest.* — notify-besichtigung (customerEmailHtml)
  // ---------------------------------------------------------------------------
  "email.besichtigungRequest.subject":
    "Ihre Besichtigungsanfrage bei {companyName} wurde erhalten",
  "email.besichtigungRequest.headerTitle": "Besichtigungsanfrage erhalten",
  "email.besichtigungRequest.intro":
    "vielen Dank für Ihre Besichtigungsanfrage. Wir haben diese erfolgreich erhalten und weitergeleitet.",
  "email.besichtigungRequest.slotTitle": "Ihr gewünschter Termin",
  "email.besichtigungRequest.offerAmount": "Offertenbetrag",
  "email.besichtigungRequest.nextStepsTitle": "Nächste Schritte:",
  "email.besichtigungRequest.nextStepsBody":
    "{companyName} wird sich in Kürze bei Ihnen melden, um den Besichtigungstermin zu bestätigen oder einen alternativen Termin vorzuschlagen.",

  // ---------------------------------------------------------------------------
  // email.reminder.* — notify-appointment-reminder (customer variants)
  // ---------------------------------------------------------------------------
  "email.reminder.minutes": "{count} Minuten",
  "email.reminder.hours": "{count} Stunden",

  "email.reminder.dayBefore.subject": "Erinnerung: Ihre Besichtigung ist morgen",
  "email.reminder.dayBefore.headerTitle": "Besichtigung morgen",
  "email.reminder.dayBefore.headerSubtitle": "Erinnerung für den morgigen Termin",
  "email.reminder.dayBefore.intro":
    "dies ist eine freundliche Erinnerung an Ihre Besichtigung morgen:",
  "email.reminder.dayBefore.tipLabel": "Tipp:",
  "email.reminder.dayBefore.tip":
    "Halten Sie bitte relevante Unterlagen bereit und stellen Sie sicher, dass der Zugang zum Objekt gewährleistet ist.",

  "email.reminder.oneHour.subject": "Letzte Erinnerung: {title} in {timeUntil}",
  "email.reminder.oneHour.headerTitle": "Letzte Erinnerung",
  "email.reminder.oneHour.headerSubtitle": "Ihr Termin beginnt in {timeUntil}",
  "email.reminder.oneHour.intro":
    "Ihr Termin beginnt in Kürze. Bitte stellen Sie sicher, dass Sie bereit sind.",
  "email.reminder.oneHour.actionsTitle": "Können Sie den Termin nicht wahrnehmen?",
  "email.reminder.oneHour.rescheduleCta": "Termin verschieben",
  "email.reminder.oneHour.cancelCta": "Termin absagen",
  "email.reminder.oneHour.actionsNote": "Die Firma wird automatisch benachrichtigt.",

  "email.reminder.customer.subject": "Termin-Erinnerung: {title} in {timeUntil}",
  "email.reminder.customer.headerTitle": "Termin-Erinnerung",
  "email.reminder.customer.headerSubtitle": "Ihr Termin beginnt in {timeUntil}",
  "email.reminder.customer.intro":
    "dies ist eine freundliche Erinnerung an Ihren bevorstehenden Termin:",
  "email.reminder.customer.footerHelp":
    "Bei Fragen wenden Sie sich bitte direkt an die Firma.",

  // ---------------------------------------------------------------------------
  // email.auftragReminder.* — notify-auftrag-reminder (generateCustomerEmailHtml)
  // ---------------------------------------------------------------------------
  "email.auftragReminder.subject": "Erinnerung: Ihr Termin am {date} – {companyName}",
  "email.auftragReminder.headerTitle": "Ihr Termin steht bevor",
  "email.auftragReminder.intro":
    "wir möchten Sie an Ihren bevorstehenden Termin erinnern:",
  "email.auftragReminder.timeTbd": "Wird noch bekannt gegeben",
  "email.auftragReminder.outro":
    "Bitte stellen Sie sicher, dass alles für den Termin vorbereitet ist. Bei Fragen oder Änderungen kontaktieren Sie uns bitte rechtzeitig.",

  // ---------------------------------------------------------------------------
  // email.doubleOptIn.* — validate-lead-quality (sendDoubleOptInEmail)
  // ---------------------------------------------------------------------------
  "email.doubleOptIn.subject": "Bitte bestätigen Sie Ihre Anfrage",
  "email.doubleOptIn.headerTitle": "Bitte bestätigen Sie Ihre Anfrage",
  "email.doubleOptIn.intro":
    "wir haben Ihre Anfrage erhalten. Zum Schutz vor Missbrauch benötigen wir eine kurze Bestätigung, dass diese Anfrage wirklich von Ihnen stammt.",
  "email.doubleOptIn.introWithService":
    "wir haben Ihre Anfrage erhalten ({service}). Zum Schutz vor Missbrauch benötigen wir eine kurze Bestätigung, dass diese Anfrage wirklich von Ihnen stammt.",
  "email.doubleOptIn.prompt":
    "Bitte klicken Sie auf den folgenden Button, um Ihre Anfrage zu aktivieren:",
  "email.doubleOptIn.cta": "Anfrage bestätigen",
  "email.doubleOptIn.linkFallback":
    "Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:",
  "email.doubleOptIn.expiry":
    "Der Link ist 48 Stunden gültig. Haben Sie keine Anfrage gestellt, ignorieren Sie diese E-Mail.",

  // ---------------------------------------------------------------------------
  // sms.* — notify-appointment-reminder (Twilio SMS bodies)
  // ---------------------------------------------------------------------------
  "sms.reminder.oneHour": "⏰ Erinnerung: {title} in {timeUntil}. Ort: {location}. {companyName}",
  "sms.reminder.twoHour":
    "Erinnerung: {title} in {timeUntil}. {date} um {time} Uhr. {companyName}",
  "sms.reminder.dayBefore":
    "📅 Erinnerung: {title} ist morgen um {time} Uhr. {location}. {companyName}",

  // ---------------------------------------------------------------------------
  // email.resend.* — resend-email (generic retry body)
  // ---------------------------------------------------------------------------
  "email.resend.subjectPrefix": "[Erneut gesendet] {subject}",
  "email.resend.headerTitle": "Erneut gesendet",
  "email.resend.intro":
    "Diese E-Mail wurde erneut an Sie gesendet, da die ursprüngliche Zustellung fehlgeschlagen ist.",
  "email.resend.originalSubjectLabel": "Ursprünglicher Betreff",
  "email.resend.details":
    "Bitte melden Sie sich in Ihrem Konto an, um weitere Details zu sehen, oder kontaktieren Sie uns bei Fragen.",
  "email.resend.help": "Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
  "email.resend.autoGenerated": "Diese E-Mail wurde automatisch generiert.",

  // ---------------------------------------------------------------------------
  // error.* / validation.* — API responses the CUSTOMER sees (public endpoints).
  // send-lead-confirmation is called straight from the public request wizard, so its
  // 400/429 payloads are customer-facing copy, not internal log text.
  // ---------------------------------------------------------------------------
  "error.invalidInput": "Ungültige Eingabedaten",
  "error.rateLimited": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
  "validation.firstNameRequired": "Vorname erforderlich",
  "validation.lastNameRequired": "Nachname erforderlich",
  "validation.emailInvalid": "Ungültige E-Mail-Adresse",
  "validation.serviceTypeRequired": "Service-Typ erforderlich",
  "validation.cityRequired": "Stadt erforderlich",
} as const;

/** Every valid message key. German is the source of truth. */
export type MessageKey = keyof typeof de;

export const fr: Record<MessageKey, string> = {
  // common
  "common.greeting": "Bonjour {name},",
  "common.greetingPlain": "Bonjour,",
  "common.regards": "Avec nos salutations distinguées",
  "common.regardsFriendly": "Cordialement",
  "common.teamSignature": "Votre équipe {appName}",
  "common.autoSent": "Cet e-mail a été envoyé automatiquement.",
  "common.autoSentBy": "Cet e-mail a été envoyé automatiquement par {sender}.",
  "common.autoReminderSent": "Ce rappel a été envoyé automatiquement.",
  "common.copyright": "© {year} {appName}",
  "common.customer": "Client",
  "common.company": "Entreprise",
  "common.provider": "Prestataire",
  "common.date": "Date",
  "common.time": "Heure",
  "common.dateAndTime": "Date et heure",
  "common.sentAt": "Envoyé le",
  "common.email": "E-mail",
  "common.phone": "Téléphone",
  "common.address": "Adresse",
  "common.destinationAddress": "Adresse de destination",
  "common.location": "Lieu",
  "common.from": "De",
  "common.to": "À",
  "common.type": "Type",
  "common.note": "Remarque",
  "common.message": "Message",
  "common.messageFrom": "Message de {name}",
  "common.offer": "Devis",
  "common.appointment": "Rendez-vous",
  "common.appointmentDetails": "Détails du rendez-vous",
  "common.allDay": "Toute la journée",
  "common.timeRange": "{start} – {end}",
  "common.timeValue": "{time}",
  "common.timeAt": "à {time}",
  "common.attachments": "Pièces jointes",
  "common.notSpecified": "-",

  // service
  "service.umzug": "Déménagement",
  "service.umzug_privat": "Déménagement privé",
  "service.umzug_firma": "Déménagement d'entreprise",
  "service.umzug_buero": "Déménagement de bureaux",
  "service.umzug_international": "Déménagement international",
  "service.privatumzug": "Déménagement privé",
  "service.firmenumzug": "Déménagement d'entreprise",
  "service.bueroumzug": "Déménagement de bureaux",
  "service.seniorenumzug": "Déménagement pour seniors",
  "service.studentenumzug": "Déménagement étudiant",
  "service.reinigung": "Nettoyage",
  "service.reinigung_end": "Demande de nettoyage",
  "service.reinigung_grund": "Nettoyage en profondeur",
  "service.reinigung_fenster": "Nettoyage de vitres",
  "service.endreinigung": "Nettoyage de fin de bail",
  "service.grundreinigung": "Nettoyage en profondeur",
  "service.unterhaltsreinigung": "Nettoyage d'entretien",
  "service.uebergabereinigung": "Nettoyage de remise",
  "service.baureinigung": "Nettoyage de chantier",
  "service.buroreinigung": "Nettoyage de bureaux",
  "service.raeumung": "Débarras",
  "service.raeumung_wohnung": "Débarras d'appartement",
  "service.raeumung_haus": "Débarras de maison",
  "service.raeumung_keller": "Débarras de cave",
  "service.raeumung_dachboden": "Débarras de combles",
  "service.kellerraeumung": "Débarras de cave",
  "service.wohnungsraeumung": "Débarras d'appartement",
  "service.hausraeumung": "Débarras de maison",
  "service.estrichraeumung": "Débarras de galetas",
  "service.nachlassraeumung": "Débarras de succession",
  "service.messieraeumung": "Débarras de logement encombré",
  "service.klaviertransport": "Transport de piano",
  "service.klaviertransport_transport": "Transport de piano",
  "service.klaviertransport_storage": "Entreposage de piano",
  "service.klaviertransport_disposal": "Élimination de piano",
  "service.klaviertransport_internal_move": "Déplacement de piano sur place",
  "service.entsorgung": "Élimination des déchets",
  "service.entsorgung_moebel": "Élimination de meubles",
  "service.entsorgung_elektro": "Élimination d'appareils électriques",
  "service.entsorgung_sperrgut": "Élimination d'objets encombrants",
  "service.lagerung": "Entreposage",
  "service.lagerung_einlagerung": "Mise en garde-meubles",
  "service.lagerung_zwischenlagerung": "Entreposage temporaire",
  "service.lagerung_selfstorage": "Self-stockage",
  "service.moebellift": "Monte-meubles",
  "service.moebellift_mieten": "Location de monte-meubles",
  "service.moebellift_service": "Service de monte-meubles",
  "service.moebeltransport": "Transport de meubles",
  "service.transport_moebel": "Transport de meubles",
  "service.spezialtransport": "Transport spécial",
  "service.renovation": "Rénovation",
  "service.malerarbeiten": "Travaux de peinture",
  "service.malerarbeit": "Travaux de peinture",

  // appointmentType
  "appointmentType.besichtigung": "Visite",
  "appointmentType.service": "Mandat",
  "appointmentType.follow_up": "Contrôle de suivi",
  "appointmentType.meeting": "Entretien",
  "appointmentType.blocked": "Bloqué",

  // email.offer
  "email.offer.subject": "Votre devis de {companyName} – n° {offerNumber}",
  "email.offer.documentTitle": "Votre devis de {companyName}",
  "email.offer.headerTitle": "Votre devis",
  "email.offer.headerFrom": "de {companyName}",
  "email.offer.intro":
    "nous vous remercions de votre demande. Vous trouverez ci-joint notre devis pour les prestations souhaitées.",
  "email.offer.attachmentsNote": "Vous trouverez en pièce jointe de cet e-mail {list}.",
  "email.offer.attachmentOfferPdf": "le devis au format PDF",
  "email.offer.attachmentAgb": "nos conditions générales",
  "email.offer.attachmentChecklist": "une check-list utile pour votre préparation",
  "email.offer.attachmentConjunction": "et",
  "email.offer.serviceDate": "Date d'exécution",
  "email.offer.validUntil": "Valable jusqu'au",
  "email.offer.itemsHeading": "Postes de prestation",
  "email.offer.itemPosition": "Poste",
  "email.offer.itemQuantity": "Quantité",
  "email.offer.itemPrice": "Prix",
  "email.offer.itemRate": "Tarif",
  "email.offer.itemTotal": "Total",
  "email.offer.itemIncluded": "INCLUS",
  "email.offer.itemOnDemand": "selon dépense effective",
  "email.offer.unitPiece": "pce",
  "email.offer.unitHour": "h",
  "email.offer.timeEstimate": "{minHours} – {maxHours} h × {rate} / h",
  "email.offer.kostendachLabel": "Plafond de coûts",
  "email.offer.kostendachValue": "max. {amount}",
  "email.offer.kostendachHours": "({hours} h)",
  "email.offer.kostendachExplain":
    "Vous ne payez au maximum que ce montant, indépendamment du temps effectivement consacré.",
  "email.offer.subtotal": "Sous-total",
  "email.offer.surchargeDefault": "Supplément",
  "email.offer.discount": "Rabais {percent} %",
  "email.offer.netTotal": "Total hors TVA",
  "email.offer.vat": "TVA ({rate} %)",
  "email.offer.total": "Total",
  "email.offer.rateAggregateNote":
    "Le prix total résulte des postes facturés selon la dépense effective (voir détails ci-dessus), majorés des éventuels postes forfaitaires.",
  "email.offer.blindNote":
    "Ce devis repose sur les indications du client, sans visite sur place. Les prix sont des estimations et peuvent être adaptés après une visite.",
  "email.offer.priceModelHourlyTitle": "Modèle tarifaire : tarif horaire",
  "email.offer.priceModelHourlyRate": "CHF {rate} / h",
  "email.offer.priceModelHourlyNote":
    "La facturation se fait selon le temps effectivement consacré, au tarif horaire indiqué. Le prix final résulte des heures réellement effectuées.",
  "email.offer.priceModelKostendachTitle":
    "Modèle tarifaire : tarif horaire avec plafond de coûts",
  "email.offer.priceModelKostendachRate":
    "CHF {rate} / h | Plafond de coûts : max. CHF {max}",
  "email.offer.priceModelKostendachNote":
    "Vous ne payez au maximum que CHF {max}, indépendamment du temps effectivement consacré.",
  "email.offer.paymentTermsLabel": "Conditions de paiement",
  "email.offer.cta": "Consulter et répondre au devis",
  "email.offer.ctaFallback": "ou copiez ce lien :",

  // email.leadConfirmation
  "email.leadConfirmation.subject": "Votre demande pour {service} a bien été envoyée",
  "email.leadConfirmation.headerTitle": "Demande envoyée avec succès",
  "email.leadConfirmation.intro":
    "Nous vous remercions de votre demande auprès de {appName}. Nous avons bien reçu votre demande pour {service} {location}.",
  "email.leadConfirmation.locationFromTo": "de {fromCity} à {toCity}",
  "email.leadConfirmation.locationIn": "à {fromCity}",
  "email.leadConfirmation.nextStepsTitle": "Que se passe-t-il ensuite ?",
  "email.leadConfirmation.step1":
    "Nous examinons votre demande et la transmettons aux entreprises appropriées (jusqu'à {maxCompanies}).",
  "email.leadConfirmation.step2": "Les entreprises prennent contact avec vous",
  "email.leadConfirmation.step3": "Vous recevez des devis sans engagement",
  "email.leadConfirmation.step4": "Vous décidez librement",
  "email.leadConfirmation.help":
    "Nous restons volontiers à votre disposition pour toute question.",

  // email.invoice
  "email.invoice.subject": "Votre {documentTitle} de {companyName} – {documentNumber}",
  "email.invoice.colDescription": "Désignation",
  "email.invoice.colAmount": "Montant",
  "email.invoice.subtotal": "Sous-total",
  "email.invoice.discount": "Rabais",
  "email.invoice.vat": "TVA ({rate} %)",
  "email.invoice.ibanLabel": "IBAN",
  "email.invoice.vatNumberLabel": "N° TVA",

  // email.quittung
  "email.quittung.documentLabel": "Reçu",
  "email.quittung.intro":
    "Nous vous remercions de votre mandat. Vous trouverez votre reçu en pièce jointe.",
  "email.quittung.detailLabel": "Tarif",
  "email.quittung.totalLabel": "Total général",
  "email.quittung.outstandingNotice":
    "Montant encore ouvert – merci de régler le solde dû.",

  // email.rechnung
  "email.rechnung.documentLabel": "Facture",
  "email.rechnung.intro":
    "Vous trouverez ci-joint votre facture avec section de paiement QR au format PDF.",
  "email.rechnung.detailLabel": "Quantité",
  "email.rechnung.totalLabel": "Total",
  "email.rechnung.payableBy": "Payable jusqu'au {date}",
  "email.rechnung.referenceLabel": "Référence",

  // email.appointmentConfirmation
  "email.appointmentConfirmation.subject":
    "Confirmation de rendez-vous : {type} le {date}",
  "email.appointmentConfirmation.headerTitle": "Confirmation de rendez-vous : {type}",
  "email.appointmentConfirmation.intro":
    "{companyName} a enregistré le rendez-vous suivant pour vous :",
  "email.appointmentConfirmation.cancelNote":
    "Si vous ne pouvez pas honorer le rendez-vous, veuillez contacter {companyName} à temps.",
  "email.appointmentConfirmation.cancelNoteWithPhone":
    "Si vous ne pouvez pas honorer le rendez-vous, veuillez contacter {companyName} à temps au {phone}.",

  // email.besichtigungConfirmed
  "email.besichtigungConfirmed.subject":
    "Votre visite du {date} a été confirmée",
  "email.besichtigungConfirmed.headerTitle": "Visite confirmée",
  "email.besichtigungConfirmed.intro":
    "Votre rendez-vous de visite a été confirmé par {companyName}.",
  "email.besichtigungConfirmed.slotTitle": "Rendez-vous confirmé",
  "email.besichtigungConfirmed.noticeTitle": "Veuillez noter :",
  "email.besichtigungConfirmed.noticeBody":
    "Si vous ne pouvez pas honorer le rendez-vous, veuillez contacter {companyName} à temps.",

  // email.besichtigungProposal
  "email.besichtigungProposal.subject":
    "{companyName} vous a envoyé des propositions de rendez-vous",
  "email.besichtigungProposal.headerTitle": "Propositions de rendez-vous pour votre visite",
  "email.besichtigungProposal.intro":
    "{companyName} vous a envoyé les propositions de rendez-vous suivantes pour une visite :",
  "email.besichtigungProposal.cta": "Choisir un rendez-vous",
  "email.besichtigungProposal.ctaHint":
    "Cliquez sur le bouton pour sélectionner le rendez-vous qui vous convient.",
  "email.besichtigungProposal.urgencyTitle": "Merci de répondre rapidement",
  "email.besichtigungProposal.urgencyBody":
    "Afin de pouvoir réserver le rendez-vous pour vous, nous vous prions de nous communiquer votre choix dès que possible.",

  // email.proposalAccepted
  "email.proposalAccepted.subject": "Votre rendez-vous de visite chez {companyName}",
  "email.proposalAccepted.headerTitle": "Rendez-vous confirmé",
  "email.proposalAccepted.intro":
    "Votre rendez-vous de visite a été confirmé avec succès.",
  "email.proposalAccepted.closing": "Nous nous réjouissons de votre visite !",

  // email.rescheduleConfirmed
  "email.rescheduleConfirmed.subject": "Rendez-vous confirmé : {title}",
  "email.rescheduleConfirmed.headerTitle": "Rendez-vous confirmé !",
  "email.rescheduleConfirmed.headerSubtitle":
    "Votre nouveau rendez-vous a été accepté",
  "email.rescheduleConfirmed.intro":
    "Bonne nouvelle ! {companyName} a accepté votre proposition de rendez-vous.",
  "email.rescheduleConfirmed.newAppointmentLabel": "Votre nouveau rendez-vous",
  "email.rescheduleConfirmed.outro":
    "Merci de vous présenter à l'heure au rendez-vous. Pour toute question, vous pouvez vous adresser à tout moment à {companyName}.",

  // email.rescheduleRejected
  "email.rescheduleRejected.subject":
    "Proposition de rendez-vous non retenue : {title}",
  "email.rescheduleRejected.headerTitle": "Proposition de rendez-vous non retenue",
  "email.rescheduleRejected.headerSubtitle":
    "Votre proposition n'a malheureusement pas pu être acceptée",
  "email.rescheduleRejected.intro":
    "{companyName} ne peut malheureusement pas accepter le rendez-vous que vous avez proposé le {date} à {time}.",
  "email.rescheduleRejected.optionsTitle": "Que pouvez-vous faire ?",
  "email.rescheduleRejected.option1":
    "Contactez directement {companyName} afin de convenir d'un autre rendez-vous",
  "email.rescheduleRejected.option2":
    "Le rendez-vous initial reste valable pour l'instant",

  // email.rescheduleRequestSent
  "email.rescheduleRequestSent.subject": "Proposition de rendez-vous envoyée : {title}",
  "email.rescheduleRequestSent.headerTitle": "Proposition de rendez-vous envoyée",
  "email.rescheduleRequestSent.headerSubtitle":
    "Votre demande de report a été transmise",
  "email.rescheduleRequestSent.intro":
    "Votre proposition de rendez-vous a bien été envoyée à {companyName}.",
  "email.rescheduleRequestSent.proposedLabel": "Le rendez-vous que vous proposez",
  "email.rescheduleRequestSent.outro":
    "{companyName} prendra contact avec vous afin de confirmer le rendez-vous ou de vous faire une autre proposition.",
  "email.rescheduleRequestSent.footer":
    "Pour toute question, vous pouvez vous adresser directement à {companyName}.",

  // email.appointmentCancelled
  "email.appointmentCancelled.subject": "Annulation confirmée – {title}",
  "email.appointmentCancelled.headerTitle": "Annulation confirmée",
  "email.appointmentCancelled.intro":
    "Votre annulation a bien été traitée et {companyName} en a été informée.",
  "email.appointmentCancelled.cancelledTitle": "Rendez-vous annulé :",
  "email.appointmentCancelled.outro":
    "Si vous souhaitez convenir d'un nouveau rendez-vous, veuillez contacter directement {companyName}.",

  // email.besichtigungRequest
  "email.besichtigungRequest.subject":
    "Votre demande de visite auprès de {companyName} a bien été reçue",
  "email.besichtigungRequest.headerTitle": "Demande de visite reçue",
  "email.besichtigungRequest.intro":
    "nous vous remercions de votre demande de visite. Nous l'avons bien reçue et transmise.",
  "email.besichtigungRequest.slotTitle": "Le rendez-vous que vous souhaitez",
  "email.besichtigungRequest.offerAmount": "Montant du devis",
  "email.besichtigungRequest.nextStepsTitle": "Prochaines étapes :",
  "email.besichtigungRequest.nextStepsBody":
    "{companyName} prendra contact avec vous sous peu afin de confirmer le rendez-vous de visite ou de vous proposer une autre date.",

  // email.reminder
  "email.reminder.minutes": "{count} minutes",
  "email.reminder.hours": "{count} heures",

  "email.reminder.dayBefore.subject": "Rappel : votre visite a lieu demain",
  "email.reminder.dayBefore.headerTitle": "Visite demain",
  "email.reminder.dayBefore.headerSubtitle": "Rappel concernant le rendez-vous de demain",
  "email.reminder.dayBefore.intro":
    "ceci est un rappel amical concernant votre visite de demain :",
  "email.reminder.dayBefore.tipLabel": "Conseil :",
  "email.reminder.dayBefore.tip":
    "Veuillez tenir les documents pertinents à disposition et vous assurer que l'accès au bien est garanti.",

  "email.reminder.oneHour.subject": "Dernier rappel : {title} dans {timeUntil}",
  "email.reminder.oneHour.headerTitle": "Dernier rappel",
  "email.reminder.oneHour.headerSubtitle":
    "Votre rendez-vous commence dans {timeUntil}",
  "email.reminder.oneHour.intro":
    "Votre rendez-vous commence sous peu. Merci de vous assurer que vous êtes prêt.",
  "email.reminder.oneHour.actionsTitle":
    "Vous ne pouvez pas honorer le rendez-vous ?",
  "email.reminder.oneHour.rescheduleCta": "Reporter le rendez-vous",
  "email.reminder.oneHour.cancelCta": "Annuler le rendez-vous",
  "email.reminder.oneHour.actionsNote":
    "L'entreprise en sera automatiquement informée.",

  "email.reminder.customer.subject": "Rappel de rendez-vous : {title} dans {timeUntil}",
  "email.reminder.customer.headerTitle": "Rappel de rendez-vous",
  "email.reminder.customer.headerSubtitle":
    "Votre rendez-vous commence dans {timeUntil}",
  "email.reminder.customer.intro":
    "ceci est un rappel amical concernant votre prochain rendez-vous :",
  "email.reminder.customer.footerHelp":
    "Pour toute question, veuillez vous adresser directement à l'entreprise.",

  // email.auftragReminder
  "email.auftragReminder.subject":
    "Rappel : votre rendez-vous du {date} – {companyName}",
  "email.auftragReminder.headerTitle": "Votre rendez-vous approche",
  "email.auftragReminder.intro":
    "nous souhaitons vous rappeler votre prochain rendez-vous :",
  "email.auftragReminder.timeTbd": "Sera communiqué ultérieurement",
  "email.auftragReminder.outro":
    "Merci de vous assurer que tout est prêt pour le rendez-vous. En cas de question ou de modification, veuillez nous contacter à temps.",

  // email.doubleOptIn
  "email.doubleOptIn.subject": "Merci de confirmer votre demande",
  "email.doubleOptIn.headerTitle": "Merci de confirmer votre demande",
  "email.doubleOptIn.intro":
    "nous avons bien reçu votre demande. Afin de prévenir tout abus, nous avons besoin d'une brève confirmation que cette demande émane bien de vous.",
  "email.doubleOptIn.introWithService":
    "nous avons bien reçu votre demande ({service}). Afin de prévenir tout abus, nous avons besoin d'une brève confirmation que cette demande émane bien de vous.",
  "email.doubleOptIn.prompt":
    "Veuillez cliquer sur le bouton ci-dessous pour activer votre demande :",
  "email.doubleOptIn.cta": "Confirmer la demande",
  "email.doubleOptIn.linkFallback":
    "Si le bouton ne fonctionne pas, veuillez copier ce lien dans votre navigateur :",
  "email.doubleOptIn.expiry":
    "Le lien est valable 48 heures. Si vous n'avez soumis aucune demande, veuillez ignorer cet e-mail.",

  // sms
  "sms.reminder.oneHour":
    "⏰ Rappel : {title} dans {timeUntil}. Lieu : {location}. {companyName}",
  "sms.reminder.twoHour":
    "Rappel : {title} dans {timeUntil}. {date} à {time}. {companyName}",
  "sms.reminder.dayBefore":
    "📅 Rappel : {title} a lieu demain à {time}. {location}. {companyName}",

  // email.resend
  "email.resend.subjectPrefix": "[Renvoyé] {subject}",
  "email.resend.headerTitle": "Renvoyé",
  "email.resend.intro":
    "Cet e-mail vous a été renvoyé, car la première distribution a échoué.",
  "email.resend.originalSubjectLabel": "Objet initial",
  "email.resend.details":
    "Veuillez vous connecter à votre compte pour consulter les détails, ou nous contacter en cas de question.",
  "email.resend.help": "Nous restons volontiers à votre disposition pour toute question.",
  "email.resend.autoGenerated": "Cet e-mail a été généré automatiquement.",

  // error / validation
  "error.invalidInput": "Données saisies invalides",
  "error.rateLimited": "Trop de demandes. Merci de patienter un instant.",
  "validation.firstNameRequired": "Prénom requis",
  "validation.lastNameRequired": "Nom requis",
  "validation.emailInvalid": "Adresse e-mail invalide",
  "validation.serviceTypeRequired": "Type de prestation requis",
  "validation.cityRequired": "Localité requise",
};

export const en: Record<MessageKey, string> = {
  // common
  "common.greeting": "Dear {name},",
  "common.greetingPlain": "Dear Sir or Madam,",
  "common.regards": "Kind regards",
  "common.regardsFriendly": "Best regards",
  "common.teamSignature": "Your {appName} team",
  "common.autoSent": "This email was sent automatically.",
  "common.autoSentBy": "This email was sent automatically by {sender}.",
  "common.autoReminderSent": "This reminder was sent automatically.",
  "common.copyright": "© {year} {appName}",
  "common.customer": "Customer",
  "common.company": "Company",
  "common.provider": "Provider",
  "common.date": "Date",
  "common.time": "Time",
  "common.dateAndTime": "Date and time",
  "common.sentAt": "Sent on",
  "common.email": "Email",
  "common.phone": "Phone",
  "common.address": "Address",
  "common.destinationAddress": "Destination address",
  "common.location": "Location",
  "common.from": "From",
  "common.to": "To",
  "common.type": "Type",
  "common.note": "Note",
  "common.message": "Message",
  "common.messageFrom": "Message from {name}",
  "common.offer": "Quote",
  "common.appointment": "Appointment",
  "common.appointmentDetails": "Appointment details",
  "common.allDay": "All day",
  "common.timeRange": "{start} – {end}",
  "common.timeValue": "{time}",
  "common.timeAt": "at {time}",
  "common.attachments": "Attachments",
  "common.notSpecified": "-",

  // service
  "service.umzug": "Removal",
  "service.umzug_privat": "Private removal",
  "service.umzug_firma": "Corporate removal",
  "service.umzug_buero": "Office removal",
  "service.umzug_international": "International removal",
  "service.privatumzug": "Private removal",
  "service.firmenumzug": "Corporate removal",
  "service.bueroumzug": "Office removal",
  "service.seniorenumzug": "Senior removal",
  "service.studentenumzug": "Student removal",
  "service.reinigung": "Cleaning",
  "service.reinigung_end": "Cleaning enquiry",
  "service.reinigung_grund": "Deep cleaning",
  "service.reinigung_fenster": "Window cleaning",
  "service.endreinigung": "End-of-tenancy cleaning",
  "service.grundreinigung": "Deep cleaning",
  "service.unterhaltsreinigung": "Maintenance cleaning",
  "service.uebergabereinigung": "Handover cleaning",
  "service.baureinigung": "Post-construction cleaning",
  "service.buroreinigung": "Office cleaning",
  "service.raeumung": "Clearance",
  "service.raeumung_wohnung": "Flat clearance",
  "service.raeumung_haus": "House clearance",
  "service.raeumung_keller": "Cellar clearance",
  "service.raeumung_dachboden": "Loft clearance",
  "service.kellerraeumung": "Cellar clearance",
  "service.wohnungsraeumung": "Flat clearance",
  "service.hausraeumung": "House clearance",
  "service.estrichraeumung": "Attic clearance",
  "service.nachlassraeumung": "Estate clearance",
  "service.messieraeumung": "Hoarder clearance",
  "service.klaviertransport": "Piano transport",
  "service.klaviertransport_transport": "Piano transport",
  "service.klaviertransport_storage": "Piano storage",
  "service.klaviertransport_disposal": "Piano disposal",
  "service.klaviertransport_internal_move": "Piano repositioning",
  "service.entsorgung": "Waste disposal",
  "service.entsorgung_moebel": "Furniture disposal",
  "service.entsorgung_elektro": "Electrical waste disposal",
  "service.entsorgung_sperrgut": "Bulky waste disposal",
  "service.lagerung": "Storage",
  "service.lagerung_einlagerung": "Long-term storage",
  "service.lagerung_zwischenlagerung": "Interim storage",
  "service.lagerung_selfstorage": "Self-storage",
  "service.moebellift": "Furniture lift",
  "service.moebellift_mieten": "Furniture lift hire",
  "service.moebellift_service": "Furniture lift service",
  "service.moebeltransport": "Furniture transport",
  "service.transport_moebel": "Furniture transport",
  "service.spezialtransport": "Special transport",
  "service.renovation": "Renovation",
  "service.malerarbeiten": "Painting work",
  "service.malerarbeit": "Painting work",

  // appointmentType
  "appointmentType.besichtigung": "Viewing",
  "appointmentType.service": "Job",
  "appointmentType.follow_up": "Follow-up check",
  "appointmentType.meeting": "Meeting",
  "appointmentType.blocked": "Blocked",

  // email.offer
  "email.offer.subject": "Your quote from {companyName} – no. {offerNumber}",
  "email.offer.documentTitle": "Your quote from {companyName}",
  "email.offer.headerTitle": "Your quote",
  "email.offer.headerFrom": "from {companyName}",
  "email.offer.intro":
    "thank you for your enquiry. Please find enclosed our quote for the requested services.",
  "email.offer.attachmentsNote": "Attached to this email you will find {list}.",
  "email.offer.attachmentOfferPdf": "the quote as a PDF",
  "email.offer.attachmentAgb": "our terms and conditions",
  "email.offer.attachmentChecklist": "a helpful preparation checklist",
  "email.offer.attachmentConjunction": "and",
  "email.offer.serviceDate": "Service date",
  "email.offer.validUntil": "Valid until",
  "email.offer.itemsHeading": "Service items",
  "email.offer.itemPosition": "Item",
  "email.offer.itemQuantity": "Quantity",
  "email.offer.itemPrice": "Price",
  "email.offer.itemRate": "Rate",
  "email.offer.itemTotal": "Total",
  "email.offer.itemIncluded": "INCLUDED",
  "email.offer.itemOnDemand": "as incurred",
  "email.offer.unitPiece": "pc.",
  "email.offer.unitHour": "hrs",
  "email.offer.timeEstimate": "{minHours} – {maxHours} hrs × {rate} / hr",
  "email.offer.kostendachLabel": "Cost ceiling",
  "email.offer.kostendachValue": "max. {amount}",
  "email.offer.kostendachHours": "({hours} hrs)",
  "email.offer.kostendachExplain":
    "You will pay no more than this amount, regardless of the actual time required.",
  "email.offer.subtotal": "Subtotal",
  "email.offer.surchargeDefault": "Surcharge",
  "email.offer.discount": "Discount {percent}%",
  "email.offer.netTotal": "Total excl. VAT",
  "email.offer.vat": "VAT ({rate}%)",
  "email.offer.total": "Total",
  "email.offer.rateAggregateNote":
    "The total price is derived from the items charged as incurred (see details above), plus any fixed-price items.",
  "email.offer.blindNote":
    "This quote is based on the information you provided, without an on-site viewing. Prices are estimates and may be adjusted following a viewing.",
  "email.offer.priceModelHourlyTitle": "Pricing model: hourly rate",
  "email.offer.priceModelHourlyRate": "CHF {rate} / hr",
  "email.offer.priceModelHourlyNote":
    "Billing is based on the actual time required at the stated hourly rate. The final price is determined by the hours actually worked.",
  "email.offer.priceModelKostendachTitle":
    "Pricing model: hourly rate with cost ceiling",
  "email.offer.priceModelKostendachRate":
    "CHF {rate} / hr | Cost ceiling: max. CHF {max}",
  "email.offer.priceModelKostendachNote":
    "You will pay no more than CHF {max}, regardless of the actual time required.",
  "email.offer.paymentTermsLabel": "Payment terms",
  "email.offer.cta": "View and respond to quote",
  "email.offer.ctaFallback": "or copy this link:",

  // email.leadConfirmation
  "email.leadConfirmation.subject": "Your enquiry for {service} has been sent successfully",
  "email.leadConfirmation.headerTitle": "Enquiry sent successfully",
  "email.leadConfirmation.intro":
    "Thank you for your enquiry with {appName}. We have received your enquiry for {service} {location}.",
  "email.leadConfirmation.locationFromTo": "from {fromCity} to {toCity}",
  "email.leadConfirmation.locationIn": "in {fromCity}",
  "email.leadConfirmation.nextStepsTitle": "What happens next?",
  "email.leadConfirmation.step1":
    "We review your enquiry and forward it to suitable companies (up to {maxCompanies}).",
  "email.leadConfirmation.step2": "The companies will contact you",
  "email.leadConfirmation.step3": "You receive quotes without obligation",
  "email.leadConfirmation.step4": "You decide freely",
  "email.leadConfirmation.help": "We are happy to help if you have any questions.",

  // email.invoice
  "email.invoice.subject": "Your {documentTitle} from {companyName} – {documentNumber}",
  "email.invoice.colDescription": "Description",
  "email.invoice.colAmount": "Amount",
  "email.invoice.subtotal": "Subtotal",
  "email.invoice.discount": "Discount",
  "email.invoice.vat": "VAT ({rate}%)",
  "email.invoice.ibanLabel": "IBAN",
  "email.invoice.vatNumberLabel": "VAT no.",

  // email.quittung
  "email.quittung.documentLabel": "Receipt",
  "email.quittung.intro":
    "Thank you for your order. Please find your receipt attached.",
  "email.quittung.detailLabel": "Rate",
  "email.quittung.totalLabel": "Grand total",
  "email.quittung.outstandingNotice":
    "Amount still outstanding – please settle the balance due.",

  // email.rechnung
  "email.rechnung.documentLabel": "Invoice",
  "email.rechnung.intro":
    "Please find your invoice with QR payment section attached as a PDF.",
  "email.rechnung.detailLabel": "Quantity",
  "email.rechnung.totalLabel": "Total",
  "email.rechnung.payableBy": "Payable by {date}",
  "email.rechnung.referenceLabel": "Reference",

  // email.appointmentConfirmation
  "email.appointmentConfirmation.subject":
    "Appointment confirmation: {type} on {date}",
  "email.appointmentConfirmation.headerTitle": "Appointment confirmation: {type}",
  "email.appointmentConfirmation.intro":
    "{companyName} has scheduled the following appointment for you:",
  "email.appointmentConfirmation.cancelNote":
    "If you are unable to attend, please contact {companyName} in good time.",
  "email.appointmentConfirmation.cancelNoteWithPhone":
    "If you are unable to attend, please contact {companyName} in good time on {phone}.",

  // email.besichtigungConfirmed
  "email.besichtigungConfirmed.subject":
    "Your viewing appointment on {date} has been confirmed",
  "email.besichtigungConfirmed.headerTitle": "Viewing appointment confirmed",
  "email.besichtigungConfirmed.intro":
    "Your viewing appointment has been confirmed by {companyName}.",
  "email.besichtigungConfirmed.slotTitle": "Confirmed appointment",
  "email.besichtigungConfirmed.noticeTitle": "Please note:",
  "email.besichtigungConfirmed.noticeBody":
    "If you are unable to attend, please contact {companyName} in good time.",

  // email.besichtigungProposal
  "email.besichtigungProposal.subject":
    "{companyName} has sent you proposed appointment slots",
  "email.besichtigungProposal.headerTitle": "Proposed slots for your viewing",
  "email.besichtigungProposal.intro":
    "{companyName} has sent you the following proposed slots for a viewing:",
  "email.besichtigungProposal.cta": "Select an appointment",
  "email.besichtigungProposal.ctaHint":
    "Click the button to select your preferred appointment.",
  "email.besichtigungProposal.urgencyTitle": "Please reply promptly",
  "email.besichtigungProposal.urgencyBody":
    "So that we can reserve the appointment for you, we kindly ask you to let us know your choice as soon as possible.",

  // email.proposalAccepted
  "email.proposalAccepted.subject": "Your viewing appointment with {companyName}",
  "email.proposalAccepted.headerTitle": "Appointment confirmed",
  "email.proposalAccepted.intro":
    "Your viewing appointment has been confirmed successfully.",
  "email.proposalAccepted.closing": "We look forward to seeing you.",

  // email.rescheduleConfirmed
  "email.rescheduleConfirmed.subject": "Appointment confirmed: {title}",
  "email.rescheduleConfirmed.headerTitle": "Appointment confirmed",
  "email.rescheduleConfirmed.headerSubtitle":
    "Your new appointment has been accepted",
  "email.rescheduleConfirmed.intro":
    "Good news: {companyName} has accepted your proposed appointment.",
  "email.rescheduleConfirmed.newAppointmentLabel": "Your new appointment",
  "email.rescheduleConfirmed.outro":
    "Please arrive on time for the appointment. If you have any questions, you can contact {companyName} at any time.",

  // email.rescheduleRejected
  "email.rescheduleRejected.subject": "Proposed appointment not possible: {title}",
  "email.rescheduleRejected.headerTitle": "Proposed appointment not possible",
  "email.rescheduleRejected.headerSubtitle":
    "Unfortunately your proposal could not be accepted",
  "email.rescheduleRejected.intro":
    "Unfortunately, {companyName} is unable to accept the appointment you proposed on {date} at {time}.",
  "email.rescheduleRejected.optionsTitle": "What can you do?",
  "email.rescheduleRejected.option1":
    "Contact {companyName} directly to arrange an alternative appointment",
  "email.rescheduleRejected.option2":
    "The original appointment remains in place for now",

  // email.rescheduleRequestSent
  "email.rescheduleRequestSent.subject": "Proposed appointment sent: {title}",
  "email.rescheduleRequestSent.headerTitle": "Proposed appointment sent",
  "email.rescheduleRequestSent.headerSubtitle":
    "Your rescheduling request has been submitted",
  "email.rescheduleRequestSent.intro":
    "Your proposed appointment has been sent successfully to {companyName}.",
  "email.rescheduleRequestSent.proposedLabel": "Your proposed appointment",
  "email.rescheduleRequestSent.outro":
    "{companyName} will get in touch with you to confirm the appointment or suggest an alternative.",
  "email.rescheduleRequestSent.footer":
    "If you have any questions, you can contact {companyName} directly.",

  // email.appointmentCancelled
  "email.appointmentCancelled.subject": "Cancellation confirmed – {title}",
  "email.appointmentCancelled.headerTitle": "Cancellation confirmed",
  "email.appointmentCancelled.intro":
    "Your cancellation has been processed successfully and {companyName} has been notified.",
  "email.appointmentCancelled.cancelledTitle": "Cancelled appointment:",
  "email.appointmentCancelled.outro":
    "If you would like to arrange a new appointment, please contact {companyName} directly.",

  // email.besichtigungRequest
  "email.besichtigungRequest.subject":
    "Your viewing request to {companyName} has been received",
  "email.besichtigungRequest.headerTitle": "Viewing request received",
  "email.besichtigungRequest.intro":
    "thank you for your viewing request. We have received it and passed it on.",
  "email.besichtigungRequest.slotTitle": "Your preferred appointment",
  "email.besichtigungRequest.offerAmount": "Quote amount",
  "email.besichtigungRequest.nextStepsTitle": "Next steps:",
  "email.besichtigungRequest.nextStepsBody":
    "{companyName} will contact you shortly to confirm the viewing appointment or to suggest an alternative date.",

  // email.reminder
  "email.reminder.minutes": "{count} minutes",
  "email.reminder.hours": "{count} hours",

  "email.reminder.dayBefore.subject": "Reminder: your viewing is tomorrow",
  "email.reminder.dayBefore.headerTitle": "Viewing tomorrow",
  "email.reminder.dayBefore.headerSubtitle": "Reminder for tomorrow's appointment",
  "email.reminder.dayBefore.intro":
    "this is a friendly reminder about your viewing tomorrow:",
  "email.reminder.dayBefore.tipLabel": "Tip:",
  "email.reminder.dayBefore.tip":
    "Please have the relevant documents to hand and make sure that access to the property is available.",

  "email.reminder.oneHour.subject": "Final reminder: {title} in {timeUntil}",
  "email.reminder.oneHour.headerTitle": "Final reminder",
  "email.reminder.oneHour.headerSubtitle": "Your appointment starts in {timeUntil}",
  "email.reminder.oneHour.intro":
    "Your appointment starts shortly. Please make sure you are ready.",
  "email.reminder.oneHour.actionsTitle": "Unable to attend the appointment?",
  "email.reminder.oneHour.rescheduleCta": "Reschedule appointment",
  "email.reminder.oneHour.cancelCta": "Cancel appointment",
  "email.reminder.oneHour.actionsNote":
    "The company will be notified automatically.",

  "email.reminder.customer.subject": "Appointment reminder: {title} in {timeUntil}",
  "email.reminder.customer.headerTitle": "Appointment reminder",
  "email.reminder.customer.headerSubtitle": "Your appointment starts in {timeUntil}",
  "email.reminder.customer.intro":
    "this is a friendly reminder about your upcoming appointment:",
  "email.reminder.customer.footerHelp":
    "If you have any questions, please contact the company directly.",

  // email.auftragReminder
  "email.auftragReminder.subject": "Reminder: your appointment on {date} – {companyName}",
  "email.auftragReminder.headerTitle": "Your appointment is coming up",
  "email.auftragReminder.intro":
    "we would like to remind you of your upcoming appointment:",
  "email.auftragReminder.timeTbd": "To be confirmed",
  "email.auftragReminder.outro":
    "Please make sure that everything is ready for the appointment. If you have any questions or changes, please contact us in good time.",

  // email.doubleOptIn
  "email.doubleOptIn.subject": "Please confirm your enquiry",
  "email.doubleOptIn.headerTitle": "Please confirm your enquiry",
  "email.doubleOptIn.intro":
    "we have received your enquiry. To protect against misuse, we need a brief confirmation that this enquiry genuinely came from you.",
  "email.doubleOptIn.introWithService":
    "we have received your enquiry ({service}). To protect against misuse, we need a brief confirmation that this enquiry genuinely came from you.",
  "email.doubleOptIn.prompt":
    "Please click the button below to activate your enquiry:",
  "email.doubleOptIn.cta": "Confirm enquiry",
  "email.doubleOptIn.linkFallback":
    "If the button does not work, please copy this link into your browser:",
  "email.doubleOptIn.expiry":
    "The link is valid for 48 hours. If you did not submit an enquiry, please ignore this email.",

  // sms
  "sms.reminder.oneHour":
    "⏰ Reminder: {title} in {timeUntil}. Location: {location}. {companyName}",
  "sms.reminder.twoHour":
    "Reminder: {title} in {timeUntil}. {date} at {time}. {companyName}",
  "sms.reminder.dayBefore":
    "📅 Reminder: {title} is tomorrow at {time}. {location}. {companyName}",

  // email.resend
  "email.resend.subjectPrefix": "[Resent] {subject}",
  "email.resend.headerTitle": "Resent",
  "email.resend.intro":
    "This email has been sent to you again because the original delivery failed.",
  "email.resend.originalSubjectLabel": "Original subject",
  "email.resend.details":
    "Please sign in to your account to view further details, or contact us if you have any questions.",
  "email.resend.help": "We are happy to help if you have any questions.",
  "email.resend.autoGenerated": "This email was generated automatically.",

  // error / validation
  "error.invalidInput": "Invalid input data",
  "error.rateLimited": "Too many requests. Please wait a moment.",
  "validation.firstNameRequired": "First name is required",
  "validation.lastNameRequired": "Last name is required",
  "validation.emailInvalid": "Invalid email address",
  "validation.serviceTypeRequired": "Service type is required",
  "validation.cityRequired": "Town/city is required",
};

/** All catalogs keyed by locale. */
export const catalogs = { de, fr, en } as const;
