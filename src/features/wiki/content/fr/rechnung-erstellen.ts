import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "rechnung-erstellen",
  locale: "fr",
  title: "Écrire et envoyer une facture",
  summary: "Du formulaire vide à la section QR jusqu'à l'envoi par e-mail.",

  purpose:
    "C'est ici que vous écrivez une facture : données du client, positions, TVA et conditions. À l'enregistrement, le numéro de facture et la référence QR se créent tout seuls.",

  whenToUse: [
    "Un mandat est terminé et doit être facturé.",
    "Vous voulez terminer un brouillon.",
    "Vous voulez récupérer une facture existante en PDF.",
    "Vous voulez saisir un paiement sur une facture.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/rechnung-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Le formulaire de facture avec les données du client et les détails.",
      alt: "Formulaire pour une nouvelle facture. À gauche les données du client avec civilité, nom, adresse, e-mail et téléphone, à droite la date, l'échéance, le statut, la langue et une note interne.",
      hotspots: [
        { n: 1, xPct: 27, yPct: 45, label: "Données du client. Seul le nom est obligatoire." },
        { n: 2, xPct: 74, yPct: 45, label: "Date, échéance, statut et langue de la facture." },
      ],
    },
    {
      kind: "heading",
      id: "anlegen",
      text: "Étape par étape",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Dans la liste des factures, cliquez sur « Nouvelle facture ».",
          note: "Si vous venez d'un mandat, les données du client sont déjà remplies.",
        },
        {
          text: "Sous « Données du client », remplissez au moins le champ « Nom ».",
          note: "Tout le reste est facultatif. Sans nom, l'enregistrement est refusé.",
        },
        {
          text: "Vérifiez « Date » et « Échéance ».",
          note: "L'échéance suit automatiquement la date plus 30 jours — jusqu'à ce que vous la changiez une fois à la main. Ensuite, votre valeur reste.",
        },
        {
          text: "Choisissez sous « Langue de la facture » la langue de la clientèle.",
          note: "Elle détermine le PDF et l'e-mail — pas la langue de votre affichage.",
        },
        {
          text: "Sous « Positions », indiquez ce qui est facturé.",
          note: "« Montant » se calcule à partir de la quantité et du prix unitaire, tant que vous ne l'écrasez pas. « Ajouter une ligne » ajoute une position.",
        },
        {
          text: "Activez la « TVA » si nécessaire et vérifiez le taux.",
          note: "Le taux par défaut est de 8,1 pour cent.",
        },
        {
          text: "Cliquez sur « Enregistrer ».",
          note: "Le numéro de facture et la référence QR se créent alors. Tout se passe en arrière-plan.",
        },
      ],
    },
    {
      kind: "heading",
      id: "status",
      text: "Le statut",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« Payée » ne figure pas dans la liste — c'est voulu",
      text: "Tant qu'il reste quelque chose d'ouvert, « Payée » ne peut pas être choisi. Le statut suit les paiements saisis. Saisissez le paiement au lieu de régler le statut.",
    },
    {
      kind: "paragraph",
      text: "En bas de page figure le récapitulatif : Payé, le cas échéant Crédité, et Ouvert. En dessous, le même rappel est répété.",
    },
    {
      kind: "heading",
      id: "senden",
      text: "Récupérer le PDF ou envoyer par e-mail",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "« Télécharger le PDF » enregistre d'abord, puis génère le fichier.",
          note: "Le PDF contient la section de paiement QR suisse. S'il manque l'IBAN ou l'adresse de l'entreprise, un message apparaît.",
        },
        {
          text: "« Envoyer par e-mail » adresse la facture directement à la clientèle.",
          note: "Le bouton n'apparaît que si une adresse e-mail est saisie et que la facture n'est pas encore payée.",
        },
        {
          text: "Après l'envoi, la facture passe à « Envoyée ».",
        },
      ],
    },
    {
      kind: "heading",
      id: "zahlung",
      text: "Saisir un paiement sur cette facture",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez en bas sur « Saisir un paiement ».",
          note: "Le bouton n'apparaît que si la facture est enregistrée et qu'il reste quelque chose d'ouvert.",
        },
        {
          text: "Indiquez le montant, la date, le moyen de paiement et la référence, puis confirmez avec « Saisir ».",
          note: "Les paiements partiels sont possibles ; la facture reste alors ouverte.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "permission",
      title: "Paiements : propriétaire et admin uniquement",
      text: "Tout le monde peut écrire et envoyer la facture. Seule la saisie d'un paiement est réservée au propriétaire et aux administrateurs.",
    },
  ],

  whatHappensNext: [
    "Au premier enregistrement, le numéro de facture et la référence QR se créent automatiquement.",
    "Après l'envoi, le statut passe à « Envoyée ».",
    "Dès que les paiements saisis couvrent le montant, il passe à « Payée ».",
    "Si l'échéance est passée et qu'il reste quelque chose d'ouvert, il devient « En retard » pendant la nuit.",
  ],

  commonMistakes: [
    "Changer l'échéance et s'étonner qu'elle ne suive plus la date. Après une première modification manuelle, votre valeur reste.",
    "Confondre la langue de la facture avec celle de votre affichage. Elle détermine ce que lit la clientèle.",
    "Attendre le bouton « Envoyer par e-mail » alors qu'aucune adresse n'est renseignée. Sans adresse, il n'apparaît pas.",
  ],

  ifSomethingGoesWrong: [
    "« Nom du client manquant » : indiquez un nom sous « Données du client ».",
    "« IBAN manquant » ou « Adresse d'entreprise incomplète » : complétez les informations sous « Paramètres » et réessayez.",
    "L'envoi échoue : vérifiez l'adresse e-mail de la clientèle. La facture reste enregistrée ; vous pouvez renvoyer.",
  ],
} satisfies WikiArticleBody;

export default body;
