import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "termin-erstellen",
  locale: "fr",
  title: "Créer un rendez-vous",
  summary: "Type, horaire, équipe et véhicules — et quand le client reçoit une confirmation.",

  purpose:
    "C'est ici que vous créez un rendez-vous : une visite, une intervention, une relance ou une plage bloquée.",

  whenToUse: [
    "Vous convenez d'une visite par téléphone.",
    "Une intervention a besoin d'un véhicule et de matériel.",
    "Vous voulez bloquer des vacances ou une pause.",
    "Vous voulez qu'on vous rappelle de relancer un devis.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/termin-formular-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La fenêtre du rendez-vous avec le choix du type et les champs horaires.",
      alt: "Fenêtre pour un nouveau rendez-vous avec cinq boutons de type, le champ Titre, le choix du statut ainsi que la date, le début et la fin.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 30, label: "Le type détermine quels champs apparaissent." },
        { n: 2, xPct: 50, yPct: 47, label: "Titre — le seul champ obligatoire." },
        { n: 3, xPct: 50, yPct: 62, label: "Date, début et fin." },
      ],
    },
    {
      kind: "heading",
      id: "oeffnen",
      text: "Trois chemins vers la fenêtre",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "« Nouveau rendez-vous » en haut à droite — avec la date du jour.",
        "Clic droit sur un jour du calendrier — avec cette date.",
        "Depuis une demande ou un devis, via « Planifier un rendez-vous » — avec des informations préremplies.",
      ],
    },
    {
      kind: "heading",
      id: "ausfuellen",
      text: "Remplir la fenêtre",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Choisissez en haut le « Type de rendez-vous ».",
          note: "Avec « Bloqué », les champs client disparaissent — vous n'en avez pas besoin.",
        },
        {
          text: "Saisissez un « Titre ».",
          note: "C'est le seul champ obligatoire. Tout le reste est facultatif.",
        },
        {
          text: "Réglez « Date », « Début » et « Fin ».",
          note: "Au moins 15 minutes, au plus 12 heures. Avec « Toute la journée », les heures disparaissent.",
        },
        {
          text: "Sous « Client », reprenez les informations d'une demande ou saisissez-les.",
        },
        {
          text: "Affectez les personnes sous « Attribuer l'équipe ».",
          note: "« Véhicules » et « Équipement » n'apparaissent que pour le type « Prestation ».",
        },
        {
          text: "Cliquez sur « Créer ».",
        },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Les conflits sont signalés, pas bloqués",
      text: "Si une personne ou un véhicule est déjà pris au même moment, un avis rouge « Conflit de ressources ! » apparaît avec les rendez-vous concernés. Vous pouvez enregistrer quand même — la décision vous appartient.",
    },
    {
      kind: "heading",
      id: "benachrichtigung",
      text: "Quand le client est informé",
    },
    {
      kind: "statusTable",
      headers: { status: "Situation", meaning: "Envoi ?", next: "Ce que vous devez faire" },
      rows: [
        { status: "Nouveau rendez-vous, type Visite ou Prestation", meaning: "Oui, une confirmation par e-mail.", next: "Rien de plus." },
        { status: "Nouveau rendez-vous, type Réunion ou Bloqué", meaning: "Non.", next: "Les rendez-vous internes n'en ont pas besoin." },
        { status: "Rendez-vous modifié ou déplacé", meaning: "Non.", next: "Informer le client vous-même." },
        { status: "Rendez-vous annulé", meaning: "Non.", next: "Informer le client vous-même." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Un déplacement est silencieux",
      text: "Si vous changez la date ou l'heure, le client n'en sait rien. Appelez ou écrivez — le programme ne le fait pas pour vous.",
    },
    {
      kind: "heading",
      id: "wiederkehrend",
      text: "Rendez-vous récurrents",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "À la création, cochez « Récurrent ».",
          note: "Choisissez ensuite quotidien, hebdomadaire, toutes les deux semaines ou mensuel, et une date de fin.",
        },
        {
          text: "À l'enregistrement, toute la série est créée d'un coup.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "La récurrence ne se modifie plus après coup",
      text: "Vous ne pouvez la définir qu'à la création. Si elle ne convient pas, annulez la série et créez-en une nouvelle.",
    },
    {
      kind: "paragraph",
      text: "Les rappels au client partent automatiquement, indépendamment de cela. Ce qui est rappelé et quand se règle sous « Paramètres » — la fenêtre du rendez-vous n'a aucun champ pour cela.",
    },
  ],

  whatHappensNext: [
    "Le rendez-vous apparaît aussitôt dans le calendrier, à la couleur de la personne affectée.",
    "Pour Visite et Prestation, le client reçoit une confirmation par e-mail.",
    "Les rappels partent plus tard tout seuls, selon vos paramètres.",
  ],

  commonMistakes: [
    "Déplacer un rendez-vous en supposant que le client sera informé.",
    "Ignorer l'avis de conflit et affecter deux fois la même personne.",
    "Chercher des véhicules sur une visite. Ils n'existent que pour le type « Prestation ».",
  ],

  ifSomethingGoesWrong: [
    "« Veuillez saisir un titre » : le champ Titre est vide.",
    "« L'heure de fin doit suivre l'heure de début » : début et fin sont inversés.",
    "« Rendez-vous créé, mais aucune adresse e-mail client » : le rendez-vous existe, seule la confirmation n'est pas partie — ajoutez l'adresse et informez le client vous-même.",
  ],
} satisfies WikiArticleBody;

export default body;
