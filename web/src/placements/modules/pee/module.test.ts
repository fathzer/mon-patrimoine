/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { PeeModule } from "./module.js";
import type { PeeData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<PeeData> = {}): PeeData => ({
  id: "e1",
  totalDeposits: 20000,
  currentValue: 35000,
  asOf: "2026-10-01",
  ...over
});

describe("PeeModule taxable income contract", () => {
  it("never emits taxable income (capital and gains are IR-exempt)", () => {
    const p = new PeeModule(makeData());
    expect(p.getTaxableIncomes(profile)).toEqual([]);
  });
});
