/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { AppStore } from "./AppStore.js";
import { collectChartDates } from "../ui/HistoryChartView.js";
import { EARLIEST_FISCAL_DATE } from "../fiscality/rates.js";
import { Household } from "../fiscality/Household.js";
import { BasePlacement } from "../placements/BasePlacement.js";
import { PlacementFactory } from "../placements/PlacementFactory.js";
import { Category } from "./Categories.js";
import type { PlacementData, Evaluation } from "../placements/BasePlacement.js";
import type { StorageManager } from "../storage/StorageManager.js";
import type { FiscalProfile, PlacementIncome } from "../fiscality/TaxCalculator.js";

const stubStorage = {
  save: async () => true
} as unknown as StorageManager;

interface TestData extends PlacementData {
  currentValue?: number;
  /** Stand-in for module-serialized fields absent from form payloads. */
  extra?: unknown;
}

class TestPlacement extends BasePlacement {
  static getCategory() {
    return Category.INVESTMENTS;
  }

  currentValue: number;
  extra?: unknown;

  constructor(data: TestData) {
    super({ ...data, type: 'test' });
    this.currentValue = Number(data.currentValue) || 0;
    this.extra = data.extra;
  }

  override toJSON(): TestData {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      ...(this.extra !== undefined ? { extra: this.extra } : {})
    };
  }

  getEvaluation(_fiscalProfile: FiscalProfile, _now?: Date): Evaluation {
    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue,
      socialCharges: 0,
      latentGain: 0,
      imposition: 0
    };
  }

  getEvolvingValues(): Record<string, unknown> {
    return { currentValue: this.currentValue };
  }

  protected getTaxableIncomes(): PlacementIncome[] {
    return [];
  }
}

// Registers the test module in PlacementFactory's private registry so that
// getSummaryAt's PlacementFactory.create() works without loading real modules.
(PlacementFactory as unknown as { _registry: Map<string, unknown> })
  ._registry.set('test', { definition: { name: 'test' }, ModuleClass: TestPlacement });
(PlacementFactory as unknown as { _loaded: boolean })._loaded = true;

const profile = (taxableIncome: number, married = false): FiscalProfile => ({
  household: new Household({ maritalStatus: married ? 'married' : 'single' }),
  taxableIncome,
  usePfu: true
});

const makeStore = (): AppStore => new AppStore(stubStorage);

const currentYear = new Date().getFullYear();

