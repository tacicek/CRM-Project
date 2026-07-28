export const finanz = {
  "finanz.pageTitle": "Finances",
  "finanz.title": "Finances",
  "finanz.subtitle": "Ce qui est encaissé et ce qui reste dû",

  "finanz.kpi.kassiert": "Encaissé",
  "finanz.kpi.kassiert30": "30 derniers jours",
  "finanz.kpi.offen": "En souffrance",
  "finanz.kpi.ueberfaellig": "En retard",
  "finanz.kpi.entwurf": "En brouillon",
  "finanz.kpi.gutschriften": "Notes de crédit",
  "finanz.kpi.nichtAbgeglichen": "Non rapproché",
  "finanz.kpi.rechnungen": "{count} factures",

  "finanz.tab.offen": "Postes ouverts",
  "finanz.tab.zahlungen": "Encaissements",

  "finanz.offen.empty": "Rien en souffrance",
  "finanz.offen.emptyHint": "Toutes les factures émises sont réglées.",
  "finanz.offen.faellig": "Échéance {date}",
  "finanz.offen.tageUeberfaellig": "{days} jours de retard",
  "finanz.offen.teilbezahlt": "{paid} sur {total} payés",
  "finanz.offen.mahnstufe": "Rappel {level}",
  "finanz.offen.zahlungErfassen": "Saisir un paiement",

  "finanz.zahlungen.empty": "Aucun encaissement saisi",
  "finanz.zahlungen.emptyHint":
    "Saisissez les encaissements depuis la facture ou la quittance concernée.",
  "finanz.zahlungen.storno": "Extourne",
  "finanz.zahlungen.stornieren": "Extourner",
  "finanz.zahlungen.stornoFrage":
    "Ce paiement n'est pas supprimé mais annulé par une écriture inverse. Continuer ?",
  "finanz.zahlungen.storniert": "Paiement extourné",
  "finanz.zahlungen.nichtZugeordnet": "{amount} non affectés",
  "finanz.zahlungen.abgeglichen": "Rapproché",
  "finanz.zahlungen.offenerAbgleich": "Rapprochement ouvert",

  "finanz.method.bank": "Virement bancaire",
  "finanz.method.qr": "Facture QR",
  "finanz.method.cash": "Espèces",
  "finanz.method.twint": "TWINT",
  "finanz.method.card": "Carte",
  "finanz.method.other": "Autre moyen",

  "finanz.dialog.title": "Saisir un encaissement",
  "finanz.dialog.forInvoice": "Facture {nr}",
  "finanz.dialog.forQuittung": "Quittance {nr}",
  "finanz.dialog.amount": "Montant",
  "finanz.dialog.date": "Date du paiement",
  "finanz.dialog.method": "Moyen de paiement",
  "finanz.dialog.reference": "Référence",
  "finanz.dialog.referencePlaceholder": "Référence QR, numéro TWINT, numéro de pièce",
  "finanz.dialog.note": "Remarque",
  "finanz.dialog.openAmount": "Solde dû : {amount}",
  "finanz.dialog.submit": "Saisir",
  "finanz.dialog.saved": "Encaissement saisi",
  "finanz.dialog.overpay":
    "Le montant dépasse le solde dû. Le surplus reste en encaissement non affecté.",
  "finanz.dialog.doppelt":
    "Attention : un paiement est déjà imputé à une facture pour cette affaire.",

  "finanz.rechnung.bezahlt": "Payé",
  "finanz.rechnung.offen": "Solde dû",
  "finanz.rechnung.gutgeschrieben": "Crédité",
  "finanz.rechnung.keineZahlung":
    "Le statut suit les paiements saisis — il ne se règle pas à la main.",
} as const;
