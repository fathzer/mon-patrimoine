import { describe, it, expect } from "bun:test";
import { LifeInsuranceModule } from "../src/placements/modules/life_insurance/module.js";

const NOW = new Date("2024-01-01");

function makeProfile(options = {}) {
  const maritalStatus = options.maritalStatus ?? 'single';
  const { maritalStatus: _, tmi, ...rest } = options;
  return {
    usePfu: true,
    taxableIncome: 29580,
    household: { maritalStatus, childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false },
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
    expect(evaluation.imposition).toBe(0);
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
    expect(evaluation.imposition).toBeCloseTo(totalGain * 0.128, 2);
  });

  it("uses the marginal tax rate when PFU is not selected before 8 years", () => {
    const module = new LifeInsuranceModule({
      currentValue: 70000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2020-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile({ usePfu: false }), NOW);

    const totalGain = 20000;
    const deduction = totalGain * 0.068; // deductible CSG fraction on the UC gain
    const expectedTax = (totalGain - deduction) * 0.30;
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
    expect(evaluation.imposition).toBeCloseTo(expectedTax, 2);
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
    expect(evaluation.imposition).toBe(0);
  });

  it("applies the low post-8-year PFU rate for post-2017 premiums", () => {
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
    expect(evaluation.imposition).toBeCloseTo(taxableGain * 0.075, 2);
  });

  it("splits post-2017 taxation between low and high PFU rates when premiums exceed the threshold", () => {
    const module = new LifeInsuranceModule({
      currentValue: 300000,
      totalPremiums: 200000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 100000;
    const taxableGain = totalGain - 4600;
    const firstFraction = 150000 / 200000; // 0.75
    const postGainFirst = taxableGain * firstFraction;
    const postGainRest = taxableGain - postGainFirst;
    const expectedTax = postGainFirst * 0.075 + postGainRest * 0.128;
    expect(evaluation.imposition).toBeCloseTo(expectedTax, 2);
    expect(evaluation.socialCharges).toBeCloseTo(totalGain * 0.172, 2);
  });

  it("applies the favourable 7.5% rate to pre-2017 premium share", () => {
    const module = new LifeInsuranceModule({
      currentValue: 170000,
      totalPremiums: 100000,
      pre2017Premiums: 40000,
      euroFundsValue: 0,
      openingDate: "2015-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile(), NOW);

    const totalGain = 70000;
    const taxableGain = totalGain - 4600;
    const preShare = 0.4;
    const postShare = 0.6;
    const preTaxable = taxableGain * preShare;
    const postTaxable = taxableGain * postShare;
    const expectedTax = preTaxable * 0.075 + postTaxable * 0.075;
    expect(evaluation.imposition).toBeCloseTo(expectedTax, 2);
  });

  it("uses the marginal tax rate after 8 years when PFU is not selected", () => {
    const module = new LifeInsuranceModule({
      currentValue: 100000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile({ usePfu: false }), NOW);

    const totalGain = 50000;
    const taxableGain = totalGain - 4600;
    const deduction = taxableGain * 0.068;
    const expectedTax = (taxableGain - deduction) * 0.30;
    expect(evaluation.imposition).toBeCloseTo(expectedTax, 2);
  });

  it("doubles the allowance for a couple", () => {
    const module = new LifeInsuranceModule({
      currentValue: 70000,
      totalPremiums: 50000,
      euroFundsValue: 0,
      openingDate: "2010-01-01"
    });
    const evaluation = module.getEvaluation(makeProfile({ maritalStatus: "married" }), NOW);

    const totalGain = 20000;
    const taxableGain = totalGain - 9200;
    expect(evaluation.imposition).toBeCloseTo(taxableGain * 0.075, 2);
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
    const evaluation = module.getEvaluation(makeProfile(), NOW);
    expect(evaluation.imposition).toBeCloseTo(10000 * 0.128, 2);
  });
});
