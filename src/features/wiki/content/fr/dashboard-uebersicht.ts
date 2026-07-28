import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "dashboard-uebersicht",
  locale: "fr",
  title: "La vue d'ensemble",
  summary: "Votre page d'accueil : nouvelles demandes, devis en attente et rendez-vous du jour.",

  purpose:
    "La vue d'ensemble montre d'un coup d'œil ce qui demande votre attention aujourd'hui. C'est le meilleur point de départ de la journée.",

  whenToUse: [
    "Le matin, pour organiser la journée.",
    "Après la pause de midi, pour voir les nouvelles demandes.",
    "Quand vous voulez savoir combien de devis sont restés sans réponse.",
    "Quand vous voulez passer rapidement à une autre page.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/dashboard-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La vue d'ensemble avec les quatre indicateurs, les rendez-vous du jour et les dernières demandes.",
      alt: "Page d'accueil du programme. En haut quatre tuiles chiffrées pour les nouvelles demandes, les offres en attente, les mandats du mois et les visites. En dessous les rendez-vous du jour et la liste des dernières demandes.",
      hotspots: [
        { n: 1, xPct: 28, yPct: 25, label: "Quatre tuiles avec les chiffres essentiels." },
        { n: 2, xPct: 45, yPct: 45, label: "Les rendez-vous du jour." },
        { n: 3, xPct: 45, yPct: 78, label: "Les demandes reçues en dernier." },
        { n: 4, xPct: 85, yPct: 62, label: "Rappel des nouvelles demandes et accès rapide." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-kacheln",
      text: "Les quatre tuiles",
    },
    {
      kind: "statusTable",
      headers: { status: "Tuile", meaning: "Ce que le chiffre signifie", next: "Votre prochaine étape" },
      rows: [
        {
          status: "Nouvelles demandes",
          meaning: "Demandes pour lesquelles aucun devis n'existe encore.",
          next: "Rédiger un devis ou convenir d'une visite.",
        },
        {
          status: "Offres en attente",
          meaning: "Devis envoyés auxquels la clientèle n'a pas encore répondu.",
          next: "Relancer les devis les plus anciens.",
        },
        {
          status: "Mandats ce mois-ci",
          meaning: "Interventions planifiées dans le mois en cours.",
          next: "Vérifier dans le calendrier que l'équipe et le véhicule sont attribués.",
        },
        {
          status: "Visites",
          meaning: "Visites avant l'attribution du mandat.",
          next: "Confirmer le rendez-vous ou saisir le résultat.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Chaque tuile est un raccourci",
      text: "Sous chaque chiffre figure « Détails ». Un clic ouvre la liste correspondante.",
    },
    {
      kind: "heading",
      id: "heute",
      text: "Aujourd'hui",
    },
    {
      kind: "paragraph",
      text: "La zone « Aujourd'hui » liste tous les rendez-vous du jour. Un clic sur un rendez-vous l'ouvre dans le calendrier.",
    },
    {
      kind: "heading",
      id: "letzte-anfragen",
      text: "Dernières demandes",
    },
    {
      kind: "paragraph",
      text: "Vous voyez ici les cinq demandes les plus récentes. Une coche verte signifie qu'un devis existe déjà. Un point orange avec « Nouveau » signifie que rien n'a encore été fait.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Cliquez sur une demande dans la liste." },
        {
          text: "Vérifiez les informations de la clientèle.",
          note: "L'adresse, la date et l'ampleur figurent tout en haut.",
        },
        {
          text: "Cliquez sur « Tout afficher » pour voir plus de cinq demandes.",
          note: "Cela ouvre la liste complète sous « Demandes ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "unterwegs",
      text: "En déplacement, sur téléphone",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/dashboard-uebersicht-mobile-v1.webp",
      width: 780,
      height: 1688,
      caption: "Le même aperçu sur un téléphone.",
      alt: "L'aperçu sur un écran étroit. Les tuiles se font suite horizontalement et défilent latéralement ; en bas se trouve une barre avec Aperçu, Demandes, Devis, Calendrier et Plus.",
    },
  ],

  whatHappensNext: [
    "Les chiffres se mettent à jour dès que vous envoyez un devis ou créez un rendez-vous.",
    "Une demande disparaît de « Nouvelles demandes » dès qu'un devis existe.",
    "« Détails » vous mène à la liste complète du domaine concerné.",
  ],

  commonMistakes: [
    "Lire la tuile « Offres en attente » comme un chiffre d'affaires. Elle compte des devis, pas de l'argent.",
    "Croire que « Nouvelles demandes » montre toutes les demandes. Seules celles sans devis sont comptées.",
    "Ne vérifier les rendez-vous qu'ici. Le calendrier montre aussi les jours suivants.",
  ],

  ifSomethingGoesWrong: [
    "Toutes les tuiles sont à zéro : il n'y a pas encore de données pour cette entreprise. Créez une première demande sous « Demandes ».",
    "Un chiffre semble trop élevé : cliquez sur « Détails » et vérifiez la liste. La tuile compte exactement ces entrées.",
    "La page met longtemps à charger : rechargez-la une fois. Si la lenteur persiste, vérifiez votre connexion Internet.",
  ],
} satisfies WikiArticleBody;

export default body;
