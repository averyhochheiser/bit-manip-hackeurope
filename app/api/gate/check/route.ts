/**
 * POST /api/gate/check
 *
 * Called by the Carbon Gate GitHub Action (gate_check.py) on every PR.
 * Authenticates the org via api_key, calculates carbon emissions using
 * real-time grid data + full physics model (Carnot PUE, RK4 throttling,
 * Fourier forecast, uncertainty propagation, IPCC AR6 radiative forcing),
 * queries Crusoe for availability, persists the event, and returns the
 * graduated gate decision.
 *
 * Request body:
 *   { repo, pr_number, gpu, estimated_hours, region, api_key,
 *     intensity_history?, model_params_billions?, queries_per_day? }
 *
 * Response:
 *   { emissions_kg, emissions_sigma_kg, crusoe_emissions_kg,
 *     budget_remaining_kg, status, gate, optimal_window,
 *     crusoe_available, crusoe_instance, carbon_intensity, pue_used,
 *     throttle_adj_pct, embodied_kg, lifecycle_kg,
 *     radiative_forcing_wm2, carbon_diff, forecast }
 */

import { NextResponse }          from "next/server";
import { supabaseAdmin }         from "@/lib/supabase/admin";
import { getCarbonIntensity }    from "@/lib/electricity-maps/client";
import { getCrusoeAvailability } from "@/lib/crusoe/client";
import { estimateEmissions }     from "@/lib/carbon/calculator";

// ── Request / response types ─────────────────────────────────────────────────

interface GateCheckRequest {
  repo:             string;
  pr_number:        number;
  gpu:              string;
  estimated_hours:  number;
  region:           string;
  api_key:          string;
  /** Optional: last N hours of grid intensity for Fourier forecast */
  intensity_history?: number[];
  /** For lifecycle emissions — model size in B params */
  model_params_billions?: number;
  /** For lifecycle emissions — daily inference queries */
  queries_per_day?: number;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── 1. Parse & validate input ───────────────────────────────────────────
  let body: Partial<GateCheckRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    repo, pr_number, gpu, estimated_hours, region, api_key,
    intensity_history = [],
    model_params_billions = 7.0,
    queries_per_day = 10_000,
  } = body;

  if (!api_key) {
    return NextResponse.json({ error: "Missing api_key." }, { status: 401 });
  }
  if (!gpu || !estimated_hours || !region) {
    return NextResponse.json(
      { error: "Missing required fields: gpu, estimated_hours, region." },
      { status: 400 }
    );
  }

  // ── 2. Authenticate org via API key ────────────────────────────────────
  const { data: orgRow, error: orgError } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", api_key)
    .maybeSingle();

  if (orgError || !orgRow) {
    return NextResponse.json({ error: "Invalid or unknown api_key." }, { status: 401 });
  }

  const orgId = orgRow.org_id as string;

  // ── 3. Fetch real-time carbon intensity ────────────────────────────────
  const carbonIntensity = await getCarbonIntensity(region);

  // ── 4. Fetch org carbon budget ─────────────────────────────────────────
  const [{ data: budget }, { data: usage }] = await Promise.all([
    supabaseAdmin
      .from("carbon_budget")
      .select("included_kg, warning_pct")
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("org_usage_mtd")
      .select("used_kg")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const includedKg = budget?.included_kg ?? 50;
  const usedKg     = usage?.used_kg      ?? 0;

  // ── 5. Crusoe availability ─────────────────────────────────────────────
  const crusoe = await getCrusoeAvailability(gpu);

  // ── 6. Full physics model — estimateEmissions() ────────────────────────
  const result = estimateEmissions({
    gpu,
    estimatedHours:        estimated_hours,
    carbonIntensityGPerKwh: carbonIntensity,
    ambientTempC:          20,
    region,
    intensityHistory:       intensity_history,
    monthlyBudgetKg:        includedKg,
    monthlyUsedKg:          usedKg,
    crusoeAvailable:        crusoe.available,
    modelParamsBillions:    model_params_billions,
    queriesPerDay:          queries_per_day,
  });

  const budgetRemainingKg = Math.max(0, includedKg - usedKg - result.emissionsKg);

  // ── 7. Persist gate event ──────────────────────────────────────────────
  await supabaseAdmin.from("gate_events").insert({
    org_id:               orgId,
    repo:                 repo ?? "unknown",
    pr_number:            pr_number ?? 0,
    gpu,
    region,
    estimated_hours,
    emissions_kg:         result.emissionsKg,
    crusoe_emissions_kg:  result.crusoeEmissionsKg,
    carbon_intensity:     carbonIntensity,
    pue_used:             result.pueUsed,
    status:               result.gate.legacyStatus,
    crusoe_available:     crusoe.available,
    crusoe_instance:      crusoe.recommendedModel,
  });

  // ── 8. Return enriched response ────────────────────────────────────────
  return NextResponse.json({
    // Core emissions
    emissions_kg:          result.emissionsKg,
    emissions_sigma_kg:    result.emissionsSigma,
    crusoe_emissions_kg:   result.crusoeEmissionsKg,
    operational_kg:        result.operationalKg,
    embodied_kg:           result.embodiedKg,
    lifecycle_kg:          result.lifecycleKg,

    // Budget
    budget_remaining_kg:   Math.round(budgetRemainingKg * 100) / 100,

    // Gate decision (graduated)
    status:                result.gate.legacyStatus,   // backward compat for Action
    gate: {
      status:              result.gate.status,
      message:             result.gate.message,
      overage_kg:          result.gate.overageKg,
      overage_fraction:    result.gate.overageFraction,
      resolution_options:  result.gate.resolutionOptions,
    },

    // Forecast
    optimal_window:        result.optimalWindowHours > 0
      ? `Next low-carbon window in ~${result.optimalWindowHours}h — save ~${result.carbonSavingsPct.toFixed(0)}%`
      : "Optimal window now",
    optimal_window_hours:  result.optimalWindowHours,
    forecast_confidence:   result.optimalWindowConfidence,
    carbon_savings_pct:    result.carbonSavingsPct,
    forecast:              result.forecast,

    // Physics diagnostics
    carbon_intensity:      carbonIntensity,
    pue_used:              result.pueUsed,
    pue_sigma:             result.pueSigma,
    throttle_adj_pct:      result.throttleAdjPct,
    energy_kwh:            result.energyKwh,
    radiative_forcing_wm2: result.radiativeForcingWm2,

    // Trend
    carbon_diff:           result.carbonDiff,

    // Crusoe
    crusoe_available:      crusoe.available,
    crusoe_instance:       crusoe.recommendedModel,
  });
}
