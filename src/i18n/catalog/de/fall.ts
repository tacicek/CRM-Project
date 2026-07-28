/**
 * Dashboard-Namensraum: fall. Deutsch ist die Quelle des Schluesselsatzes.
 *
 * Schaden, Reklamation, Nachreinigung, Serviceaenderung — eine Akte mit
 * Typfeld, nicht vier. BEDIENER-Oberflaeche, aufgeloest mit `useT()`.
 * Was der Kunde im Portal davon sieht, traegt seine eigene Sprache.
 */
export const fall = {
  "fall.pageTitle": "Fälle",
  "fall.title": "Fälle",
  "fall.subtitle": "Schäden, Reklamationen, Nachreinigungen, Serviceänderungen",
  "fall.count": "{count} offen",

  "fall.filter.offen": "Offen",
  "fall.filter.meine": "Meine",
  "fall.filter.geschlossen": "Geschlossen",
  "fall.filter.alle": "Alle",

  "fall.type.damage": "Schaden",
  "fall.type.complaint": "Reklamation",
  "fall.type.recleaning": "Nachreinigung",
  "fall.type.service_change": "Serviceänderung",

  "fall.status.offen": "Offen",
  "fall.status.in_arbeit": "In Arbeit",
  "fall.status.wartet_auf_kunde": "Wartet auf Kunde",
  "fall.status.geloest": "Gelöst",
  "fall.status.abgelehnt": "Abgelehnt",

  "fall.resolution.repariert": "Repariert",
  "fall.resolution.ersetzt": "Ersetzt",
  "fall.resolution.gutschrift": "Gutschrift",
  "fall.resolution.nachgeholt": "Nachgeholt",
  "fall.resolution.kulanz": "Kulanz",
  "fall.resolution.abgelehnt": "Abgelehnt",
  "fall.resolution.sonstiges": "Sonstiges",

  "fall.reportedBy.kunde": "Vom Kunden gemeldet",
  "fall.reportedBy.firma": "Intern erfasst",

  "fall.empty": "Kein Fall offen",
  "fall.emptyHint": "Schäden und Reklamationen erscheinen hier, sobald sie erfasst sind.",

  "fall.new": "Fall erfassen",
  "fall.new.title": "Neuen Fall erfassen",
  "fall.new.type": "Art",
  "fall.new.titleField": "Kurzbeschreibung",
  "fall.new.description": "Was ist passiert",
  "fall.new.priority": "Priorität",
  "fall.new.auftrag": "Auftrag",
  "fall.new.noAuftrag": "Ohne Auftragsbezug",
  "fall.new.submit": "Erfassen",
  "fall.new.saved": "Fall erfasst",

  "fall.close": "Abschliessen",
  "fall.close.title": "Fall abschliessen",
  "fall.close.result": "Ergebnis",
  "fall.close.note": "Wie wurde es gelöst",
  "fall.close.hint":
    "Ein Abschluss ohne Ergebnis ist später nicht mehr nachvollziehbar — die Datenbank lehnt ihn ab.",
  "fall.close.submit": "Abschliessen",
  "fall.closed": "Fall abgeschlossen",

  "fall.priority.low": "Niedrig",
  "fall.priority.normal": "Normal",
  "fall.priority.high": "Hoch",
  "fall.priority.urgent": "Dringend",

  "fall.takeOver": "In Arbeit nehmen",
} as const;
