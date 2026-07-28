import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "typischer-arbeitstag",
  locale: "fr",
  title: "Une journée de travail type",
  summary: "Une courte liste de ce que vous vérifiez le matin, la journée et le soir.",

  purpose:
    "Ce guide vous donne un ordre fixe pour la journée. Si vous le suivez, rien ne reste en suspens.",

  whenToUse: [
    "Les premières semaines, jusqu'à ce que l'ordre devienne un réflexe.",
    "Après des vacances ou une absence, pour rattraper le retard sans rien oublier.",
    "Quand vous formez un remplaçant ou une remplaçante.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "morgens",
      text: "Le matin : faire le tour",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez « Vue d'ensemble ».",
          note: "Quatre tuiles montrent immédiatement où quelque chose est en attente.",
        },
        {
          text: "Regardez sous « Aujourd'hui » quels rendez-vous sont prévus.",
          note: "Vérifiez que l'équipe et le véhicule sont fixés pour chaque intervention.",
        },
        {
          text: "Ouvrez « Boîte e-mail » si un chiffre y apparaît.",
          note: "Ces messages attendent que vous en fassiez une demande ou que vous les écartiez.",
        },
        {
          text: "Ouvrez « Suivi ».",
          note: "Vous y trouvez les tâches datées. Celles en retard sont mises en évidence.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Un ordre voulu",
      text: "D'abord la vue d'ensemble, puis la boîte de réception, puis vos propres tâches. Vous décidez ainsi du nouveau avant que la journée ne vous rattrape.",
    },
    {
      kind: "heading",
      id: "tagsueber",
      text: "En journée : transformer les demandes en devis",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez « Demandes » et traitez les nouvelles de haut en bas.",
          note: "Les nouvelles demandes portent la mention « Nouveau ».",
        },
        {
          text: "Décidez pour chaque demande : rédiger un devis ou d'abord faire une visite.",
          note: "Pour les mandats importants ou peu clairs, la visite en vaut la peine.",
        },
        {
          text: "Vérifiez la langue de la clientèle avant l'envoi.",
          note: "Après l'envoi, le devis ne peut plus être modifié.",
        },
        {
          text: "Créez un suivi si vous voulez relancer.",
          note: "Le programme vous le rappellera, vous n'avez pas à y penser.",
        },
      ],
    },
    {
      kind: "heading",
      id: "nach-dem-einsatz",
      text: "Après une intervention : facturer",
    },
    {
      kind: "steps",
      steps: [
        { text: "Ouvrez « Mandats » et clôturez le mandat terminé." },
        {
          text: "Créez une facture ou un reçu.",
          note: "Un reçu convient si le paiement se fait sur place. Sinon, prenez une facture.",
        },
        {
          text: "Saisissez les paiements reçus sous « Finances ».",
          note: "Le statut de la facture découle automatiquement des paiements saisis.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ne passez pas une facture à « payée » à la main",
      text: "Il n'y a pas de bouton pour cela, et c'est voulu. Saisissez le paiement ; le statut en découle tout seul.",
    },
    {
      kind: "heading",
      id: "abends",
      text: "Le soir : ranger un peu",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Vérifiez dans « Boîte de réception » si un message client est resté sans réponse.",
          note: "Vous répondez depuis votre logiciel de messagerie habituel ; le programme n'affiche ici qu'un aperçu.",
        },
        {
          text: "Regardez dans « Dossiers » s'il reste une réclamation ouverte.",
          note: "Un dossier ouvert le soir devient un appel mécontent le lendemain matin.",
        },
        {
          text: "Jetez un œil au « Calendrier » pour demain.",
          note: "S'il manque une équipe quelque part, vous le voyez encore aujourd'hui.",
        },
      ],
    },
    {
      kind: "heading",
      id: "wochenrhythmus",
      text: "Une fois par semaine",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Ouvrir « Indicateurs » et voir combien de devis sont devenus des mandats.",
        "Contrôler dans « Finances » les factures en retard.",
        "Vérifier « Cartons de déménagement » si vous en louez : lesquels sont en retard ?",
      ],
    },
  ],

  whatHappensNext: [
    "Après ce tour, aucune demande ne reste sans réponse plus d'un jour.",
    "Chaque travail terminé a une facture ou un reçu.",
    "Tout ce que vous voulez reprendre plus tard figure comme suivi avec une date.",
  ],

  commonMistakes: [
    "Accumuler les demandes et les traiter une fois par semaine. Qui répond en premier emporte le mandat le plus souvent.",
    "Ne saisir les paiements qu'en fin de mois. D'ici là, aucun chiffre sous « Finances » n'est juste.",
    "Créer des suivis sans jamais ouvrir la liste. Elle n'aide que si vous la consultez chaque jour.",
  ],

  ifSomethingGoesWrong: [
    "Vous avez perdu le fil : commencez par « Suivi » et traitez les entrées en retard.",
    "Beaucoup de demandes ouvertes : triez par date et commencez par les plus anciennes.",
    "Vous ne savez plus si un mandat a été facturé : ouvrez le mandat ; les factures et reçus liés y figurent.",
  ],
} satisfies WikiArticleBody;

export default body;
