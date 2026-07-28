import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-detail",
  locale: "fr",
  title: "Le devis en détail",
  summary: "Positions, historique, lien client et les actions selon le statut.",

  purpose:
    "La page de détail montre tout sur un devis : ce qu'il contient, ce que la clientèle en a fait et ce que vous pouvez entreprendre ensuite.",

  whenToUse: [
    "Vous voulez savoir si la clientèle a ouvert le devis.",
    "Vous avez besoin du lien pour la clientèle.",
    "Un devis a été accepté et vous voulez créer le mandat.",
    "Vous voulez vérifier le PDF avant d'envoyer.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/offerte-detail-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La page de détail avec les positions, les données du client, l'historique et le lien client.",
      alt: "Vue détaillée d'un devis. À gauche les positions avec sous-total, TVA et total ; à droite les données du client, la liste des activités et la zone contenant le lien client.",
      hotspots: [
        { n: 1, xPct: 45, yPct: 10, label: "Titre et statut du devis." },
        { n: 2, xPct: 44, yPct: 55, label: "Les positions avec le total." },
        { n: 3, xPct: 86, yPct: 48, label: "Activités — ce qui s'est passé et quand." },
        { n: 4, xPct: 86, yPct: 72, label: "Lien client à copier." },
      ],
    },
    {
      kind: "heading",
      id: "aktivitaeten",
      text: "Comment voir ce que le client a fait",
    },
    {
      kind: "paragraph",
      text: "La zone « Activités » à droite fait office de preuve. Elle se remplit d'elle-même, vous n'y saisissez rien.",
    },
    {
      kind: "statusTable",
      headers: { status: "Entrée", meaning: "Signification", next: "Votre prochaine étape" },
      rows: [
        { status: "Devis créé", meaning: "Vous avez établi le devis.", next: "—" },
        { status: "Envoyé par e-mail", meaning: "Le devis est parti à l'adresse indiquée.", next: "Attendre." },
        { status: "Consulté par le client", meaning: "La clientèle a ouvert le lien.", next: "Relancer après quelques jours." },
        { status: "Devis accepté", meaning: "Validé fermement.", next: "Planifier mandat et rendez-vous." },
        { status: "Devis refusé", meaning: "Décliné. Le motif figure sous « Note du client ».", next: "Consigner le motif de perte." },
      ],
    },
    {
      kind: "heading",
      id: "kundenlink",
      text: "Transmettre le lien client",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez à droite, sous « Lien client », sur « Copier ».",
          note: "Le lien se trouve alors dans le presse-papiers. Il n'est pas affiché.",
        },
        {
          text: "Collez-le là où vous échangez avec la clientèle.",
          note: "L'icône à côté ouvre la vue client dans un nouvel onglet — utile pour vérifier.",
        },
      ],
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Quel bouton apparaît quand",
    },
    {
      kind: "statusTable",
      headers: { status: "Bouton", meaning: "Visible si", next: "Ce qu'il fait" },
      rows: [
        { status: "Télécharger le PDF", meaning: "toujours", next: "Télécharge le devis en PDF." },
        { status: "Aperçu et envoi", meaning: "seulement en « Brouillon »", next: "Montre le PDF et l'envoie." },
        { status: "Nouvelle version", meaning: "envoyé, pas encore accepté", next: "Crée une nouvelle mouture." },
        { status: "Créer un avenant", meaning: "seulement en « Accepté »", next: "Complète un devis validé." },
        { status: "Afficher / créer le mandat", meaning: "seulement en « Accepté »", next: "Mène au mandat." },
        { status: "Supprimer le devis", meaning: "tout sauf « Accepté »", next: "Retire le devis." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« Renvoyer » ne se trouve pas ici",
      text: "La page de détail ne le propose pas. Utilisez le menu à trois points dans la liste des devis.",
    },
    {
      kind: "heading",
      id: "vorschau",
      text: "Aperçu et envoi",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Sur un brouillon, cliquez sur « Aperçu et envoi ».",
          note: "Le vrai PDF s'ouvre, page par page.",
        },
        {
          text: "Vérifiez les positions, les prix et la langue.",
        },
        {
          text: "Cliquez sur « Envoyer le devis ».",
          note: "L'e-mail ne part qu'à ce moment et le statut passe à « Envoyé ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "auftrag",
      text: "De l'offre au mandat",
    },
    {
      kind: "paragraph",
      text: "Si la clientèle accepte via le lien, le mandat se crée généralement tout seul. C'est pourquoi le bouton indique alors « Afficher le mandat » plutôt que « Créer un mandat ».",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Un devis accepté ne peut pas être supprimé",
      text: "Il est rattaché à un mandat. La tentative est refusée par un message — ce n'est pas une panne, c'est voulu.",
    },
  ],

  whatHappensNext: [
    "Après l'envoi, « Envoyé par e-mail » apparaît dans les activités.",
    "Si la clientèle ouvre le lien, « Consulté par le client » s'ajoute.",
    "En cas d'acceptation apparaissent « Devis accepté », un mandat et la mention « CGV acceptées ».",
  ],

  commonMistakes: [
    "Recopier le lien client depuis la barre d'adresse. Utilisez « Copier ».",
    "Chercher « Renvoyer » sur la page de détail. Cela ne figure que dans la liste.",
    "Vouloir modifier un devis envoyé. Pour cela il y a « Nouvelle version ».",
  ],

  ifSomethingGoesWrong: [
    "« Impossible de charger les données » pour le PDF : le devis contient des informations incomplètes, par exemple dans les suppléments. Ouvrez-le en modification et vérifiez les champs.",
    "« Suppression impossible » : le devis est accepté et lié à un mandat.",
    "Les activités n'indiquent pas « Consulté » : la clientèle n'a pas encore ouvert le lien. Une pièce jointe PDF seule ne le déclenche pas.",
  ],
} satisfies WikiArticleBody;

export default body;
