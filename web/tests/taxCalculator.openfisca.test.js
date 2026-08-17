import { describe, it, expect, beforeAll } from "bun:test";
import { Openfisca } from "./Openfisca.js";
import { TaxCalculator } from "../src/fiscality/TaxCalculator.js";
import { Household } from "../src/fiscality/Household.js";

const year = new Date().getFullYear();

const cases = [
  {
    name: "couple with 3 children and 200 000 €",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 3,
      alternateChildrenCount: 0,
      isSingleParent: false
    }),
    rni: 200000
  },
  {
    name: "single with 3 alternate-custody children and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 3,
      isSingleParent: false
    }),
    rni: 150000
  },
  {
    name: "single parent with 1 exclusive child and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      isSingleParent: true
    }),
    rni: 150000
  },
  {
    name: "single parent with 1 alternate-custody child and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 1,
      isSingleParent: true
    }),
    rni: 150000
  },
  {
    name: "single parent with 6 children (3 alternate) and 200 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 3,
      alternateChildrenCount: 3,
      isSingleParent: true
    }),
    rni: 200000
  }
];

let openfiscaResults;

describe("TaxCalculator vs OpenFisca", () => {
  beforeAll(async () => {
    openfiscaResults = await Openfisca.batch(
      cases.map(({ household, rni }) => ({ household, rni, year }))
    );
  });

  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i];
    it(`matches for ${c.name}`, () => {
      const openfisca = openfiscaResults[i];
      const tax = TaxCalculator.calculate(c.household, c.rni, year);
      const metrics = TaxCalculator.computeFiscalMetrics({
        household: c.household,
        taxableIncome: c.rni
      });

      console.log(c.name, { openfisca, tax, parts: metrics.parts });

      expect(metrics.parts).toBeCloseTo(openfisca.nbptr, 4);
      expect(tax.tmi).toBeCloseTo(openfisca.tmi, 4);
      expect(Math.abs(tax.finalTax - Math.abs(openfisca.impot))).toBeLessThan(100);
      expect(tax.decote).toBeCloseTo(openfisca.decote, 0);
      expect(tax.extraPartsBenefit).toBeCloseTo(openfisca.avantageQf, 0);
    });
  }
});
