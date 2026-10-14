import { I18n } from '../core/I18n.js';
import { todayString } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';
import { bindDatedInput } from './datedInput.js';
import { PlacementFactory } from '../placements/PlacementFactory.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { ToggleSwitch } from './ToggleSwitch.js';
import { LOCK_ICON, UNLOCK_ICON, TRASH_ICON } from './icons.js';
import type { AppStore } from '../core/AppStore.js';
import type { BasePlacement, PlacementData } from '../placements/BasePlacement.js';
import type { BasePlacementEditor, EditorData } from './BasePlacementEditor.js';

interface TypeOption {
  key: string;
  label: string;
}

export interface PlacementModalOptions {
  /** Date shown in the date bar at opening (YYYY-MM-DD). Defaults to today:
   *  the resolved current state, the latest known point being asOf. */
  viewDate?: string | null;
  /** Open a retro date already unlocked ("save without closing" chaining). */
  editing?: boolean;
  /** Keep pending global-field edits ("save without closing" reopens the
   *  same placement: a retro save never wrote its global fields). */
  preserveGlobals?: boolean;
}

/** Resolved context for the date displayed by {@link PlacementModalView.show}. */
interface DateContext {
  /** Date currently shown in the date bar. */
  viewDate: string;
  /** Instance reconstructed at the view date (nearest known state as prefill). */
  display: BasePlacement;
  /** A state is recorded after the view date: saving there is a retro write,
   *  restricted to evolving fields and gated behind the lock. */
  isRetro: boolean;
  /** The past-point lock released by the user (retro dates open locked). */
  unlocked: boolean;
  /** The view date is the placement's own asOf — its live current state. */
  isCurrentPoint: boolean;
  /** A state is recorded at the view date (current state or history entry). */
  isExistingPoint: boolean;
  /** The view date holds a deletable history entry (asOf is untouchable). */
  deletable: boolean;
  prevDate: string | null;
  nextDate: string | null;
}

