/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { PeaModule } from "./module.js";
import type { PeaData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<PeaData> = {}): PeaData => ({
  id: "p1",
  totalDeposits: 50000,
  currentValue: 80000,
  openingDate: "2015-01-01",
  asOf: "2026-10-01",
  ...over
});

describe("PeaModule taxable income contract", () => {
  it("emits a PFU-eligible income on the latent gain before 5 years", () => {
    const p = new PeaModule(makeData({ openingDate: "2020-06-01" }));
    // 4 years old on 2024-06-01: the 30 000 € latent gain is taxable.
    expect(p.getTaxableIncomes(profile, new Date("2024-06-01"))).toEqual([
      { assietteImposition: 30000, eligiblePfu: true, deductionRevenus: 30000 }
    ]);
  });

  it("emits no income once the plan is 5 years old", () => {
    const p = new PeaModule(makeData());
    // Opened 2015: exempt at any recent evaluation date.
    expect(p.getTaxableIncomes(profile, new Date("2024-01-01"))).toEqual([]);
  });

  it("flips to exempt exactly at the 5-year anniversary", () => {
    const p = new PeaModule(makeData({ openingDate: "2020-01-15" }));
    expect(p.getTaxableIncomes(profile, new Date("2025-01-14"))).toHaveLength(1);
    expect(p.getTaxableIncomes(profile, new Date("2025-01-15"))).toEqual([]);
  });

  it("emits no income without a latent gain", () => {
    const p = new PeaModule(makeData({ openingDate: "2020-06-01", currentValue: 40000 }));
    expect(p.getTaxableIncomes(profile, new Date("2024-06-01"))).toEqual([]);
  });
});
