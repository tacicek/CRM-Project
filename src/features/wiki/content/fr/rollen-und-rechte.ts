import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rollen-und-rechte",
  locale: "fr",
  title: "Rôles et droits",
  summary: "Qui a le droit de faire quoi : propriétaire, admin et collaborateur.",

  purpose:
    "Chaque personne de l'équipe a un rôle. Le rôle décide qui peut saisir de l'argent, modifier les paramètres et supprimer des données.",

  whenToUse: [
    "Un bouton manque chez vous mais pas chez une collègue.",
    "Vous créez un nouvel accès et devez choisir le rôle.",
    "Vous voulez comprendre pourquoi vous ne pouvez pas saisir un paiement.",
    "Vous vérifiez qui a le droit de supprimer des données clients.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "eigene-rolle",
      text: "Voir votre propre rôle",
    },
    {
      kind: "steps",
      steps: [
        { text: "Cliquez sur votre nom en haut à droite." },
        {
          text: "Votre rôle est indiqué sous votre adresse e-mail.",
          note: "Il s'agit de « Propriétaire », « Admin » ou « Collaborateur ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "die-drei-rollen",
      text: "Les trois rôles",
    },
    {
      kind: "statusTable",
      headers: { status: "Rôle", meaning: "Ce que ce rôle peut faire", next: "Typiquement pour" },
      rows: [
        {
          status: "Propriétaire",
          meaning: "Tout. C'est la personne au nom de laquelle l'entreprise est enregistrée.",
          next: "La direction.",
        },
        {
          status: "Admin",
          meaning: "Presque tout, y compris l'argent, les paramètres et les suppressions.",
          next: "La direction du bureau et sa suppléance.",
        },
        {
          status: "Collaborateur",
          meaning: "Le travail quotidien : demandes, devis, rendez-vous et mandats.",
          next: "La dispatch et la conduite des interventions.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Propriétaire et admin uniquement",
      text: "Saisir et modifier des paiements, fusionner ou supprimer des données clients, modifier les paramètres de l'entreprise, éditer les modèles et les tarifs, supprimer des factures et des dossiers.",
    },
    {
      kind: "heading",
      id: "was-alle-duerfen",
      text: "Ce que tout le monde peut faire",
    },
    {
      kind: "paragraph",
      text: "Les collaborateurs voient les mêmes données que le propriétaire et les admins. Ils peuvent accomplir entièrement le travail quotidien.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Consulter, saisir et modifier des demandes.",
        "Rédiger, envoyer et suivre des devis.",
        "Créer et modifier des rendez-vous dans le calendrier.",
        "Planifier et clôturer des mandats.",
        "Lire toutes les listes et analyses.",
      ],
    },
    {
      kind: "heading",
      id: "was-eingeschraenkt-ist",
      text: "Ce qui est bloqué pour les collaborateurs",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Saisir, modifier ou annuler des paiements.",
        "Fusionner deux fiches clients.",
        "Supprimer des clients, des factures, des dossiers ou des messages.",
        "Modifier les données de l'entreprise, les modèles, les tarifs et les rappels.",
        "Créer des notes de crédit et des rappels de paiement.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Un bouton manquant n'est pas une panne",
      text: "Si un bouton n'apparaît pas chez vous, c'est que le droit vous manque. Demandez à une personne ayant le rôle propriétaire ou admin d'exécuter l'étape.",
    },
    {
      kind: "heading",
      id: "kunden-zusammenfuehren",
      text: "Exemple : fusionner des clients",
    },
    {
      kind: "paragraph",
      text: "Si la même clientèle figure deux fois, les fiches peuvent être fusionnées. C'est la différence la plus nette entre les rôles.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La fusion est irréversible",
      text: "Les deux fiches n'en font plus qu'une. Vérifiez d'abord soigneusement qu'il s'agit bien de la même personne ou entreprise.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Ouvrez « Clients » puis la fiche concernée." },
        {
          text: "Cherchez l'indication d'un doublon possible.",
          note: "Elle n'apparaît que si le programme a trouvé une fiche semblable.",
        },
        {
          text: "Comparez les deux fiches ligne par ligne.",
          note: "Le même nom ne suffit pas. Comparez l'adresse e-mail et le numéro de téléphone.",
        },
        {
          text: "Fusionnez seulement si vous êtes certain.",
          note: "En tant que collaborateur, ce bouton ne vous est pas affiché.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Votre rôle vaut pour toute l'entreprise, pas page par page.",
    "Un changement de rôle prend effet dès que la personne concernée recharge la page.",
    "Les actions bloquées ne sont pas seulement masquées : elles sont aussi refusées en arrière-plan.",
  ],

  commonMistakes: [
    "Donner le rôle admin à tout le monde pour que « rien ne bloque ». Chacun peut alors modifier l'argent et les données clients.",
    "Croire que les collaborateurs voient moins de données. Ils voient la même chose, mais peuvent moins modifier.",
    "Créer un deuxième accès parce qu'un bouton manque. Cela crée des doublons.",
  ],

  ifSomethingGoesWrong: [
    "Un bouton manque : vérifiez votre rôle dans le menu en haut à droite.",
    "Une action échoue avec un message d'erreur bien que le bouton soit là : le droit vous manque. Demandez au propriétaire ou à un admin.",
    "Il vous faut durablement plus de droits : faites modifier votre rôle plutôt que d'utiliser un second accès.",
  ],
} satisfies WikiArticleBody;

export default body;
