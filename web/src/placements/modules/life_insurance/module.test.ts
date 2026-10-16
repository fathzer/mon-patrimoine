/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import {
  LifeInsuranceModule,
  PFU_BEFORE_8Y,
  PFU_AFTER_8Y_PRE_2017,
  PFU_AFTER_8Y_POST_2017_LOW,
  PFU_AFTER_8Y_POST_2017_HIGH
} from "./module.js";
import { Household, type MaritalStatus } from "../../../fiscality/Household.js";
import type { FiscalProfile } from "../../../fiscality/TaxCalculator.js";

const NOW = new Date("2024-01-01");

interface ProfileOptions {
  maritalStatus?: MaritalStatus;
  usePfu?: boolean;
  taxableIncome?: number;
  tmi?: number;
}

function makeProfile(options: ProfileOptions = {}): FiscalProfile {
  const maritalStatus = options.maritalStatus ?? 'single';
  const { maritalStatus: _ignored, tmi: _tmi, ...rest } = options;
  return {
    usePfu: true,
    taxableIncome: 29580,
    household: new Household({ maritalStatus, childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false }),
    ...rest
  };
}

describe("LifeInsuranceModule", () => {
  it("returns zero tax and charges when there is no latent gain", () => {
    const module = new LifeInsuranceModule({
      currentValue: 50000,
      totalPremiums: 60000,
      euroFundsValue: 0,
      openingDate: "2020-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    expect(evaluation.grossValue).toBe(50000);
    expect(evaluation.netValueBeforeIR).toBe(50000);
    expect(evaluation.socialCharges).toBe(0);
    expect(evaluation.latentGain).toBe(0);
    // No taxable income is emitted, so no tax can be computed.
    expect(module.getTaxableIncomes(makeProfile(), NOW)).toEqual([]);
  });

  it("computes social charges only on the unit-linked share", () => {
    const module = new LifeInsuranceModule({
      currentValue: 100000,
      totalPremiums: 80000,
      euroFundsValue: 60000,
      openingDate: "2020-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 20000;
    const ucShare = 0.4; // (100000 - 60000) / 100000
    expect(evaluation.latentGain).toBe(totalGain);
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * ucShare * 0.172, 2);
  });

  it("applies the PFU before 8 years", () => {
    const module = new LifeInsuranceModule({
      currentValue: 70000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2020-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 20000;
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
    // A single income flagged PFU at the pre-8-year rate.
    expect(module.getTaxableIncomes(makeProfile(), NOW)).toEqual([
      { assietteImposition: totalGain, eligiblePfu: true, tauxSpecifique: PFU_BEFORE_8Y }
    ]);
  });

  it("emits a barème income when PFU is not selected before 8 years", () => {
    const module = new LifeInsuranceModule({
      currentValue: 70000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2020-01-01"
    });

    const totalGain = 20000;
    expect(module.getSocialCharges()).toBeCloseTo(totalGain * 0.172, 2);
    // No eligiblePfu flag, no specific rate: the calculator applies the
    // progressive scale; the UC share (100% here) is CSG-deductible.
    expect(module.getTaxableIncomes(makeProfile({ usePfu: false }), NOW)).toEqual([
      { assietteImposition: totalGain, deductionRevenus: totalGain }
    ]);
  });

  it("exempts income tax when the gain is below the single allowance after 8 years", () => {
    const module = new LifeInsuranceModule({
      currentValue: 54000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 4000;
    expect(evaluation.latentGain).toBe(totalGain);
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
    // 4 000 € gain is under the 4 600 € single allowance: no income emitted.
    expect(module.getTaxableIncomes(makeProfile(), NOW)).toEqual([]);
  });

  it("emits the low post-8-year PFU tranche for post-2017 premiums", () => {
    const module = new LifeInsuranceModule({
      currentValue: 100000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 50000;
    const taxableGain = totalGain - 4600;
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
    expect(module.getTaxableIncomes(makeProfile(), NOW)).toEqual([
      { assietteImposition: taxableGain, tauxSpecifique: PFU_AFTER_8Y_POST_2017_LOW }
    ]);
  });

  it("splits post-2017 taxation between low and high PFU tranches when premiums exceed the threshold", () => {
    const module = new LifeInsuranceModule({
      currentValue: 300000,
      totalPremiums: 200000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 100000;
    const taxableGain = totalGain - 4600;
    const lowBase = taxableGain * 150000 / 200000;
    const incomes = module.getTaxableIncomes(makeProfile(), NOW);
    expect(incomes).toHaveLength(2);
    expect(incomes[0].assietteImposition).toBeCloseTo(lowBase, 2);
    expect(incomes[0].tauxSpecifique).toBe(PFU_AFTER_8Y_POST_2017_LOW);
    expect(incomes[1].assietteImposition).toBeCloseTo(taxableGain - lowBase, 2);
    expect(incomes[1].tauxSpecifique).toBe(PFU_AFTER_8Y_POST_2017_HIGH);
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
  });

  it("emits the favourable 7.5% tranche for the pre-2017 premium share", () => {
    const module = new LifeInsuranceModule({
      currentValue: 170000,
      totalPremiums: 100000,
      pre2017Premiums: 40000,
      euroFundsValue: 0,
      openingDate: "2015-01-01"
    });

    const taxableGain = 70000 - 4600;
    const incomes = module.getTaxableIncomes(makeProfile(), NOW);
    expect(incomes).toHaveLength(2);
    // pre-2017 share (40%) at the favourable rate, post-2017 rest at the low rate.
    expect(incomes[0].assietteImposition).toBeCloseTo(taxableGain * 0.4, 2);
    expect(incomes[0].tauxSpecifique).toBe(PFU_AFTER_8Y_PRE_2017);
    expect(incomes[1].assietteImposition).toBeCloseTo(taxableGain * 0.6, 2);
    expect(incomes[1].tauxSpecifique).toBe(PFU_AFTER_8Y_POST_2017_LOW);
  });

  it("emits a barème income after 8 years when PFU is not selected", () => {
    const module = new LifeInsuranceModule({
      currentValue: 100000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });

    const taxableGain = 50000 - 4600;
    // 100% UC share: the whole taxable gain is CSG-deductible.
    expect(module.getTaxableIncomes(makeProfile({ usePfu: false }), NOW)).toEqual([
      { assietteImposition: taxableGain, deductionRevenus: taxableGain }
    ]);
  });

  it("doubles the allowance for a couple", () => {
    const module = new LifeInsuranceModule({
      currentValue: 70000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });

    const taxableGain = 20000 - 9200;
    expect(module.getTaxableIncomes(makeProfile({ maritalStatus: "married" }), NOW)).toEqual([
      { assietteImposition: taxableGain, tauxSpecifique: PFU_AFTER_8Y_POST_2017_LOW }
    ]);
  });

  it("ignores pre-2017 premiums for contracts opened after the reform", () => {
    const module = new LifeInsuranceModule({
      currentValue: 60000,
      totalPremiums: 50000,
      pre2017Premiums: 10000,
      euroFundsValue: 0,
      openingDate: "2020-01-01"
    });

    expect(module.pre2017Premiums).toBe(0);
    // < 8 years: a single pre-8-year PFU income on the whole 10 000 € gain.
    expect(module.getTaxableIncomes(makeProfile(), NOW)).toEqual([
      { assietteImposition: 10000, eligiblePfu: true, tauxSpecifique: PFU_BEFORE_8Y }
    ]);
  });
});
