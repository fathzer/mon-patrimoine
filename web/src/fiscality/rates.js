export const FISCAL_RATES = {
  OLD_CSG_CRDS: 0.172,
  CSG_CRDS: 0.186,
  PFU_IR_RATE: 0.128,
  PFU_CSG_REDUCTION_RATE: 0.068,
  INCOME_TAX_BRACKETS: [
    { limit: 11600, rate: 0.00 },
    { limit: 29579, rate: 0.11 },
    { limit: 84577, rate: 0.30 },
    { limit: 181917, rate: 0.41 },
    { limit: Infinity, rate: 0.45 }
  ]
};
