/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { Household } from "./Household.js";

describe("Household validation", () => {
  it("accepts a consistent household", () => {
    const household = new Household({
      maritalStatus: "married",
      childrenCount: 2,
      disabledChildrenCount: 1,
      alternateChildrenCount: 1,
      disabledAlternateChildrenCount: 1
    });
    expect(household.disabledChildrenCount).toBe(1);
    expect(household.disabledAlternateChildrenCount).toBe(1);
  });

  it("throws when disabled children exceed exclusive-custody children", () => {
    expect(() => new Household({ childrenCount: 1, disabledChildrenCount: 2 }))
      .toThrow(RangeError);
  });

  it("throws when disabled children exceed alternate-custody children", () => {
    expect(() => new Household({ alternateChildrenCount: 0, disabledAlternateChildrenCount: 1 }))
      .toThrow(RangeError);
  });

  it("throws on a negative children count", () => {
    expect(() => new Household({ childrenCount: -1 })).toThrow(RangeError);
  });

  it("throws on a non-integer count", () => {
    expect(() => new Household({ disabledChildrenCount: 0.5 })).toThrow(RangeError);
  });

  it("throws on an invalid marital status", () => {
    expect(() => new Household({ maritalStatus: "divorced" as never })).toThrow(RangeError);
  });
});
