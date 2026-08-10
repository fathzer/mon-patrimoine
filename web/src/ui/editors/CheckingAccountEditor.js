import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';

export class CheckingAccountEditor extends BasePlacementEditor {
  render(placement = null) {
    super.render(placement);
    const field = document.createElement('div');
    field.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.cardBalance')}</label>
        <input type="number" step="0.01" name="cardBalance" class="form-control" value="${placement?.cardBalance || 0}" />
      </div>
    `;
    this.container.appendChild(field);
    this._bindSpecificEvents();
  }

  _bindSpecificEvents() {
    ['currentValue', 'cardBalance'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  isValid() {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  getData() {
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      cardBalance: Number(this.container.querySelector('input[name="cardBalance"]')?.value) || 0
    };
  }
}
