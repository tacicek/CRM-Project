import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "offerte-erstellen",
  locale: "fr",
  title: "Rédiger un devis",
  summary: "De la demande au devis fini : positions, modèle de prix, conditions, envoi.",

  purpose:
    "C'est ici que vous composez une offre. Les informations de la demande sont déjà reprises ; vous ajoutez les positions et les prix.",

  whenToUse: [
    "Une demande est vérifiée et doit recevoir une offre.",
    "Après une visite, vous voulez fixer le prix.",
    "La clientèle attend un engagement écrit.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Un devis part toujours d'une demande",
      text: "Ouvrez la demande concernée sous « Demandes » et partez de là. Sans demande, la page indique « Aucune demande sélectionnée ».",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/offerte-erstellen-v1.webp",
      width: 1440,
      height: 1000,
      caption: "Le formulaire de devis. En haut, les informations reprises de la demande.",
      alt: "Formulaire de création d'un devis avec la section Aperçu de la demande, qui montre le contact, le trajet et les détails de l'objet issus de la demande.",
    },
    {
      kind: "heading",
      id: "aufbau",
      text: "Comment la page est construite",
    },
    {
      kind: "paragraph",
      text: "C'est un seul long formulaire, pas un assistant par étapes. Vous pouvez travailler dans l'ordre que vous voulez et enregistrer entre-temps.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "« Aperçu de la demande » — ce que la clientèle a annoncé. En lecture seule.",
        "« Calculateur de déménagement » — n'apparaît que pour les déménagements ; calcule volume, temps et coûts.",
        "« Détails du devis » — titre et description.",
        "« Modèle de prix » — forfait, à l'heure ou avec plafond.",
        "« Suppléments » — majorations, par exemple week-end ou étage.",
        "« Type de devis » — normal ou aveugle.",
        "« Positions et prix » — ce qui est facturé.",
        "« Conditions de paiement » et « Conditions générales ».",
      ],
    },
    {
      kind: "heading",
      id: "preismodell",
      text: "Choisir le modèle de prix",
    },
    {
      kind: "statusTable",
      headers: { status: "Modèle", meaning: "Signification", next: "Convient si" },
      rows: [
        { status: "Prix forfaitaire", meaning: "Un montant fixe, quel que soit le temps passé.", next: "l'ampleur est claire." },
        { status: "Tarif horaire", meaning: "Facturation aux heures réelles.", next: "l'ampleur est difficile à estimer." },
        { status: "Tarif horaire avec plafond", meaning: "Aux heures, mais plafonné.", next: "la clientèle veut une sécurité." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Le plafond est un argument de vente",
      text: "La note sous le champ le dit directement à la clientèle : elle paie au maximum ce montant, quelle que soit la durée.",
    },
    {
      kind: "heading",
      id: "positionen",
      text: "Saisir les positions",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur « Ajouter depuis le catalogue » pour reprendre des prestations de votre catalogue.",
          note: "Le catalogue se trouve sous « Mes prestations ». Ce qui y est entretenu va plus vite ici.",
        },
        {
          text: "« Saisie manuelle » crée une position vide.",
          note: "Chaque position a besoin au minimum d'une description, sinon l'enregistrement est refusé.",
        },
        {
          text: "Changez au besoin la « Base de prix » de chaque position.",
          note: "« Montant fixe », « Tarif (selon dépense) » ou « Fourchette (min–max) ».",
        },
        {
          text: "Vérifiez en bas le sous-total, le rabais et le total.",
        },
      ],
    },
    {
      kind: "heading",
      id: "konditionen",
      text: "Conditions et CGV",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Indiquez sous « Conditions de paiement » comment le paiement se fait.",
          note: "Les boutons en dessous — par exemple « Paiement comptant » ou « 30 jours » — remplissent le texte en un clic, dans la langue de la clientèle.",
        },
        {
          text: "Dépliez « Conditions générales » si des CGV doivent accompagner le devis.",
          note: "« Insérer automatiquement les CGV standard » reprend votre texte enregistré. Les CGV figurent en page 2 du devis.",
        },
      ],
    },
    {
      kind: "heading",
      id: "speichern-senden",
      text: "Enregistrer ou envoyer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "« Enregistrer comme brouillon » range le devis sans rien expédier.",
          note: "Vous pourrez continuer plus tard. Le statut reste « Brouillon ».",
        },
        {
          text: "« Envoyer le devis » enregistre et expédie aussitôt par e-mail.",
          note: "Le statut ne passe à « Envoyé » que lorsque l'e-mail part réellement.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Vérifiez d'abord la langue et le prix",
      text: "Après l'envoi, le devis est verrouillé sur le fond. Toute modification passe alors par une nouvelle version.",
    },
    {
      kind: "paragraph",
      text: "À droite s'affiche l'« Aperçu en direct ». Il donne une idée du rendu — le PDF définitif se vérifie après l'enregistrement, sur la page de détail.",
    },
  ],

  whatHappensNext: [
    "Après l'enregistrement, vous arrivez dans la liste des devis.",
    "Un brouillon reste modifiable à volonté.",
    "Après l'envoi, la clientèle reçoit un e-mail avec un lien vers le devis.",
    "Si elle ouvre le lien, le statut passe à « Consulté ».",
  ],

  commonMistakes: [
    "Vouloir enregistrer sans position. Il en faut au moins une, sinon la vérification bloque.",
    "Indiquer un plafond inférieur au tarif horaire. C'est refusé.",
    "Prendre l'aperçu en direct pour le PDF final. C'est une approximation.",
  ],

  ifSomethingGoesWrong: [
    "« Veuillez saisir un titre » : le champ « Titre » sous « Détails du devis » est vide.",
    "« Veuillez compléter toutes les positions » : une position n'a pas de description.",
    "« E-mail non envoyé » : le devis est enregistré, seul l'envoi a échoué. Renvoyez-le depuis la liste.",
  ],
} satisfies WikiArticleBody;

export default body;
