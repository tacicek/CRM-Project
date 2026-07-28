/**
 * Dashboard-Namensraum: finanz. Deutsch ist die Quelle des Schluesselsatzes.
 *
 * Deckt die Finanzuebersicht, das Erfassen von Zahlungseingaengen und die
 * offenen Posten ab.
 *
 * BEDIENER-Oberflaeche, aufgeloest mit `useT()`. Was an den KUNDEN geht —
 * Gutschrift, Mahnung — traegt seine eigene Sprache auf der Zeile und laeuft
 * NICHT durch diesen Katalog.
 */
export const finanz = {
  "finanz.pageTitle": "Finanzen",
  "finanz.title": "Finanzen",
  "finanz.subtitle": "Was hereingekommen ist und was noch offen steht",

  // --- Kennzahlen ------------------------------------------------------------
  "finanz.kpi.kassiert": "Kassiert",
  "finanz.kpi.kassiert30": "Letzte 30 Tage",
  "finanz.kpi.offen": "Offen",
  "finanz.kpi.ueberfaellig": "Überfällig",
  "finanz.kpi.entwurf": "In Entwürfen",
  "finanz.kpi.gutschriften": "Gutschriften",
  "finanz.kpi.nichtAbgeglichen": "Nicht abgeglichen",
  "finanz.kpi.rechnungen": "{count} Rechnungen",

  // --- Reiter ----------------------------------------------------------------
  "finanz.tab.offen": "Offene Posten",
  "finanz.tab.zahlungen": "Zahlungseingänge",

  // --- Offene Posten ---------------------------------------------------------
  "finanz.offen.empty": "Nichts offen",
  "finanz.offen.emptyHint": "Alle gestellten Rechnungen sind beglichen.",
  "finanz.offen.faellig": "Fällig {date}",
  "finanz.offen.tageUeberfaellig": "{days} Tage überfällig",
  "finanz.offen.teilbezahlt": "{paid} von {total} bezahlt",
  "finanz.offen.mahnstufe": "Mahnstufe {level}",
  "finanz.offen.zahlungErfassen": "Zahlung erfassen",

  // --- Zahlungseingänge ------------------------------------------------------
  "finanz.zahlungen.empty": "Noch kein Zahlungseingang erfasst",
  "finanz.zahlungen.emptyHint":
    "Erfassen Sie Eingänge bei der jeweiligen Rechnung oder Quittung.",
  "finanz.zahlungen.storno": "Storno",
  "finanz.zahlungen.stornieren": "Stornieren",
  "finanz.zahlungen.stornoFrage":
    "Diese Zahlung wird nicht gelöscht, sondern durch eine Gegenbuchung aufgehoben. Fortfahren?",
  "finanz.zahlungen.storniert": "Zahlung storniert",
  "finanz.zahlungen.nichtZugeordnet": "{amount} nicht zugeordnet",
  "finanz.zahlungen.abgeglichen": "Abgeglichen",
  "finanz.zahlungen.offenerAbgleich": "Abgleich offen",

  // --- Zahlungsweg -----------------------------------------------------------
  "finanz.method.bank": "Banküberweisung",
  "finanz.method.qr": "QR-Rechnung",
  "finanz.method.cash": "Bar",
  "finanz.method.twint": "TWINT",
  "finanz.method.card": "Karte",
  "finanz.method.other": "Anderer Weg",

  // --- Dialog ----------------------------------------------------------------
  "finanz.dialog.title": "Zahlungseingang erfassen",
  "finanz.dialog.forInvoice": "Rechnung {nr}",
  "finanz.dialog.forQuittung": "Quittung {nr}",
  "finanz.dialog.amount": "Betrag",
  "finanz.dialog.date": "Zahlungsdatum",
  "finanz.dialog.method": "Zahlungsweg",
  "finanz.dialog.reference": "Referenz",
  "finanz.dialog.referencePlaceholder": "QR-Referenz, TWINT-Nummer, Belegnummer",
  "finanz.dialog.note": "Bemerkung",
  "finanz.dialog.openAmount": "Offen: {amount}",
  "finanz.dialog.submit": "Erfassen",
  "finanz.dialog.saved": "Zahlungseingang erfasst",
  "finanz.dialog.overpay":
    "Der Betrag ist höher als der offene Posten. Der Rest bleibt als nicht zugeordneter Eingang stehen.",
  "finanz.dialog.doppelt":
    "Achtung: Zu diesem Vorgang ist bereits eine Zahlung auf eine Rechnung gebucht.",

  // --- Rechnungsansicht ------------------------------------------------------
  "finanz.rechnung.bezahlt": "Bezahlt",
  "finanz.rechnung.offen": "Offen",
  "finanz.rechnung.gutgeschrieben": "Gutgeschrieben",
  "finanz.rechnung.keineZahlung":
    "Der Status folgt den erfassten Zahlungen — er lässt sich nicht von Hand setzen.",
} as const;
