/**
 * Namensraum: portal.
 *
 * ⚠️ ZWEI ADRESSATEN IN EINER DATEI — und sie werden VERSCHIEDEN aufgeloest:
 *
 *   portal.*        spricht den KUNDEN an.    -> documentI18nFor(kunde.sprache)
 *   portal.admin.*  spricht den BEDIENER an.  -> useT()
 *
 * Beide Schluesselsaetze stehen im selben Katalog, weil der Katalog EINER ist;
 * unterschiedlich ist nur, WER die Sprache bestimmt. Ein `useT()` auf einem
 * portal.*-Schluessel wuerde dem franzoesischen Kunden die Sprache des Bueros
 * zeigen — siehe src/i18n/README.md.
 */
export const portal = {
  // --- Kundenseite -----------------------------------------------------------
  "portal.title": "Ihr Kundenbereich",
  "portal.greeting": "Guten Tag {name}",
  "portal.loading": "Wird geladen …",
  "portal.invalid": "Dieser Zugang ist ungültig oder abgelaufen.",
  "portal.invalidHint": "Bitte fordern Sie einen neuen Link an.",
  "portal.openAmount": "Offener Betrag",
  "portal.nothingOpen": "Nichts offen",

  "portal.section.offers": "Offerten",
  "portal.section.amendments": "Nachträge",
  "portal.section.appointments": "Termine",
  "portal.section.orders": "Aufträge",
  "portal.section.invoices": "Rechnungen",
  "portal.section.payments": "Zahlungen",
  "portal.section.data": "Ihre Angaben",

  "portal.empty.offers": "Keine Offerten",
  "portal.empty.amendments": "Keine Nachträge",
  "portal.empty.appointments": "Keine Termine",
  "portal.empty.orders": "Keine Aufträge",
  "portal.empty.invoices": "Keine Rechnungen",
  "portal.empty.payments": "Noch keine Zahlung verbucht",

  "portal.offer.open": "Ansehen",
  "portal.offer.superseded": "Durch eine neuere Fassung ersetzt",
  "portal.offer.validUntil": "Gültig bis {date}",
  "portal.invoice.due": "Fällig {date}",
  "portal.invoice.openOf": "{open} von {total} offen",
  "portal.invoice.paid": "Bezahlt",

  "portal.data.firstName": "Vorname",
  "portal.data.lastName": "Nachname",
  "portal.data.companyName": "Firma",
  "portal.data.email": "E-Mail",
  "portal.data.phone": "Telefon",
  "portal.data.change": "Ändern",
  "portal.data.newValue": "Neuer Wert",
  "portal.data.note": "Bemerkung (optional)",
  "portal.data.submit": "Änderung melden",
  "portal.data.submitted": "Danke — wir prüfen Ihre Angabe.",
  "portal.data.pending": "Ihre Änderung wird geprüft.",
  "portal.data.hint":
    "Ihre Angaben werden nicht sofort übernommen: wir prüfen sie zuerst.",

  "portal.payment.hint":
    "Zahlungen sind hier nur zur Ansicht. Bitte überweisen Sie wie auf der Rechnung angegeben.",

  // --- Bedienerseite ---------------------------------------------------------
  "portal.admin.title": "Portalzugang",
  "portal.admin.create": "Zugang erstellen",
  "portal.admin.revoke": "Zugang widerrufen",
  "portal.admin.revoked": "Zugang widerrufen ({count} Sitzungen beendet)",
  "portal.admin.linkReady": "Link erstellt — gültig bis {date}",
  "portal.admin.copy": "Link kopieren",
  "portal.admin.copied": "Link kopiert",
  "portal.admin.onceOnly":
    "Dieser Link wird nur jetzt angezeigt. Er ist einmalig gültig und wird beim ersten Öffnen verbraucht.",
  "portal.admin.sendHint":
    "Schicken Sie den Link dem Kunden über Ihren üblichen Weg.",
  "portal.admin.active": "Aktiver Zugang seit {date}",
  "portal.admin.none": "Kein Portalzugang vergeben",
  "portal.admin.requests": "Offene Änderungswünsche",
  "portal.admin.accept": "Übernehmen",
  "portal.admin.reject": "Ablehnen",
  "portal.admin.decided": "Entschieden",
} as const;
