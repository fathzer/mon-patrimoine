/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { AppStore } from "./AppStore.js";
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

const today = (): string => new Date().toISOString().split('T')[0];

describe("AppStore tax profile history", () => {
  it("keeps an empty profile history for a 1.0 payload (no fabricated states)", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    // No history until the first change: the current profile implicitly
    // applies to every earlier date.
    expect(store.state.taxProfileHistory).toEqual([]);
    expect(store.state.taxProfileAsOf).toBe(today());
    expect(store.getTaxProfileAt("2015-06-01").taxableIncome).toBe(40000);
    const payload = store.getExportPayload();
    expect(payload.version).toBe("1.1");
    expect(payload.taxProfile).toEqual({ profile: profile(40000), asOf: today() });
  });

  it("hydrates and normalizes a provided profile history", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.1",
      taxProfile: {
        profile: profile(80000, true),
        asOf: "2024-06-01",
        history: [
          { date: "2020-01-01", profile: profile(50000) },
          { date: "1970-01-01", profile: profile(30000) }
        ]
      },
      placements: []
    });

    expect(store.state.taxProfileHistory.map(e => e.date)).toEqual(["1970-01-01", "2020-01-01"]);
    expect(store.state.taxProfileHistory[0].profile.household).toBeInstanceOf(Household);
  });

  it("resolves the profile effective at a date, current profile included", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.1",
      taxProfile: {
        profile: profile(50000),
        asOf: "2030-01-01",
        history: [
          { date: "1970-01-01", profile: profile(30000) },
          { date: "2020-01-01", profile: profile(40000) }
        ]
      },
      placements: []
    });

    expect(store.getTaxProfileAt("1960-01-01").taxableIncome).toBe(30000);
    expect(store.getTaxProfileAt("2019-12-31").taxableIncome).toBe(30000);
    expect(store.getTaxProfileAt("2020-01-01").taxableIncome).toBe(40000);
    expect(store.getTaxProfileAt("2029-12-31").taxableIncome).toBe(40000);
    expect(store.getTaxProfileAt("2030-01-01").taxableIncome).toBe(50000);
    expect(store.getTaxProfileAt("2040-01-01").taxableIncome).toBe(50000);
  });

  it("pushes the previous profile into history when it changes", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    store.updateTaxProfile(profile(50000, true), "2030-01-01");

    expect(store.state.taxProfile.taxableIncome).toBe(50000);
    expect(store.state.taxProfileAsOf).toBe("2030-01-01");
    expect(store.getTaxProfileAt("2029-12-31").taxableIncome).toBe(40000);
    expect(store.getTaxProfileAt("2030-01-01").taxableIncome).toBe(50000);
  });

  it("records a retroactive profile change as a history entry without touching the current profile", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    store.updateTaxProfile(profile(45000), "2000-06-01");

    expect(store.state.taxProfile.taxableIncome).toBe(40000);
    // The earliest recorded profile extends to every earlier date.
    expect(store.getTaxProfileAt("1999-12-31").taxableIncome).toBe(45000);
    expect(store.getTaxProfileAt("2000-06-01").taxableIncome).toBe(45000);
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

    store.deleteHistoryEntry("p1", "2024-01-01");
    expect(p.hasHistoryEntry("2024-01-01")).toBe(false);
    // With the only past entry gone, dates before asOf resolve to no state.
    expect(p.getDataAt("2024-06-01")).toBeNull();
  });
});
