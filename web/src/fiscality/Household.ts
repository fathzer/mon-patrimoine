export type MaritalStatus = 'single' | 'married';

export interface HouseholdData {
  maritalStatus?: MaritalStatus;
  childrenCount?: number;
  alternateChildrenCount?: number;
  isSingleParent?: boolean;
}

export class Household {
  maritalStatus: MaritalStatus;
  childrenCount: number;
  alternateChildrenCount: number;
  isSingleParent: boolean;

  constructor(data: HouseholdData = {}) {
    this.maritalStatus = data.maritalStatus ?? 'single';
    this.childrenCount = data.childrenCount ?? 0;
    this.alternateChildrenCount = data.alternateChildrenCount ?? 0;
    this.isSingleParent = data.isSingleParent ?? false;
  }

  static from(data: HouseholdData): Household {
    return new Household(data);
  }

  toJSON(): HouseholdData {
    return {
      maritalStatus: this.maritalStatus,
      childrenCount: this.childrenCount,
      alternateChildrenCount: this.alternateChildrenCount,
      isSingleParent: this.isSingleParent
    };
  }
}
