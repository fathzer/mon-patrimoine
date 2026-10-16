/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { InflationIndex, INFLATION_SERIES_IDS, INFLATION_SERIES_LABELS } from "./inflation.js";
import type { InflationSourceData } from "./inflation.js";

const sample = (index: Record<string, string>): InflationSourceData => ({
  source: {
    id: "011814630",
    title: "Test series",
    origin: "INSEE",
    url: "https://example.invalid",
    lastUpdate: "2026-09-15"
  },
  index
});

describe("InflationIndex", () => {
  const data = sample({
    "2020-01": "100",
    "2020-06": "101",
    "2021-01": "102",
    "2026-08": "120",
    "2026-09": "121"
  });
  const idx = new InflationIndex(data);

  it("exposes the latest published month", () => {
    expect(idx.latestMonth).toBe("2026-09");
    expect(idx.latestValue).toBe(121);
    expect(idx.firstMonth).toBe("2020-01");
  });

  it("resolves the value at the greatest month <= the date", () => {
    expect(idx.valueAt("2020-01-15")).toBe(100);
    expect(idx.valueAt("2020-03-01")).toBe(100);
    expect(idx.valueAt("2020-06-30")).toBe(101);
    expect(idx.valueAt("2021-01-01")).toBe(102);
    expect(idx.valueAt("2026-08-31")).toBe(120);
    expect(idx.valueAt("2026-09-01")).toBe(121);
  });

  it("uses the first month for dates before the series starts", () => {
    expect(idx.valueAt("1990-01-01")).toBe(100);
  });

  it("uses the latest month for dates after the last published month", () => {
    expect(idx.valueAt("2026-10-14")).toBe(121);
    expect(idx.valueAt("2030-01-01")).toBe(121);
  });

  it("computes a factor >= 1 for past dates and 1 for the latest month", () => {
    expect(idx.factorFor("2026-09-15")).toBe(1);
    expect(idx.factorFor("2026-10-14")).toBe(1);
    // 100 nominal in 2020-01 → 121 current euros
    expect(idx.factorFor("2020-01-15")).toBeCloseTo(1.21, 6);
    expect(idx.factorFor("2020-06-15")).toBeCloseTo(121 / 101, 6);
  });

  it("returns factor 1 when the denominator is zero", () => {
    const zero = new InflationIndex(sample({ "2020-01": "0", "2026-01": "100" }));
    expect(zero.factorFor("2020-01-15")).toBe(1);
  });
});

describe("INFLATION_SERIES", () => {
  it("exposes the three INSEE series ids", () => {
    expect(INFLATION_SERIES_IDS).toEqual(["011814630", "011814056", "011814080"]);
  });

  it("labels every series", () => {
    for (const id of INFLATION_SERIES_IDS) {
      expect(INFLATION_SERIES_LABELS[id]).toBeTruthy();
    }
  });
});
