export type MaritalStatus = 'single' | 'married' | 'widowed';

export interface HouseholdData {
  maritalStatus?: MaritalStatus;
  childrenCount?: number;
  alternateChildrenCount?: number;
  isSingleParent?: boolean;
  caseL?: boolean;
}

export class Household {
  maritalStatus: MaritalStatus;
  childrenCount: number;
  alternateChildrenCount: number;
  isSingleParent: boolean;
  caseL: boolean;

  constructor(data: HouseholdData = {}) {
    this.maritalStatus = data.maritalStatus ?? 'single';
    this.childrenCount = data.childrenCount ?? 0;
    this.alternateChildrenCount = data.alternateChildrenCount ?? 0;
    this.isSingleParent = data.isSingleParent ?? false;
    this.caseL = data.caseL ?? false;
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
      caseL: this.caseL
    };
  }
}
