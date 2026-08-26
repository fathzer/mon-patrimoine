import { BasePlacementEditor, I18n } from '../../kit/v1/index.js';
import { StockGrantTaxExplanation } from './TaxExplanation.js';
import type { BasePlacement, FiscalProfile } from '../../kit/v1/index.js';
import type { StockGrantModule, StockGrantData } from './module.js';

const labels = {
  stockName: 'Nom de l\'action',
  currentPrice: 'Cours actuel de l\'action (€)',
  attributions: 'Attributions',
  attributionDate: 'Date d\'attribution',
  numberOfShares: 'Nombre d\'actions',
  addAttribution: '+ Ajouter une attribution'
};

export class StockGrantEditor extends BasePlacementEditor {
  override _renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as StockGrantModule | null;
    const attributions = Array.isArray(p?.attributions) ? p!.attributions : [];

    return `
      <div class="form-group">
        <label>${labels.stockName}</label>
        <input type="text" name="stockName" class="form-control" value="${p?.stockName || ''}" />
      </div>
      <div class="form-group">
        <label>${labels.currentPrice}</label>
        <input type="number" step="0.01" name="currentPrice" class="form-control" value="${p?.currentPrice || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.attributions}</label>
        <table class="attributions-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left;">${labels.attributionDate}</th>
              <th style="text-align: left;">${I18n.t('form.acquisitionDate')}</th>
              <th style="text-align: left;">${labels.numberOfShares}</th>
              <th style="text-align: left;">${I18n.t('form.acquisitionPrice')}</th>
              <th style="width: 2rem;"></th>
            </tr>
          </thead>
          <tbody id="attributions-list">
            ${attributions.length > 0 ? attributions.map(a => this._renderAttributionRow(a)).join('') : this._renderAttributionRow()}
          </tbody>
        </table>
        <button type="button" id="btn-add-attribution" class="btn-secondary" style="margin-top: 0.5rem;">${labels.addAttribution}</button>
      </div>
    `;
  }

  _renderAttributionRow(attribution: StockGrantData | null = null): string {
    return `
      <tr class="attribution-row">
        <td>
          <input type="date" class="attribution-date form-control" value="${attribution?.attributionDate || ''}" required style="width: 100%;" />
        </td>
        <td>
          <input type="date" class="attribution-acquisition-date form-control" value="${attribution?.acquisitionDate || ''}" style="width: 100%;" />
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

  override _bindEvents(): void {
    super._bindEvents();
    (['stockName', 'currentPrice'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });

    const addBtn = this.container.querySelector<HTMLElement>('#btn-add-attribution');
    addBtn?.addEventListener('click', () => this._onAddAttribution());

    const list = this.container.querySelector<HTMLElement>('#attributions-list');
    list?.addEventListener('input', () => this._notifyValidityChange());
    list?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-remove-attribution')) {
        (target.closest('.attribution-row') as HTMLElement).remove();
        this._notifyValidityChange();
      }
    });
  }

  _onAddAttribution(): void {
    const list = this.container.querySelector<HTMLElement>('#attributions-list')!;
    const wrapper = document.createElement('tbody');
    wrapper.innerHTML = this._renderAttributionRow();
    list.appendChild(wrapper.firstElementChild as HTMLElement);
    this._notifyValidityChange();
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const currentPrice = this.container.querySelector<HTMLInputElement>('input[name="currentPrice"]');
    const currentPriceValid = currentPrice ? currentPrice.checkValidity() : true;
    const rows = this.container.querySelectorAll<HTMLElement>('.attribution-row');
    const rowsValid = Array.from(rows).every(row => {
      const date = row.querySelector<HTMLInputElement>('.attribution-date');
      const shares = row.querySelector<HTMLInputElement>('.attribution-shares');
      const dateValid = date ? date.checkValidity() : true;
      const sharesValid = shares ? shares.checkValidity() : true;
      return dateValid && sharesValid;
    });
    return currentPriceValid && rowsValid;
  }

  override getData(): Record<string, unknown> {
    const attributions = Array.from(this.container.querySelectorAll<HTMLElement>('.attribution-row')).map(row => ({
      attributionDate: row.querySelector<HTMLInputElement>('.attribution-date')?.value || '',
      acquisitionDate: row.querySelector<HTMLInputElement>('.attribution-acquisition-date')?.value || '',
      acquisitionPrice: Number(row.querySelector<HTMLInputElement>('.attribution-price')?.value) || 0,
      numberOfShares: Number(row.querySelector<HTMLInputElement>('.attribution-shares')?.value) || 0
    }));

    return {
      ...super.getData(),
      stockName: this.container.querySelector<HTMLInputElement>('input[name="stockName"]')?.value || '',
      currentPrice: Number(this.container.querySelector<HTMLInputElement>('input[name="currentPrice"]')?.value) || 0,
      attributions
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return StockGrantTaxExplanation.get(placement as StockGrantModule, fiscalProfile);
  }
}
