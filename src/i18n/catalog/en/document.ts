import { document as de } from "@/i18n/catalog/de/document";

/**
 * Customer-facing document text — English (en-GB).
 *
 * Typed against the German catalog: a missing key is a compile error.
 * Formal business English.
 */
export const document: Record<keyof typeof de, string> = {
  // --- Quote: wordmark ---------------------------------------------------------
  // The wordmark is painted in two tones; the split point is language-specific.
  "doc.offer.wordmark.head": "QUO",
  "doc.offer.wordmark.tail": "TE",

  "doc.offer.title": "Quote",
  "doc.offer.titleFor": "{service} quote",
  "doc.offer.number": "Quote no.",
  "doc.offer.numberShort": "No.",
  "doc.offer.numbered": "Quote no. {number}",
  "doc.offer.date": "Date",
  "doc.offer.validUntil": "Valid until",
  "doc.offer.validUntilDate": "Valid until: {date}",
  "doc.offer.offerValidUntil": "Offer valid until {date}",
  "doc.offer.customer": "Client",
  "doc.offer.details": "Quote details",
  "doc.offer.vatNumber": "VAT no.",
  "doc.offer.serviceKind": "Type of service:",
  "doc.offer.tableContinued": "Schedule of services — continued",
  "doc.offer.intro":
    "Thank you for your enquiry. We are pleased to submit the following quote.",

  // --- Quote: sections ---------------------------------------------------------
  "doc.offer.section.scope": "SCOPE OF SERVICES",
  "doc.offer.section.payment": "PAYMENT",
  "doc.offer.section.insurance": "INSURANCE",
  "doc.offer.section.remarks": "REMARKS",
  "doc.offer.section.glance": "AT A GLANCE",
  "doc.offer.section.customer": "CLIENT",
  "doc.offer.section.offerDetails": "QUOTE DETAILS",
  "doc.offer.section.serviceDetails": "Service details",
  "doc.offer.paymentTerms": "Payment terms:",

  // --- Quote: at-a-glance (modern) ---------------------------------------------
  "doc.offer.glance.for": "For",
  "doc.offer.glance.appointment": "Date",
  "doc.offer.glance.total": "Total amount",
  "doc.offer.glance.price": "Price",

  // --- Quote: totals ------------------------------------------------------------
  "doc.offer.subtotal": "Subtotal",
  "doc.offer.surcharge": "Surcharge",
  "doc.offer.discount": "Discount {percent} %",
  "doc.offer.totalExclVat": "Total excl. VAT",
  "doc.offer.vat": "VAT {rate} %",
  "doc.offer.grandTotal": "TOTAL AMOUNT",
  "doc.offer.upTo": "up to ",

  // --- Quote: price models -------------------------------------------------------
  "doc.offer.priceModel": "Price model:",
  "doc.offer.hourlyRate": "Hourly rate — CHF {rate} / hr",
  "doc.offer.hourlyRateNote":
    "Billing is based on the time actually spent, at the stated hourly rate.",
  "doc.offer.hourlyWithCap": "Hourly rate CHF {rate} / hr — cost ceiling max. CHF {cap}",
  "doc.offer.costCap": "Cost ceiling:",
  "doc.offer.costCapMax": "max. CHF {cap}",
  "doc.offer.costCapDetail": "Hourly rate {rate}/hr — max. CHF {cap} ({hours} hrs)",
  "doc.offer.costCapHours": "Cost ceiling: max. CHF {cap} (at {hours} hrs)",
  "doc.offer.costCapNote":
    "You pay a maximum of CHF {cap}, regardless of the time actually spent.",
  // The service is named explicitly so the sentence stays translatable without a
  // case system (the German original relied on an accusative article table).
  "doc.offer.costCapGlance": "For {service} you never pay more than the cost ceiling.",
  "doc.offer.costCapExtras": "Plus {parts} (see below).",
  "doc.offer.listAnd": "and",
  "doc.offer.rateAggregateNote":
    "The total price results from the items billed by time and effort (see details above), plus any fixed items.",
  "doc.offer.flatRate": "Flat rate",
  "doc.offer.rateRange": "{min}–{max} hrs at {rate}/hr",
  "doc.offer.perHour": "at {rate}/hour",
  "doc.offer.from": "from ",
  "doc.offer.plus": "plus ",

  // --- Quote: item meta ------------------------------------------------------------
  "doc.offer.item.object": "OBJECT",
  "doc.offer.item.tariff": "RATE",
  "doc.offer.item.handover": "incl. handover inspection with the property management",
  "doc.offer.item.estimatedVolume": "estimated volume {volume}",
  "doc.offer.item.approxM2": "approx. {value} m²",
  "doc.offer.item.approxM3": "approx. {value} m³",
  "doc.offer.item.crew": "{count} staff",
  "doc.offer.item.vehicles": " vehicles",
  "doc.offer.item.quantityAtPrice": "{quantity} at {price}",

  // --- Quote: time-estimate breakdown -------------------------------------------------
  "doc.offer.breakdown.volume": "Volume: ",
  "doc.offer.breakdown.workTime": "Estimated working time: ",
  "doc.offer.breakdown.carryTime": "Carrying time: ",
  "doc.offer.breakdown.assembly": "Assembly/disassembly: ",
  "doc.offer.breakdown.driveTime": "Travel time: ",
  "doc.offer.breakdown.buffer": "Buffer time: ",
  "doc.offer.breakdown.truckType": "Truck type: ",
  "doc.offer.breakdown.crewSize": "Number of staff: ",

  // --- Quote: blind offer (no on-site survey) -------------------------------------------
  "doc.offer.blind.badge": "BLIND QUOTE — WITHOUT SITE VISIT",
  "doc.offer.blind.label": "Important note",
  "doc.offer.blind.text":
    "This quote was prepared without a personal site visit and is based solely on the information provided by the customer. The prices listed are estimates. Any adjustments will be agreed with the customer before the order is placed.",
  "doc.offer.blind.timeNote":
    "This quote is based on the customer's information without a personal site visit. Prices are estimates and may be adjusted after a site visit. The time estimates per item are to be understood as a guide.",
  "doc.offer.type.blind": "Quote type: blind quote (without site visit)",
  "doc.offer.type.blindShort": "Blind quote (without site visit)",
  "doc.offer.type.normal": "Standard quote (after site visit)",
  "doc.offer.type": "Quote type",
  "doc.offer.typeValue": "Quote type: {value}",

  // --- Quote: included / excluded services -------------------------------------------
  "doc.offer.included.title": "Included in the price",
  "doc.offer.includedShort": "Included",
  "doc.offer.excluded.title": "Not included / additional costs",
  "doc.offer.excluded.hint":
    "Final additional costs are only charged after prior consultation.",
  "doc.offer.included.default.insurance": "Transport and business liability insurance",
  "doc.offer.included.default.staff": "Removal specialists (incl. expenses)",
  "doc.offer.included.default.vehicles": "Vehicles and fuel",
  "doc.offer.included.default.travel": "Journey to and from the site",
  "doc.offer.included.default.equipment": "Securing straps, protective material, tools",
  "doc.offer.excluded.default.hazardous":
    "Special disposal (e.g. chemicals, asbestos, hazardous goods)",
  "doc.offer.excluded.default.permits":
    "Parking permits, external furniture lift / crane hire",
  "doc.offer.excluded.default.extraScope":
    "Additional work in the event of a differing scope of services",

  // --- Quote: signature / acceptance ---------------------------------------------------
  "doc.offer.confirm.title": "Order confirmation",
  "doc.offer.confirm.text":
    "I hereby place with {company} the order described in this quote (no. {number}).\n\nI confirm that I have read and understood the quote as well as the general terms and conditions and that I agree with all points.",
  "doc.offer.confirm.textCompact":
    "I hereby place with {company} the order described in this quote (no. {number}) and confirm that I have read and understood the quote as well as the general terms and conditions and that I agree with all points.",
  "doc.offer.confirm.placeDate": "Place, date",
  "doc.offer.confirm.placeDateSignature": "Place, date, signature",
  "doc.offer.confirm.signatureCustomer": "Signature of the client · {name}",
  "doc.offer.confirm.signatureContractor": "Signature of the contractor · {company}",
  "doc.offer.confirm.customerRole": "Client · {name}",
  "doc.offer.confirm.contractorRole": "Contractor · {company}",
  "doc.offer.qr.headline": "ACCEPT QUOTE ONLINE",
  "doc.offer.qr.headlineShort": "OR ACCEPT ONLINE",
  "doc.offer.qr.scan": "Scan with your phone",
  "doc.offer.qr.button": "Accept quote online",
  "doc.offer.qr.buttonShort": "Accept quote",
  "doc.offer.summary": "Summary",
  "doc.offer.summary.customer": "Customer: ",
  "doc.offer.summary.date": "Service date: ",
  "doc.offer.summary.total": "Total amount: {amount}",
  "doc.offer.summary.totalRange": "Total amount: {min} – {max}",

  // --- Shared address / property fields -----------------------------------------------------
  "doc.address.street": "Street",
  "doc.address.plzCity": "Postcode/Town",
  "doc.address.floor": "Floor",
  "doc.address.lift": "Lift",
  "doc.address.noLift": "No lift",
  "doc.address.rooms": "Rooms",
  "doc.address.roomsShort": "Rms",
  "doc.address.area": "AREA",
  "doc.address.appointment": "DATE",
  "doc.address.attic": "Attic",
  "doc.address.cellar": "Cellar",
  "doc.address.routeTo": "to ",
  "doc.time.fromUntil": "{start}–{end}",
  "doc.time.from": "from {start}",
  "doc.time.oclock": "{time}",
  "doc.time.hoursMinutes": "{hours} hrs {minutes} min",
  "doc.time.hoursOnly": "{hours} hrs",
  "doc.time.minutesOnly": "{minutes} min",

  // --- Shared footer -------------------------------------------------------------------------
  "doc.footer.page": "Page {page} / {total}",
  "doc.footer.pageOf": "Page {page} of {total}",
  "doc.footer.iban": "IBAN ",
  "doc.contact.phone": "Phone: ",
  "doc.contact.phoneShort": "Tel. ",
  "doc.contact.email": "E-mail: ",
  "doc.contact.vatNumber": "VAT no.: ",

  // =============================================================================
  // Invoice
  // =============================================================================
  "doc.invoice.wordmark": "I N V O I C E",
  "doc.invoice.title": "Invoice",
  "doc.invoice.recipient": "INVOICE TO",
  "doc.invoice.date": "Invoice date",
  "doc.invoice.dueDate": "Payable by",
  "doc.invoice.contact": "Contact person",
  "doc.invoice.number": "Invoice {number}",
  "doc.invoice.col.pos": "POS",
  "doc.invoice.col.description": "DESCRIPTION",
  "doc.invoice.col.quantity": "QUANTITY",
  "doc.invoice.col.unitPrice": "UNIT PRICE",
  "doc.invoice.col.amount": "AMOUNT",
  "doc.invoice.subtotal": "Subtotal excl. VAT",
  "doc.invoice.vat": "VAT {rate}%",
  "doc.invoice.total": "Invoice total incl. VAT",
  "doc.invoice.paymentTerms": "Payment terms: ",
  "doc.invoice.closing": "Kind regards",
  "doc.invoice.defaultIntro":
    "For the completion of the work you commissioned, we charge you as follows:",
  "doc.invoice.defaultOutro": "Thank you for your order.",
  // Printed on the sheet when the body would run into the QR payment part.
  "doc.invoice.overflowWarning":
    "WARNING: invoice too long for one page — reduce the line items.",

  // --- Swiss QR-bill -----------------------------------------------------------------------------
  // LEGALLY NORMED WORDING (SIX "Swiss Implementation Guidelines QR-bill", Annex C).
  // These are NOT free translations — the payment part must carry the exact official
  // strings for the language it is printed in, or the slip is non-compliant. Do not
  // "improve" them.
  "doc.qr.receipt": "Receipt",
  "doc.qr.paymentPart": "Payment part",
  "doc.qr.account": "Account / Payable to",
  "doc.qr.reference": "Reference",
  "doc.qr.payableBy": "Payable by",
  "doc.qr.payableByBlank": "Payable by (name/address)",
  "doc.qr.currency": "Currency",
  "doc.qr.amount": "Amount",
  "doc.qr.acceptancePoint": "Acceptance point",
  "doc.qr.additionalInfo": "Additional information",
  "doc.qr.separateNotice": "Separate before paying in",

  // =============================================================================
  // Receipt
  // =============================================================================
  "doc.receipt.title": "Receipt",
  "doc.receipt.numbered": "Receipt {number}",
  "doc.receipt.customer": "Customer",
  "doc.receipt.details": "Details",
  "doc.receipt.date": "Date: ",
  "doc.receipt.number": "Receipt no.: ",
  "doc.receipt.vatNumber": "VAT no.: ",
  "doc.receipt.iban": "IBAN: ",
  "doc.receipt.col.description": "Description",
  "doc.receipt.col.rate": "Rate / remark",
  "doc.receipt.col.amount": "Amount CHF",
  "doc.receipt.extras": "Additional services",
  "doc.receipt.onSiteExtras": "On-site additions (handwritten)",
  "doc.receipt.subtotal": "Subtotal:",
  "doc.receipt.discount": "Discount:",
  "doc.receipt.vat": "VAT ({rate}%):",
  "doc.receipt.total": "Grand total:",
  "doc.receipt.outstanding": "Amount still outstanding",
  "doc.receipt.paymentMethod": "Payment method",
  "doc.receipt.payment.open": "Still outstanding",
  "doc.receipt.payment.cash": "Cash",
  "doc.receipt.payment.card": "Card payment",
  "doc.receipt.payment.twint": "Twint",
  "doc.receipt.signature.customer": "Date / signature of customer",
  "doc.receipt.signature.teamLead": "Date / signature of team leader",
  "doc.receipt.thanks": "THANK YOU VERY MUCH FOR YOUR ORDER!",
  "doc.receipt.review": "We look forward to your review: {url}",

  // --- Receipt: seed line items ----------------------------------------------------
  "doc.receipt.item.umzug": "Removal",
  "doc.receipt.item.reinigung": "Cleaning",
  "doc.receipt.item.packingMaterial": "Packing material",
  "doc.receipt.item.liftRental": "Furniture lift rental",
  "doc.receipt.item.disposal": "Disposal / clearance",
  "doc.receipt.item.heavySurcharge": "Heavy transport surcharge",
  "doc.receipt.item.extraService": "Additional service",
  "doc.receipt.item.travelFlatRate": "Travel flat rate",

  // =============================================================================
  // Work order (internal/team document, but printed and handed to the customer
  // on site for signature, so it follows the customer's language)
  // =============================================================================
  "doc.workorder.title": "WORK ORDER",
  "doc.workorder.service": "Service: ",
  "doc.workorder.section.customer": "CUSTOMER",
  "doc.workorder.section.appointment": "DATE",
  "doc.workorder.section.team": "TEAM",
  "doc.workorder.section.addresses": "ADDRESSES",
  "doc.workorder.section.serviceDetails": "SERVICE DETAILS",
  "doc.workorder.section.byEffort": "BILLING BY TIME AND EFFORT",
  "doc.workorder.section.estimate": "COST ESTIMATE",
  "doc.workorder.section.items": "SERVICES & PRICES",
  "doc.workorder.section.extraServices": "ADDITIONAL SERVICES",
  "doc.workorder.section.description": "DESCRIPTION",
  "doc.workorder.section.notices": "⚠ IMPORTANT NOTES",
  "doc.workorder.section.extraWork": "ADDITIONAL WORK",
  "doc.workorder.extraWork.hint": "(For on-site entries)",
  "doc.workorder.phone": "Tel: ",
  "doc.workorder.time": "Time: ",
  "doc.workorder.duration": "Duration: ~",
  "doc.workorder.teamLead": "Team leader:",
  "doc.workorder.otherStaff": "Other staff:",
  "doc.workorder.unassigned": "Not assigned",
  "doc.workorder.from": "From:",
  "doc.workorder.to": "To:",
  "doc.workorder.hourlyRate": "Hourly rate: {rate}/hr",
  "doc.workorder.finalPriceNote":
    "The final price is calculated once the work has been completed.",
  "doc.workorder.col.description": "Description",
  "doc.workorder.col.quantity": "Quantity",
  "doc.workorder.col.quantityShort": "Qty",
  "doc.workorder.col.price": "Price",
  "doc.workorder.col.total": "Total",
  "doc.workorder.subtotal": "Subtotal:",
  "doc.workorder.vat": "VAT ({rate}%):",
  "doc.workorder.estimated": "Estimated:",
  "doc.workorder.total": "Total amount:",
  "doc.workorder.extraSubtotal": "Subtotal additional work:",
  "doc.workorder.grandTotal": "TOTAL AMOUNT (incl. additional work):",
  "doc.workorder.remarks": "Remarks:",
  "doc.workorder.included": "incl.",
  "doc.workorder.onRequest": "on request",
  "doc.workorder.signature.customer": "Signature of customer:",
  "doc.workorder.signature.staff": "Signature of staff member:",
  "doc.workorder.placeDate": "Place, date:",

  // --- Work order detail labels ---------------------------------------------------------------
  "doc.detail.rooms": "Rooms",
  "doc.detail.livingSpace": "Living space (m²)",
  "doc.detail.fromFloor": "Floor (from)",
  "doc.detail.fromLift": "Lift available (from)",
  "doc.detail.toFloor": "Floor (to)",
  "doc.detail.toLift": "Lift available (to)",
  "doc.detail.propertyType": "Property type",
  "doc.detail.distance": "Distance (km)",
  "doc.detail.packing": "Packing service",
  "doc.detail.finalCleaning": "Final cleaning",
  "doc.detail.storage": "Storage required",
  "doc.detail.piano": "Piano transport",
  "doc.detail.bathrooms": "Bathrooms",
  "doc.detail.kitchen": "Kitchen",
  "doc.detail.balcony": "Balcony",
  "doc.detail.garage": "Garage",
  "doc.detail.cellar": "Cellar",
  "doc.detail.attic": "Attic",
  "doc.detail.windowCleaning": "Window cleaning",
  "doc.detail.pianoType": "Piano type",
  "doc.detail.weight": "Weight (kg)",
  "doc.detail.clearanceType": "Type of clearance",
  "doc.detail.estimatedVolume": "Estimated volume",
  "doc.detail.heavyItems": "Heavy items",
  "doc.detail.heavyItemsDescription": "Description of heavy items",
  "doc.detail.storageDuration": "Storage duration",
  "doc.detail.storageVolume": "Storage volume",

  // =============================================================================
  // GTC
  // =============================================================================
  "doc.agb.title": "General Terms and Conditions (GTC)",
  "doc.agb.subtitle": "{company} - version valid at the time of the quote",
  "doc.agb.subtitleGeneric": "Version valid at the time of the quote",

  // =============================================================================
  // Box delivery note
  // =============================================================================
  "doc.boxes.title": "BOX DELIVERY NOTE",
  "doc.boxes.customer": "Customer",
  "doc.boxes.addresses": "Addresses",
  "doc.boxes.appointments": "Dates",
  "doc.boxes.overview": "Box overview",
  "doc.boxes.costs": "Costs & deposit",
  "doc.boxes.remarks": "Remarks",
  "doc.boxes.terms": "Rental conditions:",
  "doc.boxes.status": "Status: ",
  "doc.boxes.deliveryAddress": "Delivery address (deliver boxes)",
  "doc.boxes.pickupAddress": "Collection address (collect boxes)",
  "doc.boxes.notSpecified": "Not specified",
  "doc.boxes.notYetSpecified": "Not yet specified",
  "doc.boxes.deliveryDate": "Delivery date:",
  "doc.boxes.returnDate": "Return scheduled:",
  "doc.boxes.kind": "Type:",
  "doc.boxes.rental": "Rental",
  "doc.boxes.purchase": "Purchase/sale",
  "doc.boxes.col.type": "Box type",
  "doc.boxes.col.count": "Quantity",
  "doc.boxes.col.status": "Status",
  "doc.boxes.total": "Total:",
  "doc.boxes.unit": "Boxes",
  "doc.boxes.pricePerDay": "Rental price per day: ",
  "doc.boxes.deposit": "Deposit: ",
  "doc.boxes.paid": "(Paid)",
  "doc.boxes.unpaid": "(Outstanding)",
  "doc.boxes.customerNotes": "Customer notes:",
  "doc.boxes.signature.customer": "Signature of customer",
  "doc.boxes.signature.supplier": "Signature of supplier",
  "doc.boxes.terms.care":
    "The boxes must be handled with care and protected from damage.",
  "doc.boxes.terms.damage":
    "In the event of loss or damage, the replacement value will be charged.",
  "doc.boxes.terms.return": "The boxes must be returned on the agreed date.",
  "doc.boxes.status.reserviert": "Reserved",
  "doc.boxes.status.geliefert": "Delivered",
  "doc.boxes.status.in_gebrauch": "In use",
  "doc.boxes.status.abholung_angefragt": "Collection requested",
  "doc.boxes.status.abholung_geplant": "Collection scheduled",
  "doc.boxes.status.zurueckgegeben": "Returned",
  "doc.boxes.status.verloren": "Lost",
  "doc.boxes.status.beschaedigt": "Damaged",
  "doc.boxes.type.standard": "Standard",
  "doc.boxes.type.kleiderbox": "Wardrobe box",
  "doc.boxes.type.buecherbox": "Book box",
  "doc.boxes.type.fragile": "Fragile",
  "doc.boxes.type.archivbox": "Archive box",
  "doc.boxes.type.andere": "Other",

  // --- Checklist ------------------------------------------------------------------------------
  "doc.checklist.title": "Checklist",
  "doc.checklist.page": "Page {page}",
};
