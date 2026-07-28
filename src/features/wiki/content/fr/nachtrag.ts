import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "nachtrag",
  locale: "fr",
  title: "Un avenant à un devis",
  summary: "Des prestations supplémentaires après l'accord — avec un accord distinct de la clientèle.",

  purpose:
    "Un avenant complète un devis déjà accepté. Il est soumis séparément à la clientèle et approuvé séparément.",

  whenToUse: [
    "Sur place, une prestation non prévue s'ajoute.",
    "La clientèle souhaite un ajout après son accord.",
    "L'ampleur augmente et il vous faut un accord écrit.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "Uniquement sur des devis acceptés",
      text: "Tant qu'un devis n'est pas accepté, modifiez-le par une nouvelle version. L'avenant suppose l'accord.",
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Créer un avenant",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez le devis accepté.",
        },
        {
          text: "Cliquez en haut sur « Créer un avenant ».",
          note: "Le bouton n'apparaît que sur les devis au statut « Accepté ».",
        },
        {
          text: "Vous arrivez sur la page de l'avenant.",
          note: "Le titre et le motif se saisissent là — rien ne vous est demandé à la création.",
        },
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/nachtrag-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La page de l'avenant avec le titre, le motif et les positions.",
      alt: "Formulaire d'avenant avec les champs Titre et Motif, une liste de positions comportant prestation, quantité, unité et prix unitaire, ainsi que les totaux en dessous.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 26, label: "Titre et motif — ce qui s'ajoute et pourquoi." },
        { n: 2, xPct: 45, yPct: 55, label: "Les positions supplémentaires." },
        { n: 3, xPct: 80, yPct: 78, label: "Sous-total, TVA et total." },
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Remplir et enregistrer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Indiquez sous « Titre » de quoi il s'agit.",
          note: "Par exemple « Transport de piano ». Sans titre, l'envoi est impossible.",
        },
        {
          text: "Décrivez sous « Motif » pourquoi la prestation s'ajoute.",
          note: "La clientèle le lit. Une phrase suffit.",
        },
        {
          text: "Ajoutez les prestations supplémentaires avec « Ajouter une position ».",
          note: "Au moins une position est nécessaire, sinon le bouton d'envoi reste grisé.",
        },
        {
          text: "Cliquez sur « Enregistrer ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "senden",
      text: "Transmettre à la clientèle",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Aucun e-mail n'est envoyé",
      text: "« Envoyer au client » ne fait que mettre l'avenant à disposition et le verrouiller. Vous devez transmettre le lien vous-même — contrairement au devis.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur « Envoyer au client » et confirmez.",
          note: "Ensuite l'avenant est verrouillé sur le fond, pour que la clientèle puisse relire ce qu'elle a reçu.",
        },
        {
          text: "Copiez le « Lien client » qui apparaît alors.",
          note: "Il ne s'affiche qu'après l'envoi.",
        },
        {
          text: "Envoyez le lien par votre canal habituel.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "Les statuts de l'avenant",
    },
    {
      kind: "statusTable",
      headers: { status: "Statut", meaning: "Signification", next: "Votre prochaine étape" },
      rows: [
        { status: "Brouillon", meaning: "En cours, invisible pour la clientèle.", next: "Terminer la saisie." },
        { status: "Envoyé", meaning: "Mis à disposition et verrouillé.", next: "Transmettre le lien." },
        { status: "Consulté", meaning: "La clientèle a ouvert le lien.", next: "Attendre la réponse." },
        { status: "Accepté", meaning: "Validé. Le mandat s'enrichit des positions.", next: "Planifier la prestation." },
        { status: "Refusé", meaning: "Refusé. Le mandat reste inchangé.", next: "Prendre contact." },
      ],
    },
    {
      kind: "heading",
      id: "danach",
      text: "Ce qui se passe à l'acceptation",
    },
    {
      kind: "paragraph",
      text: "Si la clientèle accepte, les positions sont ajoutées au mandat et les totaux augmentent. Le devis et l'avenant restent inchangés comme preuve.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Notez le lien",
      text: "Aucun chemin ne ramène du devis à l'avenant. Conservez le lien ou créez-vous un suivi tant que la page est ouverte.",
    },
  ],

  whatHappensNext: [
    "Après l'envoi, l'avenant est verrouillé et le lien client est visible.",
    "Si la clientèle ouvre le lien, le statut passe à « Consulté ».",
    "En cas d'accord, les positions et le total du mandat augmentent.",
    "En cas de refus, tout reste tel que convenu.",
  ],

  commonMistakes: [
    "S'attendre à ce qu'un e-mail parte. Le lien doit être transmis à la main.",
    "Créer l'avenant et quitter la page sans sauvegarder le lien. Il n'existe pas de chemin de retour.",
    "Chercher un avenant sur un devis pas encore accepté. Là, la nouvelle version est la bonne voie.",
  ],

  ifSomethingGoesWrong: [
    "« Envoyer au client » reste grisé : il manque le titre ou une position.",
    "Vous ne retrouvez pas l'avenant : il n'existe pas de vue d'ensemble. Conservez le lien ou demandez au support.",
    "Les champs ne se modifient plus : l'avenant est envoyé, donc verrouillé. Créez-en un second si nécessaire.",
  ],
} satisfies WikiArticleBody;

export default body;
