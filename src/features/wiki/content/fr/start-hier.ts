import type { WikiArticleBody } from "@/features/wiki/wikiTypes";

const body = {
  slug: "start-hier",
  locale: "fr",
  title: "Commencer ici",
  summary: "Ce que ce programme fait pour vous et dans quel ordre travailler.",

  purpose:
    "Ce programme accompagne un mandat client, de la première demande à la facture payée. Tout appartient à une seule entreprise. Vous n'avez rien à configurer pour commencer.",

  whenToUse: [
    "Vous utilisez le programme pour la première fois.",
    "Vous ne savez pas où se range une tâche précise.",
    "Vous voulez comprendre le fil rouge derrière tous ces menus.",
    "Vous devez former une ou un collègue.",
  ],

  blocks: [
    {
      kind: "heading",
      id: "der-rote-faden",
      text: "Le fil rouge",
    },
    {
      kind: "paragraph",
      text: "Presque tout dans le programme suit la même chaîne. Si vous connaissez cette chaîne, vous trouverez chaque menu.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Demande : une cliente ou un client vous contacte. Le besoin est saisi.",
        "Devis : vous rédigez une offre et l'envoyez à la clientèle.",
        "Mandat : la clientèle accepte. Le devis devient un mandat avec une date.",
        "Facture ou reçu : une fois le travail fait, vous facturez.",
        "Paiement : vous saisissez ce qui a été payé. Le statut de la facture suit tout seul.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Rien à apprendre par cœur",
      text: "En haut à droite de chaque page se trouve « Aide & mode d'emploi ». Un clic ouvre le guide de la page où vous êtes.",
    },
    {
      kind: "heading",
      id: "wo-alles-liegt",
      text: "Où tout se trouve",
    },
    {
      kind: "paragraph",
      text: "Le menu de gauche est divisé en domaines. Tout en haut se trouvent les cinq entrées dont vous avez besoin chaque jour.",
    },
    {
      kind: "figure",
      src: "/wiki/screenshots/fr/seitenleiste-v1.webp",
      width: 240,
      // One pixel taller than the German crop: French labels wrap differently. Element
      // crops legitimately differ per locale, which is why the validator compares each
      // number against its own file rather than across locales.
      height: 1165,
      caption: "Le menu latéral avec tous les domaines.",
      alt: "Menu latéral du programme. En haut le nom de l'entreprise, puis Vue d'ensemble, Demandes, Boîte e-mail, Devis et Calendrier. Ensuite les groupes Espace principal, Exploitation et Administration.",
      hotspots: [
        { n: 1, xPct: 50, yPct: 15, label: "Accès rapide : les cinq pages du quotidien." },
        { n: 2, xPct: 50, yPct: 40, label: "Espace principal : clients, argent et travail en cours." },
        { n: 3, xPct: 50, yPct: 68, label: "Exploitation : visites, matériel et équipe." },
        { n: 4, xPct: 50, yPct: 87, label: "Administration : vos prestations, tarifs et paramètres." },
      ],
    },
    {
      kind: "heading",
      id: "erste-schritte",
      text: "Vos trois premières étapes",
    },
    {
      kind: "steps",
      steps: [
        {
          text: "Ouvrez « Vue d'ensemble ». C'est votre page d'accueil.",
          note: "Vous y voyez les nouvelles demandes, les devis en attente et les rendez-vous du jour.",
        },
        {
          text: "Cliquez sur « Demandes » et ouvrez une demande.",
          note: "Vous verrez ainsi quelles informations une demande apporte.",
        },
        {
          text: "Lisez ensuite le guide « Une journée de travail type ».",
          note: "Il décrit dans l'ordre ce que vous vérifiez le matin, la journée et le soir.",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Ce que ce programme ne fait pas",
      text: "Ce n'est ni un logiciel de salaires, ni un suivi de véhicules, ni un calcul d'itinéraires. Il gère la clientèle, les offres, les rendez-vous et l'argent.",
    },
  ],

  whatHappensNext: [
    "Vous connaissez la chaîne demande, devis, mandat, facture, paiement.",
    "Vous savez que l'aide en haut à droite correspond toujours à la page en cours.",
    "Nous vous conseillons ensuite « Se connecter et se déconnecter » puis « Une journée de travail type ».",
  ],

  commonMistakes: [
    "Ne commencez pas par les paramètres. Les premiers jours, seules les demandes et les devis comptent.",
    "Ne tenez pas deux systèmes en parallèle. Ce qui n'est pas saisi ici n'apparaît dans aucune analyse.",
  ],

  ifSomethingGoesWrong: [
    "Vous ne trouvez pas une page : utilisez la recherche en haut de cette page d'aide.",
    "Une page est vide : il n'y a en général pas encore de données. Créez d'abord une demande.",
    "Vous ne savez pas si une action est réversible : chaque étape définitive est précédée d'un encadré rouge.",
  ],
} satisfies WikiArticleBody;

export default body;
