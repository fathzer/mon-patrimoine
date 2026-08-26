import { describe, it, expect } from "bun:test";
import { CheckingAccountEditor } from "../src/placements/modules/checking_account/Editor.js";
import { CtoEditor } from "../src/placements/modules/cto/Editor.js";
import { HomeSavingsEditor } from "../src/placements/modules/home_savings/Editor.js";
import { LifeInsuranceEditor } from "../src/placements/modules/life_insurance/Editor.js";
import { PeaEditor } from "../src/placements/modules/pea/Editor.js";
import { RealEstateEditor } from "../src/placements/modules/real_estate/Editor.js";
import { SavingsAccountEditor } from "../src/placements/modules/savings_account/Editor.js";
import { CtoModule } from "../src/placements/modules/cto/module.js";
import { HomeSavingsModule } from "../src/placements/modules/home_savings/module.js";
import { LifeInsuranceModule } from "../src/placements/modules/life_insurance/module.js";
import { PeaModule } from "../src/placements/modules/pea/module.js";
import { RealEstateModule } from "../src/placements/modules/real_estate/module.js";
import { SavingsAccountModule } from "../src/placements/modules/savings_account/module.js";
import type { BasePlacement, PlacementEditorConstructor } from "../src/placements/BasePlacement.js";
import type { FiscalProfile } from "../src/fiscality/TaxCalculator.js";

const PROFILE: FiscalProfile = { usePfu: true, taxableIncome: 0, household: { maritalStatus: 'single', childrenCount: 0, alternateChildrenCount: 0, isSingleParent: false } } as never;

interface EditorCase {
  name: string;
  EditorClass: PlacementEditorConstructor;
  placement: BasePlacement;
}

const EDITOR_CASES: EditorCase[] = [
  { name: "CheckingAccountEditor", EditorClass: CheckingAccountEditor, placement: { currentValue: 1000 } as never },
  { name: "CtoEditor", EditorClass: CtoEditor, placement: new CtoModule({ label: 'Test', type: 'cto' as never, currentValue: 20000, acquisitionValue: 15000, cashBalance: 1000 }) },
  { name: "HomeSavingsEditor", EditorClass: HomeSavingsEditor, placement: new HomeSavingsModule({ label: 'Test', type: 'home_savings' as never, currentValue: 5000, interestAmount: 100, homeSavingsType: 'pel', openingDate: '2020-01-01' }) },
  { name: "LifeInsuranceEditor", EditorClass: LifeInsuranceEditor, placement: new LifeInsuranceModule({ label: 'Test', type: 'life_insurance' as never, currentValue: 50000, totalPremiums: 40000, pre2017Premiums: 0, euroFundsValue: 45000, openingDate: '2020-01-01' }) },
  { name: "PeaEditor", EditorClass: PeaEditor, placement: new PeaModule({ label: 'Test', type: 'pea' as never, currentValue: 10000, totalDeposits: 8000, openingDate: '2020-01-01' }) },
  { name: "RealEstateEditor", EditorClass: RealEstateEditor, placement: new RealEstateModule({ label: 'Test', type: 'real_estate' as never, currentValue: 300000, acquisitionPrice: 250000, primaryResidence: false }) },
  { name: "SavingsAccountEditor", EditorClass: SavingsAccountEditor, placement: new SavingsAccountModule({ label: 'Test', type: 'savings_account' as never, currentValue: 1000, interestAmount: 50 }) }
];

describe("buildTaxExplanation", () => {
  for (const { name, EditorClass, placement } of EDITOR_CASES) {
    it(`${name} implements buildTaxExplanation`, () => {
      expect(EditorClass.prototype.hasOwnProperty('buildTaxExplanation')).toBe(true);
      const editor = new EditorClass(null as never);
      const result = editor.buildTaxExplanation(placement, PROFILE);
      expect(typeof result).toBe("string");
    });
  }
});
