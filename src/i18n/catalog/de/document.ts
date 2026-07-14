/**
 * Customer-facing document text: Offerte, Rechnung, Quittung, Auftrag, Boxen.
 *
 * Every key here is rendered in the CUSTOMER's language, never the operator's.
 * The renderers take the locale as an argument (see src/i18n/locale.ts) — nothing
 * in this namespace may be resolved from React context.
 */
export const document = {
  // --- Offerte: wordmark ---------------------------------------------------------
  // The classic/modern headers paint the wordmark in two tones by splitting it.
  // The split point differs per language, so the halves are separate keys rather
  // than a substring operation on one word.
  "doc.offer.wordmark.head": "OFFER",
  "doc.offer.wordmark.tail": "TE",

  "doc.offer.title": "Offerte",
  "doc.offer.titleFor": "{service}-Offerte",
  "doc.offer.number": "Offerte-Nr.",
  "doc.offer.numberShort": "Nr.",
  "doc.offer.numbered": "Offerte Nr. {number}",
  "doc.offer.date": "Datum",
  "doc.offer.validUntil": "Gültig bis",
  "doc.offer.validUntilDate": "Gültig bis: {date}",
  "doc.offer.offerValidUntil": "Angebot gültig bis {date}",
  "doc.offer.customer": "Auftraggeber",
  "doc.offer.details": "Offerte-Details",
  "doc.offer.vatNumber": "MwSt-Nr.",
  "doc.offer.serviceKind": "Leistungsart:",
  "doc.offer.tableContinued": "Leistungstabelle — Fortsetzung",
  "doc.offer.intro":
    "Vielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen die folgende Offerte unterbreiten zu dürfen.",

  // --- Offerte: sections ---------------------------------------------------------
  "doc.offer.section.scope": "LEISTUNGSUMFANG",
  "doc.offer.section.payment": "ZAHLUNG",
  "doc.offer.section.insurance": "VERSICHERUNG",
  "doc.offer.section.remarks": "BEMERKUNGEN",
  "doc.offer.section.glance": "AUF EINEN BLICK",
  "doc.offer.section.customer": "AUFTRAGGEBER",
  "doc.offer.section.offerDetails": "OFFERTE-DETAILS",
  "doc.offer.section.serviceDetails": "Service-Details",
  "doc.offer.paymentTerms": "Zahlungskondition:",

  // --- Offerte: at-a-glance (modern) ---------------------------------------------
  "doc.offer.glance.for": "Für",
  "doc.offer.glance.appointment": "Termin",
  "doc.offer.glance.total": "Gesamtbetrag",
  "doc.offer.glance.price": "Preis",

  // --- Offerte: totals ------------------------------------------------------------
  "doc.offer.subtotal": "Zwischensumme",
  "doc.offer.surcharge": "Zuschlag",
  "doc.offer.discount": "Rabatt {percent} %",
  "doc.offer.totalExclVat": "Total exkl. MwSt",
  "doc.offer.vat": "MwSt {rate} %",
  "doc.offer.grandTotal": "GESAMTBETRAG",
  "doc.offer.upTo": "bis ",

  // --- Offerte: price models -------------------------------------------------------
  "doc.offer.priceModel": "Preismodell:",
  "doc.offer.hourlyRate": "Stundenansatz — CHF {rate} / Std.",
  "doc.offer.hourlyRateNote":
    "Die Abrechnung erfolgt nach effektivem Zeitaufwand zum angegebenen Stundenansatz.",
  "doc.offer.hourlyWithCap": "Stundenansatz CHF {rate} / Std. — Kostendach max. CHF {cap}",
  "doc.offer.costCap": "Kostendach:",
  "doc.offer.costCapMax": "max. CHF {cap}",
  "doc.offer.costCapDetail": "Stundenansatz {rate}/Std. — max. CHF {cap} ({hours} Std.)",
  "doc.offer.costCapHours": "Kostendach: max. CHF {cap} (bei {hours} Std.)",
  "doc.offer.costCapNote":
    "Sie zahlen maximal CHF {cap}, unabhängig vom tatsächlichen Zeitaufwand.",
  // German built this with an accusative article table ("Sie zahlen für den Umzug …").
  // Naming the service instead keeps the sentence translatable without a case system.
  "doc.offer.costCapGlance": "Sie zahlen für {service} nie mehr als das Kostendach.",
  "doc.offer.costCapExtras": "Zzgl. {parts} (siehe unten).",
  // Conjunction for the enumeration inside costCapExtras ("… X und Y (siehe unten).").
  "doc.offer.listAnd": "und",
  "doc.offer.rateAggregateNote":
    "Der Gesamtpreis ergibt sich aus den Positionen nach Aufwand (siehe Details oben) zzgl. allfälliger Fixpositionen.",
  "doc.offer.flatRate": "Pauschal",
  "doc.offer.rateRange": "{min}–{max} Std. à {rate}/Std.",
  "doc.offer.perHour": "à {rate}/Stunde",
  "doc.offer.from": "ab ",
  "doc.offer.plus": "zzgl. ",

  // --- Offerte: item meta ------------------------------------------------------------
  "doc.offer.item.object": "OBJEKT",
  "doc.offer.item.tariff": "TARIF",
  "doc.offer.item.handover": "inkl. Abnahme mit der Verwaltung",
  "doc.offer.item.estimatedVolume": "geschätztes Volumen {volume}",
  "doc.offer.item.approxM2": "ca. {value} m²",
  "doc.offer.item.approxM3": "ca. {value} m³",
  "doc.offer.item.crew": "{count} Mitarbeiter",
  "doc.offer.item.vehicles": " Fahrzeuge",
  // Menge-/Einzelpreis-Kontextzeile unter der Position ("3 Stunden à CHF 120.00").
  "doc.offer.item.quantityAtPrice": "{quantity} à {price}",

  // --- Offerte: time-estimate breakdown -------------------------------------------------
  "doc.offer.breakdown.volume": "Volumen: ",
  "doc.offer.breakdown.workTime": "Geschätzte Arbeitszeit: ",
  "doc.offer.breakdown.carryTime": "Tragezeit: ",
  "doc.offer.breakdown.assembly": "Montage/Demontage: ",
  "doc.offer.breakdown.driveTime": "Fahrzeit: ",
  "doc.offer.breakdown.buffer": "Pufferzeit: ",
  "doc.offer.breakdown.truckType": "LKW Typ: ",
  "doc.offer.breakdown.crewSize": "Anzahl Mitarbeiter: ",

  // --- Offerte: blind offer (no on-site survey) -------------------------------------------
  "doc.offer.blind.badge": "BLIND OFFERTE — Ohne Besichtigung",
  "doc.offer.blind.label": "Wichtiger Hinweis",
  "doc.offer.blind.text":
    "Diese Offerte wurde ohne persönliche Besichtigung erstellt und basiert ausschliesslich auf den Angaben des Kunden. Die aufgeführten Preise sind Schätzungen. Allfällige Anpassungen werden vor Auftragserteilung in Absprache mit dem Kunden vorgenommen.",
  "doc.offer.blind.timeNote":
    "Diese Offerte basiert auf Kundenangaben ohne persönliche Besichtigung. Preise sind Schätzungen und können nach Besichtigung angepasst werden. Die Zeitschätzungen pro Position sind als Rahmen zu verstehen.",
  "doc.offer.type.blind": "Offerte-Art: Blind Offerte (ohne Besichtigung)",
  // Bare value — for the label/value rows that carry "Offerte-Art" as a separate label.
  "doc.offer.type.blindShort": "Blind Offerte (ohne Besichtigung)",
  "doc.offer.type.normal": "Normal Offerte (nach Besichtigung)",
  "doc.offer.type": "Offerte-Art",
  // Composed line — keeps the colon spacing in the hands of the translation (French: "… : …").
  "doc.offer.typeValue": "Offerte-Art: {value}",

  // --- Offerte: included / excluded services -------------------------------------------
  "doc.offer.included.title": "Im Preis inbegriffen",
  "doc.offer.includedShort": "Inklusive",
  "doc.offer.excluded.title": "Nicht enthalten / Zusatzkosten",
  "doc.offer.excluded.hint":
    "Endgültige Zusatzkosten werden nur nach vorgängiger Rücksprache verrechnet.",
  "doc.offer.included.default.insurance": "Transport- und Betriebshaftpflichtversicherung",
  "doc.offer.included.default.staff": "Umzugsfachkräfte (inkl. Spesen)",
  "doc.offer.included.default.vehicles": "Fahrzeuge und Treibstoff",
  "doc.offer.included.default.travel": "An- und Abfahrt",
  "doc.offer.included.default.equipment": "Befestigungsgurte, Schutzmaterial, Werkzeuge",
  "doc.offer.excluded.default.hazardous":
    "Sonderentsorgung (z. B. Chemikalien, Asbest, Gefahrgut)",
  "doc.offer.excluded.default.permits": "Parkbewilligungen, externe Lift-/Kranmiete",
  "doc.offer.excluded.default.extraScope": "Zusatzaufwand bei abweichendem Leistungsumfang",

  // --- Offerte: signature / acceptance ---------------------------------------------------
  "doc.offer.confirm.title": "Auftragsbestätigung",
  "doc.offer.confirm.text":
    "Hiermit erteile ich der Firma {company} den in dieser Offerte (Nr. {number}) beschriebenen Auftrag.\n\nIch bestätige, dass ich die Offerte sowie die allgemeinen Geschäftsbedingungen gelesen und verstanden habe und mit allen Punkten einverstanden bin.",
  // Einabsatz-Variante für die kompakte Bestätigungskarte der modernen Vorlage.
  "doc.offer.confirm.textCompact":
    "Hiermit erteile ich der Firma {company} den in dieser Offerte (Nr. {number}) beschriebenen Auftrag und bestätige, dass ich die Offerte sowie die allgemeinen Geschäftsbedingungen gelesen und verstanden habe und mit allen Punkten einverstanden bin.",
  "doc.offer.confirm.placeDate": "Ort, Datum",
  "doc.offer.confirm.placeDateSignature": "Ort, Datum, Unterschrift",
  "doc.offer.confirm.signatureCustomer": "Unterschrift Auftraggeber · {name}",
  "doc.offer.confirm.signatureContractor": "Unterschrift Auftragnehmer · {company}",
  "doc.offer.confirm.customerRole": "Auftraggeber · {name}",
  "doc.offer.confirm.contractorRole": "Auftragnehmer · {company}",
  "doc.offer.qr.headline": "ONLINE OFFERTE ANNEHMEN",
  "doc.offer.qr.headlineShort": "ODER ONLINE ANNEHMEN",
  "doc.offer.qr.scan": "Mit dem Handy scannen",
  "doc.offer.qr.button": "Online Offerte annehmen",
  "doc.offer.qr.buttonShort": "Offerte annehmen",
  "doc.offer.summary": "Zusammenfassung",
  "doc.offer.summary.customer": "Kunde: ",
  "doc.offer.summary.date": "Ausführungsdatum: ",
  "doc.offer.summary.total": "Gesamtbetrag: {amount}",
  "doc.offer.summary.totalRange": "Gesamtbetrag: {min} – {max}",

  // --- Shared address / property fields -----------------------------------------------------
  "doc.address.street": "Strasse",
  "doc.address.plzCity": "PLZ/Ort",
  "doc.address.floor": "Etage",
  "doc.address.lift": "Lift",
  "doc.address.noLift": "Kein Lift",
  "doc.address.rooms": "Zimmer",
  "doc.address.roomsShort": "Zi.",
  "doc.address.area": "FLÄCHE",
  "doc.address.appointment": "TERMIN",
  "doc.address.attic": "Estrich",
  "doc.address.cellar": "Keller",
  "doc.address.routeTo": "nach ",
  "doc.time.fromUntil": "{start}–{end} Uhr",
  "doc.time.from": "ab {start} Uhr",
  "doc.time.oclock": "{time} Uhr",
  "doc.time.hoursMinutes": "{hours} Std {minutes} Min",
  "doc.time.hoursOnly": "{hours} Std",
  "doc.time.minutesOnly": "{minutes} Min",

  // --- Shared footer -------------------------------------------------------------------------
  "doc.footer.page": "Seite {page} / {total}",
  "doc.footer.pageOf": "Seite {page} von {total}",
  "doc.footer.iban": "IBAN ",
  "doc.contact.phone": "Telefon: ",
  "doc.contact.phoneShort": "Tel. ",
  "doc.contact.email": "E-Mail: ",
  "doc.contact.vatNumber": "MwSt-Nr: ",

  // =============================================================================
  // Rechnung
  // =============================================================================
  "doc.invoice.wordmark": "R E C H N U N G",
  "doc.invoice.title": "Rechnung",
  "doc.invoice.recipient": "RECHNUNG AN",
  "doc.invoice.date": "Rechnungsdatum",
  "doc.invoice.dueDate": "Zahlbar bis",
  "doc.invoice.contact": "Ansprechpartner",
  "doc.invoice.number": "Rechnung {number}",
  "doc.invoice.col.pos": "POS",
  "doc.invoice.col.description": "BEZEICHNUNG",
  "doc.invoice.col.quantity": "ANZAHL",
  "doc.invoice.col.unitPrice": "EINZELPREIS",
  "doc.invoice.col.amount": "BETRAG",
  "doc.invoice.subtotal": "Zwischensumme exkl. MwSt.",
  "doc.invoice.vat": "MwSt. {rate}%",
  "doc.invoice.total": "Rechnungstotal inkl. MwSt.",
  "doc.invoice.paymentTerms": "Zahlungskonditionen: ",
  "doc.invoice.closing": "Mit freundlichen Grüssen",
  "doc.invoice.defaultIntro":
    "Für die Erledigung der von Ihnen beauftragten Tätigkeiten berechnen wir Ihnen wie folgt:",
  "doc.invoice.defaultOutro": "Besten Dank für Ihren Auftrag.",
  // Printed on the sheet when the body would run into the QR payment part.
  "doc.invoice.overflowWarning":
    "ACHTUNG: Rechnung zu lang für eine Seite — Positionen reduzieren.",

  // --- Swiss QR-bill -----------------------------------------------------------------------------
  // LEGALLY NORMED WORDING (SIX "Swiss Implementation Guidelines QR-bill", Annex C).
  // These are NOT free translations — the payment part must carry the exact official
  // strings for the language it is printed in, or the slip is non-compliant. Do not
  // "improve" them.
  "doc.qr.receipt": "Empfangsschein",
  "doc.qr.paymentPart": "Zahlteil",
  "doc.qr.account": "Konto / Zahlbar an",
  "doc.qr.reference": "Referenz",
  "doc.qr.payableBy": "Zahlbar durch",
  "doc.qr.payableByBlank": "Zahlbar durch (Name/Adresse)",
  "doc.qr.currency": "Währung",
  "doc.qr.amount": "Betrag",
  "doc.qr.acceptancePoint": "Annahmestelle",
  "doc.qr.additionalInfo": "Zusätzliche Informationen",
  "doc.qr.separateNotice": "Vor der Einzahlung abzutrennen",

  // =============================================================================
  // Quittung
  // =============================================================================
  "doc.receipt.title": "Quittung",
  "doc.receipt.numbered": "Quittung {number}",
  "doc.receipt.customer": "Kunde",
  "doc.receipt.details": "Details",
  "doc.receipt.date": "Datum: ",
  "doc.receipt.number": "Quittung-Nr.: ",
  "doc.receipt.vatNumber": "MwSt-Nr.: ",
  "doc.receipt.iban": "IBAN: ",
  "doc.receipt.col.description": "Beschreibung",
  "doc.receipt.col.rate": "Satz / Bemerkung",
  "doc.receipt.col.amount": "Betrag CHF",
  "doc.receipt.extras": "Zusatzleistungen",
  "doc.receipt.onSiteExtras": "Vor-Ort Ergänzungen (handschriftlich)",
  "doc.receipt.subtotal": "Zwischensumme:",
  "doc.receipt.discount": "Rabatt:",
  "doc.receipt.vat": "MwSt. ({rate}%):",
  "doc.receipt.total": "Gesamttotal:",
  "doc.receipt.outstanding": "Betrag noch offen",
  "doc.receipt.paymentMethod": "Zahlungsart",
  "doc.receipt.payment.open": "Noch offen",
  "doc.receipt.payment.cash": "Bar (Bargeld)",
  "doc.receipt.payment.card": "Kartenzahlung",
  "doc.receipt.payment.twint": "Twint",
  "doc.receipt.signature.customer": "Datum / Unterschrift Kunde",
  "doc.receipt.signature.teamLead": "Datum / Unterschrift Teamchef",
  "doc.receipt.thanks": "VIELEN DANK FÜR IHREN GESCHÄTZTEN AUFTRAG!",
  "doc.receipt.review": "Wir freuen uns auf Ihre Bewertung: {url}",

  // --- Quittung: seed line items --------------------------------------------------
  // The eight rows every new receipt starts with. They are AUTHORED CONTENT that ends
  // up verbatim on the customer's receipt, so they are written in the DOCUMENT locale —
  // not the operator's. The operator sees exactly the text the customer will read.
  "doc.receipt.item.umzug": "Umzug",
  "doc.receipt.item.reinigung": "Reinigung",
  "doc.receipt.item.packingMaterial": "Verpackungsmaterial",
  "doc.receipt.item.liftRental": "Möbelliftmiete",
  "doc.receipt.item.disposal": "Entsorgung / Räumung",
  "doc.receipt.item.heavySurcharge": "Schwertransportzuschlag",
  "doc.receipt.item.extraService": "Zusatzleistung",
  "doc.receipt.item.travelFlatRate": "Wegpauschale",

  // =============================================================================
  // Auftrag (work order — internal/team document, but printed and handed to the customer
  // on site for signature, so it follows the customer's language)
  // =============================================================================
  "doc.workorder.title": "ARBEITSAUFTRAG",
  "doc.workorder.service": "Dienstleistung: ",
  "doc.workorder.section.customer": "KUNDE",
  "doc.workorder.section.appointment": "TERMIN",
  "doc.workorder.section.team": "TEAM",
  "doc.workorder.section.addresses": "ADRESSEN",
  "doc.workorder.section.serviceDetails": "DETAILS ZUR DIENSTLEISTUNG",
  "doc.workorder.section.byEffort": "ABRECHNUNG NACH AUFWAND",
  "doc.workorder.section.estimate": "KOSTENVORANSCHLAG",
  "doc.workorder.section.items": "LEISTUNGEN & PREISE",
  "doc.workorder.section.extraServices": "ZUSÄTZLICHE LEISTUNGEN",
  "doc.workorder.section.description": "BESCHREIBUNG",
  "doc.workorder.section.notices": "⚠ WICHTIGE HINWEISE",
  "doc.workorder.section.extraWork": "ZUSÄTZLICHE ARBEITEN",
  "doc.workorder.extraWork.hint": "(Für Einträge vor Ort)",
  "doc.workorder.phone": "Tel: ",
  "doc.workorder.time": "Zeit: ",
  "doc.workorder.duration": "Dauer: ~",
  "doc.workorder.teamLead": "Team-Leiter:",
  "doc.workorder.otherStaff": "Weitere Mitarbeiter:",
  "doc.workorder.unassigned": "Nicht zugewiesen",
  "doc.workorder.from": "Von:",
  "doc.workorder.to": "Nach:",
  "doc.workorder.hourlyRate": "Stundensatz: {rate}/Std.",
  "doc.workorder.finalPriceNote":
    "Der Endpreis wird nach Abschluss der Arbeiten berechnet.",
  "doc.workorder.col.description": "Beschreibung",
  "doc.workorder.col.quantity": "Menge",
  "doc.workorder.col.quantityShort": "Anz.",
  "doc.workorder.col.price": "Preis",
  "doc.workorder.col.total": "Total",
  "doc.workorder.subtotal": "Zwischensumme:",
  "doc.workorder.vat": "MwSt. ({rate}%):",
  "doc.workorder.estimated": "Geschätzt:",
  "doc.workorder.total": "Gesamtbetrag:",
  "doc.workorder.extraSubtotal": "Zwischensumme Zusatzarbeiten:",
  "doc.workorder.grandTotal": "GESAMTBETRAG (inkl. Zusatzarbeiten):",
  "doc.workorder.remarks": "Bemerkungen:",
  "doc.workorder.included": "inkl.",
  "doc.workorder.onRequest": "auf Anfrage",
  "doc.workorder.signature.customer": "Unterschrift Kunde:",
  "doc.workorder.signature.staff": "Unterschrift Mitarbeiter:",
  "doc.workorder.placeDate": "Ort, Datum:",

  // --- Auftrag detail labels ---------------------------------------------------------------
  "doc.detail.rooms": "Zimmer",
  "doc.detail.livingSpace": "Wohnfläche (m²)",
  "doc.detail.fromFloor": "Stockwerk (Von)",
  "doc.detail.fromLift": "Lift vorhanden (Von)",
  "doc.detail.toFloor": "Stockwerk (Nach)",
  "doc.detail.toLift": "Lift vorhanden (Nach)",
  "doc.detail.propertyType": "Objekttyp",
  "doc.detail.distance": "Distanz (km)",
  "doc.detail.packing": "Verpackungsservice",
  "doc.detail.finalCleaning": "Endreinigung",
  "doc.detail.storage": "Lagerung benötigt",
  "doc.detail.piano": "Klaviertransport",
  "doc.detail.bathrooms": "Badezimmer",
  "doc.detail.kitchen": "Küche",
  "doc.detail.balcony": "Balkon",
  "doc.detail.garage": "Garage",
  "doc.detail.cellar": "Keller",
  "doc.detail.attic": "Estrich",
  "doc.detail.windowCleaning": "Fensterreinigung",
  "doc.detail.pianoType": "Klaviertyp",
  "doc.detail.weight": "Gewicht (kg)",
  "doc.detail.clearanceType": "Räumungsart",
  "doc.detail.estimatedVolume": "Geschätztes Volumen",
  "doc.detail.heavyItems": "Schwere Gegenstände",
  "doc.detail.heavyItemsDescription": "Beschreibung schwere Gegenstände",
  "doc.detail.storageDuration": "Lagerdauer",
  "doc.detail.storageVolume": "Lagervolumen",

  // =============================================================================
  // AGB
  // =============================================================================
  "doc.agb.title": "Allgemeine Geschäftsbedingungen (AGB)",
  "doc.agb.subtitle": "{company} - gültige Version zum Angebotszeitpunkt",
  "doc.agb.subtitleGeneric": "Gültige Version zum Angebotszeitpunkt",

  // =============================================================================
  // Boxen-Lieferschein
  // =============================================================================
  "doc.boxes.title": "BOXEN-LIEFERSCHEIN",
  "doc.boxes.customer": "Kunde",
  "doc.boxes.addresses": "Adressen",
  "doc.boxes.appointments": "Termine",
  "doc.boxes.overview": "Boxen-Übersicht",
  "doc.boxes.costs": "Kosten & Kaution",
  "doc.boxes.remarks": "Bemerkungen",
  "doc.boxes.terms": "Mietbedingungen:",
  "doc.boxes.status": "Status: ",
  "doc.boxes.deliveryAddress": "Lieferadresse (Boxen hinbringen)",
  "doc.boxes.pickupAddress": "Abholadresse (Boxen abholen)",
  "doc.boxes.notSpecified": "Nicht angegeben",
  "doc.boxes.notYetSpecified": "Noch nicht angegeben",
  "doc.boxes.deliveryDate": "Lieferdatum:",
  "doc.boxes.returnDate": "Rückgabe geplant:",
  "doc.boxes.kind": "Art:",
  "doc.boxes.rental": "Miete",
  "doc.boxes.purchase": "Kauf/Verkauf",
  "doc.boxes.col.type": "Box-Typ",
  "doc.boxes.col.count": "Anzahl",
  "doc.boxes.col.status": "Status",
  "doc.boxes.total": "Gesamt:",
  "doc.boxes.unit": "Boxen",
  "doc.boxes.pricePerDay": "Mietpreis pro Tag: ",
  "doc.boxes.deposit": "Kaution: ",
  "doc.boxes.paid": "(Bezahlt)",
  "doc.boxes.unpaid": "(Offen)",
  "doc.boxes.customerNotes": "Kundenhinweise:",
  "doc.boxes.signature.customer": "Unterschrift Kunde",
  "doc.boxes.signature.supplier": "Unterschrift Lieferant",
  "doc.boxes.terms.care":
    "Die Boxen sind sorgfältig zu behandeln und vor Beschädigungen zu schützen.",
  "doc.boxes.terms.damage":
    "Bei Verlust oder Beschädigung wird der Wiederbeschaffungswert berechnet.",
  "doc.boxes.terms.return": "Die Rückgabe hat am vereinbarten Termin zu erfolgen.",
  "doc.boxes.status.reserviert": "Reserviert",
  "doc.boxes.status.geliefert": "Geliefert",
  "doc.boxes.status.in_gebrauch": "In Gebrauch",
  "doc.boxes.status.abholung_angefragt": "Abholung angefragt",
  "doc.boxes.status.abholung_geplant": "Abholung geplant",
  "doc.boxes.status.zurueckgegeben": "Zurückgegeben",
  "doc.boxes.status.verloren": "Verloren",
  "doc.boxes.status.beschaedigt": "Beschädigt",
  "doc.boxes.type.standard": "Standard",
  "doc.boxes.type.kleiderbox": "Kleiderbox",
  "doc.boxes.type.buecherbox": "Bücherbox",
  "doc.boxes.type.fragile": "Fragile",
  "doc.boxes.type.archivbox": "Archivbox",
  "doc.boxes.type.andere": "Andere",

  // --- Checklist ------------------------------------------------------------------------------
  "doc.checklist.title": "Checkliste",
  "doc.checklist.page": "Seite {page}",
} as const;
