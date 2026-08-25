import { I18n } from '../../core/I18n.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';

export type EditorData = Record<string, unknown>;
export type ValidityCallback = (isValid: boolean) => void;

export abstract class BasePlacementEditor {
  container: HTMLElement;
  _onValidityChange: ValidityCallback | null;

  constructor(container: HTMLElement) {
    this.container = container;
    this._onValidityChange = null;
  }

  render(placement: BasePlacement | null = null): void {
    this.container.innerHTML = `
      ${this._renderBeforeInstitution(placement)}
      ${this._renderInstitution(placement)}
      ${this._renderAfterInstitution(placement)}
    `;
    this._bindEvents();
  }

  _renderBeforeInstitution(_placement: BasePlacement | null): string {
    return '';
  }

  _renderInstitution(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.institution')}</label>
        <input type="text" name="institution" class="form-control" value="${placement?.institution || ''}" required />
      </div>
    `;
  }

  _renderAfterInstitution(_placement: BasePlacement | null): string {
    return '';
  }

  _bindEvents(): void {
    const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
    input?.addEventListener('input', () => this._notifyValidityChange());
  }

  _notifyValidityChange(): void {
    if (this._onValidityChange) {
      this._onValidityChange(this.isValid());
    }
  }

  onValidityChange(callback: ValidityCallback): void {
    this._onValidityChange = callback;
  }

  isValid(): boolean {
    const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
    return input ? input.checkValidity() : true;
  }

  getData(): EditorData {
    const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
    return { institution: input ? input.value : '' };
  }

  abstract buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string;
}
