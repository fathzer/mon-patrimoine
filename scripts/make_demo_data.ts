/**
 * Generates the demo datasets:
 *   demo/placements-demo.json    — realistic household portfolio
 *     (PEA with episodic deposits, PER with monthly deductible payments,
 *     Livret A, a checking account closed mid-history and replaced by
 *     another, yearly SAFRAN free-share grants 2021-2024, a fluctuating
 *     "Crédit d'impôts" custom placement, an evolving tax profile and a
 *     few chart annotations).
 *   demo/placements-stress.json  — one placement per module, each filled
 *     to the thin() retention capacity (daily < 1y, weekly 1-5y,
 *     fortnightly 5-10y, monthly 10-20y), plus a "maxed out" tax profile.
 *
 * Deterministic: no real randomness (seeded hash noise), no network.
 * Run from the repo root: bun scripts/make_demo_data.ts
 */

import { mkdirSync, writeFileSync } from 'fs';

const DAY = 86400000;
const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
const utc = (s: string): number => Date.parse(`${s}T00:00:00Z`);
const addDays = (s: string, n: number): string => iso(utc(s) + n * DAY);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Deterministic noise in [-amp, +amp) from an integer seed. */
const noise = (i: number, amp = 1): number => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 * amp - amp;
};

// ---------------------------------------------------------------- date grids

/** First of each month from `fromYYYYMM` to `toYYYYMM` inclusive. */
function monthGrid(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

const stepGrid = (from: string, to: string, days: number): string[] => {
  const out: string[] = [];
  for (let t = utc(from); t <= utc(to); t += days * DAY) out.push(iso(t));
  return out;
};

const lastDayOfMonth = (y: number, m: number): number =>
  new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Day-of-month slots per month, per thin() band. */
function bandGrid(fromYM: string, toYM: string, days: ('mid' | 'last')[]): string[] {
  const out: string[] = [];
  let [y, m] = fromYM.split('-').map(Number);
  const [ty, tm] = toYM.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    for (const d of days) {
      out.push(`${y}-${String(m).padStart(2, '0')}-${String(d === 'last' ? lastDayOfMonth(y, m) : d).padStart(2, '0')}`);
    }
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

// Demo grid: monthly 2019-01 → 2026-01, weekly → 2026-09-01, daily → 2026-10-15.
const DEMO_MONTHLY = monthGrid('2019-01', '2026-01');
const DEMO_WEEKLY = stepGrid('2026-01-08', '2026-08-31', 7);
const DEMO_DAILY = stepGrid('2026-09-01', '2026-10-15', 1);
const DEMO_GRID = [...DEMO_MONTHLY, ...DEMO_WEEKLY, ...DEMO_DAILY];
const DEMO_TODAY = '2026-10-15';

// Stress grid = exactly what thin() keeps over 20 years (~800 slots).
const STRESS_BANDS = (offset: number): string[] => [
  ...stepGrid('2025-10-16', '2026-10-15', 1),                      // daily, < 1y
  ...bandGrid('2021-10', '2025-10', [7, 14, 21, 'last']),          // weekly, 1-5y
  ...bandGrid('2016-10', '2021-10', [15, 'last']),                 // fortnightly, 5-10y
  ...bandGrid('2006-10', '2016-10', ['last'])                      // monthly, > 10y
].map(d => addDays(d, offset));

// ------------------------------------------------------------- index helpers

/** Piecewise-linear index through [YYYY-MM, level] anchors + noise. */
function makeIndex(anchors: [string, number][], noiseAmp = 0): (date: string) => number {
  const pts = anchors.map(([d, v]) => ({ t: utc(`${d}-01`), v }));
  return (date: string) => {
    const t = utc(date);
    let a = pts[0];
    let b = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i].t && t <= pts[i + 1].t) { a = pts[i]; b = pts[i + 1]; break; }
    }
    const k = b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const v = a.v + (b.v - a.v) * k;
    return v * (1 + noise(Math.round(t / DAY), noiseAmp) / 100);
  };
}

