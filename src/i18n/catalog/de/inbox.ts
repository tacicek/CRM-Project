/**
 * Dashboard-Namensraum: inbox + kpi. BEDIENER-Oberflaeche, `useT()`.
 *
 * Der Posteingang zeigt Vorschautexte, keine Volltexte — die Datenbank
 * speichert bewusst keine (20260801100000). Was hier fehlt, fehlt mit Absicht.
 */
export const inbox = {
  "inbox.pageTitle": "Posteingang",
  "inbox.title": "Posteingang",
  "inbox.subtitle": "Was mit den Kunden besprochen wurde — ein- und ausgehend",
  "inbox.count": "{count} offen",

  "inbox.filter.offen": "Offen",
  "inbox.filter.unbeantwortet": "Unbeantwortet",
  "inbox.filter.erledigt": "Erledigt",
  "inbox.filter.alle": "Alle",

  "inbox.empty": "Nichts im Posteingang",
  "inbox.emptyHint":
    "Ein- und ausgehende E-Mails erscheinen hier, sobald sie einem Kunden zugeordnet sind.",

  "inbox.waiting": "Wartet seit {days} Tagen",
  "inbox.lastInbound": "Zuletzt vom Kunden",
  "inbox.lastOutbound": "Zuletzt von uns",
  "inbox.noPreview": "Kein Vorschautext",
  "inbox.previewDropped": "Vorschau nach 24 Monaten entfernt",
  "inbox.markDone": "Als erledigt",
  "inbox.reopen": "Wieder öffnen",
  "inbox.messages": "{count} Nachrichten",
  "inbox.hint":
    "Volltexte werden nicht gespeichert. Antworten aus dem CRM ist noch nicht eingerichtet — verwenden Sie Ihr Mailprogramm.",

  "kpi.pageTitle": "Kennzahlen",
  "kpi.title": "Kennzahlen",
  "kpi.subtitle": "Kundenlebenszyklus, mit Zähler und Nenner",
  "kpi.range.90": "90 Tage",
  "kpi.range.365": "12 Monate",
  "kpi.range.all": "Seit Anfang",

  "kpi.section.funnel": "Trichter",
  "kpi.funnel.leads": "Anfragen",
  "kpi.funnel.withOffer": "davon mit Offerte",
  "kpi.funnel.sent": "Offerten versendet",
  "kpi.funnel.accepted": "davon angenommen",
  "kpi.funnel.note":
    "Gezählt wird die Offertenserie, nicht die einzelne Fassung — sonst senkt jede Überarbeitung die Quote.",

  "kpi.section.duration": "Dauer in Tagen",
  "kpi.duration.firstResponse": "Bis zur ersten Reaktion",
  "kpi.duration.toOffer": "Bis zur Offerte",
  "kpi.duration.viewToAccept": "Ansicht bis Annahme",
  "kpi.duration.toPayment": "Bis zur Tilgung",

  "kpi.section.customers": "Kunden",
  "kpi.customers.total": "Kunden",
  "kpi.customers.ltvAvg": "Durchschnittswert",
  "kpi.customers.ltvSum": "Gesamt kassiert",
  "kpi.customers.repeat": "Wiederkehrend",
  "kpi.customers.crossSell": "Cross-Sell",

  "kpi.section.money": "Geld",
  "kpi.money.received": "Kassiert im Zeitraum",
  "kpi.money.open": "Offene Forderung",
  "kpi.money.credits": "Gutschriften",

  "kpi.section.quality": "Qualität",
  "kpi.quality.completed": "Abgeschlossene Aufträge",
  "kpi.quality.cases": "Fälle",
  "kpi.quality.damages": "Schäden",
  "kpi.quality.complaints": "Reklamationen",

  "kpi.section.lost": "Verlustgründe",
  "kpi.lost.none": "Kein Verlust im Zeitraum",
  "kpi.lost.ohne_angabe": "Ohne Angabe",
  "kpi.lost.price": "Preis",
  "kpi.lost.timing": "Termin",
  "kpi.lost.no_response": "Keine Rückmeldung",
  "kpi.lost.competitor": "Mitbewerber",
  "kpi.lost.cancelled": "Abgesagt",
  "kpi.lost.other": "Anderes",

  "kpi.section.inbox": "Posteingang",
  "kpi.inbox.open": "Offene Fäden",
  "kpi.inbox.unanswered": "Unbeantwortet",
  "kpi.inbox.oldest": "Ältester unbeantwortet (Tage)",

  "kpi.notMeasured": "Nicht gemessen",
  "kpi.notMeasured.hint":
    "Attach Rate und Weiterempfehlung fehlen bewusst: der Leistungskatalog ordnet seine Positionen keiner Kategorie zu, und es gibt keinen Vorgang, der eine Bewertungsanfrage verschickt. Eine Quote ohne Nenner wäre schlechter als keine.",
} as const;
