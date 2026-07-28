import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftraege-liste",
  locale: "fr",
  title: "La liste des mandats",
  summary: "Toutes les interventions avec date, équipe et statut — et ce que vous pouvez faire pour chacune.",

  purpose:
    "Un mandat, c'est le travail confirmé : qui, quand, où. La liste montre toutes les interventions et c'est là que vous les clôturez et les facturez.",

  whenToUse: [
    "Le matin, pour voir les interventions du jour.",
    "Vous voulez savoir quel mandat est en retard.",
    "Une intervention est terminée et doit être clôturée.",
    "Après la clôture, vous voulez créer une facture ou un reçu.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/auftraege-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La liste des mandats avec quatre tuiles, des onglets et le tableau.",
      alt: "Liste des mandats avec les tuiles Aujourd'hui, Demain, Planifiés et Clôturés, puis des onglets et un tableau avec mandat, client, date et heure, équipe et statut.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Quatre tuiles : aujourd'hui, demain, planifiés, clôturés." },
        { n: 2, xPct: 35, yPct: 34, label: "Onglets pour restreindre." },
        { n: 3, xPct: 80, yPct: 52, label: "Colonne Statut." },
        { n: 4, xPct: 95, yPct: 52, label: "Le menu à trois points — tout se passe là." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "La ligne elle-même n'est pas cliquable",
      text: "Il n'existe pas de page de détail pour un mandat. Chaque action passe par le menu à trois points à droite.",
    },
    {
      kind: "heading",
      id: "status",
      text: "Les cinq statuts",
    },
    {
      kind: "statusTable",
      headers: { status: "Statut", meaning: "Signification", next: "Votre prochaine étape" },
      rows: [
        { status: "Planifié", meaning: "La date est fixée, pas encore confirmée.", next: "Attribuer l'équipe, confirmer." },
        { status: "Confirmé", meaning: "Fermement planifié.", next: "Exécuter le jour venu." },
        { status: "En cours", meaning: "En train de se dérouler.", next: "Une fois fini : « Clôturer … »." },
        { status: "Clôturé", meaning: "Terminé. Terminus — pas de retour.", next: "Créer une facture ou un reçu." },
        { status: "Annulé", meaning: "Annulé.", next: "Réactiver si nécessaire." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Confirmé et Clôturé se ressemblent",
      text: "Les deux marques sont vertes. Lisez le texte, pas la couleur.",
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Onglets et recherche",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "« Tous », « Aujourd'hui », « Demain », « Planifiés » et « Terminés » — chacun avec un nombre.",
        "« Planifiés » regroupe les mandats planifiés et confirmés.",
        "Les mandats annulés ne se trouvent que sous « Tous » — il n'y a pas d'onglet pour eux.",
        "La recherche porte sur le titre, le nom du client, le numéro de mandat et les deux adresses.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Mandats en retard",
      text: "Si la date est passée et que le mandat n'est ni clôturé ni annulé, un avis rouge apparaît en haut et la marque « En retard » sur la ligne.",
    },
    {
      kind: "heading",
      id: "menue",
      text: "Le menu à trois points",
    },
    {
      kind: "statusTable",
      headers: { status: "Entrée", meaning: "Ce qu'elle fait", next: "Visible quand" },
      rows: [
        { status: "Modifier", meaning: "Ouvre le mandat pour le changer.", next: "Toujours." },
        { status: "Fiche client", meaning: "Mène à la fiche client.", next: "Si un client est lié." },
        { status: "Télécharger le PDF", meaning: "Feuille de mandat pour l'équipe.", next: "Toujours." },
        { status: "Afficher le devis", meaning: "Ouvre le devis dans un nouvel onglet.", next: "S'il y en a un de lié." },
        { status: "Clôturer …", meaning: "Ouvre la fenêtre de clôture.", next: "Tant que non clôturé." },
        { status: "Créer une facture", meaning: "Lance une facture.", next: "Seulement en « Clôturé »." },
        { status: "Créer un reçu", meaning: "Lance un reçu.", next: "Toujours." },
        { status: "Annuler", meaning: "Passe le mandat en annulé.", next: "Si c'est permis." },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "« Archiver » s'appelle « Supprimer » dans la confirmation",
      text: "Le mandat disparaît de la liste, mais reste enregistré pour la traçabilité. Vous ne pouvez pas revenir en arrière ici.",
    },
    {
      kind: "heading",
      id: "doppelt",
      text: "Ne pas facturer deux fois",
    },
    {
      kind: "paragraph",
      text: "Un même mandat peut donner lieu à un reçu et à une facture. Le menu vous prévient : les documents déjà créés y figurent comme « Facture déjà créée » ou « Reçu supplémentaire (déjà existant) ».",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Une facture exige un IBAN",
      text: "Si l'IBAN manque dans les paramètres, le programme signale « IBAN manquant » et ne crée pas de facture QR.",
    },
  ],

  whatHappensNext: [
    "« Clôturer … » passe le mandat en « Clôturé » et débloque « Créer une facture ».",
    "Aucune facture ne naît d'elle-même — c'est une étape distincte.",
    "Si le rendez-vous lié est annulé dans le calendrier, le mandat passe automatiquement en « Annulé ».",
  ],

  commonMistakes: [
    "Attendre un montant dans la liste. Il n'y a pas de colonne d'argent — les montants sont dans le mandat.",
    "Chercher un mandat annulé sous « Planifiés ». Il n'est que sous « Tous ».",
    "Vouloir revenir en arrière après la clôture. « Clôturé » est un terminus.",
  ],

  ifSomethingGoesWrong: [
    "« Changement de statut invalide » : l'étape voulue n'est pas permise depuis ce statut.",
    "« Les données n'ont pas pu être validées » : l'enregistrement est abîmé ; modification et PDF sont bloqués. Signalez le mandat.",
    "« Créer une facture » manque : le mandat n'est pas encore clôturé.",
  ],
} satisfies WikiArticleBody;

export default body;