// Plausible equity index (PEA): 2019 → +110%, with the 2020 COVID dip and
// the 2022 drawdown. Extended back to 2013 for the liquidated second PEA.
const peaIndex = makeIndex([
  ['2013-01', 62], ['2015-01', 76], ['2015-08', 70], ['2017-01', 86],
  ['2018-06', 95], ['2019-01', 100], ['2020-02', 112], ['2020-03', 78], ['2020-05', 86],
  ['2020-12', 105], ['2021-06', 122], ['2021-12', 133], ['2022-03', 108],
  ['2022-09', 111], ['2022-12', 119], ['2023-06', 134], ['2023-12', 148],
  ['2024-06', 157], ['2024-12', 170], ['2025-06', 182], ['2025-12', 193],
  ['2026-06', 196], ['2026-10', 199]
], 1.8);

// Plausible SAFRAN share price.
const safranPrice = makeIndex([
  ['2021-01', 105], ['2021-06', 115], ['2021-12', 128], ['2022-03', 112],
  ['2022-06', 96], ['2022-12', 118], ['2023-03', 152], ['2023-06', 158],
  ['2023-12', 168], ['2024-03', 203], ['2024-06', 214], ['2024-12', 232],
  ['2025-03', 262], ['2025-06', 288], ['2025-12', 332], ['2026-03', 345],
  ['2026-06', 350], ['2026-10', 356]
], 1.2);

// ------------------------------------------------------------- demo builders

type Values = Record<string, unknown>;
interface HistEntry { date: string; values: Values }

/** PEA: episodic deposits buy units of the index; value = units × price. */
function buildPea(): Record<string, unknown> {
  const deposits: Record<string, number> = {
    '2019-01-01': 15000, '2019-06-01': 3000, '2020-04-01': 5000,
    '2021-02-01': 2500, '2021-09-01': 3000, '2022-03-01': 4000,
    '2023-07-01': 2000, '2024-11-01': 3000, '2025-09-01': 5000,
    '2026-05-01': 2000
  };
  const history: HistEntry[] = [];
  let units = 0;
  let totalDeposits = 0;
  for (const date of DEMO_GRID) {
    if (deposits[date]) {
      totalDeposits += deposits[date];
      units += deposits[date] / peaIndex(date);
    }
    history.push({ date, values: { totalDeposits, currentValue: round2(units * peaIndex(date)) } });
  }
  return {
    id: 'pea-1', type: 'pea', label: 'PEA TradeBank', institution: 'TradeBank',
    peaType: 'pea', openingDate: '2019-01-01',
    totalDeposits, currentValue: history.at(-1)!.values.currentValue,
    asOf: DEMO_TODAY, history: history.slice(0, -1)
  };
}

/**
 * Second PEA opened in 2013, fed ~1 500 €/month, liquidated in June 2019
 * (~227 k€) to buy the Brittany house. The 2013-2018 deposit stream is
 * accumulated into units off-history (records may not predate 2019-01-01):
 * the balance simply shows up on the first 2019 statement, then the PEA
 * vanishes on 2019-06-15 — the same day the house appears.
 */
function buildOldPea(): Record<string, unknown> {
  let units = 40000 / peaIndex('2013-01-01');
  let totalDeposits = 40000;
  for (const date of monthGrid('2013-02', '2018-12')) {
    units += 1500 / peaIndex(date);
    totalDeposits += 1500;
  }
  const history: HistEntry[] = monthGrid('2019-01', '2019-05')
    .map(date => ({ date, values: { totalDeposits, currentValue: round2(units * peaIndex(date)) } }));
  const closeValue = round2(units * peaIndex('2019-06-15'));
  history.push({ date: '2019-06-15', values: { totalDeposits, currentValue: closeValue } });
  return {
    id: 'pea-0', type: 'pea', label: 'PEA FortunaBank', institution: 'FortunaBank',
    peaType: 'pea', openingDate: '2013-01-01',
    totalDeposits, currentValue: closeValue,
    asOf: '2019-06-15', closedAt: '2019-06-15',
    history: history.slice(0, -1)
  };
}

