import { nav as de } from "@/i18n/catalog/de/nav";

export const nav: Record<keyof typeof de, string> = {
  "nav.group.hauptbereich": "Espace principal",
  "nav.group.betrieb": "Exploitation",
  "nav.group.verwaltung": "Administration",

  "nav.overview": "Vue d'ensemble",
  "nav.anfragen": "Demandes",
  "nav.kalender": "Calendrier",
  "nav.offerten": "Devis",
  "nav.auftraege": "Mandats",
  "nav.quittungen": "Reçus",
  "nav.rechnungen": "Factures",
  "nav.besichtigungen": "Visites",
  "nav.umzugsboxen": "Cartons de déménagement",
  "nav.team": "Équipe",
  "nav.checkliste": "Check-list",
  "nav.leistungskatalog": "Mes prestations",
  "nav.preisgestaltung": "Mes tarifs",
  "nav.archiv": "Archives",
  "nav.einstellungen": "Paramètres",

  "nav.notifications": "Notifications",
  "nav.notifications.empty": "Aucune nouvelle notification",
  "nav.notifications.markAllRead": "Tout marquer comme lu",
  "nav.logout": "Se déconnecter",
  "nav.account": "Compte",
  "nav.menu": "Menu",

  "nav.workspace": "Espace de travail",
  "nav.searchPlaceholder": "Rechercher ou saisir une commande …",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",
  "nav.user": "Utilisateur",
  "nav.switchCompany": "Changer d'entreprise",

  "nav.role.owner": "Propriétaire",
  "nav.role.admin": "Administrateur",
  "nav.role.member": "Collaborateur",

  "nav.state.on": "Activé",
  "nav.state.off": "Désactivé",
  "nav.sound.on": "Son activé",
  "nav.sound.off": "Son désactivé",
  "nav.push.on": "Notifications push activées",
  "nav.push.off": "Notifications push désactivées",
  "nav.push.blocked": "Notifications bloquées",

  "nav.noCompany.title": "Aucune entreprise trouvée",
  "nav.noCompany.description":
    "Votre compte n'est lié à aucune entreprise. Veuillez contacter le support.",
  "nav.notVerified.title": "Entreprise pas encore vérifiée",
  "nav.notVerified.description":
    "Votre compte d'entreprise est enregistré, mais pas encore activé. Veuillez contacter le support.",

  "nav.notifications.show": "Afficher les notifications",
  "nav.notifications.emptyHint": "Vous êtes à jour.",
  "nav.notifications.markAllReadShort": "Tout lu",
  "nav.notifications.clearAll": "Tout supprimer",
  "nav.notifications.new": "{count} nouvelles notifications",
  "nav.notifications.new#one": "{count} nouvelle notification",
  "nav.notifications.new#other": "{count} nouvelles notifications",
  "nav.notifications.unread": "{count} non lues",
  "nav.notifications.unread#one": "{count} non lue",
  "nav.notifications.unread#other": "{count} non lues",
  "nav.notifications.count": "{count} notifications",
  "nav.notifications.count#one": "{count} notification",
  "nav.notifications.count#other": "{count} notifications",

  "nav.notifications.reschedule.proposed": "{date} • {time}",
  "nav.notifications.reschedule.accept": "Accepter",
  "nav.notifications.reschedule.reject": "Refuser",
  "nav.notifications.reschedule.confirmed": "Report du rendez-vous confirmé",
  "nav.notifications.reschedule.confirmedDescription":
    "Nouveau rendez-vous : {date} à {time}",
  "nav.notifications.reschedule.rejected": "Report du rendez-vous refusé",
  "nav.notifications.reschedule.rejectedDescription":
    "Le client en a été informé par e-mail.",

  "nav.notifications.error.noMetadata": "Aucune donnée trouvée pour cette notification",
  "nav.notifications.error.incompleteData": "Données incomplètes pour cette action",
  "nav.notifications.error.appointmentNotFound": "Rendez-vous introuvable",
  "nav.notifications.error.processing": "Erreur lors du traitement",
  "nav.notifications.error.retry": "Veuillez réessayer",

  "nav.notifications.newAppointment": "Nouveau rendez-vous : {type}",
  "nav.notifications.appointmentOn": "{title} le {date}",
  "nav.notifications.appointmentStatusChanged": "Rendez-vous : {status}",
};
