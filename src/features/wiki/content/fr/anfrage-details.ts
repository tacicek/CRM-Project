import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-details",
  locale: "fr",
  title: "Consulter et corriger une demande",
  summary: "Lire toutes les informations — et rectifier les champs mal reconnus.",

  purpose:
    "Les demandes viennent souvent d'un e-mail et sont analysées automatiquement. Avant de rédiger un devis, vérifiez les informations et corrigez ce qui ne joue pas.",

  whenToUse: [
    "Avant chaque devis, pour contrôler les informations.",
    "La clientèle appelle et donne une autre adresse.",
    "L'analyse automatique s'est trompée de langue.",
    "Un numéro de téléphone ou un code postal manque.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Deux fenêtres, deux usages",
      text: "« Détails » sert uniquement à lire et donne un aperçu rapide. « Modifier » ouvre le formulaire pour changer les valeurs.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/anfrage-details-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La fenêtre de détail avec le contact, les adresses et la description.",
      alt: "Fenêtre ouverte au-dessus de la liste des demandes montrant le nom de la clientèle, les coordonnées, les adresses de départ et d'arrivée, la date, les pièces et la surface ainsi que la description.",
    },
    {
      kind: "heading",
      id: "lesen",
      text: "Lire les informations",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Sur une carte de demande, cliquez sur « Détails ».",
          note: "La fenêtre se pose sur la liste. Rien ne se modifie ici.",
        },
        {
          text: "Lisez le contact, l'adresse, la date, les pièces, la surface et la description.",
          note: "La description contient souvent le texte d'origine de la clientèle.",
        },
        {
          text: "En bas, choisissez « Créer un devis » ou « Modifier ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Corriger les informations",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur « Modifier » — sur la carte ou dans la fenêtre de détail.",
        },
        {
          text: "Complétez en haut, sous « Contact », ce qui manque.",
          note: "Prénom, nom, e-mail, téléphone, date souhaitée et langue de la clientèle.",
        },
        {
          text: "Vérifiez en dessous les champs propres à la prestation.",
          note: "Pour un déménagement, par exemple l'adresse de départ et d'arrivée avec étage, ascenseur, pièces et surface.",
        },
        {
          text: "Cliquez sur « Enregistrer ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "La langue décide de ce que lit la clientèle",
      text: "« Langue du client » pilote le devis, le PDF et les e-mails — pas votre propre affichage. Si l'analyse automatique s'est trompée, corrigez ici avant d'envoyer le devis.",
    },
    {
      kind: "heading",
      id: "pruefungen",
      text: "Ce qui est vérifié à l'enregistrement",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Cause", next: "À faire" },
      rows: [
        { status: "E-mail invalide", meaning: "L'adresse n'a pas un format valable.", next: "Corriger l'adresse ou vider le champ." },
        { status: "Numéro de téléphone invalide", meaning: "Pas un numéro suisse valable.", next: "Saisir au format +41 79 123 45 67." },
        { status: "NPA invalide", meaning: "Un code postal n'a pas quatre chiffres.", next: "Saisir quatre chiffres." },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Ce qui ne se modifie pas ici",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Le type de prestation. Il est fixé à l'import et reste ensuite figé.",
        "L'étape de vente. Elle suit automatiquement dès qu'un devis naît ou part.",
        "La date de réception et la fiche client liée.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Mauvais type de prestation ?",
      text: "Recréez la demande — via « Nouvelle demande » et le texte de la clientèle — puis supprimez la fausse.",
    },
  ],

  whatHappensNext: [
    "Les corrections enregistrées apparaissent aussitôt sur la carte de demande.",
    "Le devis reprend exactement ces informations à sa création.",
    "La langue passe d'ici au devis, au PDF et aux e-mails.",
  ],

  commonMistakes: [
    "Ne corriger les informations que dans le devis. La demande garde alors ce qui est faux.",
    "Confondre « Langue du client » avec son propre affichage.",
    "Saisir un code postal avec le nom de la localité. Seuls les quatre chiffres y vont.",
  ],

  ifSomethingGoesWrong: [
    "« Enregistrer » ne réagit pas : une vérification bloque. Le message nomme le champ.",
    "Une information manque après l'enregistrement : vérifiez que vous avez saisi dans la bonne section — il y a plusieurs blocs d'adresse.",
    "Le type de prestation est faux : recréez la demande ; il ne se modifie pas.",
  ],
} satisfies WikiArticleBody;

export default body;