describe("AppStore tax profile history", () => {
  it("keeps an empty profile history for a 1.0 payload (no fabricated states)", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    // No history until the first change: the current profile implicitly
    // applies to every earlier year.
    expect(store.state.taxProfileHistory).toEqual([]);
    expect(store.state.taxProfileYear).toBe(currentYear);
    expect(store.getTaxProfileForYear(2015).taxableIncome).toBe(40000);
    const payload = store.getExportPayload();
    expect(payload.version).toBe("1.2");
    expect(payload.taxProfile).toEqual({ profile: profile(40000), year: currentYear });
  });

  it("hydrates a 1.1 dated history by folding dates into income years", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.1",
      taxProfile: {
        profile: profile(80000, true),
        asOf: "2024-06-01",
        history: [
          { date: "2020-01-01", profile: profile(50000) },
          { date: "2020-06-01", profile: profile(55000) },
          { date: "1970-01-01", profile: profile(30000) },
          { date: "2024-01-15", profile: profile(60000) }
        ]
      },
      placements: []
    });

    // Same-year entries keep the latest record; the entry folded into the
    // current year drops (the current point owns its year).
    expect(store.state.taxProfileHistory.map(e => e.year)).toEqual([1970, 2020]);
    expect(store.state.taxProfileHistory.find(e => e.year === 2020)!.profile.taxableIncome).toBe(55000);
    expect(store.state.taxProfileHistory[0].profile.household).toBeInstanceOf(Household);
    expect(store.state.taxProfileYear).toBe(2024);
  });

  it("resolves the profile for an income year, current profile included", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.2",
      taxProfile: {
        profile: profile(50000),
        year: 2024,
        history: [
          { year: 1970, profile: profile(30000) },
          { year: 2020, profile: profile(40000) }
        ]
      },
      placements: []
    });

    expect(store.getTaxProfileForYear(1960).taxableIncome).toBe(30000);
    expect(store.getTaxProfileForYear(2019).taxableIncome).toBe(30000);
    expect(store.getTaxProfileForYear(2020).taxableIncome).toBe(40000);
    expect(store.getTaxProfileForYear(2023).taxableIncome).toBe(40000);
    expect(store.getTaxProfileForYear(2024).taxableIncome).toBe(50000);
    expect(store.getTaxProfileForYear(2040).taxableIncome).toBe(50000);
    // getTaxProfileAt resolves the profile of the date's income year.
    expect(store.getTaxProfileAt("2021-06-15").taxableIncome).toBe(40000);
    // The resolved profile reports the year it was actually recorded for.
    expect(store.resolveTaxProfileForYear(2023).recordedYear).toBe(2020);
    expect(store.resolveTaxProfileForYear(1960).recordedYear).toBe(1970);
  });

  it("pushes the previous profile into history when recording a later year", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.2", taxProfile: { profile: profile(40000), year: 2020 }, placements: [] });

    store.updateTaxProfile(profile(50000, true));

    expect(store.state.taxProfile.taxableIncome).toBe(50000);
    expect(store.state.taxProfileYear).toBe(currentYear);
    expect(store.getTaxProfileForYear(2020).taxableIncome).toBe(40000);
    expect(store.getTaxProfileForYear(currentYear - 1).taxableIncome).toBe(40000);
    expect(store.getTaxProfileForYear(currentYear).taxableIncome).toBe(50000);
  });

  it("updates the current profile in place when recording its own year", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.2", taxProfile: { profile: profile(40000), year: 2020 }, placements: [] });

    store.updateTaxProfile(profile(45000), 2020);

    expect(store.state.taxProfile.taxableIncome).toBe(45000);
    expect(store.state.taxProfileYear).toBe(2020);
    expect(store.state.taxProfileHistory).toEqual([]);
  });

  it("records a retroactive year as a history entry without touching the current profile", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    store.updateTaxProfile(profile(45000), 2000);

    expect(store.state.taxProfile.taxableIncome).toBe(40000);
    expect(store.hasTaxProfileHistoryEntry(2000)).toBe(true);
    // The earliest recorded profile extends to every earlier year.
    expect(store.getTaxProfileForYear(1999).taxableIncome).toBe(45000);
    expect(store.getTaxProfileForYear(2000).taxableIncome).toBe(45000);
    expect(store.getTaxProfileForYear(currentYear).taxableIncome).toBe(40000);
  });

  it("clamps a future year to the current year", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    store.updateTaxProfile(profile(50000), currentYear + 5);

    expect(store.state.taxProfile.taxableIncome).toBe(50000);
    expect(store.state.taxProfileYear).toBe(currentYear);
    expect(store.state.taxProfileHistory).toEqual([]);
  });

  it("deletes a recorded year entry; the current profile is untouchable", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.2",
      taxProfile: {
        profile: profile(50000),
        year: 2024,
        history: [{ year: 2020, profile: profile(40000) }]
      },
      placements: []
    });

    store.deleteTaxProfileHistoryEntry(2020);
    expect(store.state.taxProfileHistory).toEqual([]);
    // 2020 now resolves to the earliest known point (the current profile).
    expect(store.getTaxProfileForYear(2020).taxableIncome).toBe(50000);

    // The current profile is not part of the history and stays put.
    store.deleteTaxProfileHistoryEntry(store.state.taxProfileYear);
    expect(store.state.taxProfile.taxableIncome).toBe(50000);
    expect(store.state.taxProfileYear).toBe(2024);
  });

  it("lists recorded years for point navigation", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.2",
      taxProfile: {
        profile: profile(50000),
        year: 2024,
        history: [
          { year: 2021, profile: profile(40000) },
          { year: 2019, profile: profile(30000) }
        ]
      },
      placements: []
    });

    expect(store.getTaxProfileYears()).toEqual([2019, 2021, 2024]);
    expect(store.hasTaxProfileHistoryEntry(2021)).toBe(true);
    expect(store.hasTaxProfileHistoryEntry(2022)).toBe(false);
  });
});

