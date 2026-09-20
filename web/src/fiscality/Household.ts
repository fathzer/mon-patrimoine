export type MaritalStatus = 'single' | 'married' | 'widowed';

export interface HouseholdData {
  maritalStatus?: MaritalStatus;
  childrenCount?: number;
  alternateChildrenCount?: number;
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
    this.isSingleParent = data.isSingleParent ?? false;
    this.caseL = data.caseL ?? false;
    this.caseP = data.caseP ?? false;
    this.caseF = data.caseF ?? false;
    this.caseW = data.caseW ?? false;
    this.caseS = data.caseS ?? false;
    this.caseG = data.caseG ?? false;
  }

  static from(data: HouseholdData): Household {
    return new Household(data);
  }

  toJSON(): HouseholdData {
    return {
      maritalStatus: this.maritalStatus,
      childrenCount: this.childrenCount,
      alternateChildrenCount: this.alternateChildrenCount,
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
