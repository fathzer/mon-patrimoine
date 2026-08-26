import { I18n } from '../core/I18n.js';
import type { BasePlacement } from '../placements/BasePlacement.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';

export type EditorData = Record<string, unknown>;
export type ValidityCallback = (isValid: boolean) => void;

/**
 * Base class for all placement editors.
 *
 * An editor is responsible for rendering the form fields that let the user
 * create or edit a placement, extracting the entered data, reporting validity,
 * and producing the HTML for the tax explanation panel.
 *
 * Lifecycle:
 * 1. The host (PlacementModalView) creates an editor via
 *    `PlacementFactory.getEditorClass(type)`, passing the container element
 *    and an optional AppStore.
 * 2. The host calls `render(placement)` — `null` for a new placement, or the
 *    existing instance when editing. `render` assembles the HTML from three
 *    hooks (`renderBeforeInstitution`, `renderInstitution`,
 *    `renderAfterInstitution`) and then binds events.
 * 3. The host registers a validity callback via `onValidityChange`. The editor
 *    calls `notifyValidityChange` whenever a relevant input changes.
 * 4. The host calls `isValid()` before submit and `getData()` to collect the
 *    form values.
 * 5. The host calls `buildTaxExplanation(placement, fiscalProfile)` to render
 *    the tax explanation panel (usually delegated to TaxExplanation.ts).
 *
 * Design note: `render`, `isValid`, `getData`, and the internal event binding
 * are private template methods. They always execute the base logic (institution
 * field binding, validation, extraction) and delegate to protected hooks for
 * placement-specific behavior. Subclasses override the hooks, not the template
 * methods — this guarantees the base logic is never accidentally skipped.
 */
export abstract class BasePlacementEditor {
  /** DOM element where the editor renders its form. */
  protected container: HTMLElement;
  private onValidityChangeCallback: ValidityCallback | null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.onValidityChangeCallback = null;
  }

  /**
   * Renders the editor form into `container`.
   * Assembles the three section hooks and binds events.
   * Subclasses should not override this; override the hooks
   * (`renderBeforeInstitution`, `renderAfterInstitution`) instead.
   */
  render(placement: BasePlacement | null = null): void {
    this.container.innerHTML = `
      ${this.renderBeforeInstitution(placement)}
      ${this.hasInstitution() ? this.renderInstitution(placement) : ''}
      ${this.renderAfterInstitution(placement)}
    `;
    this.bindEvents();
  }

  /**
   * Hook: renders form fields that should appear before the institution field.
   * Default implementation returns an empty string. Override to add
   * placement-specific fields (e.g. current value, opening date, ...).
   */
  protected renderBeforeInstitution(_placement: BasePlacement | null): string {
    return '';
  }

  /**
   * Hook: returns whether this placement uses an institution field.
   * Default: true. Override to return false for placements that
   * do not have an institution (e.g. real estate).
   */
  protected hasInstitution(): boolean {
    return true;
  }

  /**
   * Renders the institution field (shared by all placements).
   * Only called when {@link hasInstitution} returns true.
   */
  private renderInstitution(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.institution')}</label>
        <input type="text" name="institution" class="form-control" value="${placement?.institution || ''}" required />
      </div>
    `;
  }

  /**
   * Hook: renders form fields that should appear after the institution field.
   * Default implementation returns an empty string. Override to add
   * placement-specific fields (e.g. interest rate, tax-exempt checkbox, ...).
   */
  protected renderAfterInstitution(_placement: BasePlacement | null): string {
    return '';
  }

  /**
   * Binds event listeners to the rendered inputs.
   * Always binds the institution field, then delegates to the
   * {@link bindPlacementEvents} hook for placement-specific bindings.
   * Private: cannot be overridden by subclasses.
   */
  private bindEvents(): void {
    if (this.hasInstitution()) {
      const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
      input?.addEventListener('input', () => this.notifyValidityChange());
    }
    this.bindPlacementEvents();
  }

  /**
   * Hook: binds placement-specific event listeners.
   * Default implementation does nothing. Override to bind additional inputs.
   * No need to call super — the base bindings are always executed.
   */
  protected bindPlacementEvents(): void {
    // Default: no placement-specific bindings.
  }

  /**
   * Notifies the host that the editor validity may have changed.
   * Subclasses should call this after any input that affects validity.
   */
  protected notifyValidityChange(): void {
    if (this.onValidityChangeCallback) {
      this.onValidityChangeCallback(this.isValid());
    }
  }

  /**
   * Registers a callback invoked whenever the editor validity changes.
   * Called by the host (PlacementModalView) to enable/disable the submit button.
   */
  onValidityChange(callback: ValidityCallback): void {
    this.onValidityChangeCallback = callback;
  }

  /**
   * Returns whether the form is valid and can be submitted.
   * Always checks the institution field, then delegates to the
   * {@link isPlacementValid} hook for placement-specific validation.
   * Subclasses should not override this; override
   * {@link isPlacementValid} instead.
   */
  isValid(): boolean {
    const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
    const baseValid = input ? input.checkValidity() : true;
    return baseValid && this.isPlacementValid();
  }

  /**
   * Hook: placement-specific validation.
   * Default implementation returns true. Override to add validation logic
   * for placement-specific fields. No need to call super — the base
   * validation is always executed.
   */
  protected isPlacementValid(): boolean {
    return true;
  }

  /**
   * Extracts the form values as a plain object.
   * Always extracts the institution field, then merges with the
   * {@link collectData} hook for placement-specific fields.
   * Subclasses should not override this; override
   * {@link collectData} instead.
   */
  getData(): EditorData {
    const input = this.container.querySelector<HTMLInputElement>('input[name="institution"]');
    return { institution: input ? input.value : '', ...this.collectData() };
  }

  /**
   * Hook: extracts placement-specific form values.
   * Default implementation returns an empty object. Override to collect
   * placement-specific fields. No need to call super — the base extraction
   * is always executed.
   */
  protected collectData(): EditorData {
    return {};
  }

  /**
   * Builds the HTML content for the tax explanation panel.
   * Called by the host (AssetTableView) when the user opens the tax details
   * for a placement. Implementations typically delegate to TaxExplanation.ts.
   */
  abstract buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string;
}
