import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import type { ChartPoint } from './HistoryChartView.js';
import type { InflationIndex } from '../core/inflation.js';

const signedCurrency = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0, signDisplay: 'always'
});
const signedPercent = new Intl.NumberFormat('fr-FR', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero'
});
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const ts = (d: string) => Date.parse(d + 'T00:00:00Z');
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

const shiftMonths = (iso: string, months: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
};

/** Value in force at `date` (step semantics): last point <= date, or null. */
const valueAt = (points: ChartPoint[], date: string): ChartPoint | null => {
  let i = -1;
  for (let j = 0; j < points.length && points[j].date <= date; j++) i = j;
  return i >= 0 ? points[i] : null;
};

const deltaCls = (v: number): string => {
  if (v > 0) return 'delta-pos';
  if (v < 0) return 'delta-neg';
  return '';
};

/** One series line: amount in the series color, percent in the delta color. */
const varLine = (v: number, base: number, kind: 'gross' | 'net'): string => {
  if (base <= 0) return `<div class="var-line"><span class="val-${kind}">—</span></div>`;
  return `<div class="var-line"><span class="val-${kind}">${signedCurrency.format(v)}</span>` +
    `&nbsp;<span class="${deltaCls(v)}">${signedPercent.format(v / base)}</span></div>`;
};

const cagr = (from: number, to: number, years: number): number | null =>
  from > 0 && years > 0.25 ? Math.pow(to / from, 1 / years) - 1 : null;

const grossNetHint = (): string =>
  `<span class="var-hint"><span class="val-gross">${esc(I18n.t('history.varGross'))}</span>` +
  ` / <span class="val-net">${esc(I18n.t('history.varNet'))}</span></span>`;

/**
 * Variation block under the history chart: KPI chips (since start / YTD / last
 * 12 months) plus a per-calendar-year table. Every figure comes as a gross/net
 * pair — gross keeps the default text color, net uses --color-net — while
 * green/red percentages carry the delta sign. When an inflation index is
 * loaded, the whole block switches to constant euros (noted in the title).
 */
export class HistoryVariationsView {
  /** Open/closed state survives re-renders and page reloads (UiState). */
  _open = UiState.load().historyVariationsOpen;

  render(container: HTMLElement, points: ChartPoint[], index: InflationIndex | null): void {
    if (points.length < 2) {
      container.innerHTML = '';
      return;
    }
    const series = index
      ? points.map(p => {
          const f = index.factorFor(p.date);
          return { date: p.date, gross: p.gross * f, net: p.net * f };
        })
      : points;
    const first = series[0];
    const last = series.at(-1)!;

    const chips = [
      this._chip(I18n.t('history.varSinceStart'), first, last, true),
      this._periodChip(I18n.t('history.varYtd'), `${Number(last.date.slice(0, 4))}-01-01`, series, true),
      this._periodChip(I18n.t('history.var1Y'), shiftMonths(last.date, -12), series)
    ].filter(c => c !== '');

    const constNote = index
      ? `<span class="variations-const-note"> — ${esc(I18n.t('history.varConstEuros'))}</span>`
      : '';
    container.innerHTML = `
      <details class="variations"${this._open ? ' open' : ''}>
        <summary class="variations-summary">${esc(I18n.t('history.variationsTitle'))}
          (${grossNetHint()})${constNote}</summary>
        <div class="kpi-grid">${chips.join('')}</div>
        ${this._annualTable(series, first, last)}
      </details>`;
    const details = container.querySelector<HTMLDetailsElement>('.variations');
    details?.addEventListener('toggle', () => {
      this._open = details.open;
      UiState.save({ historyVariationsOpen: details.open });
    });
  }

  /**
   * Chip for a fixed start date; skipped when no point covers the start.
   * `withCagr` annualizes the delta (YTD — meaningless under ~3 months,
   * guarded by the cagr() floor).
   */
  _periodChip(label: string, start: string, points: ChartPoint[], withCagr = false): string {
    const a = valueAt(points, start);
    const last = points.at(-1)!;
    if (!a || a.date >= last.date) return '';
    return this._chip(label, a, last, withCagr);
  }

  _chip(label: string, a: ChartPoint, b: ChartPoint, withCagr: boolean): string {
    const years = (ts(b.date) - ts(a.date)) / YEAR_MS;
    const col = (kind: 'gross' | 'net'): string => {
      const av = a[kind];
      const bv = b[kind];
      const d = bv - av;
      const parts: string[] = [];
      if (av > 0) parts.push(signedPercent.format(d / av));
      const c = withCagr ? cagr(av, bv, years) : null;
      if (c !== null) parts.push(signedPercent.format(c) + I18n.t('history.varPerYear'));
      return `<div class="kpi-col">
        <div class="kpi-value val-${kind}">${av > 0 ? signedCurrency.format(d) : '—'}</div>
        <div class="kpi-sub ${deltaCls(d)}">${parts.join('&nbsp;·&nbsp;') || '—'}</div>
      </div>`;
    };
    return `<div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-pair">${col('gross')}${col('net')}</div>
    </div>`;
  }

  _annualTable(points: ChartPoint[], first: ChartPoint, last: ChartPoint): string {
    const firstYear = Number(first.date.slice(0, 4));
    const lastYear = Number(last.date.slice(0, 4));
    const rows: string[] = [];
    let partial = false;
    for (let y = firstYear; y <= lastYear; y++) {
      const jan1 = `${y}-01-01`;
      const start = jan1 < first.date ? first.date : jan1;
      // Year Y runs from Jan-1 Y to Jan-1 Y+1: a record dated exactly on
      // Jan-1 closes the previous year, a record on Jan-2 belongs to the
      // next one. The last year ends at the latest point.
      const end = y === lastYear ? last.date : `${y + 1}-01-01`;
      if (end <= start) continue;
      if (start > jan1) partial = true;
      const base = valueAt(points, start) ?? first;
      const e = valueAt(points, end) ?? last;
      const years = (ts(last.date) - ts(start)) / YEAR_MS;
      const avgCell = (kind: 'gross' | 'net'): string => {
        const avg = cagr(base[kind], last[kind], years);
        const avgEur = years > 0.25 ? (last[kind] - base[kind]) / years : null;
        if (avg === null || avgEur === null) return `<div class="var-line">—</div>`;
        return `<div class="var-line"><span class="val-${kind}">${
          signedCurrency.format(avgEur)}${I18n.t('history.varPerYear')}</span>&nbsp;·&nbsp;<span class="${deltaCls(last[kind] - base[kind])}">${
          signedPercent.format(avg)}${I18n.t('history.varPerYear')}</span></div>`;
      };
      const range = I18n.t('history.varRange', {
        from: shortDateFmt.format(ts(start)),
        to: shortDateFmt.format(ts(end))
      });
      rows.push(`<tr title="${esc(range)}"><td>${y}${start > jan1 ? ' *' : ''}</td>
        <td>${varLine(e.gross - base.gross, base.gross, 'gross')}${varLine(e.net - base.net, base.net, 'net')}</td>
        <td>${avgCell('gross')}${avgCell('net')}</td></tr>`);
    }
    if (!rows.length) return '';
    const foot = partial ? `<p class="variations-foot">${esc(I18n.t('history.varPartialYear', { date: shortDateFmt.format(ts(first.date)) }))}</p>` : '';
    return `<div class="variations-scroll"><table class="variations-table">
      <thead><tr><th>${esc(I18n.t('history.varYear'))}</th>
        <th>${esc(I18n.t('history.varDelta'))}</th>
        <th>${esc(I18n.t('history.varAvgSince'))}</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>${foot}`;
  }
}
