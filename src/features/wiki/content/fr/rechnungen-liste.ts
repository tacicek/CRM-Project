import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnungen-liste",
  locale: "fr",
  title: "La liste des factures",
  summary: "Toutes les factures avec statut, filtres, PDF et les règles de suppression.",

  purpose:
    "La liste des factures montre chaque facture créée avec son statut. De là, vous ouvrez une facture, téléchargez le PDF ou en créez une nouvelle.",

  whenToUse: [
    "Vous cherchez une facture précise.",
    "Vous voulez voir quelles factures sont en retard.",
    "Il vous faut un PDF pour la comptabilité.",
    "Vous voulez écrire une nouvelle facture.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/rechnungen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La liste des factures avec les indicateurs, la recherche, les filtres de statut et les lignes.",
      alt: "Liste des factures avec quatre indicateurs, un champ de recherche, cinq filtres de statut et en dessous des lignes avec numéro de facture, nom du client, date, échéance, statut et montant.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 22, label: "Total, Ouvertes, En retard et Chiffre." },
        { n: 2, xPct: 30, yPct: 34, label: "Recherche par numéro ou nom du client." },
        { n: 3, xPct: 40, yPct: 41, label: "Filtres de statut." },
        { n: 4, xPct: 92, yPct: 12, label: "« Nouvelle facture » ouvre le formulaire vide." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-status",
      text: "Les quatre statuts",
    },
    {
      kind: "statusTable",
      headers: { status: "Statut", meaning: "Signification", next: "Votre prochaine étape" },
      rows: [
        { status: "Brouillon", meaning: "Pas encore parti chez la clientèle.", next: "Terminer et envoyer." },
        { status: "Envoyée", meaning: "Émise, pas encore entièrement payée.", next: "Attendre l'entrée." },
        { status: "Payée", meaning: "Entièrement réglée.", next: "Rien de plus." },
        { status: "En retard", meaning: "La date d'échéance est passée.", next: "Relancer ou envoyer un rappel." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "« Payée » se règle tout seul",
      text: "Dès que les paiements saisis couvrent le montant, le statut change automatiquement. Vous ne pouvez pas le régler à la main.",
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Les indicateurs en haut",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "« Total » est le nombre de toutes les factures.",
        "« Ouvertes » compte les brouillons et les factures envoyées — celles en retard n'y figurent pas.",
        "« En retard » ne compte que celles en retard.",
        "« Chiffre » est l'argent réellement rentré, pas la somme des factures émises.",
      ],
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Chercher et filtrer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tapez dans le champ « N° ou nom du client … ».",
          note: "La recherche porte sur le numéro de facture et sur le nom.",
        },
        {
          text: "Choisissez un statut en dessous : « Tous », « Brouillon », « Envoyée », « Payée » ou « En retard ».",
        },
        {
          text: "Cliquez sur une ligne pour ouvrir la facture.",
        },
      ],
    },
    {
      kind: "heading",
      id: "pdf",
      text: "Télécharger le PDF",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur l'icône de téléchargement dans la ligne.",
          note: "Ou via le menu à trois points et « Télécharger le PDF ».",
        },
        {
          text: "Le PDF contient la section de paiement QR suisse.",
          note: "Pour cela, l'IBAN et l'adresse de l'entreprise doivent figurer dans les paramètres.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« IBAN manquant » ou « Adresse d'entreprise incomplète »",
      text: "Si l'un de ces messages apparaît, aucune section QR ne peut être générée. Complétez l'IBAN, la rue, le NPA et la localité sous « Paramètres ».",
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Supprimer — et pourquoi rarement",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La suppression ne demande pas de confirmation",
      text: "Dans le menu à trois points, « Supprimer » efface le brouillon immédiatement, sans question. Il n'y a pas de retour en arrière.",
    },
    {
      kind: "paragraph",
      text: "La suppression n'est possible que pour les brouillons. Pour tous les autres, un message rappelle que les documents comptabilisés sont annulés et non supprimés.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Brouillon : peut être supprimé.",
        "Envoyée, Payée, En retard : ne peut pas être supprimée.",
        "Une facture émise par erreur se compense par une note de crédit, elle ne s'efface pas.",
      ],
    },
  ],

  whatHappensNext: [
    "Un clic sur une ligne ouvre la facture avec toutes ses positions.",
    "« Nouvelle facture » ouvre un formulaire vide.",
    "Le statut change dès que vous saisissez un paiement sous « Finances ».",
  ],

  commonMistakes: [
    "Lire « Chiffre » comme la somme des factures émises. C'est l'argent rentré.",
    "Toucher « Supprimer » par mégarde dans le menu à trois points. Aucune confirmation n'est demandée.",
    "Vouloir supprimer une facture émise au lieu de créer une note de crédit.",
  ],

  ifSomethingGoesWrong: [
    "Le PDF ne se génère pas : vérifiez l'IBAN et l'adresse de l'entreprise dans les paramètres.",
    "Une facture manque dans la liste : un filtre de statut est sans doute actif. Choisissez « Tous ».",
    "Un brouillon a été supprimé par erreur : il est perdu. Réécrivez-le — les données de la clientèle sont toujours là.",
  ],
} satisfies WikiArticleBody;

export default body;
