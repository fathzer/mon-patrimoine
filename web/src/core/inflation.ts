/**
 * Monthly consumer-price index series (INSEE, base 2025) fetched lazily from
 * a GitHub Gist that is kept up to date by a scheduled workflow. All amounts
 * stored and computed by the application stay in nominal "euros of the time";
 * this module only produces a multiplicative factor used to express a
 * historical amount in current euros for display.
 *
 * The current month is generally not published yet, so the base for "current
 * euros" is the latest available month, not the calendar month.
 */

export interface InflationSourceData {
  source: {
    id: string;
    title: string;
    origin: string;
    url: string;
    lastUpdate: string;
  };
  index: Record<string, string>;
}

export class InflationIndex {
  readonly sourceId: string;
  readonly title: string;
  private readonly _months: string[];
  private readonly _values: Map<string, number>;
  private readonly _latestMonth: string;

  constructor(data: InflationSourceData) {
    this.sourceId = data.source.id;
    this.title = data.source.title;
    this._months = Object.keys(data.index).sort((a, b) => a.localeCompare(b));
    this._values = new Map(this._months.map(m => [m, Number.parseFloat(data.index[m])]));
    this._latestMonth = this._months.at(-1)!;
  }

  get latestMonth(): string {
    return this._latestMonth;
  }

  get latestValue(): number {
    return this._values.get(this._latestMonth)!;
  }

  get firstMonth(): string {
    return this._months[0];
  }

  /**
   * Index value for the greatest published month <= the YYYY-MM of `date`.
   * Dates before the first published month resolve to the first month
   * (best-effort deflation from the oldest known point).
   */
  valueAt(date: string): number {
    const ym = date.slice(0, 7);
    let lo = 0;
    let hi = this._months.length - 1;
    let res = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this._months[mid] <= ym) {
        res = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return this._values.get(this._months[res])!;
  }

  /**
   * Multiplicative factor to display an amount dated `date` in current euros:
   * `latestValue / valueAt(date)`. Always >= 1 once the date is in the past.
   */
  factorFor(date: string): number {
    const v = this.valueAt(date);
    return v > 0 ? this.latestValue / v : 1;
  }
}

/** UI-layer snapshot of the inflation selection (source + loading status). */
export interface InflationUiState {
  source: string | null;
  /** Latest published month of the loaded series, when available. */
  baseMonth: string | null;
  loading: boolean;
  error: boolean;
}

export const NO_INFLATION_UI_STATE: InflationUiState = {
  source: null,
  baseMonth: null,
  loading: false,
  error: false
};

/** INSEE series ids, matching the fragment between `-` and `.json` in the file names. */
export const INFLATION_SERIES_IDS = ['011814630', '011814056', '011814080'] as const;
export type InflationSeriesId = typeof INFLATION_SERIES_IDS[number];

export const INFLATION_SERIES_LABELS: Record<InflationSeriesId, string> = {
  '011814630': 'Tous produits',
  '011814056': 'Hors tabac',
  '011814080': 'Hors tabac et alcool'
};

const cache = new Map<string, InflationIndex | null>();

/** Loads a series JSON lazily from the shared Gist and caches it. Returns null on failure. */
export async function loadInflationIndex(id: string): Promise<InflationIndex | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  try {
    const res = await fetch(`https://gist.githubusercontent.com/fathzer/5646b5558f759655717914400cc50a03/raw/insee-${id}.json`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as InflationSourceData;
    const idx = new InflationIndex(data);
    cache.set(id, idx);
    return idx;
  } catch (e) {
    console.error('Failed to load inflation series', id, e);
    cache.set(id, null);
    return null;
  }
}

/** Synchronous access to a previously loaded series, or null. */
export function getCachedInflationIndex(id: string): InflationIndex | null {
  return cache.get(id) ?? null;
}
