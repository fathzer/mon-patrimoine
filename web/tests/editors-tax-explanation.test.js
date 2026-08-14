import { describe, it, expect } from "bun:test";
import { BasePlacementEditor } from "../src/ui/editors/BasePlacementEditor.js";
import { CheckingAccountEditor } from "../src/ui/editors/CheckingAccountEditor.js";
import { CtoEditor } from "../src/ui/editors/CtoEditor.js";
import { HomeSavingsEditor } from "../src/ui/editors/HomeSavingsEditor.js";
import { LifeInsuranceEditor } from "../src/ui/editors/LifeInsuranceEditor.js";
import { PeaEditor } from "../src/ui/editors/PeaEditor.js";
import { RealEstateEditor } from "../src/ui/editors/RealEstateEditor.js";
import { SavingsAccountBaseEditor } from "../src/ui/editors/SavingsAccountBaseEditor.js";
import { SavingsAccountEditor } from "../src/ui/editors/SavingsAccountEditor.js";
import { CtoModule } from "../src/modules/CtoModule.js";
import { HomeSavingsModule } from "../src/modules/HomeSavingsModule.js";
import { LifeInsuranceModule } from "../src/modules/LifeInsuranceModule.js";
import { PeaModule } from "../src/modules/PeaModule.js";
import { RealEstateModule } from "../src/modules/RealEstateModule.js";
import { SavingsAccountModule } from "../src/modules/SavingsAccountModule.js";

const PROFILE = { usePfu: true, tmi: 0.30 };

const EDITOR_CASES = [
  { name: "CheckingAccountEditor", EditorClass: CheckingAccountEditor, placement: { currentValue: 1000 } },
  { name: "CtoEditor", EditorClass: CtoEditor, placement: new CtoModule({ label: 'Test', currentValue: 20000, acquisitionValue: 15000, cashBalance: 1000 }) },
  { name: "HomeSavingsEditor", EditorClass: HomeSavingsEditor, placement: new HomeSavingsModule({ label: 'Test', currentValue: 5000, interestAmount: 100, homeSavingsType: 'pel', openingDate: '2020-01-01' }) },
  { name: "LifeInsuranceEditor", EditorClass: LifeInsuranceEditor, placement: new LifeInsuranceModule({ label: 'Test', currentValue: 50000, totalPremiums: 40000, pre2017Premiums: 0, euroFundsValue: 45000, openingDate: '2020-01-01' }) },
  { name: "PeaEditor", EditorClass: PeaEditor, placement: new PeaModule({ label: 'Test', currentValue: 10000, totalDeposits: 8000, openingDate: '2020-01-01' }) },
  { name: "RealEstateEditor", EditorClass: RealEstateEditor, placement: new RealEstateModule({ label: 'Test', currentValue: 300000, acquisitionPrice: 250000, primaryResidence: false }) },
  { name: "SavingsAccountEditor", EditorClass: SavingsAccountEditor, placement: new SavingsAccountModule({ label: 'Test', currentValue: 1000, interestAmount: 50 }) }
];

describe("buildTaxExplanation", () => {
  it("throws by default in BasePlacementEditor", () => {
    const editor = new BasePlacementEditor(null);
    expect(() => editor.buildTaxExplanation({}, {})).toThrow("buildTaxExplanation() must be implemented by subclass");
  });

  for (const { name, EditorClass, placement } of EDITOR_CASES) {
    it(`${name} implements buildTaxExplanation`, () => {
      expect(EditorClass.prototype.hasOwnProperty('buildTaxExplanation')).toBe(true);
      const editor = new EditorClass(null, null);
      const result = editor.buildTaxExplanation(placement, PROFILE);
      expect(typeof result).toBe("string");
    });
  }
});
