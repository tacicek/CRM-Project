import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "anfrage-importieren",
  locale: "fr",
  title: "Saisir soi-même une demande",
  summary: "Coller un texte ou dicter — l'analyse remplit les champs, vous les vérifiez.",

  purpose:
    "Si une demande arrive par téléphone ou par un canal non raccordé, vous la saisissez ici. Vous fournissez le texte, le programme reconnaît la prestation et les informations.",

  whenToUse: [
    "Une cliente appelle et décrit son déménagement.",
    "Une demande est arrivée par un canal non raccordé.",
    "Vous voulez saisir après coup un ancien e-mail.",
  ],

  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "Il n'y a pas de formulaire vierge",
      text: "« Nouvelle demande » mène toujours ici. Vous ne tapez pas les champs un à un — vous fournissez du texte ou de la voix, puis vous vérifiez le résultat.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/anfrage-importieren-v1.webp",
      width: 1440,
      height: 1000,
      caption: "L'étape 1 avec le champ de texte et le bouton de saisie vocale.",
      alt: "Page d'import avec le titre Importer une demande, en haut un bouton de saisie vocale, en dessous un grand champ de texte avec des exemples et le bouton d'analyse.",
      hotspots: [
        { n: 1, xPct: 25, yPct: 27, label: "Saisie vocale — dicter au lieu de taper." },
        { n: 2, xPct: 50, yPct: 55, label: "Coller ici le texte de la clientèle." },
      ],
    },
    {
      kind: "heading",
      id: "schritt1",
      text: "Étape 1 : fournir le texte",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Collez tout le texte de la clientèle dans le grand champ.",
          note: "Au moins 20 caractères, au plus 10 000. Le compteur en bas à droite indique où vous en êtes.",
        },
        {
          text: "Ou cliquez sur « Saisie vocale » et dictez la demande.",
          note: "Vous voyez ensuite le texte reconnu et pouvez le corriger avant de continuer.",
        },
        {
          text: "Cliquez sur « Extraire avec l'IA ».",
          note: "Après une dictée validée, l'analyse démarre d'elle-même.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Mieux vaut trop de texte que trop peu",
      text: "Copiez tout le message, formule de politesse et signature comprises. Le numéro de téléphone et l'adresse s'y trouvent souvent, et l'analyse ne trouve que ce qui est écrit.",
    },
    {
      kind: "heading",
      id: "schritt2",
      text: "Étape 2 : vérifier le résultat",
    },
    {
      kind: "paragraph",
      text: "En haut figurent la prestation reconnue et un pourcentage de fiabilité. Sous 80 pour cent, un avis vous invite à vérifier les informations avec un soin particulier.",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Vérifiez la prestation et changez-la au besoin dans la liste déroulante.",
          note: "Au choix : déménagement privé, déménagement d'entreprise, nettoyage, débarras, élimination, stockage, transport de piano et monte-meubles.",
        },
        {
          text: "Complétez les coordonnées manquantes.",
          note: "Tous les champs sont modifiables — l'analyse est une proposition, pas une consigne.",
        },
        {
          text: "Vérifiez « Le client a écrit en ».",
          note: "Cette langue détermine le devis, le PDF et les e-mails destinés à la clientèle.",
        },
        {
          text: "Cliquez sur « Enregistrer la demande ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Sans code postal, impossible de continuer",
      text: "Le code postal est le seul champ obligatoire. Lequel est exigé dépend de la prestation : pour le stockage le NPA d'enlèvement, pour le déménagement et le transport de piano le NPA de départ, sinon le NPA de l'adresse.",
    },
    {
      kind: "heading",
      id: "meldungen",
      text: "Messages à l'enregistrement",
    },
    {
      kind: "statusTable",
      headers: { status: "Message", meaning: "Cause", next: "À faire" },
      rows: [
        { status: "Texte trop court", meaning: "Moins de 20 caractères.", next: "Ajouter du texte." },
        { status: "NPA requis", meaning: "Le NPA exigé pour cette prestation manque.", next: "Saisir un NPA à quatre chiffres." },
        { status: "Numéro de téléphone invalide", meaning: "Pas un numéro suisse valable.", next: "Utiliser le format +41 79 123 45 67." },
        { status: "Données client manquantes", meaning: "Fiabilité faible et aucun nom reconnu.", next: "Saisir un prénom ou un nom." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Revenir en arrière efface tout",
      text: "Si vous quittez l'étape 2, le programme demande une confirmation — ensuite toutes les corrections sont perdues. Il n'y a pas d'enregistrement intermédiaire.",
    },
  ],

  whatHappensNext: [
    "Après l'enregistrement, vous arrivez dans la liste des demandes.",
    "La nouvelle demande y figure dans l'onglet de prestation correspondant.",
    "Aucun devis n'est créé au passage — vous le lancez avec « Créer un devis ».",
  ],

  commonMistakes: [
    "Ne coller qu'une demi-phrase. Moins il y a de texte, moins il y a de reconnaissance.",
    "Enregistrer le résultat sans le vérifier. L'analyse devine, surtout sur les messages courts.",
    "S'attendre à ce qu'un devis naisse aussitôt. C'est une seconde étape distincte.",
  ],

  ifSomethingGoesWrong: [
    "La saisie vocale manque : votre navigateur ne gère pas l'enregistrement. Utilisez un Chrome, Firefox ou Edge récent.",
    "L'analyse ne reconnaît presque rien : le texte est trop court ou contient peu d'informations. Complétez-le et relancez.",
    "« Erreur lors de l'enregistrement » : vérifiez la connexion et réessayez — le texte reste dans le champ.",
  ],
} satisfies WikiArticleBody;

export default body;
