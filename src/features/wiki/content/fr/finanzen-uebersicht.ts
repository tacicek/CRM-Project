import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "finanzen-uebersicht",
  locale: "fr",
  title: "Finances : ce qui est ouvert et ce qui est rentré",
  summary: "Postes ouverts et paiements au même endroit — annulation comprise.",

  purpose:
    "La page « Finances » répond à deux questions : qui doit encore de l'argent, et qu'est-ce qui est déjà rentré. C'est aussi ici que vous saisissez les paiements.",

  whenToUse: [
    "Vous avez un relevé bancaire devant vous et voulez saisir les entrées.",
    "Vous voulez savoir ce qui est en retard.",
    "Vous avez saisi un paiement par erreur et devez le corriger.",
    "Vous voulez voir le chiffre du mois.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/finanzen-uebersicht-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Finances avec les quatre montants et la liste des postes ouverts.",
      alt: "Page Finances avec quatre montants pour Encaissé, 30 derniers jours, Ouvert et En retard, en dessous deux onglets et la liste des factures ouvertes avec un bouton pour saisir un paiement.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 19, label: "Quatre montants. « En retard » passe au rouge dès qu'il y a du retard." },
        { n: 2, xPct: 24, yPct: 28, label: "Ligne « Non rapprochés » — n'apparaît que s'il en existe." },
        { n: 3, xPct: 29, yPct: 36, label: "Deux onglets : postes ouverts et paiements." },
        { n: 4, xPct: 91, yPct: 43, label: "« Saisir un paiement » ouvre la fenêtre." },
      ],
    },
    {
      kind: "heading",
      id: "die-vier-betraege",
      text: "Les quatre montants",
    },
    {
      kind: "statusTable",
      headers: { status: "Montant", meaning: "Ce qu'il contient", next: "Remarque" },
      rows: [
        { status: "Encaissé", meaning: "Tous les paiements jamais saisis.", next: "Les annulations sont déjà déduites." },
        { status: "30 derniers jours", meaning: "La même chose, limitée aux 30 derniers jours.", next: "—" },
        { status: "Ouvert", meaning: "Ce qui reste dû sur les factures émises.", next: "Les brouillons ne comptent pas." },
        { status: "En retard", meaning: "La part dont l'échéance est passée.", next: "Affichée en rouge." },
      ],
    },
    {
      kind: "heading",
      id: "offene-posten",
      text: "Onglet « Postes ouverts »",
    },
    {
      kind: "paragraph",
      text: "Chaque facture pas encore entièrement payée figure ici. L'échéance la plus ancienne est en haut.",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Le numéro de facture est cliquable et ouvre la facture.",
        "En dessous : « Échéance {date} » ou, en rouge, « en retard de {n} jours ».",
        "Si un montant a déjà été payé, s'ajoute « {montant} sur {montant} payé ».",
        "La marque « Niveau de rappel {n} » apparaît dès que des rappels existent.",
        "À droite, le montant encore ouvert avec le bouton « Saisir un paiement ».",
      ],
    },
    {
      kind: "heading",
      id: "zahlungseingaenge",
      text: "Onglet « Paiements »",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/finanzen-zahlungseingaenge-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Le journal des paiements avec une écriture annulée.",
      alt: "Onglet Paiements avec une liste d'écritures. Chaque ligne montre la date, le moyen de paiement, l'état de rapprochement et le montant ; une ligne porte la marque Annulation et un montant négatif.",
    },
    {
      kind: "paragraph",
      text: "Chaque ligne est une écriture : date, moyen de paiement, référence et montant. Une ligne marquée « Annulation » avec un montant négatif annule une écriture antérieure.",
    },
    {
      kind: "heading",
      id: "stornieren",
      text: "Corriger un paiement erroné",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Les paiements ne sont jamais supprimés",
      text: "Une écriture erronée est annulée par une contre-écriture. Les deux lignes restent visibles — la comptabilité reste ainsi traçable.",
    },
    {
      kind: "steps",
      steps: [
        { text: "Passez à l'onglet « Paiements »." },
        {
          text: "Trouvez l'écriture erronée et cliquez sur « Annuler ».",
          note: "Le bouton est absent pour les écritures qui sont elles-mêmes des annulations ou qui ont déjà été annulées.",
        },
        {
          text: "Confirmez la question.",
          note: "Une deuxième ligne apparaît avec le même montant en négatif.",
        },
        {
          text: "Saisissez ensuite le paiement correct.",
          note: "Une annulation porte toujours sur le montant entier — les montants partiels ne peuvent pas être annulés.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Saisir et annuler : propriétaire et admin uniquement",
      text: "En tant que collaborateur, vous voyez les deux boutons mais recevez un message d'erreur en cliquant. Ce n'est pas une panne, c'est la répartition des droits.",
    },
  ],

  whatHappensNext: [
    "Après un paiement saisi, « Ouvert » baisse et « Encaissé » augmente.",
    "Une facture entièrement payée disparaît des postes ouverts et passe à « Payée ».",
    "Une annulation fait remonter « Ouvert » et la facture réapparaît.",
  ],

  commonMistakes: [
    "Vouloir passer la facture à « payée » à la main. Le statut suit les paiements ; il n'y a pas de bouton.",
    "Vouloir supprimer une écriture erronée. Seule l'annulation par contre-écriture existe.",
    "Lire « Encaissé » comme un bénéfice. C'est de l'argent rentré, pas un résultat.",
  ],

  ifSomethingGoesWrong: [
    "Un message d'erreur apparaît à la saisie : votre rôle ne le permet pas. Demandez au propriétaire ou à un admin.",
    "Un montant figure sous « Non rapprochés » : l'entrée est saisie mais rattachée à aucune facture. Saisissez-la à nouveau sur la bonne facture et annulez l'ancienne.",
    "Une facture payée réapparaît comme ouverte : le paiement a sans doute été annulé, ou une note de crédit a été créée.",
  ],
} satisfies WikiArticleBody;

export default body;
