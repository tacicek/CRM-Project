import { domain as de } from "@/i18n/catalog/de/domain";

/**
 * Domain vocabulary — English (en-GB).
 *
 * Typed against the German catalog: a missing or misspelled key is a compile
 * error. Formal business English.
 */
export const domain: Record<keyof typeof de, string> = {
  // --- Service types (offers, leads, auftraege) ---------------------------------
  "domain.service.umzug": "Move",
  "domain.service.umzug_privat": "Private move",
  "domain.service.umzug_firma": "Company move",
  "domain.service.umzug_buero": "Office move",
  "domain.service.umzug_international": "International move",
  "domain.service.transport": "Transport",
  "domain.service.klaviertransport": "Piano transport",
  "domain.service.moebellift": "Furniture lift",
  "domain.service.reinigung": "Cleaning",
  "domain.service.raeumung": "Clearance",
  "domain.service.entsorgung": "Disposal",
  "domain.service.lagerung": "Storage",
  "domain.service.malerarbeit": "Painting work",
  "domain.service.renovation": "Renovation",
  "domain.service.allgemein": "General",

  // --- Appointment label per service --------------------------------------------
  "domain.appointment.umzug": "Moving date",
  "domain.appointment.reinigung": "Cleaning date",
  "domain.appointment.raeumung": "Clearance date",
  "domain.appointment.entsorgung": "Disposal date",
  "domain.appointment.lagerung": "Storage date",
  "domain.appointment.transport": "Transport date",
  "domain.appointment.klaviertransport": "Transport date",
  "domain.appointment.moebellift": "On-site date",
  "domain.appointment.default": "Service date",

  // --- Address card headers per service ----------------------------------------
  "domain.address.umzug.primary": "Move-out address",
  "domain.address.umzug.secondary": "Move-in address",
  "domain.address.reinigung.primary": "Cleaning address",
  "domain.address.raeumung.primary": "Clearance address",
  "domain.address.entsorgung.primary": "Collection address",
  "domain.address.entsorgung.secondary": "Disposal address",
  "domain.address.lagerung.primary": "Collection address",
  "domain.address.lagerung.secondary": "Storage address",
  "domain.address.klaviertransport.primary": "Collection address",
  "domain.address.klaviertransport.secondary": "Destination address",
  "domain.address.moebellift.primary": "Site address",
  "domain.address.default.primary": "Site address",
  "domain.address.default.secondary": "Additional address",

  // --- Offer status --------------------------------------------------------------
  "domain.offerStatus.draft": "Draft",
  "domain.offerStatus.sent": "Sent",
  "domain.offerStatus.viewed": "Viewed",
  "domain.offerStatus.accepted": "Accepted",
  "domain.offerStatus.rejected": "Rejected",

  // --- Auftrag status (enum auftrag_status) ---------------------------------------
  "domain.auftragStatus.geplant": "Planned",
  "domain.auftragStatus.bestaetigt": "Confirmed",
  "domain.auftragStatus.in_bearbeitung": "In progress",
  "domain.auftragStatus.abgeschlossen": "Completed",
  "domain.auftragStatus.storniert": "Cancelled",

  // --- Rechnung status -------------------------------------------------------------
  "domain.rechnungStatus.entwurf": "Draft",
  "domain.rechnungStatus.versendet": "Sent",
  "domain.rechnungStatus.bezahlt": "Paid",
  "domain.rechnungStatus.ueberfaellig": "Overdue",

  // --- Quittung status -------------------------------------------------------------
  "domain.quittungStatus.draft": "Draft",
  "domain.quittungStatus.signed": "Signed",
  "domain.quittungStatus.sent": "Sent",
  "domain.quittungStatus.paid": "Paid",

  // --- Appointment status / type (enums) --------------------------------------------
  "domain.appointmentStatus.pending": "Pending",
  "domain.appointmentStatus.confirmed": "Confirmed",
  "domain.appointmentStatus.completed": "Completed",
  "domain.appointmentStatus.cancelled": "Cancelled",
  "domain.appointmentStatus.rescheduled": "Rescheduled",
  "domain.appointmentStatus.no_show": "No show",
  "domain.appointmentType.besichtigung": "Site visit",
  "domain.appointmentType.service": "Service",
  "domain.appointmentType.follow_up": "Follow-up",
  "domain.appointmentType.meeting": "Meeting",
  "domain.appointmentType.blocked": "Blocked",

  // --- Price models -------------------------------------------------------------------
  "domain.priceModel.pauschal": "Flat rate",
  "domain.priceModel.stundenansatz": "Hourly rate",
  "domain.priceModel.kostendach": "Cost ceiling",
  "domain.priceModel.onRequest": "on request",
  "domain.priceModel.included": "included in the price",
  "domain.priceModel.byEffort": "by time and effort",

  // --- Units ---------------------------------------------------------------------------
  "domain.unit.hour": "hrs",
  "domain.unit.hour.long": "Hour",
  "domain.unit.hour.plural": "Hours",
  "domain.unit.day": "Day",
  "domain.unit.day.plural": "Days",
  "domain.unit.month": "Month",
  "domain.unit.person": "Person",
  "domain.unit.person.plural": "People",
  "domain.unit.piece": "Piece",
  "domain.unit.flatRate": "Flat rate",
  "domain.unit.perHour": "per hour",
  "domain.unit.perM3": "per m³",
  "domain.unit.perM2": "per m²",
  "domain.unit.perMonth": "per month",
  "domain.unit.perUnit": "per {unit}",

  // --- Yes / No --------------------------------------------------------------------------
  "domain.yes": "Yes",
  "domain.no": "No",

  // --- Salutations -----------------------------------------------------------------------
  // The salutation comes from the stored `customer_salutation` and falls back to
  // the neutral form — no gender guessing from the first name.
  "domain.salutation.herr": "Mr",
  "domain.salutation.frau": "Ms",
  "domain.salutation.letter.herr": "Dear Mr {lastName},",
  "domain.salutation.letter.frau": "Dear Ms {lastName},",
  "domain.salutation.letter.neutral": "Dear Sir or Madam,",
  "domain.salutation.email.herr": "Dear Mr {lastName}",
  "domain.salutation.email.frau": "Dear Ms {lastName}",
  "domain.salutation.email.neutral": "Dear Sir or Madam",
  "domain.salutation.greeting": "Dear {firstName} {lastName},",
  "domain.salutation.closing": "Kind regards",
};
