import { neighbours } from '../core/DatedHistory.js';

/**
 * ◀ input ▶ navigation bar over a sorted list of items — dates, income
 * years, whatever the caller navigates through. The markup is produced by
 * `navInputBar`, the behaviour wired by `bindNavInput`. Both are agnostic
 * about the item type: the binding parses the raw input value via `parse`
 * and orders items via `compare`.
 *
 * Rendered with the `.history-date-bar` styles (flex row, compact buttons).
 */

export interface NavInputBarOptions {
  prevId: string;
  inputId: string;
  nextId: string;
  /** Any valid input type — 'date' for dates, 'number' for years. */
  inputType: string;
  /** Initial raw input value. */
  value: string | number;
  /** Extra input attributes rendered verbatim (min, max, step, ...). */
  inputAttrs?: string;
  prevTitle: string;
  nextTitle: string;
  /** Leading label — its `for` targets the input. */
  label?: string;
  /** Trailing slot for caller-managed meta (badges, lock/delete buttons):
   *  `metaId` is the span's id, `metaHtml` its initial content. */
  metaId?: string;
  metaHtml?: string;
  /** Bar container id / initial hidden state. */
  barId?: string;
  hidden?: boolean;
}

export function navInputBar(options: NavInputBarOptions): string {
  return `
    <div class="history-date-bar"${options.barId ? ` id="${options.barId}"` : ''}${options.hidden ? ' hidden' : ''}>
      <span class="nav-input-group">
        ${options.label ? `<label for="${options.inputId}">${options.label}</label>` : ''}
        <button type="button" id="${options.prevId}" class="btn-secondary" title="${options.prevTitle}">◀</button>
        <input type="${options.inputType}" id="${options.inputId}" class="form-control"${options.inputAttrs ? ` ${options.inputAttrs}` : ''} value="${options.value}" />
        <button type="button" id="${options.nextId}" class="btn-secondary" title="${options.nextTitle}">▶</button>
      </span>
      ${options.metaId ? `<span id="${options.metaId}">${options.metaHtml ?? ''}</span>` : ''}
    </div>`;
}

export interface NavBindingOptions<T> {
  /** Sorted-ascending items the arrows cycle through — evaluated lazily at
   *  click/refresh time (recorded points may change under the view). */
  getItems: () => T[];
  /** Parses the raw input value into an item; null means empty/invalid. */
  parse: (raw: string) => T | null;
  /** Item ordering — compareDates for ISO dates, (a, b) => a - b for years. */
  compare: (a: T, b: T) => number;
  /** Called with the neighbour the user picked. */
  onNavigate: (item: T) => void;
  /** Item assumed when the input parses to null — defaults to the last
   *  item (lists are expected to end with "today"/the current point). */
  fallback?: () => T | null;
}

/**
 * ◀/▶ wiring for a nav input bar. The buttons' disabled state tracks the
 * input value; returns a refresh() to call after programmatic changes.
 */
export function bindNavInput<T>(
  input: HTMLInputElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
  options: NavBindingOptions<T>
): () => void {
  const neighboursNow = () => {
    const items = options.getItems();
    const current = options.parse(input.value) ?? options.fallback?.() ?? items.at(-1) ?? null;
    if (current == null) return { prev: null, next: null };
    return neighbours(items, current, options.compare);
  };
  const refresh = () => {
    const { prev, next } = neighboursNow();
    prevBtn.disabled = prev == null;
    nextBtn.disabled = next == null;
  };
  prevBtn.addEventListener('click', () => {
    const { prev } = neighboursNow();
    if (prev != null) options.onNavigate(prev);
  });
  nextBtn.addEventListener('click', () => {
    const { next } = neighboursNow();
    if (next != null) options.onNavigate(next);
  });
  refresh();
  return refresh;
}