describe("AppStore placement lifecycle", () => {
  it("closes and reopens a placement without losing its history", () => {
    const store = makeStore();
    const placement = new TestPlacement({ id: "p1", currentValue: 100 });
    store.state.placements.push(placement);

    store.closePlacement("p1", "2026-10-01");
    expect(placement.closedAt).toBe("2026-10-01");
    // Closure keeps the placement in the file — only deletion removes it.
    expect(store.state.placements).toContain(placement);

    // closePlacement(id, null) reopens a placement closed by mistake.
    store.closePlacement("p1", null);
    expect(placement.closedAt).toBeNull();
  });

  it("preserves serialized fields absent from the update payload on retro saves", () => {
    const store = makeStore();
    // `extra` stands in for module-serialized fields the form never emits
    // (e.g. stock_grant's nested priceHistory/sharesHistory).
    const p = new TestPlacement({
      id: "p1",
      currentValue: 100,
      asOf: "2025-06-01",
      extra: { nestedHistory: [{ date: "2024-01-01", price: 80 }] }
    });
    store.state.placements.push(p);

    store.updatePlacement("p1", { id: "p1", type: "test", currentValue: 50, asOf: "2024-06-01" });

    const saved = store.state.placements[0] as TestPlacement;
    expect(saved.extra).toEqual({ nestedHistory: [{ date: "2024-01-01", price: 80 }] });
    // The retro save still wrote its own history entry.
    expect(saved.hasHistoryEntry("2024-06-01")).toBe(true);
    expect(saved.currentValue).toBe(100);
  });
});

describe("AppStore getSummaryAt", () => {
  const makeAuthedStore = (): AppStore => {
    const store = makeStore();
    store.state.isAuthenticated = true;
    return store;
  };

  it("evaluates reconstructed states at the view date", () => {
    const store = makeAuthedStore();
    const p = new TestPlacement({ id: "p1", currentValue: 100, asOf: "2025-06-01" });
    p.insertHistoryEntry("2024-01-01", { currentValue: 50 });
    store.state.placements.push(p);

    const past = store.getSummaryAt("2024-06-01");
    expect(past.asOfDate).toBe("2024-06-01");
    expect(past.evaluations!.map(e => e.instance.id)).toEqual(["p1"]);
    expect(past.evaluations![0].evaluation.grossValue).toBe(50);
    expect(past.totalGross).toBe(50);

    const later = store.getSummaryAt("2025-12-01");
    expect(later.evaluations![0].evaluation.grossValue).toBe(100);
  });

  it("excludes placements without a state at the view date", () => {
    const store = makeAuthedStore();
    store.state.placements.push(
      new TestPlacement({ id: "closed", currentValue: 10, asOf: "2020-01-01", closedAt: "2023-01-01" }),
      new TestPlacement({ id: "future", currentValue: 20, asOf: "2025-01-01" }),
      new TestPlacement({ id: "tracked", currentValue: 30, asOf: "2020-01-01" })
    );

    const s = store.getSummaryAt("2024-01-01");
    expect(s.evaluations!.map(e => e.instance.id)).toEqual(["tracked"]);

    // Same derivation as the UI's grayed rows: state.placements minus evaluated ids.
    const evaluated = new Set(s.evaluations!.map(e => e.instance.id));
    const inactive = store.state.placements.filter(p => !evaluated.has(p.id));
    expect(inactive.map(p => p.id)).toEqual(["closed", "future"]);
    expect(inactive.map(p => p.isClosedAt("2024-01-01"))).toEqual([true, false]);
  });

  it("keeps closed placements out of the current summary", () => {
    const store = makeAuthedStore();
    store.state.placements.push(
      new TestPlacement({ id: "closed", currentValue: 10, closedAt: "2020-01-01" }),
      new TestPlacement({ id: "open", currentValue: 20 })
    );

    const current = store.getSummaryAt(null);
    expect(current.evaluations!.map(e => e.instance.id)).toEqual(["open"]);
    expect(current.asOfDate).toBeUndefined();
    expect(store.state.placements.find(p => p.id === "closed")!.isClosedAt()).toBe(true);
  });

  it("deletes a retroactive history entry through the store", () => {
    const store = makeAuthedStore();
    const p = new TestPlacement({ id: "p1", currentValue: 100, asOf: "2025-06-01" });
    p.insertHistoryEntry("2024-01-01", { currentValue: 50 });
    store.state.placements.push(p);

    store.deleteStateAt("p1", "2024-01-01");
    expect(p.hasHistoryEntry("2024-01-01")).toBe(false);
    // With the only past entry gone, dates before asOf resolve to no state.
    expect(p.getDataAt("2024-06-01")).toBeNull();
  });

  it("deletes the current point by rolling back to the previous state", () => {
    const store = makeAuthedStore();
    const p = new TestPlacement({
      id: "p1",
      currentValue: 120,
      asOf: "2025-06-01",
      history: [{ date: "2024-01-01", values: { currentValue: 50 } }]
    });
    store.state.placements.push(p);

    store.deleteStateAt("p1", "2025-06-01");
    expect(p.currentValue).toBe(50);
    expect(p.asOf).toBe("2024-01-01");
    expect(p.history).toEqual([]);
  });
});

