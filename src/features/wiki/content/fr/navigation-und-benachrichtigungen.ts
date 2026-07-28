import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "navigation-und-benachrichtigungen",
  locale: "fr",
  title: "Menu, barre du haut et notifications",
  summary: "Comment vous déplacer dans le programme et où voir les nouveautés.",

  purpose:
    "Le programme a deux éléments fixes : le menu à gauche et la barre en haut. Les deux sont identiques sur chaque page.",

  whenToUse: [
    "Vous cherchez une entrée de menu sans la trouver.",
    "Un chiffre apparaît à côté d'une entrée et vous voulez savoir ce qu'il signifie.",
    "Vous voulez activer ou désactiver les sons et les rappels.",
    "Vous travaillez sur téléphone et ne voyez pas le menu.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "seitenleiste",
      text: "Le menu latéral",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/seitenleiste-v1.webp",
      width: 240,
      height: 1165,
      caption: "Le menu latéral, divisé en accès rapide et trois groupes.",
      alt: "Menu latéral avec le nom de l'entreprise en haut, puis Vue d'ensemble, Demandes, Boîte e-mail, Devis et Calendrier, puis les groupes Espace principal, Exploitation et Administration, chacun avec une icône et un texte.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 4, label: "Le nom de votre entreprise. En dessous, la recherche." },
        { n: 2, xPct: 50, yPct: 15, label: "Accès rapide : les cinq pages les plus utilisées." },
        { n: 3, xPct: 50, yPct: 40, label: "Espace principal : clientèle, argent et travail en cours." },
        { n: 4, xPct: 50, yPct: 87, label: "Administration : prestations, tarifs, archives, paramètres et cette aide." },
      ],
    },
    {
      kind: "paragraph",
      text: "Chaque entrée a une icône et un texte. Le texte est ce qui compte, l'icône aide seulement à reconnaître.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Les chiffres à côté d'une entrée",
      text: "Un chiffre à droite d'une entrée indique combien d'éléments vous attendent. Il apparaît pour « Boîte e-mail », « Visites » et « Cartons de déménagement ».",
    },
    {
      kind: "heading",
      id: "kopfzeile",
      text: "La barre du haut",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kopfzeile-v1.webp",
      width: 1200,
      height: 56,
      caption: "La barre du haut avec le nom de la page, la cloche, le choix de langue, l'aide et le menu utilisateur.",
      alt: "Bandeau étroit en haut de l'écran. À gauche le nom de l'entreprise et celui de la page en cours. À droite une cloche avec un compteur, le choix de langue, le bouton Aide et mode d'emploi et le menu utilisateur.",
      hotspots: [
        { n: 1, xPct: 18, yPct: 50, label: "Nom de l'entreprise et page en cours." },
        { n: 2, xPct: 67, yPct: 50, label: "Cloche : nouveaux rappels, avec leur nombre." },
        { n: 3, xPct: 72, yPct: 50, label: "Langue de l'interface." },
        { n: 4, xPct: 80, yPct: 50, label: "Aide sur la page en cours." },
        { n: 5, xPct: 92, yPct: 50, label: "Votre compte, les sons et la déconnexion." },
      ],
    },
    {
      kind: "heading",
      id: "benachrichtigungen",
      text: "Notifications",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur la cloche dans la barre du haut.",
          note: "Le chiffre sur la cloche indique combien de rappels vous n'avez pas encore lus.",
        },
        {
          text: "Cliquez sur un rappel pour aller à la page correspondante.",
          note: "Un rappel de rendez-vous mène au calendrier, un rappel de devis mène au devis.",
        },
        {
          text: "« Tout lu » remet le compteur à zéro.",
          note: "Les rappels restent dans la liste ; seul le compteur passe à zéro.",
        },
      ],
    },
    {
      kind: "heading",
      id: "toene",
      text: "Sons et rappels à l'écran",
    },
    {
      kind: "steps",
      steps: [
        { text: "Cliquez sur votre nom en haut à droite." },
        {
          text: "Activez ou désactivez « Son activé ».",
          note: "À droite s'affiche « Activé » ou « Désactivé ». Le son se déclenche aux nouvelles demandes et aux changements de rendez-vous.",
        },
        {
          text: "Activez « Push activé » pour recevoir des rappels hors de la fenêtre du navigateur.",
          note: "Le navigateur demande l'autorisation une fois. Répondez « Autoriser ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« Notif. bloquées »",
      text: "Si ce texte apparaît, le navigateur a bloqué les rappels. Cela se change uniquement dans les réglages du navigateur, pas ici.",
    },
    {
      kind: "heading",
      id: "am-handy",
      text: "Sur le téléphone",
    },
    {
      kind: "paragraph",
      text: "Sur un écran étroit, la barre latérale n'existe pas. Une barre en bas de l'écran la remplace, avec les cinq destinations principales. Le dernier bouton s'appelle « Plus » et ouvre toutes les autres sections.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Touchez en bas Aperçu, Demandes, Offres ou Calendrier pour y aller." },
        {
          text: "Pour tout le reste, touchez « Plus » en bas à droite.",
          note: "Vous y trouvez les clients, les finances, les mandats, les factures et l'administration — les mêmes entrées que dans la barre latérale sur ordinateur.",
        },
        { text: "Pour fermer, faites glisser la fenêtre vers le bas ou touchez à côté." },
        {
          text: "En haut à gauche, la loupe sert à chercher.",
          note: "Elle parcourt les mêmes destinations que le champ de recherche sur ordinateur.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Le bouton rond en bas à droite",
      text: "Il crée une nouvelle demande. Il flotte au-dessus de la liste et reste toujours visible.",
    },
    {
      kind: "heading",
      id: "erscheinungsbild",
      text: "Apparence claire et sombre",
    },
    {
      kind: "paragraph",
      text: "Vous pouvez choisir entre un affichage clair et un affichage sombre. Ce réglage ne concerne que votre propre vue du programme — les offres, les factures et les courriels envoyés à vos clients restent inchangés.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Sur ordinateur : touchez votre nom en haut à droite, puis choisissez sous « Apparence »." },
        { text: "Sur téléphone : « Plus » en bas, puis « Apparence » tout en bas." },
        {
          text: "« Comme le système » reprend le réglage de votre appareil.",
          note: "Si votre téléphone passe au sombre le soir, le programme suit.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Le chiffre sur la cloche baisse dès que vous marquez les rappels comme lus.",
    "Les chiffres à côté des entrées baissent dès que vous traitez les éléments concernés.",
    "Votre réglage du son et des rappels vaut pour ce navigateur, pas pour votre compte en général.",
  ],

  commonMistakes: [
    "Confondre les chiffres du menu avec les notifications. Le menu compte les éléments ouverts, la cloche compte les rappels non lus.",
    "Choisir « Tout supprimer » au lieu de « Tout lu ». La suppression retire les rappels de la liste.",
    "S'attendre à retrouver le même réglage de son sur chaque appareil. Il vaut par navigateur.",
  ],

  ifSomethingGoesWrong: [
    "Une entrée de menu manque : elle peut être désactivée pour cette entreprise. Demandez à la personne qui gère les paramètres.",
    "Aucun son : vérifiez dans le menu utilisateur que « Son activé » est réglé, ainsi que le volume de l'appareil.",
    "La cloche affiche un chiffre mais la liste est vide : rechargez la page.",
  ],
} satisfies WikiArticleBody;

export default body;
