export enum Category {
  BANK_ACCOUNTS = 'bank_accounts',
  SAVING_ACCOUNTS = 'saving_accounts',
  INVESTMENTS = 'investments',
  LIFE_INSURANCE = 'life_insurance',
  REAL_ESTATE = 'real_estate'
}

export const CategoryValues: readonly Category[] = Object.values(Category);
