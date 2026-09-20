import { describe, it, expect, beforeAll } from "bun:test";
import { Openfisca, type OpenfiscaResult } from "../../tests/Openfisca.js";
import { TaxCalculator } from "./TaxCalculator.js";
import { Household } from "./Household.js";

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
  },
  {
    name: "single with case L (raised a child alone) and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 0,
      isSingleParent: false,
      caseL: true
    }),
    rni: 150000
  },
  {
    name: "single with case L ignored when children are dependent and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      isSingleParent: false,
      caseL: true
    }),
    rni: 150000
  },
  {
    name: "widowed without children and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 0,
      alternateChildrenCount: 0
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 exclusive child and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 0
    }),
    rni: 150000
  },
  {
    name: "widowed with 2 children (1 alternate) and 100 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 1
    }),
    rni: 100000
  },
  {
    name: "widowed with case L (raised a child alone) and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseL: true
    }),
    rni: 150000
  },
  {
    name: "single with case P (invalidity) and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "single with case W (veteran) and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseW: true
    }),
    rni: 150000
  },
  {
    name: "single with case P, 1 child and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "single with case W, 1 child and 150 000 € (veteran grants no part but the reduction)",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseW: true
    }),
    rni: 150000
  },
  {
    name: "single with case P, 1 alternate-custody child and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 1,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "single parent with case T, case P, 1 child and 150 000 €",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      isSingleParent: true,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "single with cases L and P and 150 000 € (half parts do not cumulate, case L ceiling applies)",
    household: new Household({
      maritalStatus: "single",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseL: true,
      caseP: true
    }),
    rni: 150000
  },

  {
    name: "married with case P and 150 000 €",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "married with cases P and F and 150 000 €",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseP: true,
      caseF: true
    }),
    rni: 150000
  },
  {
    name: "married with cases P and F and 500 000 € (double reduction)",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseP: true,
      caseF: true
    }),
    rni: 500000
  },
  {
    name: "married with cases W and S and 150 000 € (veteran cases do not cumulate)",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseW: true,
      caseS: true
    }),
    rni: 150000
  },
  {
    name: "married with cases P and W and 150 000 € (same person, no cumulation)",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseP: true,
      caseW: true
    }),
    rni: 150000
  },
  {
    name: "married with cases P and F, 2 children and 200 000 €",
    household: new Household({
      maritalStatus: "married",
      childrenCount: 2,
      alternateChildrenCount: 0,
      caseP: true,
      caseF: true
    }),
    rni: 200000
  },
  {
    name: "widowed with case G (war-widow pension) and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 0,
      alternateChildrenCount: 0,
      caseG: true
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 child, case P and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseP: true
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 child, case G and 150 000 € (no part but the reduction)",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseG: true
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 child, case W and 150 000 € (no part but the reduction)",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseW: true
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 child, cases P and G and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 1,
      alternateChildrenCount: 0,
      caseP: true,
      caseG: true
    }),
    rni: 150000
  },
  {
    name: "widowed with 1 alternate-custody child, case P and 150 000 €",
    household: new Household({
      maritalStatus: "widowed",
      childrenCount: 0,
      alternateChildrenCount: 1,
      caseP: true
    }),
    rni: 150000
  }
];

let openfiscaResults: OpenfiscaResult[];

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
