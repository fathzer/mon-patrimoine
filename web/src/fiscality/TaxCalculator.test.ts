/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { TaxCalculator } from "./TaxCalculator.js";

describe("TaxCalculator.computeFinalTax", () => {
  it("computes final tax for 29 700 € with 1.5 parts and 0.5 extra part capped at 1 079 €", () => {
    const result = TaxCalculator.computeFinalTax(29700, "single", 0.5, 1079);

    expect(result.finalTax).toBe(1068);
    expect(result.decote).toBe(285);
    expect(result.tmi).toBeCloseTo(0.11, 2);
    expect(result.extraPartsBenefit).toBeCloseTo(660.99, 2);
  });
});

describe("Test de l'exemple de l'explication fiscale", () => {
  it("computes final tax for 30 000 € with 1.5 parts and 0.5 extra part capped at 1 807 €", () => {
    const result = TaxCalculator.computeFinalTax(30000, "single", 0.5, 1807);

    expect(result.finalTax).toBe(1116);
    expect(result.decote).toBe(270);
    expect(result.tmi).toBeCloseTo(0.11, 2);
    expect(result.extraPartsBenefit).toBeCloseTo(717.99, 2);
  });
});

describe("TaxCalculator.computeFiscalMetrics", () => {
  it("reports the parents-only bracket as TMI when the extra-parts benefit is capped", () => {
    // Case L single with 106 980 € in 2024: the demi-part benefit is capped,
    // so the marginal euro falls in the 41% bracket of the 1-part schedule —
    // not in the 30% bracket of income/1.5 parts.
    const metrics = TaxCalculator.computeFiscalMetrics(
      { household: { maritalStatus: "single", caseL: true }, taxableIncome: 106980 },
      2024
    );

    expect(metrics.parts).toBe(1.5);
    expect(metrics.tmi).toBe(0.41);
  });

  it("keeps the total-parts bracket as TMI when the extra-parts benefit is below its ceiling", () => {
    const metrics = TaxCalculator.computeFiscalMetrics(
      { household: { maritalStatus: "single", childrenCount: 1 }, taxableIncome: 30000 },
      2024
    );

    expect(metrics.parts).toBe(1.5);
    // 30 000 / 1.5 = 20 000 → 11% bracket; the demi-part benefit (~762 €)
    // stays under the 1 791 € ceiling, so the marginal euro is taxed at 11%.
    expect(metrics.tmi).toBe(0.11);
  });
});
