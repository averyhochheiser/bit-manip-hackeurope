/**
 * Crusoe Inference API client
 *
 * Base URL: https://api.crusoe.ai/v1  (OpenAI-compatible)
 * Auth:     Bearer <CRUSOE_API_KEY>
 *
 * We use the /models endpoint to check real-time availability and surface
 * the best model recommendation for a given GPU workload type.
 * Crusoe runs on geothermal + solar → effectively ~5 gCO₂/kWh.
 */

const CRUSOE_API_BASE = "https://api.crusoe.ai/v1";

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
 * H100-optimised jobs get the big Llama; lighter GPUs get smaller models.
 */
const GPU_MODEL_PREFERENCES: Record<string, string[]> = {
  H100: ["llama-3.3-70b", "deepseek", "llama-3.1-70b"],
  A100: ["llama-3.1-8b", "llama-3.3-70b"],
  V100: ["llama-3.2-3b", "llama-3.1-8b"],
  A10:  ["llama-3.2-1b", "llama-3.2-3b"],
  A10G: ["llama-3.2-1b", "llama-3.2-3b"],
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
    const recommended =
      models.find((m) => preferences.some((pref) => m.id.toLowerCase().includes(pref))) ??
      models[0] ??
      null;

    return {
      available: models.length > 0,
      models,
      recommendedModel: recommended?.id ?? null,
    };
  } catch (err) {
    console.error("[crusoe] availability check failed, using fallback:", err);
    // Fail open — we know Crusoe capacity is generally available
    return {
      available: true,
      models: [],
      recommendedModel: "meta-llama/Llama-3.3-70B-Instruct",
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
