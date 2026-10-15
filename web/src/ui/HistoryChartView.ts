import { I18n } from '../core/I18n.js';
import { compareDates } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';

export interface ChartPoint {
  date: string;
  gross: number;
  net: number;
}

interface HistoryChartOptions {
  onPickDate?: (date: string) => void;
}

/** Minimal contract the chart needs from a placement to collect sample dates. */
interface DatedPlacement {
  getHistoryDates(): string[];
}

const CHART_HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 26, left: 56 };
const LONG_PRESS_MS = 400;
/** Safety bound on rendered points — beyond this, samples are stride-picked. */
const MAX_SAMPLES = 2000;

const currencyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const axisFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const yearFmt = new Intl.DateTimeFormat('fr-FR', { year: 'numeric' });
const monthYearFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fullDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const ts = (date: string): number => Date.parse(date);
const dateString = (t: number): string => new Date(t).toISOString().slice(0, 10);

/**
 * Collects the dates at which the chart samples the history: every recorded
 * point of the given placements, plus January 1st of each covered year
 * (fiscal-year changes can move net values between recorded points), plus
 * `today`. Sorted ascending, stride-thinned if beyond MAX_SAMPLES.
 * Dates before EARLIEST_FISCAL_DATE are excluded — the app cannot evaluate
 * taxation before that date; when the history starts earlier, the curve
 * begins at EARLIEST_FISCAL_DATE with the state resolved at that date.
 */
export function collectChartDates(placements: readonly DatedPlacement[], today: string): string[] {
  const set = new Set<string>();
  let hasPreFiscalPoints = false;
  for (const p of placements) {
    for (const d of p.getHistoryDates()) {
      if (d < EARLIEST_FISCAL_DATE) {
        hasPreFiscalPoints = true;
      } else {
        set.add(d);
      }
    }
  }
  if (hasPreFiscalPoints) set.add(EARLIEST_FISCAL_DATE);
  set.add(today);
  let dates = [...set].sort(compareDates);
  if (dates.length > 1) {
    const first = Number(dates[0].slice(0, 4));
    const last = Number(dates.at(-1)!.slice(0, 4));
    for (let y = first + 1; y <= last; y++) {
      const jan1 = `${y}-01-01`;
      if (jan1 > dates[0] && jan1 < dates.at(-1)!) set.add(jan1);
    }
    dates = [...set].sort(compareDates);
  }
  if (dates.length > MAX_SAMPLES) {
    const stride = Math.ceil(dates.length / MAX_SAMPLES);
    dates = dates.filter((_, i) => i % stride === 0);
    if (dates.at(-1) !== today) dates.push(today);
  }
  return dates;
}

/**
 * SVG line chart of the gross and net totals over the full history. Drawn as
 * step curves (a value holds until the next recorded state). Hover shows a
 * dashed cursor and a tooltip with the date and both values; a click picks
 * the date under the cursor into the history date field. On touch screens a
 * long press enters the same exploration mode while dragging.
 */
type ChartPeriod = '6M' | 'YTD' | '1A' | '5A' | '10A' | 'MAX';
const CHART_PERIODS: ChartPeriod[] = ['6M', 'YTD', '1A', '5A', '10A', 'MAX'];

export class HistoryChartView {
  _onPickDate: (date: string) => void;
  _exploring: boolean;
  _suppressClick: boolean;
  _pressTimer: ReturnType<typeof setTimeout> | null;
  /** The currently displayed (period-sliced) points — used for scales/tooltip. */
  _points: ChartPoint[];
  /** The full series, kept to re-slice on period change. */
  _fullPoints: ChartPoint[];
  _selectedDate: string | null;
  _container: HTMLElement | null;
  _lastWidth: number;
  _resizeTimer: ReturnType<typeof setTimeout> | null;
  _period: ChartPeriod;
  _t0: number;
  _t1: number;
  /** Horizontal projection of the last render — reused by the selection marker. */
  _x: (date: string) => number;
  _axisY: number;

