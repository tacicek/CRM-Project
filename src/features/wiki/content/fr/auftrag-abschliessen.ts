import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "auftrag-abschliessen",
  locale: "fr",
  title: "Planifier et clôturer un mandat",
  summary: "Attribuer l'équipe, fixer le prix, clôturer — puis facturer.",

  purpose:
    "Un mandat naît d'un devis accepté. Vous fixez la date, l'équipe et le mode de prix, puis vous le clôturez une fois le travail fait.",

  whenToUse: [
    "Un devis a été accepté et le travail doit être planifié.",
    "Vous voulez désigner un chef d'équipe.",
    "L'intervention est terminée et les heures doivent être saisies.",
    "Vous travaillez à l'heure et il vous faut le prix final.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Un mandat exige un devis accepté",
      text: "« Nouveau mandat » affiche d'abord la liste des devis acceptés. Sans devis, un nouveau mandat ne peut pas être enregistré.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/auftrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La fenêtre du mandat avec la sélection des devis acceptés.",
      alt: "Fenêtre pour un nouveau mandat avec la liste des devis approuvés à partir desquels un mandat peut être créé.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Créer un mandat",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez le devis accepté et cliquez sur « Créer un mandat ».",
          note: "Ou via « Nouveau mandat » dans la liste, puis choix du devis.",
        },
        {
          text: "Vérifiez le « Titre » et les « Données du client ».",
          note: "Le titre, le nom et la date sont obligatoires.",
        },
        {
          text: "Indiquez sous « Date » et « Heure » l'intervention et choisissez la « Durée estimée ».",
          note: "Une date passée est refusée pour un nouveau mandat.",
        },
        {
          text: "Cliquez sur « Créer le mandat ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "preis",
      text: "Choisir le mode de prix",
    },
    {
      kind: "statusTable",
      headers: { status: "Type de prix", meaning: "Signification", next: "À la clôture" },
      rows: [
        { status: "Prix fixe", meaning: "Montant fixe repris du devis.", next: "Rien à calculer." },
        { status: "Selon dépense", meaning: "Facturation aux heures.", next: "Vous saisissez les heures." },
        { status: "Devis estimatif", meaning: "Estimation, montant final comme au devis.", next: "Rien à calculer." },
      ],
    },
    {
      kind: "heading",
      id: "team",
      text: "Attribuer l'équipe",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Choisissez sous « Chef d'équipe » la personne responsable.",
          note: "Seules les personnes ayant une adresse e-mail apparaissent ici — ce sont elles qui reçoivent le rappel.",
        },
        {
          text: "Réglez combien de temps à l'avance le rappel doit partir.",
          note: "Un jour, deux jours, trois jours ou une semaine avant.",
        },
        {
          text: "Cochez sous « Autres membres de l'équipe » toutes les personnes qui participent.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Véhicules et matériel se trouvent dans le calendrier",
      text: "Dans le mandat vous ne choisissez que des personnes. Les véhicules et l'équipement s'attribuent sur le rendez-vous, dans le calendrier.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Les « prestations supplémentaires » ne changent pas le total",
      text: "Ce que vous saisissez là est conservé, mais n'entre pas dans le sous-total, la TVA ni le total. Le montant vient du devis.",
    },
    {
      kind: "heading",
      id: "abschliessen",
      text: "Clôturer le mandat",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Dans la liste, ouvrez le menu à trois points et choisissez « Clôturer … ».",
          note: "Dans la fenêtre de modification, « Clôturé » n'est délibérément pas proposé comme statut.",
        },
        {
          text: "Pour « Selon dépense » : saisissez les heures réellement effectuées.",
          note: "Le prix final se calcule aussitôt en dessous. Sans les heures, la clôture est impossible.",
        },
        {
          text: "Complétez au besoin les notes de clôture.",
          note: "Par exemple des particularités de l'intervention.",
        },
        {
          text: "Cliquez sur « Clôturer ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "danger",
      title: "« Clôturé » est un terminus",
      text: "Aucun changement de statut n'en repart. Ne clôturez que lorsque le travail est vraiment fini et la dépense connue.",
    },
    {
      kind: "heading",
      id: "abrechnen",
      text: "Facturer ensuite",
    },
    {
      kind: "paragraph",
      text: "La clôture ne crée pas de facture. Ce n'est qu'après qu'apparaît « Créer une facture » dans le menu, menant à un brouillon prérempli.",
    },
  ],

  whatHappensNext: [
    "À la création, un rendez-vous correspondant naît automatiquement dans le calendrier.",
    "Si vous changez la date ou l'heure du mandat, le rendez-vous suit.",
    "Après la clôture, le prix final est fixé et « Créer une facture » se débloque.",
    "Si le rendez-vous lié est annulé, le mandat passe en « Annulé ».",
  ],

  commonMistakes: [
    "Saisir ici des prestations supplémentaires en attendant que le total monte. Il ne bouge pas.",
    "Clôturer avant de connaître les heures. Il n'y a pas de retour.",
    "Chercher un chef d'équipe qui n'apparaît pas. Sans adresse e-mail, il n'est pas proposé.",
  ],

  ifSomethingGoesWrong: [
    "« Veuillez remplir tous les champs obligatoires » : le titre, le nom ou la date manquent.",
    "« Date dans le passé » : ce n'est pas permis pour un nouveau mandat. Choisissez une date future.",
    "« Heures requises » : pour une clôture selon dépense, les heures effectuées sont obligatoires.",
  ],
} satisfies WikiArticleBody;

export default body;
