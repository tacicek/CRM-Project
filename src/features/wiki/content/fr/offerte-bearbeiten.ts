import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-bearbeiten",
  locale: "fr",
  title: "Modifier un devis",
  summary: "Modifier les brouillons — et pourquoi les devis envoyés se verrouillent.",

  purpose:
    "Tant qu'un devis est un brouillon, vous pouvez tout y changer. Dès qu'il est envoyé, son contenu est verrouillé.",

  whenToUse: [
    "Un brouillon n'est pas encore terminé.",
    "Vous avez repéré une faute de frappe avant l'envoi.",
    "Vous voulez adapter les positions d'une nouvelle version.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Seuls les brouillons sont modifiables",
      text: "Si vous ouvrez un devis envoyé en modification, un message vous renvoie en arrière. C'est voulu, ce n'est pas une erreur.",
    },
    {
      kind: "heading",
      id: "warum-gesperrt",
      text: "Pourquoi un devis envoyé est verrouillé",
    },
    {
      kind: "paragraph",
      text: "La clientèle doit pouvoir relire ce qu'elle a reçu. Si un devis envoyé pouvait être modifié après coup, le lien ne vaudrait plus comme preuve.",
    },
    {
      kind: "paragraph",
      text: "Le verrou n'agit pas seulement à l'écran. Un détour par un autre endroit est également refusé.",
    },
    {
      kind: "heading",
      id: "bearbeiten",
      text: "Modifier un brouillon",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez la liste des devis et cherchez le brouillon.",
          note: "Les brouillons portent la marque grise « Brouillon ».",
        },
        {
          text: "Dans le menu à trois points, cliquez sur « Modifier ».",
        },
        {
          text: "Changez ce qui doit l'être.",
          note: "Le formulaire est celui de la création.",
        },
        {
          text: "Cliquez sur « Enregistrer les modifications » ou « Enregistrer et envoyer ».",
          note: "Le second bouton enregistre et expédie en une fois.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Un devis envoyé : aucun bouton de modification, seulement le PDF et le lien client.",
      alt: "Vue détaillée d'un devis envoyé. En haut un avertissement rouge sur une version plus récente, à droite uniquement les zones Client, Activités et Lien client, sans possibilité de modification.",
    },
    {
      kind: "heading",
      id: "was-tun",
      text: "Que faire si le devis est déjà parti",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "La bonne voie", next: "Guide" },
      rows: [
        { status: "Envoyé, sans réponse", meaning: "Créer une nouvelle version et l'envoyer.", next: "Nouvelle version d'un devis" },
        { status: "Accepté, l'ampleur change", meaning: "Créer un avenant.", next: "Avenant à un devis" },
        { status: "Refusé", meaning: "Ne rien changer. Nouveau devis depuis la demande.", next: "Rédiger un devis" },
        { status: "Encore brouillon", meaning: "Modifier directement.", next: "Cet article" },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Une nouvelle version est à nouveau un brouillon",
      text: "Créer une nouvelle version produit un brouillon neuf avec les mêmes positions. Vous le modifiez normalement, puis vous l'envoyez.",
    },
  ],

  whatHappensNext: [
    "Les modifications enregistrées prennent effet aussitôt, tant que le devis est un brouillon.",
    "Avec « Enregistrer et envoyer », le statut passe à « Envoyé » et le contenu se verrouille.",
    "Ensuite, toute modification passe par une nouvelle version.",
  ],

  commonMistakes: [
    "Vouloir corriger vite un prix après l'envoi. C'est verrouillé — utilisez une nouvelle version.",
    "Vouloir modifier un devis accepté. Pour changer l'ampleur convenue, il y a l'avenant.",
    "Créer plusieurs brouillons pour la même demande au lieu d'en modifier un. Cela sème la confusion dans la liste.",
  ],

  ifSomethingGoesWrong: [
    "« Ce devis a été envoyé » : c'est normal. Créez une nouvelle version.",
    "« Modification impossible » : le devis est accepté ou refusé.",
    "« Erreur lors de l'enregistrement » sur une ancienne mouture : vous modifiez une version dépassée. Ouvrez plutôt la plus récente.",
  ],
} satisfies WikiArticleBody;

export default body;