describe("AppStore getValueSeries (history chart)", () => {
  const makeAuthedStore = (): AppStore => {
    const store = makeStore();
    store.state.isAuthenticated = true;
    return store;
  };

  it("sums gross and net values at each date across placements", () => {
    const store = makeAuthedStore();
    store.state.placements.push(
      new TestPlacement({
        id: "p1", currentValue: 100, asOf: "2025-06-01",
        history: [{ date: "2024-01-01", values: { currentValue: 50 } }]
      }),
      new TestPlacement({ id: "p2", currentValue: 40, asOf: "2025-01-01" }),
      new TestPlacement({ id: "closed", currentValue: 10, asOf: "2024-01-01", closedAt: "2024-06-01" })
    );

    const series = store.getValueSeries(["2024-03-01", "2024-06-01", "2025-06-01", "2026-01-01"]);
    // p1 resolves to 50 (history), p2 has no state yet, closed still open.
    expect(series[0]).toEqual({ date: "2024-03-01", gross: 60, net: 60 });
    // On its closure date itself the placement no longer contributes.
    expect(series[1]).toEqual({ date: "2024-06-01", gross: 50, net: 50 });
    // All three contribute their state at that date — except closed (closedAt <= date).
    expect(series[2]).toEqual({ date: "2025-06-01", gross: 140, net: 140 });
    expect(series[3]).toEqual({ date: "2026-01-01", gross: 140, net: 140 });
  });

  it("collectChartDates never samples before the earliest fiscal date", () => {
    const store = makeAuthedStore();
    // A placement attributed before 2019 (e.g. an old stock grant): the
    // chart starts at the earliest fiscal date, where its state resolves.
    store.state.placements.push(new TestPlacement({
      id: "p1", currentValue: 100, asOf: "2026-01-10",
      history: [{ date: "2005-06-01", values: { currentValue: 50 } }]
    }));

    const dates = collectChartDates(store.state.placements, "2026-01-20");
    expect(dates[0]).toBe(EARLIEST_FISCAL_DATE);
    expect(dates.every(d => d >= EARLIEST_FISCAL_DATE)).toBe(true);
    // The pre-2019 placement still contributes from 2019-01-01 onward.
    expect(store.getValueSeries([EARLIEST_FISCAL_DATE])[0].gross).toBe(50);
  });

  it("computes a 20-year thinned history fast enough to run synchronously", () => {
    const store = makeAuthedStore();
    const today = new Date();
    const daysAgo = (n: number): string => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);

    // What thin() would retain over 20 years under the 1y-full / weekly-to-5y
    // / fortnightly-to-10y / monthly-beyond policy: ~800 points per placement.
    // 30 placements with staggered dates — the union feeds the chart, which
    // stride-thins to MAX_SAMPLES, so getValueSeries sees ~2000 dates.
    for (let i = 0; i < 30; i++) {
      const history = [];
      for (let d = 364; d >= 0; d--) history.push({ date: daysAgo(d), values: { currentValue: 1000 + d } });
      for (let w = 53; w <= 260; w++) history.push({ date: daysAgo(w * 7 + i), values: { currentValue: 1000 + w } });
      for (let f = 131; f <= 260; f++) history.push({ date: daysAgo(f * 14 + i), values: { currentValue: 1000 + f } });
      for (let m = 121; m <= 240; m++) history.push({ date: daysAgo(Math.round(m * 30.44) + i), values: { currentValue: 1000 + m } });
      history.sort((a, b) => a.date < b.date ? -1 : 1);
      store.state.placements.push(new TestPlacement({ id: `p${i}`, currentValue: 2000, asOf: daysAgo(0), history }));
    }

    const dates = collectChartDates(store.state.placements, daysAgo(0));
    const start = performance.now();
    const series = store.getValueSeries(dates);
    const elapsed = performance.now() - start;

    // ~2000 dates × 30 placements must stay comfortably synchronous.
    expect(elapsed).toBeLessThan(3000);
    expect(series).toHaveLength(dates.length);
    expect(series[series.length - 1].gross).toBe(30 * 2000);
  });

  it("getDataSeriesAt resolves the same states as getDataAt per date", () => {
    const store = makeAuthedStore();
    const placement = new TestPlacement({
      id: "p1",
      currentValue: 500,
      asOf: "2026-01-15",
      history: [
        { date: "2024-06-10", values: { currentValue: 100 } },
        { date: "2025-03-01", values: { currentValue: 300 } }
      ]
    });
    store.state.placements.push(placement);
    const dates = ["2024-01-01", "2024-06-10", "2024-09-30", "2025-12-31", "2026-01-20"];
    const batch = placement.getDataSeriesAt(dates);
    dates.forEach((d, i) => {
      expect(batch[i]?.asOf ?? null).toBe(placement.getDataAt(d)?.asOf ?? null);
      expect(batch[i]?.currentValue ?? null).toBe(placement.getDataAt(d)?.currentValue ?? null);
    });
    expect(batch[0]).toBeNull();
    expect(batch[3]!.currentValue).toBe(300);
    expect(batch[4]!.currentValue).toBe(500);
  });
});

