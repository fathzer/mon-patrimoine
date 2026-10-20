/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { evalFormula } from "./Formula.js";

describe("evalFormula", () => {
  it("parses plain numbers with both decimal separators", () => {
    expect(evalFormula("1234")).toBe(1234);
    expect(evalFormula("1.5")).toBe(1.5);
    expect(evalFormula("1,5")).toBe(1.5);
    expect(evalFormula(".5")).toBe(0.5);
    expect(evalFormula(",5")).toBe(0.5);
    expect(evalFormula("12.")).toBe(12);
  });

  it("applies the usual operator precedence", () => {
    expect(evalFormula("1+2*3")).toBe(7);
    expect(evalFormula("(1+2)*3")).toBe(9);
    expect(evalFormula("10/4")).toBe(2.5);
    expect(evalFormula("10-4-3")).toBe(3);
    expect(evalFormula("((2+3)*4)")).toBe(20);
  });

  it("evaluates the motivating example", () => {
    expect(evalFormula("1000*(1+5%)")).toBeCloseTo(1050);
    expect(evalFormula(" 1000 * (1 + 5 %) ")).toBeCloseTo(1050);
  });

  it("supports postfix % as /100", () => {
    expect(evalFormula("5%")).toBe(0.05);
    expect(evalFormula("200*15%")).toBeCloseTo(30);
    expect(evalFormula("50%-10%")).toBeCloseTo(0.4);
    expect(evalFormula("50%%")).toBeCloseTo(0.0005);
  });

  it("supports unary minus", () => {
    expect(evalFormula("-5")).toBe(-5);
    expect(evalFormula("--5")).toBe(5);
    expect(evalFormula("5--3")).toBe(8);
    expect(evalFormula("-(2+3)")).toBe(-5);
    expect(evalFormula("-5%")).toBeCloseTo(-0.05);
    expect(evalFormula("10*-2")).toBe(-20);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "  ", "abc", "1+", "+1", "(1", "1)", "1 2", "1,2,3", "1.2.3", "%5", "*3", "()", "(]", "1("]) {
      expect(evalFormula(bad)).toBeNaN();
    }
  });

  it("rejects non-finite results", () => {
    expect(evalFormula("1/0")).toBeNaN();
    expect(evalFormula("0/0")).toBeNaN();
  });
});
