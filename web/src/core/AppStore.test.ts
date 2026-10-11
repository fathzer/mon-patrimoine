/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { AppStore } from "./AppStore.js";
import { Household } from "../fiscality/Household.js";
import { BasePlacement } from "../placements/BasePlacement.js";
import { Category } from "./Categories.js";
import type { PlacementData, Evaluation } from "../placements/BasePlacement.js";
import type { StorageManager } from "../storage/StorageManager.js";
import type { FiscalProfile, PlacementIncome } from "../fiscality/TaxCalculator.js";

const stubStorage = {
  save: async () => true
} as unknown as StorageManager;

interface TestData extends PlacementData {
  currentValue?: number;
}

class TestPlacement extends BasePlacement {
  static getCategory() {
    return Category.INVESTMENTS;
  }

  currentValue: number;

  constructor(data: TestData) {
    super({ ...data, type: 'test' });
    this.currentValue = Number(data.currentValue) || 0;
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

  protected getTaxableIncomes(): PlacementIncome[] {
    return [];
  }
}

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
});