export class PlacementModalView {
  container: HTMLElement;
  store: AppStore;
  _editor: BasePlacementEditor | null;
  _ctx: DateContext | null = null;
  /** The live placement — `ctx.display` is only its dated reconstruction. */
  _placement: BasePlacement | null = null;
  /**
   * Pending edits to global (non-evolving) fields. They are attributes of
   * the placement, not of a point: they survive the form rebuild that
   * date navigation triggers.
   */
  _pendingGlobals = new Map<string, string | boolean>();

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this._editor = null;
  }

  show(placement: BasePlacement | null = null, options: PlacementModalOptions = {}): void {
    this._placement = placement;
    if (!options.preserveGlobals) {
      this._pendingGlobals.clear();
    }
    const viewDate = placement
      ? this._clampViewDate(options.viewDate ?? todayString(), placement.closedAt)
      : null;
    const ctx = placement ? this._resolveDateContext(placement, viewDate!, options.editing ?? false) : null;
    this._ctx = ctx;

    // The date bar lives outside the form: navigation rebuilds only the
    // form, so the date input keeps its focus.
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${I18n.t(placement ? 'form.editTitle' : 'form.addTitle')}</h2>
          ${ctx ? this._renderDateBar(viewDate!, ctx) : ''}
          <form id="asset-form" novalidate></form>
        </div>
      </div>
    `;

    this._renderForm(placement, ctx);
    this._bindShellEvents();
    if (ctx) {
      this._bindBarEvents(placement!);
    }
  }

  /**
   * Resolves the state displayed at `viewDate`. When no state exists there,
   * the nearest known state is used as prefill — a starting point for a
   * "new point" correction.
   */
  _resolveDateContext(placement: BasePlacement, viewDate: string, unlocked = false): DateContext {
    const dates = placement.getHistoryDates();
    const prevDate = [...dates].reverse().find(d => d < viewDate) ?? null;
    const nextDate = dates.find(d => d > viewDate) ?? null;
    const resolved = placement.getDataAt(viewDate);
    const prefill = resolved
      ?? placement.getDataAt(prevDate ?? nextDate ?? viewDate)
      ?? placement.toJSON();
    return {
      viewDate,
      display: PlacementFactory.create({ ...prefill, asOf: viewDate }),
      isRetro: viewDate < placement.asOf,
      unlocked,
      isCurrentPoint: viewDate === placement.asOf,
      isExistingPoint: dates.includes(viewDate),
      // The current point is deletable too: deleting it rolls the
      // placement back to its previous recorded state.
      deletable: placement.hasHistoryEntry(viewDate)
        || (viewDate === placement.asOf && placement.canDeleteCurrentState()),
      prevDate,
      nextDate
    };
  }

  /**
   * Dates past the closure date are unreachable (the placement no longer
   * exists there): view dates clamp to today, or to closedAt when it is
   * already past.
   */
  _clampViewDate(viewDate: string, closedAt: string | null): string {
    const today = todayString();
    const max = closedAt != null && closedAt < today ? closedAt : today;
    return viewDate > max ? max : viewDate;
  }

  /**
   * The closure date currently expressed by the form — the toggle's date
   * when checked, null otherwise. The view-date bound and the past-closure
   * save guard follow this live value rather than the persisted one.
   */
  _effectiveClosedAt(): string | null {
    const { toggle, dateInput } = this._closureControls();
    return toggle?.checked ? (dateInput?.value || null) : null;
  }

  _renderDateBar(viewDate: string, ctx: DateContext): string {
    return `
      <div class="history-date-bar" id="asset-date-bar">
        <button type="button" id="hist-prev" class="btn-secondary" title="${I18n.t('history.prevPoint')}" ${ctx.prevDate ? '' : 'disabled'}>◀</button>
        <input type="date" id="hist-date" class="form-control" value="${viewDate}" />
        <button type="button" id="hist-next" class="btn-secondary" title="${I18n.t('history.nextPoint')}" ${ctx.nextDate ? '' : 'disabled'}>▶</button>
        <span id="hist-point-meta">${this._renderPointMeta(ctx)}</span>
      </div>
      <div class="history-locked-note" ${ctx.isRetro ? '' : 'hidden'}>${I18n.t('history.lockedNote')}</div>`;
  }

  /** Lock icon, point badge and delete button — swapped in place on navigation. */
  _renderPointMeta(ctx: DateContext): string {
    // Past points open locked: the explicit unlock gesture prevents accidental
    // retroactive writes. Nothing to unlock at or after the current state.
    const lockButton = ctx.isRetro ? `
        <button type="button" id="hist-lock" class="btn-secondary" title="${I18n.t(ctx.unlocked ? 'history.lockPoint' : 'history.unlockPoint')}">
          ${ctx.unlocked ? UNLOCK_ICON : LOCK_ICON}
        </button>` : '';
    let badge: string;
    if (ctx.isCurrentPoint) {
      badge = `<span class="history-point-badge current">${I18n.t('history.currentPoint')}</span>`;
    } else if (ctx.isExistingPoint) {
      badge = `<span class="history-point-badge existing">${I18n.t('history.existingPoint')}</span>`;
    } else {
      badge = `<span class="history-point-badge new">${I18n.t('history.newPoint')}</span>`;
    }
    const closedBadge = this._placement?.isClosedAt(ctx.viewDate)
      ? `<span class="history-point-badge existing">${I18n.t('history.closedBadgeDate', { date: I18n.formatDate(this._placement.closedAt!) })}</span>`
      : '';
    // Retro points stay behind the lock; the current point is directly
    // deletable since it is never locked.
    const deleteButton = ctx.deletable && (ctx.unlocked || !ctx.isRetro) ? `
        <button type="button" id="hist-delete" class="btn-danger" title="${I18n.t('history.deletePoint')}">${TRASH_ICON}</button>` : '';
    return lockButton + closedBadge + badge + deleteButton;
  }

  _typeOptionsHtml(selected: string | undefined, disabled: boolean): string {
    const typeOptions: TypeOption[] = PlacementFactory.getDefinitions()
      .map(def => ({ key: def.name, label: PlacementFactory.getLabel(def.name) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    return `
      <select name="type" class="form-control" id="type-select" ${disabled ? 'disabled' : ''}>
        ${typeOptions.map(({ key, label }) => `<option value="${key}" ${selected === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select>`;
  }

  /**
   * The closure control is a plain form field, editable only when the save
   * would not be retroactive (a global field, like the label).
   */
  _renderClosure(placement: BasePlacement | null): string {
    const closedAt = placement?.closedAt ?? null;
    return `
      <div class="form-group form-closure">
        ${ToggleSwitch.create({
          name: 'closed',
          id: 'closed-toggle',
          label: I18n.t('form.closed'),
          checked: closedAt != null
        })}
        <input type="date" name="closedAt" id="closed-at-input" class="form-control" value="${closedAt ?? todayString()}" ${closedAt == null ? 'hidden' : 'required'} />
      </div>`;
  }

  _renderActions(ctx: DateContext | null): string {
    const locked = ctx != null && ctx.isRetro && !ctx.unlocked;
    const retro = ctx?.isRetro ?? false;
    // Placement deletion is only offered on the live state — deleting while
    // viewing a past date is confusing.
    const left = ctx != null && !locked && !retro ? `<div class="modal-actions-left">
        <button type="button" id="btn-delete" class="btn-danger">${I18n.t('actions.delete')}</button>
      </div>` : '<div></div>';
    const saveStay = retro && !locked ? `<button type="button" id="btn-save-stay" class="btn-secondary" disabled>${I18n.t('actions.saveStay')}</button>` : '';
    const right = locked
      ? `<button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('form.close')}</button>`
      : `<button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('actions.cancel')}</button>
        ${saveStay}
        <button type="submit" class="btn-primary" id="btn-save" disabled>${I18n.t('actions.save')}</button>`;
    return `<div class="modal-actions">${left}<div class="modal-actions-right">${right}
      </div>${ctx != null && !retro ? '<hr class="modal-actions-divider">' : ''}</div>`;
  }

  _renderForm(placement: BasePlacement | null, ctx: DateContext | null): void {
    const form = this.container.querySelector('#asset-form') as HTMLFormElement;
    const display = ctx?.display ?? placement;
    // Global fields are placement-scoped, not point-scoped: pending edits
    // made on enabled fields survive the rebuild below (date navigation,
    // lock toggle).
    const evolving = new Set(Object.keys(this._placement?.getEvolvingValues() ?? {}));
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]')
      .forEach(el => {
        if (!el.disabled && !evolving.has(el.name)) {
          this._pendingGlobals.set(el.name,
            el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value);
        }
      });
    form.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.typeLabel')}</label>
        ${this._typeOptionsHtml(display?.type, placement != null)}
      </div>
      <div class="form-group">
        <label>${I18n.t('form.label')}</label>
        <input type="text" name="label" class="form-control" value="${display?.label || ''}" required />
      </div>
      <div id="editor-container"></div>
      ${this._renderClosure(placement)}
      <div id="submit-errors" style="color: var(--danger); font-size: 0.8rem; min-height: 1.2rem; margin-bottom: 0.5rem;"></div>
      ${this._renderActions(ctx)}
    `;
    this._renderEditor(display);
    // A retro date keeps global fields (type, label, closure…) locked even
    // once unlocked — only evolving fields open up.
    if (ctx?.isRetro) {
      this._setHistoryFieldsEditable(ctx.unlocked, ctx.display);
    }
    for (const [name, value] of this._pendingGlobals) {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (!el || el.disabled) continue;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = value as boolean;
      } else {
        el.value = value as string;
      }
    }
    this._syncClosureField();
    this._bindFormEvents(placement, ctx);
    this._updateSubmitState();
  }

  /**
   * Retro mode: enables only the module's evolving (dated) fields —
   * everything else (label, institution, contract fields…) stays disabled
   * since global fields are edited at the current state.
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
    // management stay locked in retro mode.
    this.container.querySelectorAll<HTMLInputElement>('#asset-form input.attribution-shares')
      .forEach(el => { el.disabled = !(editable && evolving.has('attributions')); });
    this.container.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      '#asset-form .attribution-date, #asset-form .attribution-acquisition-date, #asset-form .attribution-price, #asset-form .btn-remove-attribution, #asset-form #btn-add-attribution'
    ).forEach(el => { el.disabled = true; });
  }

  _renderEditor(placement: BasePlacement | null): void {
    const editorContainer = this.container.querySelector('#editor-container') as HTMLElement;
    // Edit mode follows the placement's type; creation follows the select.
    const currentType = placement?.type
      ?? ((this.container.querySelector('#type-select') as HTMLSelectElement | null)?.value || 'checking_account');
    const EditorClass = PlacementFactory.getEditorClass(currentType);

    this._editor = new EditorClass(editorContainer, this.store);
    this._editor.render(placement);
    this._editor.onValidityChange(() => this._updateSubmitState());
  }

  /** Shell-level bindings: overlay close only (bound once — the bar persists). */
  _bindShellEvents(): void {
    const overlay = this.container.querySelector('.modal-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this.container.innerHTML = '';
    });
  }

  /**
   * Date bar bindings: navigation, unlock and point deletion. The bar lives
   * outside the form and is never rebuilt, so listeners bind once.
   */
  _bindBarEvents(placement: BasePlacement): void {
    const bar = this.container.querySelector('#asset-date-bar') as HTMLElement;

    bar.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const current = this._ctx!;
      if (target.closest('#hist-prev') && current.prevDate) {
        this._navigateTo(placement, current.prevDate);
      } else if (target.closest('#hist-next') && current.nextDate) {
        this._navigateTo(placement, current.nextDate);
      } else if (target.closest('#hist-lock')) {
        current.unlocked = !current.unlocked;
        this._renderMeta(current);
        this._renderForm(placement, current);
      } else if (target.closest('#hist-delete')) {
        const message = I18n.t('history.confirmDeletePoint', { date: I18n.formatDate(current.viewDate) });
        if (await ConfirmDialog.ask(message, this.container)) {
          this.store.deleteStateAt(placement.id, current.viewDate);
          // Deleting the current point rolls back asOf: land on the new
          // current state rather than a now-void date.
          this._navigateTo(placement, current.viewDate > placement.asOf ? placement.asOf : current.viewDate);
        }
      }
    });

    const dateInput = bar.querySelector('#hist-date') as HTMLInputElement;
    bindDatedInput(dateInput, EARLIEST_FISCAL_DATE, todayString, (newDate) => {
      if (newDate && newDate !== this._ctx!.viewDate) {
        this._navigateTo(placement, newDate);
      }
    });
  }

  /** Swaps the lock/badge/delete meta in place (navigation, lock toggle). */
  _renderMeta(ctx: DateContext): void {
    const meta = this.container.querySelector('#hist-point-meta');
    if (meta) meta.innerHTML = this._renderPointMeta(ctx);
    const note = this.container.querySelector('.history-locked-note') as HTMLElement | null;
    if (note) note.hidden = !ctx.isRetro;
  }

  /**
   * In-place date navigation: updates the bar state and rebuilds the form —
   * the bar itself is static, so the date input keeps its focus.
   */
  _navigateTo(placement: BasePlacement, viewDate: string): void {
    const ctx = this._resolveDateContext(placement, viewDate, false);
    this._ctx = ctx;
    const input = this.container.querySelector('#hist-date') as HTMLInputElement | null;
    if (input) input.value = viewDate;
    const prev = this.container.querySelector('#hist-prev') as HTMLButtonElement | null;
    const next = this.container.querySelector('#hist-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = !ctx.prevDate;
    if (next) next.disabled = !ctx.nextDate;
    this._renderMeta(ctx);
    this._renderForm(placement, ctx);
  }

  /** The closure toggle and its date input — both are plain named fields. */
  _closureControls(): { toggle: HTMLInputElement | null; dateInput: HTMLInputElement | null } {
    return {
      toggle: this.container.querySelector('#closed-toggle'),
      dateInput: this.container.querySelector('#closed-at-input')
    };
  }

  /** Keeps the closure date's visibility and requirement in sync with the toggle. */
  _syncClosureField(): void {
    const { toggle, dateInput } = this._closureControls();
    if (toggle && dateInput) {
      dateInput.hidden = !toggle.checked;
      dateInput.required = toggle.checked;
    }
  }

  _bindFormEvents(placement: BasePlacement | null, ctx: DateContext | null): void {
    const form = this.container.querySelector('#asset-form') as HTMLFormElement;

    form.querySelector('#type-select')?.addEventListener('change', () => {
      this._renderEditor(null);
      this._updateSubmitState();
    });

    form.querySelector('input[name="label"]')?.addEventListener('input', () => this._updateSubmitState());
    form.querySelector('#btn-cancel')?.addEventListener('click', () => this.container.innerHTML = '');

    // The closure date field appears only while the toggle is on; toggling
    // on with an empty date defaults it to today.
    const { toggle: closedToggle, dateInput: closedAtInput } = this._closureControls();
    closedToggle?.addEventListener('change', () => {
      this._syncClosureField();
      if (closedToggle.checked && closedAtInput && !closedAtInput.value) {
        closedAtInput.value = todayString();
      }
      this._updateSubmitState();
    });
    // The past-closure save guard follows the form's closure date —
    // re-validate whenever it changes.
    closedAtInput?.addEventListener('input', () => this._updateSubmitState());

    if (placement != null && ctx != null && !ctx.isRetro) {
      form.querySelector('#btn-delete')?.addEventListener('click', async () => {
        const historyCount = placement.history.length;
        const message = historyCount > 0
          ? I18n.t('actions.confirmDeleteWithHistory', { count: historyCount })
          : I18n.t('actions.confirmDelete');
        if (await ConfirmDialog.ask(message, this.container)) {
          this.store.deletePlacement(placement.id);
          this.container.innerHTML = '';
        }
      });
    }

    // "Save without closing" chains retro corrections: the modal re-renders
    // at the same date, which is now an existing point — still unlocked.
    if (placement != null && ctx?.isRetro && ctx.unlocked) {
      form.querySelector('#btn-save-stay')?.addEventListener('click', () => {
        this._savePlacement(placement, ctx);
        // updatePlacement replaces the store instance — re-fetch it.
        const fresh = this.store.state.placements.find(p => p.id === placement.id);
        if (fresh) this.show(fresh, { viewDate: ctx.viewDate, editing: true, preserveGlobals: true });
      });
    }

    // The <form> element outlives its content (only its innerHTML is rebuilt
    // on date navigation): assigning onsubmit replaces the previous handler —
    // addEventListener would stack one handler per visited date, each writing
    // at its own captured date.
    form.onsubmit = (e) => {
      e.preventDefault();
      // A locked retro view must never write to the store.
      if (ctx != null && ctx.isRetro && !ctx.unlocked) return;
      // Implicit submission (Enter) bypasses the disabled save button —
      // re-validate before writing.
      this._updateSubmitState();
      const submitBtn = form.querySelector('#btn-save') as HTMLButtonElement | null;
      if (submitBtn?.disabled) return;
      this._savePlacement(placement, ctx);
      this.container.innerHTML = '';
    };
  }

  _updateSubmitState(): void {
    const form = this.container.querySelector('#asset-form') as HTMLFormElement | null;
    const labelInput = form?.querySelector('input[name="label"]') as HTMLInputElement | null;
    // `required` only rejects an empty label — trim() also rejects whitespace.
    const isLabelValid = !!labelInput?.value.trim();
    const editorIsValid = this._editor ? this._editor.isValid() : false;
    // form.checkValidity() covers every named control, type select included.
    const isFormValid = (form?.checkValidity() ?? false) && editorIsValid;
    // The closure date must be filled while the toggle is on.
    const { toggle, dateInput } = this._closureControls();
    const closureValid = !toggle?.checked || !!dateInput?.value;
    // A view date past the closure resolves to no state — nothing to
    // save. The bound follows the form's closure date, not the stored
    // one: moving the closure earlier blocks a save that would land the
    // current state after it.
    const effectiveClosedAt = this._effectiveClosedAt();
    const pastClosure = this._ctx != null
      && effectiveClosedAt != null
      && this._ctx.viewDate > effectiveClosedAt;
    const isValid = isLabelValid && isFormValid && closureValid && !pastClosure;

    const errors = this._collectValidationErrors(isLabelValid, form);
    if (!closureValid) {
      errors.push(I18n.t('form.errors.closedAt'));
    }
    if (pastClosure) {
      errors.push(I18n.t('form.errors.afterClosure'));
    }
    const errorsContainer = this.container.querySelector('#submit-errors');
    if (errorsContainer) {
      errorsContainer.textContent = errors.join(' - ');
    }

    const submitBtn = this.container.querySelector('#btn-save') as HTMLButtonElement | null;
    if (submitBtn) submitBtn.disabled = !isValid;
    const stayBtn = this.container.querySelector('#btn-save-stay') as HTMLButtonElement | null;
    if (stayBtn) stayBtn.disabled = !isValid;
  }

  _collectValidationErrors(isLabelValid: boolean, form: HTMLFormElement | null): string[] {
    const errors: string[] = [];
    if (!isLabelValid) {
      errors.push(I18n.t('form.errors.label'));
    }
    if (form) {
      form.querySelectorAll('input, select, textarea').forEach(el => {
        const input = el as HTMLInputElement;
        if (!input.checkValidity()) {
          const key = `form.errors.${input.name}`;
          errors.push(I18n.t(key) === key ? I18n.t('form.errors.generic') : I18n.t(key));
        }
      });
    }
    return [...new Set(errors)];
  }

  /**
   * Writes the form to the store. The save happens at the bar's view date:
   * dates before the current asOf go through the retroactive path
   * (insertHistoryEntry), dates at or after it become the new current state.
   * `closedAt` is a global field and is never sent by a retro save — the
   * store keeps the previous value.
   */
  _savePlacement(placement: BasePlacement | null, ctx: DateContext | null): void {
    const form = this.container.querySelector('#asset-form') as HTMLFormElement;
    const type: string = placement?.type ?? (form.querySelector('#type-select') as HTMLSelectElement).value;
    const editorData: EditorData = this._editor ? this._editor.getData() : {};
    const { toggle, dateInput } = this._closureControls();
    const data = {
      label: (form.querySelector('input[name="label"]') as HTMLInputElement).value,
      type,
      ...editorData,
      ...(ctx != null ? { asOf: ctx.viewDate } : {}),
      ...(!ctx?.isRetro ? { closedAt: toggle?.checked ? (dateInput?.value || todayString()) : null } : {})
    } as PlacementData;

    if (placement) {
      this.store.updatePlacement(placement.id, data);
    } else {
      this.store.addPlacement(data);
    }
  }
}
