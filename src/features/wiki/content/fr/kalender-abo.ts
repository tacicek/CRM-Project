import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender-abo",
  locale: "fr",
  title: "S'abonner au calendrier",
  summary:
    "Vos rendez-vous dans le calendrier du téléphone ou de l'ordinateur — un calendrier coloré par type de rendez-vous.",

  purpose:
    "Vos rendez-vous CRM apparaissent en abonnement dans le calendrier que vous utilisez déjà : Apple, Google ou Outlook. Chaque type de rendez-vous y devient un calendrier distinct avec sa propre couleur, affichable ou masquable individuellement.",

  whenToUse: [
    "Vous voulez voir vos interventions sur le téléphone sans ouvrir le programme.",
    "L'équipe doit avoir les rendez-vous de l'entreprise à côté de ses rendez-vous privés, dans son calendrier habituel.",
    "Un appareil a été perdu ou un lien a été transmis — l'accès doit disparaître.",
    "Vous configurez un nouveau téléphone et avez besoin de nouveaux liens d'abonnement.",
  ],

  blocks: [
    {
      kind: "paragraph",
      text: "La connexion passe par un lien secret par type de rendez-vous : visites, prestations, relances, réunions, plages bloquées et autres rendez-vous. Vous n'abonnez que les types que vous voulez voir.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Un calendrier par type, avec une couleur fixe",
      text: "Chaque calendrier abonné porte le nom de l'entreprise et du type, par exemple « Hirschenumzug GmbH – Besichtigungen », et la couleur que le type a aussi dans le programme. Vous pouvez ainsi masquer les réunions sans perdre les interventions.",
    },
    {
      kind: "heading",
      id: "einrichten",
      text: "Comment le configurer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez « Paramètres » et passez à l'onglet « Calendrier ».",
        },
        {
          text: "Saisissez une désignation, par exemple « iPhone Anna ».",
          note: "Vous saurez ainsi plus tard à quel appareil ou à quelle personne retirer l'accès.",
        },
        {
          text: "Cliquez sur « Créer le jeton ».",
          note: "Les liens d'abonnement en dessous ne s'affichent que cette seule fois. Copiez-les maintenant.",
        },
        {
          text: "Copiez le lien du type de rendez-vous souhaité avec le symbole de copie.",
        },
        {
          text: "Ajoutez le lien comme abonnement dans votre application de calendrier et répétez pour les autres types.",
          note: "L'endroit exact est indiqué ci-dessous pour chaque application.",
        },
      ],
    },
    {
      kind: "heading",
      id: "apps",
      text: "Où coller le lien",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Apple Calendrier (Mac) : « Fichier › Nouvel abonnement à un calendrier… », collez le lien. iPhone : « Réglages › Apps › Calendrier › Comptes de calendrier › Ajouter un compte › Autre › Ajouter un cal. avec abonnement ».",
        "Google Agenda : dans le navigateur, à gauche près de « Autres agendas », cliquez sur le plus et choisissez « À partir de l'URL ».",
        "Outlook : dans le calendrier, « Ajouter un calendrier › S'abonner à partir du web ».",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Le lien est un mot de passe",
      text: "Quiconque connaît le lien voit les noms, adresses et numéros de téléphone de vos rendez-vous — sans se connecter. Ne le transmettez pas. Chaque personne et chaque appareil reçoit son propre jeton.",
    },
    {
      kind: "heading",
      id: "aktualisierung",
      text: "Actualisation et sens unique",
    },
    {
      kind: "paragraph",
      text: "L'abonnement est à sens unique : ce que vous modifiez dans le programme apparaît dans le calendrier abonné — les modifications faites dans le calendrier du téléphone, elles, n'ont aucun effet. Les rendez-vous se modifient toujours ici, dans le programme.",
    },
    {
      kind: "paragraph",
      text: "La fréquence d'actualisation est décidée par votre application de calendrier — en général de quelques minutes à quelques heures. Un rendez-vous déplacé remplace son ancienne entrée, sans doublon. Les rendez-vous annulés sont marqués comme annulés.",
    },
    {
      kind: "heading",
      id: "widerrufen",
      text: "Révoquer l'accès",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Dans « Paramètres › Calendrier », ouvrez la liste « Jetons existants ».",
          note: "« Dernière utilisation » montre si un jeton est encore consulté.",
        },
        {
          text: "Cliquez sur « Révoquer » pour le jeton concerné et confirmez.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La révocation est définitive",
      text: "Tous les abonnements de calendrier créés avec ce jeton cessent immédiatement de fonctionner — sur tous les appareils. Un jeton révoqué ne peut pas être réactivé ; créez-en un nouveau si nécessaire et réabonnez-vous.",
    },
  ],

  whatHappensNext: [
    "Les rendez-vous nouveaux, déplacés et annulés apparaissent d'eux-mêmes à la prochaine actualisation.",
    "Dans la liste des jetons, « Dernière utilisation » indique quand un calendrier a consulté les données pour la dernière fois.",
    "Après une révocation, l'application de calendrier signale le calendrier comme inaccessible — supprimez-y l'abonnement mort à la main.",
  ],

  commonMistakes: [
    "Transmettre un lien à plusieurs personnes au lieu de créer un jeton par personne — la révocation les touche alors toutes en même temps.",
    "Fermer la fenêtre avant d'avoir copié les liens. Ils ne s'affichent qu'une fois ; créez alors simplement un nouveau jeton.",
    "Essayer de modifier un rendez-vous dans le calendrier du téléphone. L'abonnement ne fait que lire — la modification se fait dans le programme.",
    "S'étonner qu'un changement n'apparaisse pas tout de suite. L'application de calendrier ne le récupère qu'à la prochaine actualisation.",
  ],

  ifSomethingGoesWrong: [
    "Le calendrier abonné reste vide : vérifiez que le lien a été copié en entier et réabonnez-vous.",
    "L'application de calendrier signale une erreur de consultation : le jeton a probablement été révoqué. Créez-en un nouveau et reconfigurez l'abonnement.",
    "Un lien est tombé entre de mauvaises mains : révoquez le jeton immédiatement — tous les abonnements liés sont morts sur-le-champ.",
  ],
} satisfies WikiArticleBody;

export default body;
