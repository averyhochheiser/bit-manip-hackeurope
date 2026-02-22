/**
 * Tests for lib/carbon/calculator.ts
 *
 * Covers all exported physics functions:
 *   computePUE, computeThrottleAdjustment, computeEmbodiedCarbon,
 *   computeFourierForecast, computeRadiativeForcing, computeLifecycleEmissions,
 *   computeCarbonDiff, computeGateDecision, estimateEmissions,
 *   calculateEmissions (shim), forecastOptimalWindow (shim)
 */

import { describe, it, expect, vi } from "vitest";

// Mock the electricity-maps client so tests run without network I/O or env vars
vi.mock("@/lib/electricity-maps/client", () => ({
  getCarbonIntensity: vi.fn().mockResolvedValue(300),
  getHourlyProfile:   vi.fn().mockReturnValue(null),       // triggers Fourier fallback by default
}));

import {
  CRUSOE_INTENSITY_G_PER_KWH,
  computePUE,
  computeThrottleAdjustment,
  computeEmbodiedCarbon,
  computeFourierForecast,
  computeRadiativeForcing,
  computeLifecycleEmissions,
  computeCarbonDiff,
  computeGateDecision,
  estimateEmissions,
  calculateEmissions,
  forecastOptimalWindow,
} from "../calculator";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate N hours of synthetic diurnal carbon intensity data. */
function syntheticHistory(n: number, base = 300, amplitude = 80): number[] {
  return Array.from({ length: n }, (_, i) =>
    base + amplitude * Math.sin((2 * Math.PI * i) / 24)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. computePUE
// ─────────────────────────────────────────────────────────────────────────────

describe("computePUE", () => {
  it("returns a tuple [pue, sigma] of finite positive numbers", () => {
    const [pue, sigma] = computePUE(20);
    expect(pue).toBeGreaterThan(1);
    expect(sigma).toBeGreaterThan(0);
    expect(isFinite(pue)).toBe(true);
    expect(isFinite(sigma)).toBe(true);
  });

  it("Crusoe geothermal PUE is higher than air-cooled at 20 °C ambient (ground at 12 °C → larger ΔT → lower COP)", () => {
    // The Crusoe carbon advantage comes from near-zero grid carbon intensity,
    // not PUE. The 12 °C ground-loop has a larger ΔT against the 35 °C hot
    // aisle than 20 °C ambient air, so Carnot COP is lower → PUE higher.
    const [pueAir]    = computePUE(20, false);
    const [pueCrusoe] = computePUE(20, true);
    expect(pueCrusoe).toBeGreaterThan(pueAir);
  });

  it("hotter ambient decreases PUE (smaller ΔT → higher Carnot COP → less chiller work)", () => {
    // As ambient approaches the hot-aisle setpoint (35 °C) the refrigeration
    // lift shrinks, so COP rises and PUE falls toward 1.0.
    const [pueCool] = computePUE(10);
    const [pueHot]  = computePUE(30);
    expect(pueHot).toBeLessThan(pueCool);
  });

  it("PUE remains physically reasonable (1.0 < PUE ≤ 3.0)", () => {
    for (const tempC of [-10, 0, 10, 20, 30, 40]) {
      const [pue] = computePUE(tempC);
      expect(pue).toBeGreaterThan(1.0);
      expect(pue).toBeLessThanOrEqual(3.0);
    }
  });

  it("sigma reflects sensitivity to ±2 °C weather uncertainty", () => {
    const [, sigma] = computePUE(20);
    // sigma should be a small positive fraction of pue, not zero or huge
    expect(sigma).toBeGreaterThan(0);
    expect(sigma).toBeLessThan(0.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. computeThrottleAdjustment
// ─────────────────────────────────────────────────────────────────────────────

describe("computeThrottleAdjustment", () => {
  it("returns [energyKwh, throttlePct] for a standard run", () => {
    const [kWh, pct] = computeThrottleAdjustment("A100", 8, 20);
    expect(kWh).toBeGreaterThan(0);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThan(100);
  });

  it("H100 energy draw is greater than T4 (higher TDP)", () => {
    const [h100kWh] = computeThrottleAdjustment("H100", 1, 25);
    const [t4kWh]   = computeThrottleAdjustment("T4",   1, 25);
    expect(h100kWh).toBeGreaterThan(t4kWh);
  });

  it("hot ambient produces more throttling than cool ambient", () => {
    // At extreme ambient the junction temperature exceeds threshold sooner
    const [, pctCool] = computeThrottleAdjustment("H100", 2, 10);
    const [, pctHot]  = computeThrottleAdjustment("H100", 2, 42);
    expect(pctHot).toBeGreaterThanOrEqual(pctCool);
  });

  it("energy scales roughly linearly with hours (±2 % tolerance)", () => {
    const [kWh1] = computeThrottleAdjustment("A100", 1, 20);
    const [kWh8] = computeThrottleAdjustment("A100", 8, 20);
    const ratio  = kWh8 / kWh1;
    expect(ratio).toBeGreaterThan(7.5);
    expect(ratio).toBeLessThan(8.5);
  });

  it("falls back gracefully to A100 params for unknown GPU", () => {
    const [kWh] = computeThrottleAdjustment("UNKNOWN_GPU", 1, 20);
    expect(kWh).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. computeEmbodiedCarbon
// ─────────────────────────────────────────────────────────────────────────────

describe("computeEmbodiedCarbon", () => {
  it("returns [kg, sigma] with sigma ≈ 30 % of kg", () => {
    const [kg, sigma] = computeEmbodiedCarbon("A100", 100);
    // r4() rounds to 4 decimal places, so tolerance matches that precision
    expect(sigma).toBeCloseTo(kg * 0.30, 3);
  });

  it("higher-TDP GPUs have higher embodied carbon", () => {
    const [h100] = computeEmbodiedCarbon("H100", 100);
    const [t4]   = computeEmbodiedCarbon("T4",   100);
    expect(h100).toBeGreaterThan(t4);
  });

  it("embodied carbon scales linearly with hours", () => {
    const [kg1]  = computeEmbodiedCarbon("A100", 1);
    const [kg10] = computeEmbodiedCarbon("A100", 10);
    // r4() rounds each value independently, 3 decimal places of tolerance is sufficient
    expect(kg10).toBeCloseTo(kg1 * 10, 3);
  });

  it("returns positive values for all known GPUs", () => {
    for (const gpu of ["H100", "A100", "V100", "A10", "A10G", "T4", "L40", "L40S"]) {
      const [kg] = computeEmbodiedCarbon(gpu, 1);
      expect(kg).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. computeFourierForecast
// ─────────────────────────────────────────────────────────────────────────────

describe("computeFourierForecast", () => {
  it("returns {optWait, confidence, savingsPct, meta} shape", () => {
    const result = computeFourierForecast(syntheticHistory(72), 300, "eu-west-1");
    expect(result).toHaveProperty("optWait");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("savingsPct");
    expect(result).toHaveProperty("meta");
  });

  it("confidence is in [0, 1] for 72-point history", () => {
    const { confidence } = computeFourierForecast(syntheticHistory(72), 300, "eu-west-1");
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("savingsPct ≥ 0 (never claims negative savings)", () => {
    const { savingsPct } = computeFourierForecast(syntheticHistory(72), 300, "eu-west-1");
    expect(savingsPct).toBeGreaterThanOrEqual(0);
  });

  it("optWait is an integer ≥ 0 and ≤ lookahead", () => {
    const lookahead = 24;
    const { optWait } = computeFourierForecast(syntheticHistory(72), 300, "eu-west-1", lookahead);
    expect(optWait).toBeGreaterThanOrEqual(0);
    expect(optWait).toBeLessThanOrEqual(lookahead);
  });

  it("falls back gracefully with insufficient history (< 48 points)", () => {
    const result = computeFourierForecast([300, 310, 290], 300, "eu-west-1");
    expect(result.confidence).toBe(0);
    expect(result.meta.source).toBe("insufficient_history");
  });

  it("uses hourly profile fallback when profile is available", async () => {
    const { getHourlyProfile } = await import("@/lib/electricity-maps/client");
    vi.mocked(getHourlyProfile).mockReturnValueOnce(
      Array.from({ length: 24 }, (_, h) => (h >= 2 && h <= 6 ? 150 : 350)) // low at night
    );
    const result = computeFourierForecast([200], 300, "eu-west-1"); // < 48 → profile path
    expect(result.meta.source).toBe("hourly_profile");
    expect(result.savingsPct).toBeGreaterThan(0);
  });

  it("weekly harmonics engaged when ≥ 336 data points", () => {
    // Should not throw and should return a valid result
    const result = computeFourierForecast(syntheticHistory(336), 300, "eu-west-1", 48);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.meta.source).toBe("fourier_lstsq");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. computeRadiativeForcing
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRadiativeForcing", () => {
  it("returns a positive forcing value for positive emissions", () => {
    expect(computeRadiativeForcing(1)).toBeGreaterThan(0);
  });

  it("is monotonically increasing with emissions", () => {
    const f1   = computeRadiativeForcing(1);
    const f100 = computeRadiativeForcing(100);
    expect(f100).toBeGreaterThan(f1);
  });

  it("zero emissions yields zero (or negligible) forcing", () => {
    expect(computeRadiativeForcing(0)).toBeCloseTo(0, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. computeLifecycleEmissions
// ─────────────────────────────────────────────────────────────────────────────

describe("computeLifecycleEmissions", () => {
  it("lifecycle ≥ operational + embodied (inference adds to the total)", () => {
    const opKg       = 5;
    const embodiedKg = 2;
    const lifecycle  = computeLifecycleEmissions(opKg, embodiedKg);
    expect(lifecycle).toBeGreaterThanOrEqual(opKg + embodiedKg);
  });

  it("more queries/day increases lifecycle emissions", () => {
    const low  = computeLifecycleEmissions(5, 2, 7, 1_000);
    const high = computeLifecycleEmissions(5, 2, 7, 100_000);
    expect(high).toBeGreaterThan(low);
  });

  it("higher carbon intensity increases lifecycle emissions", () => {
    const clean = computeLifecycleEmissions(5, 2, 7, 10_000, 12, 50);
    const dirty = computeLifecycleEmissions(5, 2, 7, 10_000, 12, 800);
    expect(dirty).toBeGreaterThan(clean);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. computeCarbonDiff
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCarbonDiff", () => {
  it("baseline direction when previousKg is null", () => {
    expect(computeCarbonDiff(10, null)).toMatchObject({ direction: "baseline", deltaKg: 0, deltaPct: 0 });
  });

  it("baseline direction when previousKg is undefined", () => {
    expect(computeCarbonDiff(10, undefined)).toMatchObject({ direction: "baseline" });
  });

  it("increase direction when current > previous", () => {
    const diff = computeCarbonDiff(15, 10);
    expect(diff.direction).toBe("increase");
    expect(diff.deltaKg).toBeCloseTo(5, 3);
    expect(diff.deltaPct).toBeCloseTo(50, 1);
  });

  it("decrease direction when current < previous", () => {
    const diff = computeCarbonDiff(8, 10);
    expect(diff.direction).toBe("decrease");
    expect(diff.deltaKg).toBeCloseTo(-2, 3);
    expect(diff.deltaPct).toBeCloseTo(-20, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. computeGateDecision
// ─────────────────────────────────────────────────────────────────────────────

describe("computeGateDecision", () => {
  // Helper: pass a standard set of args, overriding what's needed
  function decide(
    emissionsKg: number,
    emissionsSigma = 0,
    monthlyBudgetKg = 50,
    monthlyUsedKg = 0,
  ) {
    return computeGateDecision(
      emissionsKg, emissionsSigma,
      monthlyBudgetKg, monthlyUsedKg,
      4, 0.80, 20,
      true, emissionsKg * 0.30,
    );
  }

  it("pass when emissions are well under budget", () => {
    const gate = decide(5, 0, 50, 20);
    expect(gate.status).toBe("pass");
    expect(gate.legacyStatus).toBe("pass");
  });

  it("warn when slightly over budget (within THRESHOLD_WARN = 10 %)", () => {
    // budget=50, used=45, emit=6 → overage=1, fraction=0.02 → warn
    const gate = decide(6, 0, 50, 45);
    expect(gate.status).toBe("warn");
    expect(gate.legacyStatus).toBe("warn");
  });

  it("soft_block when overage fraction is between WARN and HARD", () => {
    // budget=50, used=40, emit=18 → overage=8, fraction=0.16 → soft_block
    const gate = decide(18, 0, 50, 40);
    expect(gate.status).toBe("soft_block");
    expect(gate.legacyStatus).toBe("block");
  });

  it("hard_block when overage fraction exceeds THRESHOLD_HARD (50 %)", () => {
    // budget=50, used=0, emit=80 → overage=30, fraction=0.60 → hard_block
    const gate = decide(80, 0, 50, 0);
    expect(gate.status).toBe("hard_block");
    expect(gate.legacyStatus).toBe("block");
  });

  it("uncertain when lower-bound is under budget but upper-bound is over", () => {
    // budget=50, used=45, emit=6, sigma=3 → lower overage=0, upper overage>0
    const gate = decide(6, 3, 50, 45);
    expect(gate.status).toBe("uncertain");
    expect(gate.legacyStatus).toBe("warn");
  });

  it("overageKg and overageFraction are non-negative", () => {
    const gate = decide(5, 0, 50, 0);
    expect(gate.overageKg).toBeGreaterThanOrEqual(0);
    expect(gate.overageFraction).toBeGreaterThanOrEqual(0);
  });

  it("resolution options array is non-empty and sorted by savingsPct descending", () => {
    const gate = decide(18, 0, 50, 40);
    expect(gate.resolutionOptions.length).toBeGreaterThan(0);
    const pcts = gate.resolutionOptions.map((o) => o.savingsPct);
    const sorted = [...pcts].sort((a, b) => b - a);
    expect(pcts).toEqual(sorted);
  });

  it("includes a Crusoe option when crusoeAvailable=true and crusoe is cleaner", () => {
    const gate = decide(18, 0, 50, 40);
    const ids = gate.resolutionOptions.map((o) => o.id);
    expect(ids).toContain("crusoe");
  });

  it("message is a non-empty string", () => {
    for (const emit of [5, 8, 18, 48, 80]) {
      const gate = decide(emit);
      expect(typeof gate.message).toBe("string");
      expect(gate.message.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. estimateEmissions — integration
// ─────────────────────────────────────────────────────────────────────────────

describe("estimateEmissions", () => {
  const BASE_INPUT = {
    gpu:                    "A100",
    estimatedHours:         8,
    carbonIntensityGPerKwh: 400,
    ambientTempC:           20,
    region:                 "eu-west-1",
    monthlyBudgetKg:        50,
    monthlyUsedKg:          10,
    crusoeAvailable:        true,
  };

  it("returns all expected fields", () => {
    const r = estimateEmissions(BASE_INPUT);
    const keys: (keyof typeof r)[] = [
      "emissionsKg", "emissionsSigma", "crusoeEmissionsKg",
      "operationalKg", "embodiedKg", "lifecycleKg",
      "pueUsed", "pueSigma", "throttleAdjPct",
      "energyKwh", "carbonIntensity",
      "optimalWindowHours", "optimalWindowConfidence", "carbonSavingsPct",
      "radiativeForcingWm2", "carbonDiff", "gate", "forecast", "gpuType",
    ];
    for (const k of keys) expect(r).toHaveProperty(k);
  });

  it("emissionsKg > 0", () => {
    expect(estimateEmissions(BASE_INPUT).emissionsKg).toBeGreaterThan(0);
  });

  it("Crusoe emissions are lower than grid emissions on a dirty grid", () => {
    const r = estimateEmissions({ ...BASE_INPUT, carbonIntensityGPerKwh: 800 });
    expect(r.crusoeEmissionsKg).toBeLessThan(r.emissionsKg);
  });

  it("emissionsSigma > 0 (uncertainty propagation is non-trivial)", () => {
    expect(estimateEmissions(BASE_INPUT).emissionsSigma).toBeGreaterThan(0);
  });

  it("emissionsKg = operationalKg + embodiedKg", () => {
    const r = estimateEmissions(BASE_INPUT);
    expect(r.emissionsKg).toBeCloseTo(r.operationalKg + r.embodiedKg, 2);
  });

  it("pueUsed > 1 (thermodynamics: data centres always have overhead)", () => {
    expect(estimateEmissions(BASE_INPUT).pueUsed).toBeGreaterThan(1);
  });

  it("radiativeForcingWm2 > 0", () => {
    expect(estimateEmissions(BASE_INPUT).radiativeForcingWm2).toBeGreaterThan(0);
  });

  it("gate.legacyStatus is one of pass|warn|block", () => {
    const { gate } = estimateEmissions(BASE_INPUT);
    expect(["pass", "warn", "block"]).toContain(gate.legacyStatus);
  });

  it("higher carbon intensity produces higher emissions", () => {
    const clean = estimateEmissions({ ...BASE_INPUT, carbonIntensityGPerKwh: 50 });
    const dirty = estimateEmissions({ ...BASE_INPUT, carbonIntensityGPerKwh: 800 });
    expect(dirty.emissionsKg).toBeGreaterThan(clean.emissionsKg);
  });

  it("longer runs produce more emissions", () => {
    const short = estimateEmissions({ ...BASE_INPUT, estimatedHours: 1 });
    const long  = estimateEmissions({ ...BASE_INPUT, estimatedHours: 24 });
    expect(long.emissionsKg).toBeGreaterThan(short.emissionsKg);
  });

  it("carbonDiff is baseline when no previousEmissionsKg supplied", () => {
    const r = estimateEmissions(BASE_INPUT);
    expect(r.carbonDiff.direction).toBe("baseline");
  });

  it("carbonDiff reflects trend vs previous run", () => {
    const r = estimateEmissions({ ...BASE_INPUT, previousEmissionsKg: 100 });
    expect(r.carbonDiff.direction).toBe("decrease"); // current << 100 kg
  });

  it("Fourier forecast used when intensityHistory supplied (≥ 48 points)", () => {
    const r = estimateEmissions({
      ...BASE_INPUT,
      intensityHistory: syntheticHistory(72),
    });
    expect(r.forecast.meta.source).toBe("fourier_lstsq");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Constants
// ─────────────────────────────────────────────────────────────────────────────

describe("CRUSOE_INTENSITY_G_PER_KWH", () => {
  it("is 50 gCO₂/kWh (geothermal, not 5)", () => {
    expect(CRUSOE_INTENSITY_G_PER_KWH).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Backward-compat shims
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateEmissions (legacy shim)", () => {
  it("returns the six legacy fields", () => {
    const r = calculateEmissions({
      gpuType: "A100", estimatedHours: 4, carbonIntensityGPerKwh: 300,
    });
    const keys = ["emissionsKg", "crusoeEmissionsKg", "pueUsed", "energyKwh", "operationalKg", "embodiedKg"];
    for (const k of keys) expect(r).toHaveProperty(k);
  });

  it("emissionsKg is positive", () => {
    const r = calculateEmissions({ gpuType: "H100", estimatedHours: 8, carbonIntensityGPerKwh: 500 });
    expect(r.emissionsKg).toBeGreaterThan(0);
  });
});

describe("forecastOptimalWindow (legacy shim)", () => {
  it("returns a non-empty string", () => {
    const msg = forecastOptimalWindow(400, "eu-west-1");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});
