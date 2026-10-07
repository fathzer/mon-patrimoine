export type MaritalStatus = 'single' | 'married' | 'widowed';

const MARITAL_STATUSES: ReadonlySet<MaritalStatus> = new Set(['single', 'married', 'widowed']);

export interface HouseholdData {
  maritalStatus?: MaritalStatus;
  childrenCount?: number;
  alternateChildrenCount?: number;
  // Children holding an invalidity card, per custody type (OpenFisca nbG/nbI)
  disabledChildrenCount?: number;
  disabledAlternateChildrenCount?: number;
  isSingleParent?: boolean;
  caseL?: boolean;
  // Invalidity/veteran declaration cases (tick boxes on form 2042)
  caseP?: boolean;
  caseF?: boolean;
  caseW?: boolean;
  caseS?: boolean;
  caseG?: boolean;
}

export class Household {
  maritalStatus: MaritalStatus;
  childrenCount: number;
  alternateChildrenCount: number;
  disabledChildrenCount: number;
  disabledAlternateChildrenCount: number;
  isSingleParent: boolean;
  caseL: boolean;
  caseP: boolean;
  caseF: boolean;
  caseW: boolean;
  caseS: boolean;
  caseG: boolean;

  constructor(data: HouseholdData = {}) {
    this.maritalStatus = data.maritalStatus ?? 'single';
    this.childrenCount = data.childrenCount ?? 0;
    this.alternateChildrenCount = data.alternateChildrenCount ?? 0;
    this.disabledChildrenCount = data.disabledChildrenCount ?? 0;
    this.disabledAlternateChildrenCount = data.disabledAlternateChildrenCount ?? 0;
    this.isSingleParent = data.isSingleParent ?? false;
    this.caseL = data.caseL ?? false;
    this.caseP = data.caseP ?? false;
    this.caseF = data.caseF ?? false;
    this.caseW = data.caseW ?? false;
    this.caseS = data.caseS ?? false;
    this.caseG = data.caseG ?? false;
    this._validate();
  }

  /**
   * Rejects inconsistent household data instead of silently fixing it: a
   * corrupted profile must surface as an error, not produce a wrong tax.
   */
  private _validate(): void {
    if (!MARITAL_STATUSES.has(this.maritalStatus)) {
      throw new RangeError(`Invalid maritalStatus: ${this.maritalStatus}`);
    }
    for (const field of [
      'childrenCount',
      'alternateChildrenCount',
      'disabledChildrenCount',
      'disabledAlternateChildrenCount'
    ] as const) {
      const value = this[field];
      if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${field} must be a non-negative integer, got ${value}`);
      }
    }
    if (this.disabledChildrenCount > this.childrenCount) {
      throw new RangeError(`disabledChildrenCount (${this.disabledChildrenCount}) exceeds childrenCount (${this.childrenCount})`);
    }
    if (this.disabledAlternateChildrenCount > this.alternateChildrenCount) {
      throw new RangeError(`disabledAlternateChildrenCount (${this.disabledAlternateChildrenCount}) exceeds alternateChildrenCount (${this.alternateChildrenCount})`);
    }
  }

  static from(data: HouseholdData): Household {
    return new Household(data);
  }

  toJSON(): HouseholdData {
    return {
      maritalStatus: this.maritalStatus,
      childrenCount: this.childrenCount,
      alternateChildrenCount: this.alternateChildrenCount,
      disabledChildrenCount: this.disabledChildrenCount,
      disabledAlternateChildrenCount: this.disabledAlternateChildrenCount,
      isSingleParent: this.isSingleParent,
      caseL: this.caseL,
      caseP: this.caseP,
      caseF: this.caseF,
      caseW: this.caseW,
      caseS: this.caseS,
      caseG: this.caseG
    };
  }
}

/**
 * A household instance or its plain serialized form.
 */
export type HouseholdLike = Household | HouseholdData;
