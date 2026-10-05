/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { AppStore } from "./AppStore.js";
import { Household } from "../fiscality/Household.js";
import type { StorageManager } from "../storage/StorageManager.js";
import type { FiscalProfile } from "../fiscality/TaxCalculator.js";

const stubStorage = {
  save: async () => true
} as unknown as StorageManager;

const profile = (taxableIncome: number, married = false): FiscalProfile => ({
  household: new Household({ maritalStatus: married ? 'married' : 'single' }),
  taxableIncome,
  usePfu: true
});

const makeStore = (): AppStore => new AppStore(stubStorage);

const today = (): string => new Date().toISOString().split('T')[0];

describe("AppStore tax profile history", () => {
  it("migrates a 1.0 payload by seeding the profile history at 1970-01-01", () => {
    const store = makeStore();
    store._hydrateState({ version: "1.0", taxProfile: profile(40000), placements: [] });

    expect(store.state.taxProfileHistory).toHaveLength(1);
    expect(store.state.taxProfileHistory[0].date).toBe("1970-01-01");
    expect(store.state.taxProfileHistory[0].profile.taxableIncome).toBe(40000);
    expect(store.state.taxProfileAsOf).toBe(today());
    expect(store.getExportPayload().version).toBe("1.1");
  });

  it("hydrates and normalizes a provided profile history", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.1",
      taxProfile: profile(80000, true),
      taxProfileAsOf: "2024-06-01",
      taxProfileHistory: [
        { date: "2020-01-01", profile: profile(50000) },
        { date: "1970-01-01", profile: profile(30000) }
      ],
      placements: []
    });

    expect(store.state.taxProfileHistory.map(e => e.date)).toEqual(["1970-01-01", "2020-01-01"]);
    expect(store.state.taxProfileHistory[0].profile.household).toBeInstanceOf(Household);
  });

  it("resolves the profile effective at a date, current profile included", () => {
    const store = makeStore();
    store._hydrateState({
      version: "1.1",
      taxProfile: profile(50000),
      taxProfileAsOf: "2030-01-01",
      taxProfileHistory: [
        { date: "1970-01-01", profile: profile(30000) },
        { date: "2020-01-01", profile: profile(40000) }
      ],
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
    expect(store.getTaxProfileAt("1999-12-31").taxableIncome).toBe(40000);
    expect(store.getTaxProfileAt("2000-06-01").taxableIncome).toBe(45000);
  });
});
