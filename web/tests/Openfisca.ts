import type { HouseholdLike } from '../src/fiscality/Household.js';

const ENDPOINT = 'https://api.fr.openfisca.org/latest/calculate';

export interface OpenfiscaCase {
  household: HouseholdLike;
  rni: number;
  year?: number;
}

export interface OpenfiscaResult {
  nbptr: number;
  tmi: number;
  impot: number;
  avantageQf: number;
  decote: number;
}

type YearMap<T> = Record<number, T>;

interface OpenfiscaIndividu {
  date_naissance?: YearMap<string>;
  garde_alternee?: YearMap<boolean>;
  invalidite?: Record<string, boolean>;
  statut_marital?: Record<string, string>;
}

interface OpenfiscaFoyer {
  declarants: string[];
  personnes_a_charge: string[];
  caseT: YearMap<boolean>;
  caseL: YearMap<boolean>;
  caseP: YearMap<boolean>;
  caseF: YearMap<boolean>;
  caseW: YearMap<boolean>;
  caseS: YearMap<boolean>;
  caseG: YearMap<boolean>;
  rni: YearMap<number | null>;
  nbptr: YearMap<number | null>;
  ir_taux_marginal: YearMap<number | null>;
  impot_revenu_restant_a_payer: YearMap<number | null>;
  avantage_qf: YearMap<number | null>;
  decote_gain_fiscal: YearMap<number | null>;
}

interface OpenfiscaResponse {
  foyers_fiscaux: Record<string, OpenfiscaFoyer>;
}

/**
 * Formats a date as an ISO string without time.
 * @param date - the date to format
 * @returns YYYY-MM-DD string
 */
function _formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const OPENFISCA_MARITAL_STATUS: Record<string, string> = {
  single: 'celibataire',
  married: 'marie',
  widowed: 'veuf'
};

/**
 * Builds the individus and personnes a charge for one case.
 * statut_marital is set explicitly on the declarant: it is a monthly variable
 * read in January, and providing it as input disables its formula (which would
 * otherwise infer pacsé/célibataire from the declarants count) globally.
 */
function _buildIndividu(
  id: string,
  household: HouseholdLike,
  year: number
): { individus: Record<string, OpenfiscaIndividu>; personnesACharge: string[] } {
  const now = new Date();
  const maritalStatus = household?.maritalStatus ?? 'single';
  const childrenCount = household?.childrenCount ?? 0;
  const alternateChildrenCount = household?.alternateChildrenCount ?? 0;
  const disabledChildrenCount = household?.disabledChildrenCount ?? 0;
  const disabledAlternateChildrenCount = household?.disabledAlternateChildrenCount ?? 0;
  const totalChildren = childrenCount + alternateChildrenCount;
  const individus: Record<string, OpenfiscaIndividu> = {
    [id]: { statut_marital: { [`${year}-01`]: OPENFISCA_MARITAL_STATUS[maritalStatus] ?? 'celibataire' } }
  };
  const personnesACharge: string[] = [];

  for (let i = 1; i <= totalChildren; i += 1) {
    const childId = `${id}_enfant${i}`;
    personnesACharge.push(childId);

    const age = totalChildren - i + 1;
    const birthDate = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
    const isAlternated = i > childrenCount;
    const child: OpenfiscaIndividu = { date_naissance: { [year]: _formatDate(birthDate) } };

    if (isAlternated) {
      child.garde_alternee = { [year]: true };
    }

    // A disabled child is flagged invalidite on the individual, from which
    // OpenFisca derives the nbG (exclusive) and nbI (alternated) counts.
    const isDisabled = isAlternated
      ? i - childrenCount <= disabledAlternateChildrenCount
      : i <= disabledChildrenCount;
    if (isDisabled) {
      child.invalidite = { [`${year}-01`]: true };
    }

    individus[childId] = child;
  }

  return { individus, personnesACharge };
}

/**
 * Builds the inputs for a single foyers_fiscaux entity.
 */
