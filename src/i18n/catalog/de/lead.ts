/**
 * Dashboard namespace: lead. German is the source of truth for the key set.
 *
 * Covers Anfragen (list + detail), AnfrageEditDialog, ManualImport and the Anfrage
 * summary rendered on a calendar appointment.
 *
 * These keys are OPERATOR chrome and are resolved with `useT()`. They are NOT the
 * customer's language: a lead carries `leads.language` (the language the customer
 * wrote in), which stays a captured *value* and never passes through this catalog.
 * Select option *values* (property_type, disposal_type, …) likewise stay untouched
 * German DB tokens — only their visible labels live here.
 */
export const lead = {
  // --- Anfragen list ---------------------------------------------------------------
  "lead.pageTitle": "Anfragen · CRM",
  "lead.title": "Anfragen",
  "lead.subtitle":
    "Eingehende Anfragen aus Webformularen, Import und direkter Erfassung — bereit für die Offerte.",
  "lead.count": "{count} Anfragen",
  "lead.count#one": "{count} Anfrage",
  "lead.count#other": "{count} Anfragen",
  "lead.groupCount": "{count} Gruppen",
  "lead.groupCount#one": "{count} Gruppe",
  "lead.groupCount#other": "{count} Gruppen",
  "lead.refresh": "Aktualisieren",
  "lead.new": "Neue Anfrage",
  "lead.searchPlaceholder": "In Anfragen suchen …",
  "lead.tab.all": "Alle",
  "lead.tab.offered": "Offeriert",
  "lead.group.other": "Sonstige",
  "lead.empty.title": "Noch keine Anfragen importiert",
  "lead.empty.description": "Importieren Sie Anfragen aus Ihren E-Mails oder Webformularen.",
  "lead.empty.action": "Erste Anfrage importieren",
  "lead.noResults": "Keine Anfragen entsprechen Ihrer Suche.",

  // --- Anfrage card ------------------------------------------------------------------
  "lead.card.unknownCustomer": "Unbekannter Kunde",
  "lead.card.new": "Neu",
  "lead.card.offerNumber": "Offerte Nr. {number}",
  "lead.card.offerCreated": "Offerte erstellt",
  "lead.card.languageHint":
    "Sprache des Kunden — Offerte, PDF und E-Mails gehen in dieser Sprache raus.",
  "lead.card.roomsShort": "Zi.",

  // --- Actions -------------------------------------------------------------------------
  "lead.action.viewOffer": "Offerte ansehen",
  "lead.action.newOffer": "Neue Offerte",
  "lead.action.createOffer": "Offerte erstellen",
  "lead.action.besichtigung": "Besichtigung",
  "lead.action.planAppointment": "Termin planen",
  "lead.action.planAppointmentHint": "Termin im Kalender planen",
  "lead.action.editHint": "Anfrage bearbeiten",

  // --- Detail dialog ----------------------------------------------------------------------
  "lead.detail.contact": "Kontakt",
  "lead.detail.address": "Adresse",
  "lead.detail.from": "Von",
  "lead.detail.to": "Nach",
  "lead.detail.appointment": "Termin",
  "lead.detail.rooms": "Zimmer",
  "lead.detail.area": "Fläche",
  "lead.detail.description": "Beschreibung",

  // --- Toasts ------------------------------------------------------------------------------
  "lead.toast.loadFailed": "Anfragen konnten nicht geladen werden.",
  "lead.toast.deleteConfirm": "Diese Anfrage wirklich löschen?",
  "lead.toast.deletedTitle": "Gelöscht",
  "lead.toast.deleted": "Anfrage wurde entfernt.",
  "lead.toast.deleteFailed": "Löschen fehlgeschlagen.",
  "lead.toast.savedTitle": "Gespeichert",

  // --- Edit dialog -------------------------------------------------------------------------
  "lead.edit.title": "Anfrage bearbeiten",
  "lead.edit.description": "{service} — Korrekturen werden direkt auf der Anfrage gespeichert.",
  "lead.edit.saved": "Die Anfrage wurde aktualisiert.",
  "lead.edit.saveFailed": "Die Anfrage konnte nicht gespeichert werden.",

  // --- Section headers ---------------------------------------------------------------------
  "lead.section.contact": "Kontakt",
  "lead.section.extras": "Zusatzleistungen",
  "lead.section.propertyDetails": "Objektdetails",
  "lead.section.additionalAreas": "Zusätzliche Bereiche",
  "lead.section.clearingDetails": "Räumungsdetails",
  "lead.section.disposalDetails": "Entsorgungsdetails",
  "lead.section.storageDetails": "Lagerungsdetails",
  "lead.section.deliveryAddress": "Lieferadresse",
  "lead.section.pianoDetails": "Klavierdetails",
  "lead.section.liftDetails": "Möbellift-Details",
  "lead.section.addressFrom": "Adresse (von)",
  "lead.section.addressTo": "Adresse (nach)",

  // --- Fields --------------------------------------------------------------------------------
  "lead.field.preferredDate": "Wunschtermin",
  "lead.field.customerLanguage": "Sprache des Kunden",
  "lead.field.customerLanguageHint":
    "Sprache für Offerte, PDF und E-Mails an den Kunden — nicht Ihre Dashboard-Sprache. Korrigierbar, wenn die KI falsch geraten hat.",
  "lead.field.descriptionNotes": "Beschreibung / Notizen",
  "lead.field.floor": "Etage",
  "lead.field.hasLift": "Lift vorhanden?",
  "lead.field.hasEstrich": "Estrich vorhanden?",
  "lead.field.hasKeller": "Keller vorhanden?",
  "lead.field.hasKellerGarage": "Keller/Garage vorhanden?",
  "lead.field.rooms": "Zimmer",
  "lead.field.livingSpace": "Wohnfläche (m²)",
  "lead.field.propertyType": "Objekttyp",
  "lead.field.bathrooms": "Badezimmer",
  "lead.field.kitchenType": "Küchentyp",
  "lead.field.cleaningType": "Reinigungsart",
  "lead.field.clearingType": "Räumungsart",
  "lead.field.estimatedVolume": "Geschätztes Volumen",
  "lead.field.heavyItems": "Schwere Gegenstände vorhanden",
  "lead.field.heavyItemsDescription": "Schwere Gegenstände (Beschreibung)",
  "lead.field.disposalType": "Entsorgungsart",
  "lead.field.itemsDescription": "Beschreibung der Gegenstände",
  "lead.field.storageDuration": "Lagerdauer",
  "lead.field.storageVolume": "Volumen",
  "lead.field.accessFrequency": "Zugriffshäufigkeit",
  "lead.field.climateControl": "Klimatisierter Lagerraum benötigt",
  "lead.field.storageItems": "Was wird eingelagert?",
  "lead.field.pianoType": "Klaviertyp",
  "lead.field.pianoBrand": "Marke",
  "lead.field.pianoWeight": "Gewicht (kg)",
  "lead.field.staircaseType": "Treppentyp",
  "lead.field.staircaseWidth": "Treppenbreite (cm)",
  "lead.field.windowAccess": "Fensterzugang möglich (für Kran)",
  "lead.field.liftFloor": "Stockwerk",
  "lead.field.direction": "Richtung",
  "lead.field.dimensions": "Abmessungen",
  "lead.field.liftItems": "Was wird transportiert?",

  // --- Add-on services (checkboxes) -------------------------------------------------------
  "lead.extra.packing": "Einpackservice",
  "lead.extra.furnitureAssembly": "Möbelmontage",
  "lead.extra.cleaning": "Reinigung",
  "lead.extra.storage": "Einlagerung",
  "lead.extra.piano": "Klaviertransport",
  "lead.extra.balcony": "Balkon/Terrasse",
  "lead.extra.garage": "Garage",
  "lead.extra.basement": "Keller",
  "lead.extra.attic": "Estrich/Dachboden",

  // --- Placeholders ------------------------------------------------------------------------
  "lead.placeholder.phone": "+41 79 123 45 67",
  "lead.placeholder.pianoBrand": "z.B. Steinway, Yamaha",
  "lead.placeholder.pianoWeight": "ca. 200-500 kg",
  "lead.placeholder.staircaseWidth": "z.B. 90, 100",
  "lead.placeholder.dimensions": "z.B. 200 × 100 × 50 cm",
  "lead.placeholder.liftItems": "Was soll mit dem Möbellift transportiert werden …",
  "lead.placeholder.heavyItems": "Beschreibung der schweren Gegenstände …",
  "lead.placeholder.disposalItems": "Was soll entsorgt werden …",
  "lead.placeholder.storageItems": "Beschreibung der Lagergüter …",
  "lead.placeholder.preferredTime": "z.B. 09:00, Morgen, Nachmittag",

  // --- Select option labels (the stored VALUES stay German DB tokens) ----------------------
  "lead.option.property.wohnung": "Wohnung",
  "lead.option.property.haus": "Haus",
  "lead.option.property.studio": "Studio",
  "lead.option.property.buero": "Büro",
  "lead.option.property.keller": "Keller",
  "lead.option.property.estrich": "Estrich",
  "lead.option.kitchen.offen": "Offene Küche",
  "lead.option.kitchen.geschlossen": "Geschlossene Küche",
  "lead.option.kitchen.kochnische": "Kochnische",
  "lead.option.cleaning.end": "Endreinigung",
  "lead.option.cleaning.grund": "Grundreinigung",
  "lead.option.cleaning.unterhalt": "Unterhaltsreinigung",
  "lead.option.clearing.wohnung": "Wohnungsräumung",
  "lead.option.clearing.haus": "Hausräumung",
  "lead.option.clearing.keller": "Kellerräumung",
  "lead.option.clearing.dachboden": "Dachbodenräumung",
  "lead.option.clearing.buero": "Büroräumung",
  "lead.option.clearingVolume.klein": "Klein (wenige Gegenstände)",
  "lead.option.clearingVolume.mittel": "Mittel (teilmöbliert)",
  "lead.option.clearingVolume.gross": "Gross (vollmöbliert)",
  "lead.option.clearingVolume.sehrGross": "Sehr gross (überfüllt)",
  "lead.option.disposal.sperrmuell": "Sperrmüll",
  "lead.option.disposal.elektroschrott": "Elektroschrott",
  "lead.option.disposal.bauschutt": "Bauschutt",
  "lead.option.disposal.hausrat": "Hausrat",
  "lead.option.disposal.moebel": "Möbel",
  "lead.option.disposal.gemischt": "Gemischt",
  "lead.option.disposalVolume.klein": "Klein (1-2 m³)",
  "lead.option.disposalVolume.mittel": "Mittel (3-5 m³)",
  "lead.option.disposalVolume.gross": "Gross (6-10 m³)",
  "lead.option.disposalVolume.sehrGross": "Sehr gross (10+ m³)",
  "lead.option.storageDuration.kurzfristig": "Kurzfristig (wenige Tage)",
  "lead.option.storageDuration.m1_3": "1-3 Monate",
  "lead.option.storageDuration.m3_6": "3-6 Monate",
  "lead.option.storageDuration.m6_12": "6-12 Monate",
  "lead.option.storageDuration.langfristig": "Langfristig (1+ Jahr)",
  "lead.option.storageVolume.klein": "Klein (1-5 m³)",
  "lead.option.storageVolume.mittel": "Mittel (5-15 m³)",
  "lead.option.storageVolume.gross": "Gross (15-30 m³)",
  "lead.option.storageVolume.sehrGross": "Sehr gross (30+ m³)",
  "lead.option.access.nie": "Kein Zugriff nötig",
  "lead.option.access.selten": "Selten",
  "lead.option.access.monatlich": "Monatlich",
  "lead.option.access.woechentlich": "Wöchentlich",
  "lead.option.piano.klavier": "Klavier (aufrecht)",
  "lead.option.piano.fluegel": "Flügel",
  "lead.option.piano.ePiano": "E-Piano",
  "lead.option.piano.keyboard": "Keyboard",
  "lead.option.staircase.keine": "Keine Treppe",
  "lead.option.staircase.gerade": "Gerade Treppe",
  "lead.option.staircase.kurvig": "Kurvige Treppe",
  "lead.option.staircase.wendel": "Wendeltreppe",
  "lead.option.direction.hoch": "Hoch (Einzug)",
  "lead.option.direction.runter": "Runter (Auszug)",
  "lead.option.direction.beides": "Beides",

  // --- Validation ----------------------------------------------------------------------------
  "lead.validation.invalidEmail": "Ungültige E-Mail",
  "lead.validation.invalidEmailHint": "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  "lead.validation.invalidPhone": "Ungültige Telefonnummer",
  "lead.validation.invalidPhoneHint":
    "Bitte geben Sie eine gültige Schweizer Telefonnummer ein (z.B. +41 79 123 45 67).",
  "lead.validation.invalidPlz": "Ungültige PLZ",
  "lead.validation.invalidPlzSection": "{section}: PLZ muss 4-stellig sein.",
  "lead.validation.invalidPlzValue": "{field}: «{plz}» ist keine gültige Schweizer PLZ (4 Ziffern).",
  "lead.validation.plzRequired": "PLZ erforderlich",
  "lead.validation.plzRequiredHint":
    "{field} ist für diesen Servicetyp erforderlich. Bitte geben Sie eine gültige Schweizer PLZ (4 Ziffern) ein.",
  "lead.validation.invalidDate": "Ungültiges Datum",
  "lead.validation.invalidDateHint": "Bitte geben Sie ein gültiges Datum ein.",
  "lead.validation.missingCustomer": "Fehlende Kundendaten",
  "lead.validation.missingCustomerHint":
    "Bei niedriger AI-Konfidenz muss mindestens ein Name angegeben werden.",
  "lead.plz.from": "Von PLZ",
  "lead.plz.to": "Nach PLZ",
  "lead.plz.address": "Adresse PLZ",
  "lead.plz.pickup": "Abhol-PLZ",

  // --- Manual import ---------------------------------------------------------------------------
  "lead.import.pageTitle": "Manuelle Anfrage Import | {company}",
  "lead.import.title": "Anfrage importieren",
  "lead.import.subtitle":
    "Anfrage aus E-Mail oder Webformular einfügen — die KI erkennt Service-Typ und extrahiert alle Informationen.",
  "lead.import.step1": "Schritt 1: Anfrage-Text einfügen",
  "lead.import.step2": "Schritt 2: Extrahierte Daten überprüfen",
  "lead.import.step2Hint": "Überprüfen und korrigieren Sie die extrahierten Daten",
  "lead.import.textPlaceholder": `Kopieren Sie hier die gesamte Anfrage aus Ihrer E-Mail oder Webformular …

Beispiele für verschiedene Anfragen:

📦 UMZUG:
Von: max.mustermann@email.com
Ich brauche einen Umzug von Zürich nach Bern.
Auszug: Hauptstrasse 123, 8001 Zürich, 3. OG
Einzug: Bahnhofplatz 5, 3011 Bern, EG
3.5 Zimmer, 80m², Datum: 15.02.2025

🧹 REINIGUNG:
Guten Tag, ich brauche eine Endreinigung.
Adresse: Seestrasse 45, 8800 Thalwil
4 Zimmer Wohnung, 95m², 2 Bäder
Mit Balkon und Keller

🎹 KLAVIERTRANSPORT:
Wir möchten einen Flügel transportieren.
Von: Bahnhofstr. 10, 8001 Zürich (2. Stock)
Nach: Seeweg 5, 6300 Zug (Erdgeschoss)
Steinway Flügel, ca. 350kg`,
  "lead.import.textAria": "Anfrage-Text eingeben",
  "lead.import.minChars": "Mindestens {count} Zeichen erforderlich",
  "lead.import.charCount": "{current} / {max} Zeichen",
  "lead.import.moreDetails": "Bitte geben Sie mehr Details ein ({count} Zeichen fehlen).",
  "lead.import.extract": "Mit AI extrahieren",
  "lead.import.processing": "Verarbeite …",
  "lead.import.stepAnalyzing": "Analysiere Text …",
  "lead.import.stepExtracting": "Extrahiere Daten mit AI …",
  "lead.import.resetAria": "Text zurücksetzen",
  "lead.import.detectedService": "Erkannter Service-Typ",
  "lead.import.confidence": "AI-Konfidenz",
  "lead.import.lowConfidence": "Bitte überprüfen Sie die extrahierten Daten sorgfältig.",
  "lead.import.contactInfo": "Kontaktinformation",
  "lead.import.languageSection": "Sprache des Kunden",
  "lead.import.languageLabel": "Der Kunde hat geschrieben auf",
  "lead.import.languageHint":
    "Von der KI erkannt. In dieser Sprache erhält der Kunde Offerte, PDF und E-Mails. Ihre eigene Ansicht im Dashboard bleibt davon unberührt.",
  "lead.import.appointment": "Termin",
  "lead.import.preferredDate": "Wunschdatum",
  "lead.import.preferredTime": "Uhrzeit / Zeitraum",
  "lead.import.specialNotes": "Besondere Hinweise",
  "lead.import.backAria": "Zurück zur Texteingabe",
  "lead.import.save": "Anfrage speichern",
  "lead.import.saving": "Speichere …",
  "lead.import.discardTitle": "Änderungen verwerfen?",
  "lead.import.discardDescription":
    "Sie haben ungespeicherte Änderungen. Wenn Sie zurückgehen, gehen alle Änderungen verloren. Möchten Sie wirklich fortfahren?",
  "lead.import.discardConfirm": "Verwerfen & Zurück",
  "lead.import.companyLoadFailed": "Firmendaten konnten nicht geladen werden.",
  "lead.import.textTooShort": "Text zu kurz",
  "lead.import.textTooShortHint": "Bitte geben Sie mindestens {count} Zeichen ein.",
  "lead.import.textTooLong": "Text zu lang",
  "lead.import.textTooLongHint": "Bitte kürzen Sie den Text auf maximal {count} Zeichen.",
  "lead.import.extracted": "Daten extrahiert",
  "lead.import.extractedHint": "Service: {service} | AI-Konfidenz: {score}%",
  "lead.import.extractFailed": "Extraktion fehlgeschlagen",
  "lead.import.sessionExpired": "Sitzung abgelaufen",
  "lead.import.sessionExpiredHint": "Bitte laden Sie die Seite neu oder melden Sie sich erneut an.",
  "lead.import.imported": "Anfrage importiert",
  "lead.import.importedHint":
    "Die Anfrage wurde erfolgreich importiert und ist jetzt in Ihren Anfragen sichtbar.",
  "lead.import.saveFailed": "Fehler beim Speichern",

  // --- Error messages ---------------------------------------------------------------------------
  "lead.error.network": "Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.",
  "lead.error.timeout": "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.",
  "lead.error.unauthorized": "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  "lead.error.rateLimit": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
  "lead.error.importFailed": "Import fehlgeschlagen",
  "lead.error.unexpected": "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",

  // --- Anfrage summary on an appointment ---------------------------------------------------------
  "lead.summary.title": "Anfrage-Details",
  "lead.summary.moveOut": "Auszug",
  "lead.summary.moveIn": "Einzug",
  "lead.summary.lift": "Lift",
  "lead.summary.noLift": "Kein Lift",
  "lead.summary.estrich": "Estrich",
  "lead.summary.keller": "Keller",
  "lead.summary.rooms": "{count} Zi.",
  "lead.floor.basement": "UG",
  "lead.floor.ground": "Erdgeschoss",
  "lead.floor.upper": "{floor}. OG",
} as const;
