import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kundenkarte",
  locale: "fr",
  title: "La fiche client",
  summary: "Tout sur une cliente : contact, dossiers, montants, historique et accès au portail.",

  purpose:
    "La fiche client réunit tout ce qui concerne une personne ou une entreprise. Elle répond à la question « que s'est-il passé jusqu'ici ? » sans chercher dans plusieurs listes.",

  whenToUse: [
    "La clientèle appelle et il vous faut la situation en dix secondes.",
    "Vous voulez savoir combien quelqu'un a déjà payé au total.",
    "Vous soupçonnez une fiche en double.",
    "Vous voulez donner un accès au portail à la clientèle.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kundenkarte-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La fiche client avec le contact, les dossiers et les montants.",
      alt: "Fiche client avec le nom en haut, à gauche une carte pour les coordonnées et les notes, à droite des compteurs pour les demandes, devis et mandats ainsi qu'un récapitulatif des montants.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 33, label: "Coordonnées. Seule la note se modifie ici." },
        { n: 2, xPct: 75, yPct: 30, label: "Dossiers : combien de demandes, devis, mandats et documents." },
        { n: 3, xPct: 75, yPct: 60, label: "Finances : facturé, payé et ouvert." },
      ],
    },
    {
      kind: "heading",
      id: "kontakt",
      text: "Contact et note",
    },
    {
      kind: "paragraph",
      text: "À gauche figurent l'e-mail, le téléphone, la langue, le numéro de client et l'origine. Ces champs sont ici en lecture seule.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Écrivez dans le champ « Notes » ce que l'équipe doit savoir.",
          note: "Par exemple : « Préfère être appelé après 17 h. » La clientèle ne voit jamais cette note.",
        },
        {
          text: "Cliquez sur « Enregistrer les modifications ».",
          note: "Le bouton n'apparaît qu'une fois que vous avez tapé quelque chose.",
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
      headers: { status: "Ligne", meaning: "Ce qu'elle contient", next: "Attention" },
      rows: [
        { status: "Facturé", meaning: "Somme de toutes les factures émises, brouillons exclus.", next: "—" },
        { status: "Payé", meaning: "Somme de tous les paiements saisis.", next: "Les annulations sont déjà déduites." },
        { status: "Ouvert", meaning: "Ce qui reste dû sur les factures émises.", next: "—" },
        { status: "Dont reçus", meaning: "La part de « Payé » venue de reçus.", next: "Une part, pas un second montant." },
        { status: "Notes de crédit", meaning: "Somme des notes de crédit envoyées.", next: "—" },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ne pas additionner « Dont reçus »",
      text: "Cette ligne est un extrait de « Payé ». Les additionner revient à compter le même argent deux fois.",
    },
    {
      kind: "heading",
      id: "verlauf",
      text: "L'historique",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Passez en haut sur « Historique ».",
          note: "Vous voyez demandes, devis, mandats, rendez-vous, factures, reçus et e-mails dans l'ordre chronologique.",
        },
        {
          text: "Cliquez en bas sur « Charger plus » si la liste continue.",
        },
      ],
    },
    {
      kind: "heading",
      id: "dubletten",
      text: "Fusionner des fiches en double",
    },
    {
      kind: "paragraph",
      text: "Si deux fiches partagent un numéro de téléphone, l'avertissement « Peut-être la même personne » apparaît en haut.",
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Propriétaire et admin uniquement",
      text: "Tout le monde peut vérifier. Seuls le propriétaire et les admins peuvent fusionner. En tant que collaborateur, le bouton ne vous est pas affiché.",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "La fusion est irréversible",
      text: "Deux fiches n'en font plus qu'une. Vérifiez l'e-mail et le numéro de téléphone avant de confirmer — le même nom ne suffit pas.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Dans l'avertissement, cliquez sur « Vérifier »." },
        {
          text: "Comparez les deux colonnes « Reste en place » et « Sera fusionné ».",
          note: "« Inverser le sens » échange la fiche qui subsiste.",
        },
        {
          text: "Lisez la ligne « Reste sur la cible, sera perdu » si elle apparaît.",
          note: "Elle indique quelles informations disparaissent.",
        },
        {
          text: "Pour confirmer, retapez le nom de la fiche qui sera fusionnée.",
          note: "Ce n'est qu'alors que « Fusionner » devient actif. C'est la sécurité contre un clic malheureux.",
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
          note: "Un lien valable une seule fois est généré.",
        },
        {
          text: "Cliquez sur « Copier le lien » et envoyez-le à la clientèle par votre canal habituel.",
          note: "Le lien n'est affiché que maintenant. Si vous quittez la page, il est perdu — créez-en simplement un nouveau.",
        },
        {
          text: "« Révoquer l'accès » met fin aux sessions en cours.",
        },
      ],
    },
    {
      kind: "paragraph",
      text: "Si la clientèle modifie ses informations dans le portail, la section « Demandes de modification » apparaît ici. Vous décidez avec « Accepter » ou « Refuser ».",
    },
  ],

  whatHappensNext: [
    "Les notes enregistrées sont aussitôt visibles pour toute l'équipe.",
    "Après la fusion, vous arrivez sur la fiche qui subsiste.",
    "Une demande de modification acceptée écrit les informations de la clientèle dans la fiche.",
  ],

  commonMistakes: [
    "Additionner « Facturé » et « Payé ». L'un est émis, l'autre encaissé.",
    "Fusionner parce que deux personnes portent le même nom. Vérifiez toujours l'e-mail et le téléphone.",
    "Vouloir copier le lien du portail plus tard. Il n'est affiché qu'une seule fois.",
  ],

  ifSomethingGoesWrong: [
    "« Fusionner » n'apparaît pas : votre rôle ne le permet pas. Demandez au propriétaire ou à un admin.",
    "Vous avez perdu le lien du portail : créez-en simplement un nouveau. L'ancien n'en devient pas moins sûr.",
    "Un montant semble faux : ouvrez « Finances » et vérifiez les paiements saisis — la fiche ne fait qu'additionner.",
  ],
} satisfies WikiArticleBody;

export default body;