  constructor(options: HistoryChartOptions = {}) {
    this._onPickDate = options.onPickDate || (() => {});
    this._exploring = false;
    this._suppressClick = false;
    this._pressTimer = null;
    this._points = [];
    this._fullPoints = [];
    this._selectedDate = null;
    this._container = null;
    this._lastWidth = 0;
    this._resizeTimer = null;
    this._period = 'MAX';
    this._t0 = 0;
    this._t1 = 0;
    this._x = () => 0;
    this._axisY = 0;

    // The SVG is drawn at measured pixels: re-render on resize so text keeps
    // its size instead of being scaled down by the viewBox.
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (this._resizeTimer) clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._rerenderOnResize(), 50);
      });
    }
  }

  _rerenderOnResize(): void {
    const c = this._container;
    if (c && c.isConnected && Math.abs((c.clientWidth || 0) - this._lastWidth) > 4) {
      this.render(c, this._fullPoints, this._selectedDate);
    }
  }

  /**
   * Renders the chart into `container` for the given series. `selectedDate`,
   * when in range, is marked with a vertical line.
   */
  render(container: HTMLElement, points: ChartPoint[], selectedDate: string | null = null): void {
    this._fullPoints = points;
    this._points = this._sliceForPeriod(points);
    this._selectedDate = selectedDate;
    this._container = container;
    this._exploring = false;
    this._suppressClick = false;
    this._clearPressTimer();

    if (this._points.length < 2) {
      container.innerHTML = `<p class="text-muted" style="font-size: 0.85rem;">${I18n.t('history.chartEmpty')}</p>`;
      this._lastWidth = 0;
      return;
    }

    const visible = this._points;
    const width = Math.max(160, container.clientWidth || 640);
    this._lastWidth = width;
    const innerW = width - PAD.left - PAD.right;
    const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
    this._t0 = ts(visible[0].date);
    this._t1 = ts(visible.at(-1)!.date);
    if (this._t0 === this._t1) this._t1 += 86400000;
    const yMax = Math.max(...visible.map(p => Math.max(p.gross, p.net)), 1) * 1.05;

    const x = (date: string): number => PAD.left + ((ts(date) - this._t0) / (this._t1 - this._t0)) * innerW;
    this._x = x;
    this._axisY = PAD.top + innerH;
    const y = (value: number): number => PAD.top + innerH - (value / yMax) * innerH;

    // Step curve: each point reaches the previous ordinate at its abscissa.
    const stepPath = (get: (p: ChartPoint) => number): string => {
      let d = `M ${x(visible[0].date).toFixed(1)} ${y(get(visible[0])).toFixed(1)}`;
      for (let i = 1; i < visible.length; i++) {
        d += ` L ${x(visible[i].date).toFixed(1)} ${y(get(visible[i - 1])).toFixed(1)} L ${x(visible[i].date).toFixed(1)} ${y(get(visible[i])).toFixed(1)}`;
      }
      return d;
    };

    const gridLines = [0.25, 0.5, 0.75, 1].map(r => {
      const gy = (PAD.top + innerH - r * innerH).toFixed(1);
      return `<line x1="${PAD.left}" y1="${gy}" x2="${width - PAD.right}" y2="${gy}" class="chart-grid" />
        <text x="${PAD.left - 6}" y="${gy}" class="chart-axis-label" text-anchor="end" dominant-baseline="middle">${axisFmt.format(r * yMax)}</text>`;
    }).join('');

    // Ticks: the first point, today and January 1st of each covered year —
    // year-only labels; neighbours closer than minTickGap are dropped (the
    // final "today" tick always wins over a crowding January 1st).
    const minTickGap = 44;
    const firstDate = visible[0].date;
    const lastDate = visible.at(-1)!.date;
    const candidates: string[] = [firstDate];
    for (let y = Number(firstDate.slice(0, 4)) + 1; y <= Number(lastDate.slice(0, 4)); y++) {
      candidates.push(`${y}-01-01`);
    }
    candidates.push(lastDate);
    const kept: { d: string; tx: number }[] = [];
    for (const d of [...new Set(candidates)].sort(compareDates)) {
      const tx = x(d);
      const isLast = d === lastDate;
      if (kept.length && tx - kept.at(-1)!.tx < minTickGap) {
        if (!isLast) continue;
        kept.pop();
      }
      kept.push({ d, tx });
    }
    // Edge labels get finer granularity on short ranges — bare "2026" labels
    // (or worse, a duplicated "oct. 2026") are unhelpful there.
    const spanDays = (this._t1 - this._t0) / 86400000;
    const edgeFmt = spanDays < 120 ? dayMonthFmt : spanDays < 548 ? monthYearFmt : yearFmt;
    const xTicks = kept.map(({ d, tx }) => {
      const anchor = d === firstDate ? 'start' : d === lastDate ? 'end' : 'middle';
      const isEdge = d === firstDate || d === lastDate;
      const fmt = isEdge ? edgeFmt : yearFmt;
      return `<text x="${tx.toFixed(1)}" y="${CHART_HEIGHT - 8}" class="chart-axis-label" text-anchor="${anchor}">${fmt.format(ts(d))}</text>`;
    }).join('');

    // Selected view date: a dotted vertical line plus a tick hanging under the
    // x-axis so the position stays visible even where curves overlap the line.
    // Positioned by `_updateSelectedMarker` — also called on date-field changes.
    const selected = `<g class="chart-selected-group" style="display:none">
      <line class="chart-selected" y1="${PAD.top}" y2="${this._axisY}" />
      <polygon class="chart-selected-tick" />
    </g>`;

    // A period button is only useful when data exists before its window
    // start — otherwise the slice would just duplicate Max.
    const fullFirst = this._fullPoints[0].date;
    const fullLast = this._fullPoints.at(-1)!.date;
    const periodButtons = CHART_PERIODS.map(p => {
      const start = p === 'MAX' ? null : this._periodStart(p);
      const disabled = start != null && (start <= fullFirst || start >= fullLast);
      return `<button type="button" class="chart-period${p === this._period ? ' active' : ''}" data-period="${p}"${disabled ? ' disabled' : ''}>${I18n.t(`history.period${p === 'MAX' ? 'Max' : p}`)}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="chart-periods">${periodButtons}</div>
      <div class="chart-wrap">
        <svg class="history-chart" viewBox="0 0 ${width} ${CHART_HEIGHT}" width="100%" height="${CHART_HEIGHT}" role="img" aria-label="${I18n.t('history.chartTitle')}">
          ${gridLines}
          <path d="${stepPath(p => p.gross)}" class="chart-line chart-gross" fill="none" />
          <path d="${stepPath(p => p.net)}" class="chart-line chart-net" fill="none" />
          ${selected}
          <line class="chart-cursor" y1="${PAD.top}" y2="${PAD.top + innerH}" style="display:none" />
          <line x1="${PAD.left}" y1="${PAD.top + innerH}" x2="${width - PAD.right}" y2="${PAD.top + innerH}" class="chart-axis" />
          ${xTicks}
        </svg>
        <div class="chart-tooltip" style="display:none"></div>
      </div>
      <div class="chart-legend">
        <span class="chart-legend-item"><span class="chart-legend-swatch chart-gross-swatch"></span>${I18n.t('summary.totalGross')}</span>
        <span class="chart-legend-item"><span class="chart-legend-swatch chart-net-swatch"></span>${I18n.t('summary.totalNet')}</span>
      </div>
    `;

    container.querySelectorAll('.chart-period').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = (btn as HTMLElement).dataset.period as ChartPeriod;
        if (period && period !== this._period) {
          this._period = period;
          this.render(container, this._fullPoints, this._selectedDate);
        }
      });
    });

    this._bindChart(container, width);
    this._updateSelectedMarker();
  }

  /** Moves/hides the selection marker without re-rendering the whole SVG. */
  setSelectedDate(date: string | null): void {
    this._selectedDate = date;
    this._updateSelectedMarker();
  }

  _updateSelectedMarker(): void {
    const g = this._container?.querySelector<SVGGElement>('.chart-selected-group');
    if (!g) return;
    const d = this._selectedDate;
    const visible = this._points;
    if (!d || visible.length < 2 || d < visible[0].date || d > visible.at(-1)!.date) {
      g.style.display = 'none';
      return;
    }
    const sx = this._x(d);
    const axisY = this._axisY;
    const line = g.querySelector<SVGLineElement>('.chart-selected')!;
    line.setAttribute('x1', sx.toFixed(1));
    line.setAttribute('x2', sx.toFixed(1));
    line.setAttribute('y2', axisY.toFixed(1));
    g.querySelector<SVGPolygonElement>('.chart-selected-tick')!.setAttribute(
      'points',
      `${sx.toFixed(1)},${axisY + 7} ${(sx - 4.5).toFixed(1)},${axisY} ${(sx + 4.5).toFixed(1)},${axisY}`
    );
    g.style.display = '';
  }

  /** Start date of `period`, or null for the whole range (Max). */
  _periodStart(period: ChartPeriod): string | null {
    const last = this._fullPoints.at(-1)?.date;
    if (!last) return null;
    const months: Partial<Record<ChartPeriod, number>> = { '6M': 6, '1A': 12, '5A': 60, '10A': 120 };
    if (period === 'YTD') return `${last.slice(0, 4)}-01-01`;
    const n = months[period];
    if (n == null) return null;
    const d = new Date(ts(last));
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Restricts the series to the selected period, prepending a boundary point
   * at the period start holding the last state known at that date (step
   * semantics — the curve starts at the right level even between records).
   */
  _sliceForPeriod(points: ChartPoint[]): ChartPoint[] {
    if (points.length === 0) return points;
    const start = this._periodStart(this._period);
    if (!start) return points;
    const last = points.at(-1)!.date;
    if (start >= last) return points.slice(-2);
    let before: ChartPoint | undefined;
    const visible = points.filter(p => {
      if (p.date < start) before = p;
      return p.date >= start;
    });
    const head = before ?? visible[0];
    return [{ date: start, gross: head.gross, net: head.net }, ...visible.filter(p => p.date > start)];
  }

  _bindChart(container: HTMLElement, width: number): void {
    const svg = container.querySelector('svg')!;
    const cursor = svg.querySelector('.chart-cursor') as SVGLineElement;
    const tooltip = container.querySelector('.chart-tooltip') as HTMLElement;

    const dateAtX = (clientX: number): string => {
      const rect = svg.getBoundingClientRect();
      const svgX = (clientX - rect.left) * (width / rect.width);
      const t = this._t0 + ((svgX - PAD.left) / (width - PAD.left - PAD.right)) * (this._t1 - this._t0);
      const date = dateString(Math.min(Math.max(t, this._t0), this._t1));
      return date;
    };

    const showCursor = (clientX: number): void => {
      const rect = svg.getBoundingClientRect();
      const svgX = Math.min(Math.max((clientX - rect.left) * (width / rect.width), PAD.left), width - PAD.right);
      const date = dateAtX(clientX);
      cursor.setAttribute('x1', String(svgX));
      cursor.setAttribute('x2', String(svgX));
      cursor.style.display = 'block';

      // Values of the last sampled state at or before the cursor date.
      let i = 0;
      while (i + 1 < this._points.length && this._points[i + 1].date <= date) i++;
      const p = this._points[i];
      tooltip.innerHTML = `<div class="chart-tooltip-date">${fullDateFmt.format(ts(p.date))}</div>
        <div><span class="chart-legend-swatch chart-gross-swatch"></span>${I18n.t('summary.totalGross')} : ${currencyFmt.format(p.gross)}</div>
        <div><span class="chart-legend-swatch chart-net-swatch"></span>${I18n.t('summary.totalNet')} : ${currencyFmt.format(p.net)}</div>`;
      tooltip.style.display = 'block';
      const tipW = tooltip.offsetWidth;
      tooltip.style.left = `${Math.min(Math.max(svgX + 10, 4), Math.max(4, rect.width - tipW - 4))}px`;
      tooltip.style.top = '6px';
    };

    const hideCursor = (): void => {
      cursor.style.display = 'none';
      tooltip.style.display = 'none';
    };

    svg.addEventListener('pointerdown', (e) => {
      this._suppressClick = false;
      if (e.pointerType !== 'touch') return;
      this._clearPressTimer();
      this._pressTimer = setTimeout(() => {
        this._exploring = true;
        showCursor(e.clientX);
      }, LONG_PRESS_MS);
    });

    svg.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (this._exploring) showCursor(e.clientX);
      } else {
        showCursor(e.clientX);
      }
    });

    svg.addEventListener('pointerup', () => {
      this._clearPressTimer();
      if (this._exploring) {
        this._exploring = false;
        this._suppressClick = true;
        hideCursor();
      }
    });

    svg.addEventListener('pointercancel', () => {
      this._clearPressTimer();
      this._exploring = false;
      hideCursor();
    });

    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') hideCursor();
    });

    svg.addEventListener('click', (e) => {
      if (this._suppressClick) return;
      this._onPickDate(dateAtX(e.clientX));
    });
  }

  _clearPressTimer(): void {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
    }
  }
}
