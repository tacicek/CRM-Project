import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerten-liste",
  locale: "fr",
  title: "La liste des devis",
  summary: "Tous les devis avec leur statut, les filtres et les actions par ligne.",

  purpose:
    "La liste des devis montre chaque offre enregistrée ou envoyée. De là, vous ouvrez un devis, le renvoyez ou en faites un mandat.",

  whenToUse: [
    "Vous voulez savoir à quels devis la clientèle n'a pas encore répondu.",
    "Vous cherchez un devis précis.",
    "Une cliente accepte et vous voulez créer le mandat.",
    "Vous voulez renvoyer un devis.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/offerten-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La liste des devis avec quatre indicateurs et le tableau de toutes les offres.",
      alt: "Liste des devis avec quatre tuiles pour Total, En attente, Acceptés et Valeur, puis un tableau avec numéro, date, titre, client, langue, détails, montant, statut et validité.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 21, label: "Quatre tuiles — chacune sert aussi de filtre." },
        { n: 2, xPct: 33, yPct: 39, label: "Recherche par numéro, nom et titre." },
        { n: 3, xPct: 82, yPct: 39, label: "Filtres par type et par langue." },
        { n: 4, xPct: 84, yPct: 68, label: "Colonne Statut — où en est chaque devis." },
      ],
    },
    {
      kind: "heading",
      id: "kennzahlen",
      text: "Les quatre tuiles",
    },
    {
      kind: "paragraph",
      text: "Chaque tuile est aussi un filtre. Un clic n'affiche que les devis correspondants ; « Réinitialiser » annule cela.",
    },
    {
      kind: "statusTable",
      headers: { status: "Tuile", meaning: "Ce qui est compté", next: "Le clic filtre sur" },
      rows: [
        { status: "Total", meaning: "Tous les devis chargés.", next: "Tous" },
        { status: "En attente", meaning: "Envoyés ou consultés, sans réponse encore.", next: "En attente" },
        { status: "Acceptés", meaning: "Validés par la clientèle.", next: "Acceptés" },
        { status: "Valeur", meaning: "Somme des devis acceptés.", next: "Acceptés" },
      ],
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
        { status: "Brouillon", meaning: "Enregistré, pas encore envoyé.", next: "Terminer et envoyer." },
        { status: "Envoyé", meaning: "Chez le client, pas encore ouvert.", next: "Attendre." },
        { status: "Consulté", meaning: "Le client a ouvert le devis.", next: "Relancer après quelques jours." },
        { status: "Accepté", meaning: "Validé. Un mandat en découle.", next: "Planifier le rendez-vous." },
        { status: "Refusé", meaning: "Le client a décliné.", next: "Noter le motif, clore le dossier." },
      ],
    },
    {
      kind: "heading",
      id: "spalten",
      text: "Ce que contient le tableau",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "« N° » est le numéro du devis.",
        "« Détails » montre le trajet d'un lieu à l'autre et, s'il y en a, les pièces et la surface.",
        "« Montant » affiche la somme — ou « selon dépense » si une position est facturée à l'heure.",
        "« E-mail » indique par une icône si l'envoi est parti de l'adresse de l'entreprise ou du système.",
        "« Valable jusqu'au » est la date d'expiration du devis.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Le même numéro peut apparaître deux fois",
      text: "Une nouvelle version garde le numéro de l'ancienne. Les deux lignes figurent dans la liste et ne se distinguent que par la date et le statut. La liste n'affiche aucun numéro de version.",
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
          text: "Tapez dans le champ « N°, nom ou titre … ».",
          note: "La recherche porte aussi sur l'adresse e-mail, même si le champ ne le dit pas.",
        },
        {
          text: "Choisissez à droite « Tous les types » pour distinguer « Normal » et « Aveugle ».",
          note: "Un devis aveugle a été établi sans visite.",
        },
        {
          text: "Choisissez « Toutes les langues » pour filtrer selon la langue de la clientèle.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Les actions par ligne",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur une ligne pour ouvrir le devis.",
        },
        {
          text: "Cliquez à droite sur le menu à trois points pour les autres actions.",
          note: "« Afficher », « Modifier » et « Renvoyer » y figurent toujours.",
        },
        {
          text: "Pour les devis acceptés s'ajoutent « Ajouter au calendrier » et « Créer un mandat ».",
          note: "Si le mandat existe déjà, l'entrée s'appelle « Afficher le mandat ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "« Nouveau devis » mène aux demandes",
      text: "Le bouton en haut à droite n'ouvre pas de formulaire vide. Un devis naît toujours d'une demande, c'est pourquoi vous arrivez là.",
    },
  ],

  whatHappensNext: [
    "Un clic sur une ligne ouvre le devis avec toutes ses positions et son historique.",
    "« Renvoyer » expédie le même devis une nouvelle fois par e-mail.",
    "Dès que la clientèle accepte, le statut passe à « Accepté » et un mandat est créé.",
  ],

  commonMistakes: [
    "Prendre deux lignes du même numéro pour une erreur. Ce sont deux versions du même devis.",
    "Lire « Valeur » comme un chiffre d'affaires. C'est la somme des devis validés, pas l'argent rentré.",
    "Attendre « Renvoyer » sur un devis accepté. L'entrée est alors désactivée.",
  ],

  ifSomethingGoesWrong: [
    "Un devis manque : vérifiez si une tuile est active comme filtre et cliquez sur « Réinitialiser ».",
    "« Renvoyer » signale une erreur : vérifiez l'adresse e-mail de la clientèle dans le devis.",
    "« Ajouter au calendrier » indique « Demande manquante » : aucune demande n'est liée au devis. Créez le rendez-vous à la main dans le calendrier.",
  ],
} satisfies WikiArticleBody;

export default body;
