import { settings as de } from "@/i18n/catalog/de/settings";

export const settings: Record<keyof typeof de, string> = {
  "settings.title": "Paramètres",
  "settings.secret.configured": "Enregistrée",
  "settings.secret.change": "Modifier",
  "settings.secret.notConfigured": "Non enregistrée",
  "settings.secret.saved": "Clé enregistrée",
  "settings.secret.removed": "Clé supprimée",
  "settings.secret.saveFailed": "La clé n'a pas pu être enregistrée",
  "settings.tab.profile": "Profil",
  "settings.tab.notifications": "Notifications",
  "settings.tab.email": "E-mail",
  "settings.tab.sms": "SMS",
  "settings.tab.reminders": "Rappels",
  "settings.tab.agb": "CG",
  "settings.tab.ki": "Intégration IA",
  "settings.tab.calendar": "Calendrier",

  "settings.language.title": "Langue",
  "settings.language.description":
    "Définit la langue de votre tableau de bord ainsi que la langue appliquée aux demandes dont la langue n'a pas été détectée.",
  "settings.language.default": "Langue par défaut de l'entreprise",
  "settings.language.defaultHint":
    "Votre tableau de bord s'affiche dans cette langue. Les nouvelles demandes sans indication de langue sont également traitées ainsi.",
  "settings.language.customerNotice":
    "Les documents et e-mails destinés aux clients suivent toujours la langue du client — et non ce paramètre.",
  "settings.language.saved": "Langue enregistrée.",

  "settings.profile.title": "Profil de l'entreprise",
  "settings.profile.companyName": "Nom de l'entreprise",
  "settings.profile.legalName": "Raison sociale",
  "settings.profile.slogan": "Slogan",
  "settings.profile.primaryColor": "Couleur principale",
  "settings.profile.logo": "Logo",
  "settings.profile.signature": "Signature",
  "settings.profile.vatNumber": "Numéro de TVA",
  "settings.profile.uidNumber": "Numéro IDE",
  "settings.profile.iban": "IBAN",
  "settings.profile.bankName": "Banque",
  "settings.profile.website": "Site web",
  "settings.profile.saved": "Profil enregistré.",

  "settings.pdf.title": "Modèle PDF",
  "settings.pdf.classic": "Classique",
  "settings.pdf.modern": "Moderne",

  "settings.notifications.email": "E-mail de notification",
  "settings.notifications.phone": "Téléphone de notification",
  "settings.email.apiKey": "Clé API Resend",
  "settings.email.fromName": "Nom de l'expéditeur",
  "settings.email.fromEmail": "E-mail de l'expéditeur",
  "settings.email.test": "Envoyer un e-mail de test",
  "settings.sms.accountSid": "Twilio Account SID",
  "settings.sms.authToken": "Twilio Auth Token",
  "settings.sms.phoneNumber": "Numéro de téléphone Twilio",

  "settings.pageTitle": "Paramètres | Entreprise",
  "settings.subtitle":
    "Configurez le profil de l'entreprise, les notifications, l'envoi d'e-mails et les CG.",
  "settings.companyNotFound": "Entreprise introuvable",
  "settings.unsavedChanges": "Modifications non enregistrées",
  "settings.saveFailed": "Les modifications n'ont pas pu être enregistrées.",

  "settings.profile.description": "Modifiez les informations de votre entreprise",
  "settings.profile.companyData": "Données de l'entreprise",
  "settings.profile.primaryColorHint":
    "Cette couleur est utilisée dans vos devis PDF",

  "settings.pdf.offerTitle": "Modèle PDF du devis",
  "settings.pdf.hint":
    "Mise en page utilisée pour vos devis PDF (téléchargement, envoi et vue client)",
  "settings.pdf.classicDesc": "Mise en page standard éprouvée avec tableau des prestations",
  "settings.pdf.modernDesc":
    "Nouveau design avec aperçu « En un coup d'œil » et cartes de prestations",

  "settings.notifications.description": "Configurez vos préférences de notification",
  "settings.notifications.emailPlaceholder":
    "Si différente de l'adresse e-mail principale",
  "settings.notifications.emailHint":
    "Laissez vide pour utiliser l'adresse e-mail principale",
  "settings.notifications.phoneLabel": "Téléphone de notification (SMS)",

  "settings.email.title": "Adresse e-mail personnalisée (Resend)",
  "settings.email.description":
    "Envoyez vos devis depuis votre propre adresse e-mail plutôt que via le système",
  "settings.email.setupTitle": "Comment configurer votre propre adresse e-mail :",
  "settings.email.step1": "Créez un compte sur",
  "settings.email.step2": "Vérifiez votre domaine sous",
  "settings.email.step3": "Créez une clé API sous",
  "settings.email.step4": "Saisissez les données ici",
  "settings.email.useOwn": "Utiliser sa propre adresse e-mail",
  "settings.email.useOwnHint":
    "Les devis sont envoyés depuis votre propre adresse d'expéditeur",
  "settings.email.fromEmailHint": "Le domaine doit être vérifié",
  "settings.email.configComplete":
    "Configuration e-mail complète — les devis sont envoyés depuis votre adresse",
  "settings.email.disabledNote":
    "Si cette option est désactivée, les devis sont envoyés depuis l'adresse e-mail système configurée.",
  "settings.email.testTitle": "Tester la configuration e-mail",
  "settings.email.testHint": "Envoyer un e-mail de test à {email}",
  "settings.email.testButton": "Envoyer le test",
  "settings.email.testMissingConfig":
    "Veuillez d'abord enregistrer la clé API et l'adresse e-mail de l'expéditeur.",
  "settings.email.testSuccess": "Test réussi",
  "settings.email.testSuccessDescription": "Un e-mail de test a été envoyé à {email}.",
  "settings.email.testFailed": "Échec du test",
  "settings.email.testFailedDescription": "L'e-mail de test n'a pas pu être envoyé.",
  "settings.email.sessionExpired": "Session expirée",
  "settings.email.sessionExpiredDescription":
    "Veuillez vous reconnecter et réessayer.",
  "settings.email.saved": "Les paramètres e-mail ont été enregistrés.",
  "settings.email.saveFailed": "Les paramètres e-mail n'ont pas pu être enregistrés.",

  "settings.sms.title": "Rappels SMS (Twilio)",
  "settings.sms.description":
    "Configurez Twilio pour envoyer des rappels SMS à vos clients",
  "settings.sms.setupTitle": "Comment obtenir vos identifiants Twilio :",
  "settings.sms.step1": "Créez un compte sur",
  "settings.sms.step2":
    "Ouvrez la console et copiez votre Account SID ainsi que votre Auth Token",
  "settings.sms.step3": "Achetez un numéro de téléphone pour l'envoi de SMS",
  "settings.sms.step4": "Saisissez les données ici",
  "settings.sms.enable": "Activer Twilio",
  "settings.sms.enableHint": "Activer la fonction SMS pour votre entreprise",
  "settings.sms.accountSidLabel": "Account SID",
  "settings.sms.authTokenLabel": "Auth Token",
  "settings.sms.authTokenPlaceholder": "Votre Auth Token",
  "settings.sms.phoneNumberHint":
    "Le numéro de téléphone depuis lequel les SMS sont envoyés (au format E.164)",
  "settings.sms.remindersEnable": "Activer les rappels SMS",
  "settings.sms.remindersHint":
    "Les clients reçoivent des rappels par SMS en plus de l'e-mail",
  "settings.sms.configComplete": "Configuration Twilio complète",
  "settings.sms.saved": "Les paramètres Twilio ont été enregistrés.",
  "settings.sms.saveFailed": "Les paramètres Twilio n'ont pas pu être enregistrés.",

  "settings.agb.title": "Conditions générales (CG)",
  "settings.agb.description":
    "Créez des sections de CG structurées, avec titre et contenu, pour chaque type de prestation. Elles sont automatiquement jointes en PDF à chaque devis et acceptées juridiquement lors de l'acceptation.",

  "settings.ki.description":
    "Choisissez votre fournisseur d'IA et enregistrez votre clé API. Vos propres clés sont prioritaires sur la clé du serveur.",
  "settings.ki.provider": "Fournisseur d'IA",
  "settings.ki.active": "Actif",
  "settings.ki.apiKeyFor": "Clé API {provider}",
  "settings.ki.keySet": "Clé enregistrée.",
  "settings.ki.keyMissing": "Aucune clé enregistrée.",
  "settings.ki.keyMissingFallback":
    "Aucune clé — la clé du serveur est utilisée par défaut.",
  "settings.ki.model": "Modèle",
  "settings.ki.modelHint": "Laisser vide = valeur par défaut ({model}).",
  "settings.ki.allModels": "Tous les modèles",
  "settings.ki.save": "Enregistrer les paramètres IA",
  "settings.ki.saved": "Les paramètres IA ont été enregistrés.",
  "settings.ki.saveFailed": "Les paramètres IA n'ont pas pu être enregistrés.",

  // --- Boite de reception e-mail (webhook Resend) -----------------------------
  "settings.inbound.title": "Boîte de réception e-mail",
  "settings.inbound.description":
    "Les messages envoyés à votre adresse de demande arrivent automatiquement dans la boîte de réception. Pour que Resend les signale ici, un webhook est nécessaire.",
  "settings.inbound.webhookUrl": "Adresse du webhook",
  "settings.inbound.webhookUrlHint":
    "Saisissez cette adresse dans le tableau de bord Resend sous Webhooks, événement « email.received ».",
  "settings.inbound.webhookUrlMissing":
    "L'adresse ne peut pas être formée — l'adresse du serveur manque dans cette installation.",
  "settings.inbound.event": "Événement",
  "settings.inbound.alias": "Adresse de réception",
  "settings.inbound.aliasHint":
    "Associe les messages entrants à cette entreprise. Les modifications sont effectuées par l'exploitant.",
  "settings.inbound.aliasMissing": "Aucune adresse enregistrée",
  "settings.inbound.secret": "Secret du webhook",
  "settings.inbound.copied": "Copié dans le presse-papiers",
  "settings.inbound.copyFailed": "Copie impossible — veuillez sélectionner manuellement",

  "settings.calfeed.title": "Connecter le calendrier",
  "settings.calfeed.description":
    "Abonnez-vous à vos rendez-vous CRM dans Apple Calendar, Google Agenda ou Outlook. L'abonnement est en lecture seule : les modifications du CRM apparaissent dans le calendrier, jamais l'inverse. La fréquence d'actualisation est décidée par le client de calendrier.",
  "settings.calfeed.securityNotice":
    "Le lien est un mot de passe : quiconque le connaît voit vos rendez-vous. Ne le transmettez pas. En cas de doute, révoquez le jeton et créez-en un nouveau.",
  "settings.calfeed.createTitle": "Créer un nouveau jeton",
  "settings.calfeed.labelPlaceholder": "Désignation, p. ex. « iPhone Anna »",
  "settings.calfeed.createButton": "Créer le jeton",
  "settings.calfeed.created":
    "Jeton créé. Les liens ci-dessous ne s'affichent qu'une seule fois — copiez-les maintenant et ajoutez-les à votre calendrier.",
  "settings.calfeed.createFailed": "Le jeton n'a pas pu être créé",
  "settings.calfeed.linksTitle": "Liens d'abonnement pour ce jeton",
  "settings.calfeed.copy": "Copier",
  "settings.calfeed.copied": "Copié dans le presse-papiers",
  "settings.calfeed.copyFailed": "Copie impossible — veuillez sélectionner manuellement",
  "settings.calfeed.urlMissing":
    "L'adresse ne peut pas être construite — l'adresse du serveur manque dans cette installation.",
  "settings.calfeed.tokensTitle": "Jetons existants",
  "settings.calfeed.noTokens": "Aucun jeton pour l'instant.",
  "settings.calfeed.colLabel": "Désignation",
  "settings.calfeed.colCreated": "Créé",
  "settings.calfeed.colLastUsed": "Dernière utilisation",
  "settings.calfeed.neverUsed": "Jamais",
  "settings.calfeed.unnamed": "Sans désignation",
  "settings.calfeed.revoke": "Révoquer",
  "settings.calfeed.revokeConfirmTitle": "Révoquer le jeton ?",
  "settings.calfeed.revokeConfirmBody":
    "Tous les abonnements de calendrier créés avec ce jeton cesseront immédiatement de fonctionner. Cette action est irréversible.",
  "settings.calfeed.revokeCancel": "Annuler",
  "settings.calfeed.revokeConfirm": "Révoquer",
  "settings.calfeed.revoked": "Jeton révoqué — tous les abonnements associés sont morts.",
  "settings.calfeed.revokeFailed": "Le jeton n'a pas pu être révoqué",
  "settings.calfeed.loadFailed": "Les jetons n'ont pas pu être chargés",
  "settings.calfeed.typ.besichtigung": "Visites",
  "settings.calfeed.typ.service": "Prestations",
  "settings.calfeed.typ.follow_up": "Relances",
  "settings.calfeed.typ.meeting": "Réunions",
  "settings.calfeed.typ.blocked": "Plages bloquées",
  "settings.calfeed.typ.other": "Autres rendez-vous",
  "settings.toast.tenantMismatch":
    "Les données d'entreprise chargées n'appartiennent pas à l'entreprise sélectionnée. Veuillez recharger la page — rien n'a été enregistré.",

};
