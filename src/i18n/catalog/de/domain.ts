/**
 * Domain vocabulary: service types, statuses, units, price models.
 *
 * The highest-leverage namespace in the catalog — these keys feed the dashboard,
 * the PDFs and the public offer page alike. Before i18n the same German label was
 * re-declared in a dozen local `const statusLabels = {…}` maps; those all collapse
 * onto these keys.
 */
export const domain = {
  // --- Service types (offers, leads, auftraege) ---------------------------------
  "domain.service.umzug": "Umzug",
  "domain.service.umzug_privat": "Privatumzug",
  "domain.service.umzug_firma": "Firmenumzug",
  "domain.service.umzug_buero": "Büroumzug",
  "domain.service.umzug_international": "Internationaler Umzug",
  "domain.service.transport": "Transport",
  "domain.service.klaviertransport": "Klaviertransport",
  "domain.service.moebellift": "Möbellift",
  "domain.service.reinigung": "Reinigung",
  "domain.service.raeumung": "Räumung",
  "domain.service.entsorgung": "Entsorgung",
  "domain.service.lagerung": "Lagerung",
  "domain.service.malerarbeit": "Malerarbeit",
  "domain.service.renovation": "Renovation",
  "domain.service.allgemein": "Allgemein",

  // --- Appointment label per service (\"Umzugstermin\", \"Reinigungstermin\", …) ----
  "domain.appointment.umzug": "Umzugstermin",
  "domain.appointment.reinigung": "Reinigungstermin",
  "domain.appointment.raeumung": "Räumungstermin",
  "domain.appointment.entsorgung": "Entsorgungstermin",
  "domain.appointment.lagerung": "Lagerungstermin",
  "domain.appointment.transport": "Transporttermin",
  "domain.appointment.klaviertransport": "Transporttermin",
  "domain.appointment.moebellift": "Einsatztermin",
  "domain.appointment.default": "Ausführungstermin",

  // --- Address card headers per service ----------------------------------------
  "domain.address.umzug.primary": "Auszugsadresse",
  "domain.address.umzug.secondary": "Einzugsadresse",
  "domain.address.reinigung.primary": "Reinigungsadresse",
  "domain.address.raeumung.primary": "Räumungsadresse",
  "domain.address.entsorgung.primary": "Abholadresse",
  "domain.address.entsorgung.secondary": "Entsorgungsadresse",
  "domain.address.lagerung.primary": "Abholadresse",
  "domain.address.lagerung.secondary": "Lageradresse",
  "domain.address.klaviertransport.primary": "Abholadresse",
  "domain.address.klaviertransport.secondary": "Zieladresse",
  "domain.address.moebellift.primary": "Einsatzadresse",
  "domain.address.default.primary": "Einsatzadresse",
  "domain.address.default.secondary": "Zusätzliche Adresse",

  // --- Offer status --------------------------------------------------------------
  "domain.offerStatus.draft": "Entwurf",
  "domain.offerStatus.sent": "Gesendet",
  "domain.offerStatus.viewed": "Angesehen",
  "domain.offerStatus.accepted": "Angenommen",
  "domain.offerStatus.rejected": "Abgelehnt",

  // --- Auftrag status (enum auftrag_status) ---------------------------------------
  "domain.auftragStatus.geplant": "Geplant",
  "domain.auftragStatus.bestaetigt": "Bestätigt",
  "domain.auftragStatus.in_bearbeitung": "In Bearbeitung",
  "domain.auftragStatus.abgeschlossen": "Abgeschlossen",
  "domain.auftragStatus.storniert": "Storniert",

  // --- Rechnung status -------------------------------------------------------------
  "domain.rechnungStatus.entwurf": "Entwurf",
  "domain.rechnungStatus.versendet": "Versendet",
  "domain.rechnungStatus.bezahlt": "Bezahlt",
  "domain.rechnungStatus.ueberfaellig": "Überfällig",

  // --- Quittung status -------------------------------------------------------------
  "domain.quittungStatus.draft": "Entwurf",
  "domain.quittungStatus.signed": "Unterschrieben",
  "domain.quittungStatus.sent": "Gesendet",
  "domain.quittungStatus.paid": "Bezahlt",

  // --- Appointment status / type (enums) --------------------------------------------
  "domain.appointmentStatus.pending": "Ausstehend",
  "domain.appointmentStatus.confirmed": "Bestätigt",
  "domain.appointmentStatus.completed": "Abgeschlossen",
  "domain.appointmentStatus.cancelled": "Abgesagt",
  "domain.appointmentStatus.rescheduled": "Verschoben",
  "domain.appointmentStatus.no_show": "Nicht erschienen",
  "domain.appointmentType.besichtigung": "Besichtigung",
  "domain.appointmentType.service": "Dienstleistung",
  "domain.appointmentType.follow_up": "Nachfassen",
  "domain.appointmentType.meeting": "Besprechung",
  "domain.appointmentType.blocked": "Blockiert",

  // --- Price models -------------------------------------------------------------------
  "domain.priceModel.pauschal": "Pauschal",
  "domain.priceModel.stundenansatz": "Stundenansatz",
  "domain.priceModel.kostendach": "Kostendach",
  "domain.priceModel.onRequest": "auf Anfrage",
  "domain.priceModel.included": "im Preis inbegriffen",
  "domain.priceModel.byEffort": "nach Aufwand",

  // --- Units ---------------------------------------------------------------------------
  "domain.unit.hour": "Std.",
  "domain.unit.hour.long": "Stunde",
  "domain.unit.hour.plural": "Stunden",
  "domain.unit.day": "Tag",
  "domain.unit.day.plural": "Tage",
  "domain.unit.month": "Monat",
  "domain.unit.person": "Person",
  "domain.unit.person.plural": "Personen",
  "domain.unit.piece": "Stück",
  "domain.unit.flatRate": "Pauschale",
  "domain.unit.perHour": "pro Stunde",
  "domain.unit.perM3": "pro m³",
  "domain.unit.perM2": "pro m²",
  "domain.unit.perMonth": "pro Monat",
  "domain.unit.perUnit": "pro {unit}",

  // --- Yes / No --------------------------------------------------------------------------
  "domain.yes": "Ja",
  "domain.no": "Nein",

  // --- Salutations -----------------------------------------------------------------------
  // The German original guessed gender from the first name; that heuristic is unreliable
  // and untranslatable. The salutation now comes from the stored `customer_salutation`
  // and falls back to the neutral form.
  "domain.salutation.herr": "Herr",
  "domain.salutation.frau": "Frau",
  "domain.salutation.letter.herr": "Sehr geehrter Herr {lastName},",
  "domain.salutation.letter.frau": "Sehr geehrte Frau {lastName},",
  "domain.salutation.letter.neutral": "Sehr geehrte Damen und Herren,",
  "domain.salutation.email.herr": "Sehr geehrter Herr {lastName}",
  "domain.salutation.email.frau": "Sehr geehrte Frau {lastName}",
  "domain.salutation.email.neutral": "Sehr geehrte Damen und Herren",
  "domain.salutation.greeting": "Guten Tag {firstName} {lastName},",
  "domain.salutation.closing": "Freundliche Grüsse",
} as const;
