/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { CheckingAccountModule } from "./module.js";
import type { CheckingAccountData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<CheckingAccountData> = {}): CheckingAccountData => ({
  id: "c1",
  currentValue: 10000,
  cardBalance: 500,
  asOf: "2026-10-01",
  ...over
});

describe("CheckingAccountModule taxable income contract", () => {
  it("never emits taxable income (cash accounts are IR-exempt)", () => {
    const p = new CheckingAccountModule(makeData());
    expect(p.getTaxableIncomes(profile)).toEqual([]);
  });
});
