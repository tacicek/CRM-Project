export const finanz = {
  "finanz.pageTitle": "Finances",
  "finanz.title": "Finances",
  "finanz.subtitle": "What came in and what is still outstanding",

  "finanz.kpi.kassiert": "Received",
  "finanz.kpi.kassiert30": "Last 30 days",
  "finanz.kpi.offen": "Outstanding",
  "finanz.kpi.ueberfaellig": "Overdue",
  "finanz.kpi.entwurf": "In drafts",
  "finanz.kpi.gutschriften": "Credit notes",
  "finanz.kpi.nichtAbgeglichen": "Not reconciled",
  "finanz.kpi.rechnungen": "{count} invoices",

  "finanz.tab.offen": "Outstanding items",
  "finanz.tab.zahlungen": "Payments received",

  "finanz.offen.empty": "Nothing outstanding",
  "finanz.offen.emptyHint": "Every issued invoice has been settled.",
  "finanz.offen.faellig": "Due {date}",
  "finanz.offen.tageUeberfaellig": "{days} days overdue",
  "finanz.offen.teilbezahlt": "{paid} of {total} paid",
  "finanz.offen.mahnstufe": "Reminder {level}",
  "finanz.offen.zahlungErfassen": "Record payment",

  "finanz.zahlungen.empty": "No payment recorded yet",
  "finanz.zahlungen.emptyHint": "Record payments from the invoice or receipt itself.",
  "finanz.zahlungen.storno": "Reversal",
  "finanz.zahlungen.stornieren": "Reverse",
  "finanz.zahlungen.stornoFrage":
    "This payment is not deleted but cancelled by an opposite entry. Continue?",
  "finanz.zahlungen.storniert": "Payment reversed",
  "finanz.zahlungen.nichtZugeordnet": "{amount} unallocated",
  "finanz.zahlungen.abgeglichen": "Reconciled",
  "finanz.zahlungen.offenerAbgleich": "Reconciliation pending",

  "finanz.method.bank": "Bank transfer",
  "finanz.method.qr": "QR invoice",
  "finanz.method.cash": "Cash",
  "finanz.method.twint": "TWINT",
  "finanz.method.card": "Card",
  "finanz.method.other": "Other method",

  "finanz.dialog.title": "Record payment received",
  "finanz.dialog.forInvoice": "Invoice {nr}",
  "finanz.dialog.forQuittung": "Receipt {nr}",
  "finanz.dialog.amount": "Amount",
  "finanz.dialog.date": "Payment date",
  "finanz.dialog.method": "Payment method",
  "finanz.dialog.reference": "Reference",
  "finanz.dialog.referencePlaceholder": "QR reference, TWINT number, voucher number",
  "finanz.dialog.note": "Note",
  "finanz.dialog.openAmount": "Outstanding: {amount}",
  "finanz.dialog.submit": "Record",
  "finanz.dialog.saved": "Payment recorded",
  "finanz.dialog.overpay":
    "The amount exceeds what is outstanding. The remainder stays as an unallocated payment.",
  "finanz.dialog.doppelt":
    "Careful: a payment is already booked against an invoice for this job.",

  "finanz.rechnung.bezahlt": "Paid",
  "finanz.rechnung.offen": "Outstanding",
  "finanz.rechnung.gutgeschrieben": "Credited",
  "finanz.rechnung.keineZahlung":
    "The status follows the recorded payments — it cannot be set by hand.",
} as const;
