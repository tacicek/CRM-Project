import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "zahlung-erfassen",
  locale: "fr",
  title: "Saisir un paiement",
  summary: "Complet, partiel ou trop élevé — et comment corriger une erreur.",

  purpose:
    "Dès que de l'argent est rentré, vous le saisissez ici. Le statut de la facture en découle tout seul — vous ne le réglez jamais à la main.",

  whenToUse: [
    "Un virement est arrivé sur le compte.",
    "La clientèle a payé en espèces ou par TWINT.",
    "Seul un acompte est arrivé.",
    "Un montant trop élevé a été versé.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "permission",
      title: "Propriétaire et admin uniquement",
      text: "Saisir et annuler des paiements est réservé au propriétaire et aux administrateurs. Les collaborateurs voient le bouton mais reçoivent un message d'erreur en cliquant.",
    },
    {
      kind: "heading",
      id: "wo-beginnen",
      text: "Par où commencer",
    },
    {
      kind: "paragraph",
      text: "Deux chemins mènent à la même fenêtre. Le résultat est identique.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Par « Finances » → onglet « Postes ouverts » → « Saisir un paiement » sur la facture. C'est la voie rapide pour enchaîner plusieurs entrées.",
        "Par la facture elle-même → bouton « Saisir un paiement » en bas. Il n'apparaît que si la facture est enregistrée et qu'il reste quelque chose d'ouvert.",
      ],
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Chaque poste ouvert porte à droite « Saisir un paiement ».",
      alt: "Liste des factures ouvertes. Chaque ligne montre le numéro de facture, le nom du client, l'échéance et à droite le montant ouvert avec un bouton pour saisir le paiement.",
      hotspots: [
        { n: 1, xPct: 91, yPct: 43, label: "Ce bouton ouvre la fenêtre." },
        { n: 2, xPct: 33, yPct: 57, label: "Ici s'affiche ce qui a déjà été payé." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-felder",
      text: "Les quatre champs",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "« Montant » est prérempli avec le montant ouvert. Corrigez-le si la somme reçue est différente.",
          note: "Pour un reçu, le champ est figé — le montant y est fixé par le document.",
        },
        {
          text: "« Date du paiement » est réglée sur aujourd'hui. Mettez la date de l'entrée réelle.",
          note: "Pour un relevé bancaire, c'est la date de valeur qui compte, pas le jour de votre saisie.",
        },
        {
          text: "Choisissez sous « Moyen de paiement » comment l'argent est arrivé.",
          note: "Au choix : virement bancaire, facture QR, TWINT, espèces, carte, autre moyen.",
        },
        {
          text: "Indiquez sous « Référence » ce qui vous permettra de reconnaître le paiement.",
          note: "Par exemple la référence QR, un numéro TWINT ou un numéro de document. Le champ est facultatif mais aide au rapprochement.",
        },
        {
          text: "Cliquez sur « Saisir ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Il n'y a pas de champ de remarque",
      text: "Ce qui explique le paiement va dans la « Référence ». La fenêtre ne propose pas de champ de note libre.",
    },
    {
      kind: "heading",
      id: "teilzahlung",
      text: "Paiement partiel",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Indiquez sous « Montant » ce qui est réellement arrivé.",
          note: "Exemple : 400 francs sur 890.",
        },
        {
          text: "Saisissez le paiement comme d'habitude.",
          note: "La facture reste ouverte, le montant ouvert descend à la différence.",
        },
        {
          text: "Plus tard, vous saisissez le solde comme deuxième paiement.",
          note: "Dès qu'il ne reste rien d'ouvert, la facture passe d'elle-même à « Payée ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "ueberzahlung",
      text: "Trop payé",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "L'excédent reste en attente",
      text: "Si vous tapez plus que le montant ouvert, un avertissement apparaît aussitôt. La part excédentaire est comptabilisée comme entrée non rattachée et figure sous « Non rapprochés ».",
    },
    {
      kind: "paragraph",
      text: "Ce n'est pas une erreur mais un pense-bête. Clarifiez avec la clientèle si le montant est remboursé ou imputé sur la prochaine facture.",
    },
    {
      kind: "heading",
      id: "korrigieren",
      text: "Corriger un paiement erroné",
    },
    {
      kind: "callout",
      tone: "danger",
      title: "Un paiement saisi ne se modifie plus",
      text: "Le montant, la date et le moyen de paiement sont figés après la saisie. La correction passe uniquement par « Annuler » puis une nouvelle saisie.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Ouvrez « Finances » et l'onglet « Paiements »." },
        { text: "Cliquez sur « Annuler » à l'écriture erronée et confirmez." },
        {
          text: "Saisissez maintenant le paiement correctement.",
          note: "La liste comporte alors trois lignes : la fausse, la contre-écriture et la bonne.",
        },
      ],
    },
  ],

  whatHappensNext: [
    "Le montant ouvert de la facture baisse immédiatement.",
    "S'il ne reste rien d'ouvert, la facture passe automatiquement à « Payée ».",
    "L'entrée apparaît dans l'onglet « Paiements » et compte dans « Encaissé ».",
    "Sur la fiche client, la ligne « Payé » augmente.",
  ],

  commonMistakes: [
    "Saisir la date de saisie au lieu de la date d'entrée. L'analyse « 30 derniers jours » devient alors fausse.",
    "Laisser le montant complet lors d'un paiement partiel. La facture passe pour payée alors qu'il manque de l'argent.",
    "Vouloir saisir un second paiement négatif après une erreur. Utilisez « Annuler ».",
  ],

  ifSomethingGoesWrong: [
    "« Saisir » reste grisé : le montant est vide ou nul. Indiquez un nombre supérieur à zéro.",
    "Un message d'erreur apparaît : votre rôle ne permet pas de saisir des paiements. Demandez au propriétaire ou à un admin.",
    "Vous avez saisi deux fois le même paiement : annulez l'une des deux écritures.",
  ],
} satisfies WikiArticleBody;

export default body;