/** PER: 500 €/month into the deductible compartment + 2 000 € each December. */
function buildPer(): Record<string, unknown> {
  const history: HistEntry[] = [];
  let contributions = 0;
  const t0 = utc('2021-03-01');
  for (const date of DEMO_GRID) {
    if (utc(date) < t0) continue;
    contributions += 500 + (date.endsWith('-12-01') ? 2000 : 0);
    const years = (utc(date) - t0) / (365.25 * DAY);
    const gross = contributions * (1 + 0.032 * years) * (1 + noise(Math.round(utc(date) / DAY), 1) / 100);
    history.push({
      date,
      values: {
        grossValue: round2(gross), netValue: round2(gross * 0.985), knowsNetValue: true,
        deducted: { contributions, gain: round2(gross - contributions) },
        nonDeducted: { contributions: 0, gain: 0 },
        employeeSavings: { contributions: 0, gain: 0 }
      }
    });
  }
  const last = history.at(-1)!.values as { grossValue: number; netValue: number; deducted: { contributions: number; gain: number } };
  return {
    id: 'per-1', type: 'per', label: 'PER Individuel', institution: 'RetraiteBank',
    grossValue: last.grossValue, netValue: last.netValue, knowsNetValue: true,
    deducted: last.deducted,
    nonDeducted: { contributions: 0, gain: 0 },
    employeeSavings: { contributions: 0, gain: 0 },
    asOf: DEMO_TODAY, history: history.slice(0, -1)
  };
}

/** Livret A: never decreases; real regulated rates + a few deposits. */
function buildLivretA(): Record<string, unknown> {
  const rates: [string, number][] = [ // [from YYYY-MM, annual rate]
    ['2019-01', 0.005], ['2022-02', 0.01], ['2022-08', 0.02],
    ['2023-02', 0.03], ['2025-02', 0.024], ['2025-08', 0.017]
  ];
  const deposits: Record<string, number> = {
    '2020-01-01': 500, '2020-07-01': 2000, '2021-01-01': 500,
    '2022-01-01': 500, '2023-01-01': 800, '2024-01-01': 800,
    '2025-01-01': 1000, '2026-01-01': 1000
  };
  const rateAt = (ym: string) => rates.filter(([f]) => f <= ym).at(-1)![1];
  const history: HistEntry[] = [];
  let value = 8000;
  let interest = 0;
  let prev = '2019-01-01';
  for (const date of DEMO_GRID) {
    const months = Math.max(1, Math.round((utc(date) - utc(prev)) / (30.44 * DAY)));
    for (let i = 0; i < months; i++) {
      const m = addDays(prev, Math.round((i + 1) * 30.44)).slice(0, 7);
      const gain = value * rateAt(m) / 12;
      value += gain;
      interest += gain;
    }
    if (deposits[date]) value += deposits[date];
    value = Math.min(value, 22950); // legal cap
    history.push({ date, values: { currentValue: round2(value), interestAmount: round2(interest), promotionalInterest: 0 } });
    prev = date;
  }
  const last = history.at(-1)!.values as { currentValue: number; interestAmount: number };
  return {
    id: 'livret-1', type: 'savings_account', label: 'Livret A', institution: 'PosteBank',
    taxExempt: true, currentValue: last.currentValue, interestAmount: last.interestAmount,
    asOf: DEMO_TODAY, history: history.slice(0, -1)
  };
}

/** Checking accounts: one closed 2023-06-15, replaced by another the same day. */
function buildChecking(id: string, label: string, institution: string, from: string, to: string, closed: boolean): Record<string, unknown> {
  const dates = DEMO_GRID.filter(d => d >= from && d <= to);
  const history: HistEntry[] = dates.map((d, i) => ({
    date: d,
    values: {
      currentValue: round2(4200 + noise(i * 7 + (closed ? 3 : 41), 2500)),
      cardBalance: round2(120 + noise(i * 13 + 5, 380))
    }
  }));
  const last = history.at(-1)!.values as { currentValue: number; cardBalance: number };
  return {
    id, type: 'checking_account', label, institution,
    currentValue: last.currentValue, cardBalance: last.cardBalance,
    asOf: to,
    ...(closed ? { closedAt: to } : {}),
    history: history.slice(0, -1)
  };
}

/** SAFRAN free-share grants: yearly attribution 2021-2024, ~10 k€ at grant, vesting +2y. */
function buildStockGrant(): Record<string, unknown> {
  const attributions = [
    { attributionDate: '2021-03-15', acquisitionDate: '2023-03-15', acquisitionPrice: 152, numberOfShares: 95 },
    { attributionDate: '2022-03-15', acquisitionDate: '2024-03-15', acquisitionPrice: 203, numberOfShares: 90 },
    { attributionDate: '2023-03-15', acquisitionDate: '2025-03-15', acquisitionPrice: 262, numberOfShares: 64 },
    { attributionDate: '2024-03-15', acquisitionDate: '2026-03-15', acquisitionPrice: 345, numberOfShares: 48 }
  ];
  const priceDates = DEMO_GRID.filter(d => d >= '2021-01-01');
  const priceHistory = priceDates.slice(0, -1).map(d => ({ date: d, price: round2(safranPrice(d)) }));
  return {
    id: 'sg-1', type: 'stock_grant', label: 'Actions gratuites Safran', institution: 'SalaryBank',
    stockName: 'SAFRAN',
    currentPrice: round2(safranPrice(DEMO_TODAY)),
    priceAsOf: DEMO_TODAY,
    priceHistory,
    attributions,
    asOf: DEMO_TODAY
  };
}

