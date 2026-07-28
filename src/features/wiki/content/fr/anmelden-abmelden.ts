import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anmelden-abmelden",
  locale: "fr",
  title: "Se connecter et se déconnecter",
  summary: "Comment vous connecter, réinitialiser un mot de passe oublié et vous déconnecter en sécurité.",

  purpose:
    "Vous vous connectez avec votre adresse e-mail et votre mot de passe. Ensuite, vous ne voyez que les données de votre entreprise.",

  whenToUse: [
    "Vous commencez votre journée de travail.",
    "Vous avez oublié votre mot de passe.",
    "Vous travaillez sur un ordinateur qui n'est pas le vôtre et voulez vous déconnecter après.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "anmelden",
      text: "Se connecter",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/anmeldung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La page de connexion. Elle est en allemand pour tout le monde, même si votre programme est en français.",
      alt: "Page de connexion avec un champ pour l'adresse e-mail intitulé E-Mail, un champ pour le mot de passe intitulé Passwort, le lien Passwort vergessen et le bouton Anmelden.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Saisissez votre adresse e-mail dans le champ « E-Mail »." },
        {
          text: "Saisissez votre mot de passe dans le champ « Passwort ».",
          note: "L'icône en forme d'œil au bout du champ rend le mot de passe visible pour le vérifier.",
        },
        {
          text: "Cliquez sur « Anmelden ».",
          note: "Vous arrivez sur la vue d'ensemble. Le nom de votre entreprise s'affiche en haut à gauche.",
        },
      ],
    },
    {
      kind: "heading",
      id: "passwort-vergessen",
      text: "Mot de passe oublié",
    },
    {
      kind: "steps",
      steps: [
        { text: "Sur la page de connexion, cliquez sur « Passwort vergessen »." },
        { text: "Saisissez votre adresse e-mail et cliquez sur « Reset-Link senden »." },
        {
          text: "Ouvrez l'e-mail et suivez le lien.",
          note: "Le lien mène à une page où vous choisissez un nouveau mot de passe.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Pas d'e-mail reçu ?",
      text: "Regardez dans le dossier des indésirables. Vérifiez aussi que l'adresse est correctement écrite.",
    },
    {
      kind: "heading",
      id: "abmelden",
      text: "Se déconnecter",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur votre nom en haut à droite.",
          note: "Un petit menu s'ouvre avec votre adresse e-mail et votre rôle.",
        },
        { text: "Cliquez sur « Se déconnecter »." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Toujours se déconnecter sur un appareil partagé",
      text: "Sans déconnexion, la session reste ouverte dans le navigateur. La personne suivante verrait les données de votre entreprise.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Messages lors de la connexion",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Signification", next: "Votre prochaine étape" },
      rows: [
        {
          status: "E-Mail oder Passwort ist falsch.",
          meaning: "L'adresse et le mot de passe ne correspondent pas.",
          next: "Ressaisissez le mot de passe en le rendant visible.",
        },
        {
          status: "Aucune entreprise trouvée",
          meaning: "Votre accès n'est encore rattaché à aucune entreprise.",
          next: "Contactez la personne qui a créé votre accès.",
        },
        {
          status: "Entreprise pas encore vérifiée",
          meaning: "L'entreprise existe mais n'est pas encore activée.",
          next: "Attendez l'activation. Vous ne pouvez pas encore travailler.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Après la connexion, vous êtes sur la vue d'ensemble.",
    "Le programme retient la connexion dans ce navigateur jusqu'à ce que vous vous déconnectiez.",
    "Votre rôle est indiqué dans le menu en haut à droite, sous votre adresse e-mail.",
  ],

  commonMistakes: [
    "Un espace au début ou à la fin de l'adresse e-mail. Le champ l'accepte, la connexion échoue.",
    "Demander plusieurs liens de réinitialisation puis utiliser le plus ancien. Seul le dernier e-mail est valable.",
    "Sur un ordinateur partagé, fermer seulement l'onglet au lieu de se déconnecter.",
  ],

  ifSomethingGoesWrong: [
    "La connexion échoue plusieurs fois : redéfinissez le mot de passe via « Passwort vergessen ».",
    "Après la connexion, « Aucune entreprise trouvée » s'affiche : votre accès n'est pas encore rattaché. Vous ne pouvez pas le corriger vous-même.",
    "La page reste blanche : rechargez-la. Si cela ne suffit pas, vérifiez votre connexion Internet.",
  ],
} satisfies WikiArticleBody;

export default body;
