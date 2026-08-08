import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "kalender",
  locale: "fr",
  title: "Le calendrier",
  summary: "Tous les rendez-vous en vue — affichages, filtres, déplacement et semaine d'équipe.",

  purpose:
    "Le calendrier réunit visites, interventions et rendez-vous internes. C'est là que vous planifiez, déplacez et voyez qui est occupé quand.",

  whenToUse: [
    "Vous planifiez la semaine à venir.",
    "Un rendez-vous doit être déplacé.",
    "Vous voulez savoir qui est libre jeudi.",
    "Un rendez-vous terminé n'apparaît plus.",
  ],

  blocks: [
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/kalender-v1.webp",
      width: 1440,
      height: 1000,
      caption: "La vue hebdomadaire avec les rendez-vous aux couleurs des personnes affectées.",
      alt: "Vue hebdomadaire du calendrier avec des blocs colorés, en haut les bascules Affichage et Équipe, les vues Mois, Semaine, Jour et Liste ainsi que le filtre avec des marques par type de rendez-vous.",
      hotspots: [
        { n: 1, xPct: 24, yPct: 18, label: "Affichage ou semaine d'équipe." },
        { n: 2, xPct: 41, yPct: 18, label: "Mois, Semaine, Jour ou Liste." },
        { n: 3, xPct: 55, yPct: 18, label: "Filtre — un chiffre y figure." },
        { n: 4, xPct: 40, yPct: 70, label: "Un rendez-vous. La couleur vient de la personne affectée." },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Les rendez-vous terminés et annulés sont masqués",
      text: "À l'ouverture, le calendrier n'affiche que « En attente » et « Confirmé ». Qui cherche un rendez-vous terminé doit d'abord l'activer dans le filtre. C'est la première cause de « mon rendez-vous a disparu ».",
    },
    {
      kind: "heading",
      id: "ansichten",
      text: "Les affichages",
    },
    {
      kind: "list",
      ordered: false,
      items: [
        "« Mois » — la vue d'ensemble, mais sans horaires.",
        "« Semaine » — la vue de travail avec la grille horaire. La plus utile pour planifier.",
        "« Jour » — une journée en détail.",
        "« Liste » — tous les rendez-vous à venir les uns sous les autres.",
        "« Équipe » — la semaine par personne, avec le nombre d'heures.",
      ],
    },
    {
      kind: "heading",
      id: "filter",
      text: "Filtrer",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur « Filtre ».",
          note: "Le chiffre à côté indique combien de restrictions sont actives.",
        },
        {
          text: "Sous « Type de rendez-vous », choisissez Visite, Prestation, Relance, Réunion ou Bloqué.",
        },
        {
          text: "Sous « Statut », ajoutez « Terminé » et « Annulé » si vous voulez voir le passé.",
        },
        {
          text: "Sous « Équipe », restreignez à certaines personnes.",
          note: "Les filtres actifs apparaissent comme marques à côté du bouton ; un clic sur « × » les retire.",
        },
      ],
    },
    {
      kind: "heading",
      id: "typen",
      text: "Les types de rendez-vous",
    },
    {
      kind: "statusTable",
      headers: { status: "Type", meaning: "Pour quoi", next: "Particularité" },
      rows: [
        { status: "Visite", meaning: "Rendez-vous sur place chez le client.", next: "—" },
        { status: "Prestation", meaning: "L'intervention elle-même.", next: "Seul type avec véhicules et équipement." },
        { status: "Relance", meaning: "Rappel de reprendre contact.", next: "—" },
        { status: "Réunion", meaning: "Interne.", next: "Aucune confirmation ne part au client." },
        { status: "Bloqué", meaning: "Temps non disponible.", next: "Sans données client." },
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "La couleur montre la personne, pas le type",
      text: "Dès que quelqu'un est affecté, le rendez-vous prend sa couleur. Seuls les rendez-vous sans personne portent la couleur de leur type.",
    },
    {
      kind: "heading",
      id: "verschieben",
      text: "Déplacer des rendez-vous",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Faites glisser un rendez-vous vers un autre jour ou une autre heure.",
          note: "La date et l'heure sont enregistrées aussitôt.",
        },
        {
          text: "Tirez le bord inférieur pour changer la durée.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Le glissement ne vérifie pas les conflits",
      text: "Vous pouvez affecter deux fois la même personne sans vous en rendre compte. Après un déplacement, vérifiez dans la semaine d'équipe que cela tient.",
    },
    {
      kind: "heading",
      id: "aktionen",
      text: "Confirmer, terminer, annuler",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Cliquez sur un rendez-vous — la fiche de détail apparaît à droite.",
        },
        {
          text: "« Confirmer » passe un rendez-vous en attente à confirmé.",
        },
        {
          text: "« Terminé » clôt un rendez-vous confirmé.",
        },
        {
          text: "« Annuler » l'annule ; pour une série, le programme demande si c'est celui-ci ou toute la série.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ces trois boutons n'avertissent personne",
      text: "Confirmer, Terminé et Annuler ne changent que le statut. Aucun e-mail ni SMS ne part au client — informez-le vous-même.",
    },
    {
      kind: "paragraph",
      text: "Via « Vers le calendrier » dans la fiche de détail, vous transmettez un rendez-vous isolé à Apple, Yahoo ou sous forme de fichier. Pour tous les rendez-vous en continu, il y a l'abonnement au calendrier — voir « S'abonner au calendrier » sous Configuration.",
    },
  ],

  whatHappensNext: [
    "Les rendez-vous déplacés sont aussitôt visibles pour toute l'équipe.",
    "Un rendez-vous annulé disparaît de la vue tant que « Annulé » n'est pas coché dans le filtre.",
    "Si le rendez-vous d'un mandat est annulé, le mandat passe en « Annulé ».",
  ],

  commonMistakes: [
    "Chercher un rendez-vous terminé sans élargir le filtre de statut.",
    "Croire qu'« Annuler » informe le client. Ce n'est pas le cas.",
    "Ne pas vérifier les doubles affectations après un glissement.",
  ],

  ifSomethingGoesWrong: [
    "Un rendez-vous manque : élargissez le statut dans le filtre ou vérifiez le filtre de type.",
    "« Erreur lors du déplacement » : le rendez-vous revient en place. Rechargez la page et réessayez.",
    "Un rendez-vous est en double : ouvrez la semaine d'équipe pour vérifier l'occupation et déplacez-en un.",
  ],
} satisfies WikiArticleBody;

export default body;
