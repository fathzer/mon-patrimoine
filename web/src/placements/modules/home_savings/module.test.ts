/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { HomeSavingsModule } from "./module.js";
import type { HomeSavingsData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<HomeSavingsData> = {}): HomeSavingsData => ({
  id: "h1",
  homeSavingsType: "pel",
  openingDate: "2010-01-01",
  currentValue: 50000,
  interestAmount: 3000,
  asOf: "2026-10-01",
  ...over
});

describe("HomeSavingsModule taxable income contract", () => {
  it("emits no income for a pre-2018 PEL within its first 12 years", () => {
    const p = new HomeSavingsModule(makeData());
    // Opened 2010, evaluated in 2020: exempt from income tax.
    expect(p.getTaxableIncomes(profile, new Date("2020-06-01"))).toEqual([]);
  });

  it("emits a PFU-eligible income on interest for a pre-2018 PEL older than 12 years", () => {
    const p = new HomeSavingsModule(makeData());
    // Past its 12th anniversary (2022-01-01): interest becomes taxable.
    expect(p.getTaxableIncomes(profile, new Date("2023-06-01"))).toEqual([
      { assietteImposition: 3000, eligiblePfu: true, deductionRevenus: 3000 }
    ]);
  });

  it("never emits income for a pre-2018 CEL, whatever its age", () => {
    const p = new HomeSavingsModule(makeData({ homeSavingsType: "cel" }));
    expect(p.getTaxableIncomes(profile, new Date("2023-06-01"))).toEqual([]);
  });

  it("emits a PFU-eligible income for a post-2018 plan", () => {
    const p = new HomeSavingsModule(makeData({ openingDate: "2020-01-01" }));
    expect(p.getTaxableIncomes(profile, new Date("2021-06-01"))).toEqual([
      { assietteImposition: 3000, eligiblePfu: true, deductionRevenus: 3000 }
    ]);
  });
});
