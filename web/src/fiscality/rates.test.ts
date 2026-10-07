/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import {
  FISCAL_RATES,
  FISCAL_RATES_BY_YEAR,
  getFiscalRates,
  getSocialContributionRate
} from "./rates.js";

describe("getFiscalRates", () => {
  it("returns the schedule of the requested income year", () => {
    // The second bracket was taxed at 14% for income 2019, then 11% from 2020.
    expect(getFiscalRates(2019).INCOME_TAX_BRACKETS[1].rate).toBe(0.14);
    expect(getFiscalRates(2020).INCOME_TAX_BRACKETS[1].rate).toBe(0.11);
  });

  it("uses the pre-2020 decote regime for income 2019", () => {
    expect(getFiscalRates(2019).DECOTE.rate).toBe(0.75);
    expect(getFiscalRates(2019).DECOTE.limit_single).toBe(1208);
    expect(getFiscalRates(2020).DECOTE.rate).toBe(0.4525);
  });

  it("falls back to the latest known year for a not-yet-voted income year", () => {
    const latestYear = Math.max(...Object.keys(FISCAL_RATES_BY_YEAR).map(Number));
    expect(getFiscalRates(latestYear + 5)).toBe(FISCAL_RATES_BY_YEAR[latestYear]);
  });

  it("clamps years predating the table to the earliest known year", () => {
    const earliestYear = Math.min(...Object.keys(FISCAL_RATES_BY_YEAR).map(Number));
    expect(getFiscalRates(1990)).toBe(FISCAL_RATES_BY_YEAR[earliestYear]);
  });

  it("exposes the current-year schedule through FISCAL_RATES", () => {
    expect(FISCAL_RATES).toBe(getFiscalRates(new Date().getFullYear()));
  });
});

describe("getSocialContributionRate", () => {
  it("returns the capital income rate in force on the event date", () => {
    expect(getSocialContributionRate(new Date("2015-06-01"))).toBe(0.155);
    expect(getSocialContributionRate(new Date("2018-01-01"))).toBe(0.172);
    expect(getSocialContributionRate(new Date("2020-12-31"))).toBe(0.172);
    expect(getSocialContributionRate(new Date("2026-01-01"))).toBe(0.186);
  });
});
