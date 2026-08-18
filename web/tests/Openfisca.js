const ENDPOINT = 'https://api.fr.openfisca.org/latest/calculate';

/** @typedef {import('../src/fiscality/Household.js').Household} Household */

/**
 * @typedef {Object} OpenfiscaCase
 * @property {Household} household
 * @property {number} rni
 * @property {number} [year]
 */

/**
 * @typedef {Object} OpenfiscaResult
 * @property {number} nbptr
 * @property {number} tmi
 * @property {number} impot
 * @property {number} avantageQf
 * @property {number} decote
 */

/**
 * Formats a date as an ISO string without time.
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function _formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds the individus and personnes a charge for one case.
 * @param {string} id - base id for the parent (e.g. 'moi' or 'c0_moi')
 * @param {number} childrenCount - exclusive-custody children
 * @param {number} alternateChildrenCount - alternating-custody children
 * @param {number} totalChildren - total number of children
 * @param {number} year - simulation year
 * @returns {{individus: Object, personnesACharge: string[]}}
 */
function _buildIndividu(id, childrenCount, alternateChildrenCount, totalChildren, year) {
  const now = new Date();
  const individus = { [id]: {} };
  const personnesACharge = [];

  for (let i = 1; i <= totalChildren; i += 1) {
    const childId = `${id}_enfant${i}`;
    personnesACharge.push(childId);

    const age = totalChildren - i + 1;
    const birthDate = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
    const isAlternated = i > childrenCount;
    const child = { date_naissance: { [year]: _formatDate(birthDate) } };

    if (isAlternated) {
      child.garde_alternee = { [year]: true };
    }

    individus[childId] = child;
  }

  return { individus, personnesACharge };
}

/**
 * Builds the inputs for a single foyers_fiscaux entity.
 * @param {string[]} declarants - ids of the declarants
 * @param {string[]} personnesACharge - ids of the children
 * @param {boolean} isSingleParent - whether the caseT flag must be set
 * @param {number} rni - revenu net imposable
 * @param {number} year - simulation year
 * @returns {Object} OpenFisca foyers_fiscaux entry
 */
function _buildFoyerInputs(declarants, personnesACharge, isSingleParent, rni, year) {
  return {
    declarants,
    personnes_a_charge: personnesACharge,
    caseT: { [year]: isSingleParent },
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
 * @param {Object} foyer - foyers_fiscaux entry
 * @param {number} year - simulation year
 * @returns {OpenfiscaResult}
 */
function _extractFoyerResult(foyer, year) {
  return {
    nbptr: foyer.nbptr?.[year],
    tmi: foyer.ir_taux_marginal?.[year],
    impot: foyer.impot_revenu_restant_a_payer?.[year],
    avantageQf: foyer.avantage_qf?.[year],
    decote: foyer.decote_gain_fiscal?.[year]
  };
}

/**
 * Client for the OpenFisca France /calculate endpoint.
 */
export class Openfisca {
  /**
   * Computes tax and fiscal metrics for a single household.
   * @param {Household} household - household data
   * @param {number} rni - revenu net imposable
   * @param {number} [year] - simulation year (defaults to current year)
   * @returns {Promise<OpenfiscaResult>}
   */
  static async calculate(household, rni, year = new Date().getFullYear()) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildPayload(household, rni, year))
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Openfisca request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const foyer = data?.foyers_fiscaux?.foyer;

    if (!foyer) {
      throw new Error('Openfisca response has no foyers_fiscaux.foyer');
    }

    return _extractFoyerResult(foyer, year);
  }

  /**
   * Computes tax and fiscal metrics for several households in a single call.
   * @param {OpenfiscaCase[]} cases - array of cases
   * @returns {Promise<OpenfiscaResult[]>}
   */
  static async batch(cases) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildBatchPayload(cases))
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Openfisca batch request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
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
   * @param {Household} household - household data
   * @param {number} rni - revenu net imposable
   * @param {number} year - simulation year
   * @returns {Object} OpenFisca /calculate payload
   * @private
   */
  static _buildPayload(household, rni, year) {
    const maritalStatus = household?.maritalStatus ?? 'single';
    const childrenCount = household?.childrenCount ?? 0;
    const alternateChildrenCount = household?.alternateChildrenCount ?? 0;
    const isSingleParent = household?.isSingleParent ?? false;
    const totalChildren = childrenCount + alternateChildrenCount;
    const moiId = 'moi';

    const { individus, personnesACharge } = _buildIndividu(
      moiId,
      childrenCount,
      alternateChildrenCount,
      totalChildren,
      year
    );

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
          isSingleParent && maritalStatus === 'single',
          rni,
          year
        )
      }
    };
  }

  /**
   * Builds the request payload for several households.
   * @param {OpenfiscaCase[]} cases - array of cases
   * @returns {Object} OpenFisca /calculate batch payload
   * @private
   */
  static _buildBatchPayload(cases) {
    const individus = {};
    const foyersFiscaux = {};

    for (const [index, { household, rni, year = new Date().getFullYear() }] of cases.entries()) {
      const maritalStatus = household?.maritalStatus ?? 'single';
      const childrenCount = household?.childrenCount ?? 0;
      const alternateChildrenCount = household?.alternateChildrenCount ?? 0;
      const isSingleParent = household?.isSingleParent ?? false;
      const totalChildren = childrenCount + alternateChildrenCount;

      const prefix = `c${index}`;
      const moiId = `${prefix}_moi`;

      const { individus: caseIndividus, personnesACharge } = _buildIndividu(
        moiId,
        childrenCount,
        alternateChildrenCount,
        totalChildren,
        year
      );

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
        isSingleParent && maritalStatus === 'single',
        rni,
        year
      );
    }

    return { individus, foyers_fiscaux: foyersFiscaux };
  }
}
