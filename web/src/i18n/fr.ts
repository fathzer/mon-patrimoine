export const fr = {
  app: {
    title: "Mon Patrimoine",
    loading: "Chargement du patrimoine..."
  },
  auth: {
    loginBtn: "Connexion",
    logoutBtn: "Déconnexion",
    unsavedWarning: "Des modifications n'ont pas encore été synchronisées avec le Cloud. Elles seront perdues si vous vous déconnectez maintenant.",
    demoBtn: "ou tester Mon Patrimoine en mode démo",
    waiting: "En attente de connexion...",
    chooseProvider: "Choisissez le service de stockage de vos données :",
    connectFailed: "La connexion a échoué.",
    connectRetry: "Vous pouvez réessayer en cliquant sur le bouton de connexion en haut à droite de la page.",
    // One wording per AuthFailureKind — the provider classifies its native
    // error, this table owns the message (see ui/authFailure.ts).
    failure: {
      popupBlocked: "Une cause probable : votre navigateur a bloqué la fenêtre pop-up nécessaire à la connexion.",
      popupBlockedHow: "Pour l'autoriser : cliquez sur l'icône de pop-up bloqué dans la barre d'adresse du navigateur, ou ouvrez les réglages du site (icône à gauche de l'adresse) et autorisez les fenêtres pop-up. Dans l'application installée, ce réglage se trouve dans les paramètres du site depuis le menu de l'application.",
      popupClosed: "La fenêtre de connexion a été fermée avant la fin de l'authentification.",
      accessDenied: "L'accès à votre espace de stockage a été refusé.",
      error: "Une erreur est survenue pendant la connexion."
    }
  },
  demo: {
    banner: "Mode démo — vos modifications ne sont pas sauvegardées"
  },
  summary: {
    totalGross: "Patrimoine Brut",
    totalNet: "Patrimoine Net Estimé",
    filterTotals: "Uniquement les actifs filtrés",
    breakdownTitle: "Répartition par classe d'actifs",
    gross: "Brut",
    net: "Net"
  },
  categories: {
    bank_accounts: "Comptes courants",
    investments: "Investissements",
    saving_accounts: "Livrets",
    life_insurance: "Assurance-vie",
    real_estate: "Immobilier",
    other: "Divers"
  },
  filters: {
    all: "Tous les actifs",
    categories: "Type d'actif",
    institutions: "Établissement",
    withoutInstitution: "Sans établissement",
    clearAll: "Effacer les filtres"
  },
  actions: {
    addAsset: "+ Ajouter un actif",
    save: "Enregistrer",
    saveStay: "Enregistrer sans fermer",
    cancel: "Annuler",
    delete: "Supprimer",
    confirmDelete: "Supprimer définitivement cet actif ?",
    confirmDeleteWithHistory: "Supprimer définitivement cet actif ? Son historique ({count} états) sera perdu.",
    "import": "Importer",
    "export": "Exporter"
  },
  sort: {
    label: "Trier"
  },
  table: {
    assetHeader: "Actif / Établissement",
    categoryHeader: "Catégorie",
    grossHeader: "Valeur Brute",
    socialHeader: "Prélmts Sociaux",
    taxHeader: "Impôts",
    netHeader: "Valeur Nette Est."
  },
  form: {
    addTitle: "Ajouter un actif",
    editTitle: "Éditer l'actif",
    label: "Nom",
    institution: "Établissement",
    typeLabel: "Type d'actif",
    category: "Catégorie",
    currentValue: "Valeur actuelle (€)",
    openingDate: "Date d'ouverture",
    closed: "Actif clôturé",
    closedAt: "Date de clôture",
    close: "Fermer",
    errors: {
      label: "Nom requis",
      closedAt: "Date de clôture requise",
      afterClosure: "La date éditée ne peut être postérieure à la clôture",
      institution: "Établissement requis",
      currentValue: "Valeur actuelle requise",
      openingDate: "Date d'ouverture incorrecte",
      generic: "Champ requis",
      invalidAmount: "Montant ou formule invalide"
    },
    acquisitionDate: "Date d'acquisition",
    acquisitionPrice: "Prix d'acquisition (€)",
    amountHint: "Vous pouvez saisir une formule, ex. 1000*(1+5%)"
  },
  syncBanner: {
    conflict: "Vos modifications locales sont en conflit avec la version enregistrée dans le Cloud.",
    keepLocal: "Garder ma version",
    keepCloud: "Garder la version Cloud",
    savePending: "Échec de la sauvegarde — nouvelle tentative {time}.",
    retryAt: "à {time}",
    retrySoon: "dès que possible",
    remoteUpdate: "Une nouvelle version de vos données est disponible dans le Cloud.",
    update: "Mettre à jour"
  },
  alerts: {
    saveError: "La sauvegarde a échoué. Vos dernières modifications pourraient ne pas être conservées.",
    loadError: "Le chargement de vos données a échoué. Vos données existantes n'ont pas été modifiées.",
    importError: "Le fichier sélectionné n'est pas valide ou n'a pas pu être lu."
  },
  storage: {
    dialog: {
      whyTitle: "Pourquoi cette fenêtre ?",
      whatTitle: "Ce que vous devez faire :",
      cancel: "Annuler",
      reconnect: {
        title: "Reconnexion requise",
        section: "Expiration du jeton d'accès",
        why: "Votre jeton d'accès à Google Drive a expiré. Pour des raisons de sécurité, Google interdit la reconnexion automatique sans intervention utilisateur explicite à moins de faire transiter vos données de connexion sur nos serveurs. Ce transit serait une violation de notre promesse « Aucune de vos données ne nous est envoyée ».",
        what: "Cliquez sur le bouton « Se reconnecter » ci-dessous pour autoriser à nouveau l'accès à votre Google Drive. Une fenêtre pop-up s'ouvrira pour vous demander de confirmer l'autorisation.",
        warning: "Important : assurez-vous que votre navigateur autorise les pop-ups pour ce site, sinon la fenêtre de connexion Google ne s'ouvrira pas. Si vous voyez une icône de pop-up bloqué dans la barre d'adresse, cliquez dessus pour autoriser les pop-ups temporairement.",
        confirm: "Se reconnecter"
      },
      missingScopes: {
        title: "Autorisation manquante",
        section: "Autorisations Google non accordées",
        why: "Vous êtes connecté, mais vous n'avez pas accordé à l'application toutes les autorisations dont elle a besoin : l'accès aux fichiers de votre Google Drive (pour lire et enregistrer vos données) et l'accès à votre adresse e-mail (pour identifier votre compte).",
        what: "Cliquez sur « Réessayer » pour afficher à nouveau l'écran d'autorisation de Google, puis cochez toutes les options demandées.",
        confirm: "Réessayer"
      }
    }
  },
  settings: {
    title: "Profil fiscal",
    onboardingTitle: "Bienvenue — votre profil fiscal",
    onboardingNote: "Pour estimer la valeur nette de votre patrimoine, Mon Patrimoine a besoin de connaître votre situation fiscale (revenus, foyer). Ces informations sont modifiables à tout moment via la barre d'outils en haut de l'écran.",
    familySection: "Situation Familiale & Foyer Fiscal",
    maritalStatus: "Statut matrimonial",
    maritalStatusSingle: "Célibataire / Divorcé(e) / Séparé(e)",
    maritalStatusMarried: "Marié(e) / PACSÉ(e)",
    maritalStatusWidowed: "Veuf(ve)",
    declarantCase: "Case du déclarant",
    spouseCase: "Case du conjoint",
    caseNone: "Aucune",
    caseP: "P — Vous êtes invalide",
    caseF: "F — Conjoint invalide (ou décédé dans l'année)",
    caseW: "W — Ancien combattant de plus de 74 ans",
    caseS: "S — Ancien combattant de plus de 74 ans (couple)",
    caseG: "G — Pension de veuve de guerre",
    children: "Enfants",
    childrenCount: "Enfants en garde exclusive",
    alternateChildrenCount: "Enfants en garde alternée",
    disabledChildrenCount: "dont handicapé(s)",
    singleParent: "Parent isolé",
    caseL: "Case L",
    incomeSection: "Revenus",
    taxableIncome: "Revenu net imposable",
    fiscalSummarySection: "Résumé fiscal",
    parts: "Nombre de parts",
    halfPartReductionCeiling: "Remise max des 1/2 parts supplémentaires",
    tmi: "TMI",
    estimatedTax: "Impôt estimé",
    estimatedTaxHelp: "Hors liquidation de vos actifs et avant réductions et crédits d'impôt (dons, emploi à domicile…).",
    tmiSection: "Tranche Marginale d'Imposition (TMI)",
    enterTmi: "Saisir votre TMI",
    nonTaxable: "Non imposable",
    pfuSection: "Prélèvement Forfaitaire Unique (PFU)",
    pfuMode: "Mode d'imposition des plus-values :",
    pfuEnabled: "PFU (Flat Tax)",
    pfuDisabled: "Barème progressif de l'IR",
    taxRules: "Règles fiscales",
    profileYear: "Année du profil",
    currentProfile: "Profil actuel",
    carriedOver: "Reconduit depuis {year}",
    confirmDeleteYear: "Supprimer le profil enregistré pour {year} ? Pour cette année, le profil de l'année précédente s'appliquera."
  },
  taxExplanation: {
    title: "Explication fiscale",
    titleAt: "Explication fiscale au {date}"
  },
  history: {
    title: "Historique",
    viewAtDate: "État au",
    showClosed: "Afficher les actifs clôturés",
    showClosedShort: "actifs clôturés",
    stateAt: "État au {date}",
    closedBadgeDate: "Clôturé le {date}",
    notTracked: "Non suivi à cette date",
    currentPoint: "État actuel",
    existingPoint: "Point existant",
    newPoint: "Nouveau point",
    unlockPoint: "Déverrouiller la modification de ce point",
    lockPoint: "Verrouiller la modification de ce point",
    prevPoint: "Point précédent",
    nextPoint: "Point suivant",
    recordedPoint: "Un état de cet actif est enregistré à cette date",
    deletePoint: "Supprimer ce point",
    confirmDeletePoint: "Supprimer l'état enregistré au {date} ? À cette date, l'actif reprendra l'état connu précédent.",
    lockedNote: "Seuls les champs datés sont modifiables ici. Les champs globaux (nom, établissement, dates de contrat…) se modifient à la date du jour.",
    inflationLabel: "Évaluation",
    inflationNone: "Hors inflation",
    inflationBaseMonth: "Les montants historiques sont affichés en euros actuels (base {month})",
    inflationLoading: "Chargement de l'indice…",
    inflationLoadError: "Indice indisponible",
    inflationHelpTitle: "Évaluation en euros constants",
    inflationHelpBody: "Ce menu permet d'afficher les montants historiques en euros constants (pouvoir d'achat d'aujourd'hui) à partir d'un indice des prix à la consommation publié par l'INSEE. Les calculs et l'édition restent en euros de l'époque ; seul l'affichage est concerné.",
    chartTitle: "Évolution du patrimoine",
    chartEmpty: "Pas encore de données historiques à afficher.",
    chartDataAsOf: "Données au {date}",
    period1M: "1M",
    period6M: "6M",
    periodYTD: "Année",
    period1A: "1A",
    period5A: "5A",
    period10A: "10A",
    periodMax: "Max",
    variationsTitle: "Variations",
    varSinceStart: "Depuis le début",
    varYtd: "Année en cours",
    var1Y: "12 derniers mois",
    varConstEuros: "€ constants",
    varYear: "Année",
    varGross: "brut",
    varNet: "net",
    varDelta: "Variation",
    varAvgSince: "Moyenne annuelle depuis",
    varPerYear: "/an",
    varPartialYear: "* depuis le {date}",
    varRange: "Du {from} au {to}",
    annotateTitle: "Annoter la date affichée",
    annotationPlaceholder: "Ex : Don de 150 k€ aux enfants",
    annotationSave: "Enregistrer",
    annotationDelete: "Supprimer",
    annotationCancel: "Annuler"
  },
  inflation: {
    banner: "Attention, montants affichés en euros constants (base {month})",
    bannerHelpTitle: "Montants en euros constants",
    bannerHelpBody: "Les montants affichés sont exprimés en euros constants (pouvoir d'achat de {month}), d'après l'indice des prix à la consommation INSEE sélectionné. Les données enregistrées restent en euros de l'époque : seul l'affichage est concerné.",
    bannerHelpWhere: "Vous pouvez revenir aux montants nominaux, ou choisir un autre indice, grâce au menu « {inflationMenu} » de la carte « {historyCard} »."
  }
};
