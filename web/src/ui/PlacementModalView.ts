import { I18n } from '../core/I18n.js';
import { todayString } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';
import { PlacementFactory } from '../placements/PlacementFactory.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { ToggleSwitch } from './ToggleSwitch.js';
import type { AppStore } from '../core/AppStore.js';
import type { BasePlacement, PlacementData } from '../placements/BasePlacement.js';
import type { BasePlacementEditor, EditorData } from './BasePlacementEditor.js';

interface TypeOption {
  key: string;
  label: string;
}

export interface PlacementModalOptions {
  /** History-view date (YYYY-MM-DD): the modal shows the state at that date
   *  read-only, with a pencil button switching to dated-field editing. */
  viewDate?: string | null;
  /** Start directly in history edit mode (default: only when the view date
   *  has no resolvable state — a "new point"). */
  editing?: boolean;
}

/** Resolved context for the history mode of {@link PlacementModalView.show}. */
interface HistoryContext {
  /** Instance reconstructed at the view date (nearest known state as prefill). */
  display: BasePlacement;
  editing: boolean;
  isExistingPoint: boolean;
  /** Whether the viewed date holds a recorded entry that can be deleted. */
  deletable: boolean;
  prevDate: string | null;
  nextDate: string | null;
}

export class PlacementModalView {
  container: HTMLElement;
  store: AppStore;
  _editor: BasePlacementEditor | null;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this._editor = null;
  }

  show(placement: BasePlacement | null = null, options: PlacementModalOptions = {}): void {
    const isEdit = !!placement;
    const viewDate = isEdit ? (options.viewDate ?? null) : null;
    const isHistory = isEdit && viewDate != null;
    const history = isHistory ? this._resolveHistoryContext(placement!, viewDate!, options.editing) : null;
    const closeLabel = placement?.closedAt != null
      ? I18n.t('actions.reopenPlacement')
      : I18n.t('actions.closePlacement');
    const typeOptions: TypeOption[] = PlacementFactory.getDefinitions()
      .map(def => ({ key: def.name, label: PlacementFactory.getLabel(def.name) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    const display = history?.display ?? placement;
    const title = this._modalTitle(isHistory, isEdit, viewDate);

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${title}</h2>
          <form id="asset-form" novalidate>
            <div class="form-group">
              <label>${I18n.t('form.typeLabel')}</label>
              <select name="type" class="form-control" id="type-select" ${isEdit ? 'disabled' : ''}>
                ${typeOptions.map(({ key, label }) => `<option value="${key}" ${placement?.type === key ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>${I18n.t('form.label')}</label>
              <input type="text" name="label" class="form-control" value="${placement?.label || ''}" required />
            </div>
            ${history ? this._renderHistoryBar(viewDate!, history) : ''}
            <div id="editor-container"></div>

            <div id="submit-errors" style="color: var(--danger); font-size: 0.8rem; min-height: 1.2rem; margin-bottom: 0.5rem;"></div>

            ${this._renderActions(isEdit, isHistory, history?.editing ?? false, closeLabel)}
          </form>
        </div>
      </div>
    `;

    this._renderEditor(display, isEdit);
    if (history) {
      this._setHistoryFieldsEditable(history.editing, history.display);
    }
    this._bindEvents(placement, isEdit, {
      viewDate,
      historyEditing: history?.editing ?? false,
      prevDate: history?.prevDate ?? null,
      nextDate: history?.nextDate ?? null
    });
    this._updateSubmitState();
  }

  _modalTitle(isHistory: boolean, isEdit: boolean, viewDate: string | null): string {
    if (isHistory) {
      return I18n.t('history.stateAt', { date: I18n.formatDate(viewDate!) });
    }
    return isEdit ? I18n.t('form.editTitle') : I18n.t('form.addTitle');
  }

  /**
   * Resolves the state displayed at `viewDate`. When no state exists there,
   * the nearest known state is used as prefill — a starting point for a
   * "new point" correction.
   */
  _resolveHistoryContext(placement: BasePlacement, viewDate: string, editing?: boolean): HistoryContext {
    const dates = placement.getHistoryDates();
    const prevDate = [...dates].reverse().find(d => d < viewDate) ?? null;
    const nextDate = dates.find(d => d > viewDate) ?? null;
    const resolved = placement.getDataAt(viewDate);
    const prefill = resolved
      ?? placement.getDataAt(prevDate ?? nextDate ?? viewDate)
      ?? placement.toJSON();
    return {
      display: PlacementFactory.create({ ...prefill, asOf: viewDate }),
      editing: editing ?? resolved == null,
      isExistingPoint: dates.includes(viewDate),
      deletable: placement.hasHistoryEntry(viewDate),
      prevDate,
      nextDate
    };
  }

  _renderHistoryBar(viewDate: string, history: HistoryContext): string {
    return `
      <div class="history-date-bar">
        <button type="button" id="hist-prev" class="btn-secondary" title="${I18n.t('history.prevPoint')}" ${history.prevDate ? '' : 'disabled'}>◀</button>
        <input type="date" id="hist-date" class="form-control" value="${viewDate}" />
        <button type="button" id="hist-next" class="btn-secondary" title="${I18n.t('history.nextPoint')}" ${history.nextDate ? '' : 'disabled'}>▶</button>
        <span id="hist-point-meta">${this._renderPointMeta(history)}</span>
      </div>
      <div class="history-locked-note">${I18n.t('history.lockedNote')}</div>`;
  }

  /** Badge + delete button for the current point — swapped in place on navigation. */
  _renderPointMeta(history: HistoryContext): string {
    const badge = history.isExistingPoint
      ? `<span class="history-point-badge existing">${I18n.t('history.existingPoint')}</span>`
      : `<span class="history-point-badge new">${I18n.t('history.newPoint')}</span>`;
    const deleteButton = history.deletable && history.editing ? `
        <button type="button" id="hist-delete" class="btn-danger" title="${I18n.t('history.deletePoint')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>` : '';
    return badge + deleteButton;
  }

  /**
   * In-place navigation in history mode: updates the title, the point meta
   * (badge, delete button), the prev/next availability and the editor —
   * without rebuilding the modal, so the date input keeps its focus.
   */
  _navigateHistory(placement: BasePlacement, viewDate: string, history: { viewDate: string | null; historyEditing: boolean; prevDate: string | null; nextDate: string | null }): void {
    const ctx = this._resolveHistoryContext(placement, viewDate, history.historyEditing);
    history.viewDate = viewDate;
    history.prevDate = ctx.prevDate;
    history.nextDate = ctx.nextDate;

    const title = this.container.querySelector('.modal-content > h2');
    if (title) title.textContent = this._modalTitle(true, true, viewDate);

    const input = this.container.querySelector('#hist-date') as HTMLInputElement | null;
    if (input) input.value = viewDate;

    const prev = this.container.querySelector('#hist-prev') as HTMLButtonElement | null;
    const next = this.container.querySelector('#hist-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = !ctx.prevDate;
    if (next) next.disabled = !ctx.nextDate;

    const meta = this.container.querySelector('#hist-point-meta');
    if (meta) meta.innerHTML = this._renderPointMeta(ctx);

    this._renderEditor(ctx.display, true);
    this._setHistoryFieldsEditable(history.historyEditing, ctx.display);
    this._updateSubmitState();
  }

  _renderActions(isEdit: boolean, isHistory: boolean, historyEditing: boolean, closeLabel: string): string {
    const left = isEdit && !isHistory ? `
      <div class="modal-actions-left">
        <button type="button" id="btn-close" class="btn-warning">${closeLabel}</button>
        <button type="button" id="btn-delete" class="btn-danger">${I18n.t('actions.delete')}</button>
      </div>` : '<div></div>';
    const right = isHistory
      ? this._renderHistoryActions(historyEditing)
      : `<div class="modal-actions-right">
          <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('actions.cancel')}</button>
          <button type="submit" class="btn-primary" id="btn-save" disabled>${I18n.t('actions.save')}</button>
        </div>`;
    const divider = isEdit && !isHistory ? '<hr class="modal-actions-divider">' : '';
    return `<div class="modal-actions">${left}${right}${divider}</div>`;
  }

  _renderHistoryActions(editing: boolean): string {
    return `
      <div class="modal-actions-right" id="history-view-actions" ${editing ? 'style="display: none;"' : ''}>
        <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('form.close')}</button>
        <button type="button" id="btn-edit-history" class="btn-primary" title="${I18n.t('history.editAction')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      </div>
      <div class="modal-actions-right" id="history-edit-actions" ${editing ? '' : 'style="display: none;"'}>
        <button type="button" id="btn-cancel-edit" class="btn-secondary">${I18n.t('actions.cancel')}</button>
        <button type="button" id="btn-save-stay" class="btn-secondary" disabled>${I18n.t('actions.saveStay')}</button>
        <button type="submit" class="btn-primary" id="btn-save" disabled>${I18n.t('actions.save')}</button>
      </div>`;
  }

  /**
   * History mode: enables only the module's evolving (dated) fields —
   * everything else (label, institution, contract fields…) stays disabled
   * since global fields are edited through the current-state form.
   */
  _setHistoryFieldsEditable(editable: boolean, placement: BasePlacement): void {
    const evolving = new Set(Object.keys(placement.getEvolvingValues()));
    this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      '#asset-form input[name], #asset-form select[name], #asset-form textarea[name]'
    ).forEach(el => {
      const enabled = editable && evolving.has(el.name);
      // Toggles need their container styling updated, not just the input.
      if (el instanceof HTMLInputElement && el.closest('.toggle-switch')) {
        ToggleSwitch.setEnabled(el, enabled);
      } else {
        el.disabled = !enabled;
      }
    });
    // Nested-history modules (stock_grant) expose evolving per-line fields
    // through class-based inputs rather than `name` attributes. Only the
    // share counts evolve: line identity fields (dates, price) and row
    // management stay locked in history mode.
    this.container.querySelectorAll<HTMLInputElement>('#asset-form input.attribution-shares')
      .forEach(el => { el.disabled = !(editable && evolving.has('attributions')); });
    this.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      '#asset-form .attribution-date, #asset-form .attribution-acquisition-date, #asset-form .attribution-price, #asset-form .btn-remove-attribution, #asset-form #btn-add-attribution'
    ).forEach(el => { el.disabled = true; });
  }

  _renderEditor(placement: BasePlacement | null, isEdit: boolean): void {
    const editorContainer = this.container.querySelector('#editor-container') as HTMLElement;
    const currentType = isEdit ? placement!.type : ((this.container.querySelector('#type-select') as HTMLSelectElement | null)?.value || 'checking_account') as string;
    const EditorClass = PlacementFactory.getEditorClass(currentType);

    this._editor = new EditorClass(editorContainer, this.store);
    this._editor.render(placement);
    this._editor.onValidityChange(() => this._updateSubmitState());
  }

  _updateSubmitState(): void {
    const form = this.container.querySelector('#asset-form') as HTMLFormElement | null;
    const typeSelect = this.container.querySelector('#type-select') as HTMLSelectElement;
    const labelInput = this.container.querySelector('input[name="label"]') as HTMLInputElement | null;
    const isLabelValid = labelInput ? labelInput.value.trim().length > 0 : false;
    const editorIsValid = this._editor ? this._editor.isValid() : false;
    const isFormValid = form?.checkValidity() && typeSelect.checkValidity() && editorIsValid;
    const isValid = isLabelValid && isFormValid;

    const errors = this._collectValidationErrors(isLabelValid, form, typeSelect, editorIsValid);
    const errorsContainer = this.container.querySelector('#submit-errors');
    if (errorsContainer) {
      errorsContainer.textContent = errors.join(' - ');
    }

    const submitBtn = this.container.querySelector('#btn-save') as HTMLButtonElement | null;
    if (submitBtn) submitBtn.disabled = !isValid;
    const stayBtn = this.container.querySelector('#btn-save-stay') as HTMLButtonElement | null;
    if (stayBtn) stayBtn.disabled = !isValid;
  }

  _collectValidationErrors(isLabelValid: boolean, form: HTMLFormElement | null, _typeSelect: HTMLSelectElement, _editorIsValid: boolean): string[] {
    const errors: string[] = [];
    if (!isLabelValid) {
      errors.push(I18n.t('form.errors.label'));
    }
    if (form) {
      form.querySelectorAll('input, select, textarea').forEach(el => {
        const input = el as HTMLInputElement;
        if (!input.checkValidity()) {
          const key = `form.errors.${input.name}`;
          const message = I18n.t(key) === key ? I18n.t('form.errors.generic') : I18n.t(key);
          errors.push(message);
        }
      });
    }
    return [...new Set(errors)];
  }

  _bindEvents(placement: BasePlacement | null, isEdit: boolean, history: { viewDate: string | null; historyEditing: boolean; prevDate: string | null; nextDate: string | null }): void {
    const typeSelect = this.container.querySelector('#type-select');
    const isHistory = history.viewDate != null;

    typeSelect?.addEventListener('change', () => {
      this._renderEditor(null, false);
      this._updateSubmitState();
    });

    this.container.querySelector('input[name="label"]')?.addEventListener('input', () => this._updateSubmitState());

    this.container.querySelector('#btn-cancel')?.addEventListener('click', () => this.container.innerHTML = '');
    this.container.querySelector('#btn-cancel-edit')?.addEventListener('click', () => this.container.innerHTML = '');

    if (isHistory) {
      // Date navigation: jump to the closest known points or pick any date;
      // the modal updates in place so the date input keeps its focus.
      this.container.querySelector('#hist-prev')?.addEventListener('click', () => {
        if (history.prevDate) this._navigateHistory(placement!, history.prevDate, history);
      });
      this.container.querySelector('#hist-next')?.addEventListener('click', () => {
        if (history.nextDate) this._navigateHistory(placement!, history.nextDate, history);
      });
      this.container.querySelector('#hist-date')?.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        // No min/max attributes: they clamp mid-typing in segmented inputs,
        // which makes the year untypable. Bounds are enforced on commit.
        if (input.value && input.value < EARLIEST_FISCAL_DATE) input.value = EARLIEST_FISCAL_DATE;
        if (input.value && input.value > todayString()) input.value = todayString();
        const newDate = input.value;
        if (newDate && newDate !== history.viewDate) {
          this._navigateHistory(placement!, newDate, history);
        }
      });
      // Enter in the date field must navigate only — implicit form submission
      // would otherwise write a history entry.
      this.container.querySelector('#hist-date')?.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') e.preventDefault();
      });

      // Point deletion — delegated because #hist-delete is recreated on each
      // navigation. After removal the date is no longer a known point: the
      // modal updates in place as a "new point" from the previous state.
      this.container.querySelector('.history-date-bar')?.addEventListener('click', async (e) => {
        if (!(e.target as HTMLElement).closest('#hist-delete')) return;
        const message = I18n.t('history.confirmDeletePoint', { date: I18n.formatDate(history.viewDate!) });
        if (await ConfirmDialog.ask(message, this.container)) {
          this.store.deleteHistoryEntry(placement!.id, history.viewDate!);
          this._navigateHistory(placement!, history.viewDate!, history);
        }
      });

      // The pencil switches from read-only view to dated-field editing.
      this.container.querySelector('#btn-edit-history')?.addEventListener('click', () => {
        history.historyEditing = true;
        (this.container.querySelector('#history-view-actions') as HTMLElement).style.display = 'none';
        (this.container.querySelector('#history-edit-actions') as HTMLElement).style.display = '';
        // In-place refresh: fields unlock, the delete button joins the meta.
        this._navigateHistory(placement!, history.viewDate!, history);
      });

      // "Save without closing" chains dated corrections: the modal re-renders
      // at the same date, which is now an existing point.
      this.container.querySelector('#btn-save-stay')?.addEventListener('click', () => {
        this._savePlacement(placement, isEdit, history.viewDate);
        // updatePlacement replaces the store instance — re-fetch it.
        const fresh = this.store.state.placements.find(p => p.id === placement!.id);
        if (fresh) this.show(fresh, { viewDate: history.viewDate, editing: true });
      });
    }

    if (isEdit && !isHistory) {
      this.container.querySelector('#btn-close')?.addEventListener('click', async () => {
        // Reopening a mistakenly closed placement needs no confirmation.
        if (placement!.closedAt != null) {
          this.store.closePlacement(placement!.id, null);
          this.container.innerHTML = '';
          return;
        }
        const date = await ConfirmDialog.askWithDate(I18n.t('actions.confirmClose'), I18n.t('actions.closePlacement'), this.container);
        if (date != null) {
          this.store.closePlacement(placement!.id, date);
          this.container.innerHTML = '';
        }
      });
      this.container.querySelector('#btn-delete')?.addEventListener('click', async () => {
        const historyCount = placement!.history.length;
        const message = historyCount > 0
          ? I18n.t('actions.confirmDeleteWithHistory', { count: historyCount })
          : I18n.t('actions.confirmDelete');
        if (await ConfirmDialog.ask(message, this.container)) {
          this.store.deletePlacement(placement!.id);
          this.container.innerHTML = '';
        }
      });
    }

    this.container.querySelector('#asset-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      // Read-only history view must never write to the store.
      if (isHistory && !history.historyEditing) return;
      this._savePlacement(placement, isEdit, history.viewDate);
      this.container.innerHTML = '';
    });
  }

  /**
   * Writes the form to the store. History mode saves at the view date: dates
   * before the current asOf go through the retroactive path
   * (insertHistoryEntry), dates at or after it become the new current state.
   */
  _savePlacement(placement: BasePlacement | null, isEdit: boolean, viewDate: string | null): void {
    const type: string = isEdit ? placement!.type : (this.container.querySelector('#type-select') as HTMLSelectElement).value as string;
    const editorData: EditorData = this._editor ? this._editor.getData() : {};
    const data = {
      label: (this.container.querySelector('input[name="label"]') as HTMLInputElement).value,
      type,
      ...editorData,
      ...(viewDate != null ? { asOf: viewDate } : {})
    } as PlacementData;

    if (isEdit) {
      this.store.updatePlacement(placement!.id, data);
    } else {
      this.store.addPlacement(data);
    }
  }
}
