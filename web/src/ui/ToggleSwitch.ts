/**
 * Generates the HTML for a toggle switch (on/off slider).
 *
 * The toggle uses a checkbox input under the hood. The CSS classes
 * (`toggle-switch`, `toggle-switch-label`, `toggle-switch-track`,
 * `toggle-switch-slider`) are defined in `components/toggle-switch.css`
 * and are part of the stable Placement Kit v1 CSS API.
 *
 * Two layouts are supported:
 * - **Single label** (left of the toggle): pass `label`.
 * - **Two labels** (left = off, right = on): pass `labelOff` and `labelOn`.
 *
 * @example
 * // Single label:
 * ToggleSwitch.create({ name: 'filterTotals', label: 'Filtrer', checked: false })
 *
 * // Two labels (PEA / PEA-PME):
 * ToggleSwitch.create({ name: 'peaType', labelOff: 'PEA', labelOn: 'PEA-PME', checked: false })
 */
export interface ToggleSwitchOptions {
  /** Name attribute for the underlying checkbox input. */
  name: string;
  /** id attribute for the input. Defaults to `name`. */
  id?: string;
  /** Initial checked state. */
  checked?: boolean;
  /** Whether the toggle is disabled. */
  disabled?: boolean;
  /** Label shown to the left of the toggle (single-label mode). */
  label?: string;
  /** Label shown to the left of the toggle (two-label mode). */
  labelOff?: string;
  /** Label shown to the right of the toggle (two-label mode). */
  labelOn?: string;
  /** Extra classes for the container element. */
  containerClass?: string;
}

export class ToggleSwitch {
  static create(options: ToggleSwitchOptions): string {
    const {
      name,
      id = name,
      checked = false,
      disabled = false,
      label,
      labelOff,
      labelOn,
      containerClass = ''
    } = options;

    const hasTwoLabels = labelOff !== undefined && labelOn !== undefined;
    const leftLabel = hasTwoLabels ? labelOff! : label;
    const rightLabel = hasTwoLabels ? labelOn! : undefined;

    const leftLabelHtml = leftLabel
      ? `<span class="toggle-switch-label">${leftLabel}</span>`
      : '';
    const rightLabelHtml = rightLabel
      ? `<span class="toggle-switch-label">${rightLabel}</span>`
      : '';

    const extraClass = containerClass ? ` ${containerClass}` : '';
    const disabledAttr = disabled ? ' disabled' : '';

    return `<div class="toggle-switch${extraClass}">
  ${leftLabelHtml}
  <label class="toggle-switch-track">
    <input type="checkbox" name="${name}" id="${id}"${checked ? ' checked' : ''}${disabledAttr}>
    <span class="toggle-switch-slider"></span>
  </label>
  ${rightLabelHtml}
</div>`;
  }

  /**
   * Enables or disables a toggle switch after it has been rendered.
   * Updates the input's `disabled` state and the container's visual style.
   * Does not change the checked state — the caller is responsible for that.
   *
   * @param input The checkbox element inside the toggle (obtained by
   *   `container.querySelector('input[name="..."]')`).
   * @param enabled Whether the toggle should be enabled.
   */
  static setEnabled(input: HTMLInputElement, enabled: boolean): void {
    input.disabled = !enabled;
    const container = input.closest('.toggle-switch') as HTMLElement | null;
    if (container) {
      container.style.opacity = enabled ? '' : '0.6';
      container.style.cursor = enabled ? '' : 'not-allowed';
    }
  }
}
