/**
 * GPU power draw in kW (TDP). Swap with Person 2's physics engine values.
 */
const GPU_POWER_KW: Record<string, number> = {
  A100: 0.3,
  H100: 0.7,
  V100: 0.25,
  A10: 0.15
};

/**
 * Regional grid carbon intensity in gCO₂/kWh.
 * Person 2's engine should replace these with real-time Electricity Maps data.
 */
const GRID_INTENSITY: Record<string, number> = {
  "us-east-1": 420,
  "us-west-2": 310,
  "eu-west-1": 295,
  "eu-central-1": 380,
  "ap-southeast-1": 510
};

const DEFAULT_PUE = 1.15;

/**
 * Crusoe's geothermal grid runs at ~18 gCO₂/kWh regardless of region.
 */
const CRUSOE_GRID_INTENSITY = 18;
const CRUSOE_PUE = 1.05;

export type EmissionsEstimate = {
  emissionsKg: number;
  crusoeEmissionsKg: number;
  carbonIntensity: number;
  pueUsed: number;
};

export function estimateEmissions(
  gpu: string,
  estimatedHours: number,
  region: string
): EmissionsEstimate {
  const powerKw = GPU_POWER_KW[gpu] ?? GPU_POWER_KW.A100;
  const intensity = GRID_INTENSITY[region] ?? 400;

  const energyKwh = powerKw * estimatedHours * DEFAULT_PUE;
  const emissionsKg = (energyKwh * intensity) / 1000;

  const crusoeEnergyKwh = powerKw * estimatedHours * CRUSOE_PUE;
  const crusoeEmissionsKg = (crusoeEnergyKwh * CRUSOE_GRID_INTENSITY) / 1000;

  return {
    emissionsKg: Math.round(emissionsKg * 100) / 100,
    crusoeEmissionsKg: Math.round(crusoeEmissionsKg * 100) / 100,
    carbonIntensity: intensity,
    pueUsed: DEFAULT_PUE
  };
}
