export const SOCIAL_CONTRIBUTION_RATES = {
  /** Pre-LFSS-2026 combined rate, kept for regimes frozen at historical rates. */
  OLD_CSG_CRDS: 0.172,
  /** Combined rate on capital income in force since 2026-01-01. */
  CSG_CRDS: 0.186,
} as const;

/**
 * A dated step of a rate history. The rate applies on and after `from`.
 */
interface RateStep {
  from: string;
  rate: number;
}

function resolveRateStep(history: readonly RateStep[], date: Date): number {
  let rate = history[0].rate;
  for (const step of history) {
    if (new Date(step.from) <= date) {
      rate = step.rate;
    } else {
      break;
    }
  }
  return rate;
}

// Combined social levies on capital income (produits de placement / revenus
// du patrimoine): CSG + CRDS + prélèvement social + contribution additionnelle.
// - 15.5% from 2013 (loi 2012-1404)
// - 17.2% from 2018 (CSG +1.7pt, loi 2017-1836)
// - 18.6% from 2026 (CSG 9.2% -> 10.6%, LFSS 2026 art. 12)
const SOCIAL_CONTRIBUTION_HISTORY: readonly RateStep[] = [
  { from: '2013-01-01', rate: 0.155 },
  { from: '2018-01-01', rate: 0.172 },
  { from: '2026-01-01', rate: 0.186 }
];

/**
 * Returns the combined social levies rate on capital income in force on the
 * given date (prélèvements sociaux are indexed by the event date, not by the
 * income-tax year).
 */
export function getSocialContributionRate(date: Date = new Date()): number {
  return resolveRateStep(SOCIAL_CONTRIBUTION_HISTORY, date);
}

export interface TaxBracket {
  limit: number;
  rate: number;
}

/**
 * All the income-tax parameters that depend on the income year
 * (revenus 2025 are taxed with the 2025 schedule, whatever the payment year).
 */
export interface YearlyFiscalRates {
  /** Whether the flat tax (PFU) exists for this income year (introduced for income >= 2018). */
  PFU_AVAILABLE: boolean;
  PFU_IR_RATE: number;
  /** Deductible CSG fraction when capital income is taxed at the progressive scale. */
  PFU_CSG_REDUCTION_RATE: number;
  INCOME_TAX_BRACKETS: readonly TaxBracket[];
  EXTRA_PARTS: {
    CHILD: number;
    CEILING: {
      CHILD: number;
      SINGLE_PARENT: number;
      CASE_L: number;
      WIDOW_POST_CAP_REDUCTION: number;
      DISABILITY_POST_CAP_REDUCTION: number;
    };
  };
  DECOTE: {
    rate: number;
    limit_single: number;
    limit_couple: number;
  };
}

/**
 * Income-tax parameters by income year, from OpenFisca
 * (impot_revenu.bareme_ir_depuis_1945, plafond_qf, decote).
 *
 * When the schedule for the requested year is not yet voted, getFiscalRates
 * falls back to the latest known year <= the requested year.
 */
export const FISCAL_RATES_BY_YEAR: Record<number, YearlyFiscalRates> = {
  2019: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 10064, rate: 0 },
      { limit: 27794, rate: 0.14 },
      { limit: 74517, rate: 0.3 },
      { limit: 157806, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1567,
        SINGLE_PARENT: 3697,
        CASE_L: 936,
        WIDOW_POST_CAP_REDUCTION: 1745,
        DISABILITY_POST_CAP_REDUCTION: 1562
      }
    },
    DECOTE: {
      rate: 0.75,
      limit_single: 1208,
      limit_couple: 1990
    }
  },
  2020: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 10084, rate: 0 },
      { limit: 25710, rate: 0.11 },
      { limit: 73516, rate: 0.3 },
      { limit: 158122, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1570,
        SINGLE_PARENT: 3704,
        CASE_L: 938,
        WIDOW_POST_CAP_REDUCTION: 1748,
        DISABILITY_POST_CAP_REDUCTION: 1565
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 779,
      limit_couple: 1289
    }
  },
  2021: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 10225, rate: 0 },
      { limit: 26070, rate: 0.11 },
      { limit: 74545, rate: 0.3 },
      { limit: 160336, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1592,
        SINGLE_PARENT: 3756,
        CASE_L: 951,
        WIDOW_POST_CAP_REDUCTION: 1772,
        DISABILITY_POST_CAP_REDUCTION: 1587
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 790,
      limit_couple: 1307
    }
  },
  2022: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 10777, rate: 0 },
      { limit: 27478, rate: 0.11 },
      { limit: 78570, rate: 0.3 },
      { limit: 168994, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1678,
        SINGLE_PARENT: 3959,
        CASE_L: 1002,
        WIDOW_POST_CAP_REDUCTION: 1868,
        DISABILITY_POST_CAP_REDUCTION: 1673
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 833,
      limit_couple: 1378
    }
  },
  2023: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 11294, rate: 0 },
      { limit: 28797, rate: 0.11 },
      { limit: 82341, rate: 0.3 },
      { limit: 177106, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1759,
        SINGLE_PARENT: 4149,
        CASE_L: 1050,
        WIDOW_POST_CAP_REDUCTION: 1958,
        DISABILITY_POST_CAP_REDUCTION: 1753
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 873,
      limit_couple: 1444
    }
  },
  2024: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 11497, rate: 0 },
      { limit: 29315, rate: 0.11 },
      { limit: 83823, rate: 0.3 },
      { limit: 180294, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1791,
        SINGLE_PARENT: 4224,
        CASE_L: 1069,
        WIDOW_POST_CAP_REDUCTION: 1993,
        DISABILITY_POST_CAP_REDUCTION: 1785
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 889,
      limit_couple: 1470
    }
  },
  2025: {
    PFU_AVAILABLE: true,
    PFU_IR_RATE: 0.128,
    PFU_CSG_REDUCTION_RATE: 0.068,
    INCOME_TAX_BRACKETS: [
      { limit: 11600, rate: 0 },
      { limit: 29579, rate: 0.11 },
      { limit: 84577, rate: 0.3 },
      { limit: 181917, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ],
    EXTRA_PARTS: {
      CHILD: 0.5,
      CEILING: {
        CHILD: 1807,
        SINGLE_PARENT: 4262,
        CASE_L: 1079,
        WIDOW_POST_CAP_REDUCTION: 2011,
        DISABILITY_POST_CAP_REDUCTION: 1801
      }
    },
    DECOTE: {
      rate: 0.4525,
      limit_single: 897,
      limit_couple: 1483
    }
  }
};

const KNOWN_YEARS = Object.keys(FISCAL_RATES_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Returns the income-tax parameters for the given income year.
 * Falls back to the latest known year <= incomeYear, or to the earliest
 * known year when incomeYear predates the table.
 */
export function getFiscalRates(incomeYear: number = new Date().getFullYear()): YearlyFiscalRates {
  let year = KNOWN_YEARS[0];
  for (const knownYear of KNOWN_YEARS) {
    if (knownYear <= incomeYear) {
      year = knownYear;
    } else {
      break;
    }
  }
  return FISCAL_RATES_BY_YEAR[year];
}

/** Parameters for the current year — kept as a shortcut for existing callers. */
export const FISCAL_RATES: YearlyFiscalRates = getFiscalRates();
