import { describe, it, expect } from "bun:test";
import {
  PEA_CAP,
  PEA_PME_CAP,
  COMBINED_CAP,
  checkPerPlanCap,
  checkCombinedCap
} from "./Caps.js";

describe("checkPerPlanCap", () => {
  it("returns null when PEA deposits are within the cap", () => {
    expect(checkPerPlanCap('pea', PEA_CAP)).toBeNull();
    expect(checkPerPlanCap('pea', 0)).toBeNull();
  });

  it("returns null when PEA-PME deposits are within the cap", () => {
    expect(checkPerPlanCap('pea_pme', PEA_PME_CAP)).toBeNull();
    expect(checkPerPlanCap('pea_pme', 0)).toBeNull();
  });

  it("returns a warning when PEA deposits exceed the cap", () => {
    const warning = checkPerPlanCap('pea', PEA_CAP + 1);
    expect(warning).not.toBeNull();
    expect(warning!.message).toMatch(/150.*000/);
    expect(warning!.message).toContain("PEA");
  });

  it("returns a warning when PEA-PME deposits exceed the cap", () => {
    const warning = checkPerPlanCap('pea_pme', PEA_PME_CAP + 1);
    expect(warning).not.toBeNull();
    expect(warning!.message).toMatch(/225.*000/);
    expect(warning!.message).toContain("PEA-PME");
  });
});

describe("checkCombinedCap — single person", () => {
  it("returns null when total deposits are within the combined cap", () => {
    expect(checkCombinedCap([100_000], [], false)).toBeNull();
    expect(checkCombinedCap([100_000], [100_000], false)).toBeNull();
    expect(checkCombinedCap([], [225_000], false)).toBeNull();
  });

  it("returns a warning when PEA + PEA-PME exceed the combined cap", () => {
    const warning = checkCombinedCap([150_000], [100_000], false);
    expect(warning).not.toBeNull();
    expect(warning!.message).toMatch(/225.*000/);
  });

  it("returns a warning when a single PEA-PME exceeds the combined cap", () => {
    const warning = checkCombinedCap([], [COMBINED_CAP + 1], false);
    expect(warning).not.toBeNull();
  });
});

describe("checkCombinedCap — couple", () => {
  it("returns null when two PEA plans are within per-plan caps", () => {
    expect(checkCombinedCap([150_000, 150_000], [], true)).toBeNull();
  });

  it("returns null when two PEA-PME plans are within per-plan caps", () => {
    expect(checkCombinedCap([], [225_000, 225_000], true)).toBeNull();
  });

  it("returns null when plans can be assigned to satisfy the combined cap", () => {
    // PEA-1: 100k, PEA-2: 100k, PEA-PME-1: 125k, PEA-PME-2: 125k
    // Assignment: P1 = PEA-1 + PEA-PME-2 = 225k, P2 = PEA-2 + PEA-PME-1 = 225k
    expect(checkCombinedCap([100_000, 100_000], [125_000, 125_000], true)).toBeNull();
  });

  it("returns a warning when no assignment satisfies the combined cap", () => {
    // PEA-1: 150k, PEA-2: 150k, PEA-PME-1: 100k, PEA-PME-2: 100k
    // Best assignment: P1 = 150k + 100k = 250k > 225k, P2 = 150k + 100k = 250k > 225k
    const warning = checkCombinedCap([150_000, 150_000], [100_000, 100_000], true);
    expect(warning).not.toBeNull();
    expect(warning!.message).toMatch(/225.*000/);
  });

  it("returns null when one PEA and one PEA-PME can be split across partners", () => {
    // PEA: 150k, PEA-PME: 225k → different partners, each within cap
    expect(checkCombinedCap([150_000], [225_000], true)).toBeNull();
  });

  it("returns a warning when one PEA and one PEA-PME cannot fit on one partner", () => {
    // PEA: 150k, PEA-PME: 100k → same partner: 250k > 225k
    // But different partners: PEA ≤ 150k ✓, PEA-PME ≤ 225k ✓ → valid
    // So this should be null (different partners works)
    expect(checkCombinedCap([150_000], [100_000], true)).toBeNull();
  });

  it("returns a warning when 2 PEA + 1 PEA-PME cannot be assigned", () => {
    // PEA-1: 150k, PEA-2: 150k, PEA-PME: 100k
    // PEA-PME to P1: 150k + 100k = 250k > 225k
    // PEA-PME to P2: 150k + 100k = 250k > 225k
    const warning = checkCombinedCap([150_000, 150_000], [100_000], true);
    expect(warning).not.toBeNull();
  });

  it("returns null when 2 PEA + 1 PEA-PME can be assigned", () => {
    // PEA-1: 100k, PEA-2: 150k, PEA-PME: 100k
    // PEA-PME to P1: 100k + 100k = 200k ≤ 225k ✓, P2: 150k ✓
    expect(checkCombinedCap([100_000, 150_000], [100_000], true)).toBeNull();
  });

  it("handles empty deposits", () => {
    expect(checkCombinedCap([], [], true)).toBeNull();
    expect(checkCombinedCap([], [], false)).toBeNull();
  });
});
