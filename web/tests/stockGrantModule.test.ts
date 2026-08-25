import { describe, it, expect } from "bun:test";
import { StockGrant } from "../src/placements/stock_grant/module.js";

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
