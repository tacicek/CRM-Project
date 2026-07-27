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

  // --- Kundenkarte -----------------------------------------------------------
  "kunde.detail.back": "Zurück zu den Kunden",
  "kunde.detail.notFound": "Kunde nicht gefunden",
  "kunde.tab.overview": "Übersicht",
  "kunde.tab.history": "Verlauf",

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
  "kunde.finance.receipts": "Quittungen",
  // Erklaert, warum zwei Betraege nebeneinander stehen und nicht addiert werden.
  "kunde.finance.hint":
    "Quittungen werden separat ausgewiesen und nicht zum bezahlten Betrag addiert — sonst zählt derselbe Umsatz doppelt.",

  "kunde.activity.first": "Erster Kontakt",
  "kunde.activity.last": "Letzte Aktion",
  "kunde.activity.next": "Nächster Termin",

  "kunde.save": "Änderungen speichern",
  "kunde.saved": "Kunde gespeichert",

  // --- Verlauf ---------------------------------------------------------------
  "kunde.history.empty": "Noch keine Ereignisse",
  "kunde.history.more": "Mehr laden",
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
  "kunde.merge.forbidden": "Zusammenführen ist Eigentümer und Administratoren vorbehalten.",
  "kunde.merge.done": "Kunden zusammengeführt",

  // --- Fehler ----------------------------------------------------------------
  "kunde.error.load": "Kunden konnten nicht geladen werden",
  "kunde.error.save": "Kunde konnte nicht gespeichert werden",
  "kunde.error.forbidden": "Dafür fehlt die Berechtigung.",

  // --- Navigation ------------------------------------------------------------
  "kunde.link.open": "Kundenkarte",
} as const;
