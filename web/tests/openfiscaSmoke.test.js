import { describe, it, expect } from "bun:test";
import { Openfisca } from "./Openfisca.js";

describe("Openfisca smoke test", () => {
  it("calls the Openfisca API and logs the result", async () => {
    const household = {
      maritalStatus: "single",
      childrenCount: 1,
      alternateChildrenCount: 0,
      isSingleParent: true
    };

    const result = await Openfisca.calculate(household, 40000, 2026);
    expect(result).toBeDefined();
    expect(result.nbptr).toBeGreaterThan(0);
    console.log(JSON.stringify(result, null, 2));
  });
});
