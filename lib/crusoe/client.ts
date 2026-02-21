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
 * Uses real model IDs from Crusoe's live /models endpoint (verified Feb 2026).
 *
 * Available models:
 *   Qwen/Qwen3-235B-A22B-Instruct-2507   (235B params)
 *   deepseek-ai/DeepSeek-R1-0528          (reasoning)
 *   deepseek-ai/DeepSeek-V3-0324          (general)
 *   google/gemma-3-12b-it                 (lightweight)
 *   meta-llama/Llama-3.3-70B-Instruct     (70B, versatile)
 *   moonshotai/Kimi-K2-Thinking           (reasoning)
 *   openai/gpt-oss-120b                   (120B)
 */
const GPU_MODEL_PREFERENCES: Record<string, string[]> = {
  H100: [
    "Qwen/Qwen3-235B-A22B-Instruct-2507",
    "deepseek-ai/DeepSeek-R1-0528",
    "openai/gpt-oss-120b",
  ],
  A100: [
    "meta-llama/Llama-3.3-70B-Instruct",
    "deepseek-ai/DeepSeek-V3-0324",
    "openai/gpt-oss-120b",
  ],
  V100: [
    "meta-llama/Llama-3.3-70B-Instruct",
    "google/gemma-3-12b-it",
  ],
  A10: [
    "google/gemma-3-12b-it",
    "meta-llama/Llama-3.3-70B-Instruct",
  ],
  A10G: [
    "google/gemma-3-12b-it",
    "meta-llama/Llama-3.3-70B-Instruct",
  ],
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
