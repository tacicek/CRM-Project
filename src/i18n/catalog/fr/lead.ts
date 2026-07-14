import { lead as de } from "@/i18n/catalog/de/lead";

export const lead: Record<keyof typeof de, string> = {
  // --- Anfragen list ---------------------------------------------------------------
  "lead.pageTitle": "Demandes · CRM",
  "lead.title": "Demandes",
  "lead.subtitle":
    "Demandes entrantes issues des formulaires web, des imports et de la saisie directe — prêtes pour le devis.",
  "lead.count": "{count} demandes",
  "lead.count#one": "{count} demande",
  "lead.count#other": "{count} demandes",
  "lead.groupCount": "{count} groupes",
  "lead.groupCount#one": "{count} groupe",
  "lead.groupCount#other": "{count} groupes",
  "lead.refresh": "Actualiser",
  "lead.new": "Nouvelle demande",
  "lead.searchPlaceholder": "Rechercher dans les demandes …",
  "lead.tab.all": "Toutes",
  "lead.tab.offered": "Devis établi",
  "lead.group.other": "Autres",
  "lead.empty.title": "Aucune demande importée pour l'instant",
  "lead.empty.description": "Importez les demandes reçues par e-mail ou via vos formulaires web.",
  "lead.empty.action": "Importer une première demande",
  "lead.noResults": "Aucune demande ne correspond à votre recherche.",

  // --- Anfrage card ------------------------------------------------------------------
  "lead.card.unknownCustomer": "Client inconnu",
  "lead.card.new": "Nouveau",
  "lead.card.offerNumber": "Devis n° {number}",
  "lead.card.offerCreated": "Devis établi",
  "lead.card.languageHint":
    "Langue du client — le devis, le PDF et les e-mails partiront dans cette langue.",
  "lead.card.roomsShort": "p.",

  // --- Actions -------------------------------------------------------------------------
  "lead.action.viewOffer": "Consulter le devis",
  "lead.action.newOffer": "Nouveau devis",
  "lead.action.createOffer": "Créer un devis",
  "lead.action.besichtigung": "Visite",
  "lead.action.planAppointment": "Planifier un rendez-vous",
  "lead.action.planAppointmentHint": "Planifier le rendez-vous dans le calendrier",
  "lead.action.editHint": "Modifier la demande",

  // --- Detail dialog ----------------------------------------------------------------------
  "lead.detail.contact": "Contact",
  "lead.detail.address": "Adresse",
  "lead.detail.from": "De",
  "lead.detail.to": "À",
  "lead.detail.appointment": "Rendez-vous",
  "lead.detail.rooms": "Pièces",
  "lead.detail.area": "Surface",
  "lead.detail.description": "Description",

  // --- Toasts ------------------------------------------------------------------------------
  "lead.toast.loadFailed": "Les demandes n'ont pas pu être chargées.",
  "lead.toast.deleteConfirm": "Voulez-vous vraiment supprimer cette demande ?",
  "lead.toast.deletedTitle": "Supprimée",
  "lead.toast.deleted": "La demande a été supprimée.",
  "lead.toast.deleteFailed": "La suppression a échoué.",
  "lead.toast.savedTitle": "Enregistré",

  // --- Edit dialog -------------------------------------------------------------------------
  "lead.edit.title": "Modifier la demande",
  "lead.edit.description":
    "{service} — les corrections sont enregistrées directement sur la demande.",
  "lead.edit.saved": "La demande a été mise à jour.",
  "lead.edit.saveFailed": "La demande n'a pas pu être enregistrée.",

  // --- Section headers ---------------------------------------------------------------------
  "lead.section.contact": "Contact",
  "lead.section.extras": "Prestations complémentaires",
  "lead.section.propertyDetails": "Détails du bien",
  "lead.section.additionalAreas": "Zones supplémentaires",
  "lead.section.clearingDetails": "Détails du débarras",
  "lead.section.disposalDetails": "Détails de l'élimination",
  "lead.section.storageDetails": "Détails du stockage",
  "lead.section.deliveryAddress": "Adresse de livraison",
  "lead.section.pianoDetails": "Détails du piano",
  "lead.section.liftDetails": "Détails du monte-meubles",
  "lead.section.addressFrom": "Adresse (départ)",
  "lead.section.addressTo": "Adresse (arrivée)",

  // --- Fields --------------------------------------------------------------------------------
  "lead.field.preferredDate": "Date souhaitée",
  "lead.field.customerLanguage": "Langue du client",
  "lead.field.customerLanguageHint":
    "Langue du devis, du PDF et des e-mails destinés au client — il ne s'agit pas de la langue de votre tableau de bord. Corrigible si l'IA s'est trompée.",
  "lead.field.descriptionNotes": "Description / notes",
  "lead.field.floor": "Étage",
  "lead.field.hasLift": "Ascenseur disponible ?",
  "lead.field.hasEstrich": "Combles disponibles ?",
  "lead.field.hasKeller": "Cave disponible ?",
  "lead.field.hasKellerGarage": "Cave/garage disponible ?",
  "lead.field.rooms": "Pièces",
  "lead.field.livingSpace": "Surface habitable (m²)",
  "lead.field.propertyType": "Type de bien",
  "lead.field.bathrooms": "Salles de bains",
  "lead.field.kitchenType": "Type de cuisine",
  "lead.field.cleaningType": "Type de nettoyage",
  "lead.field.clearingType": "Type de débarras",
  "lead.field.estimatedVolume": "Volume estimé",
  "lead.field.heavyItems": "Objets lourds présents",
  "lead.field.heavyItemsDescription": "Objets lourds (description)",
  "lead.field.disposalType": "Type d'élimination",
  "lead.field.itemsDescription": "Description des objets",
  "lead.field.storageDuration": "Durée du stockage",
  "lead.field.storageVolume": "Volume",
  "lead.field.accessFrequency": "Fréquence d'accès",
  "lead.field.climateControl": "Local de stockage climatisé requis",
  "lead.field.storageItems": "Que faut-il entreposer ?",
  "lead.field.pianoType": "Type de piano",
  "lead.field.pianoBrand": "Marque",
  "lead.field.pianoWeight": "Poids (kg)",
  "lead.field.staircaseType": "Type d'escalier",
  "lead.field.staircaseWidth": "Largeur de l'escalier (cm)",
  "lead.field.windowAccess": "Accès par la fenêtre possible (pour la grue)",
  "lead.field.liftFloor": "Étage",
  "lead.field.direction": "Sens",
  "lead.field.dimensions": "Dimensions",
  "lead.field.liftItems": "Que faut-il transporter ?",

  // --- Add-on services (checkboxes) -------------------------------------------------------
  "lead.extra.packing": "Service d'emballage",
  "lead.extra.furnitureAssembly": "Montage de meubles",
  "lead.extra.cleaning": "Nettoyage",
  "lead.extra.storage": "Entreposage",
  "lead.extra.piano": "Transport de piano",
  "lead.extra.balcony": "Balcon/terrasse",
  "lead.extra.garage": "Garage",
  "lead.extra.basement": "Cave",
  "lead.extra.attic": "Combles/grenier",

  // --- Placeholders ------------------------------------------------------------------------
  "lead.placeholder.phone": "+41 79 123 45 67",
  "lead.placeholder.pianoBrand": "p. ex. Steinway, Yamaha",
  "lead.placeholder.pianoWeight": "env. 200-500 kg",
  "lead.placeholder.staircaseWidth": "p. ex. 90, 100",
  "lead.placeholder.dimensions": "p. ex. 200 × 100 × 50 cm",
  "lead.placeholder.liftItems": "Que faut-il transporter avec le monte-meubles …",
  "lead.placeholder.heavyItems": "Description des objets lourds …",
  "lead.placeholder.disposalItems": "Que faut-il éliminer …",
  "lead.placeholder.storageItems": "Description des biens à entreposer …",
  "lead.placeholder.preferredTime": "p. ex. 09:00, matin, après-midi",

  // --- Select option labels (the stored VALUES stay German DB tokens) ----------------------
  "lead.option.property.wohnung": "Appartement",
  "lead.option.property.haus": "Maison",
  "lead.option.property.studio": "Studio",
  "lead.option.property.buero": "Bureau",
  "lead.option.property.keller": "Cave",
  "lead.option.property.estrich": "Combles",
  "lead.option.kitchen.offen": "Cuisine ouverte",
  "lead.option.kitchen.geschlossen": "Cuisine fermée",
  "lead.option.kitchen.kochnische": "Kitchenette",
  "lead.option.cleaning.end": "Nettoyage de fin de bail",
  "lead.option.cleaning.grund": "Nettoyage en profondeur",
  "lead.option.cleaning.unterhalt": "Nettoyage d'entretien",
  "lead.option.clearing.wohnung": "Débarras d'appartement",
  "lead.option.clearing.haus": "Débarras de maison",
  "lead.option.clearing.keller": "Débarras de cave",
  "lead.option.clearing.dachboden": "Débarras de grenier",
  "lead.option.clearing.buero": "Débarras de bureau",
  "lead.option.clearingVolume.klein": "Petit (quelques objets)",
  "lead.option.clearingVolume.mittel": "Moyen (partiellement meublé)",
  "lead.option.clearingVolume.gross": "Grand (entièrement meublé)",
  "lead.option.clearingVolume.sehrGross": "Très grand (surchargé)",
  "lead.option.disposal.sperrmuell": "Encombrants",
  "lead.option.disposal.elektroschrott": "Déchets électroniques",
  "lead.option.disposal.bauschutt": "Gravats",
  "lead.option.disposal.hausrat": "Biens ménagers",
  "lead.option.disposal.moebel": "Meubles",
  "lead.option.disposal.gemischt": "Mixte",
  "lead.option.disposalVolume.klein": "Petit (1-2 m³)",
  "lead.option.disposalVolume.mittel": "Moyen (3-5 m³)",
  "lead.option.disposalVolume.gross": "Grand (6-10 m³)",
  "lead.option.disposalVolume.sehrGross": "Très grand (10+ m³)",
  "lead.option.storageDuration.kurzfristig": "Court terme (quelques jours)",
  "lead.option.storageDuration.m1_3": "1-3 mois",
  "lead.option.storageDuration.m3_6": "3-6 mois",
  "lead.option.storageDuration.m6_12": "6-12 mois",
  "lead.option.storageDuration.langfristig": "Long terme (1 an et plus)",
  "lead.option.storageVolume.klein": "Petit (1-5 m³)",
  "lead.option.storageVolume.mittel": "Moyen (5-15 m³)",
  "lead.option.storageVolume.gross": "Grand (15-30 m³)",
  "lead.option.storageVolume.sehrGross": "Très grand (30+ m³)",
  "lead.option.access.nie": "Aucun accès nécessaire",
  "lead.option.access.selten": "Rarement",
  "lead.option.access.monatlich": "Mensuellement",
  "lead.option.access.woechentlich": "Hebdomadairement",
  "lead.option.piano.klavier": "Piano droit",
  "lead.option.piano.fluegel": "Piano à queue",
  "lead.option.piano.ePiano": "Piano électrique",
  "lead.option.piano.keyboard": "Clavier",
  "lead.option.staircase.keine": "Pas d'escalier",
  "lead.option.staircase.gerade": "Escalier droit",
  "lead.option.staircase.kurvig": "Escalier tournant",
  "lead.option.staircase.wendel": "Escalier en colimaçon",
  "lead.option.direction.hoch": "Vers le haut (emménagement)",
  "lead.option.direction.runter": "Vers le bas (déménagement)",
  "lead.option.direction.beides": "Les deux",

  // --- Validation ----------------------------------------------------------------------------
  "lead.validation.invalidEmail": "Adresse e-mail non valable",
  "lead.validation.invalidEmailHint": "Veuillez saisir une adresse e-mail valable.",
  "lead.validation.invalidPhone": "Numéro de téléphone non valable",
  "lead.validation.invalidPhoneHint":
    "Veuillez saisir un numéro de téléphone suisse valable (p. ex. +41 79 123 45 67).",
  "lead.validation.invalidPlz": "NPA non valable",
  "lead.validation.invalidPlzSection": "{section} : le NPA doit comporter 4 chiffres.",
  "lead.validation.invalidPlzValue":
    "{field} : « {plz} » n'est pas un NPA suisse valable (4 chiffres).",
  "lead.validation.plzRequired": "NPA requis",
  "lead.validation.plzRequiredHint":
    "{field} est requis pour ce type de prestation. Veuillez saisir un NPA suisse valable (4 chiffres).",
  "lead.validation.invalidDate": "Date non valable",
  "lead.validation.invalidDateHint": "Veuillez saisir une date valable.",
  "lead.validation.missingCustomer": "Données client manquantes",
  "lead.validation.missingCustomerHint":
    "Lorsque la confiance de l'IA est faible, au moins un nom doit être indiqué.",
  "lead.plz.from": "NPA de départ",
  "lead.plz.to": "NPA d'arrivée",
  "lead.plz.address": "NPA de l'adresse",
  "lead.plz.pickup": "NPA d'enlèvement",

  // --- Manual import ---------------------------------------------------------------------------
  "lead.import.pageTitle": "Import manuel de demande | {company}",
  "lead.import.title": "Importer une demande",
  "lead.import.subtitle":
    "Collez la demande reçue par e-mail ou via un formulaire web — l'IA reconnaît le type de prestation et en extrait toutes les informations.",
  "lead.import.step1": "Étape 1 : coller le texte de la demande",
  "lead.import.step2": "Étape 2 : vérifier les données extraites",
  "lead.import.step2Hint": "Vérifiez et corrigez les données extraites",
  "lead.import.textPlaceholder": `Collez ici l'intégralité de la demande reçue par e-mail ou via votre formulaire web …

Exemples de demandes :

📦 DÉMÉNAGEMENT :
De : max.mustermann@email.com
J'ai besoin d'un déménagement de Zurich à Berne.
Départ : Hauptstrasse 123, 8001 Zurich, 3e étage
Arrivée : Bahnhofplatz 5, 3011 Berne, rez-de-chaussée
3.5 pièces, 80 m², date : 15.02.2025

🧹 NETTOYAGE :
Bonjour, j'ai besoin d'un nettoyage de fin de bail.
Adresse : Seestrasse 45, 8800 Thalwil
Appartement de 4 pièces, 95 m², 2 salles de bains
Avec balcon et cave

🎹 TRANSPORT DE PIANO :
Nous souhaitons transporter un piano à queue.
De : Bahnhofstr. 10, 8001 Zurich (2e étage)
À : Seeweg 5, 6300 Zoug (rez-de-chaussée)
Piano à queue Steinway, env. 350 kg`,
  "lead.import.textAria": "Saisir le texte de la demande",
  "lead.import.minChars": "{count} caractères au minimum",
  "lead.import.charCount": "{current} / {max} caractères",
  "lead.import.moreDetails": "Veuillez saisir davantage de détails ({count} caractères manquants).",
  "lead.import.extract": "Extraire avec l'IA",
  "lead.import.processing": "Traitement en cours …",
  "lead.import.stepAnalyzing": "Analyse du texte …",
  "lead.import.stepExtracting": "Extraction des données par l'IA …",
  "lead.import.resetAria": "Réinitialiser le texte",
  "lead.import.detectedService": "Type de prestation détecté",
  "lead.import.confidence": "Confiance de l'IA",
  "lead.import.lowConfidence": "Veuillez vérifier attentivement les données extraites.",
  "lead.import.contactInfo": "Coordonnées",
  "lead.import.languageSection": "Langue du client",
  "lead.import.languageLabel": "Le client a écrit en",
  "lead.import.languageHint":
    "Détectée par l'IA. Le client recevra le devis, le PDF et les e-mails dans cette langue. Votre propre affichage dans le tableau de bord n'en est pas affecté.",
  "lead.import.appointment": "Rendez-vous",
  "lead.import.preferredDate": "Date souhaitée",
  "lead.import.preferredTime": "Heure / plage horaire",
  "lead.import.specialNotes": "Remarques particulières",
  "lead.import.backAria": "Retour à la saisie du texte",
  "lead.import.save": "Enregistrer la demande",
  "lead.import.saving": "Enregistrement …",
  "lead.import.discardTitle": "Abandonner les modifications ?",
  "lead.import.discardDescription":
    "Vous avez des modifications non enregistrées. Si vous revenez en arrière, toutes les modifications seront perdues. Voulez-vous vraiment continuer ?",
  "lead.import.discardConfirm": "Abandonner et revenir",
  "lead.import.companyLoadFailed": "Les données de l'entreprise n'ont pas pu être chargées.",
  "lead.import.textTooShort": "Texte trop court",
  "lead.import.textTooShortHint": "Veuillez saisir au moins {count} caractères.",
  "lead.import.textTooLong": "Texte trop long",
  "lead.import.textTooLongHint": "Veuillez réduire le texte à {count} caractères au maximum.",
  "lead.import.extracted": "Données extraites",
  "lead.import.extractedHint": "Prestation : {service} | confiance de l'IA : {score} %",
  "lead.import.extractFailed": "Échec de l'extraction",
  "lead.import.sessionExpired": "Session expirée",
  "lead.import.sessionExpiredHint":
    "Veuillez recharger la page ou vous reconnecter.",
  "lead.import.imported": "Demande importée",
  "lead.import.importedHint":
    "La demande a été importée avec succès et figure désormais dans vos demandes.",
  "lead.import.saveFailed": "Erreur lors de l'enregistrement",

  // --- Error messages ---------------------------------------------------------------------------
  "lead.error.network": "Erreur réseau. Veuillez vérifier votre connexion Internet.",
  "lead.error.timeout": "La requête a pris trop de temps. Veuillez réessayer.",
  "lead.error.unauthorized": "Votre session a expiré. Veuillez vous reconnecter.",
  "lead.error.rateLimit": "Trop de requêtes. Veuillez patienter un instant.",
  "lead.error.importFailed": "Échec de l'import",
  "lead.error.unexpected": "Une erreur inattendue est survenue. Veuillez réessayer.",

  // --- Anfrage summary on an appointment ---------------------------------------------------------
  "lead.summary.title": "Détails de la demande",
  "lead.summary.moveOut": "Départ",
  "lead.summary.moveIn": "Arrivée",
  "lead.summary.lift": "Ascenseur",
  "lead.summary.noLift": "Pas d'ascenseur",
  "lead.summary.estrich": "Combles",
  "lead.summary.keller": "Cave",
  "lead.summary.rooms": "{count} p.",
  "lead.floor.basement": "Sous-sol",
  "lead.floor.ground": "Rez-de-chaussée",
  "lead.floor.upper": "{floor}e étage",
};
