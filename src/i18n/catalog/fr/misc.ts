import { misc as de } from "@/i18n/catalog/de/misc";

/**
 * Français (Suisse romande), registre professionnel, vouvoiement.
 * L'allemand fait foi pour l'ensemble des clés — une clé manquante est une erreur
 * de compilation.
 */
export const misc: Record<keyof typeof de, string> = {
  // --- Actions / libellés partagés -------------------------------------------
  "misc.action.update": "Mettre à jour",
  "misc.action.refresh": "Actualiser",
  "misc.action.deleting": "Suppression en cours…",
  "misc.contact.call": "Appeler",
  "misc.options": "Options de {name}",

  // --- Tableau de bord --------------------------------------------------------
  "dashboard.pageTitle": "Aperçu · CRM",
  "dashboard.title": "Aperçu",
  "dashboard.subtitle":
    "Toutes les demandes en cours, les offres et les rendez-vous du jour en un coup d'œil.",
  "dashboard.open": "en cours",
  "dashboard.action.newLead": "Saisir une demande",

  "dashboard.kpi.newLeads": "Nouvelles demandes",
  "dashboard.kpi.newLeadsHint": "Reçues aujourd'hui",
  "dashboard.kpi.openOffers": "Offres en attente",
  "dashboard.kpi.openOffersHint": "En attente de réponse",
  "dashboard.kpi.jobsThisMonth": "Mandats ce mois-ci",
  "dashboard.kpi.jobsThisMonthHint": "Interventions planifiées",
  "dashboard.kpi.besichtigungen": "Visites",
  "dashboard.kpi.besichtigungenHint": "Avant l'attribution du mandat",

  "dashboard.today.title": "Aujourd'hui",
  "dashboard.today.scheduled": "rendez-vous planifiés",
  "dashboard.today.scheduled#one": "rendez-vous planifié",
  "dashboard.today.scheduled#other": "rendez-vous planifiés",

  "dashboard.besichtigung.title": "Demandes de visite",
  "dashboard.besichtigung.subtitle":
    "Des clients souhaitent une visite avant d'attribuer le mandat",
  "dashboard.besichtigung.requestedOn": "Souhaitée le {date}",
  "dashboard.besichtigung.requestedOnAt": "Souhaitée le {date} à {time}",
  "dashboard.besichtigung.openOffer": "Offre",

  "dashboard.recentLeads.title": "Dernières demandes",
  "dashboard.recentLeads.subtitle": "Vos leads les plus récents",
  "dashboard.recentLeads.showAll": "Tout afficher",
  "dashboard.recentLeads.empty": "Aucune demande reçue pour l'instant",
  "dashboard.recentLeads.emptyHint":
    "Les nouveaux leads apparaissent ici automatiquement",
  "dashboard.minutesShort": "min",

  "dashboard.leadStatus.sent": "Nouveau",
  "dashboard.leadStatus.accepted": "Accepté",
  "dashboard.leadStatus.rejected": "Refusé",

  "dashboard.boxes.subtitle": "Locations en cours",
  "dashboard.boxes.manage": "Gérer les cartons",

  "dashboard.pendingLeads": "nouvelles demandes",
  "dashboard.pendingLeads#one": "nouvelle demande",
  "dashboard.pendingLeads#other": "nouvelles demandes",
  "dashboard.pendingLeads.hint": "À examiner et à traiter dès maintenant",

  "dashboard.allClear.title": "Tout est en ordre",
  "dashboard.allClear.description": "Aucune affaire en suspens pour le moment.",
  "dashboard.quickAccess": "Accès rapide",

  // --- Équipe et ressources ---------------------------------------------------
  "team.pageTitle": "Équipe | Entreprise",
  "team.title": "Gestion de l'équipe",
  "team.subtitle":
    "Gérez les collaborateurs, les véhicules et l'équipement — attribuez les rendez-vous et vérifiez les disponibilités.",

  "team.members": "collaborateurs",
  "team.members#one": "collaborateur",
  "team.members#other": "collaborateurs",
  "team.vehicles": "véhicules",
  "team.vehicles#one": "véhicule",
  "team.vehicles#other": "véhicules",
  "team.equipment": "équipements",
  "team.equipment#one": "équipement",
  "team.equipment#other": "équipements",

  "team.action.addResource": "Ressource",
  "team.action.addMember": "Collaborateur",
  "team.action.addFirstMember": "Ajouter le premier collaborateur",
  "team.action.addVehicle": "Ajouter un véhicule",
  "team.action.addEquipment": "Ajouter un équipement",

  "team.members.empty": "Aucun collaborateur pour l'instant",
  "team.members.emptyHint": "Ajoutez les membres de votre équipe",
  "team.vehicles.empty": "Aucun véhicule enregistré pour l'instant",
  "team.equipment.empty": "Aucun équipement enregistré pour l'instant",

  "team.member.new": "Nouveau collaborateur",
  "team.member.edit": "Modifier le collaborateur",
  "team.resource.new": "Nouvelle ressource",
  "team.resource.edit": "Modifier la ressource",
  "team.resource.vehicle": "Véhicule",
  "team.resource.equipment": "Équipement",

  "team.field.role": "Fonction",
  "team.field.rolePlaceholder": "Sélectionner une fonction",
  "team.field.color": "Couleur",
  "team.field.colorSelect": "Sélectionner la couleur {color}",
  "team.field.licensePlate": "Plaque d'immatriculation",
  "team.field.capacity": "Capacité (m³)",
  "team.field.quantity": "Quantité",
  "team.placeholder.vehicleName": "p. ex. camion de déménagement 25 m³",
  "team.placeholder.equipmentName": "p. ex. diable pour coffre-fort",
  "team.equipment.available": "{count}x disponible(s)",

  "team.delete.title": "Confirmer la suppression",
  "team.delete.member":
    "Voulez-vous vraiment supprimer ce collaborateur ? Cette action est irréversible.",
  "team.delete.resource":
    "Voulez-vous vraiment supprimer cette ressource ? Cette action est irréversible.",

  "team.role.fahrer": "Chauffeur",
  "team.role.helfer": "Aide-déménageur",
  "team.role.reiniger": "Agent de nettoyage",
  "team.role.teamleiter": "Chef d'équipe",
  "team.role.buero": "Administration",

  "team.color.blue": "Bleu",
  "team.color.green": "Vert",
  "team.color.violet": "Violet",
  "team.color.amber": "Ambre",
  "team.color.red": "Rouge",
  "team.color.pink": "Rose",
  "team.color.cyan": "Cyan",
  "team.color.lime": "Vert citron",
  "team.color.orange": "Orange",
  "team.color.indigo": "Indigo",

  "team.toast.loadFailed": "Erreur lors du chargement des données",
  "team.toast.nameRequired": "Veuillez saisir le prénom et le nom",
  "team.toast.invalidEmail": "Veuillez saisir une adresse e-mail valide",
  "team.toast.memberSaved": "Collaborateur enregistré",
  "team.toast.memberUpdated": "Collaborateur mis à jour",
  "team.toast.memberAdded": "Collaborateur ajouté",
  "team.toast.memberDeleted": "Collaborateur supprimé",
  "team.toast.resourceNameRequired": "Veuillez saisir un nom",
  "team.toast.resourceUpdated": "Ressource mise à jour",
  "team.toast.resourceAdded": "Ressource ajoutée",
  "team.toast.resourceDeleted": "Ressource supprimée",
  "team.toast.saveFailed": "Erreur lors de l'enregistrement",
  "team.toast.deleteFailed": "Erreur lors de la suppression",

  // --- Cartons de déménagement ------------------------------------------------
  "boxes.subtitle":
    "Gérez les cartons de location et planifiez les enlèvements.",
  "boxes.stats.active": "en cours",
  "boxes.stats.overdue": "en retard",
  "boxes.stats.inCirculation": "en circulation",
  "boxes.action.new": "Nouvelle location",

  "boxes.kpi.active": "En cours",
  "boxes.kpi.overdue": "En retard",
  "boxes.kpi.pickupToday": "À enlever aujourd'hui",
  "boxes.kpi.thisWeek": "Cette semaine",
  "boxes.kpi.inCirculation": "En circulation",

  "boxes.urgent.title": "Enlèvements urgents ({count})",
  "boxes.urgent.description":
    "Ces cartons sont en retard ou doivent être restitués aujourd'hui",
  "boxes.action.schedulePickup": "Planifier l'enlèvement",
  "boxes.action.markReturned": "Marquer comme restitué",
  "boxes.action.downloadPdf": "Télécharger le PDF",

  "boxes.tab.overview": "Aperçu",
  "boxes.tab.dueSoon": "Bientôt à échéance",
  "boxes.tab.history": "Historique",

  "boxes.searchPlaceholder": "Rechercher par nom, localité, téléphone…",
  "boxes.filter.active": "Locations en cours",
  "boxes.filter.all": "Tout afficher",

  "boxes.table.customer": "Client",
  "boxes.table.boxes": "Cartons",
  "boxes.table.city": "Localité",
  "boxes.table.deliveryDate": "Date de livraison",
  "boxes.table.returnDue": "Restitution due",
  "boxes.table.assignee": "Responsable",
  "boxes.table.delivered": "Livré",
  "boxes.table.returned": "Restitué",

  "boxes.count": "cartons",
  "boxes.snapshot.invalid": "Données de caisses invalides",
  "boxes.count#one": "carton",
  "boxes.count#other": "cartons",
  "boxes.overdueDays": "{count} jours de retard",
  "boxes.overdueDays#one": "{count} jour de retard",
  "boxes.overdueDays#other": "{count} jours de retard",
  "boxes.dueToday": "Échéance aujourd'hui",
  "boxes.inDays": "Dans {count} jours",
  "boxes.inDays#one": "Dans {count} jour",
  "boxes.inDays#other": "Dans {count} jours",

  "boxes.dueSoon.title": "Échéance cette semaine",
  "boxes.dueSoon.description":
    "Cartons devant être restitués dans les 7 prochains jours",
  "boxes.dueSoon.empty": "Aucun carton à échéance cette semaine",

  "boxes.history.title": "Historique",
  "boxes.history.description": "Locations restituées et clôturées",
  "boxes.history.empty": "Aucune location clôturée",

  "boxes.delete.title": "Supprimer l'entrée ?",
  "boxes.delete.description":
    "Cette entrée sera définitivement supprimée. Cette action est irréversible.",

  "boxes.status.reserved": "Réservé",
  "boxes.status.delivered": "Livré",
  "boxes.status.in_use": "En cours d'utilisation",
  "boxes.status.pickup_requested": "Enlèvement demandé",
  "boxes.status.pickup_scheduled": "Enlèvement planifié",
  "boxes.status.returned": "Restitué",
  "boxes.status.lost": "Perdu",
  "boxes.status.damaged": "Endommagé",

  "boxes.typeShort.standard": "Standard",
  "boxes.typeShort.wardrobe": "Penderie",
  "boxes.typeShort.book": "Livres",
  "boxes.typeShort.fragile": "Fragile",
  "boxes.typeShort.archive": "Archives",
  "boxes.typeShort.other": "Autres",

  "boxes.type.standard": "Carton de déménagement standard",
  "boxes.type.wardrobe": "Carton-penderie",
  "boxes.type.book": "Carton à livres",
  "boxes.type.fragile": "Fragile / verrerie",
  "boxes.type.archive": "Carton d'archives",
  "boxes.type.other": "Autres",

  "boxes.toast.loadFailed": "Erreur lors du chargement des données",
  "boxes.toast.statusUpdated": "Statut mis à jour",
  "boxes.toast.updateFailed": "Erreur lors de la mise à jour",
  "boxes.toast.deleted": "Entrée supprimée",
  "boxes.toast.deleteFailed": "Erreur lors de la suppression",
  "boxes.toast.companyMissing": "Données de l'entreprise indisponibles",
  "boxes.toast.companyLoadFailed":
    "Les données de l'entreprise n'ont pas pu être chargées",
  "boxes.toast.pdfCreating": "Création du PDF…",
  "boxes.toast.pdfDone": "Le PDF a été téléchargé",
  "boxes.toast.pdfFailed": "Erreur lors de la création du PDF",

  // --- Fenêtre de location ----------------------------------------------------
  "boxModal.title.new": "Nouvelle location de cartons",
  "boxModal.title.edit": "Modifier la location",
  "boxModal.overdue": "En retard !",
  "boxModal.linkLead": "Associer à une demande (facultatif)",
  "boxModal.linkLead.placeholder": "Sélectionner une demande…",
  "boxModal.linkLead.none": "Aucune association",
  "boxModal.customerData": "Données du client",

  "boxModal.delivery.title": "📦 Adresse de livraison (dépose des cartons)",
  "boxModal.delivery.hint":
    "Où les cartons sont livrés dans un premier temps (ancien logement)",
  "boxModal.delivery.streetPlaceholder": "Rue de l'Exemple 1",
  "boxModal.pickup.title": "🚚 Adresse d'enlèvement (reprise des cartons)",
  "boxModal.pickup.hint":
    "Où les cartons seront repris par la suite (nouveau logement)",
  "boxModal.pickup.streetPlaceholder": "Rue Neuve 2",

  "boxModal.boxDetails": "Détails des cartons",
  "boxModal.total": "Total : {count} cartons",
  "boxModal.boxType": "Type de carton",
  "boxModal.addBoxType": "Ajouter un autre type de carton",
  "boxModal.description": "Description (facultative)",
  "boxModal.description.placeholder":
    "Informations complémentaires sur les cartons…",
  "boxModal.isRental": "Cartons en location (à restituer)",

  "boxModal.rentalDetails": "Détails de la location",
  "boxModal.pricePerDay": "Prix de location par jour (CHF)",
  "boxModal.deposit": "Caution (CHF)",
  "boxModal.depositPaid": "Caution versée",

  "boxModal.dates": "Dates",
  "boxModal.deliveryDate": "Date de livraison *",
  "boxModal.expectedReturnDate": "Date de restitution prévue",
  "boxModal.pickupDate": "Date d'enlèvement planifiée",
  "boxModal.pickupTime": "Heure d'enlèvement planifiée",
  "boxModal.reminderDays": "Rappel X jours avant la restitution",
  "boxModal.days": "{count} jours",
  "boxModal.days#one": "{count} jour",
  "boxModal.days#other": "{count} jours",

  "boxModal.teamAssignment": "Attribution à l'équipe",
  "boxModal.assignee": "Responsable de l'enlèvement",
  "boxModal.deliveredBy": "Livré par",
  "boxModal.selectMember": "Choisir un membre de l'équipe…",
  "boxModal.unassigned": "Non attribué",

  "boxModal.internalNotes": "Notes internes",
  "boxModal.internalNotes.placeholder": "Usage interne uniquement…",
  "boxModal.customerNotes": "Indications du client pour l'enlèvement",
  "boxModal.customerNotes.placeholder":
    "p. ex. cartons à la cave, accès par l'entrée arrière",

  "boxModal.error.nameRequired": "Veuillez saisir le nom du client",
  "boxModal.error.invalidEmail": "Veuillez saisir une adresse e-mail valide",
  "boxModal.error.returnBeforeDelivery":
    "La date de restitution doit être postérieure à la date de livraison",
  "boxModal.error.noBoxes":
    "Veuillez saisir au moins un carton avec une quantité supérieure à 0",
  "boxModal.toast.updated": "Location de cartons mise à jour",
  "boxModal.toast.created": "Location de cartons créée",
  "boxModal.toast.saveFailed": "Erreur lors de l'enregistrement",

  // --- Archives et protection des données -------------------------------------
  "archive.title": "Archives et protection des données",
  "archive.subtitle":
    "Gérez les données de l'entreprise conformément au RGPD/LPD — export, suppression et journal d'audit.",
  "archive.noCompany.title": "Aucune entreprise associée",
  "archive.noCompany.description":
    "Pour utiliser les archives, votre compte doit être associé à une entreprise.",

  "archive.gdpr.title": "Protection des données (RGPD/LPD)",
  "archive.gdpr.description":
    "Vous avez le droit d'exporter vos données (portabilité) et de les supprimer (droit à l'oubli). Toutes les actions sont journalisées.",

  "archive.stats.leads": "Leads",
  "archive.stats.offers": "Offres",
  "archive.stats.appointments": "Rendez-vous",
  "archive.stats.team": "Équipe",
  "archive.stats.olderThan": "{count} de plus de {days} jours",
  "archive.stats.activeMembers": "Membres actifs de l'équipe",

  "archive.export.title": "Exporter les données",
  "archive.export.description":
    "Exportez l'ensemble des données de votre entreprise au format JSON ou CSV",
  "archive.export.jsonHint": "Complet, structuré",
  "archive.export.csvHint": "Compatible Excel",
  "archive.export.dialogDescription":
    "Sélectionnez les données à exporter ainsi que le format",
  "archive.export.formatLabel": "Format d'export",
  "archive.export.selectData": "Sélectionner les données",
  "archive.export.running": "Export en cours…",
  "archive.export.submit": "Exporter",
  "archive.export.success": "Données exportées avec succès",
  "archive.export.failed": "Erreur lors de l'export",

  "archive.delete.title": "Supprimer les anciennes données",
  "archive.delete.description":
    "Supprimez les données clôturées de plus de {days} jours",
  "archive.delete.retention": "Durée de conservation",
  "archive.delete.retentionDays": "{count} jours",
  "archive.delete.retentionYear": "1 an",
  "archive.delete.deletable": "Enregistrements supprimables :",
  "archive.delete.confirmTitle": "Supprimer définitivement les données ?",
  "archive.delete.confirmDescription": "Cette action est irréversible !",
  "archive.delete.warning": "Avertissement",
  "archive.delete.warningIntro":
    "Les données suivantes seront définitivement supprimées :",
  "archive.delete.leadsDetail": "{count} leads (clôturés/refusés)",
  "archive.delete.offersDetail": "{count} offres (envoyées/acceptées/refusées)",
  "archive.delete.appointmentsDetail": "{count} rendez-vous (terminés/annulés)",
  "archive.delete.confirmCheckbox":
    "Je comprends que ces données seront supprimées de manière irréversible et j'ai effectué un export si nécessaire.",
  "archive.delete.running": "Suppression en cours…",
  "archive.delete.submit": "Supprimer définitivement",
  "archive.delete.success": "Les anciennes données ont été supprimées",
  "archive.delete.failed": "Erreur lors de la suppression des données",
  "archive.stats.loadFailed": "Erreur lors du chargement des statistiques",

  "archive.info.title": "Informations sur la protection des données",
  "archive.info.export.title": "📤 Export des données (art. 20 RGPD)",
  "archive.info.export.text":
    "Vous pouvez à tout moment exporter l'ensemble de vos données dans un format lisible par machine (JSON/CSV). Cela permet leur transfert vers d'autres services.",
  "archive.info.deletion.title": "🗑️ Droit à l'effacement (art. 17 RGPD)",
  "archive.info.deletion.text":
    "Vous pouvez supprimer les données clôturées dont vous n'avez plus besoin. Les données commerciales actives sont soumises aux délais légaux de conservation.",
  "archive.info.retention.title": "📋 Délais de conservation",
  "archive.info.retention.text":
    "Les documents commerciaux doivent être conservés 10 ans conformément au CO. Nous recommandons d'exporter les données avant toute suppression.",
  "archive.info.security.title": "🔒 Sécurité des données",
  "archive.info.security.text":
    "Toutes les données sont stockées en Suisse/UE et chiffrées. Les suppressions sont irréversibles et journalisées.",

  "archive.type.leads": "Leads (demandes)",
  "archive.type.offers": "Offres",
  "archive.type.email_logs": "Journaux e-mail",
  "archive.type.notifications": "Notifications",
  "archive.type.analytics": "Données analytiques",
  "archive.type.appointments": "Rendez-vous",
  "archive.type.full_backup": "Sauvegarde complète",
  "archive.type.custom": "Personnalisé",

  "archive.storage.local": "Téléchargement local",
  "archive.storage.google_drive": "Google Drive",
  "archive.storage.dropbox": "Dropbox",
  "archive.storage.s3": "Amazon S3",
  "archive.storage.supabase_storage": "Supabase Storage",

  "archive.status.pending": "En attente",
  "archive.status.in_progress": "En cours",
  "archive.status.completed": "Terminé",
  "archive.status.failed": "Échec",
  "archive.status.restored": "Restauré",

  "archive.format.json": "JSON (complet)",
  "archive.format.csv": "CSV (Excel)",
  "archive.format.parquet": "Parquet (Big Data)",

  // --- Connexion / mot de passe -----------------------------------------------
  "auth.brand": "Tableau de bord CRM",
  "auth.login.title": "Se connecter",
  "auth.login.pageTitle": "Connexion | CRM",
  "auth.login.submitting": "Connexion…",
  "auth.forgot.title": "Mot de passe oublié",
  "auth.forgot.pageTitle": "Mot de passe oublié | CRM",
  "auth.forgot.description":
    "Saisissez votre adresse e-mail. Nous vous enverrons un lien de réinitialisation.",
  "auth.forgot.link": "Mot de passe oublié ?",
  "auth.forgot.submit": "Envoyer le lien",
  "auth.forgot.submitting": "Envoi…",
  "auth.field.password": "Mot de passe",
  "auth.field.emailPlaceholder": "votre@email.ch",
  "auth.password.show": "Afficher le mot de passe",
  "auth.password.hide": "Masquer le mot de passe",
  "auth.backToLogin": "Retour à la connexion",

  "auth.resetSent.title": "E-mail envoyé !",
  "auth.resetSent.description":
    "Nous vous avons envoyé un lien de réinitialisation. Veuillez consulter votre boîte de réception.",
  "auth.toast.resetSent.title": "E-mail envoyé",
  "auth.toast.resetSent.description":
    "Consultez votre boîte de réception pour le lien de réinitialisation.",
  "auth.toast.loginFailed": "Échec de la connexion",
  "auth.toast.invalidCredentials": "L'e-mail ou le mot de passe est incorrect.",
  "auth.toast.welcome": "Bienvenue !",
  "auth.toast.welcomeDescription": "Vous êtes connecté.",

  "auth.noCompany.pageTitle": "Accès refusé | CRM",
  "auth.noCompany.title": "Aucune entreprise associée",
  "auth.noCompany.description":
    "Votre compte {email} n'est associé à aucune entreprise.",
  "auth.noCompany.whatToDo": "Que pouvez-vous faire ?",
  "auth.noCompany.step1": "Contactez l'administrateur",
  "auth.noCompany.step2": "Vérifiez que vous utilisez la bonne adresse e-mail",
  "auth.noCompany.signOut": "Se déconnecter et utiliser un autre compte",

  "auth.pending.pageTitle": "Vérification en cours | CRM",
  "auth.pending.title": "Vérification en cours",
  "auth.pending.description": "Votre compte {email} n'est pas encore activé.",
  "auth.pending.whatNow": "Que se passe-t-il maintenant ?",
  "auth.pending.step1": "Le profil de votre entreprise est en cours d'examen",
  "auth.pending.step2":
    "Après activation, vous aurez accès au tableau de bord",
  "auth.pending.signOut": "Se déconnecter",

  "auth.reset.pageTitle": "Définir un nouveau mot de passe | CRM",
  "auth.reset.title": "Définir un nouveau mot de passe",
  "auth.reset.description": "Saisissez votre nouveau mot de passe.",
  "auth.reset.newPassword": "Nouveau mot de passe",
  "auth.reset.newPasswordPlaceholder": "8 caractères au minimum",
  "auth.reset.confirmPassword": "Confirmer le mot de passe",
  "auth.reset.confirmPasswordPlaceholder": "Répéter le mot de passe",
  "auth.reset.submit": "Enregistrer le mot de passe",
  "auth.reset.submitting": "Enregistrement…",
  "auth.reset.success.title": "Mot de passe modifié !",
  "auth.reset.success.description": "Vous allez être redirigé sous peu…",
  "auth.reset.success.toEnter": "Vers le tableau de bord",
  "auth.reset.toast.changed": "Mot de passe modifié",
  "auth.reset.toast.changedDescription":
    "Votre mot de passe a été mis à jour avec succès.",
  "auth.reset.toast.linkExpired": "Lien expiré",
  "auth.reset.toast.linkExpiredDescription":
    "Veuillez demander un nouveau lien de réinitialisation.",

  // --- 404 ---------------------------------------------------------------------
  "notFound.title": "404",
  "notFound.message": "Cette page n'existe pas.",
  "notFound.home": "Retour à l'accueil",

  // --- Rappels ------------------------------------------------------------------
  "reminders.title": "Paramètres des rappels",
  "reminders.description":
    "Configurez les rappels automatiques par e-mail pour vos collaborateurs et vos clients",
  "reminders.team.title": "Rappels à l'équipe",
  "reminders.team.description":
    "E-mails adressés aux collaborateurs concernés avant les rendez-vous",
  "reminders.customer.title": "Rappels aux clients",
  "reminders.customer.description":
    "E-mails adressés aux clients avant leurs rendez-vous",
  "reminders.sendAt": "Envoyer le rappel :",
  "reminders.hoursBefore": "{count} heures à l'avance",
  "reminders.hoursBefore#one": "{count} heure à l'avance",
  "reminders.hoursBefore#other": "{count} heures à l'avance",

  "reminders.content.title": "Contenu de l'e-mail",
  "reminders.content.description":
    "Quelles informations les rappels doivent-ils contenir ?",
  "reminders.content.customerPhone": "Téléphone du client",
  "reminders.content.customerEmail": "E-mail du client",
  "reminders.content.leadDetails": "Détails du lead",
  "reminders.content.offerDetails": "Détails de l'offre",
  "reminders.footer.title": "Pied de page personnalisé",
  "reminders.footer.placeholder":
    "Message personnalisé facultatif pour le pied de page de l'e-mail…",

  "reminders.pending.title": "Rappels à venir",
  "reminders.pending.description":
    "Ces rappels seront envoyés automatiquement",
  "reminders.pending.members": "{count} collaborateurs",
  "reminders.pending.members#one": "{count} collaborateur",
  "reminders.pending.members#other": "{count} collaborateurs",
  "reminders.pending.dispatch": "Envoi : {date} {time}",

  "reminders.info.title": "Comment fonctionnent les rappels ?",
  "reminders.info.item1":
    "Les rappels sont envoyés automatiquement avant chaque rendez-vous",
  "reminders.info.item2":
    "Seuls les rendez-vous avec des collaborateurs assignés donnent lieu à des rappels",
  "reminders.info.item3":
    "L'e-mail contient tous les détails essentiels : adresse, nom du client, téléphone",
  "reminders.info.item4":
    "Pour les visites, les détails du lead — y compris la surface du logement — sont transmis",
  "reminders.info.item5":
    "Pour les interventions, les détails de l'offre sont également transmis",

  "reminders.toast.saved": "Paramètres enregistrés",
  "reminders.toast.savedDescription":
    "Vos paramètres de rappel ont été mis à jour avec succès.",
  "reminders.toast.saveFailed": "Les paramètres n'ont pas pu être enregistrés.",

  // --- Téléversement du logo / de la signature ---------------------------------
  "upload.logo.label": "Logo de l'entreprise",
  "upload.logo.empty": "Aucun logo",
  "upload.logo.change": "Modifier le logo",
  "upload.logo.upload": "Téléverser un logo",
  "upload.logo.hint": "JPG, PNG ou WebP. 2 Mo au maximum.",
  "upload.logo.notOptimizedDescription":
    "Le logo n'a pas pu être compressé et sera téléversé dans sa taille d'origine.",
  "upload.logo.uploaded": "Logo téléversé",
  "upload.logo.uploadedDescription":
    "Le logo de votre entreprise a été mis à jour.",
  "upload.logo.removed": "Logo supprimé",
  "upload.logo.removedDescription": "Le logo de votre entreprise a été supprimé.",
  "upload.logo.uploadFailed": "Erreur lors du téléversement du logo",
  "upload.logo.removeFailed": "Le logo n'a pas pu être supprimé.",

  "upload.signature.label": "Signature pour la confirmation de mandat",
  "upload.signature.hint":
    "Cette signature apparaît sur la page de confirmation de mandat du PDF",
  "upload.signature.empty": "Aucune signature",
  "upload.signature.formatHint":
    "PNG à fond transparent recommandé. 1 Mo au maximum.",
  "upload.signature.notOptimizedDescription":
    "La signature n'a pas pu être compressée et sera téléversée dans sa taille d'origine.",
  "upload.signature.uploaded": "Signature téléversée",
  "upload.signature.uploadedDescription": "Votre signature a été enregistrée.",
  "upload.signature.removed": "Signature supprimée",
  "upload.signature.removedDescription": "Votre signature a été supprimée.",
  "upload.signature.uploadFailed": "Erreur lors du téléversement de la signature",
  "upload.signature.removeFailed": "La signature n'a pas pu être supprimée.",

  "upload.error.invalidType": "Type de fichier non valide",
  "upload.error.invalidTypeLogo":
    "Veuillez choisir un fichier JPG, PNG ou WebP. Le format SVG n'est pas pris en charge.",
  "upload.error.invalidTypeSignature":
    "Veuillez choisir un fichier JPG, PNG ou WebP.",
  "upload.error.tooLarge": "Fichier trop volumineux",
  "upload.error.tooLargeDescription":
    "Le fichier pèse {size} Mo. La taille maximale autorisée est de {max} Mo.",
  "upload.error.sessionExpired": "Session expirée",
  "upload.error.sessionExpiredDescription":
    "Veuillez recharger la page ou vous reconnecter.",
  "upload.notOptimized": "Image non optimisée",
  "upload.change": "Modifier",

  // --- Saisie vocale ------------------------------------------------------------
  "voice.unsupported":
    "Votre navigateur ne prend pas en charge l'enregistrement audio. Veuillez utiliser une version récente de Chrome, Firefox ou Edge.",
  "voice.start": "Saisie vocale",
  "voice.recording": "Enregistrement en cours — {duration}",
  "voice.stop": "Arrêter",
  "voice.transcribing": "Transcription en cours…",
  "voice.done":
    "Transcription terminée — veuillez la vérifier et la corriger si nécessaire :",
  "voice.edit": "Modifier la transcription",
  "voice.extract": "Extraire avec l'IA",
  "voice.discard": "Abandonner",

  // --- Sélection des NPA par canton ---------------------------------------------
  "plz.open": "Sélectionner les NPA par canton",
  "plz.description":
    "Sélectionnez les zones NPA dans lesquelles vous intervenez. Cliquez sur un canton pour afficher tous ses NPA.",
  "plz.searchPlaceholder": "Rechercher un NPA, une localité ou un canton…",
  "plz.selected": "{count} NPA sélectionnés",
  "plz.pendingAdd": "+{count} nouveaux",
  "plz.pendingRemove": "-{count} retirés",
  "plz.selectAll": "Tout sélectionner",
  "plz.deselectAll": "Tout désélectionner",
  "plz.save": "Enregistrer les modifications",
  "plz.saved": "Enregistré",
  "plz.savedDescription": "{added} NPA ajoutés, {removed} NPA retirés.",
  "plz.loadFailed": "Les données NPA n'ont pas pu être chargées.",
  "plz.saveFailed": "Les modifications n'ont pas pu être enregistrées.",

  "canton.AG": "Argovie",
  "canton.AI": "Appenzell Rhodes-Intérieures",
  "canton.AR": "Appenzell Rhodes-Extérieures",
  "canton.BE": "Berne",
  "canton.BL": "Bâle-Campagne",
  "canton.BS": "Bâle-Ville",
  "canton.FR": "Fribourg",
  "canton.GE": "Genève",
  "canton.GL": "Glaris",
  "canton.GR": "Grisons",
  "canton.JU": "Jura",
  "canton.LU": "Lucerne",
  "canton.NE": "Neuchâtel",
  "canton.NW": "Nidwald",
  "canton.OW": "Obwald",
  "canton.SG": "Saint-Gall",
  "canton.SH": "Schaffhouse",
  "canton.SO": "Soleure",
  "canton.SZ": "Schwytz",
  "canton.TG": "Thurgovie",
  "canton.TI": "Tessin",
  "canton.UR": "Uri",
  "canton.VD": "Vaud",
  "canton.VS": "Valais",
  "canton.ZG": "Zoug",
  "canton.ZH": "Zurich",
};