function _buildFoyerInputs(
  declarants: string[],
  personnesACharge: string[],
  household: HouseholdLike,
  rni: number,
  year: number
): OpenfiscaFoyer {
  const maritalStatus = household?.maritalStatus ?? 'single';
  return {
    declarants,
    personnes_a_charge: personnesACharge,
    caseT: { [year]: (household?.isSingleParent ?? false) && maritalStatus === 'single' },
    caseL: { [year]: (household?.caseL ?? false) && maritalStatus !== 'married' },
    caseP: { [year]: household?.caseP ?? false },
    caseF: { [year]: household?.caseF ?? false },
    caseW: { [year]: household?.caseW ?? false },
    caseS: { [year]: household?.caseS ?? false },
    caseG: { [year]: household?.caseG ?? false },
    rni: { [year]: rni },
    nbptr: { [year]: null },
    ir_taux_marginal: { [year]: null },
    impot_revenu_restant_a_payer: { [year]: null },
    avantage_qf: { [year]: null },
    decote_gain_fiscal: { [year]: null }
  };
}

/**
 * Extracts the fiscal result for one foyers_fiscaux from an OpenFisca response.
 */
function _extractFoyerResult(foyer: OpenfiscaFoyer, year: number): OpenfiscaResult {
  return {
    nbptr: foyer.nbptr?.[year] ?? 0,
    tmi: foyer.ir_taux_marginal?.[year] ?? 0,
    impot: foyer.impot_revenu_restant_a_payer?.[year] ?? 0,
    avantageQf: foyer.avantage_qf?.[year] ?? 0,
    decote: foyer.decote_gain_fiscal?.[year] ?? 0
  };
}

/**
 * Client for the OpenFisca France /calculate endpoint.
 */
export class Openfisca {
  /**
   * Computes tax and fiscal metrics for a single household.
   */
  static async calculate(household: HouseholdLike, rni: number, year: number = new Date().getFullYear()): Promise<OpenfiscaResult> {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildPayload(household, rni, year))
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Openfisca request failed: ${response.status} ${text}`);
    }

    const data = await response.json() as OpenfiscaResponse;
    const foyer = data?.foyers_fiscaux?.foyer;

    if (!foyer) {
      throw new Error('Openfisca response has no foyers_fiscaux.foyer');
    }

    return _extractFoyerResult(foyer, year);
  }

  /**
   * Computes tax and fiscal metrics for several households in a single call.
   */
  static async batch(cases: OpenfiscaCase[]): Promise<OpenfiscaResult[]> {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildBatchPayload(cases))
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Openfisca batch request failed: ${response.status} ${text}`);
    }

    const data = await response.json() as OpenfiscaResponse;
    return cases.map(({ year = new Date().getFullYear() }, index) => {
      const foyer = data?.foyers_fiscaux?.[`foyer_${index}`];
      if (!foyer) {
        throw new Error(`Openfisca response has no foyers_fiscaux.foyer_${index}`);
      }
      return _extractFoyerResult(foyer, year);
    });
  }

  /**
   * Builds the request payload for a single household.
   * @private
   */
  static _buildPayload(household: HouseholdLike, rni: number, year: number): Record<string, unknown> {
    const maritalStatus = household?.maritalStatus ?? 'single';
    const moiId = 'moi';

    const { individus, personnesACharge } = _buildIndividu(moiId, household, year);

    const declarants = [moiId];
    if (maritalStatus === 'married') {
      declarants.push('conjoint');
      individus.conjoint = {};
    }

    return {
      individus,
      foyers_fiscaux: {
        foyer: _buildFoyerInputs(
          declarants,
          personnesACharge,
          household,
          rni,
          year
        )
      }
    };
  }

  /**
   * Builds the request payload for several households.
   * @private
   */
  static _buildBatchPayload(cases: OpenfiscaCase[]): Record<string, unknown> {
    const individus: Record<string, OpenfiscaIndividu> = {};
    const foyersFiscaux: Record<string, OpenfiscaFoyer> = {};

    for (const [index, { household, rni, year = new Date().getFullYear() }] of cases.entries()) {
      const maritalStatus = household?.maritalStatus ?? 'single';

      const prefix = `c${index}`;
      const moiId = `${prefix}_moi`;

      const { individus: caseIndividus, personnesACharge } = _buildIndividu(moiId, household, year);

      Object.assign(individus, caseIndividus);

      const declarants = [moiId];
      if (maritalStatus === 'married') {
        const conjointId = `${prefix}_conjoint`;
        declarants.push(conjointId);
        individus[conjointId] = {};
      }

      foyersFiscaux[`foyer_${index}`] = _buildFoyerInputs(
        declarants,
        personnesACharge,
        household,
        rni,
        year
      );
    }

    return { individus, foyers_fiscaux: foyersFiscaux };
  }
}
