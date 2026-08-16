export const fr = {
  app: {
    title: "Mon Patrimoine",
    loading: "Chargement du patrimoine..."
  },
  auth: {
    welcomeTitle: "Bienvenue",
    loginSubtitle: "Connectez-vous à votre espace de stockage Cloud pour accéder à votre patrimoine.",
    loginBtn: "Connexion Cloud",
    logoutBtn: "Déconnexion"
  },
  summary: {
    totalGross: "Patrimoine Brut",
    totalNet: "Patrimoine Net Estimé",
    breakdownTitle: "Répartition par classe d'actifs",
    gross: "Brut",
    net: "Net"
  },
  categories: {
    bank_accounts: "Comptes courants",
    investments: "Investissements",
    saving_accounts: "Livrets",
    life_insurance: "Assurance-vie",
    real_estate: "Immobilier"
  },
  filters: {
    all: "Tous les actifs"
  },
  actions: {
    addAsset: "+ Ajouter un actif",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    confirmDelete: "Êtes-vous sûr de vouloir supprimer ce placement ?",
    "import": "Importer",
    "export": "Exporter"
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
    typeLabel: "Type de placement",
    category: "Catégorie",
    currentValue: "Valeur actuelle (€)",
    currentCtoValue: "Valeur totale actuelle, y compris le solde espèces (€)",
    acquisitionValue: "Valeur d'acquisition (€)",
    cashBalance: "Solde espèces (€)",
    totalPremiums: "Total des primes versées (€)",
    pre2017Premiums: "Primes versées avant le 27/09/2017 (€)",
    euroFundsValue: "Valeur actuelle des fonds en euros (€)",
    lifeInsuranceWarning: "Attention, le calcul des prélèvements sociaux et impôts est approximatif. Celui-ci dépend de l'historique des versements et arbitrages survenus au cours de la vie de votre assurance-vie",
    cardBalance: "En cours carte (€)",
    totalDeposits: "Total des versements (€)",
    openingDate: "Date d'ouverture",
    grossRate: "Taux brut (%)",
    taxExempt: "Exonéré de prélèvement",
    taxExemptTooltip: "Sont exonérés de prélèvements : Livret A, LDDS, Livret Jeune, Livret d'Épargne Populaire, Livret Bleu. Attention, les PEL et CEL ne sont pas gérés ici, mais dans la rubrique 'Épargne Logement'.",
    interestAmount: "Montant des intérêts (€)",
    promotionalInterest: "Intérêts promotionnels (€)",
    calculator: "Calculer",
    closeCalculator: "Fermer",
    interestRateWarning: "Attention, les taux ou l'encours peuvent avoir évolué en cours d'année, le calcul fait l'hypothèse qu'ils sont constants depuis le 1er janvier.",
    errors: {
      label: "Nom requis",
      institution: "Établissement requis",
      currentValue: "Valeur actuelle requise",
      openingDate: "Date d'ouverture incorrecte",
      generic: "Champ requis"
    },
    homeSavingsType: "Type d'épargne logement",
    pel: "PEL",
    cel: "CEL",
    primaryResidence: "Résidence principale",
    acquisitionDate: "Date d'acquisition",
    acquisitionPrice: "Prix d'acquisition (€)",
    freeAcquisition: "Acquisition à titre gratuit",
    acquisitionFees: "Frais d'acquisition (sur justificatifs)",
    works: "Travaux éligibles (sur justificatifs)",
    multiplePrimaryResidenceWarning: "Attention : une autre résidence principale est déjà déclarée.",
    types: {
      checking_account: "Compte Courant",
      pea: "PEA",
      cto: "Compte-Titres Ordinaire",
      savings_account: "Livret",
      home_savings: "Épargne Logement",
      real_estate: "Immobilier",
      life_insurance: "Assurance-vie"
    }
  },
  alerts: {
    saveError: "La sauvegarde a échoué. Vos dernières modifications pourraient ne pas être conservées.",
    importError: "Le fichier sélectionné n'est pas valide ou n'a pas pu être lu."
  },
  settings: {
    title: "Réglages - Profil Fiscal",
    familySection: "Situation Familiale & Foyer Fiscal",
    maritalStatus: "Statut matrimonial",
    maritalStatusSingle: "Célibataire / Divorcé(e) / Veuf(ve)",
    maritalStatusMarried: "Marié(e) / PACSÉ(e)",
    children: "Enfants",
    childrenCount: "Enfants en garde exclusive",
    alternateChildrenCount: "Enfants en garde alternée",
    singleParent: "Parent isolé",
    incomeSection: "Revenus",
    taxableIncome: "Revenu net imposable",
    fiscalSummarySection: "Résumé fiscal",
    parts: "Nombre de parts",
    halfPartReductionCeiling: "Remise max des 1/2 parts supplémentaires",
    tmi: "TMI",
    estimatedTax: "Impôt estimé, hors liquidation de vos placements",
    tmiSection: "Tranche Marginale d'Imposition (TMI)",
    enterTmi: "Saisir votre TMI",
    nonTaxable: "Non imposable",
    pfuSection: "Prélèvement Forfaitaire Unique (PFU)",
    pfuMode: "Mode d'imposition des plus-values :",
    pfuEnabled: "PFU (Flat Tax)",
    pfuDisabled: "Barème progressif de l'IR",
    taxRules: "Règles fiscales"
  },
  taxExplanation: {
    title: "Explication fiscale"
  }
};
