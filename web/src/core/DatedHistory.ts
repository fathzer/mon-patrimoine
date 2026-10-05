/**
 * Helpers for dated, state-based histories.
 *
 * A history is a list of entries sorted by date; each entry records a
 * complete state effective at `date` — a placement's evolving fields, a
 * tax profile, ... The state effective at a date D is the last entry with
 * `date <= D` (a step function — states are never interpolated or chained
 * as diffs). Dates use the ISO `YYYY-MM-DD` form, which sorts correctly
 * as a string.
 *
 * `HistoryEntry` is the conventional entry shape for placement histories;
 * the helpers themselves only require a `date` field.
 */

export interface HistoryEntry {
  date: string;
  values: Record<string, unknown>;
}

/**
 * Compares two ISO dates (YYYY-MM-DD) for ascending sort.
 * Exported so every history-related sort uses the same ordering.
 * @param a first date.
 * @param b second date.
 */
export function compareDates(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Returns the last entry with `entry.date <= date`, or null when none applies
 * (D predates the first known state).
 * @param entries history sorted by date (ascending).
 * @param date effective date to resolve (YYYY-MM-DD).
 */
export function resolveAt<T extends { date: string }>(entries: readonly T[], date: string): T | null {
  let resolved: T | null = null;
  for (const entry of entries) {
    if (entry.date <= date) {
      resolved = entry;
    } else {
      break;
    }
  }
  return resolved;
}

/**
 * Returns a new sorted history with `entry` recorded at its date.
 * An existing entry at the same date is replaced.
 * @param entries history sorted by date (ascending); not mutated.
 * @param entry entry to record; `entry.date` is its effective date (YYYY-MM-DD).
 */
export function recordAt<T extends { date: string }>(
  entries: readonly T[],
  entry: T
): T[] {
  const rest = entries.filter(e => e.date !== entry.date);
  rest.push(entry);
  return rest.sort((a, b) => compareDates(a.date, b.date));
}

/**
 * Structural equality for evolving-field values (objects, arrays,
 * primitives; object key order is ignored). Used to skip recording a state
 * that did not actually change.
 * @param a first value to compare.
 * @param b second value to compare.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  return aKeys.length === bKeys.length
    && aKeys.every(k => valuesEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k]
    ));
}

export interface ThinPolicy {
  /** Reference date used to compute entry ages (defaults to now). */
  now?: Date;
  /** Entries younger than this many days keep their full resolution (default ~6 months). */
  fullResolutionDays?: number;
  /** Up to this age in days, one entry per week is kept; beyond, one per month (default ~2 years). */
  weeklyResolutionDays?: number;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Retention slot endpoints: for every month overlapping [firstDate, now],
 * days 7, 14, 21 and the last day when the endpoint is mid-aged (between
 * `fullDays` and `weeklyDays` old), the month end only when it is older.
 * @param firstDate date of the earliest entry (YYYY-MM-DD).
 * @param now reference time in milliseconds.
 * @param fullDays recent band width in days.
 * @param weeklyDays weekly band width in days.
 */
function slotEndpoints(firstDate: string, now: number, fullDays: number, weeklyDays: number): number[] {
  const endpoints: number[] = [];
  const cursor = new Date(firstDate);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= now) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (const day of [7, 14, 21, lastDay]) {
      const end = Date.UTC(year, month, day);
      const age = (now - end) / DAY_MS;
      if (age >= fullDays && age < weeklyDays) {
        endpoints.push(end);
      }
    }
    if ((now - Date.UTC(year, month, lastDay)) / DAY_MS >= weeklyDays) {
      endpoints.push(Date.UTC(year, month, lastDay));
    }
    cursor.setUTCMonth(month + 1);
  }
  return endpoints;
}

/**
 * Each slot endpoint claims its closest entry (on a tie, the later one,
 * since entries are date-sorted).
 * @param entries history sorted by date (ascending).
 * @param endpoints slot dates in milliseconds.
 */
function slotWinners<T extends { date: string }>(entries: readonly T[], endpoints: number[]): Set<T> {
  const winners = new Set<T>();
  for (const end of endpoints) {
    let best = entries[0];
    let bestDist = Infinity;
    for (const entry of entries) {
      const dist = Math.abs(new Date(entry.date).getTime() - end);
      if (dist <= bestDist) {
        bestDist = dist;
        best = entry;
      }
    }
    winners.add(best);
  }
  return winners;
}

/**
 * Applies a degraded-retention policy to a sorted history. Retention
 * slots are calendar period ends — days 7, 14, 21 and the last day of
 * each month for mid-age entries, month ends only for older ones — and
 * each slot keeps the *closest* entry (on a tie, the later one). Recent
 * entries are all kept, and so is the very first entry.
 *
 * Why "closest to the slot" instead of "last in a bucket": states
 * recorded at period boundaries matter most — a value entered on Jan
 * 6th can typically describe the Dec 31st closing — so a slot claims the
 * best entry on either side of it, and an isolated entry naturally
 * covers its surrounding empty months (no duplication needed: being a
 * slot winner is just one more reason to keep it).
 *
 * Corrections stay possible afterwards: recordAt() can insert a new state
 * at any date in a thinned history.
 * @param entries history sorted by date (ascending); not mutated.
 * @param policy retention policy; see {@link ThinPolicy} for the defaults.
 */
export function thin<T extends { date: string }>(entries: readonly T[], policy: ThinPolicy = {}): T[] {
  if (entries.length <= 1) {
    return [...entries];
  }
  const now = (policy.now ?? new Date()).getTime();
  const fullDays = policy.fullResolutionDays ?? 183;
  const weeklyDays = policy.weeklyResolutionDays ?? 731;

  const winners = slotWinners(entries, slotEndpoints(entries[0].date, now, fullDays, weeklyDays));
  winners.add(entries[0]); // the first entry is always preserved
  for (const entry of entries) {
    if ((now - new Date(entry.date).getTime()) / DAY_MS < fullDays) {
      winners.add(entry); // recent entries keep their full resolution
    }
  }
  return entries.filter(e => winners.has(e));
}
