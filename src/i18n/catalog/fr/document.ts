import { document as de } from "@/i18n/catalog/de/document";

/**
 * Customer-facing document text — French (fr-CH).
 *
 * Typed against the German catalog: a missing key is a compile error.
 * Swiss business French, formal register (vouvoiement).
 */
export const document: Record<keyof typeof de, string> = {
  // --- Devis: wordmark ---------------------------------------------------------
  // The wordmark is painted in two tones; the split point is language-specific.
  "doc.offer.wordmark.head": "DEV",
  "doc.offer.wordmark.tail": "IS",

  "doc.offer.title": "Devis",
  "doc.offer.titleFor": "Devis – {service}",
  "doc.offer.number": "N° de devis",
  "doc.offer.numberShort": "N°",
  "doc.offer.numbered": "Devis n° {number}",
  "doc.offer.date": "Date",
  "doc.offer.validUntil": "Valable jusqu'au",
  "doc.offer.validUntilDate": "Valable jusqu'au : {date}",
  "doc.offer.offerValidUntil": "Offre valable jusqu'au {date}",
  "doc.offer.customer": "Mandant",
  "doc.offer.details": "Détails du devis",
  "doc.offer.vatNumber": "N° TVA",
  "doc.offer.serviceKind": "Type de prestation :",
  "doc.offer.tableContinued": "Tableau des prestations — suite",
  "doc.offer.intro":
    "Nous vous remercions de votre demande. Nous avons le plaisir de vous soumettre le devis suivant.",

  // --- Devis: sections ---------------------------------------------------------
  "doc.offer.section.scope": "ÉTENDUE DES PRESTATIONS",
  "doc.offer.section.payment": "PAIEMENT",
  "doc.offer.section.insurance": "ASSURANCE",
  "doc.offer.section.remarks": "REMARQUES",
  "doc.offer.section.glance": "EN UN COUP D'ŒIL",
  "doc.offer.section.customer": "MANDANT",
  "doc.offer.section.offerDetails": "DÉTAILS DU DEVIS",
  "doc.offer.section.serviceDetails": "Détails de la prestation",
  "doc.offer.paymentTerms": "Condition de paiement :",

  // --- Devis: at-a-glance (modern) ---------------------------------------------
  "doc.offer.glance.for": "Pour",
  "doc.offer.glance.appointment": "Date",
  "doc.offer.glance.total": "Montant total",
  "doc.offer.glance.price": "Prix",

  // --- Devis: totals ------------------------------------------------------------
  "doc.offer.subtotal": "Sous-total",
  "doc.offer.surcharge": "Supplément",
  "doc.offer.discount": "Rabais {percent} %",
  "doc.offer.totalExclVat": "Total hors TVA",
  "doc.offer.vat": "TVA {rate} %",
  "doc.offer.grandTotal": "MONTANT TOTAL",
  "doc.offer.upTo": "jusqu'à ",

  // --- Devis: price models -------------------------------------------------------
  "doc.offer.priceModel": "Modèle de prix :",
  "doc.offer.hourlyRate": "Tarif horaire — CHF {rate} / h",
  "doc.offer.hourlyRateNote":
    "La facturation s'effectue selon le temps effectivement consacré, au tarif horaire indiqué.",
  "doc.offer.hourlyWithCap": "Tarif horaire CHF {rate} / h — prix plafond max. CHF {cap}",
  "doc.offer.costCap": "Prix plafond :",
  "doc.offer.costCapMax": "max. CHF {cap}",
  "doc.offer.costCapDetail": "Tarif horaire {rate}/h — max. CHF {cap} ({hours} h)",
  "doc.offer.costCapHours": "Prix plafond : max. CHF {cap} (pour {hours} h)",
  "doc.offer.costCapNote":
    "Vous payez au maximum CHF {cap}, indépendamment du temps effectivement consacré.",
  // The service is named explicitly so the sentence stays translatable without a
  // case system (the German original relied on an accusative article table).
  "doc.offer.costCapGlance": "Pour {service}, vous ne payez jamais plus que le prix plafond.",
  "doc.offer.costCapExtras": "En sus : {parts} (voir ci-dessous).",
  "doc.offer.listAnd": "et",
  "doc.offer.rateAggregateNote":
    "Le prix total résulte des positions facturées selon dépense effective (voir les détails ci-dessus), majoré des éventuelles positions forfaitaires.",
  "doc.offer.flatRate": "Forfait",
  "doc.offer.rateRange": "{min}–{max} h à {rate}/h",
  "doc.offer.perHour": "à {rate}/heure",
  "doc.offer.from": "dès ",
  "doc.offer.plus": "en sus ",

  // --- Devis: item meta ------------------------------------------------------------
  "doc.offer.item.object": "OBJET",
  "doc.offer.item.tariff": "TARIF",
  "doc.offer.item.handover": "y c. état des lieux avec la gérance",
  "doc.offer.item.estimatedVolume": "volume estimé {volume}",
  "doc.offer.item.approxM2": "env. {value} m²",
  "doc.offer.item.approxM3": "env. {value} m³",
  "doc.offer.item.crew": "{count} collaborateurs",
  "doc.offer.item.vehicles": " véhicules",
  "doc.offer.item.quantityAtPrice": "{quantity} à {price}",

  // --- Devis: time-estimate breakdown -------------------------------------------------
  "doc.offer.breakdown.volume": "Volume : ",
  "doc.offer.breakdown.workTime": "Temps de travail estimé : ",
  "doc.offer.breakdown.carryTime": "Temps de portage : ",
  "doc.offer.breakdown.assembly": "Montage/démontage : ",
  "doc.offer.breakdown.driveTime": "Temps de trajet : ",
  "doc.offer.breakdown.buffer": "Temps tampon : ",
  "doc.offer.breakdown.truckType": "Type de camion : ",
  "doc.offer.breakdown.crewSize": "Nombre de collaborateurs : ",

  // --- Devis: blind offer (no on-site survey) -------------------------------------------
  "doc.offer.blind.badge": "DEVIS À DISTANCE — SANS VISITE",
  "doc.offer.blind.label": "Remarque importante",
  "doc.offer.blind.text":
    "Ce devis a été établi sans visite sur place et repose exclusivement sur les indications du client. Les prix indiqués sont des estimations. D'éventuelles adaptations seront convenues avec le client avant l'attribution du mandat.",
  "doc.offer.blind.timeNote":
    "Ce devis repose sur les indications du client, sans visite sur place. Les prix sont des estimations et peuvent être adaptés après une visite. Les estimations de temps par position sont à considérer comme des ordres de grandeur.",
  "doc.offer.type.blind": "Type de devis : devis à distance (sans visite)",
  "doc.offer.type.blindShort": "Devis à distance (sans visite)",
  "doc.offer.type.normal": "Devis standard (après visite)",
  "doc.offer.type": "Type de devis",
  "doc.offer.typeValue": "Type de devis : {value}",

  // --- Devis: included / excluded services -------------------------------------------
  "doc.offer.included.title": "Compris dans le prix",
  "doc.offer.includedShort": "Inclus",
  "doc.offer.excluded.title": "Non compris / frais supplémentaires",
  "doc.offer.excluded.hint":
    "Les frais supplémentaires définitifs ne sont facturés qu'après concertation préalable.",
  "doc.offer.included.default.insurance":
    "Assurance transport et responsabilité civile d'entreprise",
  "doc.offer.included.default.staff": "Spécialistes du déménagement (frais compris)",
  "doc.offer.included.default.vehicles": "Véhicules et carburant",
  "doc.offer.included.default.travel": "Trajet aller et retour",
  "doc.offer.included.default.equipment":
    "Sangles de fixation, matériel de protection, outillage",
  "doc.offer.excluded.default.hazardous":
    "Élimination spéciale (p. ex. produits chimiques, amiante, marchandises dangereuses)",
  "doc.offer.excluded.default.permits":
    "Autorisations de parcage, location externe de monte-meubles / grue",
  "doc.offer.excluded.default.extraScope":
    "Charges supplémentaires en cas d'étendue de prestations divergente",

  // --- Devis: signature / acceptance ---------------------------------------------------
  "doc.offer.confirm.title": "Confirmation de mandat",
  "doc.offer.confirm.text":
    "Par la présente, je confie à l'entreprise {company} le mandat décrit dans le présent devis (n° {number}).\n\nJe confirme avoir lu et compris le devis ainsi que les conditions générales et accepter l'ensemble de leurs dispositions.",
  "doc.offer.confirm.textCompact":
    "Par la présente, je confie à l'entreprise {company} le mandat décrit dans le présent devis (n° {number}) et je confirme avoir lu et compris le devis ainsi que les conditions générales et accepter l'ensemble de leurs dispositions.",
  "doc.offer.confirm.placeDate": "Lieu, date",
  "doc.offer.confirm.placeDateSignature": "Lieu, date, signature",
  "doc.offer.confirm.signatureCustomer": "Signature du mandant · {name}",
  "doc.offer.confirm.signatureContractor": "Signature du mandataire · {company}",
  "doc.offer.confirm.customerRole": "Mandant · {name}",
  "doc.offer.confirm.contractorRole": "Mandataire · {company}",
  "doc.offer.qr.headline": "ACCEPTER LE DEVIS EN LIGNE",
  "doc.offer.qr.headlineShort": "OU ACCEPTER EN LIGNE",
  "doc.offer.qr.scan": "Scanner avec le téléphone",
  "doc.offer.qr.button": "Accepter le devis en ligne",
  "doc.offer.qr.buttonShort": "Accepter le devis",
  "doc.offer.summary": "Récapitulatif",
  "doc.offer.summary.customer": "Client : ",
  "doc.offer.summary.date": "Date d'exécution : ",
  "doc.offer.summary.total": "Montant total : {amount}",
  "doc.offer.summary.totalRange": "Montant total : {min} – {max}",

  // --- Shared address / property fields -----------------------------------------------------
  "doc.address.street": "Rue",
  "doc.address.plzCity": "NPA/Localité",
  "doc.address.floor": "Étage",
  "doc.address.lift": "Ascenseur",
  "doc.address.noLift": "Pas d'ascenseur",
  "doc.address.rooms": "Pièces",
  "doc.address.roomsShort": "P.",
  "doc.address.area": "SURFACE",
  "doc.address.appointment": "DATE",
  "doc.address.attic": "Galetas",
  "doc.address.cellar": "Cave",
  "doc.address.routeTo": "vers ",
  "doc.time.fromUntil": "{start}–{end} h",
  "doc.time.from": "dès {start} h",
  "doc.time.oclock": "{time} h",
  "doc.time.hoursMinutes": "{hours} h {minutes} min",
  "doc.time.hoursOnly": "{hours} h",
  "doc.time.minutesOnly": "{minutes} min",

  // --- Shared footer -------------------------------------------------------------------------
  "doc.footer.page": "Page {page} / {total}",
  "doc.footer.pageOf": "Page {page} sur {total}",
  "doc.footer.iban": "IBAN ",
  "doc.contact.phone": "Téléphone : ",
  "doc.contact.phoneShort": "Tél. ",
  "doc.contact.email": "E-mail : ",
  "doc.contact.vatNumber": "N° TVA : ",

  // =============================================================================
  // Facture
  // =============================================================================
  "doc.invoice.wordmark": "F A C T U R E",
  "doc.invoice.title": "Facture",
  "doc.invoice.recipient": "FACTURE À",
  "doc.invoice.date": "Date de la facture",
  "doc.invoice.dueDate": "Payable jusqu'au",
  "doc.invoice.contact": "Personne de contact",
  "doc.invoice.number": "Facture {number}",
  "doc.invoice.col.pos": "POS",
  "doc.invoice.col.description": "DÉSIGNATION",
  "doc.invoice.col.quantity": "QUANTITÉ",
  "doc.invoice.col.unitPrice": "PRIX UNITAIRE",
  "doc.invoice.col.amount": "MONTANT",
  "doc.invoice.subtotal": "Sous-total hors TVA",
  "doc.invoice.vat": "TVA {rate}%",
  "doc.invoice.total": "Total de la facture TVA incluse",
  "doc.invoice.paymentTerms": "Conditions de paiement : ",
  "doc.invoice.closing": "Avec nos meilleures salutations",
  "doc.invoice.defaultIntro":
    "Pour l'exécution des travaux que vous nous avez confiés, nous vous facturons ce qui suit :",
  "doc.invoice.defaultOutro": "Nous vous remercions de votre commande.",
  // Printed on the sheet when the body would run into the QR payment part.
  "doc.invoice.overflowWarning":
    "ATTENTION : facture trop longue pour une page — réduire les positions.",

  // --- Swiss QR-bill -----------------------------------------------------------------------------
  // LEGALLY NORMED WORDING (SIX "Swiss Implementation Guidelines QR-bill", Annex C).
  // These are NOT free translations — the payment part must carry the exact official
  // strings for the language it is printed in, or the slip is non-compliant. Do not
  // "improve" them.
  "doc.qr.receipt": "Récépissé",
  "doc.qr.paymentPart": "Section paiement",
  "doc.qr.account": "Compte / Payable à",
  "doc.qr.reference": "Référence",
  "doc.qr.payableBy": "Payable par",
  "doc.qr.payableByBlank": "Payable par (nom/adresse)",
  "doc.qr.currency": "Monnaie",
  "doc.qr.amount": "Montant",
  "doc.qr.acceptancePoint": "Point de dépôt",
  "doc.qr.additionalInfo": "Informations supplémentaires",
  "doc.qr.separateNotice": "A détacher avant le versement",

  // =============================================================================
  // Reçu
  // =============================================================================
  "doc.receipt.title": "Reçu",
  "doc.receipt.numbered": "Reçu {number}",
  "doc.receipt.customer": "Client",
  "doc.receipt.details": "Détails",
  "doc.receipt.date": "Date : ",
  "doc.receipt.number": "N° de reçu : ",
  "doc.receipt.vatNumber": "N° TVA : ",
  "doc.receipt.iban": "IBAN : ",
  "doc.receipt.col.description": "Description",
  "doc.receipt.col.rate": "Tarif / remarque",
  "doc.receipt.col.amount": "Montant CHF",
  "doc.receipt.extras": "Prestations supplémentaires",
  "doc.receipt.onSiteExtras": "Compléments sur place (manuscrits)",
  "doc.receipt.subtotal": "Sous-total :",
  "doc.receipt.discount": "Rabais :",
  "doc.receipt.vat": "TVA ({rate}%) :",
  "doc.receipt.total": "Total général :",
  "doc.receipt.outstanding": "Montant encore dû",
  "doc.receipt.paymentMethod": "Mode de paiement",
  "doc.receipt.payment.open": "Encore ouvert",
  "doc.receipt.payment.cash": "Espèces",
  "doc.receipt.payment.card": "Paiement par carte",
  "doc.receipt.payment.twint": "Twint",
  "doc.receipt.signature.customer": "Date / signature du client",
  "doc.receipt.signature.teamLead": "Date / signature du chef d'équipe",
  "doc.receipt.thanks": "UN GRAND MERCI POUR VOTRE MANDAT !",
  "doc.receipt.review": "Nous nous réjouissons de votre évaluation : {url}",

  // --- Reçu : positions préremplies ------------------------------------------------
  "doc.receipt.item.umzug": "Déménagement",
  "doc.receipt.item.reinigung": "Nettoyage",
  "doc.receipt.item.packingMaterial": "Matériel d'emballage",
  "doc.receipt.item.liftRental": "Location du monte-meubles",
  "doc.receipt.item.disposal": "Évacuation / débarras",
  "doc.receipt.item.heavySurcharge": "Supplément transport lourd",
  "doc.receipt.item.extraService": "Prestation supplémentaire",
  "doc.receipt.item.travelFlatRate": "Forfait de déplacement",

  // =============================================================================
  // Mandat (work order — internal/team document, but printed and handed to the
  // customer on site for signature, so it follows the customer's language)
  // =============================================================================
  "doc.workorder.title": "ORDRE DE TRAVAIL",
  "doc.workorder.service": "Prestation : ",
  "doc.workorder.section.customer": "CLIENT",
  "doc.workorder.section.appointment": "DATE",
  "doc.workorder.section.team": "ÉQUIPE",
  "doc.workorder.section.addresses": "ADRESSES",
  "doc.workorder.section.serviceDetails": "DÉTAILS DE LA PRESTATION",
  "doc.workorder.section.byEffort": "FACTURATION SELON DÉPENSE EFFECTIVE",
  "doc.workorder.section.estimate": "DEVIS ESTIMATIF",
  "doc.workorder.section.items": "PRESTATIONS & PRIX",
  "doc.workorder.section.extraServices": "PRESTATIONS SUPPLÉMENTAIRES",
  "doc.workorder.section.description": "DESCRIPTION",
  "doc.workorder.section.notices": "⚠ REMARQUES IMPORTANTES",
  "doc.workorder.section.extraWork": "TRAVAUX SUPPLÉMENTAIRES",
  "doc.workorder.extraWork.hint": "(Pour les inscriptions sur place)",
  "doc.workorder.phone": "Tél. : ",
  "doc.workorder.time": "Heure : ",
  "doc.workorder.duration": "Durée : ~",
  "doc.workorder.teamLead": "Chef d'équipe :",
  "doc.workorder.otherStaff": "Autres collaborateurs :",
  "doc.workorder.unassigned": "Non attribué",
  "doc.workorder.from": "De :",
  "doc.workorder.to": "À :",
  "doc.workorder.hourlyRate": "Tarif horaire : {rate}/h",
  "doc.workorder.finalPriceNote": "Le prix final sera calculé à l'issue des travaux.",
  "doc.workorder.col.description": "Description",
  "doc.workorder.col.quantity": "Quantité",
  "doc.workorder.col.quantityShort": "Qté",
  "doc.workorder.col.price": "Prix",
  "doc.workorder.col.total": "Total",
  "doc.workorder.subtotal": "Sous-total :",
  "doc.workorder.vat": "TVA ({rate}%) :",
  "doc.workorder.estimated": "Estimé :",
  "doc.workorder.total": "Montant total :",
  "doc.workorder.extraSubtotal": "Sous-total travaux supplémentaires :",
  "doc.workorder.grandTotal": "MONTANT TOTAL (travaux supplémentaires inclus) :",
  "doc.workorder.remarks": "Remarques :",
  "doc.workorder.included": "incl.",
  "doc.workorder.onRequest": "sur demande",
  "doc.workorder.signature.customer": "Signature du client :",
  "doc.workorder.signature.staff": "Signature du collaborateur :",
  "doc.workorder.placeDate": "Lieu, date :",

  // --- Mandat detail labels ---------------------------------------------------------------
  "doc.detail.rooms": "Pièces",
  "doc.detail.livingSpace": "Surface habitable (m²)",
  "doc.detail.fromFloor": "Étage (départ)",
  "doc.detail.fromLift": "Ascenseur disponible (départ)",
  "doc.detail.toFloor": "Étage (arrivée)",
  "doc.detail.toLift": "Ascenseur disponible (arrivée)",
  "doc.detail.propertyType": "Type d'objet",
  "doc.detail.distance": "Distance (km)",
  "doc.detail.packing": "Service d'emballage",
  "doc.detail.finalCleaning": "Nettoyage final",
  "doc.detail.storage": "Stockage nécessaire",
  "doc.detail.piano": "Transport de piano",
  "doc.detail.bathrooms": "Salles de bain",
  "doc.detail.kitchen": "Cuisine",
  "doc.detail.balcony": "Balcon",
  "doc.detail.garage": "Garage",
  "doc.detail.cellar": "Cave",
  "doc.detail.attic": "Galetas",
  "doc.detail.windowCleaning": "Nettoyage des vitres",
  "doc.detail.pianoType": "Type de piano",
  "doc.detail.weight": "Poids (kg)",
  "doc.detail.clearanceType": "Type de débarras",
  "doc.detail.estimatedVolume": "Volume estimé",
  "doc.detail.heavyItems": "Objets lourds",
  "doc.detail.heavyItemsDescription": "Description des objets lourds",
  "doc.detail.storageDuration": "Durée de stockage",
  "doc.detail.storageVolume": "Volume de stockage",

  // =============================================================================
  // CG
  // =============================================================================
  "doc.agb.title": "Conditions générales (CG)",
  "doc.agb.subtitle": "{company} - version en vigueur au moment de l'offre",
  "doc.agb.subtitleGeneric": "Version en vigueur au moment de l'offre",

  // =============================================================================
  // Bon de livraison des cartons
  // =============================================================================
  "doc.boxes.title": "BON DE LIVRAISON DES CARTONS",
  "doc.boxes.customer": "Client",
  "doc.boxes.addresses": "Adresses",
  "doc.boxes.appointments": "Dates",
  "doc.boxes.overview": "Aperçu des cartons",
  "doc.boxes.costs": "Coûts & caution",
  "doc.boxes.remarks": "Remarques",
  "doc.boxes.terms": "Conditions de location :",
  "doc.boxes.status": "Statut : ",
  "doc.boxes.deliveryAddress": "Adresse de livraison (livraison des cartons)",
  "doc.boxes.pickupAddress": "Adresse d'enlèvement (reprise des cartons)",
  "doc.boxes.notSpecified": "Non indiqué",
  "doc.boxes.notYetSpecified": "Pas encore indiqué",
  "doc.boxes.deliveryDate": "Date de livraison :",
  "doc.boxes.returnDate": "Restitution prévue :",
  "doc.boxes.kind": "Type :",
  "doc.boxes.rental": "Location",
  "doc.boxes.purchase": "Achat/vente",
  "doc.boxes.col.type": "Type de carton",
  "doc.boxes.col.count": "Nombre",
  "doc.boxes.col.status": "Statut",
  "doc.boxes.total": "Total :",
  "doc.boxes.unit": "Cartons",
  "doc.boxes.pricePerDay": "Prix de location par jour : ",
  "doc.boxes.deposit": "Caution : ",
  "doc.boxes.paid": "(Payé)",
  "doc.boxes.unpaid": "(Ouvert)",
  "doc.boxes.customerNotes": "Remarques du client :",
  "doc.boxes.signature.customer": "Signature du client",
  "doc.boxes.signature.supplier": "Signature du fournisseur",
  "doc.boxes.terms.care":
    "Les cartons doivent être manipulés avec soin et protégés contre tout dommage.",
  "doc.boxes.terms.damage":
    "En cas de perte ou de dommage, la valeur de remplacement est facturée.",
  "doc.boxes.terms.return": "La restitution doit avoir lieu à la date convenue.",
  "doc.boxes.status.reserviert": "Réservé",
  "doc.boxes.status.geliefert": "Livré",
  "doc.boxes.status.in_gebrauch": "En cours d'utilisation",
  "doc.boxes.status.abholung_angefragt": "Enlèvement demandé",
  "doc.boxes.status.abholung_geplant": "Enlèvement planifié",
  "doc.boxes.status.zurueckgegeben": "Restitué",
  "doc.boxes.status.verloren": "Perdu",
  "doc.boxes.status.beschaedigt": "Endommagé",
  "doc.boxes.type.standard": "Standard",
  "doc.boxes.type.kleiderbox": "Carton-penderie",
  "doc.boxes.type.buecherbox": "Carton à livres",
  "doc.boxes.type.fragile": "Fragile",
  "doc.boxes.type.archivbox": "Carton d'archives",
  "doc.boxes.type.andere": "Autre",

  // --- Checklist ------------------------------------------------------------------------------
  "doc.checklist.title": "Liste de contrôle",
  "doc.checklist.page": "Page {page}",
};
