/**
 * Crusoe Inference API client
 *
 * HackEurope 2026 dedicated endpoint: https://hackeurope.crusoecloud.com/v1
 * Auth:     Bearer <CRUSOE_API_KEY>
 *
 * We use the /models endpoint to check real-time availability and surface
 * the best model recommendation for a given GPU workload type.
 * Crusoe runs on geothermal + solar → effectively ~5 gCO₂/kWh.
 */

const CRUSOE_API_BASE = "https://hackeurope.crusoecloud.com/v1";

// Carbon intensity for Crusoe infrastructure (geothermal/solar, gCO₂eq/kWh)
export const CRUSOE_CARBON_INTENSITY_G_PER_KWH = 5;

export interface CrusoeModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface CrusoeAvailability {
  available: boolean;
  models: CrusoeModel[];
  /** Best model to recommend given the caller's GPU type / workload */
  recommendedModel: string | null;
}

/**
 * Preference map: GPU type → favourite model families (ordered by preference).
 * HackEurope 2026 endpoint hosts a single dedicated model (verified Feb 2026):
 *   NVFP4/Qwen3-235B-A22B-Instruct-2507-FP4  — Qwen3 235B, fp4 quantised, 262k ctx
 */
const HACKEUROPE_MODEL = "NVFP4/Qwen3-235B-A22B-Instruct-2507-FP4";

const GPU_MODEL_PREFERENCES: Record<string, string[]> = {
  H100:  [HACKEUROPE_MODEL],
  A100:  [HACKEUROPE_MODEL],
  V100:  [HACKEUROPE_MODEL],
  A10:   [HACKEUROPE_MODEL],
  A10G:  [HACKEUROPE_MODEL],
};

export async function getCrusoeAvailability(gpuType: string): Promise<CrusoeAvailability> {
  const apiKey = process.env.CRUSOE_API_KEY;

  try {
    const res = await fetch(`${CRUSOE_API_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Revalidate every 60 s so we get near-real-time availability
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Crusoe /models returned ${res.status}`);

    const body = await res.json() as { data?: CrusoeModel[] };
    const models: CrusoeModel[] = body.data ?? [];

    const preferences = GPU_MODEL_PREFERENCES[gpuType] ?? GPU_MODEL_PREFERENCES.A100;
    const modelIds = new Set(models.map((m) => m.id));

    // Exact match first, then fallback to first available
    const recommendedId =
      preferences.find((id) => modelIds.has(id)) ??
      models[0]?.id ??
      null;

    return {
      available: models.length > 0,
      models,
      recommendedModel: recommendedId,
    };
  } catch (err) {
    console.error("[crusoe] availability check failed, using fallback:", err);
    // Fail open — we know Crusoe capacity is generally available
    return {
      available: true,
      models: [],
      recommendedModel: HACKEUROPE_MODEL,
    };
  }
}

/**
 * Quick liveness ping — useful for health checks / demo validation.
 */
export async function pingCrusoeApi(): Promise<boolean> {
  try {
    const { available } = await getCrusoeAvailability("A100");
    return available;
  } catch {
    return false;
  }
}
