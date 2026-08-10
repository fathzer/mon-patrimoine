import { I18n } from '../core/I18n.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';

export class PlacementModalView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._editor = null;
  }

  show(placement = null) {
    const isEdit = !!placement;

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${isEdit ? I18n.t('form.editTitle') : I18n.t('form.addTitle')}</h2>
          <form id="asset-form" novalidate>
            <div class="form-group">
              <label>${I18n.t('form.typeLabel')}</label>
              <select name="type" class="form-control" id="type-select" ${isEdit ? 'disabled' : ''}>
                <option value="checking_account" ${placement?.type === 'checking_account' ? 'selected' : ''}>${I18n.t('form.types.checking_account')}</option>
                <option value="savings_account" ${placement?.type === 'savings_account' ? 'selected' : ''}>${I18n.t('form.types.savings_account')}</option>
                <option value="pea" ${placement?.type === 'pea' ? 'selected' : ''}>${I18n.t('form.types.pea')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${I18n.t('form.label')}</label>
              <input type="text" name="label" class="form-control" value="${placement?.label || ''}" required />
            </div>
            <div id="editor-container"></div>

            <div class="modal-actions">
              ${isEdit ? `<button type="button" id="btn-delete" class="btn-danger">${I18n.t('actions.delete')}</button>` : '<div></div>'}
              <div>
                <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('actions.cancel')}</button>
                <button type="submit" class="btn-primary" id="btn-save" disabled>${I18n.t('actions.save')}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    this._renderEditor(placement, isEdit);
    this._bindEvents(placement, isEdit);
    this._updateSubmitState();
  }

  _renderEditor(placement, isEdit) {
    const editorContainer = this.container.querySelector('#editor-container');
    const currentType = isEdit ? placement.type : this.container.querySelector('#type-select')?.value || 'checking_account';
    const EditorClass = PlacementFactory.getEditorClass(currentType);

    this._editor = new EditorClass(editorContainer);
    this._editor.render(placement);
    this._editor.onValidityChange(() => this._updateSubmitState());
  }

  _updateSubmitState() {
    const form = this.container.querySelector('#asset-form');
    const typeSelect = this.container.querySelector('#type-select');

    const isValid = form?.checkValidity() && typeSelect.checkValidity() && this._editor?.isValid();
    const submitBtn = this.container.querySelector('#btn-save');
    if (submitBtn) submitBtn.disabled = !isValid;
  }

  _bindEvents(placement, isEdit) {
    const typeSelect = this.container.querySelector('#type-select');

    typeSelect?.addEventListener('change', () => {
      this._renderEditor(null, false);
      this._updateSubmitState();
    });

    this.container.querySelector('input[name="label"]')?.addEventListener('input', () => this._updateSubmitState());

    this.container.querySelector('#btn-cancel')?.addEventListener('click', () => this.container.innerHTML = '');

    if (isEdit) {
      this.container.querySelector('#btn-delete')?.addEventListener('click', async () => {
        await this.store.deletePlacement(placement.id);
        this.container.innerHTML = '';
      });
    }

    this.container.querySelector('#asset-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = isEdit ? placement.type : this.container.querySelector('#type-select').value;
      const editorData = this._editor ? this._editor.getData() : {};
      const data = {
        label: this.container.querySelector('input[name="label"]').value,
        type,
        ...editorData
      };

      if (isEdit) {
        await this.store.updatePlacement(placement.id, data);
      } else {
        await this.store.addPlacement(data);
      }
      this.container.innerHTML = '';
    });
  }
}
