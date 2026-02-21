/**
 * Carbon emissions calculator — full physics model.
 *
 * Ported from calculations.py. Implements:
 *   1.  Carnot-based dynamic PUE (Crusoe geothermal vs ambient air cooling)
 *   2.  GPU thermal throttling via RK4 ODE (coupled thermal lag + power model)
 *   3.  Embodied manufacturing carbon with ±30 % σ
 *   4.  Uncertainty propagation through the full chain (quadrature)
 *   5.  Multi-period Fourier least-squares forecast (24h + 168h harmonics)
 *   6.  Graduated gate decision (pass / warn / soft_block / hard_block / uncertain)
 *   7.  Crusoe reroute alternative (geothermal ground-loop PUE advantage)
 *   8.  Carbon diff against previous run
 *   9.  Lifecycle projection (training + embodied + inference cascade)
 *   10. IPCC AR6 radiative forcing contribution
 *
 * All figures are in kgCO₂eq unless otherwise stated.
 */

import { getHourlyProfile } from "@/lib/electricity-maps/client";

// ─────────────────────────────────────────────────────────────────────────────
// GPU reference data (from calculations.py)
// ─────────────────────────────────────────────────────────────────────────────

const GPU_TDP_W: Record<string, number> = {
  H100: 700, A100: 400, V100: 300,
  A10: 150, A10G: 150, T4: 70,
  L40: 300, L40S: 350,
};

/** LCA-sourced embodied carbon estimates (kgCO₂eq). ±30 % uncertainty. */
const GPU_EMBODIED_KG: Record<string, number> = {
  H100: 150, A100: 100, V100: 75,
  A10: 50, A10G: 50, T4: 30,
  L40: 90, L40S: 100,
};

const GPU_THERMAL: Record<string, {
  T_threshold: number; T_range: number; alpha: number; R_thermal: number;
}> = {
  H100:  { T_threshold: 83, T_range: 10, alpha: 0.20, R_thermal: 0.08 },
  A100:  { T_threshold: 85, T_range: 10, alpha: 0.18, R_thermal: 0.09 },
  V100:  { T_threshold: 88, T_range: 10, alpha: 0.15, R_thermal: 0.10 },
  A10:   { T_threshold: 90, T_range: 10, alpha: 0.12, R_thermal: 0.12 },
  A10G:  { T_threshold: 90, T_range: 10, alpha: 0.12, R_thermal: 0.12 },
  T4:    { T_threshold: 88, T_range: 10, alpha: 0.10, R_thermal: 0.15 },
  L40:   { T_threshold: 85, T_range: 10, alpha: 0.18, R_thermal: 0.09 },
  L40S:  { T_threshold: 85, T_range: 10, alpha: 0.18, R_thermal: 0.09 },
};

const GPU_LIFETIME_HOURS   = 35_000;
const GPU_UTILISATION_RATE = 0.70;

// ─────────────────────────────────────────────────────────────────────────────
// Physics constants
// ─────────────────────────────────────────────────────────────────────────────

/** Crusoe geothermal grid intensity (gCO₂/kWh) */
export const CRUSOE_INTENSITY_G_PER_KWH = 50;

/** Crusoe geothermal ground-loop temperature (K) ~12 °C year-round */
const CRUSOE_GROUND_TEMP_K = 285.0;

/** Fraction of Carnot COP achieved by real chiller systems */
const ETA_COOLING = 0.60;

/** Data-centre hot aisle setpoint (°C) */
const T_HOT_C = 35.0;

/** IPCC AR6 logarithmic forcing coefficient (W/m²) */
const ALPHA_FORCING     = 5.35;
const CO2_PREINDUSTRIAL = 280.0; // ppm
const CO2_CURRENT       = 422.0; // ppm — NOAA MLO 2025

/** Gate overage thresholds (fraction of monthly budget) */
const THRESHOLD_WARN = 0.10;
const THRESHOLD_SOFT = 0.20;
const THRESHOLD_HARD = 0.50;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Carnot-based PUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive PUE from first principles via Carnot COP.
 *
 *   COP_carnot = T_cold / (T_hot - T_cold)   [Kelvin]
 *   COP_actual = η × COP_carnot
 *   PUE        = 1 + 1 / COP_actual
 *
 * For Crusoe, T_cold is the geothermal ground-loop (~12 °C), independent of
 * ambient air — this is the thermodynamic source of Crusoe's PUE advantage.
 *
 * Returns [pue, sigma] where sigma is propagated from ±2 °C weather uncertainty.
 */
