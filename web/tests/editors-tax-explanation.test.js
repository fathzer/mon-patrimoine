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

const PROFILE = { usePfu: true, tmi: 0.30 };

const EDITOR_CASES = [
  { name: "CheckingAccountEditor", EditorClass: CheckingAccountEditor, placement: { currentValue: 1000 } },
  { name: "CtoEditor", EditorClass: CtoEditor, placement: { currentValue: 20000, acquisitionValue: 15000, cashBalance: 1000 } },
  { name: "HomeSavingsEditor", EditorClass: HomeSavingsEditor, placement: { currentValue: 5000 } },
  { name: "LifeInsuranceEditor", EditorClass: LifeInsuranceEditor, placement: { currentValue: 50000, totalPremiums: 40000, euroFundsValue: 45000, openingDate: '2020-01-01' } },
  { name: "PeaEditor", EditorClass: PeaEditor, placement: { currentValue: 10000, totalDeposits: 8000, openingDate: '2020-01-01' } },
  { name: "RealEstateEditor", EditorClass: RealEstateEditor, placement: { currentValue: 300000, acquisitionPrice: 250000, primaryResidence: false } },
  { name: "SavingsAccountBaseEditor", EditorClass: SavingsAccountBaseEditor, placement: { currentValue: 1000 } },
  { name: "SavingsAccountEditor", EditorClass: SavingsAccountEditor, placement: { currentValue: 1000 } }
];

describe("buildTaxExplanation", () => {
  it("throws by default in BasePlacementEditor", () => {
    const editor = new BasePlacementEditor(null);
    expect(() => editor.buildTaxExplanation({}, {})).toThrow("buildTaxExplanation() must be implemented by subclass");
  });

  for (const { name, EditorClass, placement } of EDITOR_CASES) {
    it(`${name} implements buildTaxExplanation`, () => {
      const editor = new EditorClass(null, null);
      const result = editor.buildTaxExplanation(placement, PROFILE);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  }
});