describe("AppStore annotations", () => {
  it("upserts one annotation per date, sorted, and persists on export", () => {
    const store = makeStore();
    store.setAnnotation("2024-06-01", "  Don 150k€  ");
    store.setAnnotation("2023-01-15", "Achat maison");
    store.setAnnotation("2024-06-01", "Don 150k€ aux enfants");

    expect(store.state.annotations).toEqual([
      { date: "2023-01-15", text: "Achat maison" },
      { date: "2024-06-01", text: "Don 150k€ aux enfants" }
    ]);

    const payload = store.getExportPayload();
    expect(payload.annotations).toEqual(store.state.annotations);

    const reloaded = makeStore();
    reloaded._hydrateState(payload);
    expect(reloaded.state.annotations).toEqual(store.state.annotations);
  });

  it("removes an annotation and drops empty/blank entries", () => {
    const store = makeStore();
    store.setAnnotation("2024-06-01", "Note");
    store.removeAnnotation("2024-06-01");
    store.setAnnotation("2024-07-01", "   ");

    expect(store.state.annotations).toEqual([]);
    expect(store.getExportPayload().annotations).toBeUndefined();
  });

  it("tolerates malformed annotation entries on load", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.2",
      taxProfile: profile(40000),
      placements: [],
      annotations: [
        { date: "2024-01-01", text: "ok" },
        { text: "no date" } as never,
        { date: "2024-02-01", text: "  " }
      ]
    });
    expect(store.state.annotations).toEqual([{ date: "2024-01-01", text: "ok" }]);
  });
});
