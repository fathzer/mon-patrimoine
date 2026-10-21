/**
 * Shared commit semantics for `type="date"` inputs bounded to
 * [minDate, maxDate].
 *
 * No min/max attributes are set: they clamp mid-typing in segmented
 * inputs, which makes the year untypable. `change` is equally unreliable
 * there — it fires for every intermediate year while typing (typing "2"
 * yields year 0002) — so below-minimum `change` values are treated as
 * mid-edit and ignored; they never reach a commit. `blur` and Enter
 * always commit. `onCommit` receives the clamped value, `''` when the
 * field is empty.
 *
 * `maxDate` may be a getter so "today" resolves at commit time rather
 * than at bind time.
 */
export function bindDatedInput(
  input: HTMLInputElement,
  minDate: string,
  maxDate: string | (() => string),
  onCommit: (value: string) => void
): void {
  const commit = () => {
    const max = typeof maxDate === 'function' ? maxDate() : maxDate;
    if (input.value && input.value < minDate) input.value = minDate;
    if (input.value && input.value > max) input.value = max;
    onCommit(input.value);
  };
  input.addEventListener('change', () => {
    if (input.value && input.value < minDate) return;
    commit();
  });
  input.addEventListener('blur', commit);
  // Enter is always a commit; preventDefault also protects callers whose
  // input might sit inside a <form> (implicit submission).
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  });
  // Touch devices get no virtual keyboard for date fields: the native
  // picker is the only editing affordance, so a tap anywhere on the
  // field opens it — the small calendar icon is not the only way in.
  input.addEventListener('click', () => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try {
      input.showPicker();
    } catch {
      // NotAllowedError when the call lacks transient activation — ignore.
    }
  });
}
