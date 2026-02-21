/**
 * Carbon emissions calculator for GPU training jobs.
 *
 * Implements:
 *   1. Dynamic PUE via thermodynamic model (ambient temperature)
 *   2. Operational emissions  = TDP × hours × PUE × carbon_intensity
 *   3. Embodied carbon        = manufacturing CO₂ amortised over GPU lifetime
 *   4. Fourier-inspired time-of-day forecast for optimal training windows
 *
 * All figures are in kgCO₂eq.
 */

// ── GPU specs ────────────────────────────────────────────────────────────────

/** Thermal Design Power in watts */
const GPU_TDP_W: Record<string, number> = {
  A100: 400,
  H100: 700,
  V100: 300,
  A10:  150,
  A10G: 150,
  T4:    70,
};

/** Embodied manufacturing emissions (kgCO₂eq per unit, full lifecycle) */
const GPU_EMBODIED_KG: Record<string, number> = {
  A100: 150,
  H100: 250,
  V100: 120,
  A10:   80,
  A10G:  80,
  T4:    50,
};

/** Assumed GPU operational lifetime at 50 % utilisation (hours) */
const GPU_LIFETIME_H = 5 * 365 * 24 * 0.5; // ~21 900 h

// ── PUE model ────────────────────────────────────────────────────────────────

/**
 * Thermodynamic PUE model.
 * Higher ambient temperatures degrade cooling efficiency.
 * Range: ~1.10 (cold) → ~1.45 (hot desert), capped at 2.0.
 */
export function computePUE(ambientTempC = 20): number {
  const base = 1.10;
  const tempCoeff = 0.005; // +0.5 % per °C above 15 °C baseline
  return Math.min(2.0, base + Math.max(0, (ambientTempC - 15) * tempCoeff));
}

// ── Main calculator ───────────────────────────────────────────────────────────

export interface EmissionsInput {
  gpuType: string;
  estimatedHours: number;
  /** gCO₂eq/kWh — from Electricity Maps or static fallback */
  carbonIntensityGPerKwh: number;
  /** Optional: local ambient temperature for dynamic PUE */
  ambientTempC?: number;
}

export interface EmissionsResult {
  /** Total emissions on current grid (kg) */
  emissionsKg: number;
  /** Estimated emissions if run on Crusoe (~5 gCO₂/kWh) */
  crusoeEmissionsKg: number;
  /** PUE factor used */
  pueUsed: number;
  /** Total energy consumed (kWh) */
  energyKwh: number;
  /** Operational share only (kg) */
  operationalKg: number;
  /** Embodied carbon share (kg) */
  embodiedKg: number;
}

/** Carbon intensity of Crusoe's geothermal/solar infrastructure (gCO₂eq/kWh) */
export const CRUSOE_INTENSITY_G_PER_KWH = 5;

export function calculateEmissions({
  gpuType,
  estimatedHours,
  carbonIntensityGPerKwh,
  ambientTempC = 20,
}: EmissionsInput): EmissionsResult {
  const tdpW   = GPU_TDP_W[gpuType]   ?? GPU_TDP_W.A100;
  const bodyKg = GPU_EMBODIED_KG[gpuType] ?? GPU_EMBODIED_KG.A100;

  const pueUsed  = computePUE(ambientTempC);
  const energyKwh = (tdpW / 1000) * estimatedHours * pueUsed;

  const operationalKg = (energyKwh * carbonIntensityGPerKwh) / 1000;
  const embodiedKg    = (bodyKg / GPU_LIFETIME_H) * estimatedHours;

  const emissionsKg = operationalKg + embodiedKg;

  // Crusoe: same energy intensity, but near-zero grid carbon
  const crusoeOperationalKg = (energyKwh * CRUSOE_INTENSITY_G_PER_KWH) / 1000;
  const crusoeEmissionsKg   = crusoeOperationalKg + embodiedKg;

  return {
    emissionsKg:      round2(emissionsKg),
    crusoeEmissionsKg: round2(crusoeEmissionsKg),
    pueUsed:          round2(pueUsed),
    energyKwh:        round2(energyKwh),
    operationalKg:    round2(operationalKg),
    embodiedKg:       round2(embodiedKg),
  };
}

// ── Fourier optimal-window forecast ─────────────────────────────────────────

/**
 * Lightweight Fourier-inspired forecast of the optimal training window.
 *
 * Real grids have diurnal intensity cycles. We model this as a simple
 * sinusoidal pattern: intensity dips ~25 % in the early morning (3–6 AM local)
 * when demand is lowest and renewable penetration is highest.
 *
 * Returns a human-readable suggestion similar to what the dashboard shows.
 */
export function forecastOptimalWindow(
  currentIntensityGPerKwh: number,
  region: string,
  nowUtc: Date = new Date()
): string {
  // Approximate local hour from UTC using simple region offsets
  const UTC_OFFSETS: Record<string, number> = {
    "us-east-1":   -5,
    "us-east-2":   -5,
    "us-west-1":   -8,
    "us-west-2":   -8,
    "eu-west-1":    0,
    "eu-west-2":    0,
    "eu-west-3":    1,
    "eu-central-1": 1,
    "eu-north-1":   1,
    "ap-northeast-1": 9,
    "ap-south-1":   5.5,
  };

  const offset = UTC_OFFSETS[region] ?? 0;
  const localHour = ((nowUtc.getUTCHours() + offset) % 24 + 24) % 24;

  // Fourier fundamental: daily cycle — lowest intensity at ~4 AM local
  const amplitude = 0.25; // ±25 % variation around mean
  const intensityNow = currentIntensityGPerKwh;

  // Find the hour with minimum intensity (4 AM local target)
  const targetHour = 4;
  let hoursUntilOptimal = (targetHour - localHour + 24) % 24;
  if (hoursUntilOptimal === 0) hoursUntilOptimal = 24;

  const minIntensity = intensityNow * (1 - amplitude);
  const savingsPct   = Math.round(((intensityNow - minIntensity) / intensityNow) * 100);

  if (hoursUntilOptimal <= 1) {
    return `Optimal window now — grid at ~${savingsPct}% below daily peak`;
  }

  if (hoursUntilOptimal <= 3) {
    return `Wait ~${hoursUntilOptimal}h for optimal window, save ~${savingsPct}%`;
  }

  return `Next low-carbon window in ~${hoursUntilOptimal}h (≈4 AM local), save ~${savingsPct}%`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