/** Real estate from explicit [date, k€] anchor estimates (step semantics). */
function buildRealEstate(
  base: Record<string, unknown>,
  estimates: [string, number][],
  works: [string, number][]
): Record<string, unknown> {
  const worksAt = (d: string) => [...works].reverse().find(([ed]) => ed <= d)?.[1] ?? works[0][1];
  // One history record per estimate (semiannual grid + the acquisition date).
  const history: HistEntry[] = estimates
    .map(([d, k]) => ({ date: d, values: { currentValue: k * 1000, works: worksAt(d) * 1000 } }));
  const last = history.at(-1)!.values as { currentValue: number; works: number };
  return {
    ...base, type: 'real_estate',
    currentValue: last.currentValue, works: last.works,
    asOf: DEMO_TODAY, history: history.slice(0, -1)
  };
}

/** Custom "Crédit d'impôts": yearly sawtooth under 5 k€ (declared ~June, reimbursed ~Sept). */
function buildCreditImpot(): Record<string, unknown> {
  const history: HistEntry[] = DEMO_GRID.map((d, i) => {
    const month = Number(d.slice(5, 7));
    const y = Number(d.slice(0, 4));
    const credit = 2400 + noise(y * 31, 900);            // yearly amount 1.5-3.3 k€
    const value = month >= 6 && month <= 8 ? credit + 800
      : month === 9 ? credit * 0.4
      : 350 + noise(i * 17, 250);                        // trailing remainder
    return { date: d, values: { grossValue: round2(Math.max(80, value)), socialCharges: 0, incomeTax: 0 } };
  });
  return {
    id: 'custom-1', type: 'custom', label: 'Crédit d\'impôts', institution: 'DGFiP',
    category: 'other',
    grossValue: history.at(-1)!.values.grossValue, socialCharges: 0, incomeTax: 0,
    asOf: DEMO_TODAY, history: history.slice(0, -1)
  };
}

// Demo tax profile: married throughout, children arrive along the way
// (0 in 2019, 1 from 2020, 2 from 2023, 3 from 2025); income +5 % on
// grant years (2021-2024), ~+2 % otherwise.
function demoTaxProfile(): Record<string, unknown> {
  const kidsByYear: [number, number][] = [[2019, 0], [2020, 1], [2023, 2], [2025, 3]];
  let income = 62000;
  const history: { year: number; profile: Record<string, unknown> }[] = [];
  let current: Record<string, unknown> = {};
  for (let year = 2019; year <= 2026; year++) {
    const bump = year >= 2021 && year <= 2024 ? 1.05 : 1.02;
    if (year > 2019) income = Math.round(income * bump);
    const childrenCount = kidsByYear.filter(([y]) => y <= year).at(-1)![1];
    const profile = {
      household: { maritalStatus: 'married', childrenCount },
      taxableIncome: income,
      usePfu: true
    };
    if (year < 2026) history.push({ year, profile });
    else current = profile;
  }
  return { year: 2026, profile: current, history };
}

