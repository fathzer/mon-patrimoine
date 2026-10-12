/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { StockGrant, StockGrantModule } from "./module.js";
import type { StockGrantModuleData } from "./module.js";

const NOW = new Date("2024-01-01");

describe("StockGrant.getTaxableAcquisitionGain", () => {
  it("returns 0 when acquisition gain is 0", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 0,
      numberOfShares: 100
    });
    expect(grant.getTaxableAcquisitionGain(50, 0, NOW)).toBe(0);
  });

  it("returns 0 when current price is 0", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    expect(grant.getTaxableAcquisitionGain(0, 0, NOW)).toBe(0);
  });

  it("caps acquisition price at current price", () => {
    // Acquisition price 100, current price 50: real acquisition gain = 50 * 100 = 5000
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Attribution in 2020 (after 2018): 50% abattement on fraction below threshold
    // threshold = 0, so belowThreshold = 0, aboveThreshold = 5000
    expect(grant.getTaxableAcquisitionGain(50, 0, NOW)).toBe(5000);
  });

  it("applies no abattement for attribution before 28/09/2012", () => {
    const grant = new StockGrant({
      attributionDate: "2011-01-01",
      acquisitionDate: "2011-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, no abattement
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(10000);
  });

  it("applies no abattement for attribution between 28/09/2012 and 07/08/2015", () => {
    const grant = new StockGrant({
      attributionDate: "2013-01-01",
      acquisitionDate: "2013-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, no abattement
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(10000);
  });

  it("applies 50% detention abattement for attribution 08/08/2015–30/12/2016 with > 2 years detention", () => {
    const grant = new StockGrant({
      attributionDate: "2016-01-01",
      acquisitionDate: "2016-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, detained ~8 years from 2016 to 2024 > 2 years => 50% abattement
    // Taxable = 10000 * 0.5 = 5000
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(5000);
  });

  it("applies 65% detention abattement for attribution 08/08/2015–30/12/2016 with > 8 years detention", () => {
    const grant = new StockGrant({
      attributionDate: "2016-01-01",
      acquisitionDate: "2015-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, detained ~9 years from 2015 to 2024 > 8 years => 65% abattement
    // Taxable = 10000 * 0.35 = 3500
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(3500);
  });

  it("applies no detention abattement for attribution 08/08/2015–30/12/2016 with < 2 years detention", () => {
    const grant = new StockGrant({
      attributionDate: "2016-01-01",
      acquisitionDate: "2023-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, detained ~1 year < 2 years => no abattement
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(10000);
  });

  it("applies detention abattement on fraction below threshold for attribution 31/12/2016–31/12/2017", () => {
    const grant = new StockGrant({
      attributionDate: "2017-06-01",
      acquisitionDate: "2017-06-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, detained ~6.5 years > 2 years => 50% abattement
    // threshold = 6000: belowThreshold = 6000, aboveThreshold = 4000
    // Taxable = 6000 * 0.5 + 4000 = 7000
    expect(grant.getTaxableAcquisitionGain(100, 6000, NOW)).toBe(7000);
  });

  it("applies no abattement above threshold for attribution 31/12/2016–31/12/2017", () => {
    const grant = new StockGrant({
      attributionDate: "2017-06-01",
      acquisitionDate: "2023-06-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, detained ~0.5 year < 2 years => no detention abattement
    // threshold = 6000: belowThreshold = 6000, aboveThreshold = 4000
    // Taxable = 6000 * 1 + 4000 = 10000
    expect(grant.getTaxableAcquisitionGain(100, 6000, NOW)).toBe(10000);
  });

  it("applies 50% abattement on fraction below threshold for attribution from 01/01/2018", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, threshold = 6000
    // belowThreshold = 6000, aboveThreshold = 4000
    // Taxable = 6000 * 0.5 + 4000 = 7000
    expect(grant.getTaxableAcquisitionGain(100, 6000, NOW)).toBe(7000);
  });

  it("applies 50% abattement on whole gain when threshold covers it (from 01/01/2018)", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, threshold = 300000
    // belowThreshold = 10000, aboveThreshold = 0
    // Taxable = 10000 * 0.5 = 5000
    expect(grant.getTaxableAcquisitionGain(100, 300000, NOW)).toBe(5000);
  });

  it("applies no abattement when threshold is 0 for attribution from 01/01/2018", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 100,
      numberOfShares: 100
    });
    // Gain = 100 * 100 = 10000, threshold = 0
    // belowThreshold = 0, aboveThreshold = 10000
    // Taxable = 0 + 10000 = 10000
    expect(grant.getTaxableAcquisitionGain(100, 0, NOW)).toBe(10000);
  });

  it("handles acquisition price capped at current price with abattement", () => {
    const grant = new StockGrant({
      attributionDate: "2020-01-01",
      acquisitionDate: "2020-01-01",
      acquisitionPrice: 200,
      numberOfShares: 100
    });
    // Real acquisition price = min(200, 50) = 50, gain = 50 * 100 = 5000
    // threshold = 300000: belowThreshold = 5000, aboveThreshold = 0
    // Taxable = 5000 * 0.5 = 2500
    expect(grant.getTaxableAcquisitionGain(50, 300000, NOW)).toBe(2500);
  });
});

const makeModule = (over: Partial<StockGrantModuleData> = {}): StockGrantModule => new StockGrantModule({
  id: "g1",
  stockName: "ACME",
  currentPrice: 95,
  asOf: "2026-10-01",
  attributions: [
    { attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", acquisitionPrice: 0, numberOfShares: 100 }
  ],
  ...over
});

describe("StockGrantModule history", () => {
  it("pushes the previous price into priceHistory at its own effective date", () => {
    const previous = makeModule({ currentPrice: 80, asOf: "2026-06-01" });
    const next = makeModule({ currentPrice: 95 });
    next.recordState(previous, "2026-10-01");

    expect(next.priceHistory).toEqual([{ date: "2026-06-01", price: 80 }]);
    expect(next.priceAsOf).toBe("2026-10-01");
  });

  it("keeps the price effective date when only shares change", () => {
    const previous = makeModule({ currentPrice: 80, asOf: "2026-06-01", priceAsOf: "2026-04-15" });
    const next = makeModule({
      currentPrice: 80,
      attributions: [{ attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 50 }]
    });
    next.recordState(previous, "2026-10-01");

    expect(next.priceHistory).toEqual([]);
    expect(next.priceAsOf).toBe("2026-04-15");
    // The changed share count falls back to the line's acquisitionDate.
    expect(next.attributions[0].sharesHistory).toEqual([{ date: "2024-03-01", shares: 100 }]);
    expect(next.attributions[0].sharesAsOf).toBe("2026-10-01");
  });

  it("matches lines by attribution/acquisition dates, not by index", () => {
    const previous = makeModule({
      attributions: [
        { attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 100 },
        { attributionDate: "2025-01-01", acquisitionDate: "2025-03-01", numberOfShares: 60 }
      ]
    });
    const next = makeModule({
      attributions: [
        { attributionDate: "2025-01-01", acquisitionDate: "2025-03-01", numberOfShares: 30 },
        { attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 100 }
      ]
    });
    next.recordState(previous, "2026-10-01");

    expect(next.attributions[0].sharesHistory).toEqual([{ date: "2025-03-01", shares: 60 }]);
    expect(next.attributions[1].sharesHistory).toEqual([]);
  });

  it("records a sale as a 0-share state without deleting the line", () => {
    const previous = makeModule();
    const next = makeModule({
      attributions: [{ attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 0 }]
    });
    next.recordState(previous, "2026-10-01");

    expect(next.attributions).toHaveLength(1);
    expect(next.attributions[0].sharesHistory).toEqual([{ date: "2024-03-01", shares: 100 }]);
    expect(next.attributions[0].getSharesAt("2026-10-01")).toBe(0);
    expect(next.attributions[0].getSharesAt("2025-01-01")).toBe(100);
  });

  it("resolves a past state via getDataAt (price + per-line shares)", () => {
    const p = makeModule({
      priceHistory: [{ date: "2025-06-01", price: 80 }],
      priceAsOf: "2026-10-01",
      attributions: [
        {
          attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 50,
          sharesAsOf: "2026-10-01", sharesHistory: [{ date: "2024-03-01", shares: 100 }]
        },
        { attributionDate: "2026-01-01", acquisitionDate: "2026-05-01", numberOfShares: 30 }
      ]
    });

    const data = p.getDataAt("2025-08-01")!;
    expect(data.currentPrice).toBe(80);
    // The second line is not held yet at that date (acquisitionDate > D).
    expect(data.attributions).toHaveLength(1);
    expect(data.attributions![0].numberOfShares).toBe(100);
    expect(data.asOf).toBe("2025-08-01");
  });

  it("returns null before the earliest known date and after closedAt", () => {
    const p = makeModule({ closedAt: "2026-11-01" });
    expect(p.getDataAt("2020-01-01")).toBeNull();
    expect(p.getDataAt("2026-12-01")).toBeNull();
    expect(p.getDataAt("2026-10-15")).not.toBeNull();
  });

  it("inserts a retroactive state into the nested histories without touching the current state", () => {
    const p = makeModule();
    p.insertHistoryEntry("2025-03-01", {
      currentPrice: 70,
      attributions: [{ attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 80 }]
    });

    expect(p.priceHistory).toEqual([{ date: "2025-03-01", price: 70 }]);
    expect(p.attributions[0].sharesHistory).toEqual([{ date: "2025-03-01", shares: 80 }]);
    expect(p.currentPrice).toBe(95);
    expect(p.attributions[0].numberOfShares).toBe(100);
  });

  it("skips retro entries equal to the resolved state (no noise)", () => {
    const p = makeModule();
    p.insertHistoryEntry("2025-03-01", {
      currentPrice: 95,
      attributions: [{ attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 100 }]
    });

    expect(p.priceHistory).toEqual([]);
    expect(p.attributions[0].sharesHistory).toEqual([]);
  });

  it("deletes a point from every dimension's history (price + per-line shares)", () => {
    const p = makeModule();
    p.insertHistoryEntry("2025-03-01", {
      currentPrice: 70,
      attributions: [{ attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 80 }]
    });

    expect(p.hasHistoryEntry("2025-03-01")).toBe(true);
    p.deleteHistoryEntry("2025-03-01");
    expect(p.hasHistoryEntry("2025-03-01")).toBe(false);
    expect(p.priceHistory).toEqual([]);
    expect(p.attributions[0].sharesHistory).toEqual([]);
  });

  it("round-trips the nested histories through toJSON", () => {
    const p = makeModule({
      priceAsOf: "2026-10-01",
      priceHistory: [{ date: "2025-06-01", price: 80 }],
      attributions: [{
        attributionDate: "2024-01-01", acquisitionDate: "2024-03-01", numberOfShares: 50,
        sharesAsOf: "2026-10-01", sharesHistory: [{ date: "2024-03-01", shares: 100 }]
      }]
    });

    const p2 = new StockGrantModule(p.toJSON());
    expect(p2.priceHistory).toEqual([{ date: "2025-06-01", price: 80 }]);
    expect(p2.attributions[0].sharesHistory).toEqual([{ date: "2024-03-01", shares: 100 }]);
    expect(p2.attributions[0].sharesAsOf).toBe("2026-10-01");
  });
});
