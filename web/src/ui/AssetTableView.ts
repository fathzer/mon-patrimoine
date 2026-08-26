import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import type { SortLevel, SortField } from '../core/UiState.js';
import { PlacementFactory } from '../placements/PlacementFactory.js';
import { PlacementModalView } from './PlacementModalView.js';
import type { AppStore, EvaluationEntry, GlobalSummary } from '../core/AppStore.js';
import type { BasePlacement, Evaluation } from '../placements/BasePlacement.js';

const NO_INSTITUTION_KEY = '__NONE__';

interface AssetTableOptions {
  onFiltersChanged?: () => void;
}

interface FilterOption {
  key: string;
  label: string;
}

interface SortOption {
  key: SortField;
  label: string;
}

type FilterGroup = 'categories' | 'institutions';

export class AssetTableView {
  store: AppStore;
  selectedCategories: Set<string>;
  selectedInstitutions: Set<string>;
  sortLevels: SortLevel[];
  onFiltersChanged: (() => void) | null;
  activePopup: HTMLDivElement | null;
  _onDocClick: (() => void) | null;
  _onDocKeydown: ((e: KeyboardEvent) => void) | null;
  container: HTMLElement | null;
  summary: GlobalSummary | null;
  modalRoot: HTMLElement | null;

  constructor(store: AppStore, options: AssetTableOptions = {}) {
    this.store = store;
    const ui = UiState.load();
    this.selectedCategories = new Set(ui.selectedCategories);
    this.selectedInstitutions = new Set(ui.selectedInstitutions);
    this.sortLevels = ui.sortLevels;
    this.onFiltersChanged = options.onFiltersChanged || null;
    this.activePopup = null;
    this._onDocClick = null;
    this._onDocKeydown = null;
    this.container = null;
    this.summary = null;
    this.modalRoot = null;
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  render(summary: GlobalSummary, modalRoot: HTMLElement): void {
    this._closePopup();
    this.summary = summary;
    this.modalRoot = modalRoot;
    this.container!.innerHTML = `
      <div class="toolbar">
        ${this._renderFilterBar(summary)}
        <div class="toolbar-actions">
          <button class="btn-primary btn-add-asset" type="button">${I18n.t('actions.addAsset')}</button>
        </div>
      </div>

      <section class="asset-table-container">
        <table class="asset-table">
          <thead>
            <tr>
              <th>${I18n.t('table.assetHeader')}</th>
              <th>${I18n.t('table.categoryHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.grossHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.socialHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.taxHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.netHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this._renderAssetRows(summary.evaluations!)}
          </tbody>
        </table>
      </section>

      <div class="asset-table-fab">
        <button class="btn-primary btn-add-asset" type="button">${I18n.t('actions.addAsset')}</button>
      </div>
    `;

    this._bindStaticEvents();
    this._bindTableEvents();
  }

  _renderFilterBar(summary: GlobalSummary): string {
    return `
      <div class="filter-summaries">
        ${this._renderFilterButton('categories', I18n.t('filters.categories'), 'btn-filter-categories')}
        ${this._renderFilterButton('institutions', I18n.t('filters.institutions'), 'btn-filter-institutions')}
        ${this._renderSortButton()}
      </div>
    `;
  }

  _renderFilterButton(group: FilterGroup, defaultLabel: string, id: string): string {
    const isActive = this._isFilterActive(group);
    return `
      <button id="${id}" class="filter-btn ${isActive ? 'active' : ''}" type="button">
        ${this._renderFilterButtonContent(group, defaultLabel)}
      </button>
    `;
  }

  _renderFilterButtonContent(group: FilterGroup, defaultLabel: string): string {
    if (this._isFilterActive(group)) {
      return `<span class="filter-clear" data-group="${group}">×</span><span class="filter-summary-label">${this._escapeHtml(defaultLabel)}</span>`;
    }
    return `<span class="filter-mark">+</span><span class="filter-summary-label">${this._escapeHtml(defaultLabel)}</span>`;
  }

  _isFilterActive(group: FilterGroup): boolean {
    return group === 'categories'
      ? this.selectedCategories.size > 0
      : this.selectedInstitutions.size > 0;
  }

  _getInstitutionOptions(evaluations: EvaluationEntry[] | undefined): FilterOption[] {
    const options = new Map<string, FilterOption>();
    for (const { instance } of evaluations || []) {
      const raw = (instance.institution || '').trim();
      const key = raw || NO_INSTITUTION_KEY;
      const label = raw || I18n.t('filters.withoutInstitution');
      if (!options.has(key)) {
        options.set(key, { key, label });
      }
    }
    const result = Array.from(options.values());
    const none = result.find(o => o.key === NO_INSTITUTION_KEY);
    const others = result.filter(o => o.key !== NO_INSTITUTION_KEY).sort((a, b) => a.label.localeCompare(b.label));
    return none ? [none, ...others] : others;
  }

  _renderAssetRows(evaluations: EvaluationEntry[]): string {
    const filtered = this._getFilteredEvaluations(evaluations);

    if (!filtered || filtered.length === 0) {
      return `<tr><td colspan="7" style="text-align:center;" class="text-muted">Aucun actif trouvé</td></tr>`;
    }

    const sorted = this._sortEvaluations(filtered);

    return sorted.map(({ instance, evaluation }) => {
      const institutionHtml = instance.institution
        ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${this._escapeHtml(instance.institution)}</div>`
        : '';
      const gross = this._formatCurrency(evaluation.grossValue);
      const social = this._formatCurrency(evaluation.socialCharges);
      const tax = this._formatCurrency(evaluation.imposition);
      const net = this._formatCurrency(this._getNetValue(evaluation));

      return `
      <tr class="asset-row" data-id="${instance.id}">
        <td data-label="${this._escapeHtml(I18n.t('table.assetHeader'))}">
          <div style="font-weight: 600;">${this._escapeHtml(instance.label)}</div>
          ${institutionHtml}
        </td>
        <td data-label="${this._escapeHtml(I18n.t('table.categoryHeader'))}"><span class="tag-category">${I18n.t(`categories.${PlacementFactory.getCategory(instance.type)}`)}</span></td>
        <td data-label="${this._escapeHtml(I18n.t('table.grossHeader'))}" style="text-align: right;">${gross ? `<strong>${gross}</strong>` : ''}</td>
        <td class="tax-info-cell" data-label="${this._escapeHtml(I18n.t('table.socialHeader'))}" style="text-align: right;">${social}</td>
        <td class="tax-info-cell" data-label="${this._escapeHtml(I18n.t('table.taxHeader'))}" style="text-align: right;">${tax}</td>
        <td data-label="${this._escapeHtml(I18n.t('table.netHeader'))}" style="text-align: right; color: var(--accent);">${net ? `<strong>${net}</strong>` : ''}</td>
        <td style="text-align: center;">${this._renderFiscalIcon(evaluation, instance)}</td>
      </tr>
    `;
    }).join('');
  }

  _bindStaticEvents(): void {
    this.container!.querySelectorAll('.btn-add-asset').forEach(btn => {
      btn.addEventListener('click', () => {
        const placementModal = new PlacementModalView(this.modalRoot!, this.store);
        placementModal.show();
      });
    });

    this.container!.querySelector('#btn-filter-categories')?.addEventListener('click', (e) => {
      const me = e as MouseEvent;
      me.stopPropagation();
      if ((me.target as HTMLElement).closest('.filter-clear')) {
        this._clearFilter('categories');
      } else {
        this._togglePopup('categories', me.currentTarget as HTMLElement);
      }
    });

    this.container!.querySelector('#btn-filter-institutions')?.addEventListener('click', (e) => {
      const me = e as MouseEvent;
      me.stopPropagation();
      if ((me.target as HTMLElement).closest('.filter-clear')) {
        this._clearFilter('institutions');
      } else {
        this._togglePopup('institutions', me.currentTarget as HTMLElement);
      }
    });

    this.container!.querySelector('#btn-sort')?.addEventListener('click', (e) => {
      const me = e as MouseEvent;
      me.stopPropagation();
      if ((me.target as HTMLElement).closest('[data-action="clear-sort"]')) {
        this._clearSort();
        return;
      }
      if ((me.target as HTMLElement).closest('[data-action="toggle-direction"]')) {
        this._toggleSortDirection();
        return;
      }
      this._toggleSortPopup(me.currentTarget as HTMLElement);
    });
  }

  _bindTableEvents(): void {
    this.container!.querySelectorAll<HTMLElement>('.asset-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const me = e as MouseEvent;
        if ((me.target as HTMLElement).closest('.tax-help-btn')) return;
        const item = this.summary!.evaluations!.find(ev => ev.instance.id === row.dataset.id);
        if (item) {
          const placementModal = new PlacementModalView(this.modalRoot!, this.store);
          placementModal.show(item.instance);
        }
      });
    });

    this.container!.querySelectorAll<HTMLElement>('.tax-help-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePopup();
        const item = this.summary!.evaluations!.find(ev => ev.instance.id === btn.dataset.id);
        if (item) {
          this._showTaxExplanation(item);
        }
      });
    });

    this.container!.querySelectorAll<HTMLElement>('.tax-info-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;
        e.stopPropagation();
        this._closePopup();
        const row = cell.closest('.asset-row') as HTMLElement | null;
        const item = this.summary!.evaluations!.find(ev => ev.instance.id === row?.dataset.id);
        if (item) {
          this._showTaxExplanation(item);
        }
      });
    });
  }

  _clearFilter(group: FilterGroup): void {
    if (group === 'categories') {
      this.selectedCategories.clear();
    } else {
      this.selectedInstitutions.clear();
    }
    this._closePopup();
    this._applyFilters();
  }

  _applyFilters(): void {
    const tbody = this.container!.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = this._renderAssetRows(this.summary!.evaluations!);
    }
    this._updateFilterButtons();
    this._saveUiState();
    this._bindTableEvents();
    this.onFiltersChanged?.();
  }

  _updateFilterButtons(): void {
    const catBtn = this.container!.querySelector('#btn-filter-categories');
    if (catBtn) {
      catBtn.classList.toggle('active', this._isFilterActive('categories'));
      catBtn.innerHTML = this._renderFilterButtonContent('categories', I18n.t('filters.categories'));
    }
    const instBtn = this.container!.querySelector('#btn-filter-institutions');
    if (instBtn) {
      instBtn.classList.toggle('active', this._isFilterActive('institutions'));
      instBtn.innerHTML = this._renderFilterButtonContent('institutions', I18n.t('filters.institutions'));
    }
  }

  _togglePopup(group: FilterGroup, trigger: HTMLElement): void {
    if (this.activePopup?.dataset.group === group) {
      this._closePopup();
    } else {
      this._showPopup(group, trigger);
    }
  }

  _showPopup(group: FilterGroup, trigger: HTMLElement): void {
    this._closePopup();
    const options = group === 'categories'
      ? (this.summary!.categories || []).map(catKey => ({ key: catKey, label: I18n.t(`categories.${catKey}`) })).sort((a, b) => this._compareStrings(a.label, b.label))
      : this._getInstitutionOptions(this.summary!.evaluations);

    const popup = document.createElement('div');
    popup.className = 'filter-popup';
    popup.dataset.group = group;
    popup.innerHTML = `
      <div class="filter-popup-header">${this._escapeHtml(I18n.t(`filters.${group}`))}</div>
      <div class="filter-popup-options">
        ${options.map(({ key, label }) => `
          <label class="filter-popup-option">
            <input type="checkbox" class="filter-popup-check" data-value="${this._escapeHtml(key)}" ${this._isSelected(group, key) ? 'checked' : ''}>
            <span>${this._escapeHtml(label)}</span>
          </label>
        `).join('')}
      </div>
    `;

    document.body.appendChild(popup);
    this.activePopup = popup;
    this._positionPopup(popup, trigger);
    this._bindPopupListeners();
    this._bindDocumentListeners();
  }

  _bindPopupListeners(): void {
    if (!this.activePopup) return;
    this.activePopup.addEventListener('click', (e) => e.stopPropagation());
    this.activePopup.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('filter-popup-check')) {
        const group = this.activePopup!.dataset.group as FilterGroup;
        const value = target.dataset.value!;
        const set = group === 'categories' ? this.selectedCategories : this.selectedInstitutions;
        if (target.checked) {
          set.add(value);
        } else {
          set.delete(value);
        }
        this._applyFilters();
      }
    });
  }

  _bindDocumentListeners(): void {
    this._onDocClick = () => this._closePopup();
    this._onDocKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') this._closePopup(); };
    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onDocKeydown);
  }

  _closePopup(): void {
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
    if (this._onDocClick) {
      document.removeEventListener('click', this._onDocClick);
      this._onDocClick = null;
    }
    if (this._onDocKeydown) {
      document.removeEventListener('keydown', this._onDocKeydown);
      this._onDocKeydown = null;
    }
  }

  _positionPopup(popup: HTMLDivElement, trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + popupRect.width > window.innerWidth - margin) {
      left = window.innerWidth - popupRect.width - margin;
    }
    if (left < margin) left = margin;
    if (top + popupRect.height > window.innerHeight - margin) {
      top = rect.top - popupRect.height - margin;
    }
    if (top < margin) top = margin;
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  _isSelected(group: FilterGroup, key: string): boolean {
    return group === 'categories'
      ? this.selectedCategories.has(key)
      : this.selectedInstitutions.has(key);
  }

  _showTaxExplanation(item: EvaluationEntry): void {
    const EditorClass = PlacementFactory.getEditorClass(item.instance.type);
    const tempContainer = document.createElement('div');
    const editor = new EditorClass(tempContainer, this.store);
    let content: string;
    try {
      content = editor.buildTaxExplanation(item.instance, this.store.getTaxProfile());
    } catch {
      content = '<p class="text-muted">Tax explanation is not available for this placement type yet.</p>';
    }

    this.modalRoot!.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content help-modal-content">
          <h2>${I18n.t('taxExplanation.title')}</h2>
          <div class="help-modal-body">
            ${content}
          </div>
          <div class="modal-actions help-modal-footer">
            <button type="button" id="btn-close-tax" class="btn-primary">${I18n.t('form.close')}</button>
          </div>
        </div>
      </div>
    `;

    const close = (): void => {
      this.modalRoot!.innerHTML = '';
    };

    this.modalRoot!.querySelector('#btn-close-tax')?.addEventListener('click', close);
    const overlay = this.modalRoot!.querySelector('.modal-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  _saveUiState(): void {
    UiState.save({
      selectedCategories: Array.from(this.selectedCategories),
      selectedInstitutions: Array.from(this.selectedInstitutions),
      sortLevels: this.sortLevels
    });
  }

  getFilteredEvaluations(evaluations: EvaluationEntry[] | undefined = this.summary?.evaluations): EvaluationEntry[] {
    return this._getFilteredEvaluations(evaluations);
  }

  _getFilteredEvaluations(evaluations: EvaluationEntry[] | undefined): EvaluationEntry[] {
    return (evaluations || []).filter(({ instance }) => {
      const catMatch = this.selectedCategories.size === 0 || this.selectedCategories.has(PlacementFactory.getCategory(instance.type));
      const raw = (instance.institution || '').trim();
      const instKey = raw || NO_INSTITUTION_KEY;
      const instMatch = this.selectedInstitutions.size === 0 || this.selectedInstitutions.has(instKey);
      return catMatch && instMatch;
    });
  }

  _getNetValue(evaluation: Evaluation): number {
    return (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
  }

  _sortEvaluations(evaluations: EvaluationEntry[]): EvaluationEntry[] {
    if (this.sortLevels.length === 0) {
      return evaluations;
    }

    const sorted = [...evaluations];
    sorted.sort((a, b) => {
      for (const level of this.sortLevels) {
        const dir = level.direction === 'asc' ? 1 : -1;
        let cmp = 0;
        switch (level.field) {
          case 'name':
            cmp = this._compareStrings(a.instance.label, b.instance.label);
            break;
          case 'institution':
            cmp = this._compareStrings(a.instance.institution, b.instance.institution);
            break;
          case 'category':
            cmp = this._compareStrings(I18n.t(`categories.${PlacementFactory.getCategory(a.instance.type)}`), I18n.t(`categories.${PlacementFactory.getCategory(b.instance.type)}`));
            break;
          case 'grossValue':
            cmp = (a.evaluation.grossValue ?? 0) - (b.evaluation.grossValue ?? 0);
            break;
          case 'netValue':
            cmp = this._getNetValue(a.evaluation) - this._getNetValue(b.evaluation);
            break;
        }
        cmp *= dir;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return sorted;
  }

  _compareStrings(a: string | null | undefined, b: string | null | undefined): number {
    return (a ?? '').toLowerCase().localeCompare((b ?? '').toLowerCase(), 'fr');
  }

  _renderSortButton(): string {
    const isActive = this.sortLevels.length > 0;
    return `
      <button id="btn-sort" class="filter-btn ${isActive ? 'active' : ''}" type="button">
        ${this._renderSortButtonContent()}
      </button>
    `;
  }

  _renderSortButtonContent(): string {
    if (this.sortLevels.length > 0) {
      const primary = this.sortLevels[0];
      const fieldLabel = this._getSortFieldLabel(primary.field);
      const arrow = primary.direction === 'asc' ? '↓' : '↑';
      return `<span class="filter-clear" data-action="clear-sort">×</span><span class="filter-summary-label">${this._escapeHtml(fieldLabel)}</span> <span class="sort-direction" data-action="toggle-direction">${arrow}</span>`;
    }
    return `<span class="filter-mark">+</span> <span class="filter-summary-label">${this._escapeHtml(I18n.t('sort.label'))}</span>`;
  }

  _toggleSortDirection(): void {
    if (this.sortLevels.length === 0) return;
    this.sortLevels[0].direction = this.sortLevels[0].direction === 'asc' ? 'desc' : 'asc';
    this._applySort();
  }

  _pushSortField(field: SortField): void {
    const index = this.sortLevels.findIndex(level => level.field === field);
    if (index !== -1) {
      const [level] = this.sortLevels.splice(index, 1);
      this.sortLevels.unshift(level);
    } else {
      this.sortLevels.unshift({ field, direction: 'asc' });
    }
  }

  _getSortFieldLabel(field: SortField): string {
    switch (field) {
      case 'name':
        return I18n.t('form.label');
      case 'institution':
        return I18n.t('form.institution');
      case 'category':
        return I18n.t('form.category');
      case 'grossValue':
        return I18n.t('table.grossHeader');
      case 'netValue':
        return I18n.t('table.netHeader');
      default:
        return '';
    }
  }

  _getSortOptions(): SortOption[] {
    return [
      { key: 'name', label: I18n.t('form.label') },
      { key: 'institution', label: I18n.t('form.institution') },
      { key: 'category', label: I18n.t('form.category') },
      { key: 'grossValue', label: I18n.t('table.grossHeader') },
      { key: 'netValue', label: I18n.t('table.netHeader') }
    ];
  }

  _clearSort(): void {
    this.sortLevels = [];
    this._closePopup();
    this._applySort();
  }

  _applySort(): void {
    const tbody = this.container!.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = this._renderAssetRows(this.summary!.evaluations!);
    }
    this._updateFilterButtons();
    this._updateSortButton();
    this._saveUiState();
    this._bindTableEvents();
  }

  _updateSortButton(): void {
    const btn = this.container!.querySelector('#btn-sort');
    if (btn) {
      btn.classList.toggle('active', this.sortLevels.length > 0);
      btn.innerHTML = this._renderSortButtonContent();
    }
  }

  _toggleSortPopup(trigger: HTMLElement): void {
    if (this.activePopup?.dataset.group === 'sort') {
      this._closePopup();
    } else {
      this._showSortPopup(trigger);
    }
  }

  _showSortPopup(trigger: HTMLElement): void {
    this._closePopup();
    const options = this._getSortOptions();
    const selected = this.sortLevels[0]?.field ?? null;

    const popup = document.createElement('div');
    popup.className = 'filter-popup';
    popup.dataset.group = 'sort';
    popup.innerHTML = `
      <div class="filter-popup-header">${this._escapeHtml(I18n.t('sort.label'))}</div>
      <div class="filter-popup-options">
        ${options.map(({ key, label }) => `
          <label class="filter-popup-option sort-popup-option">
            <input type="radio" name="sort" value="${key}" class="sort-popup-radio" ${key === selected ? 'checked' : ''}>
            <span>${this._escapeHtml(label)}</span>
          </label>
        `).join('')}
      </div>
    `;

    document.body.appendChild(popup);
    this.activePopup = popup;
    this._positionPopup(popup, trigger);
    this._bindSortPopupListeners();
    this._bindDocumentListeners();
  }

  _bindSortPopupListeners(): void {
    if (!this.activePopup) return;
    this.activePopup.addEventListener('click', (e) => e.stopPropagation());
    this.activePopup.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('sort-popup-radio')) {
        this._pushSortField(target.value as SortField);
        this._closePopup();
        this._applySort();
      }
    });
  }

  _formatCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === 0) {
      return '';
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  _renderFiscalIcon(evaluation: Evaluation, instance: BasePlacement): string {
    const netValue = (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
    if (evaluation.grossValue === netValue) {
      return '';
    }
    return `<button type="button" class="tax-help-btn" data-id="${instance.id}" title="${I18n.t('taxExplanation.title')}" style="background: none; border: none; color: var(--text-muted); font-weight: 600; cursor: pointer;">?</button>`;
  }

  _escapeHtml(str: string | null | undefined): string {
    return (str ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as Record<string, string>)[m]);
  }
}
