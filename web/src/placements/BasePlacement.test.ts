/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { BasePlacement } from "./BasePlacement.js";
import type { PlacementData, Evaluation } from "./BasePlacement.js";
import { Category } from "../core/Categories.js";
import type { FiscalProfile, PlacementIncome } from "../fiscality/TaxCalculator.js";

interface TestData extends PlacementData {
  currentValue?: number;
}

class TestPlacement extends BasePlacement {
  static getCategory() {
    return Category.INVESTMENTS;
  }

  currentValue: number;

  constructor(data: TestData) {
    super({ ...data, type: 'test' });
    this.currentValue = Number(data.currentValue) || 0;
  }

  override getEvolvingValues(): Record<string, unknown> {
    return { currentValue: this.currentValue };
  }

  getEvaluation(_fiscalProfile: FiscalProfile, _now?: Date): Evaluation {
    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue,
      socialCharges: 0,
      latentGain: 0,
      imposition: 0
    };
  }

  protected getTaxableIncomes(): PlacementIncome[] {
    return [];
  }

  override toJSON(): TestData {
    return { ...super.toJSON(), currentValue: this.currentValue };
  }
}

const today = (): string => new Date().toISOString().split('T')[0];

describe("BasePlacement history", () => {
  it("hydrates asOf/closedAt/history with defaults", () => {
    const p = new TestPlacement({ id: "1", currentValue: 100 });
    expect(p.asOf).toBe(today());
    expect(p.closedAt).toBeNull();
    expect(p.history).toEqual([]);
    expect(p.toJSON().asOf).toBe(today());
  });

  it("pushes the previous current state into history at its own asOf", () => {
    const previous = new TestPlacement({ id: "1", currentValue: 100, asOf: "2025-01-10" });
    const next = new TestPlacement({ id: "1", currentValue: 120 });
    next.recordState(previous, "2025-02-01");

    expect(next.asOf).toBe("2025-02-01");
    expect(next.history).toEqual([{ date: "2025-01-10", values: { currentValue: 100 } }]);
  });

  it("skips recording when the evolving values did not change", () => {
    const previous = new TestPlacement({ id: "1", currentValue: 100, asOf: "2025-01-10" });
    const next = new TestPlacement({ id: "1", currentValue: 100 });
    next.recordState(previous, "2025-02-01");

    expect(next.history).toEqual([]);
    expect(next.asOf).toBe("2025-02-01");
  });

  it("resolves getDataAt as a step function", () => {
    const p = new TestPlacement({
      id: "1",
      currentValue: 120,
      asOf: "2025-03-01",
      history: [{ date: "2025-01-10", values: { currentValue: 100 } }]
    });

    expect(p.getDataAt("2025-01-09")).toBeNull();
    expect(p.getDataAt("2025-01-10")!.currentValue).toBe(100);
    expect(p.getDataAt("2025-02-15")!.currentValue).toBe(100);
    expect(p.getDataAt("2025-03-01")!.currentValue).toBe(120);
    expect(p.getDataAt("2030-12-31")!.currentValue).toBe(120);
  });

  it("returns the resolved state date as asOf and no history", () => {
    const p = new TestPlacement({
      id: "1",
      currentValue: 120,
      asOf: "2025-03-01",
      history: [{ date: "2025-01-10", values: { currentValue: 100 } }]
    });
    const data = p.getDataAt("2025-02-01")!;
    expect(data.asOf).toBe("2025-01-10");
    expect(data.history).toBeUndefined();
  });

  it("returns null after closedAt", () => {
    const p = new TestPlacement({
      id: "1",
      currentValue: 100,
      asOf: "2025-01-10",
      closedAt: "2025-06-30"
    });
    expect(p.getDataAt("2025-06-30")!.currentValue).toBe(100);
    expect(p.getDataAt("2025-07-01")).toBeNull();
  });

  it("inserts a retroactive state without touching the current state", () => {
    const p = new TestPlacement({ id: "1", currentValue: 120, asOf: "2025-03-01" });
    p.insertHistoryEntry("2025-01-15", { currentValue: 90 });

    expect(p.currentValue).toBe(120);
    expect(p.getDataAt("2025-01-15")!.currentValue).toBe(90);
    expect(p.getDataAt("2025-03-01")!.currentValue).toBe(120);
  });

  it("exposes every known date including the current asOf", () => {
    const p = new TestPlacement({
      id: "1",
      currentValue: 120,
      asOf: "2025-03-01",
      history: [{ date: "2025-01-10", values: { currentValue: 100 } }]
    });
    expect(p.getHistoryDates()).toEqual(["2025-01-10", "2025-03-01"]);
  });

  it("stays history-inert when the module does not opt in", () => {
    class InertPlacement extends TestPlacement {
      override getEvolvingValues(): Record<string, unknown> {
        return {};
      }
    }
    const p = new InertPlacement({ id: "1", currentValue: 100, asOf: "2025-01-10" });
    expect(p.getDataAt("2025-01-09")).toBeNull();
    expect(p.getDataAt("2025-01-10")!.currentValue).toBe(100);
  });
});
