import { describe, it, expect } from 'bun:test';
import { PerModule } from './module.js';
import type { FiscalProfile } from '../../../fiscality/TaxCalculator.js';

const PROFILE_PFU: FiscalProfile = {
  usePfu: true,
  taxableIncome: 20000,
  household: { maritalStatus: 'single', childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false } as never
};

const PROFILE_BAREME: FiscalProfile = {
  usePfu: false,
  taxableIncome: 20000,
  household: { maritalStatus: 'single', childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false } as never
};

const SOCIAL_RATE = 0.186;
const PFU_RATE = 0.128;

describe('PerModule - gain allocation', () => {
  it('uses explicitly entered gains when all are provided', () => {
    const per = new PerModule({
      type: 'per', grossValue: 3000,
      deducted: { contributions: 500, gain: 500 },
      nonDeducted: { contributions: 500, gain: 500 },
      employeeSavings: { contributions: 500, gain: 500 }
    });
    const c = per.getComputedCompartments();
    expect(c.deducted.gain).toBe(500);
    expect(c.non_deducted.gain).toBe(500);
    expect(c.employee_savings.gain).toBe(500);
    expect(c.deducted.gainEntered).toBe(true);
    expect(c.non_deducted.gainEntered).toBe(true);
    expect(c.employee_savings.gainEntered).toBe(true);
  });

  it('distributes missing gain proportionally to contributions (user example)', () => {
    // User example: grossValue 3000, employee_savings 500 contrib + 500 gain,
    // deducted 500 contrib (no gain), non_deducted 500 contrib (no gain).
    // Missing gain = 1500 - 500 = 1000, split 500/500.
    const per = new PerModule({
      type: 'per', grossValue: 3000,
      deducted: { contributions: 500 },
      nonDeducted: { contributions: 500 },
      employeeSavings: { contributions: 500, gain: 500 }
    });
    const c = per.getComputedCompartments();
    expect(c.deducted.gain).toBe(500);
    expect(c.non_deducted.gain).toBe(500);
    expect(c.employee_savings.gain).toBe(500);
    expect(c.deducted.gainEntered).toBe(false);
    expect(c.non_deducted.gainEntered).toBe(false);
    expect(c.employee_savings.gainEntered).toBe(true);
  });

  it('distributes proportionally when contributions differ', () => {
    // grossValue 5000, deducted 1000 contrib, non_deducted 3000 contrib, employee_savings 0 contrib.
    // totalContrib = 4000, totalGain = 1000, no gains entered.
    // Missing gain = 1000, split: deducted 250, non_deducted 750.
    const per = new PerModule({
      type: 'per', grossValue: 5000,
      deducted: { contributions: 1000 },
      nonDeducted: { contributions: 3000 },
      employeeSavings: { contributions: 0 }
    });
    const c = per.getComputedCompartments();
    expect(c.deducted.gain).toBe(250);
    expect(c.non_deducted.gain).toBe(750);
    expect(c.employee_savings.gain).toBe(0);
  });

  it('assigns zero gain to missing compartments with zero contributions', () => {
    const per = new PerModule({
      type: 'per', grossValue: 2000,
      deducted: { contributions: 1000, gain: 500 },
      nonDeducted: { contributions: 500 },
      employeeSavings: { contributions: 0 }
    });
    const c = per.getComputedCompartments();
    // totalContrib = 1500, totalGain = 500, knownGains = 500, missing = 0
    expect(c.deducted.gain).toBe(500);
    expect(c.non_deducted.gain).toBe(0);
    expect(c.employee_savings.gain).toBe(0);
  });

  it('clamps total gain to zero when grossValue < totalContributions', () => {
    const per = new PerModule({
      type: 'per', grossValue: 1000,
      deducted: { contributions: 500 },
      nonDeducted: { contributions: 500 },
      employeeSavings: { contributions: 500 }
    });
    const c = per.getComputedCompartments();
    expect(c.deducted.gain).toBe(0);
    expect(c.non_deducted.gain).toBe(0);
    expect(c.employee_savings.gain).toBe(0);
    expect(per.getLatentGain()).toBe(0);
  });
});

