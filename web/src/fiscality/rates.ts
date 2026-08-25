export const SOCIAL_CONTRIBUTION_RATES = {
  OLD_CSG_CRDS: 0.172,
  CSG_CRDS: 0.186,
} as const;

export interface TaxBracket {
  limit: number;
  rate: number;
}

export const FISCAL_RATES = {
  PFU_IR_RATE: 0.128,
  PFU_CSG_REDUCTION_RATE: 0.068,
  INCOME_TAX_BRACKETS: [
    { limit: 11600, rate: 0.00 },
    { limit: 29579, rate: 0.11 },
    { limit: 84577, rate: 0.30 },
    { limit: 181917, rate: 0.41 },
    { limit: Infinity, rate: 0.45 }
  ] as readonly TaxBracket[],
  EXTRA_PARTS: {
    CHILD: 0.5,
    CEILING: {
      CHILD: 1807,
      SINGLE_PARENT: 2455
    }
  },
  DECOTE: {
    rate: 0.4525,
    limit_single: 897,
    limit_couple: 1483
  }
} as const;
