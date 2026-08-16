import { describe, it, expect } from "bun:test";
import { TaxCalculator } from "../src/fiscality/TaxCalculator.js";

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