export function computePUE(ambientTempC: number, isCrusoe = false): [number, number] {
  const T_hot_K = T_HOT_C + 273.15;
  let T_cold_K  = isCrusoe ? CRUSOE_GROUND_TEMP_K : ambientTempC + 273.15;
  T_cold_K      = Math.min(T_cold_K, T_hot_K - 1.0);

  const pue = calcPUE(T_cold_K, T_hot_K);

  const dt    = 2.0;
  const pueHi = calcPUE(T_cold_K + dt, T_hot_K);
  const pueLo = calcPUE(T_cold_K - dt, T_hot_K);
  const sigma = Math.abs(pueHi - pueLo) / 2.0;

  return [r4(pue), r4(sigma)];
}

function calcPUE(T_cold_K: number, T_hot_K: number): number {
  const tc = Math.min(T_cold_K, T_hot_K - 1.0);
  return 1.0 + 1.0 / (ETA_COOLING * (tc / (T_hot_K - tc)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GPU thermal throttling via RK4 ODE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solve the coupled thermal-power ODE for actual GPU energy draw.
 *
 *   P(T_j)  = P_tdp × (1 − α × clamp((T_j − T_thresh) / T_range, 0, 1))
 *   dT_j/dt = (T_ambient + P(T_j)×R_thermal − T_j) / τ    τ = 60 s
 *
 * Uses RK4 with 30-second steps. For long H100 runs with marginal airflow,
 * throttling reduces actual energy draw 10–15 % vs naive TDP × hours.
 *
 * Returns [energyKwh, throttlePct].
 */
export function computeThrottleAdjustment(
  gpu: string,
  hours: number,
  ambientTempC: number,
): [number, number] {
  const params = GPU_THERMAL[gpu] ?? GPU_THERMAL.A100;
  const P_tdp  = GPU_TDP_W[gpu]   ?? GPU_TDP_W.A100;
  const TAU    = 60.0;

  function powerAt(T_j: number): number {
    const throttle = params.alpha * Math.max(0, (T_j - params.T_threshold) / params.T_range);
    return P_tdp * (1.0 - Math.min(throttle, params.alpha));
  }

  function dTdt(T_j: number): number {
    const T_ss = ambientTempC + powerAt(T_j) * params.R_thermal;
    return (T_ss - T_j) / TAU;
  }

  const totalSecs = hours * 3600;
  const dtStep    = 30.0;
  const steps     = Math.max(200, Math.ceil(totalSecs / dtStep));
  const dt        = totalSecs / steps;

  let T_j     = ambientTempC;
  let energyJ = 0.0;

  for (let i = 0; i < steps; i++) {
    const k1 = dTdt(T_j);
    const k2 = dTdt(T_j + 0.5 * dt * k1);
    const k3 = dTdt(T_j + 0.5 * dt * k2);
    const k4 = dTdt(T_j + dt * k3);
    T_j      += (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4);
    energyJ  += powerAt(T_j) * dt;
  }

  const energyKwh   = energyJ / 3_600_000.0;
  const naiveKwh    = (P_tdp * hours) / 1000.0;
  const throttlePct = (1.0 - energyKwh / naiveKwh) * 100.0;

  return [r4(energyKwh), r4(Math.max(0, throttlePct))];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Embodied carbon
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Amortise manufacturing carbon over GPU lifetime.
 *   C_per_hour = C_mfg / (lifetime_hours × utilisation_rate)
 * Returns [embodiedKg, sigma] where sigma is ±30 % from LCA uncertainty.
 */
export function computeEmbodiedCarbon(gpu: string, hours: number): [number, number] {
  const C_mfg      = GPU_EMBODIED_KG[gpu] ?? GPU_EMBODIED_KG.A100;
  const perHour    = C_mfg / (GPU_LIFETIME_HOURS * GPU_UTILISATION_RATE);
  const embodiedKg = perHour * hours;
  return [r4(embodiedKg), r4(embodiedKg * 0.30)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Multi-period Fourier least-squares forecast
// ─────────────────────────────────────────────────────────────────────────────

export interface ForecastResult {
  optWait: number;
  confidence: number;
  savingsPct: number;
  meta: Record<string, number | string | null | undefined>;
}

/**
 * Fit a multi-period Fourier series to hourly carbon intensity history and
 * find the lowest-carbon window within the next lookaheadHours.
 *
 * Periodicities: 24h (solar/demand), 168h (weekly), 336h (bi-weekly).
 * Confidence is penalised by residual std relative to forecast range,
 * then further discounted by grid volatility.
 *
 * Falls back to the real Electricity Maps hourly profile when history < 48 points.
 */
export function computeFourierForecast(
  intensityHistory: number[],
  currentIntensity: number,
  region: string,
  lookaheadHours = 48,
): ForecastResult {
  // ── real hourly profile fallback ────────────────────────────────────────
  if (intensityHistory.length < 48) {
    const profile = getHourlyProfile(region);
    if (profile && profile.length === 24) {
      const nowH = new Date().getUTCHours();
      let minVal = Infinity, minIdx = 0;
      for (let i = 0; i < Math.min(lookaheadHours, 24); i++) {
        const h = (nowH + i) % 24;
        if (profile[h] < minVal) { minVal = profile[h]; minIdx = i; }
      }
      const savings = Math.max(0, (currentIntensity - minVal) / currentIntensity * 100);
      return {
        optWait: minIdx, confidence: 0.70, savingsPct: r2(savings),
        meta: { source: "hourly_profile", confidenceLabel: "moderate", minIntensityG: r2(minVal) },
      };
    }
    return { optWait: 0, confidence: 0, savingsPct: 0, meta: { source: "insufficient_history" } };
  }

  const N = intensityHistory.length;
  const nDaily  = 5;
  const nWeekly = N >= 336 ? 2 : 0;

  const X      = buildFourierMatrix(N, nDaily, nWeekly);
  const coeffs = lstsq(X, intensityHistory);

  // Forecast future hours
  const futureT: number[] = Array.from({ length: lookaheadHours }, (_, i) => N + i);
  const Xf       = buildFourierMatrixAtT(futureT, nDaily, nWeekly, N);
  const forecast = Xf.map((row) => row.reduce((s, x, j) => s + x * (coeffs[j] ?? 0), 0));

  let minVal = Infinity, minIdx = 0;
  forecast.forEach((v, i) => { if (v < minVal) { minVal = v; minIdx = i; } });

  const savingsPct = r2(Math.max(0, (currentIntensity - minVal) / currentIntensity * 100));

  // Confidence: residual std penalty + volatility discount
  const residuals  = intensityHistory.map((yi, i) =>
    yi - X[i].reduce((s, x, j) => s + x * (coeffs[j] ?? 0), 0)
  );
  const resStd     = stdDev(residuals);
  const fRange     = Math.max(...forecast) - Math.min(...forecast);
  const baseConf   = fRange > 0 ? Math.max(0, Math.min(1, 1 - resStd / fRange)) : 0.5;
  const volatility = stdDev(intensityHistory);
  const volDiscount = 0.40 * Math.min(1, volatility / 100);
  const confidence  = r4(Math.max(0, baseConf * (1 - volDiscount)));

  const label = confidence >= 0.75 ? "high"
              : confidence >= 0.50 ? "moderate"
              : confidence >= 0.25 ? "low"
              : "very low";

  return {
    optWait: minIdx, confidence, savingsPct,
    meta: {
      source: "fourier_lstsq",
      confidenceLabel: label,
      volatility: r2(volatility),
      residualStd: r2(resStd),
      minIntensityG: r2(minVal),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Radiative forcing (IPCC AR6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express this run's emissions as a marginal radiative forcing contribution.
 *   ΔF = α × ln(C_new / C₀) − α × ln(C_current / C₀)    [W/m²]
 */
export function computeRadiativeForcing(emissionsKg: number): number {
  const ATMOS_CO2_KG = 3.16e15;
  const ppmPerKg     = CO2_CURRENT / ATMOS_CO2_KG;
  const C_new        = CO2_CURRENT + emissionsKg * ppmPerKg;
  return ALPHA_FORCING * Math.log(C_new / CO2_PREINDUSTRIAL)
       - ALPHA_FORCING * Math.log(CO2_CURRENT / CO2_PREINDUSTRIAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lifecycle emissions (training + embodied + inference cascade)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ~1e-6 kWh per billion parameters per query (published benchmark rule of thumb).
 */
export function computeLifecycleEmissions(
  operationalKg: number,
  embodiedKg: number,
  modelParamsBillions = 7.0,
  queriesPerDay = 10_000,
  deploymentMonths = 12.0,
  carbonIntensity = 400.0,
): number {
  const inferenceKwh = modelParamsBillions * 1e-6 * queriesPerDay * deploymentMonths * 30;
  const inferenceKg  = (inferenceKwh * carbonIntensity) / 1000.0;
  return r3(operationalKg + embodiedKg + inferenceKg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Carbon diff
// ─────────────────────────────────────────────────────────────────────────────

export function computeCarbonDiff(
  currentKg: number,
  previousKg: number | null | undefined,
): { deltaKg: number; deltaPct: number; direction: "increase" | "decrease" | "baseline" } {
  if (!previousKg) return { deltaKg: 0, deltaPct: 0, direction: "baseline" };
  const delta = currentKg - previousKg;
  return {
    deltaKg:   r4(delta),
    deltaPct:  r2((delta / previousKg) * 100),
    direction: delta > 0 ? "increase" : "decrease",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Graduated gate decision
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolutionOption {
  id: string;
  label: string;
  description: string;
  savingsPct: number;
  costDelta: number;
  effort: "none" | "low" | "medium" | "high";
}

export interface GateDecision {
  status: "pass" | "warn" | "soft_block" | "hard_block" | "uncertain";
  /** Backward-compatible 3-state for the GitHub Action */
  legacyStatus: "pass" | "warn" | "block";
  overageKg: number;
  overageFraction: number;
  message: string;
  resolutionOptions: ResolutionOption[];
}

export function computeGateDecision(
  emissionsKg: number,
  emissionsSigma: number,
  monthlyBudgetKg: number,
  monthlyUsedKg: number,
  optWait: number,
  optConfidence: number,
  savingsPct: number,
  crusoeAvailable: boolean,
  crusoeEmissionsKg: number,
): GateDecision {
  const remaining   = monthlyBudgetKg - monthlyUsedKg;
  const overageKg   = Math.max(0, emissionsKg - remaining);
  const overageFrac = monthlyBudgetKg > 0 ? overageKg / monthlyBudgetKg : 0;

  const lowerOverage = Math.max(0, emissionsKg - emissionsSigma - remaining);
  const upperOverage = Math.max(0, emissionsKg + emissionsSigma - remaining);

  type S = GateDecision["status"];
  let status: S;
  if (lowerOverage === 0 && upperOverage > 0) status = "uncertain";
  else if (overageFrac === 0)                 status = "pass";
  else if (overageFrac <= THRESHOLD_WARN)     status = "warn";
  else if (overageFrac <= THRESHOLD_SOFT)     status = "soft_block";
  else if (overageFrac <= THRESHOLD_HARD)     status = "soft_block";
  else                                        status = "hard_block";

  const legacyStatus: GateDecision["legacyStatus"] =
    status === "pass" ? "pass" :
    (status === "warn" || status === "uncertain") ? "warn" : "block";

  const options: ResolutionOption[] = [];

  if (optWait > 0 && savingsPct > 5) {
    options.push({
      id: "wait", label: `Wait ${optWait}h`,
      description: `Carbon drops ${savingsPct.toFixed(0)}% — forecast confidence: ${optConfidence > 0.7 ? "high" : "moderate"}`,
      savingsPct, costDelta: 0, effort: "none",
    });
  }

  if (crusoeAvailable && crusoeEmissionsKg < emissionsKg) {
    const saving = r2((1 - crusoeEmissionsKg / emissionsKg) * 100);
    options.push({
      id: "crusoe", label: "Reroute to Crusoe",
      description: `${saving.toFixed(0)}% cleaner — geothermal, ~${CRUSOE_INTENSITY_G_PER_KWH} gCO₂/kWh`,
      savingsPct: saving, costDelta: 2.20, effort: "low",
    });
  }

  options.push({
    id: "reduce_epochs", label: "Reduce training epochs",
    description: "Halving epochs saves ~44% carbon and cuts runtime proportionally",
    savingsPct: 44, costDelta: 0, effort: "medium",
  });

  if (["soft_block", "hard_block", "uncertain"].includes(status)) {
    options.push({
      id: "override", label: "Override (justify)",
      description: "Add label carbon-override and comment your reason",
      savingsPct: 0, costDelta: 0, effort: "high",
    });
  }

  options.sort((a, b) => b.savingsPct - a.savingsPct);

  const messages: Record<S, string> = {
    pass:       `✅ Under budget — ${remaining.toFixed(1)} kg remaining this month.`,
    warn:       `⚠️  ${overageKg.toFixed(2)} kg over budget (+${(overageFrac * 100).toFixed(0)}%). Consider scheduling or Crusoe.`,
    soft_block: `🔶 Blocked — ${overageKg.toFixed(2)} kg over budget. Pick a resolution option to proceed.`,
    hard_block: `🔴 Hard block — ${overageKg.toFixed(2)} kg over budget (${(overageFrac * 100).toFixed(0)}%). Escalation required.`,
    uncertain:  `❓ Uncertain — emissions estimate spans the budget threshold (±${emissionsSigma.toFixed(2)} kg).`,
  };

  return {
    status, legacyStatus,
    overageKg: r4(overageKg),
    overageFraction: r4(overageFrac),
    message: messages[status],
    resolutionOptions: options,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Master orchestrator — estimateEmissions()
// ─────────────────────────────────────────────────────────────────────────────

export interface EmissionsInput {
  gpu: string;
  estimatedHours: number;
  /** gCO₂eq/kWh — from Electricity Maps or fallback */
  carbonIntensityGPerKwh: number;
  ambientTempC?: number;
  region?: string;
  intensityHistory?: number[];
  monthlyBudgetKg?: number;
  monthlyUsedKg?: number;
  previousEmissionsKg?: number | null;
  crusoeAvailable?: boolean;
  modelParamsBillions?: number;
  queriesPerDay?: number;
  deploymentMonths?: number;
  /** σ from Electricity Maps confidence band; defaults to 10 % of intensity */
  intensitySigmaGPerKwh?: number;
}

export interface EmissionsResult {
  emissionsKg: number;
  emissionsSigma: number;
  crusoeEmissionsKg: number;
  operationalKg: number;
  embodiedKg: number;
  lifecycleKg: number;
  pueUsed: number;
  pueSigma: number;
  throttleAdjPct: number;
  energyKwh: number;
  carbonIntensity: number;
  optimalWindowHours: number;
  optimalWindowConfidence: number;
  carbonSavingsPct: number;
  radiativeForcingWm2: number;
  carbonDiff: ReturnType<typeof computeCarbonDiff>;
  gate: GateDecision;
  forecast: ForecastResult;
  gpuType: string;
}

export function estimateEmissions(input: EmissionsInput): EmissionsResult {
  const {
    gpu, estimatedHours,
    carbonIntensityGPerKwh,
    ambientTempC = 20.0,
    region = "eu-west-1",
    intensityHistory = [],
    monthlyBudgetKg = 50,
    monthlyUsedKg = 0,
    previousEmissionsKg,
    crusoeAvailable = false,
    modelParamsBillions = 7.0,
    queriesPerDay = 10_000,
    deploymentMonths = 12.0,
    intensitySigmaGPerKwh,
  } = input;

  // 1. PUE (Carnot-based)
  const [pue, pueSigma]          = computePUE(ambientTempC, false);
  const [crusoePue]               = computePUE(ambientTempC, true);

  // 2. GPU thermal throttling (RK4 ODE)
  const [rawEnergyKwh, throttleAdj] = computeThrottleAdjustment(gpu, estimatedHours, ambientTempC);
  const totalEnergyKwh               = rawEnergyKwh * pue;
  const crusoeEnergyKwh              = rawEnergyKwh * crusoePue;

  // 3. Operational emissions
  const operationalKg  = (totalEnergyKwh * carbonIntensityGPerKwh) / 1000.0;
  const crusoeOpKg     = (crusoeEnergyKwh * CRUSOE_INTENSITY_G_PER_KWH) / 1000.0;

  // 4. Embodied carbon
  const [embodiedKg, embodiedSigma] = computeEmbodiedCarbon(gpu, estimatedHours);
  const emissionsKg                  = operationalKg + embodiedKg;
  const crusoeEmissionsKg            = crusoeOpKg + embodiedKg;

  // 5. Uncertainty propagation (quadrature)
  const intensitySigma = intensitySigmaGPerKwh ?? carbonIntensityGPerKwh * 0.10;
  const sigmaOp        = (totalEnergyKwh / 1000.0)
    * Math.sqrt((pueSigma / pue) ** 2 + (intensitySigma / carbonIntensityGPerKwh) ** 2)
    * carbonIntensityGPerKwh;
  const emissionsSigma = Math.sqrt(sigmaOp ** 2 + embodiedSigma ** 2);

  // 6. Fourier forecast
  const forecast = computeFourierForecast(intensityHistory, carbonIntensityGPerKwh, region, 48);

  // 7. Gate decision
  const gate = computeGateDecision(
    emissionsKg, emissionsSigma,
    monthlyBudgetKg, monthlyUsedKg,
    forecast.optWait, forecast.confidence, forecast.savingsPct,
    crusoeAvailable, crusoeEmissionsKg,
  );

  // 8. Secondary outputs
  const lifecycleKg = computeLifecycleEmissions(
    operationalKg, embodiedKg, modelParamsBillions, queriesPerDay, deploymentMonths, carbonIntensityGPerKwh,
  );
  const radiativeForcingWm2 = computeRadiativeForcing(emissionsKg);
  const carbonDiff          = computeCarbonDiff(emissionsKg, previousEmissionsKg);

  return {
    emissionsKg:             r4(emissionsKg),
    emissionsSigma:          r4(emissionsSigma),
    crusoeEmissionsKg:       r4(crusoeEmissionsKg),
    operationalKg:           r4(operationalKg),
    embodiedKg:              r4(embodiedKg),
    lifecycleKg,
    pueUsed:                 pue,
    pueSigma,
    throttleAdjPct:          throttleAdj,
    energyKwh:               r4(totalEnergyKwh),
    carbonIntensity:         carbonIntensityGPerKwh,
    optimalWindowHours:      forecast.optWait,
    optimalWindowConfidence: forecast.confidence,
    carbonSavingsPct:        forecast.savingsPct,
    radiativeForcingWm2,
    carbonDiff,
    gate,
    forecast,
    gpuType: gpu,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible shims
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use estimateEmissions() */
export function calculateEmissions(input: {
  gpuType: string;
  estimatedHours: number;
  carbonIntensityGPerKwh: number;
  ambientTempC?: number;
}) {
  const r = estimateEmissions({
    gpu: input.gpuType,
    estimatedHours: input.estimatedHours,
    carbonIntensityGPerKwh: input.carbonIntensityGPerKwh,
    ambientTempC: input.ambientTempC,
  });
  return {
    emissionsKg:       r.emissionsKg,
    crusoeEmissionsKg: r.crusoeEmissionsKg,
    pueUsed:           r.pueUsed,
    energyKwh:         r.energyKwh,
    operationalKg:     r.operationalKg,
    embodiedKg:        r.embodiedKg,
  };
}

/** @deprecated Use computeFourierForecast() */
export function forecastOptimalWindow(
  currentIntensityGPerKwh: number,
  region: string,
  _nowUtc: Date = new Date(),
): string {
  const f = computeFourierForecast([], currentIntensityGPerKwh, region);
  if (f.optWait === 0) return `Optimal window now — ${currentIntensityGPerKwh.toFixed(0)} gCO₂/kWh`;
  return `Next low-carbon window in ~${f.optWait}h — save ~${f.savingsPct.toFixed(0)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fourier matrix construction
// ─────────────────────────────────────────────────────────────────────────────

function buildFourierMatrix(N: number, nDaily: number, nWeekly: number): number[][] {
  return buildFourierMatrixAtT(Array.from({ length: N }, (_, i) => i), nDaily, nWeekly, N);
}

function buildFourierMatrixAtT(t: number[], nDaily: number, nWeekly: number, N: number): number[][] {
  return t.map((ti) => {
    const row = [1.0];
    for (let n = 1; n <= nDaily; n++) {
      row.push(Math.cos(2 * Math.PI * n * ti / 24.0));
      row.push(Math.sin(2 * Math.PI * n * ti / 24.0));
    }
    if (N >= 336 && nWeekly > 0) {
      for (let m = 1; m <= nWeekly; m++) {
        row.push(Math.cos(2 * Math.PI * m * ti / 168.0));
        row.push(Math.sin(2 * Math.PI * m * ti / 168.0));
      }
    }
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Linear algebra — normal-equations least-squares (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function lstsq(X: number[][], y: number[]): number[] {
  const m = X.length;
  const n = X[0].length;

  const XtX: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const Xty: number[]   = new Array<number>(n).fill(0);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < n; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  // Augmented matrix [XtX | Xty], Gauss-Jordan elimination
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col, maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) { maxVal = Math.abs(aug[row][col]); maxRow = row; }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col] / pivot;
      for (let k = col; k <= n; k++) aug[row][k] -= f * aug[col][k];
    }
  }

  return aug.map((row, i) => Math.abs(aug[i][i]) > 1e-12 ? row[n] / aug[i][i] : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics & rounding helpers
// ─────────────────────────────────────────────────────────────────────────────

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

function r2(n: number) { return Math.round(n * 100) / 100; }
function r3(n: number) { return Math.round(n * 1000) / 1000; }
function r4(n: number) { return Math.round(n * 10000) / 10000; }
