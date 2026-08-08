/**
 * Dashboard-Namensraum: kunde. Deutsch ist die Quelle des Schluesselsatzes.
 *
 * Deckt die Kundenliste, die Kundenkarte und den Zusammenfuehren-Dialog ab.
 *
 * Diese Schluessel sind BEDIENER-Oberflaeche und werden mit `useT()` aufgeloest.
 * Sie sind NICHT die Sprache des Kunden: ein Kunde traegt `customers.language`
 * (die Sprache, in der er geschrieben hat) als erfassten WERT, der nie durch
 * diesen Katalog laeuft.
 */
export const kunde = {
  // --- Liste -----------------------------------------------------------------
  "kunde.pageTitle": "Kunden · CRM",
  "kunde.title": "Kunden",
  "kunde.count": "{count} Kunden",
  "kunde.count#one": "{count} Kunde",
  "kunde.count#other": "{count} Kunden",
  "kunde.new": "Neuer Kunde",
  "kunde.search.placeholder": "Name, E-Mail oder Telefon…",
  "kunde.search.clear": "Suche zurücksetzen",

  "kunde.filter.alle": "Alle",
  "kunde.filter.person": "Personen",
  "kunde.filter.firma": "Firmen",
  "kunde.filter.duplikate": "Duplikat-Verdacht",

  "kunde.kpi.total": "Kunden",
  "kunde.kpi.neu": "Neu (30 T.)",
  "kunde.kpi.duplikate": "Duplikat-Verdacht",
  "kunde.kpi.inaktiv": "Inaktiv (90 T.)",

  "kunde.empty.none": "Noch keine Kunden",
  "kunde.empty.noneHint": "Kunden entstehen automatisch aus Anfragen, Offerten und Belegen.",
  "kunde.empty.noMatch": "Keine Treffer",

  "kunde.card.noActivity": "Noch keine Aktivität",
  "kunde.card.openOffers": "{count} offene Offerten",
  "kunde.card.openOffers#one": "{count} offene Offerte",
  "kunde.card.openOffers#other": "{count} offene Offerten",
  "kunde.card.auftraege": "{count} Aufträge",
  "kunde.card.auftraege#one": "{count} Auftrag",
  "kunde.card.auftraege#other": "{count} Aufträge",
  "kunde.card.openAmount": "offen",
  "kunde.badge.firma": "Firma",
  "kunde.badge.duplicate": "Duplikat-Verdacht",

  // Woher der Ort in der Liste stammt. Die Auszugsadresse der letzten Anfrage
  // ist beim Umzug genau die Adresse, an der jemand NICHT mehr wohnt — sie darf
  // deshalb nicht unbeschriftet neben dem Namen stehen.
  "kunde.list.ortSource.adresse": "Adresse",
  "kunde.list.ortSource.einsatzort": "Letzter Einsatzort",
  "kunde.kpi.blockiert": "Gesperrt",

  // --- Kundenkarte -----------------------------------------------------------
  "kunde.detail.back": "Zurück zu den Kunden",
  "kunde.detail.notFound": "Kunde nicht gefunden",
  "kunde.detail.notFoundHint": "Der Verweis zeigt auf keinen Kunden dieser Firma.",
  "kunde.tab.overview": "Übersicht",
  "kunde.tab.history": "Verlauf",
  "kunde.tab.documents": "Vorgänge",
  "kunde.tab.finance": "Finanzen",
  "kunde.tab.locations": "Orte",

  // --- Kopfzeile und Schnellaktionen -----------------------------------------
  "kunde.action.edit": "Bearbeiten",
  "kunde.action.call": "Anrufen",
  "kunde.action.mail": "E-Mail schreiben",
  "kunde.action.copyAddress": "Adresse kopieren",
  "kunde.action.openMap": "Auf der Karte öffnen",
  "kunde.action.newOffer": "Offerte aus letzter Anfrage",
  "kunde.action.copied": "In die Zwischenablage kopiert",
  "kunde.action.copyFailed": "Kopieren nicht möglich",
  "kunde.action.more": "Weitere Aktionen",

  "kunde.status.active": "Aktiv",
  "kunde.status.inactive": "Inaktiv",
  "kunde.status.blocked": "Gesperrt",
  "kunde.status.anonymized": "Anonymisiert",
  "kunde.type.person": "Person",
  "kunde.type.company": "Firma",

  // --- Achtungsstreifen ------------------------------------------------------
  "kunde.attention.nextTask": "Nächste Aufgabe",
  "kunde.attention.nextAppointment": "Nächster Termin",
  "kunde.attention.openBalance": "Offener Betrag",
  "kunde.attention.overdue": "überfällig",
  "kunde.attention.openCases": "Offene Fälle",
  "kunde.attention.openOffers": "Offene Offerten",
  "kunde.attention.openAuftraege": "Laufende Aufträge",
  "kunde.attention.changeRequests": "Änderungswünsche",
  "kunde.attention.none": "Nichts Offenes.",
  "kunde.attention.due": "fällig",
  "kunde.attention.noDate": "ohne Frist",

  "kunde.section.contact": "Kontakt",
  "kunde.section.numbers": "Vorgänge",
  "kunde.section.finance": "Finanzen",
  "kunde.section.activity": "Aktivität",

  "kunde.field.email": "E-Mail",
  "kunde.field.phone": "Telefon",
  "kunde.field.language": "Sprache",
  "kunde.field.customerNumber": "Kundennummer",
  "kunde.field.source": "Herkunft",
  "kunde.field.notes": "Notizen",
  "kunde.field.notesPlaceholder": "Interne Notiz zu diesem Kunden…",
  "kunde.field.none": "—",
  "kunde.field.status": "Status",
  "kunde.field.type": "Art",
  "kunde.field.salutation": "Anrede",
  "kunde.field.firstName": "Vorname",
  "kunde.field.lastName": "Nachname",
  "kunde.field.companyName": "Firmenname",
  "kunde.field.displayName": "Anzeigename",

  // --- Leerzustände mit Aktion statt „—" -------------------------------------
  "kunde.empty.addPhone": "Telefon hinzufügen",
  "kunde.empty.addEmail": "E-Mail hinzufügen",
  "kunde.empty.addAddress": "Adresse hinzufügen",
  "kunde.empty.addLocation": "Einsatzort hinzufügen",
  "kunde.empty.noAddress": "Keine Anschrift erfasst",
  // Sagt ausdrücklich, warum hier nichts steht: die Auszugsadresse einer
  // Anfrage wird NICHT als Wohnadresse übernommen.
  "kunde.empty.noAddressHint":
    "Adressen aus Anfragen sind Einsatzorte, keine Anschrift — deshalb wird hier nichts übernommen.",
  "kunde.empty.noLocations": "Noch keine Einsatzorte",
  "kunde.empty.noLocationsHint":
    "Einsatzorte entstehen aus Aufträgen. Stockwerk, Lift und Zugang lassen sich hier ergänzen.",
  "kunde.empty.noDocuments": "Noch keine Vorgänge",

  // --- Bearbeiten ------------------------------------------------------------
  "kunde.edit.title": "Kunde bearbeiten",
  "kunde.edit.description":
    "Der aktuelle Stand des Kunden. Bereits erstellte Offerten, Aufträge und Rechnungen bleiben unverändert.",
  "kunde.edit.cancel": "Abbrechen",
  "kunde.edit.save": "Speichern",
  "kunde.edit.saving": "Wird gespeichert…",
  "kunde.edit.discardTitle": "Änderungen verwerfen?",
  "kunde.edit.discardHint": "Die Eingaben in diesem Formular gehen verloren.",
  "kunde.edit.discardConfirm": "Verwerfen",
  "kunde.edit.discardCancel": "Weiter bearbeiten",
  "kunde.edit.invalidEmail": "Diese E-Mail-Adresse ist nicht gültig.",
  "kunde.edit.invalidPhone": "Diese Telefonnummer ist nicht gültig.",
  "kunde.edit.identityRequired": "Mindestens E-Mail oder Telefon muss ausgefüllt sein.",
  "kunde.edit.nameRequired": "Ein Name ist nötig: Vor-/Nachname, Firmenname oder Anzeigename.",
  // Erklärt die zwei Zustände des Anzeigenamens. Ohne diesen Hinweis bleibt ein
  // einmal getippter Anzeigename für immer stehen, auch wenn der Name wechselt.
  "kunde.edit.displayNameFollows": "Folgt dem Namen: {name}",
  "kunde.edit.displayNameOwn": "Eigener Anzeigename",
  "kunde.edit.displayNameOwnHint":
    "Bleibt bestehen, auch wenn sich Vor-, Nach- oder Firmenname ändert.",

  "kunde.count.anfragen": "Anfragen",
  "kunde.count.offerten": "Offerten",
  "kunde.count.auftraege": "Aufträge",
  "kunde.count.termine": "Termine",
  "kunde.count.rechnungen": "Rechnungen",
  "kunde.count.quittungen": "Quittungen",
  "kunde.count.emails": "E-Mails",

  "kunde.finance.invoiced": "Fakturiert",
  "kunde.finance.paid": "Bezahlt",
  "kunde.finance.open": "Offen",
  "kunde.finance.receipts": "Davon Quittungen",
  "kunde.finance.credits": "Gutschriften",
  // Erklaert, dass 'Davon Quittungen' ein Ausschnitt aus 'Bezahlt' ist und
  // kein zweiter Topf. Vor dem Zahlungsbuch waren es zwei getrennte Summen.
  "kunde.finance.hint":
    "Bezahlt ist die Summe der erfassten Zahlungseingänge — Rechnung und Quittung zählen darin je einmal. „Davon Quittungen“ ist ein Anteil davon, kein zweiter Betrag.",

  "kunde.finance.overdue": "Davon überfällig",
  "kunde.finance.toInvoices": "Zu den Rechnungen",
  "kunde.finance.toPayments": "Zum Zahlungsbuch",

  "kunde.activity.first": "Erster Kontakt",
  "kunde.activity.last": "Letzte Aktion",
  "kunde.activity.next": "Nächster Termin",
  "kunde.activity.nextTask": "Nächste Aufgabe",
  "kunde.activity.never": "Noch nichts geschehen",
  "kunde.activity.toTasks": "Zu den Aufgaben",
  "kunde.activity.toCalendar": "Zum Kalender",

  // --- Adressen --------------------------------------------------------------
  "kunde.address.section": "Anschrift",
  "kunde.address.correspondence": "Korrespondenzadresse",
  "kunde.address.billing": "Rechnungsadresse",
  "kunde.address.billingSame": "Rechnungen gehen an die Korrespondenzadresse.",
  "kunde.address.further": "Weitere Adressen",
  "kunde.address.add": "Adresse hinzufügen",
  "kunde.address.addTitle": "Adresse hinzufügen",
  "kunde.address.editTitle": "Adresse bearbeiten",
  "kunde.address.delete": "Entfernen",
  "kunde.address.deleteTitle": "Adresse entfernen?",
  "kunde.address.deleteHint":
    "Belege, die diese Adresse tragen, bleiben unverändert — sie führen ihre eigene Kopie.",
  "kunde.address.primary": "Hauptadresse",
  "kunde.address.setPrimary": "Als Hauptadresse verwenden",
  "kunde.address.type": "Art",
  "kunde.address.label": "Bezeichnung",
  "kunde.address.labelPlaceholder": "z. B. Wohnung, Büro",
  "kunde.address.raw": "Adresse",
  "kunde.address.rawPlaceholder": "Strasse, Nummer, PLZ und Ort",
  "kunde.address.plz": "PLZ",
  "kunde.address.city": "Ort",
  "kunde.address.notes": "Bemerkung",
  "kunde.address.validTo": "Gültig bis",
  "kunde.address.saved": "Adresse gespeichert",
  "kunde.address.deleted": "Adresse entfernt",
  "kunde.address.required": "Ohne Adresstext lässt sich nichts speichern.",
  "kunde.address.hint":
    "Eine geänderte Anschrift verändert keine bestehende Offerte, keinen Auftrag und keine Rechnung.",

  // --- Einsatzorte -----------------------------------------------------------
  "kunde.location.section": "Einsatzorte",
  "kunde.location.add": "Einsatzort hinzufügen",
  "kunde.location.addTitle": "Einsatzort hinzufügen",
  "kunde.location.editTitle": "Einsatzort bearbeiten",
  "kunde.location.deleteTitle": "Einsatzort entfernen?",
  "kunde.location.deleteHint":
    "Aufträge und Termine, die darauf zeigen, verlieren nur den Ortsbezug — die Adresse steht weiterhin auf dem Vorgang.",
  "kunde.location.kind": "Rolle",
  "kunde.location.kind.from": "Auszug",
  "kunde.location.kind.to": "Einzug",
  "kunde.location.kind.object": "Objekt",
  "kunde.location.kind.storage": "Lager",
  "kunde.location.floor": "Stockwerk",
  "kunde.location.elevator": "Lift",
  "kunde.location.elevatorYes": "Lift vorhanden",
  "kunde.location.elevatorNo": "Kein Lift",
  "kunde.location.elevatorUnknown": "Lift unbekannt",
  "kunde.location.parking": "Parkieren",
  "kunde.location.access": "Zugang",
  "kunde.location.rooms": "Zimmer",
  "kunde.location.area": "Fläche in m²",
  "kunde.location.saved": "Einsatzort gespeichert",
  "kunde.location.deleted": "Einsatzort entfernt",

  // --- Vorgänge --------------------------------------------------------------
  "kunde.docs.offers": "Offerten",
  "kunde.docs.auftraege": "Aufträge",
  "kunde.docs.invoices": "Rechnungen",
  "kunde.docs.receipts": "Quittungen",
  "kunde.docs.appointments": "Termine",
  "kunde.docs.leads": "Anfragen",
  "kunde.docs.none": "Nichts vorhanden",
  "kunde.docs.noRoute": "Kein eigener Bildschirm",

  "kunde.save": "Änderungen speichern",
  "kunde.saved": "Kunde gespeichert",

  // --- Verlauf ---------------------------------------------------------------
  "kunde.history.empty": "Noch keine Ereignisse",
  "kunde.history.noMatch": "Keine Ereignisse in dieser Auswahl",
  "kunde.history.more": "Mehr laden",
  "kunde.history.filter.alle": "Alle",
  "kunde.history.filter.offerten": "Offerten",
  "kunde.history.filter.auftraege": "Aufträge",
  "kunde.history.filter.finanzen": "Finanzen",
  "kunde.history.filter.kontakt": "Kontakt",
  "kunde.event.anfrage": "Anfrage",
  "kunde.event.offerte": "Offerte",
  "kunde.event.auftrag": "Auftrag",
  "kunde.event.termin": "Termin",
  "kunde.event.rechnung": "Rechnung",
  "kunde.event.quittung": "Quittung",
  "kunde.event.email": "E-Mail",

  // --- Duplikate und Zusammenfuehren ----------------------------------------
  "kunde.duplicate.banner.title": "Möglicherweise dieselbe Person",
  "kunde.duplicate.banner.description":
    "{count} weitere Kunden teilen sich eine Telefonnummer mit diesem Kunden.",
  "kunde.duplicate.banner.description#one":
    "Ein weiterer Kunde teilt sich eine Telefonnummer mit diesem Kunden.",
  "kunde.duplicate.banner.description#other":
    "{count} weitere Kunden teilen sich eine Telefonnummer mit diesem Kunden.",
  "kunde.duplicate.banner.action": "Prüfen",
  "kunde.duplicate.reason.same_phone": "gleiche Telefonnummer",
  "kunde.duplicate.reason.same_phone_and_name": "gleiche Nummer und gleicher Nachname",

  "kunde.merged.banner.title": "Dieser Kunde wurde zusammengeführt",
  "kunde.merged.banner.action": "Zum aktuellen Kunden",

  "kunde.merge.title": "Kunden zusammenführen",
  "kunde.merge.target": "Bleibt bestehen",
  "kunde.merge.source": "Wird zusammengeführt",
  "kunde.merge.swap": "Richtung tauschen",
  "kunde.merge.moves": "Wird umgehängt",
  "kunde.merge.fills": "Das Ziel übernimmt",
  "kunde.merge.conflicts": "Bleibt beim Ziel, geht verloren",
  "kunde.merge.nothing": "nichts",
  "kunde.merge.irreversible": "Dieser Schritt kann nicht rückgängig gemacht werden.",
  "kunde.merge.confirmLabel": "Zum Bestätigen den Namen der Quelle eintippen:",
  "kunde.merge.submit": "Zusammenführen",
  "kunde.merge.combined": "Wird zusammengelegt",
  "kunde.merge.entity.payments": "Zahlungen",
  "kunde.merge.entity.tasks": "Aufgaben",
  "kunde.merge.entity.cases": "Fälle",
  "kunde.merge.entity.threads": "Gespräche",
  "kunde.merge.entity.amendments": "Nachträge",
  "kunde.merge.entity.portal": "Portalzugänge",
  "kunde.merge.entity.redirects": "Weiterleitungen",
  "kunde.merge.forbidden": "Zusammenführen ist Eigentümer und Administratoren vorbehalten.",
  "kunde.merge.done": "Kunden zusammengeführt",

  // --- Fehler ----------------------------------------------------------------
  //
  // Getrennt gehalten, weil sie verschiedene Antworten verlangen: ein leerer
  // Verlauf heisst „nichts passiert", ein fehlgeschlagener Verlauf heisst „wir
  // wissen es nicht". Beides gleich darzustellen war der Befund.
  "kunde.error.load": "Kunden konnten nicht geladen werden",
  "kunde.error.save": "Kunde konnte nicht gespeichert werden",
  "kunde.error.forbidden": "Dafür fehlt die Berechtigung.",
  "kunde.error.summary": "Kennzahlen konnten nicht geladen werden",
  "kunde.error.summaryHint":
    "Beträge und Zähler bleiben deshalb leer — sie stehen nicht auf null.",
  "kunde.error.timeline": "Der Verlauf konnte nicht geladen werden",
  "kunde.error.addresses": "Adressen konnten nicht geladen werden",
  "kunde.error.documents": "Vorgänge konnten nicht geladen werden",
  "kunde.error.retry": "Erneut versuchen",
  "kunde.error.noAccess": "Kein Zugriff auf diesen Kunden",
  "kunde.error.noAccessHint":
    "Der Kunde gehört zu einer anderen Firma, oder die Berechtigung fehlt.",
  "kunde.error.offline": "Keine Verbindung zum Server",
  // Nicht "fehlgeschlagen": die Abfrage hat geantwortet, nur älter als dieser
  // Bildschirm. Dagegen hilft kein zweiter Versuch, sondern ein Deploy.
  "kunde.error.schemaStale": "Diese Datenbank ist älter als der Bildschirm",
  "kunde.error.schemaStaleHint":
    "Der Kundenkarte fehlen Angaben, die es erst seit der Migration 20260807100000 gibt. Bis sie eingespielt ist, bleiben dieser Abschnitt und die Adressen leer — der übrige Teil der Karte arbeitet weiter.",

  // --- Navigation ------------------------------------------------------------
  "kunde.link.open": "Kundenkarte",
} as const;
