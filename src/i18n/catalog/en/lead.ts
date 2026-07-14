import { lead as de } from "@/i18n/catalog/de/lead";

export const lead: Record<keyof typeof de, string> = {
  // --- Anfragen list ---------------------------------------------------------------
  "lead.pageTitle": "Enquiries · CRM",
  "lead.title": "Enquiries",
  "lead.subtitle":
    "Incoming enquiries from web forms, imports and direct entry — ready to be quoted.",
  "lead.count": "{count} enquiries",
  "lead.count#one": "{count} enquiry",
  "lead.count#other": "{count} enquiries",
  "lead.groupCount": "{count} groups",
  "lead.groupCount#one": "{count} group",
  "lead.groupCount#other": "{count} groups",
  "lead.refresh": "Refresh",
  "lead.new": "New enquiry",
  "lead.searchPlaceholder": "Search enquiries …",
  "lead.tab.all": "All",
  "lead.tab.offered": "Quoted",
  "lead.group.other": "Other",
  "lead.empty.title": "No enquiries imported yet",
  "lead.empty.description": "Import enquiries from your e-mails or web forms.",
  "lead.empty.action": "Import your first enquiry",
  "lead.noResults": "No enquiries match your search.",

  // --- Anfrage card ------------------------------------------------------------------
  "lead.card.unknownCustomer": "Unknown customer",
  "lead.card.new": "New",
  "lead.card.offerNumber": "Quote no. {number}",
  "lead.card.offerCreated": "Quote created",
  "lead.card.languageHint":
    "The customer's language — the quote, PDF and e-mails go out in this language.",
  "lead.card.roomsShort": "rms",

  // --- Actions -------------------------------------------------------------------------
  "lead.action.viewOffer": "View quote",
  "lead.action.newOffer": "New quote",
  "lead.action.createOffer": "Create quote",
  "lead.action.besichtigung": "Survey",
  "lead.action.planAppointment": "Schedule appointment",
  "lead.action.planAppointmentHint": "Schedule the appointment in the calendar",
  "lead.action.editHint": "Edit enquiry",

  // --- Detail dialog ----------------------------------------------------------------------
  "lead.detail.contact": "Contact",
  "lead.detail.address": "Address",
  "lead.detail.from": "From",
  "lead.detail.to": "To",
  "lead.detail.appointment": "Appointment",
  "lead.detail.rooms": "Rooms",
  "lead.detail.area": "Floor area",
  "lead.detail.description": "Description",

  // --- Toasts ------------------------------------------------------------------------------
  "lead.toast.loadFailed": "The enquiries could not be loaded.",
  "lead.toast.deleteConfirm": "Delete this enquiry?",
  "lead.toast.deletedTitle": "Deleted",
  "lead.toast.deleted": "The enquiry has been removed.",
  "lead.toast.deleteFailed": "Deletion failed.",
  "lead.toast.savedTitle": "Saved",

  // --- Edit dialog -------------------------------------------------------------------------
  "lead.edit.title": "Edit enquiry",
  "lead.edit.description": "{service} — corrections are saved directly on the enquiry.",
  "lead.edit.saved": "The enquiry has been updated.",
  "lead.edit.saveFailed": "The enquiry could not be saved.",

  // --- Section headers ---------------------------------------------------------------------
  "lead.section.contact": "Contact",
  "lead.section.extras": "Additional services",
  "lead.section.propertyDetails": "Property details",
  "lead.section.additionalAreas": "Additional areas",
  "lead.section.clearingDetails": "Clearance details",
  "lead.section.disposalDetails": "Disposal details",
  "lead.section.storageDetails": "Storage details",
  "lead.section.deliveryAddress": "Delivery address",
  "lead.section.pianoDetails": "Piano details",
  "lead.section.liftDetails": "Furniture lift details",
  "lead.section.addressFrom": "Address (from)",
  "lead.section.addressTo": "Address (to)",

  // --- Fields --------------------------------------------------------------------------------
  "lead.field.preferredDate": "Preferred date",
  "lead.field.customerLanguage": "Customer's language",
  "lead.field.customerLanguageHint":
    "The language of the quote, PDF and e-mails sent to the customer — not your dashboard language. Correct it if the AI guessed wrong.",
  "lead.field.descriptionNotes": "Description / notes",
  "lead.field.floor": "Floor",
  "lead.field.hasLift": "Lift available?",
  "lead.field.hasEstrich": "Attic available?",
  "lead.field.hasKeller": "Cellar available?",
  "lead.field.hasKellerGarage": "Cellar/garage available?",
  "lead.field.rooms": "Rooms",
  "lead.field.livingSpace": "Living space (m²)",
  "lead.field.propertyType": "Property type",
  "lead.field.bathrooms": "Bathrooms",
  "lead.field.kitchenType": "Kitchen type",
  "lead.field.cleaningType": "Cleaning type",
  "lead.field.clearingType": "Clearance type",
  "lead.field.estimatedVolume": "Estimated volume",
  "lead.field.heavyItems": "Heavy items present",
  "lead.field.heavyItemsDescription": "Heavy items (description)",
  "lead.field.disposalType": "Disposal type",
  "lead.field.itemsDescription": "Description of the items",
  "lead.field.storageDuration": "Storage period",
  "lead.field.storageVolume": "Volume",
  "lead.field.accessFrequency": "Access frequency",
  "lead.field.climateControl": "Climate-controlled storage required",
  "lead.field.storageItems": "What is being stored?",
  "lead.field.pianoType": "Piano type",
  "lead.field.pianoBrand": "Make",
  "lead.field.pianoWeight": "Weight (kg)",
  "lead.field.staircaseType": "Staircase type",
  "lead.field.staircaseWidth": "Staircase width (cm)",
  "lead.field.windowAccess": "Window access possible (for the crane)",
  "lead.field.liftFloor": "Floor",
  "lead.field.direction": "Direction",
  "lead.field.dimensions": "Dimensions",
  "lead.field.liftItems": "What is being transported?",

  // --- Add-on services (checkboxes) -------------------------------------------------------
  "lead.extra.packing": "Packing service",
  "lead.extra.furnitureAssembly": "Furniture assembly",
  "lead.extra.cleaning": "Cleaning",
  "lead.extra.storage": "Storage",
  "lead.extra.piano": "Piano transport",
  "lead.extra.balcony": "Balcony/terrace",
  "lead.extra.garage": "Garage",
  "lead.extra.basement": "Cellar",
  "lead.extra.attic": "Attic/loft",

  // --- Placeholders ------------------------------------------------------------------------
  "lead.placeholder.phone": "+41 79 123 45 67",
  "lead.placeholder.pianoBrand": "e.g. Steinway, Yamaha",
  "lead.placeholder.pianoWeight": "approx. 200-500 kg",
  "lead.placeholder.staircaseWidth": "e.g. 90, 100",
  "lead.placeholder.dimensions": "e.g. 200 × 100 × 50 cm",
  "lead.placeholder.liftItems": "What is to be moved with the furniture lift …",
  "lead.placeholder.heavyItems": "Description of the heavy items …",
  "lead.placeholder.disposalItems": "What is to be disposed of …",
  "lead.placeholder.storageItems": "Description of the goods to be stored …",
  "lead.placeholder.preferredTime": "e.g. 09:00, morning, afternoon",

  // --- Select option labels (the stored VALUES stay German DB tokens) ----------------------
  "lead.option.property.wohnung": "Flat",
  "lead.option.property.haus": "House",
  "lead.option.property.studio": "Studio",
  "lead.option.property.buero": "Office",
  "lead.option.property.keller": "Cellar",
  "lead.option.property.estrich": "Attic",
  "lead.option.kitchen.offen": "Open kitchen",
  "lead.option.kitchen.geschlossen": "Closed kitchen",
  "lead.option.kitchen.kochnische": "Kitchenette",
  "lead.option.cleaning.end": "End-of-tenancy cleaning",
  "lead.option.cleaning.grund": "Deep cleaning",
  "lead.option.cleaning.unterhalt": "Maintenance cleaning",
  "lead.option.clearing.wohnung": "Flat clearance",
  "lead.option.clearing.haus": "House clearance",
  "lead.option.clearing.keller": "Cellar clearance",
  "lead.option.clearing.dachboden": "Loft clearance",
  "lead.option.clearing.buero": "Office clearance",
  "lead.option.clearingVolume.klein": "Small (a few items)",
  "lead.option.clearingVolume.mittel": "Medium (partly furnished)",
  "lead.option.clearingVolume.gross": "Large (fully furnished)",
  "lead.option.clearingVolume.sehrGross": "Very large (overfilled)",
  "lead.option.disposal.sperrmuell": "Bulky waste",
  "lead.option.disposal.elektroschrott": "Electrical waste",
  "lead.option.disposal.bauschutt": "Construction rubble",
  "lead.option.disposal.hausrat": "Household goods",
  "lead.option.disposal.moebel": "Furniture",
  "lead.option.disposal.gemischt": "Mixed",
  "lead.option.disposalVolume.klein": "Small (1-2 m³)",
  "lead.option.disposalVolume.mittel": "Medium (3-5 m³)",
  "lead.option.disposalVolume.gross": "Large (6-10 m³)",
  "lead.option.disposalVolume.sehrGross": "Very large (10+ m³)",
  "lead.option.storageDuration.kurzfristig": "Short term (a few days)",
  "lead.option.storageDuration.m1_3": "1-3 months",
  "lead.option.storageDuration.m3_6": "3-6 months",
  "lead.option.storageDuration.m6_12": "6-12 months",
  "lead.option.storageDuration.langfristig": "Long term (1+ year)",
  "lead.option.storageVolume.klein": "Small (1-5 m³)",
  "lead.option.storageVolume.mittel": "Medium (5-15 m³)",
  "lead.option.storageVolume.gross": "Large (15-30 m³)",
  "lead.option.storageVolume.sehrGross": "Very large (30+ m³)",
  "lead.option.access.nie": "No access needed",
  "lead.option.access.selten": "Rarely",
  "lead.option.access.monatlich": "Monthly",
  "lead.option.access.woechentlich": "Weekly",
  "lead.option.piano.klavier": "Upright piano",
  "lead.option.piano.fluegel": "Grand piano",
  "lead.option.piano.ePiano": "Digital piano",
  "lead.option.piano.keyboard": "Keyboard",
  "lead.option.staircase.keine": "No staircase",
  "lead.option.staircase.gerade": "Straight staircase",
  "lead.option.staircase.kurvig": "Curved staircase",
  "lead.option.staircase.wendel": "Spiral staircase",
  "lead.option.direction.hoch": "Upwards (move in)",
  "lead.option.direction.runter": "Downwards (move out)",
  "lead.option.direction.beides": "Both",

  // --- Validation ----------------------------------------------------------------------------
  "lead.validation.invalidEmail": "Invalid e-mail address",
  "lead.validation.invalidEmailHint": "Please enter a valid e-mail address.",
  "lead.validation.invalidPhone": "Invalid phone number",
  "lead.validation.invalidPhoneHint":
    "Please enter a valid Swiss phone number (e.g. +41 79 123 45 67).",
  "lead.validation.invalidPlz": "Invalid postcode",
  "lead.validation.invalidPlzSection": "{section}: the postcode must have 4 digits.",
  "lead.validation.invalidPlzValue":
    "{field}: “{plz}” is not a valid Swiss postcode (4 digits).",
  "lead.validation.plzRequired": "Postcode required",
  "lead.validation.plzRequiredHint":
    "{field} is required for this service type. Please enter a valid Swiss postcode (4 digits).",
  "lead.validation.invalidDate": "Invalid date",
  "lead.validation.invalidDateHint": "Please enter a valid date.",
  "lead.validation.missingCustomer": "Missing customer details",
  "lead.validation.missingCustomerHint":
    "When the AI confidence is low, at least one name must be provided.",
  "lead.plz.from": "Postcode (from)",
  "lead.plz.to": "Postcode (to)",
  "lead.plz.address": "Postcode (address)",
  "lead.plz.pickup": "Postcode (collection)",

  // --- Manual import ---------------------------------------------------------------------------
  "lead.import.pageTitle": "Manual enquiry import | {company}",
  "lead.import.title": "Import enquiry",
  "lead.import.subtitle":
    "Paste an enquiry from an e-mail or web form — the AI identifies the service type and extracts all the details.",
  "lead.import.step1": "Step 1: paste the enquiry text",
  "lead.import.step2": "Step 2: review the extracted data",
  "lead.import.step2Hint": "Review and correct the extracted data",
  "lead.import.textPlaceholder": `Paste the complete enquiry from your e-mail or web form here …

Examples of enquiries:

📦 REMOVAL:
From: max.mustermann@email.com
I need a removal from Zurich to Bern.
Move out: Hauptstrasse 123, 8001 Zurich, 3rd floor
Move in: Bahnhofplatz 5, 3011 Bern, ground floor
3.5 rooms, 80 m², date: 15.02.2025

🧹 CLEANING:
Hello, I need an end-of-tenancy clean.
Address: Seestrasse 45, 8800 Thalwil
4-room flat, 95 m², 2 bathrooms
With balcony and cellar

🎹 PIANO TRANSPORT:
We would like to move a grand piano.
From: Bahnhofstr. 10, 8001 Zurich (2nd floor)
To: Seeweg 5, 6300 Zug (ground floor)
Steinway grand piano, approx. 350 kg`,
  "lead.import.textAria": "Enter the enquiry text",
  "lead.import.minChars": "At least {count} characters required",
  "lead.import.charCount": "{current} / {max} characters",
  "lead.import.moreDetails": "Please provide more detail ({count} characters missing).",
  "lead.import.extract": "Extract with AI",
  "lead.import.processing": "Processing …",
  "lead.import.stepAnalyzing": "Analysing text …",
  "lead.import.stepExtracting": "Extracting data with AI …",
  "lead.import.resetAria": "Reset the text",
  "lead.import.detectedService": "Detected service type",
  "lead.import.confidence": "AI confidence",
  "lead.import.lowConfidence": "Please review the extracted data carefully.",
  "lead.import.contactInfo": "Contact details",
  "lead.import.languageSection": "Customer's language",
  "lead.import.languageLabel": "The customer wrote in",
  "lead.import.languageHint":
    "Detected by the AI. The customer receives the quote, PDF and e-mails in this language. Your own view of the dashboard is unaffected.",
  "lead.import.appointment": "Appointment",
  "lead.import.preferredDate": "Preferred date",
  "lead.import.preferredTime": "Time / time slot",
  "lead.import.specialNotes": "Special notes",
  "lead.import.backAria": "Back to the text entry",
  "lead.import.save": "Save enquiry",
  "lead.import.saving": "Saving …",
  "lead.import.discardTitle": "Discard changes?",
  "lead.import.discardDescription":
    "You have unsaved changes. If you go back, all changes will be lost. Do you really want to continue?",
  "lead.import.discardConfirm": "Discard & go back",
  "lead.import.companyLoadFailed": "The company data could not be loaded.",
  "lead.import.textTooShort": "Text too short",
  "lead.import.textTooShortHint": "Please enter at least {count} characters.",
  "lead.import.textTooLong": "Text too long",
  "lead.import.textTooLongHint": "Please shorten the text to {count} characters at most.",
  "lead.import.extracted": "Data extracted",
  "lead.import.extractedHint": "Service: {service} | AI confidence: {score}%",
  "lead.import.extractFailed": "Extraction failed",
  "lead.import.sessionExpired": "Session expired",
  "lead.import.sessionExpiredHint": "Please reload the page or sign in again.",
  "lead.import.imported": "Enquiry imported",
  "lead.import.importedHint":
    "The enquiry was imported successfully and now appears in your enquiries.",
  "lead.import.saveFailed": "Error while saving",

  // --- Error messages ---------------------------------------------------------------------------
  "lead.error.network": "Network error. Please check your internet connection.",
  "lead.error.timeout": "The request took too long. Please try again.",
  "lead.error.unauthorized": "Your session has expired. Please sign in again.",
  "lead.error.rateLimit": "Too many requests. Please wait a moment.",
  "lead.error.importFailed": "Import failed",
  "lead.error.unexpected": "An unexpected error occurred. Please try again.",

  // --- Anfrage summary on an appointment ---------------------------------------------------------
  "lead.summary.title": "Enquiry details",
  "lead.summary.moveOut": "Move out",
  "lead.summary.moveIn": "Move in",
  "lead.summary.lift": "Lift",
  "lead.summary.noLift": "No lift",
  "lead.summary.estrich": "Attic",
  "lead.summary.keller": "Cellar",
  "lead.summary.rooms": "{count} rms",
  "lead.floor.basement": "Basement",
  "lead.floor.ground": "Ground floor",
  "lead.floor.upper": "Floor {floor}",
};
