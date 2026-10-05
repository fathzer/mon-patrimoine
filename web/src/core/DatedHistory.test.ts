/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { resolveAt, recordAt, thin, valuesEqual } from "./DatedHistory.js";
import type { HistoryEntry } from "./DatedHistory.js";

const entry = (date: string, v: number = 0): HistoryEntry => ({ date, values: { v } });

describe("resolveAt", () => {
  const entries = [entry("2025-01-01", 1), entry("2025-03-01", 2), entry("2025-06-01", 3)];

  it("returns null before the first entry and for an empty history", () => {
    expect(resolveAt(entries, "2024-12-31")).toBeNull();
    expect(resolveAt([], "2025-01-01")).toBeNull();
  });

  it("returns the entry at an exact date", () => {
    expect(resolveAt(entries, "2025-03-01")!.values.v).toBe(2);
  });

  it("returns the latest entry at or before the date", () => {
    expect(resolveAt(entries, "2025-04-15")!.values.v).toBe(2);
    expect(resolveAt(entries, "2030-01-01")!.values.v).toBe(3);
  });
});

describe("recordAt", () => {
  it("inserts an entry in date order", () => {
    const result = recordAt([entry("2025-01-01"), entry("2025-06-01")], entry("2025-03-01", 2));
    expect(result.map(e => e.date)).toEqual(["2025-01-01", "2025-03-01", "2025-06-01"]);
  });

  it("replaces an existing entry at the same date", () => {
    const result = recordAt([entry("2025-01-01", 1), entry("2025-03-01", 2)], entry("2025-03-01", 9));
    expect(result).toHaveLength(2);
    expect(result[1].values.v).toBe(9);
  });
});

describe("valuesEqual", () => {
  it("compares flat values regardless of key order", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares nested structures", () => {
    expect(valuesEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(valuesEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
  });

  it("handles non-objects", () => {
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual(1, "1")).toBe(false);
    expect(valuesEqual(null, {})).toBe(false);
  });
});

describe("thin", () => {
  // Reference: now = 2026-04-15 → full resolution < ~183d, weekly slots
  // (month days 7, 14, 21, last) < ~731d, month-end slots beyond.
  const now = new Date("2026-04-15");

  it("keeps every recent entry", () => {
    const entries = [entry("2026-04-01"), entry("2026-04-08"), entry("2026-04-14")];
    expect(thin(entries, { now })).toHaveLength(3);
  });

  it("lets each week-end slot claim its closest entry", () => {
    // Jul-31 → 08-01 (1d). Aug-7 → 08-10 (3d). Aug-14+ → 08-11 (3d).
    // 08-03 is closest to no slot and is dropped.
    const entries = [entry("2025-08-01"), entry("2025-08-03"), entry("2025-08-10"), entry("2025-08-11")];
    const kept = thin(entries, { now }).map(e => e.date);
    expect(kept).toEqual(["2025-08-01", "2025-08-10", "2025-08-11"]);
  });

  it("lets a slot claim entries on either side of the month boundary", () => {
    // Aug-31 → 08-31 (0d, against 09-01 at 1d and 09-02 at 2d).
    // Sep-7 → 09-02 (5d, against 09-01 at 6d). Sep-14+ → 09-15.
    const entries = [entry("2025-08-31"), entry("2025-09-01"), entry("2025-09-02"), entry("2025-09-15")];
    const kept = thin(entries, { now }).map(e => e.date);
    expect(kept).toEqual(["2025-08-31", "2025-09-02", "2025-09-15"]);
  });

  it("keeps one entry per month-end slot for old history and always preserves the first", () => {
    const entries = [
      entry("2023-01-05"), entry("2023-01-10"), entry("2023-01-20"),
      entry("2023-02-03"), entry("2023-02-28"),
      entry("2023-03-15")
    ];
    const kept = thin(entries, { now }).map(e => e.date);
    // Dec-31 2022 → 01-05 (5d). Jan-31 → 02-03 (3d, vs 01-20 at 11d).
    // Feb-28 → 02-28 (0d). Mar-31 → 03-15 (16d). 01-10 and 01-20 lose all.
    expect(kept).toEqual(["2023-01-05", "2023-02-03", "2023-02-28", "2023-03-15"]);
  });

  it("assigns each month-end slot its closest entry, on either side", () => {
    // User scenario: the 01-01 entry wins Dec-31 2026 (1d), 12-16 wins
    // Dec-31 2027 (15d), and 12-13 covers Nov-30 (13d). All kept.
    const oldNow = new Date("2030-01-01");
    const entries = [
      entry("2026-01-15"),
      entry("2026-12-13"),
      entry("2027-01-01"),
      entry("2027-12-16")
    ];
    const kept = thin(entries, { now: oldNow }).map(e => e.date);
    expect(kept).toEqual(["2026-01-15", "2026-12-13", "2027-01-01", "2027-12-16"]);
  });

  it("lets an isolated entry cover the surrounding empty months", () => {
    // The 08-20 entry wins Aug-31 (11d) and Sep-30 (41d); the 11-25 entry
    // wins Oct-31 (25d). December goes to the 01-06 entry (6d), which is
    // more representative of the year end than 12-01 (30d).
    const oldNow = new Date("2030-01-01");
    const entries = [
      entry("2026-08-20"), entry("2026-11-25"), entry("2026-12-01"),
      entry("2027-01-06"), entry("2027-01-30")
    ];
    const kept = thin(entries, { now: oldNow }).map(e => e.date);
    expect(kept).toEqual(["2026-08-20", "2026-11-25", "2026-12-01", "2027-01-06", "2027-01-30"]);
  });

  it("drops entries that win no slot", () => {
    const oldNow = new Date("2030-01-01");
    // 12-30 loses Dec-31 to 12-31 (0d) and Nov-30 to 12-13 (13d).
    const entries = [entry("2026-01-15"), entry("2026-12-13"), entry("2026-12-30"), entry("2026-12-31")];
    const kept = thin(entries, { now: oldNow }).map(e => e.date);
    expect(kept).toEqual(["2026-01-15", "2026-12-13", "2026-12-31"]);
  });

  it("does not mutate the input", () => {
    const entries = [entry("2023-01-05"), entry("2023-01-10")];
    thin(entries, { now });
    expect(entries).toHaveLength(2);
  });
});
