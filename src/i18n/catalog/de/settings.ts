/** Einstellungen page. German is the source of truth for the key set. */
export const settings = {
  "settings.title": "Einstellungen",
  "settings.secret.configured": "Hinterlegt",
  "settings.secret.change": "Ändern",
  "settings.secret.notConfigured": "Nicht hinterlegt",
  "settings.secret.saved": "Schlüssel gespeichert",
  "settings.secret.removed": "Schlüssel entfernt",
  "settings.secret.saveFailed": "Schlüssel konnte nicht gespeichert werden",
  "settings.tab.profile": "Profil",
  "settings.tab.notifications": "Benachrichtigungen",
  "settings.tab.email": "E-Mail",
  "settings.tab.sms": "SMS",
  "settings.tab.reminders": "Erinnerungen",
  "settings.tab.agb": "AGB",
  "settings.tab.ki": "KI-Integration",
  "settings.tab.calendar": "Kalender",

  // --- Language (this feature's own UI) -----------------------------------------
  "settings.language.title": "Sprache",
  "settings.language.description":
    "Legt fest, in welcher Sprache Ihr Dashboard erscheint und welche Sprache für Anfragen ohne erkannte Sprache angenommen wird.",
  "settings.language.default": "Standardsprache der Firma",
  "settings.language.defaultHint":
    "Ihr Dashboard erscheint in dieser Sprache. Neue Anfragen ohne Sprachangabe werden ebenfalls so behandelt.",
  "settings.language.customerNotice":
    "Dokumente und E-Mails an Kunden richten sich immer nach der Sprache des Kunden — nicht nach dieser Einstellung.",
  "settings.language.saved": "Sprache gespeichert.",

  // --- Profile ---------------------------------------------------------------------
  "settings.profile.title": "Firmenprofil",
  "settings.profile.companyName": "Firmenname",
  "settings.profile.legalName": "Rechtlicher Name",
  "settings.profile.slogan": "Slogan",
  "settings.profile.primaryColor": "Primärfarbe",
  "settings.profile.logo": "Logo",
  "settings.profile.signature": "Unterschrift",
  "settings.profile.vatNumber": "MwSt-Nummer",
  "settings.profile.uidNumber": "UID-Nummer",
  "settings.profile.iban": "IBAN",
  "settings.profile.bankName": "Bank",
  "settings.profile.website": "Website",
  "settings.profile.saved": "Profil gespeichert.",

  // --- PDF template ---------------------------------------------------------------------
  "settings.pdf.title": "PDF-Vorlage",
  "settings.pdf.classic": "Klassisch",
  "settings.pdf.modern": "Modern",

  // --- Notifications / Email / SMS ----------------------------------------------------------
  "settings.notifications.email": "Benachrichtigungs-E-Mail",
  "settings.notifications.phone": "Benachrichtigungs-Telefon",
  "settings.email.apiKey": "Resend API-Key",
  "settings.email.fromName": "Absendername",
  "settings.email.fromEmail": "Absender-E-Mail",
  "settings.email.test": "Test-E-Mail senden",
  "settings.sms.accountSid": "Twilio Account SID",
  "settings.sms.authToken": "Twilio Auth Token",
  "settings.sms.phoneNumber": "Twilio Telefonnummer",

  // --- Page shell ---------------------------------------------------------------------
  "settings.pageTitle": "Einstellungen | Firma",
  "settings.subtitle":
    "Firmenprofil, Benachrichtigungen, E-Mail-Versand und AGB konfigurieren.",
  "settings.companyNotFound": "Firma nicht gefunden",
  "settings.unsavedChanges": "Ungespeicherte Änderungen",
  "settings.saveFailed": "Die Änderungen konnten nicht gespeichert werden.",

  // --- Profile ---------------------------------------------------------------------
  "settings.profile.description": "Ihre Firmeninformationen bearbeiten",
  "settings.profile.companyData": "Unternehmensdaten",
  "settings.profile.primaryColorHint":
    "Diese Farbe wird in Ihren PDF-Offerten verwendet",

  // --- PDF template ---------------------------------------------------------------------
  "settings.pdf.offerTitle": "Offerte PDF-Vorlage",
  "settings.pdf.hint":
    "Layout, mit dem Ihre Offerten-PDFs erstellt werden (Download, Versand und Kundenansicht)",
  "settings.pdf.classicDesc": "Bewährtes Standard-Layout mit Leistungstabelle",
  "settings.pdf.modernDesc":
    "Neues Design mit «Auf einen Blick»-Übersicht und Service-Karten",

  // --- Notifications ----------------------------------------------------------
  "settings.notifications.description":
    "Konfigurieren Sie Ihre Benachrichtigungseinstellungen",
  "settings.notifications.emailPlaceholder": "Falls abweichend von Haupt-E-Mail",
  "settings.notifications.emailHint": "Leer lassen, um die Haupt-E-Mail zu verwenden",
  "settings.notifications.phoneLabel": "Benachrichtigungs-Telefon (SMS)",

  // --- E-Mail (Resend) ----------------------------------------------------------
  "settings.email.title": "Eigene E-Mail-Adresse (Resend)",
  "settings.email.description":
    "Senden Sie Offerten mit Ihrer eigenen E-Mail-Adresse anstatt über das System",
  "settings.email.setupTitle": "So richten Sie Ihre eigene E-Mail ein:",
  "settings.email.step1": "Erstellen Sie ein Konto auf",
  "settings.email.step2": "Verifizieren Sie Ihre Domain unter",
  "settings.email.step3": "Erstellen Sie einen API-Key unter",
  "settings.email.step4": "Tragen Sie die Daten hier ein",
  "settings.email.useOwn": "Eigene E-Mail-Adresse verwenden",
  "settings.email.useOwnHint":
    "Offerten werden mit Ihrer eigenen Absender-Adresse gesendet",
  "settings.email.fromEmailHint": "Muss eine verifizierte Domain sein",
  "settings.email.configComplete":
    "E-Mail-Konfiguration vollständig — Offerten werden mit Ihrer Adresse gesendet",
  "settings.email.disabledNote":
    "Wenn deaktiviert, werden Offerten über die konfigurierte System-E-Mail-Adresse gesendet.",
  "settings.email.testTitle": "E-Mail-Konfiguration testen",
  "settings.email.testHint": "Eine Test-E-Mail an {email} senden",
  "settings.email.testButton": "Test senden",
  "settings.email.testMissingConfig":
    "Bitte speichern Sie zuerst API-Key und Absender-E-Mail.",
  "settings.email.testSuccess": "Test erfolgreich",
  "settings.email.testSuccessDescription": "Eine Test-E-Mail wurde an {email} gesendet.",
  "settings.email.testFailed": "Test fehlgeschlagen",
  "settings.email.testFailedDescription": "Die Test-E-Mail konnte nicht gesendet werden.",
  "settings.email.sessionExpired": "Sitzung abgelaufen",
  "settings.email.sessionExpiredDescription":
    "Bitte melden Sie sich neu an und versuchen Sie es erneut.",
  "settings.email.saved": "E-Mail-Einstellungen wurden gespeichert.",
  "settings.email.saveFailed": "Die E-Mail-Einstellungen konnten nicht gespeichert werden.",

  // --- SMS (Twilio) ----------------------------------------------------------
  "settings.sms.title": "SMS-Erinnerungen (Twilio)",
  "settings.sms.description":
    "Konfigurieren Sie Twilio für SMS-Erinnerungen an Ihre Kunden",
  "settings.sms.setupTitle": "So erhalten Sie Twilio-Zugangsdaten:",
  "settings.sms.step1": "Erstellen Sie ein Konto auf",
  "settings.sms.step2":
    "Öffnen Sie die Console und kopieren Sie Ihre Account SID und den Auth Token",
  "settings.sms.step3": "Kaufen Sie eine Telefonnummer für den SMS-Versand",
  "settings.sms.step4": "Tragen Sie die Daten hier ein",
  "settings.sms.enable": "Twilio aktivieren",
  "settings.sms.enableHint": "SMS-Funktionalität für Ihre Firma aktivieren",
  "settings.sms.accountSidLabel": "Account SID",
  "settings.sms.authTokenLabel": "Auth Token",
  "settings.sms.authTokenPlaceholder": "Ihr Auth Token",
  "settings.sms.phoneNumberHint":
    "Die Telefonnummer, von der SMS gesendet werden (im E.164-Format)",
  "settings.sms.remindersEnable": "SMS-Erinnerungen aktivieren",
  "settings.sms.remindersHint":
    "Kunden erhalten zusätzlich zur E-Mail auch SMS-Erinnerungen",
  "settings.sms.configComplete": "Twilio-Konfiguration vollständig",
  "settings.sms.saved": "Twilio-Einstellungen wurden gespeichert.",
  "settings.sms.saveFailed": "Die Twilio-Einstellungen konnten nicht gespeichert werden.",

  // --- AGB ----------------------------------------------------------
  "settings.agb.title": "Allgemeine Geschäftsbedingungen (AGB)",
  "settings.agb.description":
    "Erstellen Sie strukturierte AGB-Abschnitte mit Titel und Inhalt für jeden Service-Typ. Diese werden automatisch als PDF-Anhang in jede Offerte übernommen und bei Annahme rechtsgültig akzeptiert.",

  // --- KI ----------------------------------------------------------
  "settings.ki.description":
    "Wählen Sie Ihren KI-Anbieter und hinterlegen Sie den API-Schlüssel. Eigene Schlüssel haben Vorrang vor dem Server-Schlüssel.",
  "settings.ki.provider": "KI-Anbieter",
  "settings.ki.active": "Aktiv",
  "settings.ki.apiKeyFor": "{provider} API-Schlüssel",
  "settings.ki.keySet": "Schlüssel hinterlegt.",
  "settings.ki.keyMissing": "Kein Schlüssel hinterlegt.",
  "settings.ki.keyMissingFallback": "Kein Schlüssel — Server-Fallback wird verwendet.",
  "settings.ki.model": "Modell",
  "settings.ki.modelHint": "Leer lassen = Standard ({model}).",
  "settings.ki.allModels": "Alle Modelle",
  "settings.ki.save": "KI-Einstellungen speichern",
  "settings.ki.saved": "KI-Einstellungen wurden gespeichert.",
  "settings.ki.saveFailed": "KI-Einstellungen konnten nicht gespeichert werden.",

  // --- E-Mail-Eingang (Resend-Webhook) ---------------------------------------
  "settings.inbound.title": "E-Mail-Eingang",
  "settings.inbound.description":
    "Mails an Ihre Anfrageadresse landen automatisch im E-Mail-Eingang. Damit Resend sie hierher meldet, braucht es einen Webhook.",
  "settings.inbound.webhookUrl": "Webhook-Adresse",
  "settings.inbound.webhookUrlHint":
    "Diese Adresse im Resend-Dashboard unter Webhooks eintragen, Ereignis «email.received».",
  "settings.inbound.webhookUrlMissing":
    "Die Adresse laesst sich nicht bilden — die Serveradresse fehlt in dieser Installation.",
  "settings.inbound.event": "Ereignis",
  "settings.inbound.alias": "Empfangsadresse",
  "settings.inbound.aliasHint":
    "Ordnet eingehende Mails dieser Firma zu. Aenderungen daran nimmt der Betreiber vor.",
  "settings.inbound.aliasMissing": "Noch keine Adresse hinterlegt",
  "settings.inbound.secret": "Webhook-Secret",
  "settings.inbound.copied": "In die Zwischenablage kopiert",
  "settings.inbound.copyFailed": "Kopieren nicht moeglich — bitte von Hand markieren",

  // --- Kalender verbinden (webcal/ICS-Abo) -----------------------------------------
  "settings.calfeed.title": "Kalender verbinden",
  "settings.calfeed.description":
    "Abonnieren Sie Ihre CRM-Termine in Apple Kalender, Google Kalender oder Outlook. Das Abo ist reine Leserichtung: Aenderungen im CRM erscheinen im Kalender, nie umgekehrt. Wie oft Ihr Kalender aktualisiert, bestimmt der Kalender-Client selbst.",
  "settings.calfeed.securityNotice":
    "Der Link ist ein Passwort: Wer ihn kennt, sieht Ihre Termine. Nicht weiterleiten. Bei Verdacht auf Weitergabe das Token widerrufen und ein neues erzeugen.",
  "settings.calfeed.createTitle": "Neues Token erzeugen",
  "settings.calfeed.labelPlaceholder": "Bezeichnung, z. B. «iPhone Anna»",
  "settings.calfeed.createButton": "Token erzeugen",
  "settings.calfeed.created":
    "Token erzeugt. Die Links unten erscheinen nur dieses eine Mal — jetzt kopieren und im Kalender eintragen.",
  "settings.calfeed.createFailed": "Token konnte nicht erzeugt werden",
  "settings.calfeed.linksTitle": "Abo-Links fuer dieses Token",
  "settings.calfeed.copy": "Kopieren",
  "settings.calfeed.copied": "In die Zwischenablage kopiert",
  "settings.calfeed.copyFailed": "Kopieren nicht moeglich — bitte von Hand markieren",
  "settings.calfeed.urlMissing":
    "Die Adresse laesst sich nicht bilden — die Serveradresse fehlt in dieser Installation.",
  "settings.calfeed.tokensTitle": "Bestehende Tokens",
  "settings.calfeed.noTokens": "Noch keine Tokens vorhanden.",
  "settings.calfeed.colLabel": "Bezeichnung",
  "settings.calfeed.colCreated": "Erstellt",
  "settings.calfeed.colLastUsed": "Zuletzt benutzt",
  "settings.calfeed.neverUsed": "Noch nie",
  "settings.calfeed.unnamed": "Ohne Bezeichnung",
  "settings.calfeed.revoke": "Widerrufen",
  "settings.calfeed.revokeConfirmTitle": "Token widerrufen?",
  "settings.calfeed.revokeConfirmBody":
    "Alle Kalender-Abos, die mit diesem Token eingerichtet wurden, hoeren sofort auf zu funktionieren. Das laesst sich nicht rueckgaengig machen.",
  "settings.calfeed.revokeCancel": "Abbrechen",
  "settings.calfeed.revokeConfirm": "Widerrufen",
  "settings.calfeed.revoked": "Token widerrufen — alle zugehoerigen Abos sind tot.",
  "settings.calfeed.revokeFailed": "Token konnte nicht widerrufen werden",
  "settings.calfeed.loadFailed": "Tokens konnten nicht geladen werden",
  "settings.calfeed.typ.besichtigung": "Besichtigungen",
  "settings.calfeed.typ.service": "Dienstleistungen",
  "settings.calfeed.typ.follow_up": "Nachfassen",
  "settings.calfeed.typ.meeting": "Besprechungen",
  "settings.calfeed.typ.blocked": "Blockierte Zeiten",
  "settings.calfeed.typ.other": "Weitere Termine",
  "settings.toast.tenantMismatch":
    "Die geladenen Firmendaten gehören nicht zur ausgewählten Firma. Bitte die Seite neu laden — gespeichert wurde nichts.",

} as const;
