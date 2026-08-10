import { I18n } from '../core/I18n.js';

export class PlacementModalView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
  }

  show(placement = null) {
    const isEdit = !!placement;

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${isEdit ? I18n.t('form.editTitle') : I18n.t('form.addTitle')}</h2>
          <form id="asset-form">
            <div class="form-group">
              <label>${I18n.t('form.label')}</label>
              <input type="text" name="label" class="form-control" value="${placement?.label || ''}" required />
            </div>
            <div class="form-group">
              <label>${I18n.t('form.institution')}</label>
              <input type="text" name="institution" class="form-control" value="${placement?.institution || ''}" required />
            </div>
            <div class="form-group">
              <label>${I18n.t('form.typeLabel')}</label>
              <select name="type" class="form-control" id="type-select" ${isEdit ? 'disabled' : ''}>
                <option value="checking_account" ${placement?.type === 'checking_account' ? 'selected' : ''}>${I18n.t('form.types.checking_account')}</option>
                <option value="pea" ${placement?.type === 'pea' ? 'selected' : ''}>${I18n.t('form.types.pea')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${I18n.t('form.currentValue')}</label>
              <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
            </div>

            <div id="pea-extra-fields" style="display: ${placement?.type === 'pea' ? 'block' : 'none'};">
              <div class="form-group">
                <label>${I18n.t('form.totalDeposits')}</label>
                <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${placement?.totalDeposits || 0}" />
              </div>
              <div class="form-group">
                <label>${I18n.t('form.openingDate')}</label>
                <input type="date" name="openingDate" class="form-control" value="${placement?.openingDate || ''}" />
              </div>
            </div>

            <div class="modal-actions">
              ${isEdit ? `<button type="button" id="btn-delete" class="btn-danger">${I18n.t('actions.delete')}</button>` : '<div></div>'}
              <div>
                <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('actions.cancel')}</button>
                <button type="submit" class="btn-primary">${I18n.t('actions.save')}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    this._bindEvents(placement, isEdit);
  }

  _bindEvents(placement, isEdit) {
    const typeSelect = this.container.querySelector('#type-select');
    const peaFields = this.container.querySelector('#pea-extra-fields');

    typeSelect.addEventListener('change', (e) => {
      peaFields.style.display = e.target.value === 'pea' ? 'block' : 'none';
    });

    this.container.querySelector('#btn-cancel').addEventListener('click', () => this.container.innerHTML = '');

    if (isEdit) {
      this.container.querySelector('#btn-delete').addEventListener('click', async () => {
        await this.store.deletePlacement(placement.id);
        this.container.innerHTML = '';
      });
    }

    this.container.querySelector('#asset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        label: formData.get('label'),
        institution: formData.get('institution'),
        type: isEdit ? placement.type : formData.get('type'),
        currentValue: Number(formData.get('currentValue')),
        totalDeposits: Number(formData.get('totalDeposits')),
        openingDate: formData.get('openingDate')
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
