import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "sprache-dashboard-vs-dokument",
  locale: "fr",
  title: "Deux langues : la vôtre et celle de la clientèle",
  summary: "Pourquoi vous travaillez en français alors que la clientèle lit en allemand.",

  purpose:
    "Le programme distingue deux langues. L'une est celle de votre interface. L'autre est celle dans laquelle la clientèle est contactée.",

  whenToUse: [
    "Vous utilisez le programme en français mais avez de la clientèle germanophone.",
    "Un devis est parti dans la mauvaise langue.",
    "Vous voulez changer l'interface sans toucher aux documents clients.",
    "Une nouvelle personne dans l'équipe préfère travailler en allemand.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "La phrase la plus importante de cette page",
      text: "Si vous changez la langue en haut à droite, seul votre propre affichage change. Aucun document ni e-mail destiné à la clientèle n'est modifié.",
    },
    {
      kind: "heading",
      id: "die-zwei-sprachen",
      text: "Les deux langues comparées",
    },
    {
      kind: "statusTable",
      headers: { status: "Langue", meaning: "S'applique à", next: "Où la changer" },
      rows: [
        {
          status: "Votre interface",
          meaning: "Menus, boutons et libellés que vous seul voyez.",
          next: "En haut à droite dans la barre, à côté de la cloche.",
        },
        {
          status: "Langue de la clientèle",
          meaning: "Devis, facture, reçu, e-mail, SMS et les pages que la clientèle ouvre.",
          next: "À la saisie de la demande ou à la rédaction du devis.",
        },
      ],
    },
    {
      kind: "heading",
      id: "eigene-sprache-aendern",
      text: "Changer votre propre langue",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "Le choix de langue se trouve dans la barre du haut, entre la cloche et l'aide.",
      alt: "Barre du haut avec la cloche des notifications, à côté le choix de langue affichant l'abréviation FR, puis le bouton Aide et mode d'emploi.",
      hotspots: [
        { n: 1, xPct: 72, yPct: 50, label: "Ici s'affiche votre langue actuelle : DE, FR ou EN." },
      ],
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Dans la barre du haut, cliquez sur l'abréviation de langue, par exemple « FR ».",
          note: "Une liste s'ouvre avec Deutsch, Français et English.",
        },
        {
          text: "Choisissez votre langue.",
          note: "La page change aussitôt. Vos données restent inchangées.",
        },
        {
          text: "Choisissez l'option de la langue d'entreprise si vous voulez suivre le réglage par défaut.",
          note: "Votre affichage reprend alors la langue définie dans les paramètres de l'entreprise.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Ce choix vaut seulement pour ce navigateur",
      text: "Vos collègues continuent de voir leur propre langue. Sur un autre appareil, vous devrez refaire ce choix.",
    },
    {
      kind: "heading",
      id: "kundensprache",
      text: "La langue de la clientèle",
    },
    {
      kind: "paragraph",
      text: "La langue de la clientèle est fixée au moment de la demande. De là, elle passe au devis, au mandat, à la facture et au reçu.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Le devis est rédigé et envoyé dans cette langue.",
        "La page que la clientèle ouvre via le lien s'affiche dans cette langue.",
        "Les rappels par e-mail et SMS partent dans cette langue, même si personne de l'équipe ne les déclenche.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Après l'envoi, la langue est figée",
      text: "Un devis envoyé ne peut plus être modifié, sa langue non plus. Si la langue est fausse, créez une nouvelle version du devis.",
    },
    {
      kind: "heading",
      id: "beispiel",
      text: "Un exemple",
    },
    {
      kind: "paragraph",
      text: "Anna travaille en allemand. Sa cliente Luc Exemple habite Genève et parle français.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Anna voit tout le programme en allemand.",
        "Sur la demande, la langue enregistrée est le français.",
        "Le devis rédigé par Anna est en français.",
        "Luc reçoit un e-mail en français et ouvre une page en français.",
        "Si Anna passe son affichage en anglais, le devis de Luc reste en français.",
      ],
    },
  ],

  whatHappensNext: [
    "Votre choix de langue s'applique aussitôt et reste enregistré dans ce navigateur.",
    "Les documents gardent la langue enregistrée au moment de leur création.",
    "Les rappels automatiques utilisent la langue inscrite dans l'enregistrement.",
  ],

  commonMistakes: [
    "Changer sa propre langue en pensant que la clientèle sera désormais contactée dans cette langue.",
    "Ne remarquer la langue de la clientèle qu'après l'envoi. Seule une nouvelle version du devis peut alors corriger cela.",
    "Croire que la langue vaut pour toute l'entreprise. Elle vaut par cliente, par client et par document.",
  ],

  ifSomethingGoesWrong: [
    "Un document est parti dans la mauvaise langue : créez une nouvelle version du devis dans la bonne langue et envoyez-la.",
    "Votre affichage revient en arrière après rechargement : vous suivez la langue d'entreprise. Choisissez explicitement une langue.",
    "Un texte s'affiche en allemand alors que vous avez choisi le français : signalez l'endroit. Une traduction manque.",
  ],
} satisfies WikiArticleBody;

export default body;
