export interface UiStateData {
  selectedCategories: string[];
  selectedInstitutions: string[];
  sortLevels: SortLevel[];
  breakdownVisible: boolean;
  filterTotals: boolean;
  historyVisible: boolean;
  historyVariationsOpen: boolean;
  showClosedPlacements: boolean;
  /** Selected INSEE inflation series id, or null for "no inflation". */
  inflationSource: string | null;
  /** Kind of session active on last render — lets a reload skip the landing before the auth check resolves. */
  lastSession: 'account' | 'demo' | null;
}

export type SortField = 'name' | 'institution' | 'category' | 'grossValue' | 'netValue';
export type SortDirection = 'asc' | 'desc';

export interface SortLevel {
  field: SortField;
  direction: SortDirection;
}

export class UiState {
  static readonly STORAGE_KEY = 'patrimoine_ui_v1';

  static load(): UiStateData {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as Partial<UiStateData> : {};
      return {
        selectedCategories: Array.isArray(parsed.selectedCategories) ? parsed.selectedCategories : [],
        selectedInstitutions: Array.isArray(parsed.selectedInstitutions) ? parsed.selectedInstitutions : [],
        sortLevels: Array.isArray(parsed.sortLevels) ? parsed.sortLevels as SortLevel[] : [],
        breakdownVisible: typeof parsed.breakdownVisible === 'boolean' ? parsed.breakdownVisible : true,
        filterTotals: typeof parsed.filterTotals === 'boolean' ? parsed.filterTotals : false,
        historyVisible: typeof parsed.historyVisible === 'boolean' ? parsed.historyVisible : false,
        historyVariationsOpen: typeof parsed.historyVariationsOpen === 'boolean' ? parsed.historyVariationsOpen : true,
        showClosedPlacements: typeof parsed.showClosedPlacements === 'boolean' ? parsed.showClosedPlacements : false,
        inflationSource: typeof parsed.inflationSource === 'string' ? parsed.inflationSource : null,
        lastSession: parsed.lastSession === 'account' || parsed.lastSession === 'demo' ? parsed.lastSession : null
      };
    } catch {
      return this._default();
    }
  }

  static save(partial: Partial<UiStateData>): void {
    const current = this.load();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
    } catch {
      console.error('Failed to save UI state', partial);
    }
  }

  static _default(): UiStateData {
    return {
      selectedCategories: [],
      selectedInstitutions: [],
      sortLevels: [],
      breakdownVisible: true,
      filterTotals: false,
      historyVisible: false,
      historyVariationsOpen: true,
      showClosedPlacements: false,
      inflationSource: null,
      lastSession: null
    };
  }
}
