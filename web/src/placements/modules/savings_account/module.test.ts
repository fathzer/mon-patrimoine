/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { SavingsAccountModule } from "./module.js";
import type { SavingsAccountData } from "./module.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";
import { Household } from "../../../fiscality/Household.js";

const profile: FiscalProfile = {
  household: new Household({ maritalStatus: 'single' }),
  taxableIncome: 40000,
  usePfu: true
};

const makeData = (over: Partial<SavingsAccountData> = {}): SavingsAccountData => ({
  id: "s1",
  currentValue: 1000,
  interestAmount: 20,
  promotionalInterest: 5,
  taxExempt: false,
  asOf: "2026-10-01",
  ...over
});

describe("SavingsAccount history", () => {
  it("exposes its evolving values (taxExempt stays absolute)", () => {
    const p = new SavingsAccountModule(makeData());
    expect(p.getEvolvingValues()).toEqual({
      currentValue: 1000,
      interestAmount: 20,
      promotionalInterest: 5
    });
  });

  it("reconstructs a past state via getDataAt", () => {
    const p = new SavingsAccountModule({
      ...makeData(),
      history: [
        { date: "2026-01-01", values: { currentValue: 800, interestAmount: 0, promotionalInterest: 0 } },
        { date: "2026-06-01", values: { currentValue: 900, interestAmount: 10, promotionalInterest: 2 } }
      ]
    });

    expect(p.getDataAt("2025-12-31")).toBeNull();
    expect(p.getDataAt("2026-03-01")).toMatchObject({
      currentValue: 800, interestAmount: 0, promotionalInterest: 0, asOf: "2026-01-01"
    });
    expect(p.getDataAt("2026-06-15")).toMatchObject({
      currentValue: 900, interestAmount: 10, promotionalInterest: 2, asOf: "2026-06-01"
    });
    // After the last history entry, the current state applies.
    expect(p.getDataAt("2026-10-11")).toMatchObject({
      currentValue: 1000, interestAmount: 20, promotionalInterest: 5, asOf: "2026-10-01"
    });
  });

  it("evaluates a reconstructed past state with that state's values", () => {
    const p = new SavingsAccountModule({
      ...makeData(),
      history: [
        { date: "2026-01-01", values: { currentValue: 800, interestAmount: 0, promotionalInterest: 0 } }
      ]
    });
    const past = new SavingsAccountModule(p.getDataAt("2026-02-01")!);

    const pastEval = past.getEvaluation(profile, new Date("2026-02-01"));
    expect(pastEval.grossValue).toBe(800);
    const currentEval = p.getEvaluation(profile, new Date("2026-10-01"));
    expect(currentEval.grossValue).toBe(1025);
  });

  it("pushes the previous state into history on recordState", () => {
    const previous = new SavingsAccountModule({ ...makeData({ currentValue: 900 }), asOf: "2026-06-01" });
    const next = new SavingsAccountModule(makeData());
    next.recordState(previous, "2026-10-01");

    expect(next.history).toEqual([
      { date: "2026-06-01", values: { currentValue: 900, interestAmount: 20, promotionalInterest: 5 } }
    ]);
    expect(next.asOf).toBe("2026-10-01");
  });

  it("does not grow history when only absolute fields change", () => {
    const previous = new SavingsAccountModule(makeData());
    const next = new SavingsAccountModule({ ...makeData(), label: "Livret A" });
    next.recordState(previous, "2026-10-01");

    expect(next.history).toEqual([]);
  });
});

describe("SavingsAccountModule taxable income contract", () => {
  it("emits a PFU-eligible income on total interest when not exempt", () => {
    const p = new SavingsAccountModule(makeData({ taxExempt: false }));
    // interestAmount 20 + promotionalInterest 5.
    expect(p.getTaxableIncomes(profile)).toEqual([
      { assietteImposition: 25, eligiblePfu: true, deductionRevenus: 25 }
    ]);
  });

  it("emits no income for an exempt account", () => {
    const p = new SavingsAccountModule(makeData({ taxExempt: true }));
    expect(p.getTaxableIncomes(profile)).toEqual([]);
  });
});
