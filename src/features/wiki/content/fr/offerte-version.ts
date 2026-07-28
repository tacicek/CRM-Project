import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-version",
  locale: "fr",
  title: "Une nouvelle version d'un devis",
  summary: "Quand quelque chose change après l'envoi — et comment distinguer les moutures.",

  purpose:
    "Un devis envoyé est verrouillé. Si vous devez malgré tout changer quelque chose, créez une nouvelle version. L'ancienne subsiste comme preuve.",

  whenToUse: [
    "La clientèle demande une prestation supplémentaire après l'envoi.",
    "Vous avez mal calculé un prix et le devis est déjà parti.",
    "Une date se décale et le devis mentionne une date.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Après l'envoi seulement, et avant l'acceptation",
      text: "Sur un brouillon, vous modifiez directement. Sur un devis accepté, il vous faut un avenant. La nouvelle version se situe exactement entre les deux.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Créer une nouvelle version",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez le devis envoyé depuis la liste.",
        },
        {
          text: "Cliquez en haut à droite sur « Nouvelle version ».",
          note: "Le bouton est absent si le devis est encore brouillon, déjà accepté ou lui-même dépassé.",
        },
        {
          text: "Vous arrivez dans le formulaire de modification de la nouvelle mouture.",
          note: "Toutes les positions sont reprises. La nouvelle mouture est un brouillon.",
        },
        {
          text: "Adaptez ce qui a changé, puis envoyez le devis.",
          note: "Via « Enregistrer et envoyer », il part à la même adresse.",
        },
      ],
    },
    {
      kind: "heading",
      id: "was-passiert",
      text: "Ce qu'il advient de l'ancienne mouture",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "L'ancienne mouture subsiste telle quelle — comme preuve de ce que la clientèle a vu.",
        "Elle est marquée comme dépassée et affiche en haut l'avertissement rouge « Il existe une version plus récente de cette mouture ».",
        "Son lien reste accessible, mais la clientèle ne peut plus accepter par ce biais.",
        "Si quelqu'un ouvre l'ancien lien, il voit un avis indiquant qu'une mouture plus récente existe.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/offerte-version-gesperrt-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La mouture dépassée — signalée en rouge et sans bouton pour une version supplémentaire.",
      alt: "Vue détaillée d'un devis dépassé avec l'avertissement rouge indiquant qu'il existe une version plus récente, et seulement le bouton de téléchargement du PDF.",
      hotspots: [
        { n: 1, xPct: 32, yPct: 12, label: "L'avertissement rouge sur la mouture plus récente." },
        { n: 2, xPct: 92, yPct: 10, label: "Plus que le PDF — aucune modification possible." },
      ],
    },
    {
      kind: "heading",
      id: "auseinanderhalten",
      text: "Distinguer les moutures",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Le numéro reste le même",
      text: "La version 2 porte le même numéro de devis que la version 1. Dans la liste, les deux apparaissent comme des lignes distinctes portant le même numéro — la liste n'affiche pas de numéro de version.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Regardez la date et le statut dans la liste.",
          note: "La mouture la plus récente est plus jeune et souvent encore « Brouillon ».",
        },
        {
          text: "Ouvrez le devis pour en être sûr.",
          note: "À partir de la version 2, « Version 2 » figure en haut. La mouture dépassée porte l'avertissement rouge.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Quand ce n'est pas possible",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Pourquoi", next: "À faire à la place" },
      rows: [
        { status: "Il existe déjà une version plus récente", meaning: "Vous êtes sur une mouture dépassée.", next: "Ouvrir la plus récente et continuer là." },
        { status: "Le devis est accepté", meaning: "L'ampleur est convenue.", next: "Créer un avenant." },
        { status: "Le devis est encore un brouillon", meaning: "Rien n'est verrouillé.", next: "Modifier directement." },
      ],
    },
  ],

  whatHappensNext: [
    "La nouvelle mouture est un brouillon et porte le même numéro de devis.",
    "Après l'envoi, elle fait foi ; l'ancienne subsiste comme preuve.",
    "La clientèle ne peut plus accepter que via la mouture la plus récente.",
  ],

  commonMistakes: [
    "Vouloir supprimer l'ancienne mouture. Elle prouve ce que la clientèle avait reçu au départ.",
    "Renvoyer l'ancien lien à la clientèle. Elle ne peut plus accepter par ce biais — copiez le lien de la nouvelle mouture.",
    "Chercher « Nouvelle version » sur un devis déjà accepté. Là, il n'y a que l'avenant.",
  ],

  ifSomethingGoesWrong: [
    "Le bouton « Nouvelle version » manque : le devis est brouillon, accepté ou lui-même dépassé.",
    "Vous ne savez pas quelle mouture fait foi : ouvrez les deux ; la dépassée porte l'avertissement rouge.",
    "Vous avez créé deux nouvelles versions par inadvertance : n'envoyez que la dernière. Les brouillons non envoyés peuvent être supprimés.",
  ],
} satisfies WikiArticleBody;

export default body;
