import { I18n } from '../../core/I18n.js';

export class BasePlacementEditor {
  constructor(container) {
    this.container = container;
    this._onValidityChange = null;
  }

  render(placement = null) {
    this.container.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.institution')}</label>
        <input type="text" name="institution" class="form-control" value="${placement?.institution || ''}" required />
      </div>
    `;
    this._bindEvents();
  }

  _bindEvents() {
    const input = this.container.querySelector('input[name="institution"]');
    input?.addEventListener('input', () => this._notifyValidityChange());
  }

  _notifyValidityChange() {
    if (this._onValidityChange) {
      this._onValidityChange(this.isValid());
    }
  }

  onValidityChange(callback) {
    this._onValidityChange = callback;
  }

  isValid() {
    const input = this.container.querySelector('input[name="institution"]');
    return input ? input.checkValidity() : true;
  }

  getData() {
    const input = this.container.querySelector('input[name="institution"]');
    return { institution: input ? input.value : '' };
  }
}