const demoPayload = {
  version: '1.2',
  taxProfile: demoTaxProfile(),
  placements: [
    buildOldPea(), buildPea(), buildPer(), buildLivretA(),
    buildChecking('cc-1', 'Compte joint Bank du Peuplier', 'Bank du Peuplier', '2019-01-01', '2023-06-15', true),
    buildChecking('cc-2', 'Compte courant NetBank', 'NetBank', '2023-06-15', DEMO_TODAY, false),
    buildStockGrant(), buildCreditImpot(),
    buildRealEstate(
      { id: 'immo-1', label: 'Appartement Boulogne', institution: '', primaryResidence: true, acquisitionDate: '', acquisitionPrice: 0, freeAcquisition: false, acquisitionFees: 0 },
      [['2019-01-01', 295], ['2019-07-01', 300], ['2020-01-01', 305], ['2020-07-01', 308], ['2021-01-01', 315],
       ['2021-07-01', 322], ['2022-01-01', 330], ['2022-07-01', 328], ['2023-01-01', 320],
       ['2023-07-01', 318], ['2024-01-01', 325], ['2024-07-01', 332], ['2025-01-01', 340],
       ['2025-07-01', 348], ['2026-01-01', 352], ['2026-07-01', 355]],
      [['2019-01-01', 0]]
    ),
    buildRealEstate(
      { id: 'immo-2', label: 'Maison Bretagne', institution: '', primaryResidence: false, acquisitionDate: '2019-06-15', acquisitionPrice: 200000, freeAcquisition: false, acquisitionFees: 15000 },
      [['2019-06-15', 200], ['2020-01-01', 212], ['2020-07-01', 220],
       ['2021-01-01', 236], ['2021-07-01', 252], ['2022-01-01', 264], ['2022-07-01', 267],
       ['2023-01-01', 260], ['2023-07-01', 264], ['2024-01-01', 271], ['2024-07-01', 277],
       ['2025-01-01', 284], ['2025-07-01', 289], ['2026-01-01', 292], ['2026-07-01', 295]],
      [['2019-06-15', 0], ['2020-01-01', 15], ['2020-07-01', 45], ['2021-01-01', 50]]
    )
  ],
  annotations: [
    { date: '2019-06-15', text: 'Clôture du PEA FortunaBank pour l\'achat de la maison du Morbihan' },
    { date: '2020-04-01', text: 'Covid : versement PEA opportuniste pendant le creux' },
    { date: '2021-03-15', text: 'Première attribution d\'actions gratuites Safran' },
    { date: '2023-01-15', text: 'Naissance du 2e enfant' },
    { date: '2023-06-15', text: 'Clôture du compte Bank du Peuplier, bascule vers NetBank' },
    { date: '2025-02-10', text: 'Naissance du 3e enfant' }
  ]
};

// ---------------------------------------------------------- stress-test file

const STRESS_TODAY = '2026-10-15';

/** Junk-but-deterministic evolving values, one entry per kept slot. */
function stressHistory(dayOffset: number, values: (i: number) => Values): HistEntry[] {
  return STRESS_BANDS(dayOffset).map((d, i) => ({ date: d, values: values(i) }));
}

function stressPlacement(base: Record<string, unknown>, offset: number, values: (i: number) => Values): Record<string, unknown> {
  const history = stressHistory(offset, values);
  return { ...base, ...history.at(-1)!.values, asOf: STRESS_TODAY, history: history.slice(0, -1) };
}

const v = (i: number) => round2(5000 + i * 3 + noise(i * 11, 400));

