/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { RealEstateModule } from "./module.js";
import type { RealEstateData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const NOW = new Date("2024-01-15");

const makeData = (over: Partial<RealEstateData> = {}): RealEstateData => ({
  id: "r1",
  primaryResidence: false,
  currentValue: 300000,
  acquisitionDate: "2015-06-01",
  acquisitionPrice: 200000,
  acquisitionFees: 15000,
  works: 20000,
  asOf: "2026-10-01",
  ...over
});

describe("RealEstateModule taxable income contract", () => {
  it("emits no income for a primary residence", () => {
    const p = new RealEstateModule(makeData({ primaryResidence: true }));
    expect(p.getTaxableIncomes(profile, NOW)).toEqual([]);
  });

  it("emits a 19% income on the net gain after the holding-period allowance", () => {
    const p = new RealEstateModule(makeData());
    // 8.6 years held → 8 full years → 3 years × 6% = 18% allowance on the
    // net gain (100 000 gross - 15 000 fees - 20 000 works = 65 000).
    const incomes = p.getTaxableIncomes(profile, NOW);
    expect(incomes).toHaveLength(1);
    expect(incomes[0].assietteImposition).toBeCloseTo(65000 * 0.82, 6);
    expect(incomes[0].tauxSpecifique).toBe(0.19);
  });

  it("emits the full net gain within the first 5 years (no allowance)", () => {
    const p = new RealEstateModule(makeData({ acquisitionDate: "2020-01-10" }));
    // 4 years held → 0% allowance: the full net gain is taxed.
    expect(p.getTaxableIncomes(profile, NOW)).toEqual([
      { assietteImposition: 65000, tauxSpecifique: 0.19 }
    ]);
  });

  it("emits no income once fully exempt (22+ years)", () => {
    const p = new RealEstateModule(makeData({ acquisitionDate: "2000-06-01" }));
    // 23.6 years held → 23 full years → allowance capped at 100%.
    expect(p.getTaxableIncomes(profile, NOW)).toEqual([]);
  });
});
