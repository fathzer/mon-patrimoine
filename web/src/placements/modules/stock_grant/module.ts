import { BasePlacement, Category, compareDates, deleteAt, getSocialContributionRate, makeResolver, recordAt, resolveAt } from '../../kit/v1/index.js';
import { StockGrantEditor } from './Editor.js';
import { StockGrantTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

// Tax rules based on:
// https://www.impots.gouv.fr/particulier/questions/mon-entreprise-ma-attribue-des-actions-gratuites-comment-sera-impose-le-gain

// Tax rates and thresholds for stock grants
const SPECIAL_SOCIAL_RATE = 0.097;
const EMPLOYER_CONTRIBUTION_RATE = 0.10;
const FLAT_TAX_RATE_BEFORE_2012 = 0.30;
const DETENTION_ABATTEMENT_2Y = 0.50;
const DETENTION_ABATTEMENT_8Y = 0.65;
const UNIFORM_ABATTEMENT_FROM_2018 = 0.50;

export { SPECIAL_SOCIAL_RATE, EMPLOYER_CONTRIBUTION_RATE, FLAT_TAX_RATE_BEFORE_2012, DETENTION_ABATTEMENT_2Y, DETENTION_ABATTEMENT_8Y, UNIFORM_ABATTEMENT_FROM_2018 };

/** A past share-count state of an attribution line. */
export interface SharesHistoryEntry {
  date: string;
  shares: number;
}

/** A past price state of the granted stock. */
export interface PriceHistoryEntry {
  date: string;
  price: number;
}

export interface StockGrantData {
  attributionDate?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  numberOfShares?: number;
  /** Effective date of the current share count (defaults to acquisitionDate). */
  sharesAsOf?: string;
  /** Past share counts, sorted by date. A sale records a 0 or reduced count; a line is never deleted. */
  sharesHistory?: SharesHistoryEntry[];
}

export class StockGrant {
  attributionDate: string;
  acquisitionDate: string;
  acquisitionPrice: number;
  numberOfShares: number;
  sharesAsOf: string;
  sharesHistory: SharesHistoryEntry[];

  constructor(data: StockGrantData = {}) {
    this.attributionDate = data.attributionDate || '';
    this.acquisitionDate = data.acquisitionDate || '';
    this.acquisitionPrice = Number(data.acquisitionPrice) || 0;
    this.numberOfShares = Number(data.numberOfShares) || 0;
    this.sharesAsOf = data.sharesAsOf || '';
    this.sharesHistory = (Array.isArray(data.sharesHistory) ? data.sharesHistory : [])
      .map(e => ({ date: String(e.date), shares: Number(e.shares) || 0 }))
      .sort((a, b) => compareDates(a.date, b.date));
  }

  /** Effective date of the current share count (shares are held since acquisition). */
  getSharesAsOf(): string {
    return this.sharesAsOf || this.acquisitionDate;
  }

  /**
   * Share count effective at `date`. The earliest known count applies to
   * dates preceding every recorded state.
   */
  getSharesAt(date: string): number {
    const entries = [
      ...this.sharesHistory,
      { date: this.getSharesAsOf(), shares: this.numberOfShares }
    ].sort((a, b) => compareDates(a.date, b.date));
    return (resolveAt(entries, date) ?? entries[0]).shares;
  }

  toJSON(): StockGrantData {
    return {
      attributionDate: this.attributionDate,
      acquisitionDate: this.acquisitionDate,
      acquisitionPrice: this.acquisitionPrice,
      numberOfShares: this.numberOfShares,
      ...(this.sharesAsOf ? { sharesAsOf: this.sharesAsOf } : {}),
      ...(this.sharesHistory.length > 0 ? { sharesHistory: this.sharesHistory } : {})
    };
  }

  getRealAcquisitionGain(currentPrice: number): number {
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
   */
  getTaxableAcquisitionGain(currentPrice: number, threshold: number = 0, now: Date = new Date()): number {
    const acquisitionGain = this.getRealAcquisitionGain(currentPrice);
    if (acquisitionGain <= 0) {
      return 0;
    }

    const attributionDate = new Date(this.attributionDate);

    const FROM_2015_REFORM = new Date('2015-08-08');
    const FROM_2016_REFORM = new Date('2016-12-31');

    // From 28/09/2012 to 07/08/2015: no abattement.
    if (attributionDate < FROM_2015_REFORM) {
      return acquisitionGain;
    }

    // From 08/08/2015 to 30/12/2016: abattement on the whole gain.
    if (attributionDate < FROM_2016_REFORM) {
      return acquisitionGain * (1 - this._getDetentionAbattement(now));
    }

    // From 31/12/2016: abattement on the fraction below the threshold only.
    const belowThreshold = Math.max(0, Math.min(acquisitionGain, threshold));
    const aboveThreshold = Math.max(0, acquisitionGain - threshold);
    return belowThreshold * (1 - this.getBelowThresholdAbattement(now)) + aboveThreshold;
  }

  /**
   * Detention-duration abattement counted from the acquisition date:
   * 65 % beyond 8 years, 50 % beyond 2 years, 0 otherwise.
   */
  _getDetentionAbattement(now: Date): number {
    const yearsDetained = (now.getTime() - new Date(this.acquisitionDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (yearsDetained > 8) return DETENTION_ABATTEMENT_8Y;
    if (yearsDetained > 2) return DETENTION_ABATTEMENT_2Y;
    return 0;
  }

  /**
   * Abattement rate applied to the below-threshold fraction of the
   * acquisition gain: detention-duration abattement for 2016-2017
   * attributions, the flat 50 % abattement from 2018. Ranks eligible
   * grants when the 300 000 € threshold is allocated.
   */
  getBelowThresholdAbattement(now: Date): number {
    const FROM_2018_REFORM = new Date('2018-01-01');
    return new Date(this.attributionDate) < FROM_2018_REFORM
      ? this._getDetentionAbattement(now)
      : UNIFORM_ABATTEMENT_FROM_2018;
  }

  /**
   * Computes the PlacementIncome for the acquisition gain of this grant.
   * Before 28/09/2012: 30% flat rate. Otherwise: barème progressif with
   * abattements applied via getTaxableAcquisitionGain.
   */
  getAcquisitionIncome(currentPrice: number, threshold: number = 0, now: Date = new Date()): PlacementIncome {
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

  getPlueValueIncome(currentPrice: number): PlacementIncome {
    const plueValue = currentPrice * this.numberOfShares - this.getRealAcquisitionGain(currentPrice);
    return {
      assietteImposition: plueValue,
      eligiblePfu: true,
      deductionRevenus: plueValue
    };
  }

  getPlueValueSocialCharges(currentPrice: number, now: Date = new Date()): number {
    const plueValue = currentPrice * this.numberOfShares - this.getRealAcquisitionGain(currentPrice);
    return plueValue * getSocialContributionRate(now);
  }

  /**
   * Computes the social charges on the acquisition gain of this grant (including employer contribution).
   */
  getAcquisitionSocialCharges(currentPrice: number, threshold: number = 0, now: Date = new Date()): number {
    const acquisitionGain = this.getRealAcquisitionGain(currentPrice);

    const attributionDate = new Date(this.attributionDate);

    const BEFORE_2012_REFORM = new Date('2012-09-28');
    const FROM_2015_REFORM = new Date('2015-08-08');
    const FROM_2016_REFORM = new Date('2016-12-31');
    const FROM_2007_CONTRIBUTION = new Date('2007-10-16');

    const specialRate = SPECIAL_SOCIAL_RATE;
    const employerContributionRate = EMPLOYER_CONTRIBUTION_RATE;

    const socialRate = getSocialContributionRate(now);
    let socialCharges = 0;
    if (attributionDate < BEFORE_2012_REFORM) {
      socialCharges = acquisitionGain * socialRate;
    } else if (attributionDate < FROM_2015_REFORM) {
      socialCharges = acquisitionGain * specialRate;
    } else if (attributionDate < FROM_2016_REFORM) {
      socialCharges = acquisitionGain * socialRate;
    } else {
      // From 31/12/2016: split the gain between the standard and special rates.
      const belowThreshold = Math.max(0, Math.min(acquisitionGain, threshold));
      const aboveThreshold = Math.max(0, acquisitionGain - threshold);
      socialCharges = belowThreshold * socialRate + aboveThreshold * specialRate;
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
   */
  isEligibleFor300kThreshold(): boolean {
    const attributionDate = new Date(this.attributionDate);
    const FROM_2016_REFORM = new Date('2016-12-31');
    return attributionDate >= FROM_2016_REFORM;
  }
}

export interface StockGrantModuleData extends PlacementData {
  stockName?: string;
  currentPrice?: number;
  /** Effective date of the current price (defaults to the placement's asOf). */
  priceAsOf?: string;
  /** Past price states, sorted by date. */
  priceHistory?: PriceHistoryEntry[];
  attributions?: StockGrantData[];
}

export class StockGrantModule extends BasePlacement {
  static getCategory(): Category {
    return Category.INVESTMENTS;
  }
  static readonly THRESHOLD = 300000;

  static getLabel(): string {
    return 'Actions gratuites';
  }

  static getEditorClass() {
    return StockGrantEditor;
  }

  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile, now: Date = new Date()): string {
    return StockGrantTaxExplanation.get(placement as StockGrantModule, fiscalProfile, now);
  }

  stockName: string;
  currentPrice: number;
  priceAsOf: string;
  priceHistory: PriceHistoryEntry[];
  attributions: StockGrant[];

  constructor(data: StockGrantModuleData) {
    super({ ...data, type: 'stock_grant' });
    this.stockName = data.stockName || '';
    this.currentPrice = Number(data.currentPrice) || 0;
    this.priceAsOf = data.priceAsOf || '';
    this.priceHistory = (Array.isArray(data.priceHistory) ? data.priceHistory : [])
      .map(e => ({ date: String(e.date), price: Number(e.price) || 0 }))
      .sort((a, b) => compareDates(a.date, b.date));
    this.attributions = Array.isArray(data.attributions)
      ? data.attributions.map(a => new StockGrant(a))
      : [];
  }

  /**
   * Identity of an attribution line across states: lines are append-only
   * and never deleted (a sale records a 0 or reduced count in
   * sharesHistory), so attribution + acquisition dates identify a line.
   */
  private static grantKey(g: { attributionDate?: string; acquisitionDate?: string }): string {
    return `${g.attributionDate ?? ''}|${g.acquisitionDate ?? ''}`;
  }

  /**
   * The evolving state is not serialized into the flat `history` field: it
   * feeds the nested priceHistory / per-line sharesHistory via
   * insertHistoryEntry(). `attributions` carries just enough identity
   * (attributionDate + acquisitionDate) to match lines across states.
   */
  override getEvolvingValues(): Record<string, unknown> {
    return {
      currentPrice: this.currentPrice,
      attributions: this.attributions.map(a => ({
        attributionDate: a.attributionDate,
        acquisitionDate: a.acquisitionDate,
        numberOfShares: a.numberOfShares
      }))
    };
  }

  /**
   * Every date at which a state is known: the placement's asOf, the price's
   * effective date and history, plus every line's shares dates.
   */
  override getHistoryDates(): string[] {
    const dates = [
      this.asOf,
      this.priceAsOf,
      ...this.priceHistory.map(e => e.date),
      ...this.attributions.flatMap(a => [a.getSharesAsOf(), ...a.sharesHistory.map(e => e.date)])
    ];
    return [...new Set(dates.filter(Boolean))].sort(compareDates);
  }

  /**
   * Price effective at `date`; the earliest known price applies to dates
   * preceding every recorded state.
   */
  private _getPriceAt(date: string): number {
    const entries = [
      ...this.priceHistory,
      { date: this.priceAsOf || this.asOf, price: this.currentPrice }
    ].sort((a, b) => compareDates(a.date, b.date));
    return (resolveAt(entries, date) ?? entries[0]).price;
  }

  /**
   * Reconstructs the state effective at `date`: the resolved price plus one
   * line per attribution already acquired (acquisitionDate <= date, an
   * acquired-grants-only approximation) with its resolved share count.
   * Returns null when the placement was not tracked yet at that date.
   */
  override getDataAt(date: string): StockGrantModuleData | null {
    if (this.isClosedAt(date)) {
      return null;
    }
    const knownDates = this.getHistoryDates();
    if (knownDates.length === 0 || date < knownDates[0]) {
      return null;
    }
    const data = this.toJSON() as Record<string, unknown>;
    delete data.history;
    delete data.priceAsOf;
    delete data.priceHistory;
    const attributions = this.attributions
      .filter(a => !a.acquisitionDate || a.acquisitionDate <= date)
      .map(a => ({
        attributionDate: a.attributionDate,
        acquisitionDate: a.acquisitionDate,
        acquisitionPrice: a.acquisitionPrice,
        numberOfShares: a.getSharesAt(date)
      }));
    return {
      ...data,
      currentPrice: this._getPriceAt(date),
      attributions,
      asOf: date
    } as StockGrantModuleData;
  }

  /**
   * Same reconstruction as `getDataAt`, batched over `dates`: price and
   * each line's share count resolve through forward-only cursors instead
   * of re-scanning their histories per date.
   * @param dates query dates (YYYY-MM-DD), ascending.
   * @returns one StockGrantModuleData per input date, aligned by index —
   *   null where the placement was not tracked yet at that date.
   */
  override getDataSeriesAt(dates: readonly string[]): (StockGrantModuleData | null)[] {
    const knownDates = this.getHistoryDates();
    const firstKnown = knownDates[0];
    const base = this.toJSON() as Record<string, unknown>;
    delete base.history;
    delete base.priceAsOf;
    delete base.priceHistory;
    const priceEntries = [
      ...this.priceHistory,
      { date: this.priceAsOf || this.asOf, price: this.currentPrice }
    ].sort((a, b) => compareDates(a.date, b.date));
    const priceResolver = makeResolver(priceEntries, true);
    const lineResolvers = this.attributions.map(a => ({
      attribution: a,
      resolve: makeResolver(
        [...a.sharesHistory, { date: a.getSharesAsOf(), shares: a.numberOfShares }]
          .sort((x, y) => compareDates(x.date, y.date)),
        true
      )
    }));
    return dates.map(date => {
      if (this.isClosedAt(date)) return null;
      if (firstKnown == null || date < firstKnown) return null;
      return {
        ...base,
        currentPrice: priceResolver(date)!.price,
        attributions: lineResolvers
          .filter(({ attribution }) => !attribution.acquisitionDate || attribution.acquisitionDate <= date)
          .map(({ attribution, resolve }) => ({
            attributionDate: attribution.attributionDate,
            acquisitionDate: attribution.acquisitionDate,
            acquisitionPrice: attribution.acquisitionPrice,
            numberOfShares: resolve(date)!.shares
          })),
        asOf: date
      } as StockGrantModuleData;
    });
  }

  /**
   * Records a state transition by pushing the previous values into the
   * nested histories: the previous price into priceHistory at its own
   * priceAsOf, and each changed line's previous share count into its own
   * sharesHistory (lines matched by attribution + acquisition dates).
   */
  override recordState(previous: BasePlacement | null, effectiveDate: string): void {
    this.asOf = effectiveDate;
    if (!(previous instanceof StockGrantModule)) {
      return;
    }
    this.closedAt ??= previous.closedAt;
    this.history = previous.history;

    if (previous.currentPrice !== this.currentPrice) {
      this.priceHistory = recordAt(previous.priceHistory, {
        date: previous.priceAsOf || previous.asOf,
        price: previous.currentPrice
      });
      this.priceAsOf = effectiveDate;
    } else {
      this.priceHistory = previous.priceHistory;
      this.priceAsOf = previous.priceAsOf;
    }

    for (const grant of this.attributions) {
      const prevGrant = previous.attributions.find(
        a => StockGrantModule.grantKey(a) === StockGrantModule.grantKey(grant)
      );
      if (!prevGrant) {
        continue;
      }
      if (prevGrant.numberOfShares !== grant.numberOfShares) {
        grant.sharesHistory = recordAt(prevGrant.sharesHistory, {
          date: prevGrant.getSharesAsOf() || effectiveDate,
          shares: prevGrant.numberOfShares
        });
        grant.sharesAsOf = effectiveDate;
      } else {
        grant.sharesHistory = prevGrant.sharesHistory;
        grant.sharesAsOf = prevGrant.sharesAsOf;
      }
    }
  }

  /**
   * Records a retroactive state into the nested histories; `values` is the
   * evolving state of the new data (see getEvolvingValues). A dimension is
   * only written when its value differs from what resolves at `date`.
   */
  override insertHistoryEntry(date: string, values: Record<string, unknown>): void {
    const price = Number(values.currentPrice);
    if (Number.isFinite(price) && price !== this._getPriceAt(date)) {
      this.priceHistory = recordAt(this.priceHistory, { date, price });
    }
    const lines = Array.isArray(values.attributions) ? values.attributions as StockGrantData[] : [];
    for (const v of lines) {
      const grant = this.attributions.find(
        a => StockGrantModule.grantKey(a) === StockGrantModule.grantKey(v)
      );
      const shares = Number(v.numberOfShares);
      if (grant && Number.isFinite(shares) && shares !== grant.getSharesAt(date)) {
        grant.sharesHistory = recordAt(grant.sharesHistory, { date, shares });
      }
    }
  }

  /** A point at `date` is deletable when any dimension recorded an entry there. */
  override hasHistoryEntry(date: string): boolean {
    return super.hasHistoryEntry(date)
      || this.priceHistory.some(e => e.date === date)
      || this.attributions.some(a => a.sharesHistory.some(e => e.date === date));
  }

  /**
   * Deletes the state recorded at `date` in every dimension's history —
   * price and per-line shares included.
   */
  override deleteHistoryEntry(date: string): void {
    super.deleteHistoryEntry(date);
    this.priceHistory = deleteAt(this.priceHistory, date);
    for (const grant of this.attributions) {
      grant.sharesHistory = deleteAt(grant.sharesHistory, date);
    }
  }

  /**
   * The nested model rolls back per dimension: the current point is
   * deletable when some dimension stamped its current value at asOf and
   * has a previous entry to revert to.
   */
  override canDeleteCurrentState(): boolean {
    if (super.canDeleteCurrentState()) {
      return true;
    }
    const priceReverts = (this.priceAsOf || this.asOf) === this.asOf && this.priceHistory.length > 0;
    const sharesRevert = this.attributions.some(
      a => a.sharesAsOf === this.asOf && a.sharesHistory.length > 0
    );
    return priceReverts || sharesRevert;
  }

  /**
   * Reverts each dimension whose current value was recorded at asOf to
   * its latest history entry — matching the state that resolves at the
   * previous known date. asOf then falls back to that date.
   */
  override deleteCurrentState(): boolean {
    let reverted = false;
    // The flat history is unused by this module but stays consistent.
    if (this.history.length > 0) {
      this.history = this.history.slice(0, -1);
      reverted = true;
    }
    if ((this.priceAsOf || this.asOf) === this.asOf && this.priceHistory.length > 0) {
      const last = this.priceHistory[this.priceHistory.length - 1];
      this.currentPrice = last.price;
      this.priceAsOf = last.date;
      this.priceHistory = this.priceHistory.slice(0, -1);
      reverted = true;
    }
    for (const grant of this.attributions) {
      if (grant.sharesAsOf === this.asOf && grant.sharesHistory.length > 0) {
        const last = grant.sharesHistory[grant.sharesHistory.length - 1];
        grant.numberOfShares = last.shares;
        grant.sharesAsOf = last.date;
        grant.sharesHistory = grant.sharesHistory.slice(0, -1);
        reverted = true;
      }
    }
    if (!reverted) {
      return false;
    }
    const remaining = this.getHistoryDates().filter(d => d !== this.asOf);
    this.asOf = remaining[remaining.length - 1] ?? this.asOf;
    return true;
  }

  _getTotalShares(): number {
    return this.attributions.reduce((sum, a) => sum + a.numberOfShares, 0);
  }

  _getAttributionGain(grant: StockGrant): { acquisitionPart: number; capitalPart: number } {
    const realAcquisitionPrice = Math.min(grant.acquisitionPrice, this.currentPrice);
    const acquisitionPart = realAcquisitionPrice * grant.numberOfShares;
    const capitalPart = (this.currentPrice - realAcquisitionPrice) * grant.numberOfShares;
    return { acquisitionPart, capitalPart };
  }

  getLatentGain(): number {
    return this._getTotalShares() * this.currentPrice;
  }

  getAcquisitionGain(): number {
    return this.attributions.reduce((sum, a) => sum + this._getAttributionGain(a).acquisitionPart, 0);
  }

  getCapitalGain(): number {
    return this.attributions.reduce((sum, a) => sum + this._getAttributionGain(a).capitalPart, 0);
  }

  /**
   * Allocates the 300 000 € threshold across eligible grants by
   * descending below-threshold abattement: each euro of threshold buys
   * more tax relief on a 65 % grant than on a 50 % one, so exhausting
   * the highest abattement first is the optimum. Social charges are
   * indifferent to the split (every euro moved below the threshold swaps
   * the same rates on every grant), so this ordering only optimizes the
   * income tax base. Grants with equal abattement keep their declaration
   * order (stable sort), which makes the allocation deterministic.
   * @returns per-grant allocated threshold; absent grants get 0.
   */
  _allocateThreshold(currentPrice: number, now: Date): Map<StockGrant, number> {
    const eligibleGrants = this.attributions
      .filter(a => a.isEligibleFor300kThreshold())
      .sort((a, b) => b.getBelowThresholdAbattement(now) - a.getBelowThresholdAbattement(now));
    const thresholdMap = new Map<StockGrant, number>();
    let remaining = StockGrantModule.THRESHOLD;
    for (const grant of eligibleGrants) {
      const allocated = Math.min(grant.getRealAcquisitionGain(currentPrice), remaining);
      thresholdMap.set(grant, allocated);
      remaining -= allocated;
      if (remaining <= 0) break;
    }
    return thresholdMap;
  }

  /**
   * Computes the total social charges for all grants.
   * Eligible grants (attribution from 31/12/2016) share the 300 000 €
   * threshold, allocated by descending abattement (see _allocateThreshold).
   * Each grant then contributes its acquisition social charges (using the
   * allocated threshold) plus its capital gain social charges.
   */
  getSocialCharges(now: Date = new Date()): number {
    const currentPrice = this.currentPrice;
    const thresholdMap = this._allocateThreshold(currentPrice, now);

    return this.attributions.reduce((sum, grant) => {
      const threshold = thresholdMap.get(grant) ?? 0;
      return sum
        + grant.getAcquisitionSocialCharges(currentPrice, threshold, now)
        + grant.getPlueValueSocialCharges(currentPrice, now);
    }, 0);
  }

  /**
   * Computes the PlacementIncome[] for all grants, applying the 300 000 €
   * threshold by descending abattement across eligible grants (same
   * allocation as getSocialCharges). For each grant, includes both the
   * acquisition income and the capital gain (plus-value) income.
   */
  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    const currentPrice = this.currentPrice;
    const thresholdMap = this._allocateThreshold(currentPrice, now);

    const incomes: PlacementIncome[] = [];
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

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const grossValue = this.getLatentGain();
    const socialCharges = this.getSocialCharges(now);

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: grossValue,
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  override toJSON(): StockGrantModuleData {
    return {
      ...super.toJSON(),
      stockName: this.stockName,
      currentPrice: this.currentPrice,
      ...(this.priceAsOf ? { priceAsOf: this.priceAsOf } : {}),
      ...(this.priceHistory.length > 0 ? { priceHistory: this.priceHistory } : {}),
      attributions: this.attributions.map(a => a.toJSON())
    };
  }
}

const _check: PlacementModuleStatic = StockGrantModule;
export default StockGrantModule;