// Per-placement day offsets stagger the dates so the chart's union of
// dates is maximal — the worst case for series building.
const stressPlacements = [
  stressPlacement(
    { id: 's-check', type: 'checking_account', label: 'CC stress', institution: 'MutuelBank' }, 0,
    i => ({ currentValue: v(i), cardBalance: round2(100 + noise(i * 5, 90)) })
  ),
  stressPlacement(
    { id: 's-livret', type: 'savings_account', label: 'Livret stress', institution: 'ÉcureuilBank', taxExempt: true }, 1,
    i => ({ currentValue: v(i), interestAmount: round2(i * 2), promotionalInterest: 0 })
  ),
  stressPlacement(
    { id: 's-pel', type: 'home_savings', label: 'PEL stress', institution: 'ParigoBank', homeSavingsType: 'pel', openingDate: '2006-10-31', taxExempt: false }, 2,
    i => ({ currentValue: v(i), interestAmount: round2(i * 2) })
  ),
  stressPlacement(
    { id: 's-immo', type: 'real_estate', label: 'Immo stress', institution: '', acquisitionDate: '2006-10-31', acquisitionPrice: 180000, freeAcquisition: false, acquisitionFees: 14000 }, 3,
    i => ({ currentValue: v(i) * 10, works: round2(i * 1.5) })
  ),
  stressPlacement(
    { id: 's-pea', type: 'pea', label: 'PEA stress', institution: 'TradeBank', peaType: 'pea', openingDate: '2006-10-31' }, 4,
    i => ({ totalDeposits: round2(3000 + i * 2), currentValue: v(i) })
  ),
  stressPlacement(
    { id: 's-pee', type: 'pee', label: 'PEE stress', institution: 'SalaryBank', knowsNetValue: false }, 5,
    i => ({ totalDeposits: round2(2000 + i * 1.5), currentValue: v(i), netValue: round2(v(i) * 0.9), knowsNetValue: false })
  ),
  stressPlacement(
    { id: 's-cto', type: 'cto', label: 'CTO stress', institution: 'BrokerBank' }, 6,
    i => ({ acquisitionValue: round2(3000 + i), cashBalance: round2(200 + noise(i * 7, 150)), currentValue: v(i) })
  ),
  stressPlacement(
    { id: 's-av', type: 'life_insurance', label: 'AV stress', institution: 'AssurVie', openingDate: '2006-10-31' }, 7,
    i => ({ totalPremiums: round2(4000 + i * 2), pre2017Premiums: 0, currentValue: v(i), euroFundsValue: round2(v(i) * 0.6) })
  ),
  (() => { // stock_grant: same slot density on price AND per-line shares histories
    const dates = STRESS_BANDS(8);
    const priceHistory = dates.slice(0, -1).map((d, i) => ({ date: d, price: round2(50 + i * 0.4 + noise(i * 3, 3)) }));
    const mkLine = (id: number) => ({
      attributionDate: '2007-01-15', acquisitionDate: '2007-01-15',
      acquisitionPrice: 60,
      numberOfShares: round2(10 + dates.length * 0.01),
      sharesAsOf: STRESS_TODAY,
      sharesHistory: dates.slice(0, -1).map((d, i) => ({ date: d, shares: round2(10 + i * 0.01 + id) }))
    });
    return {
      id: 's-sg', type: 'stock_grant', label: 'AGA stress', institution: 'AeroCorp', stockName: 'STRESS',
      currentPrice: round2(50 + dates.length * 0.4), priceAsOf: STRESS_TODAY, priceHistory,
      attributions: [mkLine(0), mkLine(1)],
      asOf: STRESS_TODAY
    };
  })(),
  stressPlacement(
    { id: 's-per', type: 'per', label: 'PER stress', institution: 'Prudentia' }, 9,
    i => ({
      grossValue: v(i), netValue: round2(v(i) * 0.9), knowsNetValue: true,
      deducted: { contributions: round2(1000 + i), gain: round2(i * 0.5) },
      nonDeducted: { contributions: round2(500 + i * 0.5), gain: 0 },
      employeeSavings: { contributions: 0, gain: 0 }
    })
  ),
  stressPlacement(
    { id: 's-custom', type: 'custom', label: 'Custom stress', institution: '', category: 'other' }, 10,
    i => ({ grossValue: v(i), socialCharges: round2(i * 0.1), incomeTax: round2(i * 0.05) })
  )
];

const stressPayload = {
  version: '1.2',
  taxProfile: {
    year: 2026,
    profile: {
      household: {
        maritalStatus: 'married',
        childrenCount: 2, alternateChildrenCount: 1,
        disabledChildrenCount: 1, disabledAlternateChildrenCount: 1,
        caseL: true, caseP: true, caseF: true, caseW: true, caseS: true, caseG: true
      },
      taxableIncome: 275000,
      usePfu: true
    },
    history: [
      { year: 2019, profile: { household: { maritalStatus: 'single', childrenCount: 1, isSingleParent: true }, taxableIncome: 180000, usePfu: true } },
      { year: 2022, profile: { household: { maritalStatus: 'married', childrenCount: 2, disabledChildrenCount: 1, caseP: true, caseG: true }, taxableIncome: 240000, usePfu: true } }
    ]
  },
  placements: stressPlacements,
  annotations: [
    { date: '2020-03-31', text: 'Stress test : annotation ancienne' },
    { date: '2026-10-01', text: 'Stress test : annotation récente' }
  ]
};

// -------------------------------------------------------------------- output

mkdirSync('demo', { recursive: true });
writeFileSync('demo/placements-demo.json', JSON.stringify(demoPayload, null, 2));
writeFileSync('demo/placements-stress.json', JSON.stringify(stressPayload, null, 2));
const kb = (o: unknown) => `${Math.round(JSON.stringify(o).length / 1024)} kB`;
console.log(`demo/placements-demo.json    ${kb(demoPayload)}  (${demoPayload.placements.length} placements)`);
console.log(`demo/placements-stress.json  ${kb(stressPayload)} (${stressPlacements.length} placements, ${STRESS_BANDS(0).length} records each)`);