describe('PerModule - social charges', () => {
  it('computes social charges on total gains at 18.6%', () => {
    const per = new PerModule({
      type: 'per', grossValue: 4000,
      deducted: { contributions: 1000, gain: 500 },
      nonDeducted: { contributions: 1000, gain: 500 },
      employeeSavings: { contributions: 1000, gain: 500 }
    });
    expect(per.getSocialCharges()).toBe(1500 * SOCIAL_RATE);
  });

  it('derives social charges from known net value when provided', () => {
    const per = new PerModule({
      type: 'per', grossValue: 10000, netValue: 9000, knowsNetValue: true,
      deducted: { contributions: 3000, gain: 500 },
      nonDeducted: { contributions: 2000, gain: 500 },
      employeeSavings: { contributions: 1000, gain: 500 }
    });
    expect(per.getSocialCharges()).toBe(1000);
  });
});

describe('PerModule - income tax', () => {
  it('taxes deducted capital at barème (progressive) and gains at PFU', () => {
    const per = new PerModule({
      type: 'per', grossValue: 5000,
      deducted: { contributions: 3000, gain: 1000 },
      nonDeducted: { contributions: 500, gain: 500 },
      employeeSavings: { contributions: 0, gain: 0 }
    });
    // With PFU: deducted capital (3000) at barème, gains (1000 + 500) at PFU 12.8%.
    const evalPfu = per.getEvaluation(PROFILE_PFU);
    // PFU on gains: 1500 * 0.128 = 192
    // Barème on 3000 capital with 0 taxable income: 3000 at 11% = 330
    expect(evalPfu.imposition).toBe(192 + 330);
  });

  it('exempts non-deducted capital from income tax', () => {
    const per = new PerModule({
      type: 'per', grossValue: 5000,
      deducted: { contributions: 0 },
      nonDeducted: { contributions: 3000, gain: 1000 },
      employeeSavings: { contributions: 1000, gain: 0 }
    });
    const incomes = per.getTaxableIncomes(PROFILE_PFU);
    // Only the non-deducted gain should appear, not the capital.
    expect(incomes).toHaveLength(1);
    expect(incomes[0].assietteImposition).toBe(1000);
    expect(incomes[0].eligiblePfu).toBe(true);
  });

  it('exempts employee savings from income tax entirely', () => {
    const per = new PerModule({
      type: 'per', grossValue: 3000,
      deducted: { contributions: 0 },
      nonDeducted: { contributions: 0 },
      employeeSavings: { contributions: 2000, gain: 1000 }
    });
    const incomes = per.getTaxableIncomes(PROFILE_PFU);
    expect(incomes).toHaveLength(0);
    expect(per.getEvaluation(PROFILE_PFU).imposition).toBe(0);
  });

  it('taxes gains at barème when PFU is not selected', () => {
    const per = new PerModule({
      type: 'per', grossValue: 2000,
      deducted: { contributions: 0, gain: 1000 },
      nonDeducted: { contributions: 0, gain: 500 },
      employeeSavings: { contributions: 500, gain: 0 }
    });
    // Without PFU: PFU-eligible gains go to barème at full base (no CSG deduction).
    // modifiedRni = 20000 + 1000 + 500 = 21500
    // Tax on 21500 (1 part): (21500 - 11600) * 0.11 = 1089
    // Tax on 20000 (1 part): (20000 - 11600) * 0.11 = 924
    // Delta = 1089 - 924 = 165
    const evalBareme = per.getEvaluation(PROFILE_BAREME);
    expect(evalBareme.imposition).toBeCloseTo(165, 2);
  });
});

