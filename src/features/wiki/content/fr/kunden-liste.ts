import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kunden-liste",
  locale: "fr",
  title: "La liste des clients",
  summary: "Toute la clientèle au même endroit — chercher, filtrer et ouvrir.",

  purpose:
    "La liste des clients rassemble chaque personne et chaque entreprise avec qui vous avez travaillé. Elle montre d'un coup d'œil qui doit encore de l'argent et quand il s'est passé quelque chose pour la dernière fois.",

  whenToUse: [
    "Vous cherchez le numéro de téléphone d'une cliente.",
    "Vous voulez savoir qui doit encore de l'argent.",
    "Vous soupçonnez qu'une personne figure deux fois.",
    "Vous voulez voir tous les clients entreprises.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Les clients apparaissent tout seuls",
      text: "Il n'y a pas de bouton « Nouveau client », et c'est voulu. Une fiche naît automatiquement d'une demande, d'un devis ou d'un document.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kunden-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La liste des clients avec les indicateurs, la recherche, les filtres et les fiches.",
      alt: "Liste des clients avec quatre indicateurs en haut, un champ de recherche, quatre boutons de filtre et en dessous les fiches clients avec nom, e-mail, téléphone et localité.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 17, label: "Quatre indicateurs sur le portefeuille." },
        { n: 2, xPct: 50, yPct: 30, label: "Recherche sur le nom, l'e-mail et le téléphone." },
        { n: 3, xPct: 30, yPct: 37, label: "Filtres : Tous, Personnes, Entreprises, Doublon possible." },
        { n: 4, xPct: 50, yPct: 55, label: "Une fiche. Un clic ouvre la fiche client." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Les quatre indicateurs",
    },
    {
      kind: "statusTable",
      headers: { status: "Tuile", meaning: "Ce qui est compté", next: "Cliquable ?" },
      rows: [
        { status: "Clients", meaning: "Toutes les fiches, sans celles déjà fusionnées.", next: "Non" },
        { status: "Nouveaux (30 j.)", meaning: "Fiches créées durant les 30 derniers jours.", next: "Non" },
        { status: "Doublon possible", meaning: "Fiches qui partagent un numéro de téléphone.", next: "Oui — applique le filtre" },
        { status: "Inactifs (90 j.)", meaning: "Fiches dont le premier contact remonte à plus de 90 jours.", next: "Non" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« Inactifs » ne veut pas dire « sans activité »",
      text: "La tuile compte la date du premier contact, pas celle de la dernière action. Une cliente fidèle de longue date y figure aussi.",
    },
    {
      kind: "heading",
      id: "suchen-filtern",
      text: "Chercher et filtrer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tapez dans le champ « Nom, e-mail ou téléphone … ».",
          note: "La liste réagit d'elle-même après un court instant. Rien à valider.",
        },
        {
          text: "Choisissez un filtre en dessous : « Tous », « Personnes », « Entreprises » ou « Doublon possible ».",
          note: "La recherche et le filtre agissent ensemble.",
        },
        {
          text: "Le « X » dans le champ de recherche remet la recherche à zéro.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eintrag-lesen",
      text: "Lire une fiche",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "À gauche : nom, e-mail, téléphone et localité.",
        "La marque « Entreprise » apparaît pour les clients entreprises.",
        "Un code de langue n'apparaît que si la clientèle ne parle pas allemand.",
        "À droite, le montant ouvert avec le mot « ouvert » — seulement s'il reste vraiment quelque chose.",
        "Tout à droite : quand il s'est passé quelque chose pour la dernière fois, ou « Aucune activité ».",
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur une fiche.",
          note: "La fiche client s'ouvre avec tous les dossiers et les montants.",
        },
        {
          text: "En bas, réglez le nombre de fiches par page.",
          note: "Au choix : 10, 25, 50 et 100. Réglage par défaut : 25.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Un clic sur une fiche ouvre la fiche client.",
    "Le montant ouvert baisse dès que vous saisissez un paiement sous « Finances ».",
    "Une nouvelle fiche apparaît ici dès qu'une demande ou un document la fait naître.",
  ],

  commonMistakes: [
    "Vouloir créer une cliente à la main. Ce n'est pas prévu — saisissez plutôt une demande.",
    "Lire « Inactifs (90 j.) » comme « ne s'est pas manifesté depuis longtemps ». C'est le premier contact qui compte.",
    "Chercher par numéro de client. La recherche porte sur le nom, l'e-mail et le téléphone.",
  ],

  ifSomethingGoesWrong: [
    "La liste est vide : il n'y a encore aucune demande pour cette entreprise. Créez d'abord une demande.",
    "Une personne figure deux fois : ouvrez la fiche ; un avertissement sur les doublons possibles apparaît en haut.",
    "Vous ne trouvez pas une fiche : cherchez par numéro de téléphone plutôt que par nom — les noms s'écrivent souvent autrement.",
  ],
} satisfies WikiArticleBody;

export default body;
