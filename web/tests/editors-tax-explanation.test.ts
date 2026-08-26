import { describe, it, expect } from "bun:test";
import { CheckingAccountModule } from "../src/placements/modules/checking_account/module.js";
import { CtoModule } from "../src/placements/modules/cto/module.js";
import { HomeSavingsModule } from "../src/placements/modules/home_savings/module.js";
import { LifeInsuranceModule } from "../src/placements/modules/life_insurance/module.js";
import { PeaModule } from "../src/placements/modules/pea/module.js";
import { RealEstateModule } from "../src/placements/modules/real_estate/module.js";
import { SavingsAccountModule } from "../src/placements/modules/savings_account/module.js";
import { StockGrantModule } from "../src/placements/modules/stock_grant/module.js";
import type { BasePlacement, PlacementModuleStatic } from "../src/placements/BasePlacement.js";
import type { FiscalProfile } from "../src/fiscality/TaxCalculator.js";

const PROFILE: FiscalProfile = { usePfu: true, taxableIncome: 0, household: { maritalStatus: 'single', childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false } } as never;

interface ModuleCase {
  name: string;
  ModuleClass: PlacementModuleStatic;
  placement: BasePlacement;
}

const MODULE_CASES: ModuleCase[] = [
  { name: "CheckingAccountModule", ModuleClass: CheckingAccountModule, placement: new CheckingAccountModule({ label: 'Test', type: 'checking_account', currentValue: 1000 }) },
  { name: "CtoModule", ModuleClass: CtoModule, placement: new CtoModule({ label: 'Test', type: 'cto', currentValue: 20000, acquisitionValue: 15000, cashBalance: 1000 }) },
  { name: "HomeSavingsModule", ModuleClass: HomeSavingsModule, placement: new HomeSavingsModule({ label: 'Test', type: 'home_savings', currentValue: 5000, interestAmount: 100, homeSavingsType: 'pel', openingDate: '2020-01-01' }) },
  { name: "LifeInsuranceModule", ModuleClass: LifeInsuranceModule, placement: new LifeInsuranceModule({ label: 'Test', type: 'life_insurance', currentValue: 50000, totalPremiums: 40000, pre2017Premiums: 0, euroFundsValue: 45000, openingDate: '2020-01-01' }) },
  { name: "PeaModule", ModuleClass: PeaModule, placement: new PeaModule({ label: 'Test', type: 'pea', currentValue: 10000, totalDeposits: 8000, openingDate: '2020-01-01' }) },
  { name: "RealEstateModule", ModuleClass: RealEstateModule, placement: new RealEstateModule({ label: 'Test', type: 'real_estate', currentValue: 300000, acquisitionPrice: 250000, primaryResidence: false }) },
  { name: "SavingsAccountModule", ModuleClass: SavingsAccountModule, placement: new SavingsAccountModule({ label: 'Test', type: 'savings_account', currentValue: 1000, interestAmount: 50 }) },
  { name: "StockGrantModule", ModuleClass: StockGrantModule, placement: new StockGrantModule({ label: 'Test', type: 'stock_grant', stockName: 'Test', currentPrice: 100, attributions: [{ attributionDate: '2020-01-01', acquisitionDate: '2021-01-01', acquisitionPrice: 50, numberOfShares: 100 }] }) }
];

describe("getTaxExplanation", () => {
  for (const { name, ModuleClass, placement } of MODULE_CASES) {
    it(`${name} implements getTaxExplanation`, () => {
      expect(typeof ModuleClass.getTaxExplanation).toBe("function");
      const result = ModuleClass.getTaxExplanation(placement, PROFILE);
      expect(typeof result).toBe("string");
    });
  }
});