describe('PerModule - evaluation', () => {
  it('computes netValueBeforeIR as grossValue minus social charges', () => {
    const per = new PerModule({
      type: 'per', grossValue: 5000,
      deducted: { contributions: 1000, gain: 1000 },
      nonDeducted: { contributions: 1000, gain: 1000 },
      employeeSavings: { contributions: 1000, gain: 0 }
    });
    const evaluation = per.getEvaluation(PROFILE_PFU);
    const expectedSocial = 2000 * SOCIAL_RATE;
    expect(evaluation.grossValue).toBe(5000);
    expect(evaluation.socialCharges).toBeCloseTo(expectedSocial, 2);
    expect(evaluation.netValueBeforeIR).toBeCloseTo(5000 - expectedSocial, 2);
    expect(evaluation.latentGain).toBe(2000);
  });

  it('uses known net value as netValueBeforeIR', () => {
    const per = new PerModule({
      type: 'per', grossValue: 10000, netValue: 9000, knowsNetValue: true,
      deducted: { contributions: 3000, gain: 500 },
      nonDeducted: { contributions: 2000, gain: 500 },
      employeeSavings: { contributions: 1000, gain: 500 }
    });
    const evaluation = per.getEvaluation(PROFILE_PFU);
    expect(evaluation.socialCharges).toBe(1000);
    expect(evaluation.netValueBeforeIR).toBe(9000);
  });

  it('computes netValue as netValueBeforeIR minus imposition', () => {
    const per = new PerModule({
      type: 'per', grossValue: 2000,
      deducted: { contributions: 0, gain: 1000 },
      nonDeducted: { contributions: 0, gain: 500 },
      employeeSavings: { contributions: 500, gain: 0 }
    });
    const evaluation = per.getEvaluation(PROFILE_PFU);
    expect(evaluation.netValue).toBeCloseTo(evaluation.netValueBeforeIR - evaluation.imposition, 2);
  });
});

describe('PerModule - serialization', () => {
  it('round-trips through toJSON and constructor', () => {
    const original = new PerModule({
      type: 'per', label: 'My PER', institution: 'AXA',
      grossValue: 10000,
      deducted: { contributions: 3000, gain: 500 },
      nonDeducted: { contributions: 2000 },
      employeeSavings: { contributions: 1000, gain: 300 }
    });
    const json = original.toJSON();
    expect(json.type).toBe('per');
    expect(json.label).toBe('My PER');
    expect(json.institution).toBe('AXA');
    expect(json.grossValue).toBe(10000);
    expect(json.deducted).toEqual({ contributions: 3000, gain: 500 });
    expect(json.nonDeducted).toEqual({ contributions: 2000, gain: undefined });
    expect(json.employeeSavings).toEqual({ contributions: 1000, gain: 300 });

    const restored = new PerModule(json);
    expect(restored.grossValue).toBe(10000);
    expect(restored.deducted).toEqual({ contributions: 3000, gain: 500 });
    expect(restored.nonDeducted).toEqual({ contributions: 2000, gain: undefined });
    expect(restored.employeeSavings).toEqual({ contributions: 1000, gain: 300 });
    expect(restored.getLatentGain()).toBe(original.getLatentGain());
  });

  it('preserves undefined gain through serialization', () => {
    const per = new PerModule({
      type: 'per', grossValue: 5000,
      deducted: { contributions: 2000 },
      nonDeducted: { contributions: 1000 },
      employeeSavings: { contributions: 500, gain: 500 }
    });
    const json = per.toJSON();
    expect(json.deducted!.gain).toBeUndefined();
    expect(json.nonDeducted!.gain).toBeUndefined();
    expect(json.employeeSavings!.gain).toBe(500);

    const restored = new PerModule(json);
    const c = restored.getComputedCompartments();
    // Should allocate missing gains proportionally.
    expect(c.deducted.gainEntered).toBe(false);
    expect(c.non_deducted.gainEntered).toBe(false);
    expect(c.employee_savings.gainEntered).toBe(true);
  });
});

describe('PerModule - static contract', () => {
  it('returns Category.INVESTMENTS', () => {
    expect(PerModule.getCategory()).toBe('investments');
  });

  it('returns a label', () => {
    expect(PerModule.getLabel()).toBe('PER / PERECO');
  });

  it('exposes an editor class', () => {
    expect(typeof PerModule.getEditorClass).toBe('function');
  });

  it('exposes a tax explanation function', () => {
    expect(typeof PerModule.getTaxExplanation).toBe('function');
  });
});
