import { I18n } from '../core/I18n.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import type { AppStore } from '../core/AppStore.js';
import type { BasePlacement, PlacementData, PlacementType } from '../modules/BasePlacement.js';
import type { BasePlacementEditor, EditorData } from './editors/BasePlacementEditor.js';

interface TypeOption {
  key: string;
  label: string;
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

  show(placement: BasePlacement | null = null): void {
    const isEdit = !!placement;
    const typeOptions: TypeOption[] = [
      { key: 'checking_account', label: I18n.t('form.types.checking_account') },
      { key: 'savings_account', label: I18n.t('form.types.savings_account') },
      { key: 'home_savings', label: I18n.t('form.types.home_savings') },
      { key: 'real_estate', label: I18n.t('form.types.real_estate') },
      { key: 'pea', label: I18n.t('form.types.pea') },
      { key: 'cto', label: I18n.t('form.types.cto') },
      { key: 'life_insurance', label: I18n.t('form.types.life_insurance') },
      { key: 'stock_grant', label: I18n.t('form.types.stock_grant') }
    ].sort((a, b) => a.label.localeCompare(b.label, 'fr'));

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${isEdit ? I18n.t('form.editTitle') : I18n.t('form.addTitle')}</h2>
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
            <div id="editor-container"></div>

            <div id="submit-errors" style="color: var(--danger); font-size: 0.8rem; min-height: 1.2rem; margin-bottom: 0.5rem;"></div>

            <div class="modal-actions">
              ${isEdit ? `<button type="button" id="btn-delete" class="btn-danger">${I18n.t('actions.delete')}</button>` : '<div></div>'}
              <div class="modal-actions-right">
                <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('actions.cancel')}</button>
                <button type="submit" class="btn-primary" id="btn-save" disabled>${I18n.t('actions.save')}</button>
              </div>
              ${isEdit ? '<hr class="modal-actions-divider">' : ''}
            </div>
          </form>
        </div>
      </div>
    `;

    this._renderEditor(placement, isEdit);
    this._bindEvents(placement, isEdit);
    this._updateSubmitState();
  }

  _renderEditor(placement: BasePlacement | null, isEdit: boolean): void {
    const editorContainer = this.container.querySelector('#editor-container') as HTMLElement;
    const currentType = isEdit ? placement!.type : ((this.container.querySelector('#type-select') as HTMLSelectElement | null)?.value || 'checking_account') as PlacementType;
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

  _bindEvents(placement: BasePlacement | null, isEdit: boolean): void {
    const typeSelect = this.container.querySelector('#type-select');

    typeSelect?.addEventListener('change', () => {
      this._renderEditor(null, false);
      this._updateSubmitState();
    });

    this.container.querySelector('input[name="label"]')?.addEventListener('input', () => this._updateSubmitState());

    this.container.querySelector('#btn-cancel')?.addEventListener('click', () => this.container.innerHTML = '');

    if (isEdit) {
      this.container.querySelector('#btn-delete')?.addEventListener('click', async () => {
        if (await ConfirmDialog.ask(I18n.t('actions.confirmDelete'), this.container)) {
          this.store.deletePlacement(placement!.id);
          this.container.innerHTML = '';
        }
      });
    }

    this.container.querySelector('#asset-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const type: PlacementType = isEdit ? placement!.type : (this.container.querySelector('#type-select') as HTMLSelectElement).value as PlacementType;
      const editorData: EditorData = this._editor ? this._editor.getData() : {};
      const data = {
        label: (this.container.querySelector('input[name="label"]') as HTMLInputElement).value,
        type,
        ...editorData
      } as PlacementData;

      if (isEdit) {
        this.store.updatePlacement(placement!.id, data);
      } else {
        this.store.addPlacement(data);
      }
      this.container.innerHTML = '';
    });
  }
}
