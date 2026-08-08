import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "fr",
  title: "La fiche client",
  summary:
    "Tout sur un client : contact, adresse, dossiers, montants, historique, lieux d’intervention et accès au portail.",

  purpose:
    "La fiche client répond en dix secondes : qui est-ce ? comment le joindre ? où habite-t-il ? où travaille-t-on ? qu’est-ce qui vient ensuite ? y a-t-il quelque chose en suspens ? que s’est-il passé en dernier ?",

  whenToUse: [
    "Le client appelle et vous avez besoin de la situation en dix secondes.",
    "Vous avez besoin de l’adresse ou des indications d’accès à un objet.",
    "Vous souhaitez corriger le nom, le téléphone, l’e-mail ou la langue.",
    "Vous soupçonnez un doublon.",
    "Vous souhaitez donner un accès au portail au client.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La fiche client : en-tête avec actions rapides, bande d’attention, cinq onglets.",
      alt: "Fiche client avec le nom en haut, en dessous les boutons Modifier, Appeler, E-mail et Offre, une carte pour le prochain rendez-vous, les onglets Aperçu, Historique, Dossiers, Finances et Lieux, ainsi que les blocs Contact, Activité, Dossiers et Finances.",
      hotspots: [
        { n: 1, xPct: 40, yPct: 23, label: "Actions rapides. N’apparaît que ce qui existe réellement." },
        { n: 2, xPct: 31, yPct: 31, label: "Bande d’attention : prochaine tâche, prochain rendez-vous avec l’heure, montant ouvert." },
        { n: 3, xPct: 33, yPct: 39, label: "Les cinq onglets de la fiche." },
        { n: 4, xPct: 26, yPct: 66, label: "Sans adresse, c’est l’action qui figure ici, pas un tiret." },
        { n: 5, xPct: 78, yPct: 74, label: "Facturé, payé et ouvert — en retard serait encadré en rouge." },
      ],
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "La structure",
    },
    {
      kind: "paragraph",
      text: "Tout en haut figurent le nom, le type (particulier ou entreprise), le statut et le numéro de client — à côté, les boutons Appeler, E-mail, Copier l’adresse et Carte. Seuls apparaissent les boutons pour lesquels une donnée existe.",
    },
    {
      kind: "paragraph",
      text: "En dessous se trouve la bande d’attention : la prochaine tâche, le prochain rendez-vous avec l’heure, le montant ouvert et les dossiers ouverts. Ce qui est en retard apparaît encadré en rouge avec la mention « en retard ». Si rien n’y figure, rien n’est en suspens.",
    },
    {
      kind: "statusTable",
      headers: { status: "Onglet", meaning: "Ce qu’il contient", next: "À quoi il sert" },
      rows: [
        { status: "Aperçu", meaning: "Contact, adresse, activité, compteurs, montants, accès au portail.", next: "Le coup d’œil en dix secondes." },
        { status: "Historique", meaning: "Tous les événements par ordre chronologique, filtrables.", next: "« Que s’est-il passé ? »" },
        { status: "Dossiers", meaning: "Offres, mandats, factures, quittances et rendez-vous sous forme de listes.", next: "« Quelle offre était-ce ? »" },
        { status: "Finances", meaning: "Facturé, payé, ouvert — et les documents correspondants.", next: "« Reste-t-il quelque chose ? »" },
        { status: "Lieux", meaning: "Adresse, adresse de facturation et lieux d’intervention.", next: "« Où allons-nous ? »" },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Modifier les données de base",
    },
    {
      kind: "paragraph",
      text: "Le nom, l’entreprise, la civilité, le téléphone, l’e-mail, la langue, le statut, le numéro de client et la note se modifient via « Modifier » en haut à droite.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Cliquez sur « Modifier » en haut." },
        {
          text: "Modifiez les champs. Le nom affiché suit normalement le nom.",
          note: "Si vous voulez un nom propre comme « Famille Müller », activez « Nom affiché personnalisé » — il restera tel quel, même si le nom de famille change.",
        },
        {
          text: "Cliquez sur « Enregistrer ».",
          note: "Si l’enregistrement échoue, le formulaire reste ouvert avec vos saisies. Rien n’est perdu.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Les anciens documents ne changent pas",
      text: "Une adresse ou un e-mail corrigé vaut à partir de maintenant. Les offres, mandats et factures déjà établis conservent l’état qu’ils avaient à leur création — c’est voulu.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Numéro de téléphone avec indicatif",
      text: "Écrivez « 079 123 45 67 » ou « +41 79 123 45 67 ». Un numéro sans 0 ou +41 au début ne peut pas être rattaché — la prochaine demande de la même personne créera alors une deuxième fiche. Le formulaire vous prévient à l’avance.",
    },
    {
      kind: "heading",
      id: "adressen",
      text: "Adresse et lieux d’intervention",
    },
    {
      kind: "paragraph",
      text: "L’onglet « Lieux » contient deux choses différentes, et la distinction compte : l’adresse est l’endroit où le client habite et où va la facture. Un lieu d’intervention est l’endroit où l’on travaille — départ, arrivée, objet à nettoyer ou entrepôt.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Pourquoi l’adresse est vide au début",
      text: "Les adresses issues des demandes sont des lieux d’intervention, pas une adresse postale. Lors d’un déménagement, l’adresse de départ est précisément celle où la personne n’habite plus — elle n’est donc pas reprise comme domicile. Saisissez l’adresse vous-même via « Ajouter une adresse ».",
    },
    {
      kind: "steps",
      steps: [
        { text: "Passez à l’onglet « Lieux » en haut." },
        {
          text: "Cliquez sur « Ajouter une adresse » et saisissez l’adresse.",
          note: "Les suggestions aident mais ne sont pas obligatoires : « c/o Meier, bâtiment arrière à gauche » passe tout aussi bien.",
        },
        {
          text: "Choisissez « Adresse de correspondance » ou « Adresse de facturation ».",
          note: "Sans adresse de facturation propre, les factures vont à l’adresse de correspondance. Par type, une seule adresse est l’adresse principale.",
        },
        {
          text: "Sous « Lieux d’intervention », complétez l’étage, l’ascenseur, le stationnement et l’accès.",
          note: "Cela évite de redemander lors du deuxième mandat au même objet. Les lieux naissent aussi automatiquement des mandats.",
        },
      ],
    },
    {
      kind: "heading",
      id: "betraege",
      text: "Comprendre les montants",
    },
    {
      kind: "statusTable",
      headers: { status: "Ligne", meaning: "Ce qu’elle contient", next: "Attention" },
      rows: [
        { status: "Facturé", meaning: "Somme de toutes les factures établies, hors brouillons.", next: "—" },
        { status: "Payé", meaning: "Somme de tous les encaissements enregistrés.", next: "Les annulations sont déjà déduites." },
        { status: "Ouvert", meaning: "Ce qui reste dû sur les factures établies.", next: "—" },
        { status: "Dont quittances", meaning: "La part de « Payé » qui est arrivée par quittance.", next: "Une part, pas un second montant." },
        { status: "Notes de crédit", meaning: "Somme des notes de crédit envoyées.", next: "—" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ne pas additionner « Dont quittances »",
      text: "Cette ligne est un extrait de « Payé ». Les additionner revient à compter le même argent deux fois.",
    },
    {
      kind: "heading",
      id: "verlauf",
      text: "L’historique",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Passez à l’onglet « Historique » en haut.",
          note: "Vous voyez demandes, offres, mandats, rendez-vous, factures, quittances et e-mails par ordre chronologique — avec date et heure.",
        },
        {
          text: "Restreignez avec les filtres : Tous, Offres, Mandats, Finances, Contact.",
        },
        {
          text: "Cliquez sur une ligne pour ouvrir le document.",
          note: "Offres, factures et quittances s’ouvrent. Demandes, mandats, rendez-vous et e-mails n’ont pas d’écran dédié — ces lignes ne sont donc pas cliquables.",
        },
        {
          text: "Cliquez en bas sur « Charger plus » si la liste continue.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "« Dernière action » est toujours du passé",
      text: "Un rendez-vous la semaine prochaine ne compte pas comme dernière action — il figure sous « Prochain rendez-vous ». Ainsi « Dernière action il y a 4 mois » signifie vraiment que rien ne s’est passé depuis.",
    },
    {
      kind: "heading",
      id: "dubletten",
      text: "Fusionner les doublons",
    },
    {
      kind: "paragraph",
      text: "Si deux fiches partagent un numéro de téléphone, l’avis « Peut-être la même personne » apparaît en haut.",
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Propriétaire et administrateur uniquement",
      text: "Tout le monde peut vérifier. Seuls le propriétaire et l’administrateur peuvent fusionner. En tant que collaborateur, vous ne voyez pas le bouton.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La fusion est irréversible",
      text: "Deux fiches n’en font plus qu’une. Vérifiez l’e-mail et le numéro de téléphone avant de confirmer — un nom identique ne suffit pas.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Cliquez sur « Vérifier » dans l’avis." },
        {
          text: "Comparez les deux colonnes « Sera conservé » et « Sera fusionné ».",
          note: "Avec « Inverser le sens », vous choisissez quelle fiche est conservée.",
        },
        {
          text: "Lisez la ligne « Reste sur la cible, sera perdu » si elle apparaît.",
          note: "Elle indique quelles données disparaissent.",
        },
        {
          text: "Pour confirmer, saisissez le nom de la fiche qui sera fusionnée.",
          note: "Ce n’est qu’alors que « Fusionner » devient cliquable. C’est la protection contre un clic malheureux.",
        },
      ],
    },
    {
      kind: "heading",
      id: "portal",
      text: "Accès au portail",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur « Créer un accès ».",
          note: "Un lien valable une seule fois est créé.",
        },
        {
          text: "Cliquez sur « Copier le lien » et envoyez-le au client par votre canal habituel.",
          note: "Le lien n’est affiché que maintenant. Si vous quittez la page, il est perdu — créez-en simplement un nouveau.",
        },
        {
          text: "Avec « Révoquer l’accès », vous mettez fin aux sessions en cours.",
        },
      ],
    },
    {
      kind: "paragraph",
      text: "Si le client modifie ses données dans le portail, la section « Demandes de modification ouvertes » apparaît ici. Vous décidez avec « Accepter » ou « Refuser ».",
    },
  ],

  whatHappensNext: [
    "Les données enregistrées sont immédiatement visibles pour toute l’équipe.",
    "Les offres, mandats et factures déjà établis restent inchangés.",
    "Après la fusion, vous arrivez sur la fiche conservée — avec les paiements, dossiers, tâches, adresses et lieux d’intervention de l’autre.",
    "Une demande de modification acceptée inscrit les données du client dans la fiche.",
  ],

  commonMistakes: [
    "Additionner « Facturé » et « Payé ». L’un est établi, l’autre encaissé.",
    "Traiter l’adresse de départ d’une demande comme domicile. Dans la liste, la mention « Dernier lieu d’intervention » précède donc l’adresse tant qu’aucune adresse n’est saisie.",
    "Saisir un numéro de téléphone sans indicatif.",
    "Fusionner parce que deux personnes portent le même nom. Vérifiez toujours l’e-mail et le téléphone.",
    "Vouloir copier le lien du portail plus tard. Il n’est affiché qu’une seule fois.",
  ],

  ifSomethingGoesWrong: [
    "« Fusionner » manque : votre rôle ne le permet pas. Demandez au propriétaire ou à l’administrateur.",
    "« Fusion arrêtée » : les deux fiches entrent en conflit au même endroit. Rien n’a été modifié ; le message indique où. Résolvez-le là-bas puis réessayez.",
    "Une section affiche un cadre rouge au lieu de chiffres : les données n’ont pas pu être chargées. Cliquez sur « Réessayer ». Les montants ne sont volontairement pas à 0.00 — 0.00 serait une affirmation que personne n’a vérifiée.",
    "Vous avez perdu le lien du portail : créez-en simplement un nouveau. L’ancien n’y perd rien en sécurité.",
    "Un montant semble faux : ouvrez « Finances » et vérifiez les paiements enregistrés — la fiche ne fait qu’additionner.",
  ],
} satisfies WikiArticleBody;

export default body;
