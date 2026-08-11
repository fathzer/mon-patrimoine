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
    breakdownTitle: "Répartition par classe d'actifs"
  },
  categories: {
    bank_accounts: "Comptes courants",
    investments: "Investissements",
    saving_accounts: "Livrets"
  },
  filters: {
    all: "Tous les actifs"
  },
  actions: {
    addAsset: "+ Ajouter un actif",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer"
  },
  table: {
    assetHeader: "Actif / Établissement",
    categoryHeader: "Catégorie",
    grossHeader: "Valeur Brute",
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
    types: {
      checking_account: "Compte Courant",
      pea: "PEA",
      savings_account: "Livret",
      home_savings: "Épargne Logement"
    }
  },
  alerts: {
    saveError: "La sauvegarde a échoué. Vos dernières modifications pourraient ne pas être conservées."
  },
  settings: {
    title: "Réglages - Profil Fiscal",
    familySection: "Situation Familiale & Foyer Fiscal",
    maritalStatus: "Statut matrimonial",
    maritalStatusSingle: "Célibataire / Divorcé(e) / Veuf(ve)",
    maritalStatusMarried: "Marié(e) / PACSÉ(e) (Imposition commune)",
    childrenCount: "Enfants à charge",
    fiscalParts: "Nombre de parts fiscales du foyer",
    fiscalPartsHint: "Ajustable manuellement si vous bénéficiez de parts supplémentaires (invalidité, garde alternée, etc.).",
    tmiSection: "Tranche Marginale d'Imposition (TMI)",
    inputMode: "Mode de saisie :",
    directInput: "Saisie directe du TMI",
    rfrInput: "Calcul via le Revenu Fiscal de Référence (RFR)",
    enterTmi: "Saisir votre TMI",
    nonTaxable: "Non imposable",
    rfrLabel: "Revenu Fiscal de Référence (RFR)",
    calculatedTmi: "TMI calculé :",
    pfuSection: "Prélèvement Forfaitaire Unique (PFU)",
    pfuMode: "Mode d'imposition des plus-values :",
    pfuEnabled: "PFU (Flat Tax)",
    pfuDisabled: "Barème progressif de l'IR",
    pfuHint: "Le PFU applique un taux forfaitaire. Option par défaut, mais vous pouvez opter pour le barème progressif si plus avantageux. Ce barême ouvre aussi droit dans certains cas à déduction du revenu imposable de la CSG déductible "
  }
};
