export class UiState {
  static STORAGE_KEY = 'patrimoine_ui_v1';

  static load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        selectedCategories: Array.isArray(parsed.selectedCategories) ? parsed.selectedCategories : [],
        selectedInstitutions: Array.isArray(parsed.selectedInstitutions) ? parsed.selectedInstitutions : [],
        sortLevels: Array.isArray(parsed.sortLevels) ? parsed.sortLevels : [],
        breakdownVisible: typeof parsed.breakdownVisible === 'boolean' ? parsed.breakdownVisible : true
      };
    } catch {
      return this._default();
    }
  }

  static save(partial) {
    const current = this.load();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
    } catch {
      console.error('Failed to save UI state', partial);
    }
  }

  static _default() {
    return {
      selectedCategories: [],
      selectedInstitutions: [],
      sortLevels: [],
      breakdownVisible: true
    };
  }
}
