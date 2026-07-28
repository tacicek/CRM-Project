import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";

/**
 * The searchable stub of every French article. See searchIndex.de.ts for why the index
 * is kept separate from the bodies.
 *
 * Keywords are written for a French-speaking operator and are NOT a translation of the
 * German list: someone searching in French types "connexion", not "anmelden". Accents
 * may be written naturally — search folds them before comparing.
 */
const index: WikiSearchIndex = {
  "start-hier": {
    title: "Commencer ici",
    summary: "Ce que ce programme fait pour vous et dans quel ordre travailler.",
    keywords: ["commencer", "début", "introduction", "premiers pas", "aperçu", "nouveau", "formation", "bases"],
  },
  "anmelden-abmelden": {
    title: "Se connecter et se déconnecter",
    summary: "Comment vous connecter, réinitialiser un mot de passe oublié et vous déconnecter en sécurité.",
    keywords: ["connexion", "déconnexion", "login", "logout", "mot de passe", "mot de passe oublié", "accès", "réinitialiser"],
  },
  "dashboard-uebersicht": {
    title: "La vue d'ensemble",
    summary: "Votre page d'accueil : nouvelles demandes, devis en attente et rendez-vous du jour.",
    keywords: ["vue d'ensemble", "aperçu", "accueil", "tableau de bord", "tuiles", "indicateurs", "aujourd'hui", "dernières demandes"],
  },
  "navigation-und-benachrichtigungen": {
    title: "Menu, barre du haut et notifications",
    summary: "Comment vous déplacer dans le programme et où voir les nouveautés.",
    keywords: ["menu", "navigation", "barre", "cloche", "notification", "rappel", "son", "push", "téléphone", "mobile"],
  },
  "sprache-dashboard-vs-dokument": {
    title: "Deux langues : la vôtre et celle de la clientèle",
    summary: "Pourquoi vous travaillez en français alors que la clientèle lit en allemand.",
    keywords: ["langue", "français", "allemand", "anglais", "traduction", "langue du document", "changer", "bilingue"],
  },
  "typischer-arbeitstag": {
    title: "Une journée de travail type",
    summary: "Une courte liste de ce que vous vérifiez le matin, la journée et le soir.",
    keywords: ["journée", "déroulement", "routine", "check-list", "matin", "soir", "quotidien", "ordre"],
  },
  "rollen-und-rechte": {
    title: "Rôles et droits",
    summary: "Qui a le droit de faire quoi : propriétaire, admin et collaborateur.",
    keywords: ["rôle", "droit", "autorisation", "propriétaire", "admin", "collaborateur", "bloqué", "interdit", "fusionner"],
  },
  "kunden-liste": {
    title: "La liste des clients",
    summary: "Toute la clientèle au même endroit — chercher, filtrer et ouvrir.",
    keywords: ["clients", "liste des clients", "contacts", "chercher", "doublon", "entreprise", "montant ouvert"],
  },
  "kundenkarte": {
    title: "La fiche client",
    summary: "Tout sur une cliente : contact, dossiers, montants, historique et accès au portail.",
    keywords: ["fiche client", "ouvrir un client", "historique", "note", "fusionner", "portail", "facturé", "payé"],
  },
  "finanzen-uebersicht": {
    title: "Finances : ce qui est ouvert et ce qui est rentré",
    summary: "Postes ouverts et paiements au même endroit — annulation comprise.",
    keywords: ["finances", "postes ouverts", "paiement", "encaissé", "en retard", "annulation", "annuler", "journal"],
  },
  "zahlung-erfassen": {
    title: "Saisir un paiement",
    summary: "Complet, partiel ou trop élevé — et comment corriger une erreur.",
    keywords: ["saisir un paiement", "paiement", "paiement partiel", "trop payé", "twint", "espèces", "virement", "annulation"],
  },
  "rechnungen-liste": {
    title: "La liste des factures",
    summary: "Toutes les factures avec statut, filtres, PDF et les règles de suppression.",
    keywords: ["factures", "liste des factures", "statut", "brouillon", "envoyée", "en retard", "pdf", "supprimer"],
  },
  "rechnung-erstellen": {
    title: "Écrire et envoyer une facture",
    summary: "Du formulaire vide à la section QR jusqu'à l'envoi par e-mail.",
    keywords: ["créer une facture", "nouvelle facture", "facture qr", "positions", "tva", "échéance", "envoyer", "iban"],
  },
  "offerten-liste": {
    title: "La liste des devis",
    summary: "Tous les devis avec leur statut, les filtres et les actions par ligne.",
    keywords: ["devis", "liste des devis", "statut", "en attente", "accepté", "renvoyer", "aveugle"],
  },
  "offerte-erstellen": {
    title: "Rédiger un devis",
    summary: "De la demande au devis fini : positions, modèle de prix, conditions, envoi.",
    keywords: ["créer un devis", "rédiger une offre", "positions", "modèle de prix", "forfait", "tarif horaire", "plafond", "cgv", "envoyer"],
  },
  "offerte-detail": {
    title: "Le devis en détail",
    summary: "Positions, historique, lien client et les actions selon le statut.",
    keywords: ["détail du devis", "lien client", "activités", "consulté", "aperçu", "créer un mandat", "pdf"],
  },
  "offerte-bearbeiten": {
    title: "Modifier un devis",
    summary: "Modifier les brouillons — et pourquoi les devis envoyés se verrouillent.",
    keywords: ["modifier un devis", "brouillon", "verrouillé", "envoyé", "non modifiable"],
  },
  "offerte-version": {
    title: "Une nouvelle version d'un devis",
    summary: "Quand quelque chose change après l'envoi — et comment distinguer les moutures.",
    keywords: ["nouvelle version", "version", "mouture", "dépassé", "modifier après envoi", "révision"],
  },
  "nachtrag": {
    title: "Un avenant à un devis",
    summary: "Des prestations supplémentaires après l'accord — avec un accord distinct de la clientèle.",
    keywords: ["avenant", "prestation supplémentaire", "complément", "accord", "accepté", "lien client"],
  },
  "anfragen-liste": {
    title: "La liste des demandes",
    summary: "Toutes les demandes reçues, groupées par prestation — et le chemin vers le devis.",
    keywords: ["demandes", "liste des demandes", "onglets", "avec devis", "étape de vente", "chercher", "supprimer"],
  },
  "anfrage-details": {
    title: "Consulter et corriger une demande",
    summary: "Lire toutes les informations — et rectifier les champs mal reconnus.",
    keywords: ["détail de la demande", "modifier une demande", "corriger", "langue du client", "npa", "changer adresse"],
  },
  "anfrage-importieren": {
    title: "Saisir soi-même une demande",
    summary: "Coller un texte ou dicter — l'analyse remplit les champs, vous les vérifiez.",
    keywords: ["saisir une demande", "nouvelle demande", "import", "saisie vocale", "dicter", "ia", "extraire", "npa"],
  },
  "email-eingang": {
    title: "Contrôler la boîte e-mail",
    summary: "Vérifier, corriger et reprendre les e-mails clients analysés automatiquement.",
    keywords: ["boîte e-mail", "à vérifier", "reprendre", "refuser", "relancer l'analyse", "fiabilité"],
  },
  "auftraege-liste": {
    title: "La liste des mandats",
    summary: "Toutes les interventions avec date, équipe et statut — et ce que vous pouvez faire pour chacune.",
    keywords: ["mandats", "liste des mandats", "intervention", "en retard", "clôturer", "archiver", "équipe"],
  },
  "auftrag-abschliessen": {
    title: "Planifier et clôturer un mandat",
    summary: "Attribuer l'équipe, fixer le prix, clôturer — puis facturer.",
    keywords: ["clôturer un mandat", "attribuer l'équipe", "saisir les heures", "selon dépense", "prix fixe", "prix final"],
  },
  "kalender": {
    title: "Le calendrier",
    summary: "Tous les rendez-vous en vue — affichages, filtres, déplacement et semaine d'équipe.",
    keywords: ["calendrier", "rendez-vous", "semaine", "mois", "filtre", "déplacer", "semaine d'équipe", "ics"],
  },
  "termin-erstellen": {
    title: "Créer un rendez-vous",
    summary: "Type, horaire, équipe et véhicules — et quand le client reçoit une confirmation.",
    keywords: ["créer un rendez-vous", "nouveau rendez-vous", "visite", "bloqué", "récurrent", "véhicule", "conflit"],
  },
};

export default index;
