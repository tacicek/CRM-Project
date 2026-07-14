import { domain as de } from "@/i18n/catalog/de/domain";

/**
 * Domain vocabulary — French (fr-CH).
 *
 * Typed against the German catalog: a missing or misspelled key is a compile
 * error. Business French, formal register (vouvoiement).
 */
export const domain: Record<keyof typeof de, string> = {
  // --- Service types (offers, leads, auftraege) ---------------------------------
  "domain.service.umzug": "Déménagement",
  "domain.service.umzug_privat": "Déménagement privé",
  "domain.service.umzug_firma": "Déménagement d'entreprise",
  "domain.service.umzug_buero": "Déménagement de bureau",
  "domain.service.umzug_international": "Déménagement international",
  "domain.service.transport": "Transport",
  "domain.service.klaviertransport": "Transport de piano",
  "domain.service.moebellift": "Monte-meubles",
  "domain.service.reinigung": "Nettoyage",
  "domain.service.raeumung": "Débarras",
  "domain.service.entsorgung": "Élimination",
  "domain.service.lagerung": "Stockage",
  "domain.service.malerarbeit": "Travaux de peinture",
  "domain.service.renovation": "Rénovation",
  "domain.service.allgemein": "Général",

  // --- Appointment label per service --------------------------------------------
  "domain.appointment.umzug": "Date du déménagement",
  "domain.appointment.reinigung": "Date du nettoyage",
  "domain.appointment.raeumung": "Date du débarras",
  "domain.appointment.entsorgung": "Date de l'élimination",
  "domain.appointment.lagerung": "Date du stockage",
  "domain.appointment.transport": "Date du transport",
  "domain.appointment.klaviertransport": "Date du transport",
  "domain.appointment.moebellift": "Date de l'intervention",
  "domain.appointment.default": "Date d'exécution",

  // --- Address card headers per service ----------------------------------------
  "domain.address.umzug.primary": "Adresse de départ",
  "domain.address.umzug.secondary": "Adresse d'arrivée",
  "domain.address.reinigung.primary": "Adresse de nettoyage",
  "domain.address.raeumung.primary": "Adresse du débarras",
  "domain.address.entsorgung.primary": "Adresse d'enlèvement",
  "domain.address.entsorgung.secondary": "Adresse d'élimination",
  "domain.address.lagerung.primary": "Adresse d'enlèvement",
  "domain.address.lagerung.secondary": "Adresse de l'entrepôt",
  "domain.address.klaviertransport.primary": "Adresse d'enlèvement",
  "domain.address.klaviertransport.secondary": "Adresse de destination",
  "domain.address.moebellift.primary": "Adresse d'intervention",
  "domain.address.default.primary": "Adresse d'intervention",
  "domain.address.default.secondary": "Adresse supplémentaire",

  // --- Offer status --------------------------------------------------------------
  "domain.offerStatus.draft": "Brouillon",
  "domain.offerStatus.sent": "Envoyé",
  "domain.offerStatus.viewed": "Consulté",
  "domain.offerStatus.accepted": "Accepté",
  "domain.offerStatus.rejected": "Refusé",

  // --- Auftrag status (enum auftrag_status) ---------------------------------------
  "domain.auftragStatus.geplant": "Planifié",
  "domain.auftragStatus.bestaetigt": "Confirmé",
  "domain.auftragStatus.in_bearbeitung": "En cours",
  "domain.auftragStatus.abgeschlossen": "Terminé",
  "domain.auftragStatus.storniert": "Annulé",

  // --- Rechnung status -------------------------------------------------------------
  "domain.rechnungStatus.entwurf": "Brouillon",
  "domain.rechnungStatus.versendet": "Envoyée",
  "domain.rechnungStatus.bezahlt": "Payée",
  "domain.rechnungStatus.ueberfaellig": "En retard",

  // --- Quittung status -------------------------------------------------------------
  "domain.quittungStatus.draft": "Brouillon",
  "domain.quittungStatus.signed": "Signé",
  "domain.quittungStatus.sent": "Envoyé",
  "domain.quittungStatus.paid": "Payé",

  // --- Appointment status / type (enums) --------------------------------------------
  "domain.appointmentStatus.pending": "En attente",
  "domain.appointmentStatus.confirmed": "Confirmé",
  "domain.appointmentStatus.completed": "Terminé",
  "domain.appointmentStatus.cancelled": "Annulé",
  "domain.appointmentStatus.rescheduled": "Reporté",
  "domain.appointmentStatus.no_show": "Non présenté",
  "domain.appointmentType.besichtigung": "Visite",
  "domain.appointmentType.service": "Prestation",
  "domain.appointmentType.follow_up": "Relance",
  "domain.appointmentType.meeting": "Entretien",
  "domain.appointmentType.blocked": "Bloqué",

  // --- Price models -------------------------------------------------------------------
  "domain.priceModel.pauschal": "Forfait",
  "domain.priceModel.stundenansatz": "Tarif horaire",
  "domain.priceModel.kostendach": "Prix plafond",
  "domain.priceModel.onRequest": "sur demande",
  "domain.priceModel.included": "compris dans le prix",
  "domain.priceModel.byEffort": "selon dépense effective",

  // --- Units ---------------------------------------------------------------------------
  "domain.unit.hour": "h",
  "domain.unit.hour.long": "Heure",
  "domain.unit.hour.plural": "Heures",
  "domain.unit.day": "Jour",
  "domain.unit.day.plural": "Jours",
  "domain.unit.month": "Mois",
  "domain.unit.person": "Personne",
  "domain.unit.person.plural": "Personnes",
  "domain.unit.piece": "Pièce",
  "domain.unit.flatRate": "Forfait",
  "domain.unit.perHour": "par heure",
  "domain.unit.perM3": "par m³",
  "domain.unit.perM2": "par m²",
  "domain.unit.perMonth": "par mois",
  "domain.unit.perUnit": "par {unit}",

  // --- Yes / No --------------------------------------------------------------------------
  "domain.yes": "Oui",
  "domain.no": "Non",

  // --- Salutations -----------------------------------------------------------------------
  // The salutation comes from the stored `customer_salutation` and falls back to
  // the neutral form — no gender guessing from the first name.
  "domain.salutation.herr": "Monsieur",
  "domain.salutation.frau": "Madame",
  "domain.salutation.letter.herr": "Monsieur {lastName},",
  "domain.salutation.letter.frau": "Madame {lastName},",
  "domain.salutation.letter.neutral": "Madame, Monsieur,",
  "domain.salutation.email.herr": "Monsieur {lastName}",
  "domain.salutation.email.frau": "Madame {lastName}",
  "domain.salutation.email.neutral": "Madame, Monsieur",
  "domain.salutation.greeting": "Bonjour {firstName} {lastName},",
  "domain.salutation.closing": "Avec nos meilleures salutations",
};
