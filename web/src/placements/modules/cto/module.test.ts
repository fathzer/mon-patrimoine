/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { CtoModule } from "./module.js";
import type { CtoData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<CtoData> = {}): CtoData => ({
  id: "c1",
  acquisitionValue: 40000,
  cashBalance: 300,
  currentValue: 51000,
  asOf: "2026-10-01",
  ...over
});

describe("Cto history", () => {
  it("exposes its evolving values", () => {
    const p = new CtoModule(makeData());
    expect(p.getEvolvingValues()).toEqual({
      acquisitionValue: 40000,
      cashBalance: 300,
      currentValue: 51000
    });
  });

  it("reconstructs a past state via getDataAt and evaluates it", () => {
    const p = new CtoModule({
      ...makeData(),
      history: [
        { date: "2026-01-01", values: { acquisitionValue: 38000, cashBalance: 300, currentValue: 42000 } }
      ]
    });

    expect(p.getDataAt("2025-12-31")).toBeNull();
    const pastData = p.getDataAt("2026-02-01")!;
    expect(pastData).toMatchObject({
      acquisitionValue: 38000, cashBalance: 300, currentValue: 42000, asOf: "2026-01-01"
    });

    const past = new CtoModule(pastData);
    expect(past.getLatentGain()).toBe(3700);
    expect(p.getLatentGain()).toBe(10700);
  });

  it("records the previous state in history when evolving values change", () => {
    const previous = new CtoModule({ ...makeData({ currentValue: 48000 }), asOf: "2026-06-01" });
    const next = new CtoModule(makeData());
    next.recordState(previous, "2026-10-01");

    expect(next.history).toEqual([
      { date: "2026-06-01", values: { acquisitionValue: 40000, cashBalance: 300, currentValue: 48000 } }
    ]);
  });

  it("supports a retroactive correction without touching the current state", () => {
    const p = new CtoModule(makeData());
    p.insertHistoryEntry("2025-06-01", { acquisitionValue: 39000, cashBalance: 300, currentValue: 47800 });

    expect(p.currentValue).toBe(51000);
    expect(p.getDataAt("2025-06-15")).toMatchObject({ currentValue: 47800, asOf: "2025-06-01" });
    expect(p.getEvaluation(profile, new Date("2026-10-01")).grossValue).toBe(51000);
  });
});

describe("CtoModule taxable income contract", () => {
  it("emits a PFU-eligible income on the latent gain", () => {
    const p = new CtoModule(makeData());
    // Latent gain = 51 000 - 40 000 - 300 = 10 700 €.
    expect(p.getTaxableIncomes(profile)).toEqual([
      { assietteImposition: 10700, eligiblePfu: true, deductionRevenus: 10700 }
    ]);
  });

  it("emits no income without a latent gain", () => {
    const p = new CtoModule(makeData({ currentValue: 39000 }));
    expect(p.getTaxableIncomes(profile)).toEqual([]);
  });
});
