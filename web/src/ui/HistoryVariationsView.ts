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
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

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

const deltaCls = (v: number) => (v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : '');

const fmtDelta = (v: number, base: number): string =>
  base > 0 ? `${signedCurrency.format(v)}&nbsp;·&nbsp;${signedPercent.format(v / base)}` : '—';

/** Delta cell: nominal figure plus a constant-euro sub-line when given. */
const fmtDeltaCell = (v: number, base: number, cv: number | null, cbase: number | null): string => {
  if (cv === null || cbase === null) return fmtDelta(v, base);
  const constPart = cbase > 0
    ? `${signedCurrency.format(cv)}&nbsp;·&nbsp;${signedPercent.format(cv / cbase)}`
    : '—';
  return `${fmtDelta(v, base)}<br><span class="kpi-const">${constPart} ${esc(I18n.t('history.varConstEuros'))}</span>`;
};

const cagr = (from: number, to: number, years: number): number | null =>
  from > 0 && years > 0.25 ? Math.pow(to / from, 1 / years) - 1 : null;

/**
 * Variation block under the history chart: KPI chips (since start / YTD / last
 * 12 months) plus a per-calendar-year table (nominal and constant-euro deltas,
 * net annualized average since each year). Always computed on the full nominal
 * series; constant-euro figures appear only when an inflation index is loaded.
 */
export class HistoryVariationsView {
  /** Open/closed state survives re-renders and page reloads (UiState). */
  _open = UiState.load().historyVariationsOpen;

  render(container: HTMLElement, points: ChartPoint[], index: InflationIndex | null): void {
    if (points.length < 2) {
      container.innerHTML = '';
      return;
    }
    const first = points[0];
    const last = points.at(-1)!;
    const constPts = index
      ? points.map(p => {
          const f = index.factorFor(p.date);
          return { date: p.date, gross: p.gross * f, net: p.net * f };
        })
      : null;

    const chips = [
      this._chip(I18n.t('history.varSinceStart'), first, last, constPts?.[0] ?? null, constPts?.at(-1) ?? null, true),
      this._periodChip(I18n.t('history.varYtd'), `${Number(last.date.slice(0, 4))}-01-01`, points, constPts, true),
      this._periodChip(I18n.t('history.var1Y'), shiftMonths(last.date, -12), points, constPts)
    ].filter(c => c !== '');

    container.innerHTML = `
      <details class="variations"${this._open ? ' open' : ''}>
        <summary class="variations-summary">${esc(I18n.t('history.variationsTitle'))}</summary>
        <div class="kpi-grid">${chips.join('')}</div>
        ${this._annualTable(points, constPts, first, last)}
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
  _periodChip(label: string, start: string, points: ChartPoint[], constPts: ChartPoint[] | null, withCagr = false): string {
    const a = valueAt(points, start);
    const last = points.at(-1)!;
    if (!a || a.date >= last.date) return '';
    return this._chip(label, a, last, constPts ? valueAt(constPts, start) : null, constPts?.at(-1) ?? null, withCagr);
  }

  _chip(label: string, a: ChartPoint, b: ChartPoint, ca: ChartPoint | null, cb: ChartPoint | null, withCagr: boolean): string {
    const d = b.net - a.net;
    const years = (ts(b.date) - ts(a.date)) / YEAR_MS;
    const parts = [a.net > 0 ? signedPercent.format(d / a.net) : ''];
    const c = withCagr ? cagr(a.net, b.net, years) : null;
    if (c !== null) parts.push(signedPercent.format(c) + I18n.t('history.varPerYear'));
    let constLine = '';
    if (ca && cb) {
      const dc = cb.net - ca.net;
      const cc = withCagr ? cagr(ca.net, cb.net, years) : null;
      const ccPart = cc !== null ? ` · ${signedPercent.format(cc)}${I18n.t('history.varPerYear')}` : '';
      constLine = `<div class="kpi-sub ${deltaCls(dc)}">${esc(I18n.t('history.varConstEuros'))} : ${
        ca.net > 0 ? `${signedCurrency.format(dc)}&nbsp;(${signedPercent.format(dc / ca.net)}${ccPart})` : '—'
      }</div>`;
    }
    return `<div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value ${deltaCls(d)}">${a.net > 0 ? signedCurrency.format(d) : '—'}</div>
      <div class="kpi-sub ${deltaCls(d)}">${parts.join('&nbsp;·&nbsp;')}</div>
      ${constLine}
    </div>`;
  }

  _annualTable(points: ChartPoint[], constPts: ChartPoint[] | null, first: ChartPoint, last: ChartPoint): string {
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
      const dGross = e.gross - base.gross;
      const dNet = e.net - base.net;
      const cb = constPts ? valueAt(constPts, start) ?? constPts[0] : null;
      const ce = constPts ? valueAt(constPts, end) ?? constPts.at(-1)! : null;
      const years = (ts(last.date) - ts(start)) / YEAR_MS;
      const avg = cagr(base.net, last.net, years);
      const avgEur = years > 0.25 ? (last.net - base.net) / years : null;
      let avgCell = '—';
      if (avg !== null && avgEur !== null) {
        let avgTxt = `${signedPercent.format(avg)}${I18n.t('history.varPerYear')}<br>${signedCurrency.format(avgEur)}${I18n.t('history.varPerYear')}`;
        if (constPts) {
          const cc = cagr(valueAt(constPts, start)?.net ?? constPts[0].net, constPts.at(-1)!.net, years);
          if (cc !== null) avgTxt += `<br><span class="kpi-const">${signedPercent.format(cc)}${I18n.t('history.varPerYear')} ${esc(I18n.t('history.varConstEuros'))}</span>`;
        }
        avgCell = `<span class="${deltaCls(last.net - base.net)}">${avgTxt}</span>`;
      }
      const range = I18n.t('history.varRange', {
        from: shortDateFmt.format(ts(start)),
        to: shortDateFmt.format(ts(end))
      });
      rows.push(`<tr title="${esc(range)}"><td>${y}${start > jan1 ? ' *' : ''}</td>
        <td class="${deltaCls(dGross)}">${fmtDeltaCell(dGross, base.gross, ce && cb ? ce.gross - cb.gross : null, cb?.gross ?? null)}</td>
        <td class="${deltaCls(dNet)}">${fmtDeltaCell(dNet, base.net, ce && cb ? ce.net - cb.net : null, cb?.net ?? null)}</td>
        <td>${avgCell}</td></tr>`);
    }
    if (!rows.length) return '';
    const foot = partial ? `<p class="variations-foot">${esc(I18n.t('history.varPartialYear', { date: shortDateFmt.format(ts(first.date)) }))}</p>` : '';
    return `<div class="variations-scroll"><table class="variations-table">
      <thead><tr><th>${esc(I18n.t('history.varYear'))}</th><th>${esc(I18n.t('history.varGross'))}</th>
        <th>${esc(I18n.t('history.varNet'))}</th><th>${esc(I18n.t('history.varAvgSince'))}</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>${foot}`;
  }
}
