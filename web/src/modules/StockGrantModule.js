import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { StockGrantEditor } from '../ui/editors/StockGrantEditor.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';

// Tax rules based on:
// https://www.impots.gouv.fr/particulier/questions/mon-entreprise-ma-attribue-des-actions-gratuites-comment-sera-impose-le-gain

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

// Tax rates and thresholds for stock grants
const SPECIAL_SOCIAL_RATE = 0.097;
const EMPLOYER_CONTRIBUTION_RATE = 0.10;
const FLAT_TAX_RATE_BEFORE_2012 = 0.30;
const DETENTION_ABATTEMENT_2Y = 0.50;
const DETENTION_ABATTEMENT_8Y = 0.65;
const UNIFORM_ABATTEMENT_FROM_2018 = 0.50;

export { SPECIAL_SOCIAL_RATE, EMPLOYER_CONTRIBUTION_RATE, FLAT_TAX_RATE_BEFORE_2012, DETENTION_ABATTEMENT_2Y, DETENTION_ABATTEMENT_8Y, UNIFORM_ABATTEMENT_FROM_2018 };

export class StockGrant {
  constructor(data = {}) {
    this.attributionDate = data.attributionDate || '';
    this.acquisitionDate = data.acquisitionDate || '';
    this.acquisitionPrice = Number(data.acquisitionPrice) || 0;
    this.numberOfShares = Number(data.numberOfShares) || 0;
  }

  toJSON() {
    return {
      attributionDate: this.attributionDate,
      acquisitionDate: this.acquisitionDate,
      acquisitionPrice: this.acquisitionPrice,
      numberOfShares: this.numberOfShares
    };
  }

  getRealAcquisitionGain(currentPrice) {
    const realAcquisitionPrice = Math.min(this.acquisitionPrice, currentPrice);
    return realAcquisitionPrice * this.numberOfShares;
  }

