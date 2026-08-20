import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { StockGrantTaxExplanation } from '../../i18n/stockGrantTaxExplanation.js';

export class StockGrantEditor extends BasePlacementEditor {
  _renderAfterInstitution(placement) {
    const attributions = Array.isArray(placement?.attributions) ? placement.attributions : [];

    return `
      <div class="form-group">
        <label>${I18n.t('form.stockName')}</label>
        <input type="text" name="stockName" class="form-control" value="${placement?.stockName || ''}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentPrice')}</label>
        <input type="number" step="0.01" name="currentPrice" class="form-control" value="${placement?.currentPrice || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.attributions')}</label>
        <table class="attributions-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left;">${I18n.t('form.attributionDate')}</th>
              <th style="text-align: left;">${I18n.t('form.numberOfShares')}</th>
              <th style="text-align: left;">${I18n.t('form.acquisitionPrice')}</th>
              <th style="width: 2rem;"></th>
            </tr>
          </thead>
          <tbody id="attributions-list">
            ${attributions.length > 0 ? attributions.map(a => this._renderAttributionRow(a)).join('') : this._renderAttributionRow()}
          </tbody>
        </table>
        <button type="button" id="btn-add-attribution" class="btn-secondary" style="margin-top: 0.5rem;">${I18n.t('form.addAttribution')}</button>
      </div>
    `;
  }

  _renderAttributionRow(attribution = null) {
    return `
      <tr class="attribution-row">
        <td>
          <input type="date" class="attribution-date form-control" value="${attribution?.attributionDate || ''}" required style="width: 100%;" />
        </td>
        <td>
          <input type="number" step="1" min="0" class="attribution-shares form-control" value="${attribution?.numberOfShares || 0}" required style="width: 100%;" />
        </td>
        <td>
          <input type="number" step="0.01" class="attribution-price form-control" value="${attribution?.acquisitionPrice || 0}" style="width: 100%;" />
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-remove-attribution btn-danger" style="padding: 0.25rem 0.5rem;">&times;</button>
        </td>
      </tr>
    `;
  }

  _bindEvents() {
    super._bindEvents();
    ['stockName', 'currentPrice'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });

    const addBtn = this.container.querySelector('#btn-add-attribution');
    addBtn?.addEventListener('click', () => this._onAddAttribution());

    const list = this.container.querySelector('#attributions-list');
    list?.addEventListener('input', () => this._notifyValidityChange());
    list?.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-attribution')) {
        e.target.closest('.attribution-row').remove();
        this._notifyValidityChange();
      }
    });
  }

  _onAddAttribution() {
    const list = this.container.querySelector('#attributions-list');
    const wrapper = document.createElement('tbody');
    wrapper.innerHTML = this._renderAttributionRow();
    list.appendChild(wrapper.firstElementChild);
    this._notifyValidityChange();
  }

  isValid() {
    if (!super.isValid()) return false;
    const currentPrice = this.container.querySelector('input[name="currentPrice"]');
    const currentPriceValid = currentPrice ? currentPrice.checkValidity() : true;
    const rows = this.container.querySelectorAll('.attribution-row');
    const rowsValid = Array.from(rows).every(row => {
      const date = row.querySelector('.attribution-date');
      const shares = row.querySelector('.attribution-shares');
      const dateValid = date ? date.checkValidity() : true;
      const sharesValid = shares ? shares.checkValidity() : true;
      return dateValid && sharesValid;
    });
    return currentPriceValid && rowsValid;
  }

  getData() {
    const attributions = Array.from(this.container.querySelectorAll('.attribution-row')).map(row => ({
      attributionDate: row.querySelector('.attribution-date')?.value || '',
      acquisitionPrice: Number(row.querySelector('.attribution-price')?.value) || 0,
      numberOfShares: Number(row.querySelector('.attribution-shares')?.value) || 0
    }));

    return {
      ...super.getData(),
      stockName: this.container.querySelector('input[name="stockName"]')?.value || '',
      currentPrice: Number(this.container.querySelector('input[name="currentPrice"]')?.value) || 0,
      attributions
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return StockGrantTaxExplanation.get(placement, fiscalProfile);
  }
}
