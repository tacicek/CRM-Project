import { wiki as de } from "@/i18n/catalog/de/wiki";

export const wiki: Record<keyof typeof de, string> = {
  "wiki.title": "Aide & mode d'emploi",
  "wiki.subtitle": "Votre journée de travail, étape par étape.",

  // --- Recherche -------------------------------------------------------------------
  "wiki.search.label": "Rechercher dans l'aide",
  "wiki.search.placeholder": "Que cherchez-vous ? Par exemple : envoyer une offre",
  "wiki.search.clear": "Effacer la recherche",
  "wiki.search.noResults": "Nous n'avons pas encore de guide à ce sujet.",
  "wiki.search.noResultsHint": "Essayez un autre mot, par exemple « facture » au lieu de « note ».",
  "wiki.search.results": "{count} guides trouvés",
  "wiki.search.results#one": "{count} guide trouvé",
  "wiki.search.results#other": "{count} guides trouvés",

  // --- Page d'accueil --------------------------------------------------------------
  "wiki.home.startHere": "Commencer ici",
  "wiki.home.startHereHint": "Vous débutez ? Ces guides vous accompagnent pas à pas.",
  "wiki.home.tasks": "Que voulez-vous faire ?",
  "wiki.home.categories": "Tous les domaines",
  "wiki.home.daily": "Pour chaque jour",
  "wiki.home.articleCount": "{count} guides",
  "wiki.home.articleCount#one": "{count} guide",
  "wiki.home.articleCount#other": "{count} guides",

  // --- Catégories ------------------------------------------------------------------
  "wiki.category.start": "Commencer ici",
  "wiki.category.anfragen-kunden": "Demandes, clients et vente",
  "wiki.category.offerten": "Offres et accord du client",
  "wiki.category.planung": "Planification et exécution",
  "wiki.category.finanzen": "Factures, quittances et paiements",
  "wiki.category.service-kommunikation": "Service client et communication",
  "wiki.category.berichte": "Analyses et contrôle quotidien",
  "wiki.category.einrichtung": "Configuration et administration",
  "wiki.category.kundensicht": "Ce que voit le client",
  "wiki.category.glossar": "Termes et statuts",

  // --- Sections d'un guide ---------------------------------------------------------
  "wiki.section.purpose": "À quoi cela sert-il ?",
  "wiki.section.whenToUse": "Quand en avez-vous besoin ?",
  "wiki.section.beforeYouBegin": "Avant de commencer",
  "wiki.section.whatHappensNext": "Que se passe-t-il ensuite ?",
  "wiki.section.commonMistakes": "Erreurs fréquentes",
  "wiki.section.ifSomethingGoesWrong": "Si cela ne fonctionne pas",
  "wiki.section.related": "Guides utiles",
  "wiki.section.contents": "Contenu de cette page",

  // --- Navigation ------------------------------------------------------------------
  "wiki.nav.breadcrumbHome": "Aide & mode d'emploi",
  "wiki.nav.breadcrumb": "Vous êtes ici",
  "wiki.nav.previous": "Guide précédent",
  "wiki.nav.next": "Guide suivant",
  "wiki.nav.backToHome": "Retour à la vue d'ensemble",
  "wiki.nav.openScreen": "Ouvrir cette page dans le CRM",
  "wiki.nav.print": "Imprimer le guide",

  // --- Images ----------------------------------------------------------------------
  "wiki.figure.zoom": "Agrandir l'image",
  "wiki.figure.zoomHint": "Cliquez pour agrandir",
  "wiki.figure.close": "Fermer l'image",
  "wiki.figure.legend": "Explication de l'image",

  // --- Encadrés --------------------------------------------------------------------
  "wiki.callout.tip": "Conseil",
  "wiki.callout.warning": "Attention",
  "wiki.callout.danger": "Irréversible",
  "wiki.callout.permission": "Autorisation requise",

  // --- Tableau des statuts ---------------------------------------------------------
  "wiki.status.title": "Ce que signifient les statuts",
  "wiki.status.header.status": "Statut",
  "wiki.status.header.meaning": "Signification",
  "wiki.status.header.next": "Votre prochaine étape",

  // --- États -----------------------------------------------------------------------
  "wiki.state.loading": "Chargement du guide …",
  "wiki.state.errorTitle": "Le guide n'a pas pu être chargé",
  "wiki.state.errorHint": "Veuillez recharger la page.",
  "wiki.state.retry": "Réessayer",
  "wiki.state.notFoundTitle": "Ce guide n'existe pas",
  "wiki.state.notFoundHint": "L'adresse a peut-être changé. Cherchez dans la vue d'ensemble.",

  // --- Pied de page ----------------------------------------------------------------
  "wiki.meta.lastVerified": "Dernière vérification le {date}",
  "wiki.kind.reference": "Explique un écran",
  "wiki.kind.journey": "Déroulement en plusieurs étapes",
};