  /**
   * Computes the taxable acquisition gain (assiette d'imposition) for this grant,
   * applying abattements based on the attribution date and detention duration.
   * - From 28/09/2012 to 07/08/2015: no abattement.
   * - From 08/08/2015 to 30/12/2016: detention-duration abattement on the whole gain.
   * - From 31/12/2016 to 31/12/2017: detention abattement on the fraction ≤ threshold.
   * - From 01/01/2018: 50% abattement on the fraction ≤ threshold.
   * Detention-duration abattement: 50% if detained > 2 years, 65% if > 8 years.
   * @param {number} currentPrice - the current share price
   * @param {number} [threshold=0] - the remaining threshold before the 300 000 € cap
   * @param {Date} [now=new Date()] - the reference date for detention duration
   * @returns {number} the taxable acquisition gain
   */
  getTaxableAcquisitionGain(currentPrice, threshold = 0, now = new Date()) {
    const acquisitionGain = this.getRealAcquisitionGain(currentPrice);
    if (acquisitionGain <= 0) {
      return 0;
    }

    const attributionDate = new Date(this.attributionDate);
    const acquisitionDate = new Date(this.acquisitionDate);

    const FROM_2015_REFORM = new Date('2015-08-08');
    const FROM_2016_REFORM = new Date('2016-12-31');
    const FROM_2018_REFORM = new Date('2018-01-01');

    // From 28/09/2012 to 07/08/2015: no abattement.
    if (attributionDate < FROM_2015_REFORM) {
      return acquisitionGain;
    }

    // Detention-duration abattement (plus-values mobilières), from acquisitionDate.
    const getDetentionAbattement = () => {
      const yearsDetained = (now.getTime() - acquisitionDate.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (yearsDetained > 8) return DETENTION_ABATTEMENT_8Y;
      if (yearsDetained > 2) return DETENTION_ABATTEMENT_2Y;
      return 0;
    };

    // From 08/08/2015 to 30/12/2016: abattement on the whole gain.
    if (attributionDate < FROM_2016_REFORM) {
      return acquisitionGain * (1 - getDetentionAbattement());
    }

    // From 31/12/2016: abattement on the fraction below the threshold only.
    const belowThreshold = Math.max(0, Math.min(acquisitionGain, threshold));
    const aboveThreshold = Math.max(0, acquisitionGain - threshold);
    const abattement = attributionDate < FROM_2018_REFORM
      ? getDetentionAbattement()
      : UNIFORM_ABATTEMENT_FROM_2018;
    return belowThreshold * (1 - abattement) + aboveThreshold;
  }

  /**
   * Computes the PlacementIncome for the acquisition gain of this grant.
   * Before 28/09/2012: 30% flat rate. Otherwise: barème progressif with
   * abattements applied via getTaxableAcquisitionGain.
   * @param {number} currentPrice - the current share price
   * @param {number} [threshold=0] - the remaining threshold before the 300 000 € cap
   * @param {Date} [now=new Date()] - the reference date for detention duration
   * @returns {PlacementIncome} the placement income for the acquisition gain
   */
  getAcquisitionIncome(currentPrice, threshold = 0, now = new Date()) {
    const attributionDate = new Date(this.attributionDate);
    const BEFORE_2012_REFORM = new Date('2012-09-28');
    const taxableGain = this.getTaxableAcquisitionGain(currentPrice, threshold, now);

    if (attributionDate < BEFORE_2012_REFORM) {
      return {
        assietteImposition: taxableGain,
        eligiblePfu: false,
        tauxSpecifique: FLAT_TAX_RATE_BEFORE_2012
      };
    }

    return {
      assietteImposition: taxableGain,
      eligiblePfu: false,
      deductionRevenus: taxableGain
    };
  }

  getPlueValueIncome(currentPrice) {
    const plueValue = currentPrice * this.numberOfShares - this.getRealAcquisitionGain(currentPrice);
    return {
      assietteImposition: plueValue,
      eligiblePfu: true,
      deductionRevenus: plueValue
    };
  }

  getPlueValueSocialCharges(currentPrice) {
    const plueValue = currentPrice * this.numberOfShares - this.getRealAcquisitionGain(currentPrice);
    return plueValue * SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  /**
   * Computes the social charges on the acquisition gain of this grant (including employer contribution).
   * @param {number} currentPrice - the current share price
   * @param {number} [threshold=0] - the remaining threshold before the 300 000 € cap
   * @returns {number} the social charges amount
   */
  getAcquisitionSocialCharges(currentPrice, threshold = 0) {
    const acquisitionGain = this.getRealAcquisitionGain(currentPrice);

    const attributionDate = new Date(this.attributionDate);

    const BEFORE_2012_REFORM = new Date('2012-09-28');
    const FROM_2015_REFORM = new Date('2015-08-08');
    const FROM_2016_REFORM = new Date('2016-12-31');
    const FROM_2007_CONTRIBUTION = new Date('2007-10-16');

    const specialRate = SPECIAL_SOCIAL_RATE;
    const employerContributionRate = EMPLOYER_CONTRIBUTION_RATE;

    let socialCharges = 0;
    if (attributionDate < BEFORE_2012_REFORM) {
      socialCharges = acquisitionGain * SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
    } else if (attributionDate < FROM_2015_REFORM) {
      socialCharges = acquisitionGain * specialRate;
    } else if (attributionDate < FROM_2016_REFORM) {
      socialCharges = acquisitionGain * SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
    } else {
      // From 31/12/2016: split the gain between the standard and special rates.
      const belowThreshold = Math.max(0, Math.min(acquisitionGain, threshold));
      const aboveThreshold = Math.max(0, acquisitionGain - threshold);
      socialCharges = belowThreshold * SOCIAL_CONTRIBUTION_RATES.CSG_CRDS + aboveThreshold * specialRate;
    }

    // 10% employer contribution (contribution salariale)
    if (attributionDate >= FROM_2007_CONTRIBUTION && attributionDate < FROM_2015_REFORM) {
      // From 16/10/2007 to 07/08/2015: 10% on the entire gain.
      socialCharges += acquisitionGain * employerContributionRate;
    } else if (attributionDate >= FROM_2016_REFORM) {
      // From 31/12/2016: 10% only on the fraction above the threshold.
      const aboveThreshold = Math.max(0, acquisitionGain - threshold);
      socialCharges += aboveThreshold * employerContributionRate;
    }

    return socialCharges;
  }

  /**
   * Returns true if this grant is eligible for the 300 000 € threshold.
   * @returns {boolean} true if the 300 000 € threshold applies
   */
  isEligibleFor300kThreshold() {
    const attributionDate = new Date(this.attributionDate);
    const FROM_2016_REFORM = new Date('2016-12-31');
    return attributionDate >= FROM_2016_REFORM;
  }
}

export class StockGrantModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.INVESTMENTS;
  static THRESHOLD = 300000;

  static getEditorClass() {
    return StockGrantEditor;
  }

  constructor(data) {
    super(data);
    this.stockName = data.stockName || '';
    this.currentPrice = Number(data.currentPrice) || 0;
    this.attributions = Array.isArray(data.attributions)
      ? data.attributions.map(a => new StockGrant(a))
      : [];
  }

  _getTotalShares() {
    return this.attributions.reduce((sum, a) => sum + a.numberOfShares, 0);
  }

  _getAttributionGain(grant) {
    const realAcquisitionPrice = Math.min(grant.acquisitionPrice, this.currentPrice);
    const acquisitionPart = realAcquisitionPrice * grant.numberOfShares;
    const capitalPart = (this.currentPrice - realAcquisitionPrice) * grant.numberOfShares;
    return { acquisitionPart, capitalPart };
  }

  getLatentGain() {
    return this._getTotalShares() * this.currentPrice;
  }

  getAcquisitionGain() {
    return this.attributions.reduce((sum, a) => sum + this._getAttributionGain(a).acquisitionPart, 0);
  }

  getCapitalGain() {
    return this.attributions.reduce((sum, a) => sum + this._getAttributionGain(a).capitalPart, 0);
  }

  /**
   * Computes the total social charges for all grants.
   * Eligible grants (attribution from 31/12/2016) share the 300 000 € threshold
   * proportionally to their real acquisition gain. Each grant then contributes
   * its acquisition social charges (using the allocated threshold) plus its
   * capital gain social charges.
   * @returns {number} the total social charges amount
   */
  getSocialCharges() {
    const currentPrice = this.currentPrice;

    const eligibleGrants = this.attributions.filter(a => a.isEligibleFor300kThreshold());
    const totalEligibleGain = eligibleGrants.reduce(
      (sum, a) => sum + a.getRealAcquisitionGain(currentPrice),
      0
    );

    const thresholdMap = new Map();
    for (const grant of eligibleGrants) {
      const gain = grant.getRealAcquisitionGain(currentPrice);
      const share = totalEligibleGain > 0 ? gain / totalEligibleGain : 0;
      thresholdMap.set(grant, share * StockGrantModule.THRESHOLD);
    }

    return this.attributions.reduce((sum, grant) => {
      const threshold = thresholdMap.get(grant) ?? 0;
      return sum
        + grant.getAcquisitionSocialCharges(currentPrice, threshold)
        + grant.getPlueValueSocialCharges(currentPrice);
    }, 0);
  }

  /**
   * Computes the PlacementIncome[] for all grants, applying the 300 000 €
   * threshold proportionally across eligible grants (same allocation as
   * getSocialCharges). For each grant, includes both the acquisition income
   * and the capital gain (plus-value) income.
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now=new Date()]
   * @returns {PlacementIncome[]}
   */
  getTaxableIncomes(fiscalProfile, now = new Date()) {
    const currentPrice = this.currentPrice;

    const eligibleGrants = this.attributions.filter(a => a.isEligibleFor300kThreshold());
    const totalEligibleGain = eligibleGrants.reduce(
      (sum, a) => sum + a.getRealAcquisitionGain(currentPrice),
      0
    );

    const thresholdMap = new Map();
    for (const grant of eligibleGrants) {
      const gain = grant.getRealAcquisitionGain(currentPrice);
      const share = totalEligibleGain > 0 ? gain / totalEligibleGain : 0;
      thresholdMap.set(grant, share * StockGrantModule.THRESHOLD);
    }

    const incomes = [];
    for (const grant of this.attributions) {
      const threshold = thresholdMap.get(grant) ?? 0;
      const acquisitionIncome = grant.getAcquisitionIncome(currentPrice, threshold, now);
      if (acquisitionIncome.assietteImposition > 0) {
        incomes.push(acquisitionIncome);
      }
      const plueValueIncome = grant.getPlueValueIncome(currentPrice);
      if (plueValueIncome.assietteImposition > 0) {
        incomes.push(plueValueIncome);
      }
    }
    return incomes;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const grossValue = this.getLatentGain();
    const socialCharges = this.getSocialCharges();

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: grossValue,
      imposition: this.getImposition(fiscalProfile)
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      stockName: this.stockName,
      currentPrice: this.currentPrice,
      attributions: this.attributions.map(a => a.toJSON())
    };
  }
}
