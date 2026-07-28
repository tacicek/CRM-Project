import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfragen-liste",
  locale: "fr",
  title: "La liste des demandes",
  summary: "Toutes les demandes reçues, groupées par prestation — et le chemin vers le devis.",

  purpose:
    "Chaque demande arrive ici : depuis le formulaire web, depuis la boîte e-mail ou saisie à la main. C'est d'ici que vous lancez le devis.",

  whenToUse: [
    "Le matin, pour voir ce qui est arrivé pendant la nuit.",
    "Vous cherchez la demande d'une cliente précise.",
    "Vous voulez traiter toutes les demandes de nettoyage ensemble.",
    "Vous voulez voir pour quoi un devis est déjà parti.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/anfragen-liste-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La liste des demandes avec la barre d'onglets et les actions par demande.",
      alt: "Liste des demandes avec une barre d'onglets pour Toutes, Déménagement, Nettoyage, Transport et Avec devis, puis des cartes montrant le nom, l'étape de vente, la prestation, le trajet et une rangée de boutons.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 18, label: "Onglets par groupe de prestation, avec le nombre." },
        { n: 2, xPct: 34, yPct: 24, label: "Recherche par nom, lieu, e-mail, téléphone et NPA." },
        { n: 3, xPct: 30, yPct: 31, label: "Étape de vente et prestation de la demande." },
        { n: 4, xPct: 25, yPct: 43, label: "« Créer un devis » — la voie principale depuis ici." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Comprendre la barre d'onglets",
    },
    {
      kind: "paragraph",
      text: "« Toutes » montre les demandes sans devis. Un onglet de prestation n'apparaît que s'il y a quelque chose dedans.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Une demande passe dans « Avec devis »",
      text: "Dès que vous avez créé un devis, la demande quitte son onglet de prestation et se range dans le dernier onglet. Ainsi « Toutes » ne montre que le travail encore ouvert.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Toutes les prestations n'ont pas leur onglet",
      text: "Un monte-meubles ou une prestation inconnue n'apparaît que sous « Toutes ». Le transport de piano se range dans l'onglet « Transport ». Le petit plus au bout de la barre n'est pas un bouton.",
    },
    {
      kind: "heading",
      id: "eintrag",
      text: "Ce que montre une carte de demande",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Le nom de la clientèle — ou « Client inconnu » si aucun nom n'a été reconnu.",
        "L'étape de vente en marque grise : Nouveau, Qualification, Visite, Devis en cours, Devis envoyé, En négociation, Gagné ou Perdu.",
        "La prestation avec son icône, par exemple « Déménagement privé ».",
        "La langue, mais seulement si la clientèle ne parle pas allemand.",
        "La date souhaitée, si elle a été indiquée.",
        "La marque « Devis n° … » dès qu'une offre existe.",
        "En dessous le trajet, les pièces et la surface, puis le téléphone et l'e-mail cliquables.",
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Les boutons de chaque demande",
    },
    {
      kind: "statusTable",
      headers: { status: "Bouton", meaning: "Où il mène", next: "Visible quand" },
      rows: [
        { status: "Créer un devis", meaning: "Vers le formulaire, informations reprises.", next: "Tant qu'aucun devis n'existe." },
        { status: "Afficher le devis", meaning: "Vers le devis existant.", next: "Dès qu'il en existe un." },
        { status: "Nouveau devis", meaning: "Crée un second devis pour la même demande.", next: "Dès qu'il en existe un." },
        { status: "Fiche client", meaning: "Vers la fiche client.", next: "Seulement si un client est lié." },
        { status: "Visite", meaning: "Vers la planification de visite.", next: "Toujours." },
        { status: "Planifier un rendez-vous", meaning: "Vers le calendrier, rendez-vous prérempli.", next: "Toujours." },
        { status: "Détails", meaning: "Ouvre la demande en lecture.", next: "Toujours." },
        { status: "Modifier", meaning: "Ouvre la demande pour correction.", next: "Toujours." },
      ],
    },
    {
      kind: "heading",
      id: "suchen",
      text: "Chercher",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Tapez dans le champ « Rechercher dans les demandes … ».",
          note: "La recherche porte sur le nom, le lieu, l'e-mail, le téléphone et le code postal — pas sur la description.",
        },
        {
          text: "Si un onglet est actif, une marque avec son nom apparaît à côté de la recherche.",
          note: "Un clic sur le « × » vous ramène à « Toutes ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "loeschen",
      text: "Supprimer une demande",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La suppression est définitive",
      text: "La corbeille à droite retire la demande après une brève question du navigateur. Un devis déjà créé subsiste, mais perd son lien avec la demande.",
    },
    {
      kind: "paragraph",
      text: "Ne supprimez que les vraies erreurs de saisie et la publicité. Une demande refusée, laissez-la — elle fait partie de l'historique de la clientèle.",
    },
  ],

  whatHappensNext: [
    "« Créer un devis » ouvre le formulaire avec toutes les informations de la demande.",
    "Dès que le devis est enregistré, la demande passe dans l'onglet « Avec devis ».",
    "L'étape de vente suit automatiquement dès que vous envoyez ou que la clientèle accepte.",
  ],

  commonMistakes: [
    "Chercher dans « Toutes » une demande qui a déjà un devis. Elle est sous « Avec devis ».",
    "Chercher un mot de la description. La recherche couvre nom, lieu, e-mail, téléphone et NPA.",
    "Supprimer les demandes traitées pour faire de l'ordre. Vous perdez alors l'historique.",
  ],

  ifSomethingGoesWrong: [
    "Un onglet manque : il n'y a actuellement aucune demande ouverte pour ce groupe.",
    "Une demande n'apparaît nulle part : sa prestation n'entre dans aucun groupe. Regardez sous « Toutes ».",
    "« Fiche client » manque sur une demande : aucune fiche client n'y est encore liée.",
  ],
} satisfies WikiArticleBody;

export default body;
