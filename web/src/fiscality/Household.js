export class Household {
  constructor(data = {}) {
    this.maritalStatus = data.maritalStatus ?? 'single';
    this.childrenCount = data.childrenCount ?? 0;
    this.alternateChildrenCount = data.alternateChildrenCount ?? 0;
    this.isSingleParent = data.isSingleParent ?? false;
  }

  static from(data) {
    return new Household(data);
  }

  toJSON() {
    return {
      maritalStatus: this.maritalStatus,
      childrenCount: this.childrenCount,
      alternateChildrenCount: this.alternateChildrenCount,
      isSingleParent: this.isSingleParent
    };
  }
}
