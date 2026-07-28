import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "email-eingang",
  locale: "fr",
  title: "Contrôler la boîte e-mail",
  summary: "Vérifier, corriger et reprendre les e-mails clients analysés automatiquement.",

  purpose:
    "Les e-mails envoyés à votre adresse de demandes sont analysés automatiquement. La boîte e-mail est la file d'attente : vous décidez ce qui devient une demande et ce qui non.",

  whenToUse: [
    "Un chiffre figure à côté de « Boîte e-mail » dans le menu.",
    "Le matin, avant de commencer avec les demandes.",
    "Une cliente dit avoir écrit — mais vous ne trouvez aucune demande.",
    "Une analyse a échoué et doit être relancée.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/email-eingang-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La boîte e-mail avec ses quatre onglets et les messages reçus.",
      alt: "Page Boîte e-mail avec les onglets À vérifier, Repris, Refusés et Échoués, puis une liste de messages avec objet, expéditeur, marque de prestation, indice de fiabilité et date.",
      hotspots: [
        { n: 1, xPct: 30, yPct: 20, label: "Quatre onglets avec le nombre de messages non lus." },
        { n: 2, xPct: 45, yPct: 34, label: "Objet et expéditeur." },
        { n: 3, xPct: 85, yPct: 34, label: "Prestation reconnue et fiabilité de l'analyse." },
      ],
    },
    {
      kind: "heading",
      id: "reiter",
      text: "Les quatre onglets",
    },
    {
      kind: "statusTable",
      headers: { status: "Onglet", meaning: "Ce qui s'y trouve", next: "Votre prochaine étape" },
      rows: [
        { status: "À vérifier", meaning: "Analysé, attend votre décision.", next: "Vérifier puis reprendre ou refuser." },
        { status: "Repris", meaning: "Déjà devenu une demande.", next: "Rien de plus." },
        { status: "Refusés", meaning: "Écartés par vous.", next: "En cas d'erreur, relancer l'analyse." },
        { status: "Échoués", meaning: "L'analyse s'est interrompue.", next: "Relancer l'analyse." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Le chiffre dans le menu",
      text: "Il compte tout ce qui est « À vérifier ». Les petits chiffres sur les onglets, eux, ne comptent que les messages pas encore ouverts.",
    },
    {
      kind: "heading",
      id: "pruefen",
      text: "Vérifier et reprendre un message",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Dans l'onglet « À vérifier », cliquez sur un message.",
          note: "Vous voyez l'objet, l'expéditeur, le texte du message et, en dessous, les informations reconnues.",
        },
        {
          text: "Regardez la valeur derrière « Fiabilité ».",
          note: "Vert dès 85 pour cent, jaune dès 60, rouge en dessous. Plus la valeur est basse, plus il faut vérifier.",
        },
        {
          text: "Corrigez et complétez les champs sous « Informations reconnues ».",
          note: "Tout est modifiable. Ce qui est repris, c'est ce que vous laissez là — pas la proposition d'origine.",
        },
        {
          text: "Cliquez sur « Reprendre comme demande ».",
          note: "Le message passe dans l'onglet « Repris » et la demande apparaît sous « Demandes ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "L'analyse n'invente rien",
      text: "Si l'adresse n'est pas dans le message, le champ reste vide. Les informations manquantes, obtenez-les par un bref appel avant de reprendre.",
    },
    {
      kind: "heading",
      id: "ablehnen",
      text: "Refuser publicité et messages égarés",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "« Refuser » ne demande pas confirmation",
      text: "Un clic suffit et le message part aussitôt dans l'onglet « Refusés ». Vous revenez en arrière avec « Relancer l'analyse ».",
    },
    {
      kind: "steps",
      steps: [
        { text: "Ouvrez le message et cliquez sur « Refuser »." },
        {
          text: "En cas d'erreur, ouvrez-le dans l'onglet « Refusés » et cliquez sur « Relancer l'analyse ».",
          note: "L'analyse se refait alors.",
        },
      ],
    },
    {
      kind: "heading",
      id: "grenzen",
      text: "Ce que la boîte e-mail ne peut pas",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "Elle n'affiche qu'un extrait du texte. La mise en page d'origine n'est pas conservée.",
        "Les pièces jointes n'apparaissent que par leur nom — impossible de les télécharger ici.",
        "Vous ne pouvez pas répondre depuis ici. Utilisez votre logiciel de messagerie habituel.",
        "« Vers la demande » mène à la liste des demandes, pas directement à la demande concernée.",
        "Il n'y a ni recherche ni filtre par expéditeur ou par date.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Besoin de la pièce jointe ?",
      text: "Ouvrez le message dans votre logiciel de messagerie habituel. La boîte e-mail est une liste de contrôle, pas une messagerie.",
    },
  ],

  whatHappensNext: [
    "Après la reprise, la demande apparaît sous « Demandes » dans l'onglet de prestation correspondant.",
    "Le chiffre dans le menu diminue.",
    "Le message reste dans l'onglet « Repris » et garde son lien avec la demande.",
  ],

  commonMistakes: [
    "Reprendre sans vérifier quand la fiabilité est basse. Le devis contiendra alors des erreurs.",
    "Attendre une possibilité de répondre. Les réponses passent par votre logiciel de messagerie.",
    "Laisser traîner les messages échoués. Souvent « Relancer l'analyse » suffit.",
  ],

  ifSomethingGoesWrong: [
    "Un message n'affiche aucune information reconnue : cliquez sur « Relancer l'analyse ». Si cela ne suffit pas, saisissez la demande à la main.",
    "Un message attendu manque totalement : vérifiez dans votre logiciel de messagerie qu'il est bien parti à la bonne adresse.",
    "« Échec de la reprise » : il manque le plus souvent une information obligatoire comme le code postal. Complétez-la et réessayez.",
  ],
} satisfies WikiArticleBody;

export default body;
